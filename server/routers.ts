import { z } from "zod";
import { createHash } from "node:crypto";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { stripeRouter } from "./stripeRouter";
import { getDb, getUserByOpenId, createDocument, getUserDocuments, getDocumentById, updateDocumentStatus, createAgentOutput, getAgentOutputByDocumentId, getAgentOutputsByDocumentIds, deleteAgentOutputById, deleteAgentOutputsByDocumentIds, createSwarmSession, updateSwarmSession, getSwarmSession, createSwarmAgentResult, updateSwarmAgentResult, getSwarmAgentResults, createAgentRun, updateAgentRun, createAgentFinding, updateAgentFinding, createAgentFindingAudit, createLlmUsageEvent, getAgentFindingsByUserId } from "./db";;
import { documents, agentOutputs, subscriptions, payments, users } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { storagePut } from "./storage";
import { invokeLLM } from "./_core/llm";
import type { AgentConfig } from "./agentConfig";
import { AGENTS, getAgentById, getAgentsBySector } from "./agentConfig";
import { fileProcessingRouter } from "./fileProcessing";
import { reportRouter } from "./reportGenerator";
import { uploadRouter } from "./uploadRouter";
import { integrationsRouter } from "./integrationsRouter";
import { settingsRouter } from "./settingsRouter";
import { enforceAgentRunAccess, enforceDocumentUploadLimit, enforceDraftAccess } from "./accessControl";
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

function assertDocumentReadyForAnalysis(document: Parameters<typeof isDocumentReadyForAnalysis>[0]) {
  if (!isDocumentReadyForAnalysis(document)) {
    throw new Error(documentReadinessReason(document) || `${document.fileName || "Document"} is not ready for agent analysis yet.`);
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

export const appRouter = router({
  system: systemRouter,
  stripe: stripeRouter,
  fileProcessing: fileProcessingRouter,
  reports: reportRouter,
  upload: uploadRouter,
  integrations: integrationsRouter,
  settings: settingsRouter,

  agents: router({
    catalog: adminProcedure.query(() => {
      return {
        agents: AGENTS.map((agent) => ({
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
            description: "Fast first pass for issues, proof gaps, and next actions.",
            agentIds: ["constitutional_analyst", "criminal_law_specialist", "pattern_recognition_engine", "timeline_constructor"],
          },
          {
            id: "constitutional_record",
            name: "Constitutional Record Builder",
            description: "Turns the record into rights violations, authority, and civil-rights framing.",
            agentIds: ["constitutional_analyst", "civil_rights_expert", "precedent_miner", "statute_scanner"],
          },
          {
            id: "brady_misconduct",
            name: "Brady and Misconduct Review",
            description: "Looks for disclosure failures, false testimony, contradictions, and prosecutorial misconduct.",
            agentIds: ["criminal_law_specialist", "contradiction_detector", "timeline_constructor", "canon_hunter"],
          },
          {
            id: "monell_pattern",
            name: "Monell Pattern Map",
            description: "Maps policy/custom, failure to train, ratification, missing pattern proof, and municipal-liability pressure.",
            agentIds: ["monell_pattern_mapper", "liability_remedy_ranker", "civil_rights_expert", "pattern_recognition_engine", "discovery_tactician"],
          },
          {
            id: "liability_war_room",
            name: "Liability War Room",
            description: "Ranks the highest-payoff/highest-win issues, then checks weak claims before synthesis.",
            agentIds: ["liability_remedy_ranker", "immunity_piercer", "monell_pattern_mapper", "criminal_law_specialist", "contradiction_detector", "qc_auditor"],
          },
          {
            id: "leverage_engine_v2",
            name: "Leverage Engine v2 Strike Team",
            description: "Maximum skepticism: gap architect, contradiction/pattern hunter, constitutional/criminal procedure, Monell, evasion, discovery, authority, and ruthless QC.",
            agentIds: [
              "timeline_constructor",
              "contradiction_detector",
              "pattern_recognition_engine",
              "constitutional_analyst",
              "civil_rights_expert",
              "criminal_law_specialist",
              "immunity_piercer",
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
            description: "Pairs legal analysis with strategy and drafting agents for a court-facing scaffold.",
            agentIds: ["motion_drafter", "constitutional_analyst", "precedent_miner", "discovery_tactician"],
          },
          {
            id: "full_admin_panel",
            name: "Full Admin Panel",
            description: "Runs every configured DueProcess agent across the selected scope.",
            agentIds: AGENTS.map((agent) => agent.id),
          },
        ],
      };
    }),

    /**
     * Process a document with a specific agent
     */
    processDocument: protectedProcedure
      .input(z.object({
        documentId: z.number(),
        agentId: z.string(),
      }))
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

        // Update document status to processing
        await updateDocumentStatus(documentId, "processing");

        try {
          // Prepare the input for the agent
          const documentContent = document.extractedText || document.summary || "[No text content available]";
          const userPrompt = `Analyze this document:\n\nFilename: ${document.fileName}\nContent:\n${documentContent}`;

          // Call the LLM with the agent's system prompt
          const response = await invokeLLM({
            messages: [
              { role: "system", content: agent.systemPrompt },
              { role: "user", content: userPrompt },
            ],
          });

          const messageContent = response.choices[0]?.message?.content;
          const output = typeof messageContent === 'string' ? messageContent : JSON.stringify(messageContent) || "No response generated";

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
      .input(z.object({
        documentId: z.number(),
      }))
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
      const documentById = new Map(userDocuments.map((document) => [document.id, document]));
      const outputs = await getAgentOutputsByDocumentIds(userDocuments.map((document) => document.id));

      return outputs.map((output) => {
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

    listFindings: protectedProcedure.query(async ({ ctx }) => {
      const findings = await getAgentFindingsByUserId(ctx.user.id);
      return findings.map((finding) => ({
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
        const outputs = await getAgentOutputsByDocumentIds(userDocuments.map((document) => document.id));
        const target = outputs.find((output) => output.id === input.id);

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
      await deleteAgentOutputsByDocumentIds(userDocuments.map((document) => document.id));
      return { success: true };
    }),

    /**
     * Process document with all agents in a sector (swarm processing)
     */
    processSwarm: protectedProcedure
      .input(z.object({
        documentId: z.number(),
        sector: z.enum(["tactical", "legal", "intel", "evidence", "offensive"]),
      }))
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
        const documentContent = document.extractedText || document.summary || "[No text content available]";
        const userPrompt = `Analyze this document:\n\nFilename: ${document.fileName}\nContent:\n${documentContent}`;

        const processingPromises = sectorAgents.map(async (agent: any, index: number) => {
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
            const output = typeof messageContent === 'string' ? messageContent : JSON.stringify(messageContent) || "No response generated";
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
            const errorMessage = error instanceof Error ? error.message : "Unknown error";

            // Update with error
            await updateSwarmAgentResult(resultId, {
              status: "failed",
              error: errorMessage,
              processingTime,
              completedAt: new Date(),
            });

            return { success: false, agentId: agent.id, error: errorMessage };
          }
        });

        // Wait for all agents to complete
        const results = await Promise.all(processingPromises);
        const completedCount = results.filter((r: any) => r.success).length;

        // Update swarm session
        await updateSwarmSession(swarmSessionId, {
          status: completedCount === sectorAgents.length ? "completed" : "failed",
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
      .input(z.object({
        sector: z.enum(["tactical", "legal", "intel", "evidence", "offensive"]),
        scope: z.enum(["all", "file", "time"]),
        documentId: z.number().optional(),
        documentIds: z.array(z.number()).optional(),
        agentIds: z.array(z.string()).optional(),
        fromDate: z.string().optional(),
        toDate: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const userId = ctx.user.id;
        const allDocuments = await getUserDocuments(userId);
        await enforceAgentRunAccess(ctx.user, input.sector);

        const parseDateBound = (value: string | undefined, endOfDay: boolean): Date | null => {
          if (!value) return null;
          const parsed = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`);
          return Number.isNaN(parsed.getTime()) ? null : parsed;
        };

        const fromDate = parseDateBound(input.fromDate, false);
        const toDate = parseDateBound(input.toDate, true);

        let selectedDocuments = allDocuments;
        const selectedDocumentIds = input.documentIds && input.documentIds.length > 0
          ? Array.from(new Set(input.documentIds))
          : input.documentId
            ? [input.documentId]
            : [];

        if (input.scope === "file") {
          if (selectedDocumentIds.length === 0) {
            throw new Error("Choose one or more documents before running file analysis.");
          }
          selectedDocuments = allDocuments.filter((document) => selectedDocumentIds.includes(document.id));
        }

        if (input.scope === "time") {
          if (!fromDate && !toDate) {
            throw new Error("Choose a start date, end date, or both before running time-period analysis.");
          }
          selectedDocuments = allDocuments.filter((document) => {
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
        selectedDocuments.forEach(assertDocumentReadyForAnalysis);

        const hasCustomAgentSelection = Boolean(input.agentIds && input.agentIds.length > 0);
        const isConfiguredOwner =
          Boolean(process.env.OWNER_OPEN_ID) && ctx.user.openId === process.env.OWNER_OPEN_ID;
        if (hasCustomAgentSelection && (ctx.user.role !== "admin" || !isConfiguredOwner)) {
          throw new Error("Custom agent selection is only available to the configured owner/admin account.");
        }

        const customAgentIds = input.agentIds ? Array.from(new Set(input.agentIds)) : [];
        const sectorAgents = hasCustomAgentSelection
          ? customAgentIds.map((agentId) => getAgentById(agentId)).filter((agent): agent is AgentConfig => Boolean(agent))
          : getAgentsBySector(input.sector);
        if (sectorAgents.length === 0) {
          throw new Error("No agents found for this analysis area.");
        }

        const contextLimit = 60000;
        const perDocumentLimit = Math.max(2500, Math.floor(contextLimit / selectedDocuments.length));
        const formatDate = (value: Date | string): string => {
          const date = value instanceof Date ? value : new Date(value);
          return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
        };

        const caseRecord = selectedDocuments
          .map((document, index) => {
            const text = document.extractedText || document.summary || "[No extracted text available]";
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

        const anchorDocument = selectedDocuments[0];
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

        await updateDocumentStatus(anchorDocument.id, "processing");
        const run = await createAgentRun({
          userId,
          anchorDocumentId: anchorDocument.id,
          sector: input.sector,
          scope: input.scope,
          documentIds: JSON.stringify(selectedDocuments.map((document) => document.id)),
          agentIds: JSON.stringify(sectorAgents.map((agent) => agent.id)),
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

        const recordUsage = async (agentId: string, operation: string, response: Awaited<ReturnType<typeof invokeLLM>>) => {
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
                  content: buildStructuredAgentPrompt(agent, scopeLabel, eraInstruction, caseRecord),
                },
              ],
            });
            await recordUsage(agent.id, "structured_agent_analysis", response);

            const messageContent = response.choices[0]?.message?.content;
            const output = typeof messageContent === "string" ? messageContent : JSON.stringify(messageContent) || "No response generated";
            const structured = parseStructuredAgentOutput(agent, output, selectedDocuments);
            const processingTime = Date.now() - startTime;

            const savedOutput = await createAgentOutput({
              documentId: anchorDocument.id,
              agentId: `${agent.id}_${input.scope}_scope`,
              agentName: `${agent.name} (${scopeLabel})`,
              output: structured.findings.length > 0
                ? `${structured.summary}\n\n${structured.findings.map((finding, index) => `${index + 1}. ${finding.title}\nType: ${finding.findingType}\nConfidence: ${finding.confidence}\nLeverage: ${finding.leverageScore}\nQC: ${finding.qcStatus || "pending"}\n${finding.summary}\nNext: ${finding.nextAction}`).join("\n\n")}`
                : output,
            });

            const savedFindings = [];
            for (const finding of structured.findings) {
              const gated = applyRiskBasedQcGate(verifyFindingQuotes(finding, selectedDocuments));
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
                  const audit = normalizeQcAuditForReportUse(gated, await auditFindingWithLLM(gated, selectedDocuments));
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
              error: error instanceof Error ? error.message : "Unknown analysis error",
              processingTime: Date.now() - startTime,
            };
          }
        };

        const results = await Promise.all(sectorAgents.map(processAgent));
        const completedCount = results.filter((result) => result.status === "completed").length;
        const synthesis = buildWarRoomSynthesis(allStructuredFindings);
        const returnedFindings = results.flatMap((result) => "findings" in result ? result.findings : []);

        await updateDocumentStatus(
          anchorDocument.id,
          completedCount === sectorAgents.length ? "completed" : "failed",
          `${completedCount}/${sectorAgents.length} ${input.sector} agents completed across ${selectedDocuments.length} document(s).`
        );
        await updateAgentRun(run.id, {
          status: completedCount === sectorAgents.length ? "completed" : "failed",
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
          documentCount: selectedDocuments.length,
          documents: selectedDocuments.map((document) => ({
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
      .input(z.object({
        swarmSessionId: z.number(),
      }))
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
        await db.delete(agentOutputs).where(eq(agentOutputs.documentId, doc.id));
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
    // Upload a document
    upload: protectedProcedure
      .input(z.object({
        fileName: z.string(),
        fileContent: z.string(), // base64 encoded
        mimeType: z.string(),
        fileSize: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        await enforceDocumentUploadLimit(ctx.user);
        // Upload to S3
        const buffer = Buffer.from(input.fileContent, 'base64');
        const randomSuffix = Math.random().toString(36).substring(7);
        const fileKey = `${ctx.user.id}-documents/${input.fileName}-${randomSuffix}`;
        
        const { url } = await storagePut(fileKey, buffer, input.mimeType);

        // Create document record
        const document = await createDocument({
          userId: ctx.user.id,
          fileName: input.fileName,
          fileUrl: url,
          fileKey,
          mimeType: input.mimeType,
          fileSize: input.fileSize,
          status: "pending",
        });

        return document;
      }),

    // Get user's documents
    list: protectedProcedure.query(async ({ ctx }) => {
      return getUserDocuments(ctx.user.id);
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
      .input(z.object({ 
        documentId: z.number(),
        documentText: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        await enforceDraftAccess(ctx.user);
        const document = await getDocumentById(input.documentId);
        
        if (!document || document.userId !== ctx.user.id) {
          throw new Error("Document not found");
        }

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

Do not produce satire, marketing ideas, social content, product ideas, or generic educational disclaimers. Produce practical legal-analysis artifacts: findings, authority, reasoning, and a motion scaffold.`
              },
              {
                role: "user",
                content: `Analyze this legal document and return forensic findings.\n\nFilename: ${document.fileName}\n\nDocument:\n${input.documentText}`
              }
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
                      description: "Brief factual overview of the document and the most important finding"
                    },
                    findings: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          issue: { type: "string" },
                          severity: { type: "string", enum: ["critical", "high", "medium", "low"] },
                          evidence: { type: "string" },
                          reasoning: { type: "string" },
                          recommendedAction: { type: "string" }
                        },
                        required: ["issue", "severity", "evidence", "reasoning", "recommendedAction"],
                        additionalProperties: false
                      }
                    },
                    authorities: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          citation: { type: "string" },
                          relevance: { type: "string" }
                        },
                        required: ["citation", "relevance"],
                        additionalProperties: false
                      }
                    },
                    motionScaffold: { type: "string" }
                  },
                  required: ["summary", "findings", "authorities", "motionScaffold"],
                  additionalProperties: false
                }
              }
            }
          });

          const messageContent = response.choices[0].message.content;
          const contentString = typeof messageContent === 'string' ? messageContent : JSON.stringify(messageContent);
          const result = JSON.parse(contentString || "{}");

          const findings = Array.isArray(result.findings) ? result.findings : [];
          const authorities = Array.isArray(result.authorities) ? result.authorities : [];

          // Store forensic output in both generic fields and legacy clerk fields
          // so existing report/export code can continue to read it.
          await createAgentOutput({
            documentId: input.documentId,
            agentId: "forensic_document_analysis",
            agentName: "Forensic Document Analysis",
            output: JSON.stringify(result),
            clerkViolations: JSON.stringify(findings.map((finding: { issue: string }) => finding.issue)),
            clerkCaseLaw: JSON.stringify(authorities.map((authority: { citation: string; relevance: string }) => `${authority.citation}: ${authority.relevance}`)),
            clerkMotionDraft: result.motionScaffold,
          });

          const documentHash = document.documentHash || createHash("sha256").update(input.documentText).digest("hex");
          const anchoredText = document.extractedText?.trim() || withSourceAnchor(input.documentText, documentHash);
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

        // Delete agent outputs first
        await db.delete(agentOutputs).where(eq(agentOutputs.documentId, input.id));
        
        // Delete document
        await db.delete(documents).where(eq(documents.id, input.id));

        return { success: true };
      }),

    // Delete all user documents
    deleteAll: protectedProcedure.mutation(async ({ ctx }) => {
      const userDocs = await getUserDocuments(ctx.user.id);
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Delete all agent outputs for user's documents
      for (const doc of userDocs) {
        await db.delete(agentOutputs).where(eq(agentOutputs.documentId, doc.id));
      }

      // Delete all documents
      await db.delete(documents).where(eq(documents.userId, ctx.user.id));

      return { success: true };
    }),
  }),
});

export type AppRouter = typeof appRouter;
