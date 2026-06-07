import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { agentFindings, agentOutputs, documents } from "../drizzle/schema";
import { desc, eq, inArray } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";
import { isReportEligible, usageFromResponse } from "./leverageEngine";
import { createLlmUsageEvent } from "./db";
import { enforceReportGenerationAccess } from "./accessControl";

const reportScopeSchema = z.enum(["case", "files", "time"]);
const reportTemplateSchema = z.enum([
  "court_packet",
  "case_strategy",
  "evidence_chronology",
  "immunity_relief",
  "discovery_demands",
  "executive_summary",
]);
const reportFormatSchema = z.enum(["markdown", "html", "json"]);

type ReportScope = z.infer<typeof reportScopeSchema>;
type ReportTemplate = z.infer<typeof reportTemplateSchema>;
type ReportFormat = z.infer<typeof reportFormatSchema>;

type DocumentRecord = typeof documents.$inferSelect;
type AgentOutputRecord = typeof agentOutputs.$inferSelect;
type AgentFindingRecord = typeof agentFindings.$inferSelect;

function formatDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function parseDateBound(value: string | undefined, endOfDay: boolean): Date | null {
  if (!value) return null;
  const parsed = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function templateInstruction(template: ReportTemplate): string {
  switch (template) {
    case "court_packet":
      return "Build a court-ready packet with issue summary, record facts, legal theories, relief requested, source table, and motion-ready next steps.";
    case "case_strategy":
      return "Build a strategic case memo with strongest claims, weak points, actor-specific risks, immunity/abstention issues, and next actions.";
    case "evidence_chronology":
      return "Build an evidence chronology with dated events, source documents, contradictions, gaps, and records to request.";
    case "immunity_relief":
      return "Build an immunity exposure and relief pathway report. Separate damages immunity from mandamus, habeas, recusal, supervisory review, declaratory, prospective, Monell, and nonimmune-actor routes.";
    case "discovery_demands":
      return "Build a discovery and records-demand packet with exact records to request, why each matters, and what each record would prove or disprove.";
    case "executive_summary":
      return "Build a concise executive summary for a pro se litigant or attorney reviewing the case quickly.";
  }
}

function outputText(output: AgentOutputRecord): string {
  const parts = [
    output.output,
    output.clerkViolations,
    output.clerkCaseLaw,
    output.clerkMotionDraft,
    output.jesterMemeCaption,
    output.jesterTiktokScript,
    output.jesterQuote,
    output.hobotProductName,
    output.hobotDescription,
    output.hobotLink,
  ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);

  return parts.join("\n\n");
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

function findingMatchesDocuments(finding: AgentFindingRecord, documentIds: Set<number>) {
  const anchors = safeJsonArray(finding.sourceAnchors);
  if (anchors.length === 0) return true;
  return anchors.some((anchor) => {
    if (!anchor || typeof anchor !== "object") return false;
    return documentIds.has(Number((anchor as Record<string, unknown>).documentId));
  });
}

function findingText(finding: AgentFindingRecord): string {
  const missingRecords = safeJsonArray(finding.missingRecords).map(String);
  const authorities = safeJsonArray(finding.legalAuthorities).map(String);
  const anchors = safeJsonArray(finding.sourceAnchors)
    .map((anchor) => {
      if (!anchor || typeof anchor !== "object") return "";
      const record = anchor as Record<string, unknown>;
      return `${record.fileName || "Source"}${record.quote ? `: "${String(record.quote).slice(0, 260)}"` : ""}`;
    })
    .filter(Boolean);

  return [
    `### ${finding.title}`,
    `Agent: ${finding.agentName}`,
    `Type: ${finding.findingType}`,
    `Liability: ${finding.liabilityVector || "Unclassified"}`,
    `Remedy: ${finding.remedyPath || "Needs review"}`,
    `Severity: ${finding.severity}`,
    `Confidence: ${finding.confidence}`,
    `Leverage: ${finding.leverageScore}`,
    `QC: ${finding.qcStatus}${finding.qcReason ? ` - ${finding.qcReason}` : ""}`,
    "",
    finding.summary,
    anchors.length > 0 ? `Sources: ${anchors.join("; ")}` : "Sources: no source anchors saved",
    missingRecords.length > 0 ? `Missing records: ${missingRecords.join("; ")}` : "",
    authorities.length > 0 ? `Authorities: ${authorities.join("; ")}` : "",
    finding.nextAction ? `Next action: ${finding.nextAction}` : "",
  ].filter(Boolean).join("\n");
}

function buildPlainReport(data: {
  title: string;
  generatedAt: string;
  generatedBy: string;
  scope: ReportScope;
  template: ReportTemplate;
  documents: DocumentRecord[];
  outputs: AgentOutputRecord[];
  findings: AgentFindingRecord[];
  executiveSummary: string;
}): string {
  const sourceList = data.documents
    .map((document, index) => `${index + 1}. ${document.fileName} (${document.status}, uploaded ${formatDate(document.createdAt)})`)
    .join("\n");

  const outputList = data.outputs
    .map((output, index) => {
      const body = outputText(output);
      return `### ${index + 1}. ${output.agentName || output.agentId || "Agent Output"}\nDocument ID: ${output.documentId}\nSaved: ${formatDate(output.createdAt)}\n\n${body || "No saved output text."}`;
    })
    .join("\n\n");

  return [
    `# ${data.title}`,
    `Generated: ${data.generatedAt}`,
    `Generated by: ${data.generatedBy}`,
    `Scope: ${data.scope}`,
    `Template: ${data.template}`,
    "",
    "## Executive Summary",
    data.executiveSummary,
    "",
    "## Source Documents",
    sourceList || "No source documents selected.",
    "",
    "## Saved Agent Analysis",
    outputList || "No saved agent outputs were available for the selected scope.",
    "",
    "## QC-Cleared Structured Findings",
    data.findings.map(findingText).join("\n\n") || "No QC-cleared structured findings were available for the selected scope.",
  ].join("\n");
}

function markdownToHtml(markdown: string, title: string): string {
  const escape = (value: string) =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const body = escape(markdown)
    .replace(/^# (.*)$/gm, "<h1>$1</h1>")
    .replace(/^## (.*)$/gm, "<h2>$1</h2>")
    .replace(/^### (.*)$/gm, "<h3>$1</h3>")
    .replace(/\n/g, "<br />");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escape(title)}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 920px; margin: 40px auto; line-height: 1.55; color: #111827; }
    h1, h2, h3 { color: #0f172a; }
    h1 { border-bottom: 2px solid #2563eb; padding-bottom: 12px; }
  </style>
</head>
<body>${body}</body>
</html>`;
}

async function getScopedDocuments(input: {
  userId: number;
  scope: ReportScope;
  documentIds?: number[];
  fromDate?: string;
  toDate?: string;
}): Promise<DocumentRecord[]> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

  const allDocuments = await db
    .select()
    .from(documents)
    .where(eq(documents.userId, input.userId))
    .orderBy(desc(documents.createdAt));

  if (input.scope === "files") {
    const selectedIds = Array.from(new Set(input.documentIds ?? []));
    if (selectedIds.length === 0) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Choose one or more files for this report." });
    }
    return allDocuments.filter((document) => selectedIds.includes(document.id));
  }

  if (input.scope === "time") {
    const fromDate = parseDateBound(input.fromDate, false);
    const toDate = parseDateBound(input.toDate, true);
    if (!fromDate && !toDate) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a start date, end date, or both." });
    }
    return allDocuments;
  }

  return allDocuments;
}

async function getOutputsForDocuments(documentIds: number[]): Promise<AgentOutputRecord[]> {
  const db = await getDb();
  if (!db || documentIds.length === 0) return [];

  return db
    .select()
    .from(agentOutputs)
    .where(inArray(agentOutputs.documentId, documentIds))
    .orderBy(desc(agentOutputs.createdAt));
}

async function getFindingsForScope(input: {
  userId: number;
  documentIds: number[];
  selectedFindingIds?: number[];
  minConfidence?: number;
  includeBlockedFindings?: boolean;
}): Promise<AgentFindingRecord[]> {
  const db = await getDb();
  if (!db || input.documentIds.length === 0) return [];

  const documentIdSet = new Set(input.documentIds);
  const selectedFindingIdSet = new Set(input.selectedFindingIds ?? []);
  const allFindings = await db
    .select()
    .from(agentFindings)
    .where(eq(agentFindings.userId, input.userId))
    .orderBy(desc(agentFindings.leverageScore));

  return allFindings.filter((finding) => {
    if (selectedFindingIdSet.size > 0 && !selectedFindingIdSet.has(finding.id)) return false;
    if (!findingMatchesDocuments(finding, documentIdSet)) return false;
    if (!input.includeBlockedFindings && !isReportEligible(finding.qcStatus)) return false;
    if (finding.confidence < (input.minConfidence ?? 0)) return false;
    return true;
  });
}

export const reportRouter = router({
  generate: protectedProcedure
    .input(
      z.object({
        scope: reportScopeSchema.default("case"),
        documentId: z.number().optional(),
        documentIds: z.array(z.number()).optional(),
        fromDate: z.string().optional(),
        toDate: z.string().optional(),
        template: reportTemplateSchema,
        format: reportFormatSchema,
        includeSources: z.boolean().default(true),
        selectedFindingIds: z.array(z.number()).optional(),
        minConfidence: z.number().min(0).max(100).default(0),
        includeBlockedFindings: z.boolean().default(false),
        branding: z
          .object({
            logo: z.string().optional(),
            color: z.string().optional(),
            title: z.string().optional(),
          })
          .optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await enforceReportGenerationAccess(ctx.user);
      const scopedDocumentIds = input.documentIds ?? (input.documentId ? [input.documentId] : undefined);
      const selectedDocuments = await getScopedDocuments({
        userId: ctx.user.id,
        scope: input.scope,
        documentIds: scopedDocumentIds,
        fromDate: input.fromDate,
        toDate: input.toDate,
      });

      if (selectedDocuments.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No documents match this report scope." });
      }

      const outputs = await getOutputsForDocuments(selectedDocuments.map((document) => document.id));
      const findings = await getFindingsForScope({
        userId: ctx.user.id,
        documentIds: selectedDocuments.map((document) => document.id),
        selectedFindingIds: input.selectedFindingIds,
        minConfidence: input.minConfidence,
        includeBlockedFindings: ctx.user.role === "admin" && input.includeBlockedFindings,
      });
      const evidenceDigest = selectedDocuments
        .map((document, index) => {
          const text = document.extractedText || document.summary || "[No extracted text saved]";
          return `DOCUMENT ${index + 1}: ${document.fileName}\nStatus: ${document.status}\nUploaded: ${formatDate(document.createdAt)}\n${text.slice(0, 4000)}`;
        })
        .join("\n\n---\n\n")
        .slice(0, 30000);
      const agentDigest = outputs
        .map((output, index) => `${index + 1}. ${output.agentName || output.agentId || "Agent"}\n${outputText(output).slice(0, 3000)}`)
        .join("\n\n")
        .slice(0, 30000);
      const findingDigest = findings
        .map((finding, index) => `${index + 1}. ${findingText(finding)}`)
        .join("\n\n")
        .slice(0, 30000);

      const title = input.branding?.title || `${templateInstruction(input.template).split(".")[0]}: ${selectedDocuments.length} Source${selectedDocuments.length === 1 ? "" : "s"}`;
      const generatedAt = new Date().toISOString();

      const summaryResponse = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are DueProcess AI's report editor. Produce practical, court-safe reports. Use restrained legal language, cite source document names, avoid overclaiming, and separate strong findings from issues needing more proof. Use QC-cleared structured findings as the primary source of claims. ${templateInstruction(input.template)}`,
          },
          {
            role: "user",
            content: `Create the report.\n\nScope: ${input.scope}\nDate focus: ${input.fromDate || "case start"} to ${input.toDate || "case end"}\nMinimum confidence: ${input.minConfidence}\nBlocked findings included: ${ctx.user.role === "admin" && input.includeBlockedFindings ? "yes" : "no"}\n\nSOURCE DOCUMENTS:\n${evidenceDigest}\n\nQC-CLEARED STRUCTURED FINDINGS:\n${findingDigest || "No QC-cleared structured findings available."}\n\nSAVED AGENT OUTPUTS:\n${agentDigest || "No saved agent outputs available."}`,
          },
        ],
      });
      const reportUsage = usageFromResponse(summaryResponse);
      if (reportUsage.totalTokens > 0) {
        await createLlmUsageEvent({
          userId: ctx.user.id,
          operation: "report_generation",
          model: reportUsage.model,
          promptTokens: reportUsage.promptTokens,
          completionTokens: reportUsage.completionTokens,
          totalTokens: reportUsage.totalTokens,
          estimatedCostCents: reportUsage.estimatedCostCents,
        });
      }

      const executiveSummary =
        summaryResponse.choices[0]?.message?.content ||
        "No report summary was generated. Review the selected source documents and saved agent outputs.";

      const markdown = buildPlainReport({
        title,
        generatedAt,
        generatedBy: ctx.user.name || ctx.user.email || "DueProcess AI User",
        scope: input.scope,
        template: input.template,
        documents: selectedDocuments,
        outputs,
        findings,
        executiveSummary,
      });

      const reportData = {
        metadata: {
          title,
          generatedAt,
          generatedBy: ctx.user.name || ctx.user.email || "DueProcess AI User",
          scope: input.scope,
          template: input.template,
          format: input.format,
          dateFocus: {
            fromDate: input.fromDate || null,
            toDate: input.toDate || null,
          },
        },
        documents: selectedDocuments.map((document) => ({
          id: document.id,
          fileName: document.fileName,
          mimeType: document.mimeType,
          fileSize: document.fileSize,
          status: document.status,
          uploadedAt: formatDate(document.createdAt),
          fileUrl: input.includeSources ? document.fileUrl : undefined,
        })),
        statistics: {
          documents: selectedDocuments.length,
          savedAgentOutputs: outputs.length,
          readyDocuments: selectedDocuments.filter((document) => document.status === "completed").length,
          structuredFindings: findings.length,
          blockedFindingsIncluded: ctx.user.role === "admin" && input.includeBlockedFindings,
        },
        findings: findings.map((finding) => ({
          id: finding.id,
          title: finding.title,
          agentName: finding.agentName,
          findingType: finding.findingType,
          confidence: finding.confidence,
          leverageScore: finding.leverageScore,
          qcStatus: finding.qcStatus,
          includedInReports: Boolean(finding.includedInReports),
        })),
        executiveSummary,
        markdown,
      };

      return {
        format: input.format,
        data: reportData,
        content: input.format === "html" ? markdownToHtml(markdown, title) : input.format === "json" ? JSON.stringify(reportData, null, 2) : markdown,
        fileName: `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "dueprocess-report"}.${input.format === "json" ? "json" : input.format === "html" ? "html" : "md"}`,
      };
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    const userDocuments = await db
      .select()
      .from(documents)
      .where(eq(documents.userId, ctx.user.id))
      .orderBy(desc(documents.createdAt));

    const outputs = await getOutputsForDocuments(userDocuments.map((document) => document.id));
    const findings = await getFindingsForScope({
      userId: ctx.user.id,
      documentIds: userDocuments.map((document) => document.id),
    });
    const outputCounts = outputs.reduce<Record<number, number>>((counts, output) => {
      counts[output.documentId] = (counts[output.documentId] ?? 0) + 1;
      return counts;
    }, {});
    const findingCounts = findings.reduce<Record<number, number>>((counts, finding) => {
      safeJsonArray(finding.sourceAnchors).forEach((anchor) => {
        if (!anchor || typeof anchor !== "object") return;
        const documentId = Number((anchor as Record<string, unknown>).documentId);
        if (documentId > 0) counts[documentId] = (counts[documentId] ?? 0) + 1;
      });
      return counts;
    }, {});

    return userDocuments.map((doc) => ({
      id: doc.id,
      name: doc.fileName,
      status: doc.status,
      mimeType: doc.mimeType,
      fileSize: doc.fileSize,
      createdAt: doc.createdAt,
      hasText: Boolean(doc.extractedText && doc.extractedText.trim().length > 0),
      savedAgentOutputs: outputCounts[doc.id] ?? 0,
      structuredFindings: findingCounts[doc.id] ?? 0,
      availableFormats: ["markdown", "html", "json"],
    }));
  }),

  preview: protectedProcedure
    .input(
      z.object({
        scope: reportScopeSchema.default("case"),
        documentId: z.number().optional(),
        documentIds: z.array(z.number()).optional(),
        fromDate: z.string().optional(),
        toDate: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const scopedDocumentIds = input.documentIds ?? (input.documentId ? [input.documentId] : undefined);
      const selectedDocuments = await getScopedDocuments({
        userId: ctx.user.id,
        scope: input.scope,
        documentIds: scopedDocumentIds,
        fromDate: input.fromDate,
        toDate: input.toDate,
      });
      const outputs = await getOutputsForDocuments(selectedDocuments.map((document) => document.id));
      const findings = await getFindingsForScope({
        userId: ctx.user.id,
        documentIds: selectedDocuments.map((document) => document.id),
      });

      return {
        documents: selectedDocuments.map((document) => ({
          id: document.id,
          fileName: document.fileName,
          mimeType: document.mimeType,
          status: document.status,
          createdAt: document.createdAt,
          hasText: Boolean(document.extractedText && document.extractedText.trim().length > 0),
        })),
        outputs: outputs.map((output) => ({
          id: output.id,
          documentId: output.documentId,
          agent: output.agentName || output.agentId || "Agent Output",
          excerpt: outputText(output).slice(0, 600),
          createdAt: output.createdAt,
        })),
        findings: findings.map((finding) => ({
          id: finding.id,
          title: finding.title,
          agentName: finding.agentName,
          findingType: finding.findingType,
          confidence: finding.confidence,
          leverageScore: finding.leverageScore,
          qcStatus: finding.qcStatus,
          createdAt: finding.createdAt,
        })),
        statistics: {
          documents: selectedDocuments.length,
          readyDocuments: selectedDocuments.filter((document) => document.status === "completed").length,
          savedAgentOutputs: outputs.length,
          structuredFindings: findings.length,
        },
      };
    }),
});
