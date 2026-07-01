import { z } from "zod";
import { createHash } from "node:crypto";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import {
  adminProcedure,
  protectedProcedure,
  publicProcedure,
  router,
} from "./_core/trpc";
import { stripeRouter } from "./stripeRouter";
import {
  getDb,
  getUserByOpenId,
  createDocument,
  getUserDocuments,
  getDocumentById,
  updateDocumentStatus,
  createAgentOutput,
  getAgentOutputByDocumentId,
  getAgentOutputsByDocumentIds,
  deleteAgentOutputById,
  deleteAgentOutputsByDocumentIds,
  deleteAnalysisArtifactsForDocuments,
  createSwarmSession,
  updateSwarmSession,
  getSwarmSession,
  createSwarmAgentResult,
  updateSwarmAgentResult,
  getSwarmAgentResults,
  createAgentRun,
  updateAgentRun,
  createAgentFinding,
  updateAgentFinding,
  createAgentFindingAudit,
  createLlmUsageEvent,
  getAgentFindingsByUserId,
} from "./db";
import {
  documents,
  agentOutputs,
  agentFindings,
  caseDocuments,
  generatedReports,
  subscriptions,
  payments,
  users,
  workspaceCases,
} from "../drizzle/schema";
import { and, desc, eq, inArray } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";
import type { AgentConfig } from "./agentConfig";
import { AGENTS, getAgentById, getAgentsBySector } from "./agentConfig";
import { fileProcessingRouter } from "./fileProcessing";
import { reportRouter } from "./reportGenerator";
import { uploadRouter } from "./uploadRouter";
import { integrationsRouter } from "./integrationsRouter";
import { settingsRouter } from "./settingsRouter";
import {
  enforceAgentRunAccess,
  enforceDocumentUploadLimit,
  enforceDraftAccess,
  enforcePageAnalysisLimit,
  enforceSwarmProcessingAccess,
} from "./accessControl";
import {
  LEVERAGE_PROMPT_VERSION,
  applyRiskBasedQcGate,
  auditFindingWithLLM,
  buildStructuredAgentPrompt,
  buildWarRoomSynthesis,
  fallbackQcAuditForFinding,
  isReportEligible,
  normalizeQcAuditForReportUse,
  parseStructuredAgentOutput,
  usageFromResponse,
  verifyFindingQuotes,
  type StructuredFinding,
} from "./leverageEngine";
import {
  analyzeExtractionDiagnostics,
  documentReadinessReason,
  isDocumentReadyForAnalysis,
  withSourceAnchor,
} from "./extractionReadiness";
import {
  buildMasterRecords,
  consolidateDocumentsForAnalysis,
} from "./recordConsolidation";

function assertDocumentReadyForAnalysis(
  document: Parameters<typeof isDocumentReadyForAnalysis>[0]
) {
  if (!isDocumentReadyForAnalysis(document)) {
    throw new Error(
      documentReadinessReason(document) ||
        `${document.fileName || "Document"} is not ready for agent analysis yet.`
    );
  }
}

function safeJsonArray(value: string | null): unknown[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

type CaseSummaryDocument = typeof documents.$inferSelect;
type CaseSummaryFinding = typeof agentFindings.$inferSelect;
type CaseSummaryReport = typeof generatedReports.$inferSelect;

function safeJsonNumberArray(value: string | null): number[] {
  return safeJsonArray(value)
    .map(item => Number(item))
    .filter(item => Number.isFinite(item));
}

function findingDocumentIds(finding: CaseSummaryFinding): number[] {
  const anchors = safeJsonArray(finding.sourceAnchors);
  return anchors
    .map(anchor => {
      if (!anchor || typeof anchor !== "object") return null;
      const maybeId = (anchor as { documentId?: unknown }).documentId;
      const id = Number(maybeId);
      return Number.isFinite(id) ? id : null;
    })
    .filter((id): id is number => id !== null);
}

function intersects(left: Set<number>, right: number[]) {
  return right.some(item => left.has(item));
}

function isMissingCaseTableError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  return /workspace_cases|case_documents|doesn't exist|unknown table|no such table/i.test(
    message
  );
}

function caseHealthStatus({
  totalDocuments,
  completedDocuments,
  failedDocuments,
  pendingDocuments,
  reportReadyFindings,
  savedReports,
}: {
  totalDocuments: number;
  completedDocuments: number;
  failedDocuments: number;
  pendingDocuments: number;
  reportReadyFindings: number;
  savedReports: number;
}) {
  if (totalDocuments === 0) return "empty";
  if (failedDocuments > 0) return "blocked";
  if (pendingDocuments > 0) return "processing";
  if (
    completedDocuments === totalDocuments &&
    reportReadyFindings > 0 &&
    savedReports > 0
  )
    return "packet_ready";
  if (completedDocuments === totalDocuments && reportReadyFindings > 0)
    return "findings_ready";
  if (completedDocuments === totalDocuments) return "analysis_ready";
  return "needs_intake";
}

function caseNextAction(status: string) {
  switch (status) {
    case "empty":
      return {
        label: "Add documents",
        route: "/sector/corpus",
        detail: "This case has no assigned evidence yet.",
      };
    case "blocked":
      return {
        label: "Fix OCR",
        route: "/sector/corpus?status=failed",
        detail: "Extraction failures must be fixed before analysis.",
      };
    case "processing":
      return {
        label: "Check processing",
        route: "/sector/corpus?status=active",
        detail: "Wait for pending files before running agents.",
      };
    case "analysis_ready":
      return {
        label: "Run analysis",
        route: "/sector/arsenal",
        detail: "Evidence is ready; findings are not built yet.",
      };
    case "findings_ready":
      return {
        label: "Build report",
        route: "/reports",
        detail: "Findings exist; turn them into an exportable packet.",
      };
    case "packet_ready":
      return {
        label: "Compare packet",
        route: "/reports",
        detail: "This case has exportable work product.",
      };
    default:
      return {
        label: "Review case",
        route: "/dashboard",
        detail: "Open the case and inspect readiness.",
      };
  }
}

function buildCaseSummary(input: {
  id: number | null;
  title: string;
  caseNumber?: string | null;
  jurisdiction?: string | null;
  posture?: string | null;
  strategy?: string | null;
  status?: string;
  documents: CaseSummaryDocument[];
  findings: CaseSummaryFinding[];
  reports: CaseSummaryReport[];
  virtual?: boolean;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
}) {
  const documentIdSet = new Set(input.documents.map(document => document.id));
  const completedDocuments = input.documents.filter(
    document => document.status === "completed"
  ).length;
  const failedDocuments = input.documents.filter(
    document => document.status === "failed"
  ).length;
  const pendingDocuments = input.documents.filter(
    document =>
      document.status === "pending" || document.status === "processing"
  ).length;
  const reportReadyFindings = input.findings.filter(finding =>
    ["approved", "downgraded", "not_required"].includes(finding.qcStatus)
  ).length;
  const blockedFindings = input.findings.filter(finding =>
    ["blocked", "needs_more_proof", "pending"].includes(finding.qcStatus)
  ).length;
  const highLeverageFindings = input.findings.filter(
    finding => finding.leverageScore >= 80
  ).length;
  const readiness =
    input.documents.length > 0
      ? Math.round((completedDocuments / input.documents.length) * 100)
      : 0;
  const status = caseHealthStatus({
    totalDocuments: input.documents.length,
    completedDocuments,
    failedDocuments,
    pendingDocuments,
    reportReadyFindings,
    savedReports: input.reports.length,
  });
  const reportCoverage =
    reportReadyFindings > 0
      ? Math.min(
          100,
          Math.round((input.reports.length / reportReadyFindings) * 100)
        )
      : input.reports.length > 0
        ? 100
        : 0;
  const comparisonScore = Math.round(
    ([
      input.documents.length > 0,
      readiness === 100,
      failedDocuments === 0 &&
        pendingDocuments === 0 &&
        input.documents.length > 0,
      reportReadyFindings > 0,
      highLeverageFindings > 0,
      input.reports.length > 0,
    ].filter(Boolean).length /
      6) *
      100
  );

  return {
    id: input.id,
    title: input.title,
    caseNumber: input.caseNumber ?? null,
    jurisdiction: input.jurisdiction ?? null,
    posture: input.posture ?? null,
    strategy: input.strategy ?? null,
    status: input.status ?? "active",
    healthStatus: status,
    virtual: Boolean(input.virtual),
    createdAt: input.createdAt ?? null,
    updatedAt: input.updatedAt ?? null,
    documentIds: Array.from(documentIdSet),
    latestReport: input.reports[0]
      ? {
          id: input.reports[0].id,
          title: input.reports[0].title,
          template: input.reports[0].template,
          format: input.reports[0].format,
          createdAt: input.reports[0].createdAt,
        }
      : null,
    stats: {
      documents: input.documents.length,
      completedDocuments,
      failedDocuments,
      pendingDocuments,
      readiness,
      findings: input.findings.length,
      reportReadyFindings,
      blockedFindings,
      highLeverageFindings,
      savedReports: input.reports.length,
      reportCoverage,
      comparisonScore,
    },
    nextAction: caseNextAction(status),
  };
}

function buildVirtualWorkspaceCase(input: {
  documents: CaseSummaryDocument[];
  findings: CaseSummaryFinding[];
  reports: CaseSummaryReport[];
}) {
  return buildCaseSummary({
    id: null,
    title: "Whole workspace record",
    caseNumber: null,
    jurisdiction: "All current uploads",
    posture: "Virtual fallback until workspace cases are created",
    strategy:
      "Create separate cases so documents, findings, and reports can be compared matter by matter.",
    status: "active",
    documents: input.documents,
    findings: input.findings,
    reports: input.reports,
    virtual: true,
  });
}

async function getWorkspaceCaseDocumentIdSet(
  userId: number,
  caseId: number | undefined
): Promise<Set<number> | null> {
  if (caseId === undefined) return null;
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    const caseRecord = await db
      .select({ id: workspaceCases.id })
      .from(workspaceCases)
      .where(
        and(eq(workspaceCases.id, caseId), eq(workspaceCases.userId, userId))
      )
      .limit(1);
    if (caseRecord.length === 0) {
      throw new Error("Workspace case not found.");
    }

    const memberships = await db
      .select({ documentId: caseDocuments.documentId })
      .from(caseDocuments)
      .where(
        and(eq(caseDocuments.caseId, caseId), eq(caseDocuments.userId, userId))
      );

    return new Set(memberships.map(membership => membership.documentId));
  } catch (error) {
    if (isMissingCaseTableError(error)) {
      throw new Error(
        "Workspace case tables are not migrated yet. Run the workspace-case migration before case-scoped analysis."
      );
    }
    throw error;
  }
}

export const appRouter = router({
  system: systemRouter,
  stripe: stripeRouter,
  fileProcessing: fileProcessingRouter,
  reports: reportRouter,
  upload: uploadRouter,
  integrations: integrationsRouter,
  settings: settingsRouter,

  cases: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      const [userDocuments, findings] = await Promise.all([
        getUserDocuments(ctx.user.id),
        getAgentFindingsByUserId(ctx.user.id),
      ]);

      if (!db) {
        return {
          migrationRequired: true,
          cases: [
            buildVirtualWorkspaceCase({
              documents: userDocuments,
              findings,
              reports: [],
            }),
          ],
        };
      }

      let reports: CaseSummaryReport[] = [];
      try {
        reports = await db
          .select()
          .from(generatedReports)
          .where(eq(generatedReports.userId, ctx.user.id))
          .orderBy(desc(generatedReports.createdAt));
      } catch {
        reports = [];
      }

      try {
        const [cases, memberships] = await Promise.all([
          db
            .select()
            .from(workspaceCases)
            .where(eq(workspaceCases.userId, ctx.user.id))
            .orderBy(desc(workspaceCases.updatedAt)),
          db
            .select()
            .from(caseDocuments)
            .where(eq(caseDocuments.userId, ctx.user.id)),
        ]);

        if (cases.length === 0) {
          return {
            migrationRequired: false,
            cases: [
              buildVirtualWorkspaceCase({
                documents: userDocuments,
                findings,
                reports,
              }),
            ],
          };
        }

        const documentsById = new Map(
          userDocuments.map(document => [document.id, document])
        );
        const summaries = cases.map(caseItem => {
          const documentIds = memberships
            .filter(membership => membership.caseId === caseItem.id)
            .map(membership => membership.documentId);
          const documentIdSet = new Set(documentIds);
          const caseDocumentsInScope = documentIds
            .map(documentId => documentsById.get(documentId))
            .filter((document): document is CaseSummaryDocument =>
              Boolean(document)
            );
          const findingsInScope =
            documentIdSet.size > 0
              ? findings.filter(finding =>
                  intersects(documentIdSet, findingDocumentIds(finding))
                )
              : [];
          const reportsInScope =
            documentIdSet.size > 0
              ? reports.filter(report =>
                  intersects(
                    documentIdSet,
                    safeJsonNumberArray(report.documentIds)
                  )
                )
              : [];

          return buildCaseSummary({
            id: caseItem.id,
            title: caseItem.title,
            caseNumber: caseItem.caseNumber,
            jurisdiction: caseItem.jurisdiction,
            posture: caseItem.posture,
            strategy: caseItem.strategy,
            status: caseItem.status,
            documents: caseDocumentsInScope,
            findings: findingsInScope,
            reports: reportsInScope,
            createdAt: caseItem.createdAt,
            updatedAt: caseItem.updatedAt,
          });
        });

        const assignedDocumentIds = new Set(
          memberships.map(membership => membership.documentId)
        );
        const unassignedDocuments = userDocuments.filter(
          document => !assignedDocumentIds.has(document.id)
        );
        if (unassignedDocuments.length > 0) {
          const unassignedIdSet = new Set(
            unassignedDocuments.map(document => document.id)
          );
          summaries.push(
            buildCaseSummary({
              id: null,
              title: "Unassigned evidence pool",
              jurisdiction: "Workspace intake",
              posture: "Documents not attached to a case yet",
              strategy:
                "Assign these files before using case-level comparison as a quality signal.",
              status: "watchlist",
              documents: unassignedDocuments,
              findings: findings.filter(finding =>
                intersects(unassignedIdSet, findingDocumentIds(finding))
              ),
              reports: reports.filter(report =>
                intersects(
                  unassignedIdSet,
                  safeJsonNumberArray(report.documentIds)
                )
              ),
              virtual: true,
            })
          );
        }

        return {
          migrationRequired: false,
          cases: summaries,
        };
      } catch (error) {
        if (!isMissingCaseTableError(error)) {
          throw error;
        }
        return {
          migrationRequired: true,
          cases: [
            buildVirtualWorkspaceCase({
              documents: userDocuments,
              findings,
              reports,
            }),
          ],
        };
      }
    }),

    create: protectedProcedure
      .input(
        z.object({
          title: z.string().trim().min(2).max(255),
          caseNumber: z.string().trim().max(120).optional(),
          jurisdiction: z.string().trim().max(255).optional(),
          posture: z.string().trim().max(255).optional(),
          strategy: z.string().trim().max(2000).optional(),
          status: z.enum(["active", "watchlist", "archived"]).default("active"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        try {
          const result = await db.insert(workspaceCases).values({
            userId: ctx.user.id,
            title: input.title,
            caseNumber: input.caseNumber || null,
            jurisdiction: input.jurisdiction || null,
            posture: input.posture || null,
            strategy: input.strategy || null,
            status: input.status,
          });
          const insertedId = Number(result[0].insertId);
          const inserted = await db
            .select()
            .from(workspaceCases)
            .where(eq(workspaceCases.id, insertedId))
            .limit(1);
          return inserted[0];
        } catch (error) {
          if (isMissingCaseTableError(error)) {
            throw new Error(
              "Workspace case tables are not migrated yet. Run pnpm run db:push before creating durable cases."
            );
          }
          throw error;
        }
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          title: z.string().trim().min(2).max(255).optional(),
          caseNumber: z.string().trim().max(120).nullable().optional(),
          jurisdiction: z.string().trim().max(255).nullable().optional(),
          posture: z.string().trim().max(255).nullable().optional(),
          strategy: z.string().trim().max(2000).nullable().optional(),
          status: z.enum(["active", "watchlist", "archived"]).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const updateData: Record<string, unknown> = {};
        for (const field of [
          "title",
          "caseNumber",
          "jurisdiction",
          "posture",
          "strategy",
          "status",
        ] as const) {
          if (input[field] !== undefined) updateData[field] = input[field];
        }
        if (Object.keys(updateData).length === 0) return { success: true };

        await db
          .update(workspaceCases)
          .set(updateData)
          .where(
            and(
              eq(workspaceCases.id, input.id),
              eq(workspaceCases.userId, ctx.user.id)
            )
          );

        return { success: true };
      }),

    setDocuments: protectedProcedure
      .input(
        z.object({
          caseId: z.number(),
          documentIds: z.array(z.number()).default([]),
          role: z.enum(["primary", "comparison", "shared"]).default("primary"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const caseRecord = await db
          .select()
          .from(workspaceCases)
          .where(
            and(
              eq(workspaceCases.id, input.caseId),
              eq(workspaceCases.userId, ctx.user.id)
            )
          )
          .limit(1);
        if (!caseRecord[0]) throw new Error("Case not found");

        const ownedDocuments =
          input.documentIds.length > 0
            ? await db
                .select({ id: documents.id })
                .from(documents)
                .where(
                  and(
                    eq(documents.userId, ctx.user.id),
                    inArray(documents.id, input.documentIds)
                  )
                )
            : [];
        const ownedIds = new Set(ownedDocuments.map(document => document.id));
        const rejectedIds = input.documentIds.filter(id => !ownedIds.has(id));
        if (rejectedIds.length > 0) {
          throw new Error(
            "One or more documents do not belong to this workspace."
          );
        }

        await db
          .delete(caseDocuments)
          .where(
            and(
              eq(caseDocuments.userId, ctx.user.id),
              eq(caseDocuments.caseId, input.caseId)
            )
          );

        if (input.documentIds.length > 0) {
          await db.insert(caseDocuments).values(
            input.documentIds.map(documentId => ({
              userId: ctx.user.id,
              caseId: input.caseId,
              documentId,
              role: input.role,
            }))
          );
        }

        return { success: true };
      }),
  }),

  agents: router({
    catalog: adminProcedure.query(() => {
      return {
        agents: AGENTS.map(agent => ({
          id: agent.id,
          name: agent.name,
          division: agent.division,
          description: agent.description,
          capabilities: agent.capabilities,
        })),
        superAgents: [
          {
            id: "case_triage",
            name: "Case Triage",
            description:
              "Fast first pass for issues, proof gaps, and next actions.",
            agentIds: [
              "constitutional_analyst",
              "criminal_law_specialist",
              "pattern_recognition_engine",
              "timeline_constructor",
            ],
          },
          {
            id: "constitutional_record",
            name: "Constitutional Record Builder",
            description:
              "Turns the record into rights violations, authority, and civil-rights framing.",
            agentIds: [
              "constitutional_analyst",
              "civil_rights_expert",
              "mandamus_writ_architect",
              "precedent_miner",
              "statute_scanner",
            ],
          },
          {
            id: "brady_misconduct",
            name: "Brady and Misconduct Review",
            description:
              "Looks for disclosure failures, false testimony, contradictions, and prosecutorial misconduct.",
            agentIds: [
              "criminal_law_specialist",
              "contradiction_detector",
              "timeline_constructor",
              "canon_hunter",
            ],
          },
          {
            id: "monell_pattern",
            name: "Monell Pattern Map",
            description:
              "Maps policy/custom, failure to train, ratification, missing pattern proof, and municipal-liability pressure.",
            agentIds: [
              "monell_pattern_mapper",
              "liability_remedy_ranker",
              "civil_rights_expert",
              "pattern_recognition_engine",
              "discovery_tactician",
            ],
          },
          {
            id: "liability_war_room",
            name: "Liability War Room",
            description:
              "Ranks the highest-payoff/highest-win issues, then checks weak claims before synthesis.",
            agentIds: [
              "liability_remedy_ranker",
              "immunity_piercer",
              "mandamus_writ_architect",
              "monell_pattern_mapper",
              "criminal_law_specialist",
              "contradiction_detector",
              "qc_auditor",
            ],
          },
          {
            id: "mandamus_writ_team",
            name: "Mandamus Writ Team",
            description:
              "Tests clear-duty writ viability, missing record demands, no-adequate-remedy risk, and petition-ready relief.",
            agentIds: [
              "mandamus_writ_architect",
              "appellate_strategist",
              "constitutional_analyst",
              "discovery_tactician",
              "precedent_miner",
              "qc_auditor",
            ],
          },
          {
            id: "leverage_engine_v2",
            name: "Leverage Engine v2 Strike Team",
            description:
              "Maximum skepticism: gap architect, contradiction/pattern hunter, constitutional/criminal procedure, Monell, evasion, discovery, authority, and ruthless QC.",
            agentIds: [
              "timeline_constructor",
              "contradiction_detector",
              "pattern_recognition_engine",
              "constitutional_analyst",
              "civil_rights_expert",
              "criminal_law_specialist",
              "immunity_piercer",
              "mandamus_writ_architect",
              "monell_pattern_mapper",
              "skeptical_adversarial_reader",
              "liability_remedy_ranker",
              "discovery_tactician",
              "precedent_miner",
              "canon_hunter",
              "qc_auditor",
            ],
          },
          {
            id: "motion_ready",
            name: "Motion-Ready Drafting",
            description:
              "Pairs legal analysis with strategy and drafting agents for a court-facing scaffold.",
            agentIds: [
              "motion_drafter",
              "mandamus_writ_architect",
              "constitutional_analyst",
              "precedent_miner",
              "discovery_tactician",
            ],
          },
          {
            id: "full_admin_panel",
            name: "Full Admin Panel",
            description:
              "Runs every configured DueProcess agent across the selected scope.",
            agentIds: AGENTS.map(agent => agent.id),
          },
        ],
      };
    }),

    /**
     * Process a document with a specific agent
     */
    processDocument: protectedProcedure
      .input(
        z.object({
          documentId: z.number(),
          agentId: z.string(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { documentId, agentId } = input;
        const userId = ctx.user.id;
        await enforceAgentRunAccess(ctx.user, "legal");

        // Get the agent configuration
        const agent = getAgentById(agentId);
        if (!agent) {
          throw new Error("Agent not found");
        }

        // Get the document
        const document = await getDocumentById(documentId);
        if (!document || document.userId !== userId) {
          throw new Error("Document not found or unauthorized");
        }
        assertDocumentReadyForAnalysis(document);
        await enforcePageAnalysisLimit(ctx.user, [document], "agent analysis");

        // Update document status to processing
        await updateDocumentStatus(documentId, "processing");

        try {
          // Prepare the input for the agent
          const documentContent =
            document.extractedText ||
            document.summary ||
            "[No text content available]";
          const userPrompt = `Analyze this document:\n\nFilename: ${document.fileName}\nContent:\n${documentContent}`;

          // Call the LLM with the agent's system prompt
          const response = await invokeLLM({
            messages: [
              { role: "system", content: agent.systemPrompt },
              { role: "user", content: userPrompt },
            ],
          });

          const messageContent = response.choices[0]?.message?.content;
          const output =
            typeof messageContent === "string"
              ? messageContent
              : JSON.stringify(messageContent) || "No response generated";

          // Save the agent output to database
          await createAgentOutput({
            documentId,
            agentId: agent.id,
            agentName: agent.name,
            output,
          });

          // Update document status to completed
          await updateDocumentStatus(documentId, "completed");

          return {
            success: true,
            agentId: agent.id,
            agentName: agent.name,
            output,
          };
        } catch (error) {
          // Update document status to failed
          await updateDocumentStatus(documentId, "failed");
          throw error;
        }
      }),

    /**
     * Get agent outputs for a document
     */
    getOutputs: protectedProcedure
      .input(
        z.object({
          documentId: z.number(),
        })
      )
      .query(async ({ input, ctx }) => {
        const { documentId } = input;
        const userId = ctx.user.id;

        // Verify document ownership
        const document = await getDocumentById(documentId);
        if (!document || document.userId !== userId) {
          throw new Error("Document not found or unauthorized");
        }
        assertDocumentReadyForAnalysis(document);

        // Get all agent outputs for this document
        const outputs = await getAgentOutputByDocumentId(documentId);
        return outputs;
      }),

    /**
     * Get saved agent runs for the current user.
     */
    listSavedRuns: protectedProcedure.query(async ({ ctx }) => {
      const userDocuments = await getUserDocuments(ctx.user.id);
      const documentById = new Map(
        userDocuments.map(document => [document.id, document])
      );
      const outputs = await getAgentOutputsByDocumentIds(
        userDocuments.map(document => document.id)
      );

      return outputs.map(output => {
        const document = documentById.get(output.documentId);
        return {
          id: output.id,
          documentId: output.documentId,
          documentName: document?.fileName ?? "Deleted document",
          agentId: output.agentId,
          agentName: output.agentName,
          output: output.output,
          createdAt: output.createdAt,
        };
      });
    }),

    listFindings: protectedProcedure
      .input(z.object({ caseId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const findings = await getAgentFindingsByUserId(ctx.user.id);
        const caseDocumentIdSet = await getWorkspaceCaseDocumentIdSet(
          ctx.user.id,
          input?.caseId
        );
        const scopedFindings = caseDocumentIdSet
          ? findings.filter(finding =>
              intersects(caseDocumentIdSet, findingDocumentIds(finding))
            )
          : findings;
        return scopedFindings.map(finding => ({
          id: finding.id,
          runId: finding.runId,
          outputId: finding.outputId,
          agentId: finding.agentId,
          agentName: finding.agentName,
          title: finding.title,
          findingType: finding.findingType,
          liabilityVector: finding.liabilityVector,
          remedyPath: finding.remedyPath,
          severity: finding.severity,
          confidence: finding.confidence,
          leverageScore: finding.leverageScore,
          summary: finding.summary,
          sourceAnchors: safeJsonArray(finding.sourceAnchors),
          missingRecords: safeJsonArray(finding.missingRecords),
          legalAuthorities: safeJsonArray(finding.legalAuthorities),
          nextAction: finding.nextAction,
          qcStatus: finding.qcStatus,
          qcReason: finding.qcReason,
          includedInReports: Boolean(finding.includedInReports),
          createdAt: finding.createdAt,
        }));
      }),

    /**
     * Delete one saved agent output.
     */
    deleteOutput: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const userDocuments = await getUserDocuments(ctx.user.id);
        const outputs = await getAgentOutputsByDocumentIds(
          userDocuments.map(document => document.id)
        );
        const target = outputs.find(output => output.id === input.id);

        if (!target) {
          throw new Error("Saved output not found or unauthorized");
        }

        await deleteAgentOutputById(input.id);
        return { success: true };
      }),

    /**
     * Delete every saved agent output for the current user.
     */
    deleteSavedRuns: protectedProcedure.mutation(async ({ ctx }) => {
      const userDocuments = await getUserDocuments(ctx.user.id);
      await deleteAgentOutputsByDocumentIds(
        userDocuments.map(document => document.id)
      );
      return { success: true };
    }),

    /**
     * Process document with all agents in a sector (swarm processing)
     */
    processSwarm: protectedProcedure
      .input(
        z.object({
          documentId: z.number(),
          sector: z.enum([
            "tactical",
            "legal",
            "intel",
            "evidence",
            "offensive",
          ]),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { documentId, sector } = input;
        const userId = ctx.user.id;
        await enforceAgentRunAccess(ctx.user, sector);

        // Get the document
        const document = await getDocumentById(documentId);
        if (!document || document.userId !== userId) {
          throw new Error("Document not found or unauthorized");
        }
        assertDocumentReadyForAnalysis(document);

        // Get all agents for this sector
        const sectorAgents = getAgentsBySector(sector);
        if (sectorAgents.length === 0) {
          throw new Error("No agents found for this sector");
        }
        await enforceSwarmProcessingAccess(ctx.user, sectorAgents.length);
        await enforcePageAnalysisLimit(ctx.user, [document], "swarm analysis");

        // Create swarm session
        const swarmSessionId = await createSwarmSession({
          userId,
          documentId,
          sector,
          status: "processing",
          totalAgents: sectorAgents.length,
          completedAgents: 0,
        });

        // Create agent result placeholders
        const agentResultIds = await Promise.all(
          sectorAgents.map((agent: any) =>
            createSwarmAgentResult({
              swarmSessionId,
              agentId: agent.id,
              agentName: agent.name,
              status: "pending",
            })
          )
        );

        // Process all agents in parallel
        const documentContent =
          document.extractedText ||
          document.summary ||
          "[No text content available]";
        const userPrompt = `Analyze this document:\n\nFilename: ${document.fileName}\nContent:\n${documentContent}`;

        const processingPromises = sectorAgents.map(
          async (agent: any, index: number) => {
            const resultId = agentResultIds[index];
            const startTime = Date.now();

            try {
              // Update status to processing
              await updateSwarmAgentResult(resultId, { status: "processing" });

              // Call LLM
              const response = await invokeLLM({
                messages: [
                  { role: "system", content: agent.systemPrompt },
                  { role: "user", content: userPrompt },
                ],
              });

              const messageContent = response.choices[0]?.message?.content;
              const output =
                typeof messageContent === "string"
                  ? messageContent
                  : JSON.stringify(messageContent) || "No response generated";
              const processingTime = Date.now() - startTime;

              // Update with success
              await updateSwarmAgentResult(resultId, {
                status: "completed",
                output,
                processingTime,
                completedAt: new Date(),
              });

              // Also save to agentOutputs for compatibility
              await createAgentOutput({
                documentId,
                agentId: agent.id,
                agentName: agent.name,
                output,
              });

              return { success: true, agentId: agent.id };
            } catch (error) {
              const processingTime = Date.now() - startTime;
              const errorMessage =
                error instanceof Error ? error.message : "Unknown error";

              // Update with error
              await updateSwarmAgentResult(resultId, {
                status: "failed",
                error: errorMessage,
                processingTime,
                completedAt: new Date(),
              });

              return { success: false, agentId: agent.id, error: errorMessage };
            }
          }
        );

        // Wait for all agents to complete
        const results = await Promise.all(processingPromises);
        const completedCount = results.filter((r: any) => r.success).length;

        // Update swarm session
        await updateSwarmSession(swarmSessionId, {
          status:
            completedCount === sectorAgents.length ? "completed" : "failed",
          completedAgents: completedCount,
          completedAt: new Date(),
        });

        return {
          success: true,
          swarmSessionId,
          totalAgents: sectorAgents.length,
          completedAgents: completedCount,
          results,
        };
      }),

    /**
     * Process a whole case, one document, or a time period with every agent in a sector.
     */
    processScope: protectedProcedure
      .input(
        z.object({
          sector: z.enum([
            "tactical",
            "legal",
            "intel",
            "evidence",
            "offensive",
          ]),
          scope: z.enum(["all", "file", "time"]),
          caseId: z.number().optional(),
          documentId: z.number().optional(),
          documentIds: z.array(z.number()).optional(),
          agentIds: z.array(z.string()).optional(),
          fromDate: z.string().optional(),
          toDate: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const userId = ctx.user.id;
        const allDocuments = await getUserDocuments(userId);
        await enforceAgentRunAccess(ctx.user, input.sector);
        const caseDocumentIdSet = await getWorkspaceCaseDocumentIdSet(
          userId,
          input.caseId
        );
        const candidateDocuments = caseDocumentIdSet
          ? allDocuments.filter(document => caseDocumentIdSet.has(document.id))
          : allDocuments;

        const parseDateBound = (
          value: string | undefined,
          endOfDay: boolean
        ): Date | null => {
          if (!value) return null;
          const parsed = new Date(
            `${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`
          );
          return Number.isNaN(parsed.getTime()) ? null : parsed;
        };

        const fromDate = parseDateBound(input.fromDate, false);
        const toDate = parseDateBound(input.toDate, true);

        let selectedDocuments = candidateDocuments;
        const selectedDocumentIds =
          input.documentIds && input.documentIds.length > 0
            ? Array.from(new Set(input.documentIds))
            : input.documentId
              ? [input.documentId]
              : [];

        if (input.scope === "file") {
          if (selectedDocumentIds.length === 0) {
            throw new Error(
              "Choose one or more documents before running file analysis."
            );
          }
          if (
            caseDocumentIdSet &&
            selectedDocumentIds.some(
              documentId => !caseDocumentIdSet.has(documentId)
            )
          ) {
            throw new Error(
              "Selected files are not assigned to this workspace case."
            );
          }
          selectedDocuments = candidateDocuments.filter(document =>
            selectedDocumentIds.includes(document.id)
          );
        }

        if (input.scope === "time") {
          if (!fromDate && !toDate) {
            throw new Error(
              "Choose a start date, end date, or both before running time-period analysis."
            );
          }
          selectedDocuments = candidateDocuments.filter(document => {
            const createdAt = new Date(document.createdAt);
            if (Number.isNaN(createdAt.getTime())) return false;
            if (fromDate && createdAt < fromDate) return false;
            if (toDate && createdAt > toDate) return false;
            return true;
          });
        }

        if (selectedDocuments.length === 0) {
          throw new Error("No matching documents found in your Corpus.");
        }
        const consolidatedSelection =
          consolidateDocumentsForAnalysis(selectedDocuments);
        if (consolidatedSelection.blockingDocuments.length > 0) {
          assertDocumentReadyForAnalysis(
            consolidatedSelection.blockingDocuments[0]
          );
        }
        const analysisDocuments = consolidatedSelection.documents;
        if (analysisDocuments.length === 0) {
          throw new Error(
            "No analysis-ready master records found in your Corpus."
          );
        }

        const hasCustomAgentSelection = Boolean(
          input.agentIds && input.agentIds.length > 0
        );
        const isConfiguredOwner =
          Boolean(process.env.OWNER_OPEN_ID) &&
          ctx.user.openId === process.env.OWNER_OPEN_ID;
        if (
          hasCustomAgentSelection &&
          (ctx.user.role !== "admin" || !isConfiguredOwner)
        ) {
          throw new Error(
            "Custom agent selection is only available to the configured owner/admin account."
          );
        }

        const customAgentIds = input.agentIds
          ? Array.from(new Set(input.agentIds))
          : [];
        const sectorAgents = hasCustomAgentSelection
          ? customAgentIds
              .map(agentId => getAgentById(agentId))
              .filter((agent): agent is AgentConfig => Boolean(agent))
          : getAgentsBySector(input.sector);
        if (sectorAgents.length === 0) {
          throw new Error("No agents found for this analysis area.");
        }
        await enforceSwarmProcessingAccess(ctx.user, sectorAgents.length);
        await enforcePageAnalysisLimit(
          ctx.user,
          analysisDocuments,
          "scoped analysis"
        );

        const contextLimit = 60000;
        const perDocumentLimit = Math.max(
          2500,
          Math.floor(contextLimit / analysisDocuments.length)
        );
        const formatDate = (value: Date | string): string => {
          const date = value instanceof Date ? value : new Date(value);
          return Number.isNaN(date.getTime())
            ? String(value)
            : date.toISOString();
        };

        const caseRecord = analysisDocuments
          .map((document, index) => {
            const text =
              document.extractedText ||
              document.summary ||
              "[No extracted text available]";
            return [
              `DOCUMENT ${index + 1}`,
              `File: ${document.fileName}`,
              `Uploaded: ${formatDate(document.createdAt)}`,
              `Document ID: ${document.id}`,
              text.slice(0, perDocumentLimit),
            ].join("\n");
          })
          .join("\n\n---\n\n")
          .slice(0, contextLimit);

        const anchorDocument = analysisDocuments[0];
        const scopeLabel =
          input.scope === "all"
            ? "the entire case corpus"
            : input.scope === "file"
              ? "the selected file"
              : "the selected time period";
        const eraInstruction =
          input.scope === "time"
            ? `Focus on case events, facts, filings, and contradictions in this period: ${input.fromDate || "case start"} through ${input.toDate || "case end"}. Review every included document for references to that period even if the file was uploaded later.`
            : "";

        const run = await createAgentRun({
          userId,
          anchorDocumentId: anchorDocument.id,
          sector: input.sector,
          scope: input.scope,
          documentIds: JSON.stringify(
            selectedDocuments.map(document => document.id)
          ),
          agentIds: JSON.stringify(sectorAgents.map(agent => agent.id)),
          status: "processing",
          totalAgents: sectorAgents.length,
          completedAgents: 0,
          promptVersion: LEVERAGE_PROMPT_VERSION,
        });
        const allStructuredFindings: StructuredFinding[] = [];
        let aggregatePromptTokens = 0;
        let aggregateCompletionTokens = 0;
        let aggregateTotalTokens = 0;
        let aggregateCostCents = 0;
        let modelName: string | null = null;

        const recordUsage = async (
          agentId: string,
          operation: string,
          response: Awaited<ReturnType<typeof invokeLLM>>
        ) => {
          const usage = usageFromResponse(response);
          modelName = usage.model || modelName;
          aggregatePromptTokens += usage.promptTokens;
          aggregateCompletionTokens += usage.completionTokens;
          aggregateTotalTokens += usage.totalTokens;
          aggregateCostCents += usage.estimatedCostCents;
          if (usage.totalTokens > 0) {
            await createLlmUsageEvent({
              userId,
              runId: run.id,
              agentId,
              operation,
              model: usage.model,
              promptTokens: usage.promptTokens,
              completionTokens: usage.completionTokens,
              totalTokens: usage.totalTokens,
              estimatedCostCents: usage.estimatedCostCents,
            });
          }
        };

        const processAgent = async (agent: AgentConfig) => {
          const startTime = Date.now();
          try {
            const response = await invokeLLM({
              responseFormat: { type: "json_object" },
              messages: [
                { role: "system", content: agent.systemPrompt },
                {
                  role: "user",
                  content: buildStructuredAgentPrompt(
                    agent,
                    scopeLabel,
                    eraInstruction,
                    caseRecord
                  ),
                },
              ],
            });
            await recordUsage(agent.id, "structured_agent_analysis", response);

            const messageContent = response.choices[0]?.message?.content;
            const output =
              typeof messageContent === "string"
                ? messageContent
                : JSON.stringify(messageContent) || "No response generated";
            const structured = parseStructuredAgentOutput(
              agent,
              output,
              analysisDocuments
            );
            const processingTime = Date.now() - startTime;

            const savedOutput = await createAgentOutput({
              documentId: anchorDocument.id,
              agentId: `${agent.id}_${input.scope}_scope`,
              agentName: `${agent.name} (${scopeLabel})`,
              output:
                structured.findings.length > 0
                  ? `${structured.summary}\n\n${structured.findings.map((finding, index) => `${index + 1}. ${finding.title}\nType: ${finding.findingType}\nConfidence: ${finding.confidence}\nLeverage: ${finding.leverageScore}\nQC: ${finding.qcStatus || "pending"}\n${finding.summary}\nNext: ${finding.nextAction}`).join("\n\n")}`
                  : output,
            });

            const savedFindings = [];
            for (const finding of structured.findings) {
              const gated = applyRiskBasedQcGate(
                verifyFindingQuotes(finding, analysisDocuments)
              );
              let finalFinding = gated;
              const savedFinding = await createAgentFinding({
                runId: run.id,
                outputId: savedOutput.id,
                userId,
                agentId: agent.id,
                agentName: agent.name,
                title: gated.title,
                findingType: gated.findingType,
                liabilityVector: gated.liabilityVector,
                remedyPath: gated.remedyPath,
                severity: gated.severity,
                confidence: gated.confidence,
                leverageScore: gated.leverageScore,
                summary: gated.summary,
                sourceAnchors: JSON.stringify(gated.sourceAnchors),
                missingRecords: JSON.stringify(gated.missingRecords),
                legalAuthorities: JSON.stringify(gated.legalAuthorities),
                nextAction: gated.nextAction,
                qcStatus: gated.qcStatus || "not_required",
                qcReason: gated.qcReason,
                includedInReports: isReportEligible(gated.qcStatus) ? 1 : 0,
              });

              if (gated.qcStatus === "pending") {
                try {
                  const audit = normalizeQcAuditForReportUse(
                    gated,
                    await auditFindingWithLLM(gated, analysisDocuments)
                  );
                  await createAgentFindingAudit({
                    findingId: savedFinding.id,
                    runId: run.id,
                    auditorAgentId: "qc_auditor",
                    status: audit.status,
                    confidence: audit.confidence,
                    issues: JSON.stringify(audit.issues),
                    correctedSummary: audit.correctedSummary,
                  });
                  finalFinding = {
                    ...gated,
                    qcStatus: audit.status,
                    confidence: audit.confidence,
                    summary: audit.correctedSummary || gated.summary,
                    qcReason: audit.issues.join("; ") || gated.qcReason,
                  };
                  await updateAgentFinding(savedFinding.id, {
                    qcStatus: audit.status,
                    confidence: audit.confidence,
                    summary: finalFinding.summary,
                    qcReason: finalFinding.qcReason,
                    includedInReports: isReportEligible(audit.status) ? 1 : 0,
                  });
                } catch (auditError) {
                  const audit = fallbackQcAuditForFinding(gated, auditError);
                  finalFinding = {
                    ...gated,
                    qcStatus: audit.status,
                    confidence: audit.confidence,
                    summary: audit.correctedSummary || gated.summary,
                    qcReason: audit.issues.join("; "),
                  };
                  await createAgentFindingAudit({
                    findingId: savedFinding.id,
                    runId: run.id,
                    auditorAgentId: "qc_auditor_fallback",
                    status: audit.status,
                    confidence: audit.confidence,
                    issues: JSON.stringify(audit.issues),
                    correctedSummary: audit.correctedSummary,
                  });
                  await updateAgentFinding(savedFinding.id, {
                    qcStatus: audit.status,
                    confidence: audit.confidence,
                    summary: finalFinding.summary,
                    qcReason: finalFinding.qcReason,
                    includedInReports: isReportEligible(audit.status) ? 1 : 0,
                  });
                }
              }

              allStructuredFindings.push(finalFinding);
              savedFindings.push({
                id: savedFinding.id,
                ...finalFinding,
              });
            }

            return {
              status: "completed" as const,
              agentId: agent.id,
              agentName: agent.name,
              output,
              summary: structured.summary,
              findings: savedFindings,
              processingTime,
            };
          } catch (error) {
            return {
              status: "failed" as const,
              agentId: agent.id,
              agentName: agent.name,
              error:
                error instanceof Error
                  ? error.message
                  : "Unknown analysis error",
              processingTime: Date.now() - startTime,
            };
          }
        };

        const results = await Promise.all(sectorAgents.map(processAgent));
        const completedCount = results.filter(
          result => result.status === "completed"
        ).length;
        const synthesis = buildWarRoomSynthesis(allStructuredFindings);
        const returnedFindings = results.flatMap(result =>
          "findings" in result ? result.findings : []
        );

        await updateAgentRun(run.id, {
          status:
            completedCount === sectorAgents.length ? "completed" : "failed",
          completedAgents: completedCount,
          completedAt: new Date(),
          model: modelName,
          promptTokens: aggregatePromptTokens,
          completionTokens: aggregateCompletionTokens,
          totalTokens: aggregateTotalTokens,
          estimatedCostCents: aggregateCostCents,
          synthesis,
        });

        return {
          success: completedCount > 0,
          runId: run.id,
          sector: input.sector,
          scope: input.scope,
          documentCount: analysisDocuments.length,
          originalDocumentCount: selectedDocuments.length,
          skippedDuplicateIds: consolidatedSelection.skippedDuplicateIds,
          masterRecordCount: consolidatedSelection.masterRecords.length,
          documents: analysisDocuments.map(document => ({
            id: document.id,
            fileName: document.fileName,
            createdAt: formatDate(document.createdAt),
          })),
          completedAgents: completedCount,
          totalAgents: sectorAgents.length,
          findings: returnedFindings,
          synthesis,
          usage: {
            model: modelName,
            promptTokens: aggregatePromptTokens,
            completionTokens: aggregateCompletionTokens,
            totalTokens: aggregateTotalTokens,
            estimatedCostCents: aggregateCostCents,
          },
          results,
        };
      }),

    /**
     * Get swarm session results
     */
    getSwarmResults: protectedProcedure
      .input(
        z.object({
          swarmSessionId: z.number(),
        })
      )
      .query(async ({ input, ctx }) => {
        const { swarmSessionId } = input;

        // Get swarm session
        const session = await getSwarmSession(swarmSessionId);
        if (!session || session.userId !== ctx.user.id) {
          throw new Error("Swarm session not found or unauthorized");
        }

        // Get all agent results
        const results = await getSwarmAgentResults(swarmSessionId);

        return {
          session,
          results,
        };
      }),
  }),

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),

    // Delete user account and all associated data
    deleteAccount: protectedProcedure.mutation(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const userId = ctx.user.id;

      // Delete all agent outputs for user's documents
      const userDocs = await getUserDocuments(userId);
      for (const doc of userDocs) {
        await db
          .delete(agentOutputs)
          .where(eq(agentOutputs.documentId, doc.id));
      }

      // Delete all documents
      await db.delete(documents).where(eq(documents.userId, userId));

      // Delete payments
      await db.delete(payments).where(eq(payments.userId, userId));

      // Delete subscription
      await db.delete(subscriptions).where(eq(subscriptions.userId, userId));

      // Delete user
      await db.delete(users).where(eq(users.id, userId));

      // Clear session cookie
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });

      return { success: true };
    }),
  }),

  documents: router({
    // Legacy upload endpoint kept only to avoid silent creation of unprocessed evidence.
    upload: protectedProcedure
      .input(
        z.object({
          fileName: z.string(),
          fileContent: z.string(), // base64 encoded
          mimeType: z.string(),
          fileSize: z.number(),
        })
      )
      .mutation(async () => {
        throw new Error(
          "Legacy document upload is disabled. Use upload.uploadFile so extraction, source hashing, duplicate detection, and readiness checks run before evidence reaches analysis."
        );
      }),

    // Get user's documents
    list: protectedProcedure.query(async ({ ctx }) => {
      return getUserDocuments(ctx.user.id);
    }),

    // Build a consolidated master-record map from exact duplicates and review candidates.
    masterRecords: protectedProcedure.query(async ({ ctx }) => {
      const userDocuments = await getUserDocuments(ctx.user.id);
      return buildMasterRecords(userDocuments);
    }),

    // Get document by ID with outputs
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const document = await getDocumentById(input.id);

        if (!document || document.userId !== ctx.user.id) {
          throw new Error("Document not found");
        }

        const outputs = await getAgentOutputByDocumentId(input.id);

        return {
          document,
          outputs,
        };
      }),

    // Process document through AI agents
    process: protectedProcedure
      .input(
        z.object({
          documentId: z.number(),
          documentText: z.string(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await enforceDraftAccess(ctx.user);
        const document = await getDocumentById(input.documentId);

        if (!document || document.userId !== ctx.user.id) {
          throw new Error("Document not found");
        }
        await enforcePageAnalysisLimit(ctx.user, [document], "draft analysis");

        // Update status to processing
        await updateDocumentStatus(input.documentId, "processing");

        try {
          // Call LLM with a forensic legal analysis prompt. This replaces the
          // legacy entertainment/product routing that is inappropriate for
          // court documents.
          const response = await invokeLLM({
            messages: [
              {
                role: "system",
                content: `You are DueProcess AI, a forensic legal document analysis engine.

Analyze the supplied legal document for constitutional, procedural, evidentiary, and civil-rights issues. Ground every finding in the document text. State findings directly, cite relevant legal authority when known, and distinguish strong record-supported findings from weaker issues that need more evidence.

Do not produce satire, marketing ideas, social content, product ideas, or generic educational disclaimers. Produce practical legal-analysis artifacts: findings, authority, reasoning, and a motion scaffold.`,
              },
              {
                role: "user",
                content: `Analyze this legal document and return forensic findings.\n\nFilename: ${document.fileName}\n\nDocument:\n${input.documentText}`,
              },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "forensic_document_analysis",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    summary: {
                      type: "string",
                      description:
                        "Brief factual overview of the document and the most important finding",
                    },
                    findings: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          issue: { type: "string" },
                          severity: {
                            type: "string",
                            enum: ["critical", "high", "medium", "low"],
                          },
                          evidence: { type: "string" },
                          reasoning: { type: "string" },
                          recommendedAction: { type: "string" },
                        },
                        required: [
                          "issue",
                          "severity",
                          "evidence",
                          "reasoning",
                          "recommendedAction",
                        ],
                        additionalProperties: false,
                      },
                    },
                    authorities: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          citation: { type: "string" },
                          relevance: { type: "string" },
                        },
                        required: ["citation", "relevance"],
                        additionalProperties: false,
                      },
                    },
                    motionScaffold: { type: "string" },
                  },
                  required: [
                    "summary",
                    "findings",
                    "authorities",
                    "motionScaffold",
                  ],
                  additionalProperties: false,
                },
              },
            },
          });

          const messageContent = response.choices[0].message.content;
          const contentString =
            typeof messageContent === "string"
              ? messageContent
              : JSON.stringify(messageContent);
          const result = JSON.parse(contentString || "{}");

          const findings = Array.isArray(result.findings)
            ? result.findings
            : [];
          const authorities = Array.isArray(result.authorities)
            ? result.authorities
            : [];

          // Store forensic output in both generic fields and legacy clerk fields
          // so existing report/export code can continue to read it.
          await createAgentOutput({
            documentId: input.documentId,
            agentId: "forensic_document_analysis",
            agentName: "Forensic Document Analysis",
            output: JSON.stringify(result),
            clerkViolations: JSON.stringify(
              findings.map((finding: { issue: string }) => finding.issue)
            ),
            clerkCaseLaw: JSON.stringify(
              authorities.map(
                (authority: { citation: string; relevance: string }) =>
                  `${authority.citation}: ${authority.relevance}`
              )
            ),
            clerkMotionDraft: result.motionScaffold,
          });

          const documentHash =
            document.documentHash ||
            createHash("sha256").update(input.documentText).digest("hex");
          const anchoredText =
            document.extractedText?.trim() ||
            withSourceAnchor(input.documentText, documentHash);
          const diagnostics = analyzeExtractionDiagnostics(
            {
              text: anchoredText,
              method: "manual_text_entry",
              status: "completed",
              note: "Text was manually pasted for this analysis.",
            },
            documentHash
          );

          const db = await getDb();
          if (!db) throw new Error("Database not available");
          await db
            .update(documents)
            .set({
              status: "completed",
              summary: result.summary,
              documentHash: diagnostics.documentHash || documentHash,
              extractionMethod: diagnostics.extractionMethod,
              extractionNote: diagnostics.extractionNote,
              extractionTextLength: diagnostics.textLength,
              extractionQualityScore: diagnostics.qualityScore,
              extractionWarnings: JSON.stringify(diagnostics.warnings),
              extractedText: anchoredText,
            })
            .where(eq(documents.id, input.documentId));

          return {
            success: true,
            summary: result.summary,
          };
        } catch (error) {
          // Update status to failed
          await updateDocumentStatus(input.documentId, "failed");
          throw error;
        }
      }),

    // Delete a document
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const document = await getDocumentById(input.id);

        if (!document || document.userId !== ctx.user.id) {
          throw new Error("Document not found");
        }

        const db = await getDb();
        if (!db) throw new Error("Database not available");

        await deleteAnalysisArtifactsForDocuments(ctx.user.id, [input.id]);

        // Delete document
        await db.delete(documents).where(eq(documents.id, input.id));

        return { success: true };
      }),

    // Delete all user documents
    deleteAll: protectedProcedure.mutation(async ({ ctx }) => {
      const userDocs = await getUserDocuments(ctx.user.id);
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const documentIds = userDocs.map(doc => doc.id);

      await deleteAnalysisArtifactsForDocuments(ctx.user.id, documentIds);

      // Delete all documents
      await db.delete(documents).where(eq(documents.userId, ctx.user.id));

      return { success: true };
    }),
  }),
});

export type AppRouter = typeof appRouter;
