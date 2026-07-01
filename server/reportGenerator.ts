import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import {
  agentFindings,
  agentOutputs,
  caseDocuments,
  documents,
  integrationConnections,
  workspaceCases,
} from "../drizzle/schema";
import { and, desc, eq, inArray } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";
import { isReportEligible, usageFromResponse } from "./leverageEngine";
import { isDocumentReadyForAnalysis } from "./extractionReadiness";
import {
  buildReportExportArtifact,
  markdownFromStoredReport,
  markdownToReportHtml,
  reportExportFormatSchema,
} from "./reportExport";
import {
  assessMandamusFinding,
  classifyMandamusRoute,
  isMandamusRelevantFinding,
  mandamusRouteAction,
  mandamusRouteCode,
  mandamusRouteIntro,
  mandamusRouteLabel,
  type MandamusRoute,
} from "./mandamusSkill";
import {
  courtListener,
  type CourtListenerCitationLookup,
} from "./integrations/courtlistener";
import {
  createGeneratedReport,
  createLlmUsageEvent,
  createReportRevision,
  deleteGeneratedReportById,
  getGeneratedReportById,
  getGeneratedReportsByUserId,
  getLatestReportRevision,
  getReportRevisionById,
  getReportRevisionsByReportId,
} from "./db";
import {
  enforcePageAnalysisLimit,
  enforceDraftAccess,
  enforceReportExportAccess,
  enforceReportGenerationAccess,
} from "./accessControl";

const reportScopeSchema = z.enum(["case", "files", "time"]);
const reportTemplateSchema = z.enum([
  "court_packet",
  "case_strategy",
  "written_opinion",
  "evidence_chronology",
  "immunity_relief",
  "mandamus_writ",
  "discovery_demands",
  "source_appendix",
  "executive_summary",
]);
const reportFormatSchema = z.enum(["markdown", "html", "json"]);
const MAX_REPORT_SECTION_CHARS = 5_000_000;
const reportSectionSchema = z.object({
  sectionId: z.string().min(1).max(120),
  title: z.string().min(1).max(240),
  kind: z.string().min(1).max(80),
  level: z.number().int().min(1).max(3).default(2),
  markdown: z.string().max(MAX_REPORT_SECTION_CHARS),
  includedInExport: z.boolean().default(true),
  sourceFindingIds: z.array(z.number().int().positive()).default([]),
  sourceDocumentIds: z.array(z.number().int().positive()).default([]),
  edited: z.boolean().default(false),
  generatedVersion: z.string().max(MAX_REPORT_SECTION_CHARS).optional(),
});
const reportSectionsSchema = z.array(reportSectionSchema).max(80);
const draftCommandFieldsSchema = z.object({
  filingType: z.string().max(160).optional(),
  respondingTo: z.string().max(800).optional(),
  courtLevel: z.string().max(120).optional(),
  proceduralPosture: z.string().max(800).optional(),
  requestedRelief: z.string().max(800).optional(),
  keyIssues: z.array(z.string().max(240)).max(12).optional(),
  oppositionPosition: z.string().max(1000).optional(),
  draftingStyle: z.string().max(120).optional(),
  additionalInstructions: z.string().max(2500).optional(),
});
const draftCommandSchema = z.object(draftCommandFieldsSchema.shape).optional();
const filingMetadataFieldsSchema = z.object({
  courtName: z.string().max(240).optional(),
  jurisdiction: z.string().max(160).optional(),
  caseNumber: z.string().max(120).optional(),
  petitioner: z.string().max(240).optional(),
  respondent: z.string().max(240).optional(),
  plaintiff: z.string().max(240).optional(),
  defendant: z.string().max(240).optional(),
  filingTitle: z.string().max(240).optional(),
  filingSubtitle: z.string().max(240).optional(),
  preparedFor: z.string().max(240).optional(),
});
const filingMetadataSchema = z
  .object(filingMetadataFieldsSchema.shape)
  .optional();
const filingPlanItemSchema = z.object({
  label: z.string().max(180),
  status: z.string().max(80),
  detail: z.string().max(600),
});
const filingPlanSchema = z.object({
  routeLabel: z.string().max(180),
  readiness: z.enum([
    "draft_ready",
    "human_review_required",
    "records_first",
    "do_not_file_yet",
  ]),
  theoryOfFiling: z.string().max(900),
  issueArchitecture: z.array(filingPlanItemSchema).max(8).default([]),
  proofRequirements: z.array(z.string().max(260)).max(12).default([]),
  missingCommandFields: z.array(z.string().max(80)).max(12).default([]),
  warnings: z.array(z.string().max(300)).max(8).default([]),
  nextQuestions: z.array(z.string().max(260)).max(8).default([]),
  exportChecklist: z.array(z.string().max(260)).max(10).default([]),
});
const draftAssistantResponseSchema = z.object({
  assistantReply: z.string().max(1800),
  template: reportTemplateSchema,
  reportTitle: z.string().max(180).optional(),
  draftCommand: draftCommandFieldsSchema,
  filingMetadata: filingMetadataFieldsSchema.optional(),
  filingPlan: filingPlanSchema.optional(),
  warnings: z.array(z.string().max(260)).max(6).default([]),
});
const draftChatMessageSchema = z.object({
  role: z.enum(["assistant", "user"]),
  content: z.string().max(1800),
});

type ReportScope = z.infer<typeof reportScopeSchema>;
type ReportTemplate = z.infer<typeof reportTemplateSchema>;
type ReportFormat = z.infer<typeof reportFormatSchema>;
type EditableReportSection = z.infer<typeof reportSectionSchema>;
type DraftCommand = z.infer<typeof draftCommandSchema>;
type FilingMetadata = z.infer<typeof filingMetadataSchema>;
type FilingPlan = z.infer<typeof filingPlanSchema>;

type DocumentRecord = typeof documents.$inferSelect;
type AgentOutputRecord = typeof agentOutputs.$inferSelect;
type AgentFindingRecord = typeof agentFindings.$inferSelect;
type GeneratedReportRecord = Awaited<ReturnType<typeof getGeneratedReportById>>;

type MarketProofPack = {
  buyerLane: string;
  useCase: string;
  sellableArtifact: string;
  firstCloseMotion: string;
  deliveryReadiness: "pilot_ready" | "human_review_required" | "blocked";
  proofIncluded: string[];
  blockers: string[];
};

type CitationVerificationEntry = {
  authority: string;
  kind: string;
  status:
    | "verified"
    | "ambiguous"
    | "not_found"
    | "invalid"
    | "throttled"
    | "manual_required"
    | "not_checked";
  citation: string;
  normalizedCitations: string[];
  matches: string[];
  detail: string;
};

type CitationVerificationReport = {
  provider: "CourtListener";
  status:
    | "checked"
    | "not_connected"
    | "no_case_citations"
    | "manual_only"
    | "error";
  checkedAt: string | null;
  entries: CitationVerificationEntry[];
  notes: string[];
};

type ParsedReportSection = {
  title: string;
  level: number;
  content: string;
};

type FilingDraftIssue = {
  title: string;
  proofPosture: string;
  confidence: number | null;
  legalHook: string;
  reliefPath: string;
  courtSafeFrame: string;
  summary: string;
  recordSupport: string[];
  missingRecords: string[];
  authorities: string[];
  nextAction: string;
  reliability: string;
};

type ReportPreflightInput = {
  findings: AgentFindingRecord[];
  legacyAgentOutputsIncluded: boolean;
  selectedFindingIds?: number[];
  minConfidence?: number;
};

function truncateForColumn(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}

function reportFileExtension(format: ReportFormat): string {
  if (format === "json") return "json";
  if (format === "html") return "html";
  return "md";
}

function reportContent(input: {
  format: ReportFormat;
  markdown: string;
  title: string;
  reportData: unknown;
}): string {
  if (input.format === "html")
    return markdownToReportHtml(input.markdown, input.title);
  if (input.format === "json") return JSON.stringify(input.reportData, null, 2);
  return input.markdown;
}

function buildReportFileName(title: string, format: ReportFormat): string {
  const safeBase =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "dueprocess-report";
  return truncateForColumn(`${safeBase}.${reportFileExtension(format)}`, 255);
}

function parseMarkdownSections(markdown: string): ParsedReportSection[] {
  const normalized = markdown.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const sections: ParsedReportSection[] = [];
  let currentTitle = "Report Overview";
  let currentLevel = 1;
  let currentLines: string[] = [];

  const flush = () => {
    const content = currentLines.join("\n").trim();
    if (content) {
      sections.push({
        title: currentTitle,
        level: currentLevel,
        content,
      });
    }
  };

  normalized.split("\n").forEach(line => {
    const heading = /^(#{1,3})\s+(.+)$/.exec(line.trim());
    if (heading && heading[1].length <= 2) {
      flush();
      currentTitle = heading[2].replace(/\*\*/g, "").trim();
      currentLevel = heading[1].length;
      currentLines = [line];
      return;
    }
    currentLines.push(line);
  });

  flush();
  return sections;
}

function slugifySectionId(value: string, index: number): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
  return slug ? `${String(index + 1).padStart(2, "0")}-${slug}` : `section-${index + 1}`;
}

function sectionKindFromTitle(title: string): string {
  const normalized = title.toLowerCase();
  if (/executive|summary|takeaway|skim/.test(normalized)) return "skim";
  if (/quality|safety|qc|reliability|readiness|notice/.test(normalized))
    return "quality_gate";
  if (/missing|discovery|records|demand/.test(normalized))
    return "missing_records";
  if (/source|appendix|document|exhibit/.test(normalized)) return "source_appendix";
  if (/issue|analysis|mandamus|writ|relief|immunity|opinion|filing/.test(normalized))
    return "legal_analysis";
  if (/legacy|freeform/.test(normalized)) return "unsafe_reference";
  return "packet_section";
}

function sectionSourceFindingIds(
  title: string,
  findings: AgentFindingRecord[]
): number[] {
  const normalized = title.toLowerCase();
  if (
    /issue|finding|analysis|missing|discovery|mandamus|writ|relief|immunity|qc|quality|safety|reliability|opinion|filing/.test(
      normalized
    )
  ) {
    return findings.map(finding => finding.id);
  }
  return [];
}

function sectionSourceDocumentIds(
  title: string,
  documents: DocumentRecord[]
): number[] {
  const normalized = title.toLowerCase();
  if (
    /source|appendix|document|exhibit|summary|timeline|chronology|skim|executive/.test(
      normalized
    )
  ) {
    return documents.map(document => document.id);
  }
  return [];
}

export function buildEditableReportSections(input: {
  markdown: string;
  documents?: DocumentRecord[];
  findings?: AgentFindingRecord[];
}): EditableReportSection[] {
  const parsed = parseMarkdownSections(input.markdown);
  const documents = input.documents ?? [];
  const findings = input.findings ?? [];
  return parsed.map((section, index) => ({
    sectionId: slugifySectionId(section.title, index),
    title: section.title,
    kind: sectionKindFromTitle(section.title),
    level: section.level,
    markdown: section.content,
    includedInExport: !/legacy|freeform/i.test(section.title),
    sourceFindingIds: sectionSourceFindingIds(section.title, findings),
    sourceDocumentIds: sectionSourceDocumentIds(section.title, documents),
    edited: false,
    generatedVersion: section.content,
  }));
}

function parseEditableReportSections(
  value: string | null | undefined
): EditableReportSection[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    const result = reportSectionsSchema.safeParse(parsed);
    return result.success ? result.data : [];
  } catch {
    return [];
  }
}

function safeEditableReportSections(value: unknown): EditableReportSection[] {
  const parsed = reportSectionsSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
}

export function normalizeEditableSections(
  sections: EditableReportSection[]
): EditableReportSection[] {
  const seen = new Set<string>();
  return sections.map((section, index) => {
    const baseId = section.sectionId || slugifySectionId(section.title, index);
    const sectionId = seen.has(baseId) ? `${baseId}-${index + 1}` : baseId;
    seen.add(sectionId);
    return {
      ...section,
      sectionId,
      title: section.title.trim() || `Section ${index + 1}`,
      kind: section.kind || sectionKindFromTitle(section.title),
      markdown: section.markdown ?? "",
      includedInExport: section.includedInExport !== false,
      sourceFindingIds: Array.from(new Set(section.sourceFindingIds ?? [])),
      sourceDocumentIds: Array.from(new Set(section.sourceDocumentIds ?? [])),
      generatedVersion: section.generatedVersion ?? section.markdown ?? "",
    };
  });
}

export function markdownFromEditableSections(
  sections: EditableReportSection[]
): string {
  return sections
    .filter(section => section.includedInExport !== false)
    .map(section => section.markdown.trim())
    .filter(Boolean)
    .join("\n\n");
}

function revisionSummary(revision: {
  id: number;
  reportId: number;
  revisionNumber: number;
  title: string;
  markdown: string;
  sections: string;
  editReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  const sections = parseEditableReportSections(revision.sections);
  return {
    id: revision.id,
    reportId: revision.reportId,
    revisionNumber: revision.revisionNumber,
    title: revision.title,
    markdown: revision.markdown,
    sections,
    editReason: revision.editReason,
    createdAt: revision.createdAt,
    updatedAt: revision.updatedAt,
  };
}

function reportForRevisionExport(
  report: NonNullable<GeneratedReportRecord>,
  revision:
    | Awaited<ReturnType<typeof getLatestReportRevision>>
    | NonNullable<Awaited<ReturnType<typeof getLatestReportRevision>>>
    | undefined
) {
  if (!revision) return report;
  const metadata = safeJsonObject(report.metadata);
  return {
    ...report,
    title: revision.title,
    content: revision.markdown,
    format: "markdown",
    metadata: JSON.stringify({
      ...metadata,
      markdown: revision.markdown,
      sections: parseEditableReportSections(revision.sections),
      latestRevision: {
        id: revision.id,
        revisionNumber: revision.revisionNumber,
        editReason: revision.editReason,
        createdAt: revision.createdAt,
        updatedAt: revision.updatedAt,
      },
    }),
  };
}

function findMarkdownSection(
  sections: ParsedReportSection[],
  titleMatches: string[]
): ParsedReportSection | undefined {
  const matches = titleMatches.map(match => match.toLowerCase());
  return sections.find(section => {
    const title = section.title.toLowerCase();
    return matches.some(match => title.includes(match));
  });
}

function cleanMarkdownExcerpt(
  section: ParsedReportSection | undefined,
  limit = 1800
): string {
  if (!section) return "";
  const cleaned = section.content
    .split("\n")
    .filter(line => {
      const trimmed = line.trim();
      return (
        trimmed.length > 0 &&
        !/^#{1,3}\s+/.test(trimmed) &&
        !/^\|\s*-+/.test(trimmed)
      );
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return cleaned.length > limit
    ? `${cleaned.slice(0, Math.max(0, limit - 3)).trim()}...`
    : cleaned;
}

function stripInlineMarkdown(value: string): string {
  return sentence(value)
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

function valueAfterBoldLabel(lines: string[], label: string): string {
  const pattern = new RegExp(
    `^\\*\\*${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:\\*\\*\\s*(.*)$`,
    "i"
  );
  const line = lines.find(item => pattern.test(item.trim()));
  return line ? stripInlineMarkdown(line.trim().replace(pattern, "$1")) : "";
}

function collectBulletsAfterHeading(
  lines: string[],
  heading: string
): string[] {
  const target = `**${heading.toLowerCase()}**`;
  const start = lines.findIndex(line => line.trim().toLowerCase() === target);
  if (start < 0) return [];

  const bullets: string[] = [];
  for (const line of lines.slice(start + 1)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^#{1,3}\s+/.test(trimmed)) break;
    if (/^\*\*[^*]+(?:\*\*|:\*\*)/.test(trimmed) && !trimmed.startsWith("- ")) {
      break;
    }
    if (trimmed.startsWith("- ")) {
      bullets.push(stripInlineMarkdown(trimmed.slice(2)));
    } else if (bullets.length === 0) {
      bullets.push(stripInlineMarkdown(trimmed));
    }
  }

  return bullets.filter(Boolean);
}

function firstNarrativeLine(lines: string[]): string {
  const courtSafeIndex = lines.findIndex(line => {
    const trimmed = line.trim();
    return (
      trimmed.startsWith("**") &&
      trimmed.endsWith("**") &&
      !trimmed.includes(":**")
    );
  });

  const searchLines =
    courtSafeIndex >= 0 ? lines.slice(courtSafeIndex + 1) : lines;
  const line = searchLines.find(item => {
    const trimmed = item.trim();
    return (
      trimmed.length > 0 &&
      !trimmed.startsWith("#") &&
      !trimmed.startsWith("**") &&
      !trimmed.startsWith("- ") &&
      !trimmed.startsWith("|")
    );
  });
  return line ? stripInlineMarkdown(line) : "";
}

function confidenceFromIssueLines(lines: string[]): number | null {
  const joined = lines.join(" ");
  const match = /\bConfidence:\*\*\s*(\d{1,3})\/100/i.exec(joined);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function parseFilingDraftIssues(
  issueAnalysis: ParsedReportSection | undefined
): FilingDraftIssue[] {
  if (!issueAnalysis) return [];

  const blocks: Array<{ title: string; lines: string[] }> = [];
  let currentTitle = "";
  let currentLines: string[] = [];

  const flush = () => {
    if (currentTitle && currentLines.some(line => line.trim().length > 0)) {
      blocks.push({ title: currentTitle, lines: currentLines });
    }
  };

  issueAnalysis.content.split("\n").forEach(line => {
    const heading = /^###\s+(.+)$/.exec(line.trim());
    if (heading) {
      flush();
      currentTitle = stripInlineMarkdown(heading[1]);
      currentLines = [];
      return;
    }
    if (currentTitle) currentLines.push(line);
  });
  flush();

  return blocks
    .map(block => {
      const courtSafeFrame =
        block.lines
          .map(line => line.trim())
          .find(
            line =>
              line.startsWith("**") &&
              line.endsWith("**") &&
              !line.includes(":**")
          ) ?? "";

      return {
        title: block.title,
        proofPosture: valueAfterBoldLabel(block.lines, "Proof posture"),
        confidence: confidenceFromIssueLines(block.lines),
        legalHook: valueAfterBoldLabel(block.lines, "Legal hook"),
        reliefPath: valueAfterBoldLabel(block.lines, "Relief path"),
        courtSafeFrame: stripInlineMarkdown(courtSafeFrame),
        summary: firstNarrativeLine(block.lines),
        recordSupport: collectBulletsAfterHeading(
          block.lines,
          "Record support"
        ),
        missingRecords: collectBulletsAfterHeading(
          block.lines,
          "Missing records / proof to demand"
        ),
        authorities: collectBulletsAfterHeading(
          block.lines,
          "Authorities to verify before filing"
        ),
        nextAction:
          collectBulletsAfterHeading(
            block.lines,
            "Recommended next action"
          )[0] ?? "",
        reliability:
          valueAfterBoldLabel(block.lines, "Reliability note") ||
          block.lines
            .map(line => line.trim())
            .find(line => line.startsWith("**Reliability note:**"))
            ?.replace(/^\*\*Reliability note:\*\*\s*/i, "") ||
          "",
      };
    })
    .filter(issue => issue.title.length > 0)
    .slice(0, 10);
}

function filingDraftIssuesFromFindings(
  findings: AgentFindingRecord[]
): FilingDraftIssue[] {
  return findings
    .slice()
    .sort((left, right) => {
      const leverageDelta = right.leverageScore - left.leverageScore;
      return leverageDelta !== 0
        ? leverageDelta
        : right.confidence - left.confidence;
    })
    .slice(0, 10)
    .map(finding => ({
      title: finding.title,
      proofPosture: proofPosture(finding),
      confidence: finding.confidence,
      legalHook: finding.liabilityVector || "Needs legal hook verification",
      reliefPath: finding.remedyPath || "Needs remedy review",
      courtSafeFrame:
        finding.findingType === "record_supported"
          ? "Record-supported fact candidate after final quote and citation check."
          : finding.findingType === "missing_record" ||
              finding.findingType === "missing_critical" ||
              finding.findingType === "suspicious_absence"
            ? "Records-first issue; demand or verify the missing source before stronger filing language."
            : `${humanize(finding.findingType)}; label the claim and avoid presenting it as an established fact unless source support proves it.`,
      summary: sentence(finding.summary),
      recordSupport: sourceAnchorText(finding),
      missingRecords: safeListItems(finding.missingRecords),
      authorities: safeListItems(finding.legalAuthorities),
      nextAction: sentence(finding.nextAction),
      reliability:
        sentence(finding.qcReason) ||
        `QC status: ${humanize(finding.qcStatus)}.`,
    }));
}

function filingDraftUseLabel(issue: FilingDraftIssue): string {
  const proof = issue.proofPosture.toLowerCase();
  if (proof.includes("missing") || issue.missingRecords.length > 0) {
    return "Demand or appendix task - do not plead as proven misconduct.";
  }
  if (issue.confidence !== null && issue.confidence < 95) {
    return "Use cautiously with human review and source verification.";
  }
  if (proof.includes("record-supported") || issue.recordSupport.length > 0) {
    return "Candidate record fact after quote and citation check.";
  }
  if (proof.includes("authority")) {
    return "Authority lead only - verify current law before drafting rule.";
  }
  return "Draft lead only - verify support before court-facing use.";
}

function shortDraftCell(value: string, fallback: string, limit = 260): string {
  const clean = tableCell(value || fallback);
  return clean.length > limit
    ? `${clean.slice(0, limit - 3).trim()}...`
    : clean;
}

function buildIssueEvidenceDraftMatrix(issues: FilingDraftIssue[]): string {
  if (issues.length === 0) {
    return [
      "## Issue-To-Evidence Draft Matrix",
      "No issue-level source matrix could be extracted from the source report. Regenerate the report with structured findings before treating this as a filing draft.",
    ].join("\n");
  }

  return [
    "## Issue-To-Evidence Draft Matrix",
    "This table is the filing-draft control layer: every draft issue gets a source anchor, missing-proof treatment, and safe use label before it appears in argument.",
    "",
    "| Draft issue | Source quote / anchor | Missing proof | Draft use |",
    "| --- | --- | --- | --- |",
    ...issues
      .map(issue =>
        [
          shortDraftCell(issue.title, "Untitled issue", 220),
          shortDraftCell(
            issue.recordSupport[0] ?? "",
            "No source anchor attached.",
            340
          ),
          shortDraftCell(
            issue.missingRecords.slice(0, 3).join("; "),
            "No missing record listed.",
            260
          ),
          shortDraftCell(filingDraftUseLabel(issue), "Needs review", 240),
        ].join(" | ")
      )
      .map(row => `| ${row} |`),
  ].join("\n");
}

function buildSourceBoundArgumentSections(
  issues: FilingDraftIssue[],
  template: ReportTemplate
): string {
  if (issues.length === 0) {
    return [
      "## Source-Bound Draft Argument Sections",
      "No argument sections were generated because no source-bound issue blocks were available.",
    ].join("\n");
  }

  const mandamusNote =
    template === "mandamus_writ"
      ? "Tie this argument to clear duty, refusal or delay, no adequate ordinary remedy, appendix proof, and the exact command requested."
      : "Tie this argument to the procedural vehicle, governing rule, source facts, limits, and requested relief.";

  return [
    "## Source-Bound Draft Argument Sections",
    "Use these sections as drafting rails. They are not final argument. They tell the human drafter what can be said, what must be cited, and what must stay as a proof gap.",
    "",
    ...issues.slice(0, 6).map((issue, index) =>
      [
        `### Argument ${index + 1}. ${issue.title}`,
        `- Draft heading: ${issue.title}.`,
        `- Court-safe proposition: ${issue.courtSafeFrame || issue.proofPosture || "State only what the record supports."}`,
        `- Legal hook / remedy: ${issue.legalHook || "Needs legal hook verification"} / ${issue.reliefPath || "Needs remedy review"}.`,
        `- Paragraph starter: ${issue.summary || "The source record should be summarized here only after citation review."}`,
        "- Record support to cite:",
        issue.recordSupport.length > 0
          ? issue.recordSupport
              .slice(0, 4)
              .map(anchor => `  - ${anchor}`)
              .join("\n")
          : "  - No source anchor attached. Do not draft this as a factual assertion yet.",
        "- Missing proof / limits:",
        issue.missingRecords.length > 0
          ? issue.missingRecords
              .slice(0, 5)
              .map(record => `  - ${record}`)
              .join("\n")
          : "  - No missing proof listed; human review must still add adverse facts and local-rule limits.",
        "- Authorities to verify:",
        issue.authorities.length > 0
          ? issue.authorities
              .slice(0, 4)
              .map(authority => `  - ${authority}`)
              .join("\n")
          : "  - Verify controlling statutes, rules, standards of review, and current cases.",
        `- Filing use: ${filingDraftUseLabel(issue)}`,
        `- Drafting note: ${mandamusNote}`,
      ].join("\n")
    ),
  ].join("\n\n");
}

function readinessStatusCell(
  status: "READY" | "NEEDS REVIEW" | "BLOCKED",
  detail: string
): string {
  return `${status} - ${tableCell(detail)}`;
}

function filingReadinessMatrix(input: {
  sourceTemplate: ReportTemplate;
  draftCommand: DraftCommand;
  filingMetadata: FilingMetadata;
  filingPlan?: FilingPlan;
  issues: FilingDraftIssue[];
}): string {
  const commandMissing = filingCommandMissingFields(input.draftCommand);
  const captionMissing = filingCaptionMissingFields(input.filingMetadata);
  const anchoredIssues = input.issues.filter(
    issue => issue.recordSupport.length > 0
  );
  const authorityIssues = input.issues.filter(
    issue => issue.authorities.length > 0
  );
  const lowConfidenceIssues = input.issues.filter(
    issue => issue.confidence !== null && issue.confidence < 95
  );
  const missingProofIssues = input.issues.filter(
    issue => issue.missingRecords.length > 0
  );
  const mandamusBlocked =
    input.sourceTemplate === "mandamus_writ" &&
    input.filingPlan?.readiness !== "draft_ready";
  const rows = [
    [
      "Filing command",
      commandMissing.length === 0
        ? readinessStatusCell(
            "READY",
            "filing type, target, relief, and issues are present"
          )
        : readinessStatusCell(
            "BLOCKED",
            `missing ${commandMissing.join(", ")}`
          ),
    ],
    [
      "Caption and forum",
      captionMissing.length === 0
        ? readinessStatusCell(
            "READY",
            "caption metadata is available for the export cover"
          )
        : readinessStatusCell(
            "NEEDS REVIEW",
            `missing ${captionMissing.join(", ")}`
          ),
    ],
    [
      "Source-supported facts",
      input.issues.length > 0 && anchoredIssues.length === input.issues.length
        ? readinessStatusCell(
            "READY",
            "every parsed draft issue has at least one record anchor"
          )
        : readinessStatusCell(
            input.issues.length === 0 ? "BLOCKED" : "NEEDS REVIEW",
            input.issues.length === 0
              ? "no issue-level source matrix was extracted"
              : `${input.issues.length - anchoredIssues.length} issue(s) need source anchors or downgrade language`
          ),
    ],
    [
      "Authority and standard",
      authorityIssues.length > 0
        ? readinessStatusCell(
            "NEEDS REVIEW",
            `${authorityIssues.length} issue(s) have authority leads, but current law still must be verified`
          )
        : readinessStatusCell(
            "BLOCKED",
            "no authority leads were extracted; verify governing statutes, rules, and standards before filing"
          ),
    ],
    [
      "Adverse facts and limits",
      readinessStatusCell(
        "NEEDS REVIEW",
        "human reviewer must add counterfacts, waiver/preservation limits, harmless-error risk, and local-rule limits"
      ),
    ],
    [
      "Confidence and missing proof",
      lowConfidenceIssues.length === 0 && missingProofIssues.length === 0
        ? readinessStatusCell(
            "READY",
            "no parsed issue is low-confidence or records-first"
          )
        : readinessStatusCell(
            "NEEDS REVIEW",
            `${lowConfidenceIssues.length} low-confidence issue(s), ${missingProofIssues.length} missing-proof issue(s)`
          ),
    ],
    input.sourceTemplate === "mandamus_writ"
      ? [
          "Mandamus / writ gate",
          mandamusBlocked
            ? readinessStatusCell(
                input.filingPlan?.readiness === "records_first"
                  ? "NEEDS REVIEW"
                  : "BLOCKED",
                "do not file as mandamus unless clear duty, refusal/delay, no adequate remedy, appendix proof, and exact command are supported"
              )
            : readinessStatusCell(
                "NEEDS REVIEW",
                "route may be draft-ready, but writ petitions still require authority, appendix, and local-rule verification"
              ),
        ]
      : [
          "Procedural vehicle",
          readinessStatusCell(
            "NEEDS REVIEW",
            "confirm the relief belongs in this filing vehicle rather than appeal, habeas, mandamus, discovery, discipline, or civil-rights litigation"
          ),
        ],
  ];

  return [
    "## Filing-Quality Control Matrix",
    "This is the no-fantasy gate. A draft can be useful while still being blocked from filing. Use this matrix to decide whether the next move is file, revise, demand records, or preserve for review.",
    "",
    "| Gate | Filing status |",
    "| --- | --- |",
    ...rows.map(([gate, status]) => `| ${gate} | ${status} |`),
  ].join("\n");
}

function appellateWritFramingScaffold(input: {
  sourceTemplate: ReportTemplate;
  draftCommand: DraftCommand;
  filingPlan?: FilingPlan;
  questionLines: string[];
  issues: FilingDraftIssue[];
}): string {
  const firstIssue = input.issues[0];
  const authorities = uniqueList(
    input.issues.flatMap(issue => issue.authorities),
    8
  );
  const recordAnchors = uniqueList(
    input.issues.flatMap(issue => issue.recordSupport),
    8
  );
  const missingProof = uniqueList(
    input.issues.flatMap(issue => issue.missingRecords),
    8
  );
  const isMandamus = input.sourceTemplate === "mandamus_writ";
  const standard =
    authorities.length > 0
      ? authorities.map(authority => `- ${authority}`).join("\n")
      : isMandamus
        ? "- Verify the governing writ statute/rule, extraordinary-relief standard, abuse-of-discretion limits, and any local appendix requirements."
        : "- Verify the governing statute/rule, standard of review, preservation rule, harmless-error standard, and local briefing rules.";

  return [
    "## Appellate / Writ Framing Scaffold",
    "This section is the filing architecture. It tells the drafter what the court is being asked to decide, what standard must be verified, where the record support lives, and what cannot be safely claimed yet.",
    "",
    "### Questions Presented / Issues For Review",
    input.questionLines.join("\n"),
    "",
    "### Standard Of Review / Authority To Verify",
    standard,
    "",
    "### Jurisdiction / Procedure / Preservation",
    isMandamus
      ? "- Frame jurisdiction as extraordinary relief. Explain why ordinary appeal, motion practice, habeas, or later review is not plain, speedy, and adequate."
      : "- Identify the procedural vehicle, preservation posture, review standard, deadline, and whether the issue belongs in trial motion practice, appeal, habeas, writ, discovery, discipline, or civil-rights litigation.",
    "",
    "### Record Facts To Use First",
    recordAnchors.length > 0
      ? recordAnchors.map(anchor => `- ${anchor}`).join("\n")
      : "- No source anchors were extracted. Do not draft factual statements until the source appendix is rebuilt.",
    "",
    "### Adverse Facts, Limits, And Missing Proof",
    [
      firstIssue?.reliability
        ? `- Reliability limit: ${firstIssue.reliability}`
        : "- Add adverse facts, waiver/preservation limits, contrary transcript language, harmless-error risk, and local-rule limits before filing.",
      ...missingProof.map(
        record =>
          `- Missing proof to handle before strong filing language: ${record}`
      ),
    ].join("\n"),
    "",
    "### Relief / Command Requested",
    input.draftCommand?.requestedRelief
      ? `- ${input.draftCommand.requestedRelief}`
      : input.filingPlan?.theoryOfFiling
        ? `- ${input.filingPlan.theoryOfFiling}`
        : "- State the exact relief only after the route and record support are verified.",
  ].join("\n");
}

function writtenOpinionAnalysisScaffold(input: {
  draftCommand: DraftCommand;
  questionLines: string[];
  issues: FilingDraftIssue[];
}): string {
  const lead = input.issues[0];
  const rule =
    lead?.authorities?.length > 0
      ? lead.authorities.map(authority => `- ${authority}`).join("\n")
      : "- Governing law not verified yet. Add controlling statute, rule, standard, and cases before using this as opinion-style analysis.";
  const facts =
    lead?.recordSupport?.length > 0
      ? lead.recordSupport
          .slice(0, 6)
          .map(anchor => `- ${anchor}`)
          .join("\n")
      : "- No verified fact findings yet. Use only source anchors from the appendix.";
  const application =
    lead?.summary ||
    input.draftCommand?.additionalInstructions ||
    "Apply the verified rule to verified record facts only. Do not treat missing records, allegations, or inferences as findings.";

  return [
    "## Written-Opinion Analysis Scaffold",
    "Use this when the requested output needs to read like disciplined judicial reasoning instead of argument notes.",
    "",
    "### Question Presented",
    input.questionLines[0] ??
      "Whether the record and governing law support the requested relief.",
    "",
    "### Short Answer",
    "Not final. The draft answer must remain conditional until authority, source citations, adverse facts, and local rules are verified.",
    "",
    "### Rule / Legal Frame",
    rule,
    "",
    "### Record Facts",
    facts,
    "",
    "### Application",
    application,
    "",
    "### Limits And Adverse Facts",
    lead?.missingRecords?.length
      ? lead.missingRecords
          .map(record => `- Missing proof: ${record}`)
          .join("\n")
      : "- Add adverse facts, counterarguments, preservation problems, and missing-record limits before adopting any conclusion.",
    "",
    "### Recommended Disposition",
    input.draftCommand?.requestedRelief
      ? `Grant, deny, compel, preserve, or defer only to the extent supported by: ${input.draftCommand.requestedRelief}`
      : "No disposition should be drafted until the requested relief and authority path are supplied.",
  ].join("\n");
}

function mandamusElementApplication(input: {
  sourceTemplate: ReportTemplate;
  draftCommand: DraftCommand;
  filingPlan?: FilingPlan;
  issues: FilingDraftIssue[];
}): string {
  if (input.sourceTemplate !== "mandamus_writ") return "";

  const proofText = [
    input.draftCommand?.respondingTo ?? "",
    input.draftCommand?.requestedRelief ?? "",
    input.filingPlan?.theoryOfFiling ?? "",
    ...input.issues.flatMap(issue => [
      issue.title,
      issue.summary,
      issue.courtSafeFrame,
      ...issue.recordSupport,
      ...issue.missingRecords,
    ]),
  ]
    .join(" ")
    .toLowerCase();
  const elementRows = [
    [
      "Clear legal duty / required act",
      /clear duty|required|must|shall|written finding|rule|settle|produce|accept/.test(
        proofText
      )
        ? "ARGUABLE"
        : "MISSING",
      "Identify the statute, rule, order, or settled duty that makes the act mandatory.",
    ],
    [
      "Refusal, delay, or failure to perform",
      /refusal|refused|delay|failure|has not ruled|not ruled|pending|ignored|denied access/.test(
        proofText
      )
        ? "ARGUABLE"
        : "MISSING",
      "Cite the docket entry, minute order, transcript, notice, rejected filing, or correspondence.",
    ],
    [
      "No plain, speedy, adequate remedy",
      /no adequate|inadequate|not plain|not speedy|ordinary remedy|appeal/.test(
        proofText
      )
        ? "ARGUABLE"
        : "NEEDS PROOF",
      "Explain why ordinary appeal, renewed motion, habeas, or later review is not enough.",
    ],
    [
      "Beneficial interest / standing",
      /beneficial|standing|petitioner|moving party|affected|prejudice|irreparable/.test(
        proofText
      )
        ? "ARGUABLE"
        : "NEEDS PROOF",
      "Show why the petitioner is directly affected by the failure to act.",
    ],
    [
      "Exact narrow command",
      input.draftCommand?.requestedRelief ? "ARGUABLE" : "MISSING",
      "Ask for a narrow act: rule, make findings, settle record, accept filing, produce record, or hold required hearing.",
    ],
    [
      "Appendix and source proof",
      input.issues.some(issue => issue.recordSupport.length > 0)
        ? "PARTIAL"
        : "MISSING",
      "Attach orders, filings, transcript excerpts, docket entries, notices, and file-stamped proof.",
    ],
  ];

  return [
    "## Mandamus Element Application",
    "This is the writ-specific no-overclaim section. A bad ruling is not automatically mandamus. The draft should file a writ only if these gates are supported by the record and governing law.",
    "",
    "| Element | Current posture | What must be proven before filing |",
    "| --- | --- | --- |",
    ...elementRows.map(
      ([element, posture, proof]) =>
        `| ${element} | ${posture} | ${tableCell(proof)} |`
    ),
  ].join("\n");
}

function courtFilingSkeleton(input: {
  sourceTemplate: ReportTemplate;
  draftCommand: DraftCommand;
  filingMetadata: FilingMetadata;
  filingPlan?: FilingPlan;
  issues: FilingDraftIssue[];
}): string {
  const filingTitle =
    input.filingMetadata?.filingTitle ||
    (draftCommandHasContent(input.draftCommand) &&
      input.draftCommand.filingType) ||
    humanize(input.sourceTemplate);
  const court =
    input.filingMetadata?.courtName ||
    input.filingMetadata?.jurisdiction ||
    "Court / forum to verify";
  const caseNumber = input.filingMetadata?.caseNumber || "Case number missing";
  const partyLine =
    input.filingMetadata?.petitioner && input.filingMetadata?.respondent
      ? `${input.filingMetadata.petitioner} v. ${input.filingMetadata.respondent}`
      : input.filingMetadata?.plaintiff && input.filingMetadata?.defendant
        ? `${input.filingMetadata.plaintiff} v. ${input.filingMetadata.defendant}`
        : "Party caption missing";
  const relief = reportReliefText(input.sourceTemplate, input.draftCommand);
  const topIssues =
    input.issues.length > 0
      ? input.issues.slice(0, 5).map((issue, index) => {
          const support =
            issue.recordSupport[0] ||
            "source anchor must be inserted before court-facing use";
          return `${index + 1}. ${issue.title} - use as ${issue.proofPosture}; support: ${support}`;
        })
      : [
          "1. No issue blocks were parsed from the source report. Do not draft argument until QC-cleared findings are selected.",
        ];
  const missingProof = uniqueList(
    input.issues.flatMap(issue => issue.missingRecords),
    8
  );

  const commonControls = [
    "### Pleading Paper And Export Controls",
    "- Use jurisdiction-specific pleading paper or court-required PDF format where required; Nevada-style pleading paper should include line numbers, caption, title, footer/page numbering, and stable exhibit labels.",
    "- Keep one-inch margins unless the court or local rule requires a different format.",
    "- Every factual paragraph must trace to a source appendix item, transcript cite, exhibit, docket entry, or declaration.",
    "- Do not export as a final court filing until citations, authorities, local rules, signature, service, and appendix completeness are reviewed by a human.",
  ];

  const caption = [
    "### Caption Block",
    `- Court: ${court}.`,
    `- Case number: ${caseNumber}.`,
    `- Parties: ${partyLine}.`,
    `- Filing title: ${filingTitle}.`,
    `- Requested relief / command: ${relief}.`,
  ];

  let orderedSections: string[];
  if (input.sourceTemplate === "mandamus_writ") {
    orderedSections = [
      "### Ordered Filing Sections",
      "1. Caption and filing title.",
      "2. Identity of petitioner, respondent, and any real party in interest.",
      "3. Jurisdiction and writ authority to verify.",
      "4. Questions presented / issues for extraordinary relief.",
      "5. Statement of the case and source-bound procedural history.",
      "6. Statement of facts with appendix citations only.",
      "7. Argument / reasons relief should issue.",
      "8. Clear legal duty / required act.",
      "9. Refusal, delay, or failure to perform.",
      "10. No plain, speedy, adequate ordinary remedy.",
      "11. Beneficial interest / standing.",
      "12. Exact narrow command requested.",
      "13. Prayer for relief.",
      "14. Verification or declaration if required.",
      "15. Certificate of service.",
      "16. Appendix index.",
    ];
  } else if (input.sourceTemplate === "written_opinion") {
    orderedSections = [
      "### Ordered Filing Sections",
      "1. Caption or memorandum heading.",
      "2. Question presented.",
      "3. Short answer.",
      "4. Procedural posture and standard of review.",
      "5. Source-bound facts.",
      "6. Governing law / rule to verify.",
      "7. Analysis.",
      "8. Adverse facts and limits.",
      "9. Recommended disposition.",
      "10. Appendix / citation notes.",
    ];
  } else if (input.sourceTemplate === "discovery_demands") {
    orderedSections = [
      "### Ordered Filing Sections",
      "1. Caption or demand heading.",
      "2. Authority and procedural basis for demand.",
      "3. Short statement of why records should exist.",
      "4. Numbered record requests by custodian.",
      "5. What each record proves, disproves, or narrows.",
      "6. Preservation instruction.",
      "7. Deadline and response format requested.",
      "8. Source appendix and prior demand history.",
    ];
  } else {
    orderedSections = [
      "### Ordered Filing Sections",
      "1. Caption and filing title.",
      "2. Introduction / relief requested.",
      "3. Procedural posture.",
      "4. Source-bound statement of facts.",
      "5. Governing law and standard to verify.",
      "6. Argument by issue.",
      "7. Adverse facts and limits.",
      "8. Missing proof and records-first demands.",
      "9. Relief requested / proposed order language.",
      "10. Signature, verification if required, certificate of service, and appendix.",
    ];
  }

  return [
    "## Court Filing Skeleton",
    "This is the court-facing assembly map. It is not final legal advice and not a complete pleading. It tells a human reviewer how to turn the source-bound packet into a filing without losing the record, appendix, or safety gates.",
    "",
    ...caption,
    "",
    ...commonControls,
    "",
    ...orderedSections,
    "",
    "### Issue-To-Section Placement",
    ...topIssues.map(issue => `- ${issue}`),
    "",
    "### Appendix Index Starter",
    input.issues.length > 0
      ? input.issues
          .slice(0, 8)
          .map((issue, index) => {
            const anchor =
              issue.recordSupport[0] ||
              "insert verified source quote / page / line";
            return `${index + 1}. ${issue.title}: ${anchor}`;
          })
          .join("\n")
      : "1. Add appendix items after selecting QC-cleared findings.",
    "",
    "### Do Not File Until",
    [
      "- Caption, court, case number, parties, filing title, and service list are correct.",
      "- Every factual paragraph has a source appendix item or is removed/downgraded.",
      "- Current statutes, rules, cases, standards of review, and local rules are verified.",
      "- Adverse facts, preservation, waiver, harmless-error/prejudice, immunity, and ordinary-remedy risks are addressed.",
      input.sourceTemplate === "mandamus_writ"
        ? "- The writ asks for a narrow command and does not seek damages, merits reweighing, or generalized misconduct findings."
        : "- The requested relief matches the procedural vehicle.",
      missingProof.length > 0
        ? `- Missing proof is handled as records-first language: ${missingProof.join("; ")}.`
        : "- Missing proof has been rechecked against the source record.",
    ].join("\n"),
  ].join("\n");
}

function filingDraftReadinessLabel(plan: FilingPlan | undefined): string {
  if (!plan) return "Blocked before filing - no filing plan attached.";
  switch (plan.readiness) {
    case "draft_ready":
      return "Draft ready for human legal review - not final filing.";
    case "human_review_required":
      return "Attorney or qualified human review required before filing.";
    case "records_first":
      return "Records first - generate demands or appendix tasks before filing.";
    case "do_not_file_yet":
    default:
      return "Blocked before filing - do not file from this draft yet.";
  }
}

function parseStoredDraftCommand(value: unknown): DraftCommand {
  const parsed = draftCommandSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

function parseStoredFilingMetadata(value: unknown): FilingMetadata {
  const parsed = filingMetadataSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

function parseStoredFilingPlan(value: unknown): FilingPlan | undefined {
  const parsed = filingPlanSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function parseStoredReportTemplate(value: unknown): ReportTemplate | undefined {
  const parsed = reportTemplateSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

function reportMetaObject(report: NonNullable<GeneratedReportRecord>) {
  const root = safeJsonObject(report.metadata);
  const metadata = isPlainRecord(root.metadata) ? root.metadata : {};
  return { root, metadata };
}

function formatDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function parseDateBound(
  value: string | undefined,
  endOfDay: boolean
): Date | null {
  if (!value) return null;
  const parsed = new Date(
    `${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`
  );
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function templateInstruction(template: ReportTemplate): string {
  switch (template) {
    case "court_packet":
      return "Build a court-ready packet with appellate-quality issue framing, record facts, legal theories, relief requested, source table, motion-ready next steps, and proposed-order clarity.";
    case "case_strategy":
      return "Build a strategic case memo with strongest claims, weak points, actor-specific risks, immunity/abstention issues, preservation posture, and next actions.";
    case "written_opinion":
      return "Build an opinion-style bench memo with issue presented, short answer, rule, source-bound facts, analysis, adverse facts, limits, and recommended disposition. It should read like disciplined judicial reasoning, not agent chatter or advocacy notes.";
    case "evidence_chronology":
      return "Build an evidence chronology with dated events, source documents, contradictions, gaps, evidentiary significance, and records to request.";
    case "immunity_relief":
      return "Build an immunity exposure and relief pathway report. Separate damages immunity from mandamus, habeas, recusal, supervisory review, declaratory, prospective, Monell, and nonimmune-actor routes.";
    case "mandamus_writ":
      return "Build a mandamus and extraordinary-writ viability packet at petition quality. Test clear legal duty, beneficial interest, no plain/speedy/adequate remedy, abuse-of-discretion barriers, appendix needs, emergency posture, and the exact command requested.";
    case "discovery_demands":
      return "Build a discovery and records-demand packet with exact records to request, why each matters, and what each record would prove or disprove.";
    case "source_appendix":
      return "Build a source appendix packet with document IDs, filenames, source quotes, source hashes, finding IDs, QC status, inclusion status, and filing-readiness warnings. Prioritize verifiability over argument.";
    case "executive_summary":
      return "Build a concise skim brief for a pro se litigant or attorney reviewing the case quickly, with court-safe conclusions and clearly identified next filings.";
  }
}

function draftCommandHasContent(
  command: DraftCommand
): command is NonNullable<DraftCommand> {
  if (!command) return false;
  return Object.entries(command).some(([, value]) => {
    if (Array.isArray(value)) return value.some(item => item.trim().length > 0);
    return typeof value === "string" && value.trim().length > 0;
  });
}

function draftCommandLines(command: DraftCommand): string[] {
  if (!draftCommandHasContent(command)) return [];
  const keyIssues = (command.keyIssues ?? []).filter(Boolean);
  return [
    command.filingType ? `- Filing requested: ${command.filingType}` : null,
    command.respondingTo
      ? `- Drafting in response to: ${command.respondingTo}`
      : null,
    command.courtLevel ? `- Court / forum: ${command.courtLevel}` : null,
    command.proceduralPosture
      ? `- Procedural posture: ${command.proceduralPosture}`
      : null,
    command.requestedRelief
      ? `- Relief requested: ${command.requestedRelief}`
      : null,
    keyIssues.length > 0
      ? `- Key issues to prioritize: ${keyIssues.join("; ")}`
      : null,
    command.oppositionPosition
      ? `- Opposing position to answer: ${command.oppositionPosition}`
      : null,
    command.draftingStyle ? `- Drafting style: ${command.draftingStyle}` : null,
    command.additionalInstructions
      ? `- Additional drafting instructions: ${command.additionalInstructions}`
      : null,
  ].filter((line): line is string => Boolean(line));
}

function draftCommandText(command: DraftCommand): string {
  const lines = draftCommandLines(command);
  return lines.length > 0
    ? lines.join("\n")
    : "No specific filing command was supplied. Build a generally useful court-safe packet from the selected report template.";
}

function draftCommandReportSection(command: DraftCommand): string {
  const lines = draftCommandLines(command);
  if (lines.length === 0) {
    return [
      "## Filing Command",
      "No specific filing command was supplied. This report is organized as a court-safe work-product packet rather than a final filing.",
    ].join("\n");
  }

  return [
    "## Filing Command",
    "The report was generated against the following drafting command. The command controls organization and emphasis, but factual assertions still must come from QC-cleared findings and source anchors.",
    "",
    lines.join("\n"),
  ].join("\n");
}

function filingMetadataHasContent(
  metadata: FilingMetadata
): metadata is NonNullable<FilingMetadata> {
  if (!metadata) return false;
  return Object.values(metadata).some(
    value => typeof value === "string" && value.trim().length > 0
  );
}

function filingMetadataLines(metadata: FilingMetadata): string[] {
  if (!filingMetadataHasContent(metadata)) return [];
  const partyLine =
    metadata.petitioner || metadata.respondent
      ? `${metadata.petitioner || "Petitioner"} v. ${metadata.respondent || "Respondent"}`
      : metadata.plaintiff || metadata.defendant
        ? `${metadata.plaintiff || "Plaintiff"} v. ${metadata.defendant || "Defendant"}`
        : null;

  return [
    metadata.courtName ? `- Court: ${metadata.courtName}` : null,
    metadata.jurisdiction ? `- Jurisdiction: ${metadata.jurisdiction}` : null,
    metadata.caseNumber ? `- Case number: ${metadata.caseNumber}` : null,
    partyLine ? `- Parties: ${partyLine}` : null,
    metadata.filingTitle ? `- Filing title: ${metadata.filingTitle}` : null,
    metadata.filingSubtitle
      ? `- Filing subtitle: ${metadata.filingSubtitle}`
      : null,
    metadata.preparedFor ? `- Prepared for: ${metadata.preparedFor}` : null,
  ].filter((line): line is string => Boolean(line));
}

function filingMetadataReportSection(metadata: FilingMetadata): string {
  const lines = filingMetadataLines(metadata);
  if (lines.length === 0) {
    return [
      "## Caption And Filing Metadata",
      "No court caption metadata was supplied. Before court filing, add court, case number, parties, filing title, and forum-specific caption requirements.",
    ].join("\n");
  }

  return [
    "## Caption And Filing Metadata",
    "Use this metadata for the export cover, caption block, and human filing review. Local court formatting rules still need final verification before filing.",
    "",
    lines.join("\n"),
  ].join("\n");
}

function draftingQualityStandard(template: ReportTemplate): string {
  const mandamusRule =
    template === "mandamus_writ"
      ? "For mandamus, do not write like ordinary motion practice. Identify the duty, refusal or failure, beneficial interest, inadequate ordinary remedy, appendix proof, standard-of-review risk, and exact command requested."
      : "When extraordinary relief is implicated, separate writ logic from ordinary merits review.";
  const opinionRule =
    template === "written_opinion"
      ? "For written-opinion output, organize every lead issue as question presented, short answer, governing rule, record facts, analysis, adverse facts, limits, and recommended disposition. Do not sound like a motion unless the user asks for motion drafting."
      : "When opinion-style reasoning is useful, keep issue, rule, record facts, application, limits, and remedy visibly separated.";

  return [
    "Write at appellate-work-product quality: precise issue framing, clean procedural posture, disciplined record citations, fair adverse-fact treatment, and restrained conclusions.",
    "Use written-opinion discipline: explain the governing rule, the record facts that matter, the application, the limits of the record, and the remedy path.",
    "Do not invent case law. If authority is supplied by findings, mark it for verification unless already verified. If authority is missing, say what authority must be verified.",
    "Use court-safe verbs: alleges, indicates, supports, undermines, requires verification, should be demanded, should be preserved.",
    opinionRule,
    mandamusRule,
  ].join(" ");
}

function llmContentText(
  response: Awaited<ReturnType<typeof invokeLLM>>
): string {
  const content = response.choices[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map(part => (part.type === "text" ? part.text : ""))
      .join("\n")
      .trim();
  }
  return "";
}

function stripJsonFence(value: string): string {
  const trimmed = value.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return fenced ? fenced[1].trim() : trimmed;
}

function parseDraftAssistantResponse(value: string) {
  const parsed = JSON.parse(stripJsonFence(value)) as unknown;
  const response = draftAssistantResponseSchema.parse(parsed);
  return {
    ...response,
    filingPlan:
      response.filingPlan ??
      buildFilingPlan({
        template: response.template,
        draftCommand: response.draftCommand,
        filingMetadata: response.filingMetadata,
        warnings: response.warnings,
      }),
  };
}

function compactMetadata(
  metadata: FilingMetadata
): NonNullable<FilingMetadata> {
  const entries = Object.entries(metadata ?? {}).filter(
    ([, value]) => typeof value === "string" && value.trim().length > 0
  );
  return Object.fromEntries(entries) as NonNullable<FilingMetadata>;
}

function inferFilingMetadataFromMessage(
  message: string,
  currentMetadata: FilingMetadata
): FilingMetadata {
  const metadata = compactMetadata(currentMetadata);
  const courtPatterns: Array<[RegExp, string]> = [
    [
      /supreme court of nevada|nevada supreme court/i,
      "Supreme Court of Nevada",
    ],
    [
      /eighth judicial district court|8th judicial district court/i,
      "Eighth Judicial District Court",
    ],
    [/district court/i, "District Court"],
    [
      /court of appeals of nevada|nevada court of appeals/i,
      "Court of Appeals of Nevada",
    ],
  ];
  for (const [pattern, courtName] of courtPatterns) {
    if (!metadata.courtName && pattern.test(message)) {
      metadata.courtName = courtName;
      break;
    }
  }

  const caseNumber =
    /\b(?:case\s*(?:number|no\.?|#)?\s*[:#]?\s*)?((?:CR|C|A|D)\d{2,4}[-–][A-Z0-9-]{2,})\b/i.exec(
      message
    )?.[1];
  if (!metadata.caseNumber && caseNumber) {
    metadata.caseNumber = caseNumber.replace("–", "-").toUpperCase();
  }

  const petitioner =
    /\bpetitioner\s*(?:is|:)?\s*([A-Z][A-Za-z .'-]{2,80})/i.exec(message)?.[1];
  if (!metadata.petitioner && petitioner) {
    metadata.petitioner = sentence(petitioner);
  }

  const respondent =
    /\brespondent\s*(?:is|:)?\s*([A-Z][A-Za-z .'-]{2,80})/i.exec(message)?.[1];
  if (!metadata.respondent && respondent) {
    metadata.respondent = sentence(respondent);
  }

  const caption =
    /\b([A-Z][A-Za-z .'-]{2,80})\s+v\.?\s+([A-Z][A-Za-z .'-]{2,80})\b/.exec(
      message
    );
  if (caption && !metadata.petitioner && !metadata.respondent) {
    metadata.petitioner = sentence(caption[1]);
    metadata.respondent = sentence(caption[2]);
  }

  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

export function buildDeterministicDraftAssistantResponse(input: {
  message: string;
  currentTemplate: ReportTemplate;
  currentCommand: DraftCommand;
  currentFilingMetadata?: FilingMetadata;
  currentKeyIssues?: string[];
  chatHistory?: Array<z.infer<typeof draftChatMessageSchema>>;
}) {
  const message = sentence(input.message);
  const text = message.toLowerCase();
  const currentIssues = (input.currentKeyIssues ?? []).filter(Boolean);
  let template = input.currentTemplate;
  let filingType =
    input.currentCommand?.filingType || "Court-facing report packet";
  let draftingStyle =
    input.currentCommand?.draftingStyle || "Written opinion style";
  let requestedRelief = input.currentCommand?.requestedRelief;
  const warnings: string[] = [];
  const keyIssues = new Set<string>(currentIssues);

  const addIssues = (issues: string[]) => {
    issues.forEach(issue => {
      if (keyIssues.size < 12) keyIssues.add(issue);
    });
  };

  if (
    /written opinion|opinion style|bench memo|judicial opinion|findings of fact|conclusions of law|proposed findings|proposed order|reasoned disposition|holding/.test(
      text
    )
  ) {
    template = "written_opinion";
    filingType = "Opinion-style bench memo";
    draftingStyle = "Written opinion quality";
    requestedRelief =
      requestedRelief ||
      "Organize the source-bound record into issue, rule, record facts, analysis, adverse facts, limits, and recommended disposition.";
    addIssues([
      "Question presented",
      "Governing rule",
      "Record facts",
      "Analysis",
      "Adverse facts",
      "Recommended disposition",
    ]);
  } else if (
    /mandamus|\bwrit\b|\bwrits\b|extraordinary writ|extraordinary relief|prohibition|compel|refusal to rule|missing written findings|refused written findings|failure to issue written findings|settle.*record|clerk.*refus|narrow command/.test(
      text
    )
  ) {
    template = "mandamus_writ";
    filingType = /prohibition/.test(text)
      ? "Writ petition / extraordinary relief"
      : "Mandamus petition / writ packet";
    draftingStyle = "Mandamus petition quality";
    requestedRelief =
      requestedRelief ||
      "Compel the specific legal duty supported by the record, or demand the missing appendix proof before filing.";
    addIssues([
      "Clear legal duty",
      "Beneficial interest",
      "No plain, speedy, adequate remedy",
      "Appendix proof",
      "Exact command requested",
      "Discretionary barrier",
    ]);
    warnings.push(
      "Mandamus is extraordinary; do not file unless the record supports duty, refusal or delay, no adequate remedy, and a narrow command."
    );
  } else if (
    /source appendix|source ledger|exhibit ledger|quote ledger|citation ledger|source table|hash verification|show me the evidence/.test(
      text
    )
  ) {
    template = "source_appendix";
    filingType = "Source appendix packet";
    draftingStyle = "Attorney handoff memo";
    requestedRelief =
      requestedRelief ||
      "Create a verifiable appendix showing the documents, quotes, hashes, linked findings, QC posture, and warnings behind the packet.";
    addIssues([
      "Document ledger",
      "Source quotes",
      "Finding links",
      "QC status",
      "Export warnings",
    ]);
  } else if (
    /discover|brady|giglio|napue|missing record|subpoena|public record|prr|records? demand|produce/.test(
      text
    )
  ) {
    template = "discovery_demands";
    filingType = "Discovery demand packet";
    draftingStyle = "Attorney handoff memo";
    requestedRelief =
      requestedRelief ||
      "Demand the specific records needed to prove, disprove, or safely frame each issue.";
    addIssues([
      "Missing records",
      "Source verification",
      "Contradictions",
      "Record demand language",
    ]);
    warnings.push(
      "Missing records are demands, not proof of misconduct until the record supports the stronger claim."
    );
  } else if (
    /appeal|appellate|reversible|standard of review|preserve/.test(text)
  ) {
    template = "written_opinion";
    filingType = "Appellate issue memo";
    draftingStyle = "Appellate quality";
    requestedRelief =
      requestedRelief ||
      "Identify preserved error, standard of review, record support, adverse facts, and the safest relief path.";
    addIssues([
      "Question presented",
      "Standard of review",
      "Issue preservation",
      "Record facts",
      "Adverse facts",
      "Relief path",
    ]);
  } else if (
    /opposition|reply|respond|response|answer the state|answer opposing/.test(
      text
    )
  ) {
    template = "court_packet";
    filingType = "Reply brief";
    draftingStyle = "Aggressive but court-safe";
    requestedRelief =
      requestedRelief ||
      "Answer the opposing position and request only relief supported by QC-cleared findings.";
    addIssues([
      "Opposing argument",
      "Record response",
      "Authority verification",
      "Requested relief",
    ]);
  } else if (/timeline|chronolog|date|delay|gap|era/.test(text)) {
    template = "evidence_chronology";
    filingType = "Timeline / gaps report";
    draftingStyle = "Attorney handoff memo";
    requestedRelief =
      requestedRelief ||
      "Build a dated chronology with contradictions, missing records, and legal significance.";
    addIssues(["Timeline", "Delay", "Gaps", "Actor attribution"]);
  } else if (
    /immunity|relief pathway|judicial|prosecutor|qualified|recusal|habeas/.test(
      text
    )
  ) {
    template = "immunity_relief";
    filingType = "Immunity and relief pathway memo";
    draftingStyle = "Written opinion style";
    requestedRelief =
      requestedRelief ||
      "Separate damages barriers from mandamus, habeas, appeal, recusal, prospective relief, and nonimmune actor routes.";
    addIssues([
      "Actor function",
      "Damages immunity",
      "Non-damages relief",
      "Records to demand",
    ]);
  }

  if (/conspir|corrupt|fraud|bad faith|retaliat|fabricat/.test(text)) {
    warnings.push(
      "Treat accusations as record-supported facts only when QC-cleared findings and source quotes support the exact claim."
    );
  }

  const draftCommand = {
    ...input.currentCommand,
    filingType,
    respondingTo: input.currentCommand?.respondingTo || message.slice(0, 800),
    requestedRelief,
    keyIssues: Array.from(keyIssues).slice(0, 12),
    draftingStyle,
  };
  const filingMetadata = inferFilingMetadataFromMessage(
    message,
    input.currentFilingMetadata
  );
  const filingPlan = buildFilingPlan({
    template,
    draftCommand,
    filingMetadata,
    warnings,
  });
  const nextQuestion =
    filingPlan.nextQuestions[0] ??
    "What source record, requested relief, or caption detail should be added next?";
  const readinessNote =
    filingPlan.readiness === "draft_ready"
      ? "The route is ready for human legal review and export checks."
      : filingPlan.readiness === "records_first"
        ? "This is records-first; demand or attach missing proof before filing."
        : filingPlan.readiness === "human_review_required"
          ? "This needs human legal review before any court-facing use."
          : "Do not file yet; the command or source proof is still incomplete.";

  return draftAssistantResponseSchema.parse({
    assistantReply: `I converted that into ${filingPlan.routeLabel}. ${readinessNote} Next: ${nextQuestion}`,
    template,
    reportTitle:
      template === "mandamus_writ"
        ? "Mandamus / Extraordinary Writ Packet"
        : template === "written_opinion"
          ? "Opinion-Style Bench Memo"
          : template === "discovery_demands"
            ? "Discovery And Missing Records Demand Packet"
            : undefined,
    draftCommand,
    filingMetadata,
    filingPlan,
    warnings: warnings.slice(0, 6),
  });
}

function draftAssistantPrompt(input: {
  message: string;
  currentTemplate: ReportTemplate;
  currentCommand: DraftCommand;
  currentFilingMetadata?: FilingMetadata;
  currentKeyIssues?: string[];
  chatHistory?: Array<z.infer<typeof draftChatMessageSchema>>;
}) {
  const recentChat = (input.chatHistory ?? [])
    .slice(-8)
    .map(
      message => `${message.role.toUpperCase()}: ${sentence(message.content)}`
    )
    .join("\n");

  return [
    `USER MESSAGE:\n${input.message}`,
    "",
    `CURRENT TEMPLATE: ${input.currentTemplate}`,
    "",
    `CURRENT COMMAND:\n${draftCommandText(input.currentCommand)}`,
    "",
    `CURRENT CAPTION / FILING METADATA:\n${filingMetadataLines(input.currentFilingMetadata).join("\n") || "none"}`,
    "",
    `CURRENT KEY ISSUES:\n${(input.currentKeyIssues ?? []).join("\n") || "none"}`,
    "",
    `RECENT CHAT:\n${recentChat || "none"}`,
  ].join("\n");
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
  ].filter(
    (value): value is string =>
      typeof value === "string" && value.trim().length > 0
  );

  return parts.join("\n\n");
}

function reportSourceDigest(
  document: DocumentRecord,
  includeRawDocumentText: boolean
): string {
  const metadata = [
    `File: ${document.fileName}`,
    `Status: ${document.status}`,
    `Uploaded: ${formatDate(document.createdAt)}`,
    `Document ID: ${document.id}`,
    `Source hash: ${document.documentHash || "missing"}`,
    `Extraction quality: ${document.extractionQualityScore ?? 0}/100`,
  ].join("\n");

  if (!includeRawDocumentText) {
    return `${metadata}\nRaw extracted text withheld from report-generation context. Use QC-cleared findings and source anchors for factual claims.`;
  }

  const text =
    document.extractedText || document.summary || "[No extracted text saved]";
  return `${metadata}\n${text.slice(0, 4000)}`;
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

function safeJsonObject(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function safeNumberArray(value: string | null): number[] {
  return safeJsonArray(value)
    .map(item => Number(item))
    .filter(item => Number.isInteger(item) && item > 0);
}

function savedReportSummary(report: NonNullable<GeneratedReportRecord>) {
  const metadata = safeJsonObject(report.metadata);
  const nestedMetadata = safeJsonObject(
    JSON.stringify(metadata.metadata ?? {})
  );
  const statistics = safeJsonObject(JSON.stringify(metadata.statistics ?? {}));
  const parsedCaseId = Number(nestedMetadata.caseId ?? metadata.caseId ?? 0);
  return {
    id: report.id,
    title: report.title,
    template: report.template,
    scope: report.scope,
    format: report.format,
    fileName: report.fileName,
    caseId:
      Number.isInteger(parsedCaseId) && parsedCaseId > 0 ? parsedCaseId : null,
    documentIds: safeNumberArray(report.documentIds),
    selectedFindingIds: safeNumberArray(report.selectedFindingIds),
    minConfidence: report.minConfidence,
    includeBlockedFindings: Boolean(report.includeBlockedFindings),
    statistics: {
      documents: Number(statistics.documents ?? 0),
      savedAgentOutputs: Number(statistics.savedAgentOutputs ?? 0),
      readyDocuments: Number(statistics.readyDocuments ?? 0),
      structuredFindings: Number(statistics.structuredFindings ?? 0),
      blockedFindingsIncluded: Boolean(statistics.blockedFindingsIncluded),
      legacyAgentOutputsIncluded: Boolean(
        statistics.legacyAgentOutputsIncluded
      ),
    },
    availableExportFormats: [
      "markdown",
      "html",
      "json",
      "pdf",
      "docx",
    ] as const,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
  };
}

function findingMatchesDocuments(
  finding: AgentFindingRecord,
  documentIds: Set<number>
) {
  const anchors = safeJsonArray(finding.sourceAnchors);
  if (anchors.length === 0) return true;
  return anchors.some(anchor => {
    if (!anchor || typeof anchor !== "object") return false;
    return documentIds.has(
      Number((anchor as Record<string, unknown>).documentId)
    );
  });
}

function humanize(value: string | null | undefined): string {
  return (value || "Unspecified")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

function sentence(value: string | null | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

function safeListItems(value: string | null): string[] {
  return safeJsonArray(value)
    .map(item => {
      if (typeof item === "string") return sentence(item);
      if (!item || typeof item !== "object") return sentence(String(item));
      const record = item as Record<string, unknown>;
      return sentence(
        String(
          record.title ??
            record.name ??
            record.description ??
            record.record ??
            record.value ??
            JSON.stringify(record)
        )
      );
    })
    .filter(Boolean);
}

function proofPosture(finding: AgentFindingRecord): string {
  switch (finding.findingType) {
    case "record_supported":
      return "Record-supported finding";
    case "contradiction":
      return "Record-supported contradiction to resolve";
    case "adverse_fact":
      return "Adverse fact to account for";
    case "strong_inference":
      return "Strong inference - state cautiously";
    case "weak_inference":
    case "inference":
      return "Inference - do not state as proven";
    case "missing_record":
      return "Missing record demand";
    case "missing_critical":
      return "Critical missing proof";
    case "suspicious_absence":
      return "Suspicious absence - demand records";
    case "legal_authority":
      return "Legal authority - verify before filing";
    default:
      return humanize(finding.findingType);
  }
}

function leverageLabel(score: number): string {
  const denominator = score <= 10 ? 10 : 100;
  const normalized = score <= 10 ? score * 10 : score;
  const label =
    normalized >= 85
      ? "Critical"
      : normalized >= 70
        ? "High"
        : normalized >= 45
          ? "Moderate"
          : "Low";
  return `${label} (${score}/${denominator})`;
}

function courtSafeLead(finding: AgentFindingRecord): string {
  switch (finding.findingType) {
    case "record_supported":
    case "contradiction":
    case "adverse_fact":
      return "The record supports the following limited statement:";
    case "missing_record":
    case "missing_critical":
    case "suspicious_absence":
      return "The safer framing is a records demand, not a proven accusation:";
    case "strong_inference":
      return "The record supports a strong inference, but the conclusion should remain cautious:";
    case "weak_inference":
    case "inference":
      return "This is an investigative lead and should not be pled as established fact yet:";
    case "legal_authority":
      return "This is legal authority or doctrine to verify and apply to proven facts:";
    default:
      return "Court-safe framing:";
  }
}

function sourceAnchorText(finding: AgentFindingRecord): string[] {
  return safeJsonArray(finding.sourceAnchors)
    .map(anchor => {
      if (!anchor || typeof anchor !== "object") return "";
      const record = anchor as Record<string, unknown>;
      const fileName = sentence(String(record.fileName || "Source document"));
      const quote = sentence(String(record.quote || ""));
      const support = sentence(String(record.support || ""));
      const documentId = Number(record.documentId);
      const parts = [
        Number.isFinite(documentId) ? `Document #${documentId}` : null,
        quote
          ? `"${quote.slice(0, 420)}${quote.length > 420 ? "..." : ""}"`
          : null,
        support ? `Note: ${support}` : null,
      ].filter(Boolean);
      return `${fileName}${parts.length > 0 ? ` - ${parts.join(" - ")}` : ""}`;
    })
    .filter(Boolean);
}

function mandamusRouteForFinding(finding: AgentFindingRecord): MandamusRoute {
  return classifyMandamusRoute(finding);
}

function mandamusRelevantFindings(
  findings: AgentFindingRecord[]
): AgentFindingRecord[] {
  return findings.filter(isMandamusRelevantFinding);
}

function buildMandamusPetitionScaffold(findings: AgentFindingRecord[]): string {
  const mandamusFindings = mandamusRelevantFindings(findings);
  const fileNow = mandamusFindings.filter(
    finding => mandamusRouteForFinding(finding) === "file_now"
  );
  const demandFirst = mandamusFindings.filter(
    finding => mandamusRouteForFinding(finding) === "demand_records"
  );
  const preserve = mandamusFindings.filter(
    finding => mandamusRouteForFinding(finding) === "preserve_for_appeal"
  );
  const notMandamus = mandamusFindings.filter(
    finding => mandamusRouteForFinding(finding) === "not_mandamus"
  );
  const primary = fileNow[0] ?? demandFirst[0] ?? preserve[0] ?? notMandamus[0];

  if (!primary) {
    return [
      "### Petition Scaffold",
      "",
      "No petition scaffold was generated because no QC-cleared finding passed the mandamus relevance screen.",
      "Run the Mandamus / Writ Builder against processed source records, then regenerate this packet.",
    ].join("\n");
  }

  const route = mandamusRouteForFinding(primary);

  if (route === "not_mandamus") {
    return [
      "### Petition Scaffold",
      "",
      `- Current route label: ${mandamusRouteCode(route)}.`,
      `- Lead issue screened out: ${primary.title}.`,
      "- No writ petition scaffold should be generated from this finding alone.",
      "- Safer use: preserve the issue, demand the missing records, route it to appeal/habeas/ordinary motion practice, or reframe it as non-damages relief only if the record supplies a specific legal duty and narrow command.",
      "",
      "Guardrail: do not file a writ that asks the reviewing court to reweigh facts, decide ordinary merits, award damages, or treat frustration with the record as proof of misconduct.",
    ].join("\n");
  }

  const missingRecords = Array.from(
    new Set(
      mandamusFindings.flatMap(finding => safeListItems(finding.missingRecords))
    )
  ).slice(0, 12);
  const authorities = Array.from(
    new Set(
      mandamusFindings.flatMap(finding =>
        safeListItems(finding.legalAuthorities)
      )
    )
  ).slice(0, 8);
  const appendixItems = sourceAnchorText(primary).slice(0, 4);

  return [
    "### Petition Scaffold",
    "",
    `- Current route label: ${mandamusRouteCode(route)}.`,
    `- Primary writ issue: ${primary.title}.`,
    `- Issue presented: Whether extraordinary relief should issue to require the responsible court or officer to perform the specific legal duty identified in the record.`,
    `- Relief requested: Direct the responsible court or officer to rule, make required findings, accept or settle the record, hold the required proceeding, produce the missing record, or perform the narrow legal duty supported by the appendix.`,
    `- Statutory hook: NRS 34.160 and NRS 34.170, subject to verification against current Nevada authority before filing.`,
    `- Ordinary-remedy problem: ${sentence(primary.nextAction) || "Explain why appeal, later review, pending motion practice, or habeas is not plain, speedy, and adequate for this specific harm."}`,
    `- Appendix proof now available: ${appendixItems.length > 0 ? appendixItems.join("; ") : "No source anchor attached to the lead finding. Do not file until the order, docket entry, transcript, motion, notice, or other proof is attached."}`,
    `- Missing appendix records: ${missingRecords.length > 0 ? missingRecords.join("; ") : "None listed by the selected findings."}`,
    `- Authority list to verify: ${authorities.length > 0 ? authorities.join("; ") : "NRS 34.160; NRS 34.170; current Nevada writ authority."}`,
    `- Draft command language: Petitioner asks this Court to direct the responsible court or officer to perform the narrow act identified above, or alternatively to require written findings, production of the record, or a ruling sufficient for meaningful review.`,
    "",
    "Guardrail: do not ask the reviewing court to reweigh disputed facts, decide the merits of the underlying case, award damages, or treat a missing record as proven misconduct.",
  ].join("\n");
}

function mandamusFindingText(
  finding: AgentFindingRecord,
  index: number
): string {
  const missingRecords = safeListItems(finding.missingRecords);
  const anchors = sourceAnchorText(finding);
  const nextAction = sentence(finding.nextAction);
  const route = mandamusRouteForFinding(finding);

  return [
    `### ${index}. ${finding.title}`,
    "",
    `- Route label: ${mandamusRouteCode(route)}.`,
    `- Writ posture: ${sentence(finding.remedyPath) || "Needs writ-route classification."}`,
    `- Proof posture: ${proofPosture(finding)}.`,
    `- Confidence: ${finding.confidence}/100.`,
    `- Leverage: ${leverageLabel(finding.leverageScore)}.`,
    `- Clear-duty question: ${sentence(finding.summary) || "Identify the exact act the law allegedly required."}`,
    `- Adequate-remedy question: ${nextAction || "Explain why ordinary appeal, later review, or pending motion practice is not plain, speedy, and adequate."}`,
    `- Required appendix/support: ${anchors.length > 0 ? anchors.slice(0, 3).join("; ") : "Needs order, docket entry, minute order, transcript, notice, or other record support before filing."}`,
    `- Missing writ records: ${missingRecords.length > 0 ? missingRecords.join("; ") : "None listed."}`,
  ].join("\n");
}

function findingText(finding: AgentFindingRecord): string {
  const missingRecords = safeListItems(finding.missingRecords);
  const authorities = safeListItems(finding.legalAuthorities);
  const anchors = sourceAnchorText(finding);
  const qcLine =
    finding.qcStatus === "approved" || finding.qcStatus === "not_required"
      ? `QC status: ${humanize(finding.qcStatus)}.`
      : `QC status: ${humanize(finding.qcStatus)}${finding.qcReason ? ` - ${sentence(finding.qcReason)}` : ""}.`;

  return [
    `### ${finding.title}`,
    `**Proof posture:** ${proofPosture(finding)}.`,
    `**Leverage:** ${leverageLabel(finding.leverageScore)}. **Confidence:** ${finding.confidence}/100. **Severity:** ${humanize(finding.severity)}.`,
    `**Legal hook:** ${finding.liabilityVector || "Unclassified"}.`,
    `**Relief path:** ${finding.remedyPath || "Needs strategy review"}.`,
    `**${courtSafeLead(finding)}**`,
    "",
    sentence(finding.summary),
    "",
    "**Record support**",
    anchors.length > 0
      ? anchors.map(anchor => `- ${anchor}`).join("\n")
      : "- No verified source anchor is attached. Do not present this as a proven fact until support is added.",
    missingRecords.length > 0
      ? [
          "",
          "**Missing records / proof to demand**",
          ...missingRecords.map(record => `- ${record}`),
        ].join("\n")
      : "",
    authorities.length > 0
      ? [
          "",
          "**Authorities to verify before filing**",
          ...authorities.map(authority => `- ${authority}`),
        ].join("\n")
      : "",
    finding.nextAction
      ? ["", "**Recommended next action**", sentence(finding.nextAction)].join(
          "\n"
        )
      : "",
    "",
    `**Reliability note:** ${qcLine} Generated by ${finding.agentName || "DueProcess AI"}; preserve source citations before using in a filing.`,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildDeterministicExecutiveSummary(input: {
  scope: ReportScope;
  template: ReportTemplate;
  fromDate?: string;
  toDate?: string;
  minConfidence: number;
  selectedFindingIds?: number[];
  legacyAgentOutputsIncluded: boolean;
  legacyAgentOutputsAvailable: number;
  draftCommand?: DraftCommand;
  filingMetadata?: FilingMetadata;
  filingPlan: FilingPlan;
  documents: DocumentRecord[];
  findings: AgentFindingRecord[];
}): string {
  const readyDocuments = input.documents.filter(isDocumentReadyForAnalysis);
  const topFindings = input.findings
    .slice()
    .sort((left, right) => {
      const leverageDelta = right.leverageScore - left.leverageScore;
      return leverageDelta !== 0
        ? leverageDelta
        : right.confidence - left.confidence;
    })
    .slice(0, 5);
  const legalHooks = uniqueList(
    input.findings
      .map(finding => finding.liabilityVector)
      .filter((value): value is string => Boolean(value?.trim())),
    6
  );
  const missingRecords = uniqueList(
    input.findings.flatMap(finding => safeListItems(finding.missingRecords)),
    8
  );
  const authorities = uniqueList(
    input.findings.flatMap(finding => safeListItems(finding.legalAuthorities)),
    8
  );
  const nextActions = uniqueList(
    input.findings
      .map(finding => sentence(finding.nextAction))
      .filter((value): value is string => Boolean(value)),
    5
  );
  const scopeLine =
    input.scope === "time"
      ? `Scope is a case-era review from ${input.fromDate || "case start"} to ${input.toDate || "case end"}.`
      : input.scope === "files"
        ? `Scope is a selected-file packet using ${input.documents.length} source${input.documents.length === 1 ? "" : "s"}.`
        : `Scope is the whole selected case/workspace record using ${input.documents.length} source${input.documents.length === 1 ? "" : "s"}.`;
  const workProduct =
    input.draftCommand?.filingType ||
    input.filingMetadata?.filingTitle ||
    humanize(input.template);
  const findingLines =
    topFindings.length > 0
      ? topFindings.map(
          (finding, index) =>
            `${index + 1}. ${finding.title} - ${proofPosture(finding)}; confidence ${finding.confidence}/100; leverage ${leverageLabel(finding.leverageScore)}. ${sentence(finding.summary)}`
        )
      : [
          "No report-ready structured findings were available after the current scope and filters.",
        ];

  return [
    "### 1. Filing posture and requested work product",
    `${scopeLine} The requested work product is ${workProduct}. Filing readiness is ${humanize(input.filingPlan.readiness)} under the current Draft Director plan.`,
    input.selectedFindingIds && input.selectedFindingIds.length > 0
      ? `The packet is constrained to selected finding ID${input.selectedFindingIds.length === 1 ? "" : "s"}: ${input.selectedFindingIds.join(", ")}.`
      : "The packet is using all report-ready findings in scope.",
    input.legacyAgentOutputsIncluded
      ? "Legacy/freeform agent outputs are included by admin override and must be treated as reference material until source-checked."
      : `${input.legacyAgentOutputsAvailable} legacy/freeform agent output${input.legacyAgentOutputsAvailable === 1 ? " is" : "s are"} excluded by default.`,
    "",
    "### 2. What the record most strongly shows",
    findingLines.join("\n"),
    "",
    "### 3. Why it matters legally",
    legalHooks.length > 0
      ? `The report-ready legal hooks are: ${legalHooks.join("; ")}. These should be used as issue labels and proof routes, not as final conclusions until a human reviewer verifies elements, defenses, and current law.`
      : "No legal hook is strong enough to summarize without more structured findings.",
    authorities.length > 0
      ? `Authority leads to verify before filing: ${authorities.join("; ")}.`
      : "No authority lead is attached to the selected findings; add law verification before court-facing use.",
    "",
    "### 4. What is still missing or needs verification",
    missingRecords.length > 0
      ? missingRecords.map(record => `- ${record}`).join("\n")
      : "- No missing-record demand is attached to the selected findings. A human reviewer should still check the docket, transcripts, exhibits, service, deadlines, and local rules.",
    readyDocuments.length < input.documents.length
      ? `- ${input.documents.length - readyDocuments.length} selected source${input.documents.length - readyDocuments.length === 1 ? "" : "s"} are not analysis-ready.`
      : "- All selected sources are currently marked analysis-ready.",
    input.minConfidence > 0
      ? `- Minimum confidence filter is ${input.minConfidence}; confirm weaker but important issues were not accidentally filtered out.`
      : "- Minimum confidence filter is 0; low-confidence findings still require review before use.",
    "",
    "### 5. The top practical next moves",
    nextActions.length > 0
      ? nextActions.map((action, index) => `${index + 1}. ${action}`).join("\n")
      : "1. Run or rerun QC on the strongest issues.\n2. Add missing source anchors.\n3. Generate a source appendix before treating this as court-facing.",
    "",
    "_System note: the live editorial summary step was unavailable, so this executive summary was generated deterministically from QC/report-ready records. The rest of the report remains source-bound and still requires human legal review._",
  ].join("\n\n");
}

function topIssueLine(finding: AgentFindingRecord, index: number): string {
  return [
    `${index + 1}. **${finding.title}**`,
    `   - Posture: ${proofPosture(finding)}; leverage ${leverageLabel(finding.leverageScore)}; confidence ${finding.confidence}/100.`,
    `   - Legal hook: ${finding.liabilityVector || "Unclassified"}.`,
    `   - Relief path: ${finding.remedyPath || "Needs strategy review"}.`,
    finding.nextAction
      ? `   - Next move: ${sentence(finding.nextAction)}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function rankedFindings(
  findings: AgentFindingRecord[],
  limit: number
): AgentFindingRecord[] {
  return findings
    .slice()
    .sort((left, right) => {
      const leverageDelta = right.leverageScore - left.leverageScore;
      return leverageDelta !== 0
        ? leverageDelta
        : right.confidence - left.confidence;
    })
    .slice(0, limit);
}

function uniqueList(values: string[], limit: number): string[] {
  return Array.from(
    new Set(values.map(value => sentence(value)).filter(Boolean))
  ).slice(0, limit);
}

function reportReliefText(
  template: ReportTemplate,
  command: DraftCommand
): string {
  if (draftCommandHasContent(command) && command.requestedRelief) {
    return sentence(command.requestedRelief);
  }

  if (template === "mandamus_writ") {
    return "Identify the narrow command the reviewing court can issue: rule on a pending matter, make required findings, settle or produce the record, hold a required hearing, accept a filing, or perform another specific legal duty supported by the appendix.";
  }

  if (template === "discovery_demands") {
    return "Demand the specific missing records needed to prove or disprove each issue before stronger factual claims are used in a filing.";
  }

  if (template === "immunity_relief") {
    return "Separate damages claims from non-damages pathways such as mandamus, habeas, appeal, recusal, supervisory review, declaratory/prospective relief, Monell, and claims against nonimmune actors.";
  }

  if (template === "written_opinion") {
    return "State a source-bound recommended disposition for each issue, with the rule, record facts, adverse facts, and limits visible enough for human review.";
  }

  return "Use the QC-cleared findings to request only relief that is supported by source anchors, verified authority, and the current procedural posture.";
}

function buildCourtFacingReliefCalibration(data: {
  template: ReportTemplate;
  draftCommand?: DraftCommand;
  filingPlan?: FilingPlan;
  findings: AgentFindingRecord[];
}): string {
  const sourceAnchors = data.findings.reduce(
    (count, finding) => count + sourceAnchorText(finding).length,
    0
  );
  const lowConfidence = data.findings.filter(
    finding => finding.confidence > 0 && finding.confidence < 95
  );
  const missingRecords = uniqueList(
    data.findings.flatMap(finding => safeListItems(finding.missingRecords)),
    10
  );
  const adverseFacts = data.findings.filter(findingLooksAdverse);
  const relief = reportReliefText(data.template, data.draftCommand);
  const route =
    data.filingPlan?.routeLabel ||
    filingRouteLabel(data.template, data.draftCommand);
  const readiness = data.filingPlan?.readiness
    ? humanize(data.filingPlan.readiness)
    : "Needs Review";

  let safeAsk: string;
  let unsafeAsk: string;
  let proofGate: string;
  let posture: string;

  if (data.template === "mandamus_writ") {
    const mandamusFindings = mandamusRelevantFindings(data.findings);
    const routeCounts = mandamusFindings.reduce<Record<string, number>>(
      (counts, finding) => {
        const code = mandamusRouteCode(mandamusRouteForFinding(finding));
        counts[code] = (counts[code] ?? 0) + 1;
        return counts;
      },
      {}
    );
    safeAsk =
      "Ask for one narrow command: rule, make required findings, settle or produce the record, hold a required hearing, accept a filing, or perform another mandatory act.";
    unsafeAsk =
      "Do not use mandamus to seek damages, criminal punishment, judicial discipline, generalized misconduct findings, fact reweighing, or ordinary merits review.";
    proofGate =
      "Before export, the packet must prove clear legal duty, refusal or delay, beneficial interest, no plain/speedy/adequate ordinary remedy, and appendix proof.";
    posture = routeCounts.FILE_WRIT
      ? "Possible writ lane, but only after human review verifies the no-adequate-remedy and appendix gates."
      : routeCounts.DEMAND_RECORDS_FIRST
        ? "Records-first lane. Demand or obtain the missing appendix proof before presenting this as a writ."
        : routeCounts.PRESERVE_FOR_APPEAL
          ? "Preservation lane. Keep the issue alive for ordinary review unless new facts show extraordinary relief is necessary."
          : "No writ lane yet. Treat this as investigation, preservation, or records demand work.";
  } else if (data.template === "written_opinion") {
    safeAsk =
      "State only a source-bound disposition: grant, deny, defer, demand records, preserve, or no recommendation.";
    unsafeAsk =
      "Do not write final findings, credibility determinations, broad misconduct conclusions, or controlling-law holdings unless the record and authority actually support them.";
    proofGate =
      "Before export, every disposition needs a clean question presented, verified rule, source-bound facts, adverse-fact treatment, and current-law review.";
    posture =
      "Bench-memo lane. The output should read like disciplined judicial reasoning, not like advocacy trying to sound official.";
  } else if (data.template === "discovery_demands") {
    safeAsk =
      "Ask for specific missing records, custodians, date ranges, formats, preservation steps, and the reason each record matters.";
    unsafeAsk =
      "Do not treat missing records as proven misconduct. Use demand language until the records are produced or the absence is verified.";
    proofGate =
      "Before export, each demand should identify what should exist, who likely controls it, what issue it proves or narrows, and the source fact that makes the demand reasonable.";
    posture = "Records-first lane. The value is precision, not accusation.";
  } else {
    safeAsk =
      "Ask only for relief that matches the procedural vehicle, the selected record, and the forum's power.";
    unsafeAsk =
      "Do not mix damages, discipline, discovery, appeal, habeas, mandamus, and merits relief as if one court can grant everything at once.";
    proofGate =
      "Before export, verify source support, authority, adverse facts, preservation, deadline, caption, service, and local-rule requirements.";
    posture =
      "General court-facing lane. Human review must choose the actual filing vehicle before final drafting.";
  }

  const rows: Array<[string, string]> = [
    ["Route / readiness", `${route}. Readiness: ${readiness}.`],
    ["Safe ask", safeAsk],
    ["Do not ask for", unsafeAsk],
    ["Current requested relief", relief],
    ["Proof gate before export", proofGate],
    [
      "Source posture",
      `${sourceAnchors} source anchor${sourceAnchors === 1 ? "" : "s"} attached; ${missingRecords.length} missing-record target${missingRecords.length === 1 ? "" : "s"} listed; ${lowConfidence.length} finding${lowConfidence.length === 1 ? "" : "s"} below 95 confidence; ${adverseFacts.length} adverse-fact finding${adverseFacts.length === 1 ? "" : "s"} included.`,
    ],
    ["Human-facing posture", posture],
  ];

  return [
    "## Court-Facing Relief Calibration",
    "This section keeps the report from asking the wrong forum for the wrong remedy. It translates the analysis into what a court, agency, or reviewer can actually do with the present record.",
    "",
    "| Control | Calibration |",
    "| --- | --- |",
    ...rows.map(
      ([control, calibration]) => `| ${control} | ${tableCell(calibration)} |`
    ),
    "",
    "### Records That Control The Next Move",
    missingRecords.length > 0
      ? missingRecords
          .map((record, index) => `${index + 1}. ${record}`)
          .join("\n")
      : "No missing records were attached by the selected findings. A human reviewer should still confirm the appendix is complete before filing.",
  ].join("\n");
}

function opinionShortAnswer(
  finding: AgentFindingRecord,
  template: ReportTemplate
): string {
  if (template === "mandamus_writ" && isMandamusRelevantFinding(finding)) {
    const route = mandamusRouteCode(mandamusRouteForFinding(finding));
    if (route === "FILE_WRIT") {
      return "The finding may support extraordinary relief if human review confirms appendix proof, no adequate ordinary remedy, and a narrow command.";
    }
    if (route === "DEMAND_RECORDS_FIRST") {
      return "The safer answer is records-first: the issue may become writ-relevant, but the appendix is not strong enough to file as a writ yet.";
    }
    if (route === "PRESERVE_FOR_APPEAL") {
      return "The issue should be preserved for ordinary review unless additional proof shows that appeal or later review is inadequate.";
    }
    return "This issue should not be drafted as mandamus because it does not currently fit a narrow extraordinary-relief command.";
  }

  switch (finding.findingType) {
    case "record_supported":
    case "contradiction":
      return "The record supports a limited, source-bound argument, subject to final authority and citation review.";
    case "missing_record":
    case "missing_critical":
    case "suspicious_absence":
      return "The safer answer is a demand for missing records, not a factual accusation.";
    case "adverse_fact":
      return "This adverse fact must be addressed directly before any court-facing theory is filed.";
    case "legal_authority":
      return "This is an authority lead that should be verified and applied only to proven record facts.";
    default:
      return "This is an inference or strategy lead and should be framed cautiously unless additional source proof upgrades it.";
  }
}

function opinionDisposition(
  finding: AgentFindingRecord,
  template: ReportTemplate
): string {
  if (template === "mandamus_writ" && isMandamusRelevantFinding(finding)) {
    const route = mandamusRouteForFinding(finding);
    return `${mandamusRouteCode(route)}: ${mandamusRouteIntro(route)}`;
  }

  if (
    ["missing_record", "missing_critical", "suspicious_absence"].includes(
      finding.findingType
    )
  ) {
    return "Use as a records demand or discovery target before stronger pleading language.";
  }

  if (!sourceAnchorText(finding).length) {
    return "Do not use as a factual assertion until a source anchor is attached.";
  }

  if (finding.confidence > 0 && finding.confidence < 95) {
    return "Use only with visible caution language and human review because confidence is below 95.";
  }

  return "Eligible for report use, but authority, local rules, adverse facts, and citation format still need human review.";
}

function writtenOpinionFindingBlock(
  finding: AgentFindingRecord,
  index: number,
  template: ReportTemplate
): string {
  const anchors = sourceAnchorText(finding).slice(0, 4);
  const authorities = safeListItems(finding.legalAuthorities).slice(0, 6);
  const missingRecords = safeListItems(finding.missingRecords).slice(0, 8);
  const nextAction = sentence(finding.nextAction);

  return [
    `### Issue ${index}: ${finding.title}`,
    "",
    `**Question Presented.** Whether the selected record supports the following issue: ${finding.title}.`,
    "",
    `**Short Answer.** ${opinionShortAnswer(finding, template)}`,
    "",
    `**Rule / Legal Frame.** ${finding.liabilityVector || "No legal hook was attached; verify the governing statute, rule, doctrine, and standard of review before drafting."}`,
    authorities.length > 0
      ? `\nAuthorities to verify: ${authorities.join("; ")}.`
      : "\nNo authority list was attached to this issue.",
    "",
    "**Record Facts.**",
    anchors.length > 0
      ? anchors.map(anchor => `- ${anchor}`).join("\n")
      : "- No source anchor is attached. This cannot be used as a proven factual premise yet.",
    "",
    `**Application.** ${sentence(finding.summary) || "Apply only verified record facts to the governing rule."}`,
    "",
    "**Limits / Missing Proof.**",
    [
      `- Proof posture: ${proofPosture(finding)}.`,
      `- QC posture: ${humanize(finding.qcStatus)}${finding.qcReason ? ` - ${sentence(finding.qcReason)}` : ""}.`,
      `- Confidence: ${finding.confidence}/100; leverage: ${leverageLabel(finding.leverageScore)}.`,
      missingRecords.length > 0
        ? `- Missing records: ${missingRecords.join("; ")}.`
        : "- No missing records were attached to this finding.",
      nextAction ? `- Next action: ${nextAction}.` : null,
    ]
      .filter(Boolean)
      .join("\n"),
    "",
    `**Preliminary Disposition.** ${opinionDisposition(finding, template)}`,
  ].join("\n");
}

function buildWrittenOpinionAnalysis(data: {
  template: ReportTemplate;
  findings: AgentFindingRecord[];
}): string {
  const top = rankedFindings(data.findings, 4);

  if (top.length === 0) {
    return [
      "## Written Opinion Style Analysis",
      "No report-ready findings were available for written-opinion framing. Run analysis and QC before treating this packet as filing work product.",
    ].join("\n");
  }

  return [
    "## Written Opinion Style Analysis",
    "This section forces the packet into court-style reasoning: question presented, short answer, rule, record facts, application, limits, and disposition. It is not a judicial opinion and does not replace attorney review, but it keeps the output readable and disciplined.",
    "",
    top
      .map((finding, index) =>
        writtenOpinionFindingBlock(finding, index + 1, data.template)
      )
      .join("\n\n"),
  ].join("\n");
}

function buildOpinionBenchMemoControlSheet(data: {
  template: ReportTemplate;
  findings: AgentFindingRecord[];
}): string {
  if (data.template !== "written_opinion") return "";

  const top = rankedFindings(data.findings, 6);
  const adverseFacts = data.findings.filter(
    finding =>
      finding.findingType === "adverse_fact" ||
      sentence(finding.title).toLowerCase().includes("adverse") ||
      sentence(finding.summary).toLowerCase().includes("adverse")
  );
  const missingRecords = uniqueList(
    top.flatMap(finding => safeListItems(finding.missingRecords)),
    10
  );
  const authorityLeads = uniqueList(
    top.flatMap(finding => safeListItems(finding.legalAuthorities)),
    10
  );

  const issueRows =
    top.length > 0
      ? top.map((finding, index) =>
          [
            `${index + 1}. **${finding.title}**`,
            `   - Holding posture: ${opinionShortAnswer(finding, data.template)}`,
            `   - Standard / rule to verify: ${standardOfReviewCue(finding, data.template)}`,
            `   - Disposition: ${opinionDisposition(finding, data.template)}`,
          ].join("\n")
        )
      : [
          "1. No report-ready issues are available. Run analysis and QC before using the written-opinion route.",
        ];

  return [
    "## Opinion Bench Memo Control Sheet",
    "Use this section as the judge-style editor pass. It keeps the packet from becoming argument soup by forcing each issue into holding posture, rule verification, record limits, and disposition.",
    "",
    "### Proposed Holdings / Dispositions",
    issueRows.join("\n"),
    "",
    "### Authority And Rule Verification",
    authorityLeads.length > 0
      ? authorityLeads.map((item, index) => `${index + 1}. ${item}`).join("\n")
      : "1. No authority leads are attached. Verify controlling statutes, rules, standards of review, and cases before treating this as court-facing work.",
    "",
    "### Adverse Facts And Limits",
    adverseFacts.length > 0
      ? adverseFacts
          .slice(0, 6)
          .map(
            (finding, index) =>
              `${index + 1}. ${finding.title} - ${sentence(finding.summary)}`
          )
          .join("\n")
      : "1. No adverse-fact findings are included. A human reviewer should add the strongest counterfacts before this reads like a real opinion.",
    "",
    "### Records That Keep The Opinion From Overreaching",
    missingRecords.length > 0
      ? missingRecords.map((item, index) => `${index + 1}. ${item}`).join("\n")
      : "1. No missing records were attached by the selected findings. Human review should still confirm the source appendix is complete.",
  ].join("\n");
}

function tableCell(value: string): string {
  return sentence(value).replace(/\|/g, "/").replace(/\n+/g, " ").trim();
}

function standardOfReviewCue(
  finding: AgentFindingRecord,
  template: ReportTemplate
): string {
  const text = [
    finding.title,
    finding.summary,
    finding.liabilityVector,
    finding.remedyPath,
  ]
    .map(value => sentence(value).toLowerCase())
    .join(" ");
  const authorities = safeListItems(finding.legalAuthorities).slice(0, 3);

  if (template === "mandamus_writ" && isMandamusRelevantFinding(finding)) {
    return "Extraordinary writ standard; verify clear legal duty, beneficial interest, no plain/speedy/adequate remedy, and NRS 34.160 / NRS 34.170 or controlling writ authority.";
  }
  if (/brady|napue|giglio|discovery|exculpatory|impeachment/.test(text)) {
    return "Brady/Napue/Giglio/discovery standard; verify suppression, materiality, falsity or knowledge elements, prejudice, and remedy.";
  }
  if (
    /search|seizure|gps|tracker|warrant|fourth amendment|suppress/.test(text)
  ) {
    return "Fourth Amendment / suppression standard; verify warrant, probable cause, exception, standing, chain of custody, and remedy.";
  }
  if (/speedy|delay|barker|trial clock/.test(text)) {
    return "Speedy-trial standard; verify delay length, reason, assertion, prejudice, statutory clock, and remedy.";
  }
  if (/competency|drope|mental|evaluation|178\.4/.test(text)) {
    return "Competency-procedure standard; verify triggering evidence, statutory procedure, findings, evaluations, and due-process prejudice.";
  }
  if (/monell|policy|custom|train|supervis|ratification|municipal/.test(text)) {
    return "Monell standard; verify policy/custom, deliberate indifference, policymaker notice/ratification, causation, and damages.";
  }
  if (/immunity|judicial|prosecutorial|qualified|absolute/.test(text)) {
    return "Immunity standard; verify actor function, damages versus non-damages relief, nonimmune conduct, and available remedy path.";
  }
  if (
    /appeal|appellate|standard of review|abuse of discretion|de novo/.test(text)
  ) {
    return "Appellate standard; verify preservation, standard of review, harmless-error/prejudice posture, and record citations.";
  }
  if (authorities.length > 0) {
    return `Authority-led issue; verify ${authorities.join("; ")} and connect each rule to source-bound facts.`;
  }
  return "Needs legal standard verification; identify governing statute, rule, standard of review, elements, and remedy before drafting.";
}

function preservationPosture(finding: AgentFindingRecord): string {
  const missingRecords = safeListItems(finding.missingRecords);
  const anchors = sourceAnchorText(finding);
  const text = [
    finding.title,
    finding.summary,
    finding.nextAction,
    finding.qcReason,
  ]
    .map(value => sentence(value).toLowerCase())
    .join(" ");

  if (finding.findingType === "adverse_fact") {
    return "Adverse fact; address directly before filing and verify whether it limits preservation, prejudice, or remedy.";
  }
  if (missingRecords.length > 0) {
    return `Record incomplete; demand ${missingRecords.slice(0, 3).join("; ")} before relying on stronger language.`;
  }
  if (anchors.length === 0) {
    return "No source anchor; not preserved for factual use until tied to an order, transcript, filing, exhibit, or docket entry.";
  }
  if (
    /object|objection|preserv|raised|filed|motion|notice|transcript|docket|order/.test(
      text
    )
  ) {
    return "Potentially preserved; verify docket entry, objection, motion, order, transcript, and deadline posture.";
  }
  if (/waiver|moot|untimely|forfeit|procedural default/.test(text)) {
    return "Preservation risk; verify waiver, mootness, timeliness, procedural default, and available exception.";
  }
  return "Source-supported but preservation needs human review: identify where the issue was raised, ruled on, or made reviewable.";
}

function sourceUseCue(finding: AgentFindingRecord): string {
  const anchors = sourceAnchorText(finding);
  const missingRecords = safeListItems(finding.missingRecords);

  if (anchors.length > 0 && missingRecords.length === 0) {
    return `${anchors.length} anchor${anchors.length === 1 ? "" : "s"}; usable with citation verification.`;
  }
  if (anchors.length > 0) {
    return `${anchors.length} anchor${anchors.length === 1 ? "" : "s"} plus ${missingRecords.length} missing record demand${missingRecords.length === 1 ? "" : "s"}.`;
  }
  if (missingRecords.length > 0) {
    return `No anchor; records-first demand: ${missingRecords.slice(0, 2).join("; ")}.`;
  }
  return "No anchor and no missing-record demand; hold out of court-facing factual use.";
}

function filingUseCue(
  finding: AgentFindingRecord,
  template: ReportTemplate
): string {
  if (template === "mandamus_writ" && isMandamusRelevantFinding(finding)) {
    const route = mandamusRouteForFinding(finding);
    return `${mandamusRouteCode(route)} - ${mandamusRouteAction(route)}`;
  }
  if (finding.qcStatus === "blocked") {
    return "Blocked from report use unless admin override is explicit and visible.";
  }
  if (
    finding.findingType === "missing_record" ||
    finding.findingType === "missing_critical"
  ) {
    return "Use as demand language, not as proven misconduct.";
  }
  if (finding.confidence > 0 && finding.confidence < 95) {
    return "Use with caution language and human review.";
  }
  if (finding.findingType === "legal_authority") {
    return "Use as authority lead only after verification.";
  }
  return "Use as source-bound issue framing, subject to citation and local-rule review.";
}

function buildIssueStandardPreservationMatrix(data: {
  template: ReportTemplate;
  findings: AgentFindingRecord[];
}): string {
  const top = rankedFindings(data.findings, 6);

  if (top.length === 0) {
    return [
      "## Issue / Standard / Preservation Matrix",
      "No report-ready findings were available for appellate-style issue routing.",
    ].join("\n");
  }

  const rows = top.map(finding => [
    finding.title,
    standardOfReviewCue(finding, data.template),
    preservationPosture(finding),
    sourceUseCue(finding),
    filingUseCue(finding, data.template),
  ]);

  return [
    "## Issue / Standard / Preservation Matrix",
    "This matrix is the appellate-quality control layer. It ties each lead issue to the legal standard that must be verified, the preservation posture, the current source support, and the safe filing use.",
    "",
    "| Issue | Standard / authority to verify | Preservation / record posture | Source status | Filing use |",
    "| --- | --- | --- | --- | --- |",
    ...rows.map(row => `| ${row.map(cell => tableCell(cell)).join(" | ")} |`),
  ].join("\n");
}

type PolishChecklistStatus = "ready" | "needs review" | "blocked";

type PolishChecklistRow = {
  label: string;
  status: PolishChecklistStatus;
  requirement: string;
  current: string;
};

function polishStatus(
  condition: boolean,
  partial: boolean = false
): PolishChecklistStatus {
  if (condition) return partial ? "needs review" : "ready";
  return "blocked";
}

function renderPolishChecklistRows(rows: PolishChecklistRow[]): string {
  return [
    "| Gate | Status | What must be true before export or filing | Current record posture |",
    "| --- | --- | --- | --- |",
    ...rows.map(
      row =>
        `| ${tableCell(row.label)} | ${row.status.toUpperCase()} | ${tableCell(row.requirement)} | ${tableCell(row.current)} |`
    ),
  ].join("\n");
}

function findingLooksAdverse(finding: AgentFindingRecord): boolean {
  return (
    finding.findingType === "adverse_fact" ||
    sentence(finding.title).toLowerCase().includes("adverse") ||
    sentence(finding.summary).toLowerCase().includes("adverse")
  );
}

function buildAppellateWritPolishChecklist(data: {
  template: ReportTemplate;
  draftCommand?: DraftCommand;
  filingMetadata?: FilingMetadata;
  documents: DocumentRecord[];
  findings: AgentFindingRecord[];
}): string {
  const top = rankedFindings(data.findings, 5);
  const commandMissing = filingCommandMissingFields(data.draftCommand);
  const captionMissing = filingCaptionMissingFields(data.filingMetadata);
  const readyDocuments = data.documents.filter(isDocumentReadyForAnalysis);
  const missingHashes = data.documents.filter(
    document => !document.documentHash
  );
  const anchoredFindings = data.findings.filter(
    finding => sourceAnchorText(finding).length > 0
  );
  const authorityFindings = data.findings.filter(
    finding => safeListItems(finding.legalAuthorities).length > 0
  );
  const lowConfidence = data.findings.filter(
    finding => finding.confidence > 0 && finding.confidence < 95
  );
  const adverseFacts = data.findings.filter(findingLooksAdverse);
  const issueCount =
    draftCommandHasContent(data.draftCommand) &&
    data.draftCommand.keyIssues?.length
      ? data.draftCommand.keyIssues.length
      : top.length;
  const relief = reportReliefText(data.template, data.draftCommand);
  const sourceAnchorCount = data.findings.reduce(
    (count, finding) => count + sourceAnchorText(finding).length,
    0
  );
  const title =
    data.template === "mandamus_writ"
      ? "## Appellate / Writ Polish Checklist"
      : data.template === "written_opinion"
        ? "## Written-Opinion Polish Checklist"
        : "## Appellate Polish Checklist";
  const baseRows: PolishChecklistRow[] = [
    {
      label: "Question Presented",
      status: polishStatus(issueCount > 0, true),
      requirement:
        "The lead question must be narrow, answerable from the selected record, and tied to the requested relief.",
      current:
        issueCount > 0
          ? `${issueCount} issue cue${issueCount === 1 ? "" : "s"} available for question-presented drafting.`
          : "No issue cue is available yet.",
    },
    {
      label: "Standard of Review / Authority",
      status: authorityFindings.length > 0 ? "needs review" : "blocked",
      requirement:
        "Controlling statutes, rules, standards of review, and cases must be verified against current law before court use.",
      current:
        authorityFindings.length > 0
          ? `${authorityFindings.length} finding${authorityFindings.length === 1 ? "" : "s"} include authority leads; verify current law.`
          : "No authority lead is attached to the selected findings.",
    },
    {
      label: "Preservation / Record Posture",
      status: anchoredFindings.length > 0 ? "needs review" : "blocked",
      requirement:
        "The packet must identify where each issue was raised, ruled on, refused, delayed, or made reviewable.",
      current:
        anchoredFindings.length > 0
          ? `${anchoredFindings.length}/${data.findings.length} finding${data.findings.length === 1 ? "" : "s"} include source anchors.`
          : "No finding has source anchors yet.",
    },
    {
      label: "Record Statement",
      status:
        data.documents.length > 0 &&
        readyDocuments.length === data.documents.length &&
        missingHashes.length === 0
          ? "ready"
          : data.documents.length > 0
            ? "needs review"
            : "blocked",
      requirement:
        "Every factual paragraph must be supported by analysis-ready source documents with stable hashes and appendix-ready labels.",
      current:
        data.documents.length > 0
          ? `${readyDocuments.length}/${data.documents.length} source${data.documents.length === 1 ? "" : "s"} analysis-ready; ${missingHashes.length} missing hash${missingHashes.length === 1 ? "" : "es"}.`
          : "No source document is selected.",
    },
    {
      label: "Adverse Facts",
      status: adverseFacts.length > 0 ? "ready" : "needs review",
      requirement:
        "The draft must surface the strongest counterfacts, limits, waiver risks, and harmless-error arguments before it sounds court-ready.",
      current:
        adverseFacts.length > 0
          ? `${adverseFacts.length} adverse-fact finding${adverseFacts.length === 1 ? "" : "s"} selected.`
          : "No adverse-fact finding is selected; human review must add the ugly facts.",
    },
    {
      label: "Relief / Exact Command",
      status:
        commandMissing.includes("requested relief") &&
        data.template !== "mandamus_writ"
          ? "blocked"
          : "needs review",
      requirement:
        "The requested relief must match the procedural vehicle and stay inside what the court or recipient can actually order.",
      current: relief,
    },
    {
      label: "Appendix / Source Proof",
      status:
        sourceAnchorCount > 0 &&
        readyDocuments.length === data.documents.length &&
        missingHashes.length === 0
          ? "ready"
          : sourceAnchorCount > 0
            ? "needs review"
            : "blocked",
      requirement:
        "Quotes, exhibits, page references, and document hashes must let a reviewer check every important fact without trusting the model.",
      current:
        sourceAnchorCount > 0
          ? `${sourceAnchorCount} source anchor${sourceAnchorCount === 1 ? "" : "s"} attached.`
          : "No source anchors are attached.",
    },
    {
      label: "Human Review / Current Law",
      status: "needs review",
      requirement:
        "A human must verify current law, jurisdictional rules, deadlines, service, format, local practice, and strategic risk before filing.",
      current:
        lowConfidence.length > 0
          ? `${lowConfidence.length} finding${lowConfidence.length === 1 ? "" : "s"} below 95 confidence must be reviewed or downgraded.`
          : "No selected finding is below 95 confidence; legal and formatting review is still required.",
    },
  ];

  const writtenOpinionRows: PolishChecklistRow[] =
    data.template === "written_opinion"
      ? [
          {
            label: "Rule Statement",
            status: authorityFindings.length > 0 ? "needs review" : "blocked",
            requirement:
              "The rule statement must separate binding law, persuasive authority, statutory text, and factual application.",
            current:
              authorityFindings.length > 0
                ? "Authority leads exist but still need verification and hierarchy."
                : "No authority lead exists for a rule statement.",
          },
          {
            label: "Recommended Disposition",
            status: issueCount > 0 ? "needs review" : "blocked",
            requirement:
              "Each issue should end with grant, deny, demand records, preserve, or no recommendation, with limits stated plainly.",
            current:
              top.length > 0
                ? `${top.length} ranked issue${top.length === 1 ? "" : "s"} available for disposition drafting.`
                : "No ranked issue is available.",
          },
        ]
      : [];

  const mandamusFindings = mandamusRelevantFindings(data.findings);
  const mandamusAssessments = mandamusFindings.map(assessMandamusFinding);
  const hasClearDuty = mandamusAssessments.some(
    assessment => assessment.hasClearDutySignal
  );
  const hasRefusalOrDelay = mandamusAssessments.some(
    assessment => assessment.hasRefusalOrDelaySignal
  );
  const hasAdequateRemedy = mandamusAssessments.some(
    assessment => assessment.hasNoAdequateRemedySignal
  );
  const hasNarrowCommand = mandamusAssessments.some(
    assessment => assessment.hasNarrowCommandSignal
  );
  const mandamusFileNow = mandamusFindings.filter(
    finding => mandamusRouteForFinding(finding) === "file_now"
  ).length;
  const mandamusDemandFirst = mandamusFindings.filter(
    finding => mandamusRouteForFinding(finding) === "demand_records"
  ).length;
  const mandamusRows: PolishChecklistRow[] =
    data.template === "mandamus_writ"
      ? [
          {
            label: "Clear Legal Duty",
            status: hasClearDuty ? "needs review" : "blocked",
            requirement:
              "Name the mandatory legal act, order, rule, statute, or nondiscretionary duty the respondent failed to perform.",
            current: hasClearDuty
              ? "The selected findings contain duty language; verify the exact source of the duty."
              : "No clear-duty signal was found.",
          },
          {
            label: "Refusal Or Delay",
            status: hasRefusalOrDelay ? "needs review" : "blocked",
            requirement:
              "Show the filing, request, docket entry, order, transcript, or notice proving refusal, non-ruling, delay, or failure to act.",
            current: hasRefusalOrDelay
              ? "The selected findings contain refusal or delay language."
              : "No refusal or delay signal was found.",
          },
          {
            label: "No Adequate Ordinary Remedy",
            status: hasAdequateRemedy ? "needs review" : "blocked",
            requirement:
              "Explain why appeal, another motion, habeas, or ordinary review is not plain, speedy, and adequate for this harm.",
            current: hasAdequateRemedy
              ? "The packet flags ordinary-remedy risk for human review."
              : "No no-adequate-remedy signal was found.",
          },
          {
            label: "Narrow Command",
            status: hasNarrowCommand ? "needs review" : "blocked",
            requirement:
              "Ask only for a command the reviewing court can issue without deciding damages, reweighing facts, or doing ordinary appeal work.",
            current: hasNarrowCommand
              ? "The selected findings contain command language; tighten it before export."
              : "No narrow command has been stated.",
          },
          {
            label: "Not Substitute For Appeal",
            status: mandamusFileNow > 0 ? "needs review" : "blocked",
            requirement:
              "The writ theory must not be ordinary merits review dressed up as emergency relief.",
            current:
              mandamusFileNow > 0
                ? `${mandamusFileNow} FILE_WRIT route candidate${mandamusFileNow === 1 ? "" : "s"} detected.`
                : mandamusDemandFirst > 0
                  ? `${mandamusDemandFirst} issue${mandamusDemandFirst === 1 ? "" : "s"} should demand records first.`
                  : "No FILE_WRIT route candidate was detected.",
          },
        ]
      : [];

  const rows =
    data.template === "mandamus_writ"
      ? [...baseRows, ...mandamusRows]
      : [...baseRows, ...writtenOpinionRows];

  return [
    title,
    "This is the final polish gate before a human turns the packet into a filing. It is intentionally hard on the draft: appellate-quality and mandamus-quality output requires a clean question, verified rule, preserved record posture, source proof, adverse-fact review, and exact relief.",
    "",
    renderPolishChecklistRows(rows),
  ].join("\n");
}

function buildCourtDraftBlueprint(data: {
  template: ReportTemplate;
  draftCommand?: DraftCommand;
  findings: AgentFindingRecord[];
}): string {
  const top = rankedFindings(data.findings, 5);
  const command = data.draftCommand;
  const commandIssues =
    draftCommandHasContent(command) && command.keyIssues
      ? uniqueList(command.keyIssues, 8)
      : [];
  const issueLines =
    commandIssues.length > 0
      ? commandIssues.map((issue, index) => `${index + 1}. ${issue}`)
      : top.length > 0
        ? top.map((finding, index) => `${index + 1}. ${finding.title}`)
        : [
            "1. No report-ready issue has been selected yet. Run analysis and QC before drafting.",
          ];
  const authorities = uniqueList(
    top.flatMap(finding => safeListItems(finding.legalAuthorities)),
    10
  );
  const recordSupport = uniqueList(
    top.flatMap(finding => sourceAnchorText(finding).slice(0, 2)),
    10
  );
  const missingRecords = uniqueList(
    top.flatMap(finding => safeListItems(finding.missingRecords)),
    10
  );
  const adverseFacts = data.findings
    .filter(
      finding =>
        finding.findingType === "adverse_fact" ||
        sentence(finding.title).toLowerCase().includes("adverse") ||
        sentence(finding.summary).toLowerCase().includes("adverse")
    )
    .slice(0, 5);
  const roadmap =
    top.length > 0
      ? top.map((finding, index) =>
          [
            `${index + 1}. **${finding.title}**`,
            `   - Rule/use: ${finding.liabilityVector || "Needs legal hook verification"}.`,
            `   - Application: ${sentence(finding.summary) || "Use only verified record support."}`,
            `   - Limit: ${finding.qcStatus === "approved" ? "QC approved, but source citations still need final human review." : `QC ${humanize(finding.qcStatus)}${finding.qcReason ? ` - ${sentence(finding.qcReason)}` : ""}.`}`,
          ].join("\n")
        )
      : [
          "1. No argument roadmap is available until report-ready findings exist.",
        ];

  return [
    "## Court-Ready Drafting Blueprint",
    "This section is the bridge from analysis to filing. It is intentionally conservative: it frames issues, record support, authority needs, limits, and relief without treating unsupported gaps as proven facts.",
    "",
    "### Questions Presented / Issues For Review",
    issueLines.join("\n"),
    "",
    "### Governing Standards And Authorities To Verify",
    authorities.length > 0
      ? authorities.map(authority => `- ${authority}`).join("\n")
      : "- No verified authority list was attached to the selected findings. Verify statutes, rules, standards of review, and controlling cases before filing.",
    "",
    "### Record Facts To Lead With",
    recordSupport.length > 0
      ? recordSupport.map(anchor => `- ${anchor}`).join("\n")
      : "- No source anchors were available in the top findings. Do not draft factual assertions until source support is attached.",
    "",
    "### Argument Roadmap",
    roadmap.join("\n\n"),
    "",
    "### Adverse Facts, Limits, And Missing Proof",
    adverseFacts.length > 0
      ? adverseFacts
          .map(
            (finding, index) =>
              `${index + 1}. **${finding.title}** - ${sentence(finding.summary) || "Review adverse posture before filing."}`
          )
          .join("\n")
      : "- No adverse-fact finding was selected. A human reviewer should still identify contrary record facts before filing.",
    missingRecords.length > 0
      ? [
          "",
          "**Missing records that should shape the draft:**",
          ...missingRecords.map(record => `- ${record}`),
        ].join("\n")
      : "",
    "",
    "### Relief / Order Requested",
    reportReliefText(data.template, command),
    "",
    "### Drafting Guardrails",
    "- Use record-supported facts as facts.",
    "- Use allegations as allegations.",
    "- Use missing records as demands or proof gaps.",
    "- Use inferences only when labeled and tied to source facts.",
    "- Mark legal authorities for verification unless the authority status is already verified.",
  ]
    .filter(Boolean)
    .join("\n");
}

function filingCaptionMissingFields(metadata: FilingMetadata): string[] {
  if (!filingMetadataHasContent(metadata)) {
    return ["court", "case number", "parties", "filing title"];
  }

  const missing: string[] = [];
  const hasParty =
    metadata.petitioner ||
    metadata.respondent ||
    metadata.plaintiff ||
    metadata.defendant;
  if (!metadata.courtName && !metadata.jurisdiction) missing.push("court");
  if (!metadata.caseNumber) missing.push("case number");
  if (!hasParty) missing.push("parties");
  if (!metadata.filingTitle) missing.push("filing title");
  return missing;
}

function filingCommandMissingFields(command: DraftCommand): string[] {
  if (!draftCommandHasContent(command)) {
    return [
      "filing type",
      "response target",
      "requested relief",
      "priority issues",
    ];
  }

  const missing: string[] = [];
  if (!command.filingType) missing.push("filing type");
  if (!command.respondingTo) missing.push("response target");
  if (!command.requestedRelief) missing.push("requested relief");
  if (!command.keyIssues?.length) missing.push("priority issues");
  return missing;
}

function filingRouteLabel(template: ReportTemplate, command: DraftCommand) {
  if (draftCommandHasContent(command) && command.filingType) {
    return command.filingType;
  }

  switch (template) {
    case "mandamus_writ":
      return "Mandamus / extraordinary writ route";
    case "discovery_demands":
      return "Discovery and missing-records route";
    case "source_appendix":
      return "Source appendix route";
    case "evidence_chronology":
      return "Timeline and gap-map route";
    case "immunity_relief":
      return "Immunity and relief-pathway route";
    case "case_strategy":
      return "Appellate strategy route";
    case "written_opinion":
      return "Opinion-style bench memo route";
    case "executive_summary":
      return "Reviewer briefing route";
    case "court_packet":
    default:
      return "Court packet route";
  }
}

function templateProofRequirements(template: ReportTemplate): string[] {
  switch (template) {
    case "mandamus_writ":
      return [
        "clear legal duty or required act",
        "record proof of refusal, failure, or delay",
        "no plain, speedy, adequate ordinary remedy",
        "beneficial interest or standing",
        "appendix proof for the narrow command",
      ];
    case "discovery_demands":
      return [
        "exact missing record name",
        "likely custodian or source",
        "why the record should exist",
        "what the record proves or disproves",
        "demand language that avoids treating absence as proof",
      ];
    case "source_appendix":
      return [
        "document IDs and filenames",
        "source hashes or extraction status",
        "quoted support where available",
        "linked finding IDs",
        "QC and filing-readiness warnings",
      ];
    case "evidence_chronology":
      return [
        "dated source events",
        "actor attribution",
        "document anchors",
        "contradictions separated from inferences",
        "gap list for follow-up demands",
      ];
    case "immunity_relief":
      return [
        "actor role and function",
        "damages immunity risk",
        "non-damages relief path",
        "nonimmune conduct or actor",
        "records needed to route around immunity safely",
      ];
    case "case_strategy":
      return [
        "preserved issue",
        "standard of review",
        "record citations",
        "adverse facts",
        "relief path and risk ranking",
      ];
    case "written_opinion":
      return [
        "question presented",
        "governing rule or authority to verify",
        "source-bound record facts",
        "adverse facts and limits",
        "recommended disposition",
      ];
    case "executive_summary":
      return [
        "strongest record facts",
        "top risks",
        "missing proof",
        "plain-English next action",
      ];
    case "court_packet":
    default:
      return [
        "QC-cleared facts",
        "legal theory or rule to verify",
        "adverse facts",
        "source appendix",
        "specific relief requested",
      ];
  }
}

function templateNextQuestions(template: ReportTemplate): string[] {
  switch (template) {
    case "mandamus_writ":
      return [
        "What exact legal act should the court compel or prohibit?",
        "Which source record proves the duty was mandatory rather than discretionary?",
        "What date, docket entry, transcript, or order proves refusal, delay, or failure to act?",
        "Why is ordinary appeal, motion practice, habeas, or later review not plain, speedy, and adequate?",
        "Which appendix documents prove the narrow command without asking the reviewing court to reweigh facts?",
      ];
    case "written_opinion":
      return [
        "What is the clean question presented for the lead issue?",
        "What governing rule, statute, standard, or authority must be verified before the analysis is court-facing?",
        "Which source-bound facts belong in findings of fact, and which facts are merely allegations or inferences?",
        "What adverse facts or procedural limits must the opinion-style memo address?",
        "What recommended disposition should the memo reach if the record stays exactly as it is?",
      ];
    case "case_strategy":
      return [
        "Which issues are preserved, waived, forfeited, or still record-dependent?",
        "What standard of review controls each issue?",
        "What is the safest relief path for each issue: motion, appeal, habeas, writ, discovery demand, recusal, or civil-rights claim?",
        "What adverse facts would the opposing side lead with?",
      ];
    case "court_packet":
      return [
        "What specific motion, order, filing, or government position is this packet answering?",
        "What relief should the court grant, deny, modify, compel, or preserve?",
        "Which exhibits must be attached to make the factual section self-checking?",
        "What proposed-order language should a human draft after verifying the record?",
      ];
    case "discovery_demands":
      return [
        "Who likely possesses each missing record?",
        "Why should each record exist at this stage of the case?",
        "What would each record prove, disprove, or narrow?",
        "Which demand must be phrased as records-first instead of accusation-first?",
      ];
    case "source_appendix":
      return [
        "Which documents should be included in the appendix and which should stay out?",
        "Which quotes need page, line, exhibit, or hash verification before export?",
        "Which findings link to each source document?",
        "What warning should appear for low-confidence, blocked, or missing-source material?",
      ];
    case "evidence_chronology":
      return [
        "What date range controls the timeline?",
        "Which actors must be tracked across every event?",
        "Which contradictions are record-supported and which are only gaps?",
        "What missing record would confirm or falsify the most important timeline inference?",
      ];
    case "immunity_relief":
      return [
        "Which actor was performing which function at the time of each challenged act?",
        "Which requests seek damages, and which seek non-damages relief?",
        "What nonjudicial, investigative, administrative, municipal, or prospective-relief route remains open?",
        "What record would prove policymaker notice, ratification, custom, or failure to train?",
      ];
    case "executive_summary":
      return [
        "Who is the skim brief for: pro se user, attorney, investigator, journalist, clinic reviewer, or funder?",
        "What decision should the reader make after reading it?",
        "Which claim is strongest, which is riskiest, and what record is missing?",
      ];
  }
}

function buildFilingPlan(input: {
  template: ReportTemplate;
  draftCommand?: DraftCommand;
  filingMetadata?: FilingMetadata;
  documents?: DocumentRecord[];
  findings?: AgentFindingRecord[];
  warnings?: string[];
}): FilingPlan {
  const commandMissing = filingCommandMissingFields(input.draftCommand);
  const captionMissing = filingCaptionMissingFields(input.filingMetadata);
  const documentsInScope = input.documents ?? [];
  const findingsInScope = input.findings ?? [];
  const blockedSources = documentsInScope.filter(
    document => !isDocumentReadyForAnalysis(document)
  );
  const anchoredFindings = findingsInScope.filter(
    finding => sourceAnchorText(finding).length > 0
  );
  const lowConfidence = findingsInScope.filter(
    finding => finding.confidence > 0 && finding.confidence < 95
  );
  const authorityCount = findingsInScope.filter(
    finding => safeListItems(finding.legalAuthorities).length > 0
  ).length;
  const adverseCount = findingsInScope.filter(
    finding =>
      finding.findingType === "adverse_fact" ||
      sentence(finding.title).toLowerCase().includes("adverse") ||
      sentence(finding.summary).toLowerCase().includes("adverse")
  ).length;
  const mandamusFindings = mandamusRelevantFindings(findingsInScope);
  const mandamusFileNow = mandamusFindings.filter(
    finding => mandamusRouteForFinding(finding) === "file_now"
  ).length;
  const mandamusDemandFirst = mandamusFindings.filter(
    finding => mandamusRouteForFinding(finding) === "demand_records"
  ).length;
  const allMissing = [...commandMissing, ...captionMissing];
  const routeLabel = filingRouteLabel(input.template, input.draftCommand);
  const missingRecords = uniqueList(
    findingsInScope.flatMap(finding => safeListItems(finding.missingRecords)),
    8
  );
  const topFindings = rankedFindings(findingsInScope, 4);
  const commandIssues =
    draftCommandHasContent(input.draftCommand) && input.draftCommand.keyIssues
      ? uniqueList(input.draftCommand.keyIssues, 5)
      : [];
  const issueArchitecture =
    commandIssues.length > 0
      ? commandIssues.map(issue => ({
          label: issue,
          status: "command issue",
          detail:
            "Use this as a heading only after matching it to a QC-cleared source fact, standard of review, and requested relief.",
        }))
      : topFindings.map(finding => ({
          label: finding.title,
          status: proofPosture(finding),
          detail:
            sentence(finding.summary).slice(0, 520) ||
            "Use this issue only with source support and human review.",
        }));
  const baseWarnings = [
    ...(input.warnings ?? []),
    blockedSources.length > 0
      ? `${blockedSources.length} source document${blockedSources.length === 1 ? "" : "s"} are not analysis-ready.`
      : null,
    findingsInScope.length > 0 &&
    anchoredFindings.length < findingsInScope.length
      ? `${findingsInScope.length - anchoredFindings.length} finding${findingsInScope.length - anchoredFindings.length === 1 ? "" : "s"} need source anchors or downgrade language.`
      : null,
    lowConfidence.length > 0
      ? `${lowConfidence.length} finding${lowConfidence.length === 1 ? "" : "s"} are below 95 confidence and require caution language.`
      : null,
    authorityCount === 0 && findingsInScope.length > 0
      ? "No authority leads are attached to the current findings; verify governing law before filing."
      : null,
    adverseCount === 0 && findingsInScope.length > 0
      ? "No adverse-fact finding is in scope; human review should identify contrary facts before filing."
      : null,
    input.template === "mandamus_writ" &&
    mandamusFindings.length > 0 &&
    mandamusFileNow === 0
      ? "Mandamus should stay records-first or preservation-first until a FILE_WRIT route is supported."
      : null,
  ].filter((item): item is string => Boolean(item));
  const nextQuestions = [
    commandMissing.includes("filing type")
      ? "What exact filing should this become: writ, motion, reply, appellate memo, discovery demand, complaint, or discipline packet?"
      : null,
    commandMissing.includes("response target")
      ? "What order, motion, refusal, delay, missing record, or adverse action is this responding to?"
      : null,
    commandMissing.includes("requested relief")
      ? "What narrow relief or command should the court or recipient be asked to grant?"
      : null,
    commandMissing.includes("priority issues")
      ? "What are the three to six issues that should control the draft?"
      : null,
    captionMissing.length > 0
      ? `What caption data is missing: ${captionMissing.join(", ")}?`
      : null,
    input.template === "mandamus_writ"
      ? "What appendix record proves clear duty, beneficial interest, refusal or delay, and no adequate ordinary remedy?"
      : null,
    ...templateNextQuestions(input.template),
    missingRecords.length > 0
      ? `Should the next packet demand these records first: ${missingRecords.slice(0, 3).join("; ")}?`
      : null,
  ].filter((item): item is string => Boolean(item));
  const proofRequirements = uniqueList(
    [
      ...templateProofRequirements(input.template),
      ...missingRecords.map(record => `missing record to demand: ${record}`),
    ],
    12
  );

  let readiness: FilingPlan["readiness"] = "human_review_required";
  if (allMissing.length > 0 || findingsInScope.length === 0) {
    readiness = "do_not_file_yet";
  } else if (
    blockedSources.length > 0 ||
    (findingsInScope.length > 0 &&
      anchoredFindings.length < findingsInScope.length) ||
    (input.template === "mandamus_writ" &&
      mandamusFindings.length > 0 &&
      mandamusFileNow === 0 &&
      mandamusDemandFirst > 0)
  ) {
    readiness = "records_first";
  } else if (
    lowConfidence.length === 0 &&
    authorityCount > 0 &&
    adverseCount > 0
  ) {
    readiness = "draft_ready";
  }

  const theoryOfFiling =
    draftCommandHasContent(input.draftCommand) &&
    (input.draftCommand.respondingTo || input.draftCommand.requestedRelief)
      ? [
          input.draftCommand.respondingTo
            ? `Responds to ${sentence(input.draftCommand.respondingTo)}`
            : null,
          input.draftCommand.requestedRelief
            ? `and seeks ${sentence(input.draftCommand.requestedRelief)}`
            : null,
        ]
          .filter(Boolean)
          .join(" ")
      : `${routeLabel} built from selected source records and report-ready findings.`;
  const cleanList = (items: string[], maxLength: number, limit: number) =>
    uniqueList(
      items.map(item => truncateForColumn(item, maxLength)).filter(Boolean),
      limit
    );

  return filingPlanSchema.parse({
    routeLabel: truncateForColumn(routeLabel, 180),
    readiness,
    theoryOfFiling: truncateForColumn(theoryOfFiling, 900),
    issueArchitecture:
      issueArchitecture.length > 0
        ? issueArchitecture.slice(0, 8).map(item => ({
            label: truncateForColumn(item.label, 180),
            status: truncateForColumn(item.status, 80),
            detail: truncateForColumn(item.detail, 600),
          }))
        : [
            {
              label: "No issue architecture yet",
              status: "blocked",
              detail:
                "Run analysis/QC or provide priority issues before drafting.",
            },
          ],
    proofRequirements: cleanList(proofRequirements, 260, 12),
    missingCommandFields: cleanList(allMissing, 80, 12),
    warnings: cleanList(baseWarnings, 300, 8),
    nextQuestions: cleanList(nextQuestions, 260, 8),
    exportChecklist: cleanList(
      [
        "Verify caption, local rule format, page limits, service, and deadline.",
        "Verify every quoted fact against the source appendix.",
        "Verify statutes, cases, standards of review, and local rules before filing.",
        "Keep missing records as demands unless produced records prove the stronger claim.",
        "Address adverse facts and the opposing position before export.",
        input.template === "mandamus_writ"
          ? "For mandamus, confirm the packet asks for a narrow command and not ordinary merits review."
          : "Confirm the requested relief matches the procedural vehicle.",
      ],
      260,
      10
    ),
  });
}

function filingPlanDraftingStandard(plan: FilingPlan): string {
  const text = [
    plan.routeLabel,
    plan.theoryOfFiling,
    ...plan.proofRequirements,
    ...plan.exportChecklist,
  ]
    .join(" ")
    .toLowerCase();

  if (/mandamus|writ|extraordinary/.test(text)) {
    return "Mandamus quality: state the narrow command requested; identify the clear legal duty; show refusal, delay, or failure to act; explain why ordinary remedy is not plain, speedy, and adequate; cite appendix proof; and avoid merits reweighing, damages, or generalized misconduct relief.";
  }

  if (/written opinion|bench memo|opinion|disposition/.test(text)) {
    return "Written-opinion quality: use question presented, short answer, governing rule, source-bound facts, analysis, adverse facts, limits, and recommended disposition. The tone should read like disciplined judicial reasoning, not argument notes.";
  }

  if (/appeal|appellate|standard of review|preservation/.test(text)) {
    return "Appellate quality: identify the issue, standard of review, preservation posture, source-bound record facts, adverse facts, harmless-error or prejudice risk, and the cleanest relief path.";
  }

  if (/discovery|missing record|records/.test(text)) {
    return "Records-first quality: convert gaps into exact record demands, identify the likely custodian, explain what each record would prove or disprove, and avoid treating absence as proven misconduct.";
  }

  return "Court-safe quality: separate record facts from inference, identify missing proof, handle adverse facts, verify authority, and request only relief supported by the current procedural posture.";
}

function buildFilingDirectorPlanSection(plan: FilingPlan): string {
  const readinessLabel = humanize(plan.readiness);
  return [
    "## Filing Director Plan",
    "This is the structured command plan produced before drafting. It tells the report what kind of filing this is, what proof must exist, what is missing, and what a human should answer next.",
    "",
    `- Route: ${plan.routeLabel}.`,
    `- Readiness: ${readinessLabel}.`,
    `- Theory of filing: ${plan.theoryOfFiling}.`,
    `- Drafting standard: ${filingPlanDraftingStandard(plan)}`,
    "",
    "### Issue Architecture",
    plan.issueArchitecture
      .map(
        (item, index) =>
          `${index + 1}. **${item.label}** (${item.status}) - ${item.detail}`
      )
      .join("\n"),
    "",
    "### Proof Requirements",
    plan.proofRequirements.length > 0
      ? plan.proofRequirements.map(item => `- ${item}`).join("\n")
      : "- No proof requirements were generated.",
    "",
    "### Missing Direction",
    plan.missingCommandFields.length > 0
      ? plan.missingCommandFields.map(item => `- ${item}`).join("\n")
      : "- No command or caption gaps detected by the filing director.",
    "",
    "### Filing Warnings",
    plan.warnings.length > 0
      ? plan.warnings.map(item => `- ${item}`).join("\n")
      : "- No deterministic filing-plan warnings were generated. Human review is still required.",
    "",
    "### Next Questions For Human Review",
    plan.nextQuestions.length > 0
      ? plan.nextQuestions.map(item => `- ${item}`).join("\n")
      : "- No follow-up questions were generated. Confirm local rules, deadlines, adverse facts, and authority manually.",
    "",
    "### Export Checklist",
    plan.exportChecklist.map(item => `- ${item}`).join("\n"),
  ].join("\n");
}

function qualityStatusLine(
  label: string,
  status: "ready" | "needs review" | "blocked",
  detail: string
): string {
  return `- **${label}: ${status.toUpperCase()}.** ${detail}`;
}

function buildFilingQualityReview(data: {
  template: ReportTemplate;
  draftCommand?: DraftCommand;
  filingMetadata?: FilingMetadata;
  documents: DocumentRecord[];
  findings: AgentFindingRecord[];
  legacyAgentOutputsIncluded: boolean;
}): string {
  const commandMissing = filingCommandMissingFields(data.draftCommand);
  const captionMissing = filingCaptionMissingFields(data.filingMetadata);
  const readyDocuments = data.documents.filter(isDocumentReadyForAnalysis);
  const missingHashes = data.documents.filter(
    document => !document.documentHash
  );
  const anchoredFindings = data.findings.filter(
    finding => sourceAnchorText(finding).length > 0
  );
  const authorityFindings = data.findings.filter(
    finding => safeListItems(finding.legalAuthorities).length > 0
  );
  const lowConfidence = data.findings.filter(
    finding => finding.confidence > 0 && finding.confidence < 95
  );
  const adverseFacts = data.findings.filter(
    finding =>
      finding.findingType === "adverse_fact" ||
      sentence(finding.title).toLowerCase().includes("adverse") ||
      sentence(finding.summary).toLowerCase().includes("adverse")
  );
  const mandamusFindings = mandamusRelevantFindings(data.findings);
  const mandamusRoutes = mandamusFindings.reduce<Record<string, number>>(
    (counts, finding) => {
      const route = mandamusRouteCode(mandamusRouteForFinding(finding));
      counts[route] = (counts[route] ?? 0) + 1;
      return counts;
    },
    {}
  );
  const requestedRelief = reportReliefText(data.template, data.draftCommand);

  const fixList = [
    commandMissing.length > 0
      ? `Complete filing command: ${commandMissing.join(", ")}.`
      : null,
    captionMissing.length > 0
      ? `Add caption metadata: ${captionMissing.join(", ")}.`
      : null,
    readyDocuments.length < data.documents.length
      ? `Resolve ${data.documents.length - readyDocuments.length} non-ready source document(s) before relying on the packet.`
      : null,
    missingHashes.length > 0
      ? `Attach source hashes for ${missingHashes.length} document(s).`
      : null,
    anchoredFindings.length < data.findings.length
      ? `Add source anchors or downgrade ${data.findings.length - anchoredFindings.length} finding(s).`
      : null,
    authorityFindings.length === 0
      ? "Verify controlling statutes, rules, standards of review, and cases before filing."
      : null,
    lowConfidence.length > 0
      ? `Human-review ${lowConfidence.length} finding(s) below 95 confidence.`
      : null,
    adverseFacts.length === 0
      ? "Add a human adverse-fact review so the packet does not read like advocacy blindfolded."
      : null,
    data.template === "mandamus_writ" &&
    mandamusFindings.length > 0 &&
    !mandamusRoutes.FILE_WRIT
      ? "For mandamus, do not file as a writ unless the route is FILE_WRIT or the packet expressly explains why records must be demanded first."
      : null,
  ].filter((item): item is string => Boolean(item));

  return [
    "## Filing Quality Review",
    "This is the packet's internal filing-safety review. It does not approve the filing. It identifies what is strong enough to use, what must be checked, and what should be fixed before a human treats the packet as court-facing work product.",
    "",
    "### Filing Readiness Signals",
    qualityStatusLine(
      "Filing command",
      commandMissing.length === 0
        ? "ready"
        : draftCommandHasContent(data.draftCommand)
          ? "needs review"
          : "blocked",
      commandMissing.length === 0
        ? "Filing type, response target, requested relief, and priority issues were supplied."
        : `Missing ${commandMissing.join(", ")}.`
    ),
    qualityStatusLine(
      "Caption",
      captionMissing.length === 0 ? "ready" : "needs review",
      captionMissing.length === 0
        ? "Court, case number, party line, and filing title were supplied."
        : `Missing ${captionMissing.join(", ")}.`
    ),
    qualityStatusLine(
      "Source control",
      readyDocuments.length === data.documents.length &&
        missingHashes.length === 0
        ? "ready"
        : "needs review",
      `${readyDocuments.length}/${data.documents.length} source(s) analysis-ready; ${missingHashes.length} missing source hash(es).`
    ),
    qualityStatusLine(
      "Finding support",
      anchoredFindings.length === data.findings.length
        ? "ready"
        : "needs review",
      `${anchoredFindings.length}/${data.findings.length} finding(s) include source anchors.`
    ),
    qualityStatusLine(
      "Authority posture",
      authorityFindings.length > 0 ? "needs review" : "blocked",
      authorityFindings.length > 0
        ? `${authorityFindings.length} finding(s) include authority leads; verify current law before filing.`
        : "No authority leads are attached to the selected findings."
    ),
    qualityStatusLine(
      "Confidence",
      lowConfidence.length === 0 ? "ready" : "needs review",
      lowConfidence.length === 0
        ? "No selected findings are below 95 confidence."
        : `${lowConfidence.length} selected finding(s) are below 95 confidence.`
    ),
    qualityStatusLine(
      "Adverse-fact review",
      adverseFacts.length > 0 ? "ready" : "needs review",
      adverseFacts.length > 0
        ? `${adverseFacts.length} adverse-fact finding(s) are included.`
        : "No adverse-fact findings are included; a human should identify counterfacts before filing."
    ),
    data.template === "mandamus_writ"
      ? qualityStatusLine(
          "Mandamus posture",
          mandamusRoutes.FILE_WRIT ? "needs review" : "blocked",
          mandamusFindings.length > 0
            ? Object.entries(mandamusRoutes)
                .map(([route, count]) => `${route} ${count}`)
                .join("; ")
            : "No mandamus-relevant findings were selected."
        )
      : qualityStatusLine(
          "Relief posture",
          draftCommandHasContent(data.draftCommand)
            ? "needs review"
            : "blocked",
          requestedRelief
        ),
    qualityStatusLine(
      "Legacy material",
      data.legacyAgentOutputsIncluded ? "needs review" : "ready",
      data.legacyAgentOutputsIncluded
        ? "Legacy/freeform outputs were included by admin override; do not treat them as factual findings without source review."
        : "Legacy/freeform outputs are excluded from factual report use."
    ),
    "",
    "### Fix Before Filing",
    fixList.length > 0
      ? fixList.map((item, index) => `${index + 1}. ${item}`).join("\n")
      : "No deterministic filing-quality gaps were detected. A human still must verify citations, local rules, record excerpts, captions, service, and filing deadlines.",
  ].join("\n");
}

function buildFilingExecutionPlaybook(data: {
  template: ReportTemplate;
  draftCommand?: DraftCommand;
  filingMetadata?: FilingMetadata;
  documents: DocumentRecord[];
  findings: AgentFindingRecord[];
}): string {
  const top = rankedFindings(data.findings, 5);
  const command = data.draftCommand;
  const missingRecords = uniqueList(
    data.findings.flatMap(finding => safeListItems(finding.missingRecords)),
    12
  );
  const appendixProof = uniqueList(
    top.flatMap(finding => sourceAnchorText(finding).slice(0, 2)),
    10
  );
  const authorityLeads = uniqueList(
    top.flatMap(finding => safeListItems(finding.legalAuthorities)),
    10
  );
  const selectedSources = data.documents.slice(0, 10).map((document, index) => {
    const ready = isDocumentReadyForAnalysis(document) ? "ready" : "not ready";
    return `${index + 1}. ${document.fileName} - ${ready}; SHA ${document.documentHash || "missing"}.`;
  });
  const captionMissing = filingCaptionMissingFields(data.filingMetadata);
  const filingTitle =
    data.filingMetadata?.filingTitle ||
    (draftCommandHasContent(command) && command.filingType) ||
    humanize(data.template);
  const filingTarget =
    draftCommandHasContent(command) && command.respondingTo
      ? command.respondingTo
      : "the selected source record and QC-cleared findings";
  const relief = reportReliefText(data.template, command);
  const mandamusFindings = mandamusRelevantFindings(data.findings);
  const routeCounts = mandamusFindings.reduce<Record<string, number>>(
    (counts, finding) => {
      const route = mandamusRouteCode(mandamusRouteForFinding(finding));
      counts[route] = (counts[route] ?? 0) + 1;
      return counts;
    },
    {}
  );

  const argumentBuild =
    top.length > 0
      ? top
          .map(
            (finding, index) =>
              `${index + 1}. Lead with **${finding.title}**. Use posture: ${proofPosture(finding)}. Limit: ${finding.confidence}/100 confidence; QC ${humanize(finding.qcStatus)}.`
          )
          .join("\n")
      : "1. No argument build is available until report-ready findings exist.";

  const assistantPrompts = [
    `Turn this packet into a ${filingTitle} outline using only QC-cleared findings and source anchors.`,
    `Draft the Questions Presented and Relief Requested sections for ${relief}`,
    missingRecords.length > 0
      ? `Convert these missing records into exact appendix or records-demand language: ${missingRecords.slice(0, 6).join("; ")}.`
      : "Identify any missing appendix records before drafting stronger factual claims.",
    data.template === "mandamus_writ"
      ? "Re-check the mandamus gates: clear duty, refusal or delay, beneficial interest, no adequate remedy, discretionary barrier, and exact command."
      : "Re-check issue, rule, source facts, application, adverse facts, and requested relief before drafting.",
  ];

  return [
    "## Filing Execution Playbook",
    "This section converts the analysis packet into a practical filing workflow. It is not a final filing. It is the checklist a human should use to turn the packet into court-facing work without losing source discipline.",
    "",
    "### Filing Objective",
    `- Working title: ${filingTitle}.`,
    `- Responding to: ${sentence(filingTarget)}.`,
    `- Requested relief / command: ${relief}.`,
    captionMissing.length > 0
      ? `- Caption status: missing ${captionMissing.join(", ")}.`
      : "- Caption status: core caption metadata supplied.",
    "",
    "### Record Appendix Build",
    selectedSources.length > 0
      ? selectedSources.join("\n")
      : "1. No source documents were selected.",
    "",
    appendixProof.length > 0
      ? [
          "**Appendix proof to lead with:**",
          ...appendixProof.map((item, index) => `${index + 1}. ${item}`),
        ].join("\n")
      : "**Appendix proof to lead with:** none attached yet. Do not draft factual assertions without source anchors.",
    "",
    missingRecords.length > 0
      ? [
          "**Records to demand before stronger claims:**",
          ...missingRecords.map((item, index) => `${index + 1}. ${item}`),
        ].join("\n")
      : "**Records to demand before stronger claims:** none listed by selected findings.",
    "",
    "### Argument Build",
    argumentBuild,
    "",
    authorityLeads.length > 0
      ? [
          "**Authority leads to verify before filing:**",
          ...authorityLeads.map((item, index) => `${index + 1}. ${item}`),
        ].join("\n")
      : "**Authority leads to verify before filing:** none attached. Verify controlling statutes, rules, and standards of review.",
    "",
    data.template === "mandamus_writ"
      ? [
          "### Mandamus Route Check",
          routeCounts.FILE_WRIT
            ? `- FILE_WRIT candidates: ${routeCounts.FILE_WRIT}. Human review still must verify appendix proof and no adequate ordinary remedy.`
            : "- FILE_WRIT candidates: 0. Treat the packet as demand-records-first, preservation, or non-mandamus unless the record changes.",
          routeCounts.DEMAND_RECORDS_FIRST
            ? `- DEMAND_RECORDS_FIRST issues: ${routeCounts.DEMAND_RECORDS_FIRST}. Build record demands before filing a writ.`
            : "- DEMAND_RECORDS_FIRST issues: 0.",
          routeCounts.PRESERVE_FOR_APPEAL
            ? `- PRESERVE_FOR_APPEAL issues: ${routeCounts.PRESERVE_FOR_APPEAL}. Keep objections and record preservation clean.`
            : "- PRESERVE_FOR_APPEAL issues: 0.",
          routeCounts.NOT_MANDAMUS
            ? `- NOT_MANDAMUS issues: ${routeCounts.NOT_MANDAMUS}. Do not draft these as extraordinary relief.`
            : "- NOT_MANDAMUS issues: 0.",
          "- Narrow command rule: ask the reviewing court to compel or restrain a specific legal act, not to reweigh facts, award damages, or decide ordinary merits.",
        ].join("\n")
      : [
          "### Filing Route Check",
          "- Match the requested relief to the current procedural vehicle before drafting.",
          "- Separate damages, declaratory/prospective relief, discovery demands, appeal preservation, habeas, mandamus, recusal, and disciplinary complaints.",
          "- Do not mix court claims and ethics complaints unless the packet clearly separates litigation use from discipline use.",
        ].join("\n"),
    "",
    "### Service, Deadline, And Local-Rule Checks",
    "1. Confirm the correct court, department, judge, docket number, and filing portal.",
    "2. Confirm deadline, emergency posture, stay needs, page limits, exhibit limits, and required formatting.",
    "3. Confirm service list, certificate of service, signature block, verification/declaration needs, and proposed-order requirements.",
    "4. Confirm every quoted fact appears in the appendix or source appendix with a document name and stable anchor.",
    "5. Confirm adverse facts and counterarguments are addressed before filing.",
    "",
    "### Filing Assistant Prompts",
    assistantPrompts
      .map((prompt, index) => `${index + 1}. ${prompt}`)
      .join("\n"),
  ].join("\n");
}

function sourceAppendixLine(document: DocumentRecord, index: number): string {
  const readiness = isDocumentReadyForAnalysis(document)
    ? "analysis-ready"
    : "needs extraction review";
  return [
    `${index + 1}. **${document.fileName}**`,
    `   - Status: ${document.status}; ${readiness}; OCR ${document.extractionQualityScore ?? 0}/100.`,
    `   - Uploaded: ${formatDate(document.createdAt)}.`,
    `   - Source hash: ${document.documentHash || "missing"}.`,
  ].join("\n");
}

function buildMissingRecordSection(findings: AgentFindingRecord[]): string {
  const byRecord = new Map<string, Set<string>>();
  findings.forEach(finding => {
    safeListItems(finding.missingRecords).forEach(record => {
      const key = record;
      const titles = byRecord.get(key) ?? new Set<string>();
      titles.add(finding.title);
      byRecord.set(key, titles);
    });
  });

  if (byRecord.size === 0) {
    return "No missing-record demands were attached to the selected report-ready findings.";
  }

  return Array.from(byRecord.entries())
    .slice(0, 60)
    .map(([record, titles], index) => {
      const related = Array.from(titles).slice(0, 3).join("; ");
      return `${index + 1}. **${record}**\n   - Tied to: ${related}${titles.size > 3 ? ` and ${titles.size - 3} more issue(s)` : ""}.`;
    })
    .join("\n");
}

function buildMandamusElementMatrix(findings: AgentFindingRecord[]): string {
  const mandamusFindings = mandamusRelevantFindings(findings);

  if (mandamusFindings.length === 0) {
    return [
      "### Mandamus Element Matrix",
      "",
      "| Element | Status | What the packet must prove next |",
      "| --- | --- | --- |",
      "| Writ route | NOT READY | No mandamus-relevant finding was selected. Run the Mandamus / Writ Builder against processed source records first. |",
    ].join("\n");
  }

  const routeCounts = mandamusFindings.reduce<Record<string, number>>(
    (counts, finding) => {
      const code = mandamusRouteCode(mandamusRouteForFinding(finding));
      counts[code] = (counts[code] ?? 0) + 1;
      return counts;
    },
    {}
  );
  const assessments = mandamusFindings.map(assessMandamusFinding);
  const sourceAnchorCount = assessments.reduce(
    (count, assessment) => count + assessment.sourceAnchorCount,
    0
  );
  const missingRecords = Array.from(
    new Set(assessments.flatMap(assessment => assessment.missingRecords))
  );
  const hasFileNow = Boolean(routeCounts.FILE_WRIT);
  const hasDemandFirst = Boolean(routeCounts.DEMAND_RECORDS_FIRST);
  const hasPreserve = Boolean(routeCounts.PRESERVE_FOR_APPEAL);
  const hasNotMandamus = Boolean(routeCounts.NOT_MANDAMUS);
  const mentionsClearDuty = assessments.some(
    assessment => assessment.hasClearDutySignal
  );
  const mentionsBeneficialInterest = assessments.some(
    assessment => assessment.hasBeneficialInterestSignal
  );
  const mentionsAdequateRemedy = assessments.some(
    assessment => assessment.hasNoAdequateRemedySignal
  );
  const mentionsNarrowCommand = assessments.some(
    assessment => assessment.hasNarrowCommandSignal
  );
  const mentionsRefusalOrDelay = assessments.some(
    assessment => assessment.hasRefusalOrDelaySignal
  );

  const rows: Array<[string, string, string]> = [
    [
      "Clear legal duty / right",
      hasFileNow || mentionsClearDuty ? "READY TO ARGUE" : "NEEDS LEGAL HOOK",
      mentionsClearDuty
        ? "The selected findings identify duty/refusal language. Verify the exact statute, rule, order, or mandatory act before drafting."
        : "Name the specific act the court or officer was legally required to perform.",
    ],
    [
      "Beneficial interest / standing",
      hasFileNow || mentionsBeneficialInterest
        ? "READY TO ARGUE"
        : "NEEDS STANDING FACT",
      mentionsBeneficialInterest
        ? "The packet explains why the petitioner is directly affected. Tie that interest to the harm and requested command."
        : "Explain why the petitioner is beneficially interested or directly affected by the refusal, delay, missing ruling, or missing record.",
    ],
    [
      "Refusal, failure, or delay",
      mentionsRefusalOrDelay ? "READY TO ARGUE" : "NEEDS RECORD FACT",
      mentionsRefusalOrDelay
        ? "The packet has refusal/delay language. Tie it to docket entries, orders, transcripts, filing receipts, or notices."
        : "Attach the record proving refusal, non-ruling, rejected filing, missing findings, or delayed performance.",
    ],
    [
      "No plain, speedy, adequate ordinary remedy",
      hasFileNow || mentionsAdequateRemedy ? "NEEDS HUMAN REVIEW" : "MISSING",
      mentionsAdequateRemedy
        ? "The issue discusses ordinary-remedy risk. Human review must still explain why appeal, another motion, or habeas is not adequate."
        : "Do not file until the packet explains why ordinary review is inadequate for this exact harm.",
    ],
    [
      "Appendix / source proof",
      sourceAnchorCount > 0 && !hasDemandFirst
        ? "READY TO ARGUE"
        : sourceAnchorCount > 0
          ? "PARTIAL"
          : "BLOCKED",
      sourceAnchorCount > 0
        ? `${sourceAnchorCount} source anchor${sourceAnchorCount === 1 ? "" : "s"} attached. ${missingRecords.length > 0 ? "Missing appendix records still need demands." : "Verify pagination and exhibit labels before export."}`
        : "No source anchors are attached. Treat this as records-first, not file-ready.",
    ],
    [
      "Narrow command requested",
      mentionsNarrowCommand ? "READY TO DRAFT" : "NEEDS COMMAND",
      mentionsNarrowCommand
        ? "The packet contains command language. Keep it narrow: rule, make findings, produce/settle record, accept filing, or perform the specific duty."
        : "State the exact command the reviewing court can issue without deciding ordinary merits or awarding damages.",
    ],
    [
      "Discretion / merits-review risk",
      hasNotMandamus
        ? "BLOCKED FOR WRIT"
        : hasPreserve
          ? "HIGH CAUTION"
          : "CONTROLLED",
      hasNotMandamus
        ? "At least one issue seeks damages, merits review, fact reweighing, or generalized misconduct review. Do not draft that issue as mandamus."
        : hasPreserve
          ? "At least one issue looks better preserved for appeal or later review. Explain why immediate extraordinary relief is still necessary."
          : "No selected finding was classified as non-mandamus or appeal-preservation only.",
    ],
    [
      "Missing record demands",
      missingRecords.length > 0 ? "DEMAND FIRST" : "NONE LISTED",
      missingRecords.length > 0
        ? missingRecords.slice(0, 8).join("; ")
        : "No missing appendix records were attached by the selected findings. Human review should still confirm the appendix is complete.",
    ],
    [
      "Overall writ posture",
      hasFileNow
        ? "POSSIBLE FILE_WRIT"
        : hasDemandFirst
          ? "DEMAND_RECORDS_FIRST"
          : hasPreserve
            ? "PRESERVE_FOR_APPEAL"
            : "NOT_MANDAMUS",
      hasFileNow
        ? mandamusRouteAction("file_now")
        : hasDemandFirst
          ? mandamusRouteAction("demand_records")
          : hasPreserve
            ? mandamusRouteAction("preserve_for_appeal")
            : mandamusRouteAction("not_mandamus"),
    ],
  ];

  return [
    "### Mandamus Element Matrix",
    "",
    "| Element | Status | What the packet must prove next |",
    "| --- | --- | --- |",
    ...rows.map(
      ([element, status, detail]) =>
        `| ${element} | ${status} | ${detail.replace(/\|/g, "/")} |`
    ),
  ].join("\n");
}

function buildMandamusViabilitySection(findings: AgentFindingRecord[]): string {
  const mandamusFindings = mandamusRelevantFindings(findings);

  if (mandamusFindings.length === 0) {
    return [
      "No QC-cleared mandamus-specific findings were available for this scope.",
      "",
      "Before filing or drafting a writ petition, the record should identify a legally required act, the refusal or failure to perform it, why ordinary appeal or motion practice is inadequate, and the exact command requested.",
    ].join("\n");
  }

  const sorted = mandamusFindings.slice().sort((left, right) => {
    const leverageDelta = right.leverageScore - left.leverageScore;
    return leverageDelta !== 0
      ? leverageDelta
      : right.confidence - left.confidence;
  });

  const buckets = sorted.reduce<Record<MandamusRoute, AgentFindingRecord[]>>(
    (groups, finding) => {
      groups[mandamusRouteForFinding(finding)].push(finding);
      return groups;
    },
    {
      file_now: [],
      demand_records: [],
      preserve_for_appeal: [],
      not_mandamus: [],
    }
  );

  const sections = (
    [
      "file_now",
      "demand_records",
      "preserve_for_appeal",
      "not_mandamus",
    ] as const
  )
    .map(route => {
      const routeFindings = buckets[route];
      if (routeFindings.length === 0) {
        return [
          `### ${mandamusRouteLabel(route)}`,
          "",
          mandamusRouteIntro(route),
          "",
          "_No findings landed in this lane._",
        ].join("\n");
      }

      return [
        `### ${mandamusRouteLabel(route)}`,
        "",
        mandamusRouteIntro(route),
        "",
        routeFindings
          .map((finding, index) => mandamusFindingText(finding, index + 1))
          .join("\n\n"),
      ].join("\n");
    })
    .join("\n\n");

  return [
    "Mandamus is screened through five gates: clear legal duty, beneficial interest, record proof of refusal or delay, no plain/speedy/adequate ordinary remedy, and a narrow command the reviewing court can issue.",
    "",
    buildMandamusElementMatrix(findings),
    "",
    sections,
    "",
    buildMandamusPetitionScaffold(findings),
  ].join("\n");
}

function buildReliabilitySection(data: {
  findings: AgentFindingRecord[];
  legacyAgentOutputsIncluded: boolean;
  legacyAgentOutputsAvailable: number;
}): string {
  const counts = data.findings.reduce<Record<string, number>>(
    (acc, finding) => {
      acc[finding.qcStatus] = (acc[finding.qcStatus] ?? 0) + 1;
      return acc;
    },
    {}
  );
  const unverbatim = data.findings.filter(finding =>
    sourceAnchorText(finding).some(anchor =>
      anchor.toLowerCase().includes("quote not found verbatim")
    )
  ).length;

  return [
    `- Report-ready findings included: ${data.findings.length}.`,
    `- QC status mix: ${
      Object.entries(counts)
        .map(([status, count]) => `${humanize(status)} ${count}`)
        .join("; ") || "none"
    }.`,
    `- Findings with quote-verification warnings: ${unverbatim}.`,
    `- Legacy/freeform outputs: ${data.legacyAgentOutputsIncluded ? "included by admin override" : `excluded by default (${data.legacyAgentOutputsAvailable} available)`}.`,
    "- Court-use rule: factual assertions should be limited to verified source anchors; allegations and gaps should be framed as allegations, inferences, or records demands.",
  ].join("\n");
}

function marketLaneForTemplate(
  template: ReportTemplate,
  command: DraftCommand
): Pick<
  MarketProofPack,
  "buyerLane" | "useCase" | "sellableArtifact" | "firstCloseMotion"
> {
  const commandText = draftCommandText(command).toLowerCase();

  if (template === "mandamus_writ") {
    return {
      buyerLane: "Mandamus / urgent writ buyer",
      useCase:
        "Fast route decision: file writ, demand records first, preserve for appeal, or do not file as mandamus.",
      sellableArtifact:
        "Writ viability packet with element matrix, appendix checklist, missing-record demands, and narrow-command review.",
      firstCloseMotion:
        "Sell a narrow urgent packet around one refusal, delay, missing finding, missing transcript, or record-settlement problem.",
    };
  }

  if (template === "written_opinion") {
    return {
      buyerLane: commandText.includes("appeal")
        ? "Attorney / appellate reviewer"
        : "Attorney / clinic reviewer",
      useCase:
        "Turn a record issue into opinion-style reasoning with question presented, rule, source facts, adverse facts, limits, and recommended disposition.",
      sellableArtifact:
        "Bench-memo or appellate-issue packet that a human reviewer can edit into a brief, ruling memo, or filing scaffold.",
      firstCloseMotion:
        "Use one closed or low-risk record set and compare the issue analysis against manual review.",
    };
  }

  if (template === "discovery_demands") {
    return {
      buyerLane: "Defense, civil-rights, clinic, or investigator records team",
      useCase:
        "Convert gaps and suspicious absences into exact demands without overclaiming missing records as proven misconduct.",
      sellableArtifact:
        "Records-demand packet with custodians, proof purpose, contradiction targets, and source appendix.",
      firstCloseMotion:
        "Run one discovery or public-records bundle and return a missing-record demand list the buyer can actually use.",
    };
  }

  if (template === "source_appendix") {
    return {
      buyerLane: "Attorney reviewer / clinic / investigator evidence handoff",
      useCase:
        "Create a verifiable source-control appendix with document IDs, quotes, hashes, finding links, QC posture, and export warnings.",
      sellableArtifact:
        "Source appendix packet that lets a human verify every report claim against the actual record before filing or review.",
      firstCloseMotion:
        "Use one messy case record and deliver a clean source ledger the buyer can audit without hunting through the whole corpus.",
    };
  }

  if (template === "evidence_chronology") {
    return {
      buyerLane: "Pro se, legal-aid, defense, or watchdog evidence reviewer",
      useCase:
        "Make a messy record understandable through chronology, actor attribution, contradictions, source support, and gap mapping.",
      sellableArtifact:
        "Timeline and gap-map packet with source-linked events, contradictions, adverse facts, and records to demand.",
      firstCloseMotion:
        "Offer a before/after case packet: messy records in, readable chronology and proof ledger out.",
    };
  }

  if (template === "immunity_relief") {
    return {
      buyerLane: "Civil-rights firm / post-conviction relief reviewer",
      useCase:
        "Separate damages barriers from non-damages relief, nonimmune actors, Monell routes, habeas, mandamus, recusal, appeal, and prospective relief.",
      sellableArtifact:
        "Immunity and relief-pathway memo with actor/function routing, risk flags, missing proof, and safe next moves.",
      firstCloseMotion:
        "Sell one civil-rights or post-conviction relief screen where immunity risk is the expensive manual bottleneck.",
    };
  }

  if (template === "case_strategy") {
    return {
      buyerLane: "Civil-rights firm / appellate strategy team",
      useCase:
        "Rank the highest-leverage issues by proof strength, remedy path, immunity risk, adverse facts, and next action.",
      sellableArtifact:
        "Leverage memo with claim ranking, weak points, source appendix, missing records, and reviewer next steps.",
      firstCloseMotion:
        "Run one closed or low-risk matter and compare the ranked issue map against what the team already found.",
    };
  }

  if (template === "executive_summary") {
    return {
      buyerLane: "Pro se case builder / legal-aid intake reviewer",
      useCase:
        "Give a fast plain-English review of the record, strongest facts, missing proof, risks, and next action.",
      sellableArtifact:
        "Reviewer handoff summary with source appendix, risk flags, missing records, and no unsupported accusations.",
      firstCloseMotion:
        "Sell a narrow one-case packet or clinic intake screen, not unlimited legal advice.",
    };
  }

  return {
    buyerLane:
      commandText.includes("1983") || commandText.includes("monell")
        ? "Civil-rights firm pilot"
        : "Motion / report packet buyer",
    useCase:
      "Turn QC-cleared findings into a court-facing packet with issue framing, source facts, relief, and export-ready appendices.",
    sellableArtifact:
      "Court packet with source control, finding ledger, adverse-fact review, missing records, and PDF/DOCX export.",
    firstCloseMotion:
      "Use one narrow matter and measure whether the exported packet saves reviewer time without overclaiming the record.",
  };
}

function buildMarketProofPack(data: {
  template: ReportTemplate;
  draftCommand?: DraftCommand;
  filingPlan: FilingPlan;
  documents: DocumentRecord[];
  findings: AgentFindingRecord[];
  legacyAgentOutputsIncluded: boolean;
}): MarketProofPack {
  const lane = marketLaneForTemplate(data.template, data.draftCommand);
  const readyDocuments = data.documents.filter(isDocumentReadyForAnalysis);
  const sourceAnchored = data.findings.filter(
    finding => sourceAnchorText(finding).length > 0
  );
  const lowConfidence = data.findings.filter(
    finding => finding.confidence > 0 && finding.confidence < 95
  );
  const missingRecords = uniqueList(
    data.findings.flatMap(finding => safeListItems(finding.missingRecords)),
    6
  );
  const legalAuthorities = data.findings.filter(
    finding => safeListItems(finding.legalAuthorities).length > 0
  );
  const adverseFacts = data.findings.filter(
    finding =>
      finding.findingType === "adverse_fact" ||
      sentence(finding.title).toLowerCase().includes("adverse") ||
      sentence(finding.summary).toLowerCase().includes("adverse")
  );

  const blockers = [
    readyDocuments.length < data.documents.length
      ? `${data.documents.length - readyDocuments.length} selected source(s) are not analysis-ready.`
      : null,
    data.findings.length === 0
      ? "No report-ready findings are selected."
      : null,
    sourceAnchored.length < data.findings.length
      ? `${data.findings.length - sourceAnchored.length} finding(s) need source anchors or downgrade language.`
      : null,
    lowConfidence.length > 0
      ? `${lowConfidence.length} finding(s) are below 95 confidence.`
      : null,
    legalAuthorities.length === 0 && data.findings.length > 0
      ? "No authority leads are attached; law must be verified before court-facing use."
      : null,
    adverseFacts.length === 0 && data.findings.length > 0
      ? "No adverse-fact finding is included; reviewer must add contrary facts."
      : null,
    data.legacyAgentOutputsIncluded
      ? "Legacy/freeform outputs are included by admin override and need source review."
      : null,
    data.filingPlan.readiness === "do_not_file_yet"
      ? "Filing director says do not file yet."
      : null,
    data.filingPlan.readiness === "records_first"
      ? "Filing director says records-first before court-facing use."
      : null,
  ].filter((item): item is string => Boolean(item));

  const proofIncluded = uniqueList(
    [
      `${readyDocuments.length}/${data.documents.length} source(s) analysis-ready`,
      `${data.findings.length} structured finding(s) selected`,
      `${sourceAnchored.length}/${data.findings.length} finding(s) source-anchored`,
      `${legalAuthorities.length} finding(s) with authority leads`,
      `${adverseFacts.length} adverse-fact finding(s) included`,
      missingRecords.length > 0
        ? `missing-record demand targets: ${missingRecords.join("; ")}`
        : "no missing-record targets listed",
      `filing readiness: ${humanize(data.filingPlan.readiness)}`,
    ],
    8
  );

  const deliveryReadiness: MarketProofPack["deliveryReadiness"] = blockers.some(
    blocker => /not analysis-ready|No report-ready|do not file/i.test(blocker)
  )
    ? "blocked"
    : blockers.length > 0
      ? "human_review_required"
      : "pilot_ready";

  return {
    ...lane,
    deliveryReadiness,
    proofIncluded,
    blockers:
      blockers.length > 0
        ? blockers
        : [
            "No deterministic market-proof blockers were detected. Human review must still verify legal authorities, captions, deadlines, service, and local rules.",
          ],
  };
}

function endSentence(value: string): string {
  return /[.!?]$/.test(value.trim()) ? value.trim() : `${value.trim()}.`;
}

function buildMarketProofPackSection(pack: MarketProofPack): string {
  return [
    "## Market Proof Pack",
    "This section translates the legal output into the buyer-facing proof artifact. It keeps the business promise honest: the packet is valuable only if it is source-bound, reviewable, exportable, and clear about what still blocks court-facing use.",
    "",
    `- Buyer lane: ${pack.buyerLane}.`,
    `- Use case: ${endSentence(pack.useCase)}`,
    `- Sellable artifact: ${endSentence(pack.sellableArtifact)}`,
    `- First close motion: ${endSentence(pack.firstCloseMotion)}`,
    `- Delivery readiness: ${humanize(pack.deliveryReadiness)}.`,
    "",
    "### Proof Included",
    pack.proofIncluded.map(item => `- ${item}`).join("\n"),
    "",
    "### Blockers Before Charging Real Money",
    pack.blockers.map(item => `- ${item}`).join("\n"),
  ].join("\n");
}

function authorityKind(authority: string): string {
  if (/\b(v\.|in re|ex parte|matter of)\b/i.test(authority)) {
    return "case";
  }
  if (/\b(nrs|usc|u\.s\.c\.|frcp|frap|nr(cp|ap)|rule|section|§)\b/i.test(authority)) {
    return "statute/rule";
  }
  if (/\b(amendment|constitution|due process|equal protection)\b/i.test(authority)) {
    return "constitutional";
  }
  return "authority lead";
}

function authorityVerificationTask(authority: string, template: ReportTemplate): string {
  const kind = authorityKind(authority);
  if (kind === "case") {
    return "verify current status, court, year, holding, pin cite, and whether it is binding or persuasive";
  }
  if (kind === "statute/rule") {
    return "verify current text, effective date, local version, exceptions, and required procedural elements";
  }
  if (template === "mandamus_writ") {
    return "verify writ jurisdiction, clear-duty element, adequate-remedy element, and appendix requirements";
  }
  return "verify source, hierarchy, current validity, elements, and exact rule statement before filing";
}

function isCaseAuthorityCandidate(authority: string): boolean {
  return (
    authorityKind(authority) === "case" ||
    /\b\d+\s+[A-Z][A-Za-z.]*\s+\d+\b/.test(authority)
  );
}

function citationStatusFromLookup(
  lookup: CourtListenerCitationLookup
): CitationVerificationEntry["status"] {
  if (lookup.status === 200) return "verified";
  if (lookup.status === 300) return "ambiguous";
  if (lookup.status === 404) return "not_found";
  if (lookup.status === 400) return "invalid";
  if (lookup.status === 429) return "throttled";
  return "not_checked";
}

function citationDetailFromLookup(lookup: CourtListenerCitationLookup): string {
  if (lookup.status === 200) {
    return "CourtListener resolved this opinion citation. Still verify current law, hierarchy, holding, and pin cite before filing.";
  }
  if (lookup.status === 300) {
    return "CourtListener found multiple possible matches. Human review must choose the correct case before citing.";
  }
  if (lookup.status === 404) {
    return lookup.errorMessage || "CourtListener parsed this as a valid citation format but did not find it in the database.";
  }
  if (lookup.status === 400) {
    return lookup.errorMessage || "CourtListener treated this as an invalid reporter/citation.";
  }
  if (lookup.status === 429) {
    return lookup.errorMessage || "CourtListener throttled or skipped this citation lookup.";
  }
  return lookup.errorMessage || "Citation lookup did not return a filing-ready verification status.";
}

function buildCitationLookupText(authorities: string[]): string {
  return uniqueList(authorities, 200)
    .filter(isCaseAuthorityCandidate)
    .join("\n")
    .slice(0, 64000);
}

async function getCourtListenerApiKey(userId: number): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;

  const connection = await db
    .select({ apiKey: integrationConnections.apiKey })
    .from(integrationConnections)
    .where(
      and(
        eq(integrationConnections.userId, userId),
        eq(integrationConnections.providerId, "courtlistener")
      )
    )
    .limit(1);

  return connection[0]?.apiKey || null;
}

async function verifyReportCitations(input: {
  userId: number;
  findings: AgentFindingRecord[];
}): Promise<CitationVerificationReport> {
  const authorityLeads = uniqueList(
    input.findings.flatMap(finding => safeListItems(finding.legalAuthorities)),
    200
  );
  const caseAuthorityLeads = authorityLeads.filter(isCaseAuthorityCandidate);
  const manualAuthorityLeads = authorityLeads.filter(
    authority => !isCaseAuthorityCandidate(authority)
  );

  if (authorityLeads.length === 0) {
    return {
      provider: "CourtListener",
      status: "manual_only",
      checkedAt: null,
      entries: [],
      notes: [
        "No authority leads are attached to the selected findings. Legal research is blocked until governing law is added.",
      ],
    };
  }

  const apiKey = await getCourtListenerApiKey(input.userId);
  if (!apiKey) {
    return {
      provider: "CourtListener",
      status: "not_connected",
      checkedAt: null,
      entries: authorityLeads.slice(0, 30).map(authority => ({
        authority,
        kind: authorityKind(authority),
        status: isCaseAuthorityCandidate(authority)
          ? "not_checked"
          : "manual_required",
        citation: "",
        normalizedCitations: [],
        matches: [],
        detail:
          authorityKind(authority) === "case"
            ? "CourtListener is not connected, so this case citation was not verified."
            : "CourtListener does not verify statutes, court rules, canons, law review citations, id., or supra references.",
      })),
      notes: [
        "CourtListener is not connected. Connect it in Integrations before treating case citations as verified.",
        "Statutes, rules, canons, and local authority still require a separate source check.",
      ],
    };
  }

  if (caseAuthorityLeads.length === 0) {
    return {
      provider: "CourtListener",
      status: "no_case_citations",
      checkedAt: new Date().toISOString(),
      entries: manualAuthorityLeads.slice(0, 30).map(authority => ({
        authority,
        kind: authorityKind(authority),
        status: "manual_required",
        citation: "",
        normalizedCitations: [],
        matches: [],
        detail:
          "This authority is not an opinion citation CourtListener can verify. Use the current statute/rule/canon source before filing.",
      })),
      notes: [
        "No case citations were available for CourtListener lookup.",
        "Manual authority verification is still required.",
      ],
    };
  }

  try {
    await courtListener.authenticate({ apiKey });
    const lookupResults = await courtListener.lookupCitations(
      buildCitationLookupText(caseAuthorityLeads)
    );
    const lookupByCitation = new Map(
      lookupResults.flatMap(result => {
        const keys = [result.citation, ...result.normalizedCitations]
          .map(value => value.trim().toLowerCase())
          .filter(Boolean);
        return keys.map(key => [key, result] as const);
      })
    );
    const entries = authorityLeads.slice(0, 30).map(authority => {
      if (!isCaseAuthorityCandidate(authority)) {
        return {
          authority,
          kind: authorityKind(authority),
          status: "manual_required" as const,
          citation: "",
          normalizedCitations: [],
          matches: [],
          detail:
            "Manual verification required. CourtListener citation lookup covers court-opinion citations, not this authority type.",
        };
      }

      const directMatch = lookupByCitation.get(authority.trim().toLowerCase());
      const normalizedMatch = Array.from(lookupByCitation.entries()).find(
        ([key]) =>
          authority.toLowerCase().includes(key) ||
          key.includes(authority.toLowerCase())
      )?.[1];
      const lookup = directMatch || normalizedMatch;

      if (!lookup) {
        return {
          authority,
          kind: authorityKind(authority),
          status: "not_checked" as const,
          citation: "",
          normalizedCitations: [],
          matches: [],
          detail:
            "CourtListener did not parse this authority from the lookup text. Verify manually before filing.",
        };
      }

      return {
        authority,
        kind: authorityKind(authority),
        status: citationStatusFromLookup(lookup),
        citation: lookup.citation,
        normalizedCitations: lookup.normalizedCitations,
        matches: lookup.matches
          .map(match =>
            [match.caseName, match.court, match.dateFiled]
              .filter(Boolean)
              .join(" - ")
          )
          .filter(Boolean),
        detail: citationDetailFromLookup(lookup),
      };
    });

    return {
      provider: "CourtListener",
      status: "checked",
      checkedAt: new Date().toISOString(),
      entries,
      notes: [
        "Case citation lookup ran through CourtListener. This verifies citation existence only; it does not Shepardize, KeyCite, Bluebook, or confirm the quoted holding.",
        "Statutes, rules, canons, local rules, and unpublished/procedural authority still need separate verification.",
      ],
    };
  } catch (error) {
    return {
      provider: "CourtListener",
      status: "error",
      checkedAt: new Date().toISOString(),
      entries: authorityLeads.slice(0, 30).map(authority => ({
        authority,
        kind: authorityKind(authority),
        status: isCaseAuthorityCandidate(authority)
          ? "not_checked"
          : "manual_required",
        citation: "",
        normalizedCitations: [],
        matches: [],
        detail:
          error instanceof Error
            ? `Citation verification failed: ${error.message.slice(0, 220)}`
            : "Citation verification failed.",
      })),
      notes: [
        "Citation lookup failed. Treat all authorities as unverified until a human or provider check succeeds.",
      ],
    };
  }
}

function buildLegalResearchCitationSpine(data: {
  template: ReportTemplate;
  findings: AgentFindingRecord[];
  citationVerification?: CitationVerificationReport;
}): string {
  const top = rankedFindings(data.findings, 8);
  const authorityRows = uniqueList(
    data.findings.flatMap(finding =>
      safeListItems(finding.legalAuthorities).map(authority =>
        JSON.stringify({
          authority,
          finding: finding.title,
          hook: finding.liabilityVector || "Needs legal hook",
          qc: finding.qcStatus,
        })
      )
    ),
    16
  ).map(row => JSON.parse(row) as {
    authority: string;
    finding: string;
    hook: string;
    qc: string;
  });
  const missingAuthorityRows = top.filter(
    finding => safeListItems(finding.legalAuthorities).length === 0
  );

  return [
	    "## Legal Research And Citation Spine",
	    "This is the legal-research control layer. It does not pretend authority is verified. It shows what can be cited, what still needs research, and how to turn findings into citation-safe argument paragraphs.",
	    "",
    "### Provider Verification Status",
    data.citationVerification
      ? [
          `- Provider: ${data.citationVerification.provider}.`,
          `- Status: ${humanize(data.citationVerification.status)}.`,
          data.citationVerification.checkedAt
            ? `- Checked: ${data.citationVerification.checkedAt}.`
            : "- Checked: not run.",
          ...data.citationVerification.notes.map(note => `- ${note}`),
        ].join("\n")
      : [
          "- Provider: none.",
          "- Status: not checked.",
          "- Connect CourtListener or another legal research provider before treating case citations as verified.",
        ].join("\n"),
    "",
    data.citationVerification?.entries.length
      ? [
          "### Citation Verification Ledger",
          "| Authority | Type | Verification status | Matched citation | Matches / notes |",
          "| --- | --- | --- | --- | --- |",
          ...data.citationVerification.entries.map(entry =>
            `| ${tableCell(entry.authority)} | ${tableCell(entry.kind)} | ${tableCell(humanize(entry.status))} | ${tableCell(entry.citation || entry.normalizedCitations[0] || "Needs manual verification")} | ${tableCell(entry.matches.length > 0 ? entry.matches.join("; ") : entry.detail)} |`
          ),
          "",
        ].join("\n")
      : "",
    "",
	    "### Citation Ledger",
	    authorityRows.length > 0
	      ? [
          "| Authority lead | Type | Supports issue | Verification posture |",
          "| --- | --- | --- | --- |",
          ...authorityRows.map(row =>
            `| ${tableCell(row.authority)} | ${tableCell(authorityKind(row.authority))} | ${tableCell(`${row.finding} - ${row.hook}`)} | ${tableCell(authorityVerificationTask(row.authority, data.template))} |`
          ),
        ].join("\n")
      : "No authority leads are attached to the selected findings. Do not write rule statements as if law has been verified; create a research task list first.",
    "",
    "### Missing Authority Research Tasks",
    missingAuthorityRows.length > 0
      ? [
          "| Issue needing law | Research target | Drafting risk if skipped |",
          "| --- | --- | --- |",
          ...missingAuthorityRows.map(finding =>
            `| ${tableCell(finding.title)} | ${tableCell(finding.liabilityVector || "Identify governing statute, rule, standard of review, elements, and remedy.")} | ${tableCell("The report may have facts but no legally usable rule; keep this as analysis or discovery demand until authority is verified.")} |`
          ),
        ].join("\n")
      : "Every top issue has at least one authority lead. Verification, hierarchy, pin cites, and current-law checks are still required.",
    "",
    "### Citation-Safe Drafting Rules",
    "- Do not cite a case, statute, rule, canon, or constitutional provision unless it appears in the authority ledger or has been independently verified by a human reviewer.",
    "- Separate binding authority, persuasive authority, statutes/rules, standards of review, and factual application.",
    "- Add pin cites, parentheticals, jurisdiction, year, and current-law status before treating any paragraph as filing-ready.",
    "- If authority is missing, draft the point as a research task, preservation issue, discovery demand, or cautious argument lead, not a final legal conclusion.",
    "- Every legal conclusion must connect: rule element -> source-supported fact -> adverse fact or limitation -> requested relief.",
    "",
    "### Citation-Ready Paragraph Pattern",
    "Use this pattern for every serious argument paragraph: governing rule to verify; record fact with source appendix cite; application in restrained language; adverse fact or missing proof; precise relief or next action. If any piece is missing, mark the paragraph `NEEDS RESEARCH` or `NEEDS SOURCE` instead of making it sound final.",
  ].join("\n");
}

export function reportPreflightError(
  input: ReportPreflightInput
): string | null {
  if (input.findings.length > 0) return null;
  if (input.legacyAgentOutputsIncluded) return null;

  const reasons = [
    input.selectedFindingIds && input.selectedFindingIds.length > 0
      ? "the selected finding filter did not include any report-ready findings"
      : null,
    input.minConfidence && input.minConfidence > 0
      ? `the minimum confidence filter is ${input.minConfidence}`
      : null,
  ].filter(Boolean);

  return [
    "No report-ready structured findings match this report scope.",
    reasons.length > 0 ? `Likely cause: ${reasons.join(" and ")}.` : null,
    "Run the Leverage Engine on the selected records, wait for QC to clear findings, lower the confidence threshold, or clear the selected-finding filter before generating a court-safe report.",
  ]
    .filter(Boolean)
    .join(" ");
}

export function buildPlainReport(data: {
  title: string;
  generatedAt: string;
  generatedBy: string;
  scope: ReportScope;
  template: ReportTemplate;
  draftCommand?: DraftCommand;
  filingPlan?: FilingPlan;
  filingMetadata?: FilingMetadata;
  marketProofPack?: MarketProofPack;
  citationVerification?: CitationVerificationReport;
  documents: DocumentRecord[];
  outputs: AgentOutputRecord[];
  legacyAgentOutputsIncluded: boolean;
  legacyAgentOutputsAvailable: number;
  findings: AgentFindingRecord[];
  executiveSummary: string;
}): string {
  const sourceList = data.documents.map(sourceAppendixLine).join("\n\n");
  const filingPlan =
    data.filingPlan ??
    buildFilingPlan({
      template: data.template,
      draftCommand: data.draftCommand,
      filingMetadata: data.filingMetadata,
      documents: data.documents,
      findings: data.findings,
    });
  const marketProofPack =
    data.marketProofPack ??
    buildMarketProofPack({
      template: data.template,
      draftCommand: data.draftCommand,
      filingPlan,
      documents: data.documents,
      findings: data.findings,
      legacyAgentOutputsIncluded: data.legacyAgentOutputsIncluded,
    });

  const outputList = data.legacyAgentOutputsIncluded
    ? data.outputs
        .map((output, index) => {
          const body = outputText(output);
          return `### ${index + 1}. ${output.agentName || output.agentId || "Agent Output"}\nDocument ID: ${output.documentId}\nSaved: ${formatDate(output.createdAt)}\n\n${body || "No saved output text."}`;
        })
        .join("\n\n")
    : [
        `${data.legacyAgentOutputsAvailable} saved legacy/freeform agent output${data.legacyAgentOutputsAvailable === 1 ? " was" : "s were"} excluded from this report.`,
        "Default reports use QC-cleared structured findings only. Legacy outputs can be useful brainstorming material, but they are not treated as court-ready findings.",
      ].join("\n");
  const topFindings = data.findings
    .slice()
    .sort((left, right) => {
      const leverageDelta = right.leverageScore - left.leverageScore;
      return leverageDelta !== 0
        ? leverageDelta
        : right.confidence - left.confidence;
    })
    .slice(0, 8)
    .map(topIssueLine)
    .join("\n\n");

  return [
    `# ${data.title}`,
    "",
    `**Prepared:** ${data.generatedAt}`,
    `**Prepared for:** ${data.generatedBy}`,
    `**Scope:** ${humanize(data.scope)}`,
    `**Packet type:** ${humanize(data.template)}`,
    "",
    filingMetadataReportSection(data.filingMetadata),
    "",
    "## Use And Reliability Notice",
    "This packet is a source-bound legal work product draft. It is designed to help a human reviewer understand the record, identify high-leverage issues, and decide what to verify or file next. It is not a substitute for attorney review. Default reports use QC-cleared structured findings only; unsupported accusations should appear as allegations, inferences, gaps, or records demands rather than proven facts.",
    "",
    buildMarketProofPackSection(marketProofPack),
    "",
    draftCommandReportSection(data.draftCommand),
    "",
    buildFilingDirectorPlanSection(filingPlan),
    "",
    "## Drafting Quality Standard",
    draftingQualityStandard(data.template),
    "",
    buildLegalResearchCitationSpine({
      template: data.template,
      findings: data.findings,
      citationVerification: data.citationVerification,
    }),
    "",
    buildAppellateWritPolishChecklist({
      template: data.template,
      draftCommand: data.draftCommand,
      filingMetadata: data.filingMetadata,
      documents: data.documents,
      findings: data.findings,
    }),
    "",
    buildCourtFacingReliefCalibration({
      template: data.template,
      draftCommand: data.draftCommand,
      filingPlan,
      findings: data.findings,
    }),
    "",
    "## Executive Summary",
    data.executiveSummary,
    "",
    buildWrittenOpinionAnalysis({
      template: data.template,
      findings: data.findings,
    }),
    "",
    buildOpinionBenchMemoControlSheet({
      template: data.template,
      findings: data.findings,
    }),
    "",
    buildIssueStandardPreservationMatrix({
      template: data.template,
      findings: data.findings,
    }),
    "",
    buildCourtDraftBlueprint({
      template: data.template,
      draftCommand: data.draftCommand,
      findings: data.findings,
    }),
    "",
    courtFilingSkeleton({
      sourceTemplate: data.template,
      draftCommand: data.draftCommand,
      filingMetadata: data.filingMetadata,
      filingPlan,
      issues: filingDraftIssuesFromFindings(data.findings),
    }),
    "",
    buildFilingQualityReview({
      template: data.template,
      draftCommand: data.draftCommand,
      filingMetadata: data.filingMetadata,
      documents: data.documents,
      findings: data.findings,
      legacyAgentOutputsIncluded: data.legacyAgentOutputsIncluded,
    }),
    "",
    buildFilingExecutionPlaybook({
      template: data.template,
      draftCommand: data.draftCommand,
      filingMetadata: data.filingMetadata,
      documents: data.documents,
      findings: data.findings,
    }),
    "",
    "## Highest-Leverage Issues",
    topFindings || "No report-ready findings were available for ranking.",
    "",
    data.template === "mandamus_writ"
      ? [
          "## Mandamus / Extraordinary Writ Viability",
          buildMandamusViabilitySection(data.findings),
          "",
        ].join("\n")
      : "",
    "## Issue Analysis",
    data.findings.map(findingText).join("\n\n") ||
      "No QC-cleared structured findings were available for the selected scope.",
    "",
    "## Missing Records And Discovery Targets",
    buildMissingRecordSection(data.findings),
    "",
    "## Source Appendix",
    sourceList || "No source documents selected.",
    "",
    "## QC And Report Safety Appendix",
    buildReliabilitySection({
      findings: data.findings,
      legacyAgentOutputsIncluded: data.legacyAgentOutputsIncluded,
      legacyAgentOutputsAvailable: data.legacyAgentOutputsAvailable,
    }),
    "",
    "## Legacy / Freeform Agent Outputs",
    outputList ||
      "No saved agent outputs were available for the selected scope.",
  ].join("\n");
}

export function buildFilingDraftPacket(input: {
  title: string;
  sourceReportTitle: string;
  sourceReportId?: number;
  generatedAt: string;
  generatedBy: string;
  sourceTemplate: ReportTemplate;
  sourceScope: string;
  sourceMarkdown: string;
  draftCommand: DraftCommand;
  filingMetadata: FilingMetadata;
  filingPlan?: FilingPlan;
}): string {
  const sections = parseMarkdownSections(input.sourceMarkdown);
  const polish = findMarkdownSection(sections, [
    "polish checklist",
    "quality gate",
  ]);
  const reliefCalibration = findMarkdownSection(sections, [
    "court-facing relief calibration",
    "relief calibration",
  ]);
  const blueprint = findMarkdownSection(sections, [
    "court-ready drafting blueprint",
    "drafting blueprint",
  ]);
  const playbook = findMarkdownSection(sections, [
    "filing execution playbook",
    "execution playbook",
  ]);
  const executive = findMarkdownSection(sections, ["executive summary"]);
  const highestLeverage = findMarkdownSection(sections, [
    "highest-leverage issues",
    "highest leverage issues",
  ]);
  const issueAnalysis = findMarkdownSection(sections, ["issue analysis"]);
  const missingRecords = findMarkdownSection(sections, [
    "missing records",
    "discovery targets",
  ]);
  const sourceAppendix = findMarkdownSection(sections, ["source appendix"]);
  const qcAppendix = findMarkdownSection(sections, [
    "qc and report safety",
    "report safety appendix",
  ]);
  const sourceBoundIssues = parseFilingDraftIssues(issueAnalysis);
  const commandLines = draftCommandLines(input.draftCommand);
  const metadataLines = filingMetadataLines(input.filingMetadata);
  const keyIssues = input.draftCommand?.keyIssues?.filter(Boolean) ?? [];
  const filingTitle =
    input.filingMetadata?.filingTitle ||
    input.draftCommand?.filingType ||
    input.title;
  const requestedRelief =
    input.draftCommand?.requestedRelief ||
    input.filingPlan?.theoryOfFiling ||
    "State the exact relief only after the record and authority gates are satisfied.";
  const responseTarget =
    input.draftCommand?.respondingTo ||
    "No response target was supplied. Identify the order, motion, refusal, delay, missing record, or adverse action before filing.";
  const questionLines =
    keyIssues.length > 0
      ? keyIssues.map(
          (issue, index) =>
            `${index + 1}. Whether the record and governing law support relief on: ${issue}.`
        )
      : [
          "1. Whether the selected record supports the requested filing posture and relief.",
          "2. Whether any missing records, adverse facts, or authority gaps prevent court-facing use.",
        ];
  const planWarnings = input.filingPlan?.warnings ?? [];
  const planProof = input.filingPlan?.proofRequirements ?? [];
  const planQuestions = input.filingPlan?.nextQuestions ?? [];
  const planChecklist = input.filingPlan?.exportChecklist ?? [];
  const handoffAvailable = Boolean(blueprint || playbook || polish);

  return [
    `# ${input.title}`,
    "",
    `**Prepared:** ${input.generatedAt}`,
    `**Prepared for:** ${input.generatedBy}`,
    `**Source report:** ${input.sourceReportTitle}${input.sourceReportId ? ` (#${input.sourceReportId})` : ""}`,
    `**Source packet type:** ${humanize(input.sourceTemplate)}`,
    `**Source scope:** ${humanize(input.sourceScope)}`,
    "",
    "## Filing Draft Status",
    `**Draft readiness:** ${filingDraftReadinessLabel(input.filingPlan)}`,
    "",
    handoffAvailable
      ? "This is a structured filing draft handoff generated from the saved report's quality gate, drafting blueprint, execution playbook, QC-cleared findings, and source appendix."
      : "This draft was generated from a saved report, but the expected blueprint/playbook sections were missing. Treat this as an outline requiring human reconstruction before filing.",
    "",
    "This is not a final pleading. Before filing, a human reviewer must verify current law, local rules, deadlines, caption requirements, service, appendix completeness, adverse facts, and every quoted fact against the source record.",
    "",
    filingMetadataReportSection(input.filingMetadata),
    "",
    draftCommandReportSection(input.draftCommand),
    "",
    input.filingPlan
      ? buildFilingDirectorPlanSection(input.filingPlan)
      : [
          "## Filing Director Plan",
          "No filing plan was attached. Build or verify the route before drafting a court-facing filing.",
        ].join("\n"),
    "",
    filingReadinessMatrix({
      sourceTemplate: input.sourceTemplate,
      draftCommand: input.draftCommand,
      filingMetadata: input.filingMetadata,
      filingPlan: input.filingPlan,
      issues: sourceBoundIssues,
    }),
    "",
    reliefCalibration?.content ||
      [
        "## Court-Facing Relief Calibration",
        "The source report did not include a relief-calibration section. Before filing, a human reviewer must verify that the requested relief fits the procedural vehicle, forum authority, source record, current law, deadline, caption, service, and local rules.",
      ].join("\n"),
    "",
    appellateWritFramingScaffold({
      sourceTemplate: input.sourceTemplate,
      draftCommand: input.draftCommand,
      filingPlan: input.filingPlan,
      questionLines,
      issues: sourceBoundIssues,
    }),
    "",
    mandamusElementApplication({
      sourceTemplate: input.sourceTemplate,
      draftCommand: input.draftCommand,
      filingPlan: input.filingPlan,
      issues: sourceBoundIssues,
    }),
    "",
    writtenOpinionAnalysisScaffold({
      draftCommand: input.draftCommand,
      questionLines,
      issues: sourceBoundIssues,
    }),
    "",
    courtFilingSkeleton({
      sourceTemplate: input.sourceTemplate,
      draftCommand: input.draftCommand,
      filingMetadata: input.filingMetadata,
      filingPlan: input.filingPlan,
      issues: sourceBoundIssues,
    }),
    "",
    "## Questions Presented",
    questionLines.join("\n"),
    "",
    "## Preliminary Statement Draft Source",
    cleanMarkdownExcerpt(executive, 1800) ||
      "Use the generated report's executive summary only after confirming it is source-bound and court-safe.",
    "",
    "## Record Statement Draft Source",
    cleanMarkdownExcerpt(blueprint, 2200) ||
      cleanMarkdownExcerpt(sourceAppendix, 2200) ||
      "No record-statement source was found. Draft no factual statement until source anchors and appendix materials are available.",
    "",
    "## Argument Outline",
    cleanMarkdownExcerpt(highestLeverage, 1400) ||
      cleanMarkdownExcerpt(issueAnalysis, 1800) ||
      cleanMarkdownExcerpt(blueprint, 1800) ||
      "No argument outline was found. Use QC-cleared findings only; do not rely on freeform agent output.",
    "",
    buildIssueEvidenceDraftMatrix(sourceBoundIssues),
    "",
    buildSourceBoundArgumentSections(sourceBoundIssues, input.sourceTemplate),
    "",
    "## Relief Requested",
    `Requested relief / command: ${requestedRelief}`,
    `Draft responds to: ${responseTarget}`,
    input.sourceTemplate === "mandamus_writ"
      ? "Mandamus gate: identify the clear legal duty, refusal or delay, beneficial interest, lack of plain/speedy/adequate ordinary remedy, appendix proof, and exact narrow command before filing."
      : "Filing gate: match the requested relief to the procedural vehicle and separate motion practice, appeal, habeas, mandamus, civil-rights damages, and discipline paths.",
    "",
    "## Source And Appendix Build",
    cleanMarkdownExcerpt(sourceAppendix, 2600) ||
      "No source appendix was found. Do not file until source documents, hashes, quotes, and appendix materials are attached.",
    "",
    "## Missing Proof And Blockers",
    [
      cleanMarkdownExcerpt(polish, 1600),
      cleanMarkdownExcerpt(playbook, 1800),
      cleanMarkdownExcerpt(missingRecords, 1800),
      planProof.length > 0
        ? [
            "### Proof Requirements",
            ...planProof.map(item => `- ${item}`),
          ].join("\n")
        : "",
      planWarnings.length > 0
        ? [
            "### Filing Warnings",
            ...planWarnings.map(item => `- ${item}`),
          ].join("\n")
        : "",
      planQuestions.length > 0
        ? [
            "### Questions To Answer Before Filing",
            ...planQuestions.map(item => `- ${item}`),
          ].join("\n")
        : "",
    ]
      .filter(Boolean)
      .join("\n\n") ||
      "No explicit blockers were extracted. Human review must still test authority, adverse facts, local rules, and appendix proof.",
    "",
    "## Human Filing Review Checklist",
    [
      "- Verify current statutes, rules, controlling cases, standards of review, and local court formatting.",
      "- Verify every factual sentence against a source document, quote, transcript line, exhibit, docket entry, or declaration.",
      "- Convert missing records into demands or appendix tasks, not proven accusations.",
      "- Add adverse facts and opposing arguments before filing.",
      "- Confirm caption, parties, jurisdiction, case number, service list, signature block, verification/declaration, and proposed-order needs.",
      ...planChecklist.map(item => `- ${item}`),
    ].join("\n"),
    "",
    "## QC And Reliability Source",
    cleanMarkdownExcerpt(qcAppendix, 2200) ||
      "No QC appendix was found in the source report. Do not treat the draft as court-facing until QC status is visible.",
    "",
    "## Draft Assembly Notes",
    metadataLines.length > 0
      ? metadataLines.join("\n")
      : "- Caption metadata is incomplete.",
    commandLines.length > 0
      ? commandLines.join("\n")
      : "- Filing command is incomplete.",
  ].join("\n");
}

async function getScopedDocuments(input: {
  userId: number;
  scope: ReportScope;
  caseId?: number;
  documentIds?: number[];
  fromDate?: string;
  toDate?: string;
}): Promise<DocumentRecord[]> {
  const db = await getDb();
  if (!db)
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Database not available",
    });

  const allDocuments = await db
    .select()
    .from(documents)
    .where(eq(documents.userId, input.userId))
    .orderBy(desc(documents.createdAt));
  let candidateDocuments = allDocuments;
  let caseDocumentIdSet: Set<number> | null = null;

  if (input.caseId !== undefined) {
    const caseRecord = await db
      .select({ id: workspaceCases.id })
      .from(workspaceCases)
      .where(
        and(
          eq(workspaceCases.id, input.caseId),
          eq(workspaceCases.userId, input.userId)
        )
      )
      .limit(1);

    if (caseRecord.length === 0) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Workspace case not found.",
      });
    }

    const memberships = await db
      .select({ documentId: caseDocuments.documentId })
      .from(caseDocuments)
      .where(
        and(
          eq(caseDocuments.caseId, input.caseId),
          eq(caseDocuments.userId, input.userId)
        )
      );
    caseDocumentIdSet = new Set(
      memberships.map(membership => membership.documentId)
    );
    candidateDocuments = allDocuments.filter(document =>
      caseDocumentIdSet?.has(document.id)
    );
  }

  if (input.scope === "files") {
    const selectedIds = Array.from(new Set(input.documentIds ?? []));
    if (selectedIds.length === 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Choose one or more files for this report.",
      });
    }
    if (
      caseDocumentIdSet &&
      selectedIds.some(documentId => !caseDocumentIdSet?.has(documentId))
    ) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Selected files are not assigned to this workspace case.",
      });
    }
    return candidateDocuments.filter(document =>
      selectedIds.includes(document.id)
    );
  }

  if (input.scope === "time") {
    const fromDate = parseDateBound(input.fromDate, false);
    const toDate = parseDateBound(input.toDate, true);
    if (!fromDate && !toDate) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Choose a start date, end date, or both.",
      });
    }
    return candidateDocuments.filter(document => {
      const createdAt =
        document.createdAt instanceof Date
          ? document.createdAt
          : new Date(document.createdAt);
      if (Number.isNaN(createdAt.getTime())) return false;
      if (fromDate && createdAt < fromDate) return false;
      if (toDate && createdAt > toDate) return false;
      return true;
    });
  }

  return candidateDocuments;
}

async function getOutputsForDocuments(
  documentIds: number[]
): Promise<AgentOutputRecord[]> {
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

  return allFindings.filter(finding => {
    if (selectedFindingIdSet.size > 0 && !selectedFindingIdSet.has(finding.id))
      return false;
    if (!findingMatchesDocuments(finding, documentIdSet)) return false;
    if (!input.includeBlockedFindings && !finding.includedInReports)
      return false;
    if (!input.includeBlockedFindings && !isReportEligible(finding.qcStatus))
      return false;
    if (finding.confidence < (input.minConfidence ?? 0)) return false;
    return true;
  });
}

async function getOwnedGeneratedReport(id: number, userId: number) {
  const report = await getGeneratedReportById(id);
  if (!report || report.userId !== userId) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Saved report not found.",
    });
  }
  return report;
}

function currentEditableSections(
  report: NonNullable<GeneratedReportRecord>,
  latestRevision?: Awaited<ReturnType<typeof getLatestReportRevision>>
): EditableReportSection[] {
  if (latestRevision) {
    const revisionSections = parseEditableReportSections(latestRevision.sections);
    if (revisionSections.length > 0) return revisionSections;
  }
  const { root } = reportMetaObject(report);
  const metadataSections = safeEditableReportSections(root.sections);
  if (metadataSections.length > 0) return metadataSections;
  return buildEditableReportSections({ markdown: markdownFromStoredReport(report) });
}

function currentRevisionMarkdown(
  report: NonNullable<GeneratedReportRecord>,
  latestRevision?: Awaited<ReturnType<typeof getLatestReportRevision>>
) {
  if (latestRevision?.markdown) return latestRevision.markdown;
  return markdownFromStoredReport(report);
}

async function saveReportRevisionFromSections(input: {
  report: NonNullable<GeneratedReportRecord>;
  userId: number;
  title?: string;
  sections: EditableReportSection[];
  editReason?: string;
}) {
  const normalizedSections = normalizeEditableSections(input.sections);
  const markdown = markdownFromEditableSections(normalizedSections);
  if (!markdown.trim()) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "At least one included section must contain text before saving.",
    });
  }
  const revision = await createReportRevision({
    reportId: input.report.id,
    userId: input.userId,
    title: truncateForColumn(
      input.title?.trim() || input.report.title || "DueProcess Report",
      255
    ),
    markdown,
    sections: JSON.stringify(normalizedSections),
    editReason: truncateForColumn(input.editReason?.trim() || "Edited packet", 255),
  });
  return revisionSummary(revision);
}

export const reportRouter = router({
  refineDraftCommand: protectedProcedure
    .input(
      z.object({
        message: z.string().min(1).max(2500),
        currentTemplate: reportTemplateSchema.default("court_packet"),
        currentCommand: draftCommandSchema,
        currentFilingMetadata: filingMetadataSchema,
        currentKeyIssues: z.array(z.string().max(240)).max(12).optional(),
        chatHistory: z.array(draftChatMessageSchema).max(12).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await enforceReportGenerationAccess(ctx.user);

      try {
        const assistantResponse = await invokeLLM({
          responseFormat: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: `You are DueProcess AI's filing-command assistant. Your job is to turn the user's plain-English drafting direction into a structured report command. You do not draft the filing. You do not analyze facts. You do not invent evidence, dates, parties, case law, or accusations. You only decide the best report template, filing posture, requested relief, key issues, warnings, and a short assistant reply.

Return only valid JSON with this exact shape:
{
  "assistantReply": "short plain-English confirmation and next useful question or warning",
	  "template": "court_packet | case_strategy | written_opinion | evidence_chronology | immunity_relief | mandamus_writ | discovery_demands | source_appendix | executive_summary",
  "reportTitle": "optional concise title",
  "draftCommand": {
    "filingType": "optional",
    "respondingTo": "optional",
    "courtLevel": "optional",
    "proceduralPosture": "optional",
    "requestedRelief": "optional",
    "keyIssues": ["max 12 short issue labels"],
    "oppositionPosition": "optional",
    "draftingStyle": "optional",
    "additionalInstructions": "optional"
  },
  "filingMetadata": {
    "courtName": "optional",
    "jurisdiction": "optional",
    "caseNumber": "optional",
    "petitioner": "optional",
    "respondent": "optional",
    "plaintiff": "optional",
    "defendant": "optional",
    "filingTitle": "optional",
    "filingSubtitle": "optional",
    "preparedFor": "optional"
  },
  "filingPlan": {
    "routeLabel": "short filing route label",
    "readiness": "draft_ready | human_review_required | records_first | do_not_file_yet",
    "theoryOfFiling": "one-sentence theory of what the filing is trying to do",
    "issueArchitecture": [{"label":"issue heading","status":"proof status","detail":"how to use it"}],
    "proofRequirements": ["proof required before filing"],
    "missingCommandFields": ["filing type | response target | requested relief | priority issues | court | case number | parties | filing title"],
    "warnings": ["court-safety warnings"],
    "nextQuestions": ["questions the user should answer next"],
    "exportChecklist": ["checks before PDF/DOCX export"]
  },
  "warnings": ["max 6 short court-safety warnings"]
}

Template rules:
- Use mandamus_writ for mandamus, prohibition, writ, refusal to rule, missing written findings, record-settlement, clerk refusal, or narrow command issues.
- Use written_opinion for bench memos, written-opinion style, proposed findings, proposed conclusions of law, reasoned disposition, or "make it read like a judge wrote it" requests.
- Use discovery_demands for missing records, subpoenas, public records, Brady demand, discovery packet, or "what records do we need" requests.
- Use source_appendix for source appendices, exhibit ledgers, quote ledgers, citation/source tables, hash verification packets, or "show me the evidence behind the report" requests.
- Use evidence_chronology for timeline, contradiction, date-window, or gap-mapping requests.
- Use immunity_relief for judicial/prosecutorial/qualified immunity, non-damages relief, habeas, recusal, appeal, or supervisory-review routing.
- Use case_strategy for appellate issue strategy, broad litigation strategy, win paths, or multi-claim triage.
- Use court_packet for motion-ready issue packets, opposition/reply packets, sanctions/suppression/dismissal packets, or general court-facing reports.
- Use executive_summary only for a short skim brief or reviewer brief.

Mandamus rules:
- Do not treat every bad ruling as mandamus.
- Include key issues for clear legal duty, beneficial interest, no plain/speedy/adequate remedy, appendix proof, discretionary barrier, and exact command when relevant.
- Requested relief should be narrow: rule, make findings, accept/settle record, hold hearing, produce record, or perform a specific legal duty.

Style rules:
- Use "Mandamus petition quality" for writs, "Written opinion quality" for written_opinion, "Written opinion style" for appellate strategy, "Aggressive but court-safe" for opposition/reply, and "Attorney handoff memo" for discovery.
- Preserve existing command and filingMetadata fields unless the user clearly changes them. Return caption/case metadata when the user supplies court, case number, parties, filing title, or prepared-for details.
- If the user asks for accusations not supported by record proof, add a warning and frame as missing-record demand or inference, not proven misconduct.`,
            },
            {
              role: "user",
              content: draftAssistantPrompt({
                message: input.message,
                currentTemplate: input.currentTemplate,
                currentCommand: input.currentCommand,
                currentFilingMetadata: input.currentFilingMetadata,
                currentKeyIssues: input.currentKeyIssues,
                chatHistory: input.chatHistory,
              }),
            },
          ],
        });

        const usage = usageFromResponse(assistantResponse);
        if (usage.totalTokens > 0) {
          await createLlmUsageEvent({
            userId: ctx.user.id,
            operation: "draft_command_chat",
            model: usage.model,
            promptTokens: usage.promptTokens,
            completionTokens: usage.completionTokens,
            totalTokens: usage.totalTokens,
            estimatedCostCents: usage.estimatedCostCents,
          });
        }

        return parseDraftAssistantResponse(llmContentText(assistantResponse));
      } catch (error) {
        const fallback = buildDeterministicDraftAssistantResponse({
          message: input.message,
          currentTemplate: input.currentTemplate,
          currentCommand: input.currentCommand,
          currentFilingMetadata: input.currentFilingMetadata,
          currentKeyIssues: input.currentKeyIssues,
          chatHistory: input.chatHistory,
        });
        return {
          ...fallback,
          assistantReply: `${fallback.assistantReply} I used the deterministic filing router because the AI command parser was unavailable or returned invalid structure.`,
          warnings: [
            ...fallback.warnings,
            error instanceof Error
              ? `Assistant fallback used: ${error.message.slice(0, 180)}`
              : "Assistant fallback used.",
          ].slice(0, 6),
        };
      }
    }),

  generate: protectedProcedure
    .input(
      z.object({
        scope: reportScopeSchema.default("case"),
        caseId: z.number().optional(),
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
        includeLegacyAgentOutputs: z.boolean().default(false),
        draftCommand: draftCommandSchema,
        filingMetadata: filingMetadataSchema,
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
      const scopedDocumentIds =
        input.documentIds ??
        (input.documentId ? [input.documentId] : undefined);
      const selectedDocuments = await getScopedDocuments({
        userId: ctx.user.id,
        scope: input.scope,
        caseId: input.caseId,
        documentIds: scopedDocumentIds,
        fromDate: input.fromDate,
        toDate: input.toDate,
      });

      if (selectedDocuments.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No documents match this report scope.",
        });
      }
      await enforcePageAnalysisLimit(
        ctx.user,
        selectedDocuments,
        "report generation"
      );

      const outputs = await getOutputsForDocuments(
        selectedDocuments.map(document => document.id)
      );
      const legacyAgentOutputsIncluded =
        ctx.user.role === "admin" && input.includeLegacyAgentOutputs;
      const blockedFindingsIncluded =
        ctx.user.role === "admin" && input.includeBlockedFindings;
      const outputsForReport = legacyAgentOutputsIncluded ? outputs : [];
      const previewFindings = await getFindingsForScope({
        userId: ctx.user.id,
        documentIds: selectedDocuments.map(document => document.id),
        minConfidence: input.minConfidence,
        includeBlockedFindings: blockedFindingsIncluded,
      });
      const selectedFindingIdSet = new Set(input.selectedFindingIds ?? []);
      const reportFindings =
        selectedFindingIdSet.size > 0
          ? previewFindings.filter(finding =>
              selectedFindingIdSet.has(finding.id)
            )
          : previewFindings;
      const preflightError = reportPreflightError({
        findings: reportFindings,
        legacyAgentOutputsIncluded,
        selectedFindingIds: input.selectedFindingIds,
        minConfidence: input.minConfidence,
      });
      if (preflightError) {
        throw new TRPCError({ code: "BAD_REQUEST", message: preflightError });
      }
      const evidenceDigest = selectedDocuments
        .map(
          (document, index) =>
            `DOCUMENT ${index + 1}\n${reportSourceDigest(document, legacyAgentOutputsIncluded)}`
        )
        .join("\n\n---\n\n")
        .slice(0, 30000);
      const agentDigest = outputsForReport
        .map(
          (output, index) =>
            `${index + 1}. ${output.agentName || output.agentId || "Agent"}\n${outputText(output).slice(0, 3000)}`
        )
        .join("\n\n")
        .slice(0, 30000);
      const findingDigest = reportFindings
        .map((finding, index) => `${index + 1}. ${findingText(finding)}`)
        .join("\n\n")
        .slice(0, 30000);

      const rawTitle =
        input.branding?.title ||
        input.filingMetadata?.filingTitle ||
        (draftCommandHasContent(input.draftCommand) &&
        input.draftCommand?.filingType
          ? `${input.draftCommand.filingType}: ${selectedDocuments.length} Source${selectedDocuments.length === 1 ? "" : "s"}`
          : `${templateInstruction(input.template).split(".")[0]}: ${selectedDocuments.length} Source${selectedDocuments.length === 1 ? "" : "s"}`);
      const title = truncateForColumn(
        rawTitle.trim() || "DueProcess Report",
        255
      );
      const generatedAt = new Date().toISOString();
      const filingMetadataText =
        filingMetadataLines(input.filingMetadata).join("\n") ||
        "No caption metadata supplied.";
      const filingPlan = buildFilingPlan({
        template: input.template,
        draftCommand: input.draftCommand,
        filingMetadata: input.filingMetadata,
        documents: selectedDocuments,
        findings: reportFindings,
      });
      const marketProofPack = buildMarketProofPack({
        template: input.template,
        draftCommand: input.draftCommand,
        filingPlan,
        documents: selectedDocuments,
        findings: reportFindings,
        legacyAgentOutputsIncluded,
      });
      const citationVerification = await verifyReportCitations({
        userId: ctx.user.id,
        findings: reportFindings,
      });

      let executiveSummary = buildDeterministicExecutiveSummary({
        scope: input.scope,
        template: input.template,
        fromDate: input.fromDate,
        toDate: input.toDate,
        minConfidence: input.minConfidence,
        selectedFindingIds: input.selectedFindingIds,
        legacyAgentOutputsIncluded,
        legacyAgentOutputsAvailable: outputs.length,
        draftCommand: input.draftCommand,
        filingMetadata: input.filingMetadata,
        filingPlan,
        documents: selectedDocuments,
        findings: reportFindings,
      });

      try {
        const summaryResponse = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are DueProcess AI's senior legal report editor. Write in restrained, professional, court-safe plain English at appellate-work-product quality. Make the report easy for a judge, attorney, investigator, or pro se litigant to follow. Separate proven record facts, allegations, inferences, adverse facts, and missing-record demands. Never convert a party allegation into a proven fact. Never call misconduct, bad faith, conspiracy, fraud, retaliation, Brady/Napue, Monell, or immunity-piercing proven unless the supplied QC-cleared findings and quotes actually support that exact statement. Prefer "the record supports," "the record indicates," "the filing alleges," "the safer demand is," and "needs verification" when appropriate. Use written-opinion discipline: issue, rule, record facts, application, limits, and remedy. For citations and legal research, use only supplied authority leads; do not invent cases, statutes, canons, rules, citations, quotations, pin cites, or holdings. Mark authority as needing current-law verification unless the supplied material proves it is verified. Use headings, short paragraphs, and numbered practical next steps. ${templateInstruction(input.template)} ${draftingQualityStandard(input.template)}`,
            },
            {
              role: "user",
              content: [
                "Create only the Executive Summary section for the report. Do not repeat the full appendix. Use this structure:",
                "",
                "1. Filing posture and requested work product.",
                "2. What the record most strongly shows.",
                "3. Why it matters legally.",
                "4. What is still missing or needs verification.",
                "5. The top practical next moves.",
                "",
                "Keep it professional, concise, and draft-ready. Use source document names when helpful. Do not invent facts beyond the QC-cleared findings.",
                "",
                "DRAFTING COMMAND:",
                draftCommandText(input.draftCommand),
                "",
                "FILING DIRECTOR PLAN:",
                JSON.stringify(filingPlan, null, 2),
                "",
                "CAPTION / FILING METADATA:",
                filingMetadataText,
                "",
                `Scope: ${input.scope}`,
                input.caseId
                  ? `Workspace case ID: ${input.caseId}`
                  : "Workspace case ID: whole workspace",
                `Date focus: ${input.fromDate || "case start"} to ${input.toDate || "case end"}`,
                `Minimum confidence: ${input.minConfidence}`,
                `Blocked findings included: ${blockedFindingsIncluded ? "yes - admin override" : "no"}`,
                `Legacy/freeform agent outputs included: ${legacyAgentOutputsIncluded ? "yes - admin unsafe reference override" : "no - excluded by default"}`,
                "",
                "SOURCE DOCUMENTS:",
                evidenceDigest,
                "",
                "QC-CLEARED STRUCTURED FINDINGS:",
                findingDigest ||
                  "No QC-cleared structured findings available. State that no report-ready findings are available instead of inventing claims.",
                "",
                "LEGACY/FREEFORM AGENT OUTPUTS:",
                agentDigest ||
                  "Excluded from generation context. Do not rely on saved freeform outputs for factual claims.",
              ].join("\n"),
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

        const summaryContent = summaryResponse.choices[0]?.message?.content;
        if (
          typeof summaryContent === "string" &&
          summaryContent.trim().length > 0
        ) {
          executiveSummary = summaryContent;
        }
      } catch (error) {
        console.warn(
          "[Reports] Executive summary generation failed; using deterministic fallback.",
          error
        );
      }

      const markdown = buildPlainReport({
        title,
        generatedAt,
        generatedBy: ctx.user.name || ctx.user.email || "DueProcess AI User",
        scope: input.scope,
        template: input.template,
        draftCommand: input.draftCommand,
        filingPlan,
        filingMetadata: input.filingMetadata,
        marketProofPack,
        citationVerification,
        documents: selectedDocuments,
        outputs: outputsForReport,
        legacyAgentOutputsIncluded,
        legacyAgentOutputsAvailable: outputs.length,
        findings: reportFindings,
        executiveSummary,
      });
      const editableSections = buildEditableReportSections({
        markdown,
        documents: selectedDocuments,
        findings: reportFindings,
      });

      const reportData = {
        metadata: {
          title,
          generatedAt,
          generatedBy: ctx.user.name || ctx.user.email || "DueProcess AI User",
          scope: input.scope,
          template: input.template,
          format: input.format,
          caseId: input.caseId ?? null,
          draftCommand: input.draftCommand ?? null,
          filingPlan,
          filingMetadata: input.filingMetadata ?? null,
          marketProofPack,
          citationVerification,
          dateFocus: {
            fromDate: input.fromDate || null,
            toDate: input.toDate || null,
          },
        },
        documents: selectedDocuments.map(document => ({
          id: document.id,
          fileName: document.fileName,
          mimeType: document.mimeType,
          fileSize: document.fileSize,
          status: document.status,
          analysisReady: isDocumentReadyForAnalysis(document),
          documentHash: document.documentHash,
          extractionQualityScore: document.extractionQualityScore,
          uploadedAt: formatDate(document.createdAt),
          fileUrl: input.includeSources ? document.fileUrl : undefined,
        })),
        statistics: {
          documents: selectedDocuments.length,
          savedAgentOutputs: outputs.length,
          readyDocuments: selectedDocuments.filter(isDocumentReadyForAnalysis)
            .length,
          structuredFindings: reportFindings.length,
          blockedFindingsIncluded,
          legacyAgentOutputsIncluded,
          legacyAgentOutputsAvailable: outputs.length,
        },
        findings: previewFindings.map(finding => ({
          id: finding.id,
          title: finding.title,
          agentName: finding.agentName,
          findingType: finding.findingType,
          confidence: finding.confidence,
          leverageScore: finding.leverageScore,
          qcStatus: finding.qcStatus,
          includedInReports: Boolean(finding.includedInReports),
        })),
        sections: editableSections,
        executiveSummary,
        markdown,
      };

      const content = reportContent({
        format: input.format,
        markdown,
        title,
        reportData,
      });
      const fileName = buildReportFileName(title, input.format);
      const savedReport = await createGeneratedReport({
        userId: ctx.user.id,
        title,
        template: input.template,
        scope: input.scope,
        format: input.format,
        fileName,
        documentIds: JSON.stringify(
          selectedDocuments.map(document => document.id)
        ),
        selectedFindingIds: JSON.stringify(input.selectedFindingIds ?? []),
        minConfidence: input.minConfidence,
        includeBlockedFindings: blockedFindingsIncluded ? 1 : 0,
        content,
        metadata: JSON.stringify({
          caseId: input.caseId ?? null,
          metadata: reportData.metadata,
          draftCommand: input.draftCommand ?? null,
          filingPlan,
          filingMetadata: input.filingMetadata ?? null,
          marketProofPack,
          documents: reportData.documents,
          statistics: reportData.statistics,
          findings: reportData.findings,
          sections: editableSections,
          markdown,
          executiveSummaryExcerpt: executiveSummary.slice(0, 4000),
        }),
      });
      const initialRevision = await createReportRevision({
        reportId: savedReport.id,
        userId: ctx.user.id,
        title,
        markdown,
        sections: JSON.stringify(editableSections),
        editReason: "Initial generated packet",
      });

      return {
        id: savedReport.id,
        reportId: savedReport.id,
        latestRevision: revisionSummary(initialRevision),
        format: input.format,
        data: reportData,
        content,
        fileName,
        createdAt: savedReport.createdAt,
      };
    }),

  generateFilingDraft: protectedProcedure
    .input(
      z.object({
        reportId: z.number(),
        format: reportFormatSchema.default("markdown"),
        title: z.string().max(240).optional(),
        draftCommand: draftCommandSchema,
        filingMetadata: filingMetadataSchema,
      })
    )
    .mutation(async ({ input, ctx }) => {
      await enforceDraftAccess(ctx.user);

      const sourceReport = await getOwnedGeneratedReport(
        input.reportId,
        ctx.user.id
      );
      const { root, metadata } = reportMetaObject(sourceReport);
      const sourceTemplate =
        parseStoredReportTemplate(sourceReport.template) ??
        parseStoredReportTemplate(metadata.template) ??
        "court_packet";
      const sourceMarkdown = markdownFromStoredReport(sourceReport);
      const draftCommand =
        input.draftCommand ??
        parseStoredDraftCommand(root.draftCommand ?? metadata.draftCommand);
      const filingMetadata =
        input.filingMetadata ??
        parseStoredFilingMetadata(
          root.filingMetadata ?? metadata.filingMetadata
        );
      const filingPlan =
        parseStoredFilingPlan(root.filingPlan ?? metadata.filingPlan) ??
        buildFilingPlan({
          template: sourceTemplate,
          draftCommand,
          filingMetadata,
        });
      const generatedAt = new Date().toISOString();
      const generatedBy =
        ctx.user.name || ctx.user.email || "DueProcess AI User";
      const filingTitle =
        input.title?.trim() ||
        filingMetadata?.filingTitle ||
        draftCommand?.filingType ||
        `Filing Draft: ${sourceReport.title}`;
      const title = truncateForColumn(filingTitle, 255);
      const markdown = buildFilingDraftPacket({
        title,
        sourceReportTitle: sourceReport.title,
        sourceReportId: sourceReport.id,
        generatedAt,
        generatedBy,
        sourceTemplate,
        sourceScope: sourceReport.scope,
        sourceMarkdown,
        draftCommand,
        filingMetadata,
        filingPlan,
      });
      const editableSections = buildEditableReportSections({
        markdown,
      });
      const sourceDocuments = Array.isArray(root.documents)
        ? root.documents
        : [];
      const sourceFindings = Array.isArray(root.findings) ? root.findings : [];
      const sourceStatistics = isPlainRecord(root.statistics)
        ? root.statistics
        : {};
      const reportData = {
        metadata: {
          title,
          generatedAt,
          generatedBy,
          scope: sourceReport.scope,
          template: sourceTemplate,
          format: input.format,
          reportKind: "filing_draft",
          sourceReportId: sourceReport.id,
          sourceReportTitle: sourceReport.title,
          draftCommand: draftCommand ?? null,
          filingPlan,
          filingMetadata: filingMetadata ?? null,
        },
        documents: sourceDocuments,
        statistics: {
          ...sourceStatistics,
          sourceReportId: sourceReport.id,
          filingDraftArtifact: true,
        },
        findings: sourceFindings,
        sections: editableSections,
        markdown,
      };
      const content = reportContent({
        format: input.format,
        markdown,
        title,
        reportData,
      });
      const fileName = buildReportFileName(title, input.format);
      const savedReport = await createGeneratedReport({
        userId: ctx.user.id,
        title,
        template: sourceTemplate,
        scope: sourceReport.scope,
        format: input.format,
        fileName,
        documentIds: sourceReport.documentIds,
        selectedFindingIds: sourceReport.selectedFindingIds,
        minConfidence: sourceReport.minConfidence,
        includeBlockedFindings: sourceReport.includeBlockedFindings,
        content,
        metadata: JSON.stringify({
          metadata: reportData.metadata,
          reportKind: "filing_draft",
          sourceReport: {
            id: sourceReport.id,
            title: sourceReport.title,
            template: sourceReport.template,
            scope: sourceReport.scope,
            createdAt: sourceReport.createdAt,
          },
          draftCommand: draftCommand ?? null,
          filingPlan,
          filingMetadata: filingMetadata ?? null,
          documents: sourceDocuments,
          statistics: reportData.statistics,
          findings: sourceFindings,
          sections: editableSections,
          markdown,
        }),
      });
      const initialRevision = await createReportRevision({
        reportId: savedReport.id,
        userId: ctx.user.id,
        title,
        markdown,
        sections: JSON.stringify(editableSections),
        editReason: "Initial generated filing draft",
      });

      return {
        id: savedReport.id,
        reportId: savedReport.id,
        sourceReportId: sourceReport.id,
        latestRevision: revisionSummary(initialRevision),
        format: input.format,
        data: reportData,
        content,
        fileName,
        createdAt: savedReport.createdAt,
      };
    }),

  saved: protectedProcedure.query(async ({ ctx }) => {
    const reports = await getGeneratedReportsByUserId(ctx.user.id);
    return Promise.all(
      reports.map(async report => {
        const latestRevision = await getLatestReportRevision(
          report.id,
          ctx.user.id
        );
        return {
          ...savedReportSummary(report),
          latestRevision: latestRevision
            ? {
                id: latestRevision.id,
                revisionNumber: latestRevision.revisionNumber,
                title: latestRevision.title,
                createdAt: latestRevision.createdAt,
                updatedAt: latestRevision.updatedAt,
              }
            : null,
        };
      })
    );
  }),

  getSaved: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const report = await getOwnedGeneratedReport(input.id, ctx.user.id);
      const revisions = await getReportRevisionsByReportId(
        report.id,
        ctx.user.id
      );
      const latestRevision = revisions[0];
      return {
        ...savedReportSummary(report),
        content: currentRevisionMarkdown(report, latestRevision),
        metadata: {
          ...safeJsonObject(report.metadata),
          sections: currentEditableSections(report, latestRevision),
          latestRevision: latestRevision
            ? revisionSummary(latestRevision)
            : null,
        },
        revisions: revisions.map(revisionSummary),
      };
    }),

  revisions: protectedProcedure
    .input(z.object({ reportId: z.number() }))
    .query(async ({ input, ctx }) => {
      await getOwnedGeneratedReport(input.reportId, ctx.user.id);
      const revisions = await getReportRevisionsByReportId(
        input.reportId,
        ctx.user.id
      );
      return revisions.map(revisionSummary);
    }),

  saveRevision: protectedProcedure
    .input(
      z.object({
        reportId: z.number(),
        title: z.string().max(255).optional(),
        sections: reportSectionsSchema,
        editReason: z.string().max(255).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const report = await getOwnedGeneratedReport(input.reportId, ctx.user.id);
      return saveReportRevisionFromSections({
        report,
        userId: ctx.user.id,
        title: input.title,
        sections: input.sections,
        editReason: input.editReason ?? "Saved section edits",
      });
    }),

  updateSection: protectedProcedure
    .input(
      z.object({
        reportId: z.number(),
        sectionId: z.string().min(1).max(120),
        title: z.string().max(240).optional(),
        markdown: z.string().max(MAX_REPORT_SECTION_CHARS).optional(),
        includedInExport: z.boolean().optional(),
        editReason: z.string().max(255).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const report = await getOwnedGeneratedReport(input.reportId, ctx.user.id);
      const latestRevision = await getLatestReportRevision(
        report.id,
        ctx.user.id
      );
      const sections = currentEditableSections(report, latestRevision);
      const sectionIndex = sections.findIndex(
        section => section.sectionId === input.sectionId
      );
      if (sectionIndex < 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Report section not found.",
        });
      }
      const nextSections = sections.map((section, index) =>
        index === sectionIndex
          ? {
              ...section,
              title: input.title?.trim() || section.title,
              markdown: input.markdown ?? section.markdown,
              includedInExport:
                input.includedInExport ?? section.includedInExport,
              edited:
                input.markdown !== undefined || input.title !== undefined
                  ? true
                  : section.edited,
            }
          : section
      );
      return saveReportRevisionFromSections({
        report,
        userId: ctx.user.id,
        title: latestRevision?.title ?? report.title,
        sections: nextSections,
        editReason: input.editReason ?? `Updated section: ${sections[sectionIndex].title}`,
      });
    }),

  restoreSection: protectedProcedure
    .input(
      z.object({
        reportId: z.number(),
        sectionId: z.string().min(1).max(120),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const report = await getOwnedGeneratedReport(input.reportId, ctx.user.id);
      const latestRevision = await getLatestReportRevision(
        report.id,
        ctx.user.id
      );
      const sections = currentEditableSections(report, latestRevision);
      const sectionIndex = sections.findIndex(
        section => section.sectionId === input.sectionId
      );
      if (sectionIndex < 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Report section not found.",
        });
      }
      const nextSections = sections.map((section, index) =>
        index === sectionIndex
          ? {
              ...section,
              markdown: section.generatedVersion ?? section.markdown,
              edited: false,
            }
          : section
      );
      return saveReportRevisionFromSections({
        report,
        userId: ctx.user.id,
        title: latestRevision?.title ?? report.title,
        sections: nextSections,
        editReason: `Restored section: ${sections[sectionIndex].title}`,
      });
    }),

  regenerateSection: protectedProcedure
    .input(
      z.object({
        reportId: z.number(),
        sectionId: z.string().min(1).max(120),
        instruction: z.string().max(1200).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await enforceReportGenerationAccess(ctx.user);
      const report = await getOwnedGeneratedReport(input.reportId, ctx.user.id);
      const latestRevision = await getLatestReportRevision(
        report.id,
        ctx.user.id
      );
      const sections = currentEditableSections(report, latestRevision);
      const sectionIndex = sections.findIndex(
        section => section.sectionId === input.sectionId
      );
      if (sectionIndex < 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Report section not found.",
        });
      }
      const section = sections[sectionIndex];
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content:
              "Rewrite only the requested report section. Keep it court-safe, skimmable, source-bound, and professionally restrained. Do not add facts, dates, parties, accusations, authorities, or record claims that are not already present in the supplied report material. Return Markdown for this section only, including the section heading.",
          },
          {
            role: "user",
            content: [
              `Report title: ${latestRevision?.title ?? report.title}`,
              `Section title: ${section.title}`,
              input.instruction ? `User instruction: ${input.instruction}` : "",
              "",
              "Current section Markdown:",
              section.markdown,
              "",
              "Nearby section titles:",
              sections.map(item => `- ${item.title}`).join("\n"),
            ]
              .filter(Boolean)
              .join("\n"),
          },
        ],
      });
      const usage = usageFromResponse(response);
      if (usage.totalTokens > 0) {
        await createLlmUsageEvent({
          userId: ctx.user.id,
          operation: "report_section_regeneration",
          model: usage.model,
          promptTokens: usage.promptTokens,
          completionTokens: usage.completionTokens,
          totalTokens: usage.totalTokens,
          estimatedCostCents: usage.estimatedCostCents,
        });
      }
      const nextMarkdown = llmContentText(response).trim();
      if (!nextMarkdown) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Section regeneration returned no usable text.",
        });
      }
      const nextSections = sections.map((item, index) =>
        index === sectionIndex
          ? { ...item, markdown: nextMarkdown, edited: true }
          : item
      );
      return saveReportRevisionFromSections({
        report,
        userId: ctx.user.id,
        title: latestRevision?.title ?? report.title,
        sections: nextSections,
        editReason: `Regenerated section: ${section.title}`,
      });
    }),

  exportSaved: protectedProcedure
    .input(
      z.object({ id: z.number(), format: reportExportFormatSchema.optional() })
    )
    .query(async ({ input, ctx }) => {
      const report = await getOwnedGeneratedReport(input.id, ctx.user.id);
      const storedFormat = reportExportFormatSchema.safeParse(report.format);
      const exportFormat =
        input.format ?? (storedFormat.success ? storedFormat.data : "markdown");
      await enforceReportExportAccess(ctx.user, exportFormat);
      const latestRevision = await getLatestReportRevision(report.id, ctx.user.id);
      const artifact = await buildReportExportArtifact(
        reportForRevisionExport(report, latestRevision),
        exportFormat
      );
      return {
        id: report.id,
        title: latestRevision?.title ?? report.title,
        ...artifact,
      };
    }),

  exportRevision: protectedProcedure
    .input(
      z.object({
        reportId: z.number(),
        revisionId: z.number().optional(),
        format: reportExportFormatSchema.default("pdf"),
      })
    )
    .query(async ({ input, ctx }) => {
      const report = await getOwnedGeneratedReport(input.reportId, ctx.user.id);
      const revision = input.revisionId
        ? await getReportRevisionById(input.revisionId, ctx.user.id)
        : await getLatestReportRevision(report.id, ctx.user.id);
      if (!revision || revision.reportId !== report.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Report revision not found.",
        });
      }
      await enforceReportExportAccess(ctx.user, input.format);
      const artifact = await buildReportExportArtifact(
        reportForRevisionExport(report, revision),
        input.format
      );
      return {
        id: report.id,
        revisionId: revision.id,
        title: revision.title,
        ...artifact,
      };
    }),

  deleteSaved: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await getOwnedGeneratedReport(input.id, ctx.user.id);
      await deleteGeneratedReportById(input.id, ctx.user.id);
      return { success: true };
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db)
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Database not available",
      });

    const userDocuments = await db
      .select()
      .from(documents)
      .where(eq(documents.userId, ctx.user.id))
      .orderBy(desc(documents.createdAt));

    const outputs = await getOutputsForDocuments(
      userDocuments.map(document => document.id)
    );
    const findings = await getFindingsForScope({
      userId: ctx.user.id,
      documentIds: userDocuments.map(document => document.id),
    });
    const outputCounts = outputs.reduce<Record<number, number>>(
      (counts, output) => {
        counts[output.documentId] = (counts[output.documentId] ?? 0) + 1;
        return counts;
      },
      {}
    );
    const findingCounts = findings.reduce<Record<number, number>>(
      (counts, finding) => {
        safeJsonArray(finding.sourceAnchors).forEach(anchor => {
          if (!anchor || typeof anchor !== "object") return;
          const documentId = Number(
            (anchor as Record<string, unknown>).documentId
          );
          if (documentId > 0)
            counts[documentId] = (counts[documentId] ?? 0) + 1;
        });
        return counts;
      },
      {}
    );

    return userDocuments.map(doc => ({
      id: doc.id,
      name: doc.fileName,
      status: doc.status,
      documentHash: doc.documentHash,
      extractionQualityScore: doc.extractionQualityScore,
      mimeType: doc.mimeType,
      fileSize: doc.fileSize,
      createdAt: doc.createdAt,
      hasText: Boolean(
        doc.extractedText && doc.extractedText.trim().length > 0
      ),
      analysisReady: isDocumentReadyForAnalysis(doc),
      savedAgentOutputs: outputCounts[doc.id] ?? 0,
      structuredFindings: findingCounts[doc.id] ?? 0,
      availableFormats: ["markdown", "html", "json"],
    }));
  }),

  preview: protectedProcedure
    .input(
      z.object({
        scope: reportScopeSchema.default("case"),
        caseId: z.number().optional(),
        documentId: z.number().optional(),
        documentIds: z.array(z.number()).optional(),
        fromDate: z.string().optional(),
        toDate: z.string().optional(),
        selectedFindingIds: z.array(z.number()).optional(),
        minConfidence: z.number().min(0).max(100).default(0),
        includeBlockedFindings: z.boolean().default(false),
        includeLegacyAgentOutputs: z.boolean().default(false),
      })
    )
    .query(async ({ input, ctx }) => {
      const scopedDocumentIds =
        input.documentIds ??
        (input.documentId ? [input.documentId] : undefined);
      const selectedDocuments = await getScopedDocuments({
        userId: ctx.user.id,
        scope: input.scope,
        caseId: input.caseId,
        documentIds: scopedDocumentIds,
        fromDate: input.fromDate,
        toDate: input.toDate,
      });
      const outputs = await getOutputsForDocuments(
        selectedDocuments.map(document => document.id)
      );
      const allFindingsInScope = await getFindingsForScope({
        userId: ctx.user.id,
        documentIds: selectedDocuments.map(document => document.id),
        includeBlockedFindings: true,
      });
      const blockedFindingsInScope = allFindingsInScope.filter(
        finding =>
          !isReportEligible(finding.qcStatus) || !finding.includedInReports
      );
      const blockedFindingsIncluded =
        ctx.user.role === "admin" && input.includeBlockedFindings;
      const legacyAgentOutputsIncluded =
        ctx.user.role === "admin" && input.includeLegacyAgentOutputs;
      const previewFindings = await getFindingsForScope({
        userId: ctx.user.id,
        documentIds: selectedDocuments.map(document => document.id),
        minConfidence: input.minConfidence,
        includeBlockedFindings: blockedFindingsIncluded,
      });
      const selectedFindingIdSet = new Set(input.selectedFindingIds ?? []);
      const reportFindings =
        selectedFindingIdSet.size > 0
          ? previewFindings.filter(finding =>
              selectedFindingIdSet.has(finding.id)
            )
          : previewFindings;
      const preflightError = reportPreflightError({
        findings: reportFindings,
        legacyAgentOutputsIncluded,
        selectedFindingIds: input.selectedFindingIds,
        minConfidence: input.minConfidence,
      });

      return {
        documents: selectedDocuments.map(document => ({
          id: document.id,
          fileName: document.fileName,
          mimeType: document.mimeType,
          status: document.status,
          documentHash: document.documentHash,
          extractionQualityScore: document.extractionQualityScore,
          createdAt: document.createdAt,
          hasText: Boolean(
            document.extractedText && document.extractedText.trim().length > 0
          ),
          analysisReady: isDocumentReadyForAnalysis(document),
        })),
        outputs: outputs.map(output => ({
          id: output.id,
          documentId: output.documentId,
          agent: output.agentName || output.agentId || "Agent Output",
          excerpt: outputText(output).slice(0, 600),
          createdAt: output.createdAt,
        })),
        findings: previewFindings.map(finding => ({
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
          readyDocuments: selectedDocuments.filter(isDocumentReadyForAnalysis)
            .length,
          savedAgentOutputs: outputs.length,
          structuredFindings: previewFindings.length,
          allStructuredFindingsInScope: allFindingsInScope.length,
          blockedFindingsInScope: blockedFindingsInScope.length,
          reportReadyFindings: reportFindings.length,
          legacyAgentOutputsIncludedByDefault: false,
          preflightPassed: !preflightError,
          preflightMessage: preflightError,
        },
      };
    }),
});
