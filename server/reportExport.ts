import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  Packer,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";
import PDFDocument from "pdfkit";
import { z } from "zod";

export const reportExportFormatSchema = z.enum([
  "markdown",
  "html",
  "json",
  "pdf",
  "docx",
]);

export type ReportExportFormat = z.infer<typeof reportExportFormatSchema>;

export type StoredReportForExport = {
  title: string;
  fileName: string;
  format: string;
  content: string;
  metadata: string | null;
};

export type ReportExportArtifact = {
  content: string;
  encoding: "utf8" | "base64";
  fileName: string;
  format: ReportExportFormat;
  mimeType: string;
};

type MarkdownBlock =
  | { kind: "heading"; level: 1 | 2 | 3; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "bullet"; text: string }
  | { kind: "numbered"; marker: string; text: string }
  | { kind: "quote"; text: string }
  | { kind: "code"; text: string }
  | { kind: "table"; headers: string[]; rows: string[][] };

type ReportDocumentSummary = {
  fileName: string;
  status: string;
  analysisReady: boolean;
  documentHash: string | null;
  extractionQualityScore: number | null;
  uploadedAt: string | null;
};

type ReportFindingSummary = {
  title: string;
  confidence: number | null;
  leverageScore: number | null;
  qcStatus: string | null;
  includedInReports: boolean | null;
};

type FilingMetadata = {
  courtName: string | null;
  jurisdiction: string | null;
  caseNumber: string | null;
  petitioner: string | null;
  respondent: string | null;
  plaintiff: string | null;
  defendant: string | null;
  filingTitle: string | null;
  filingSubtitle: string | null;
  preparedFor: string | null;
};

type ReportDescriptor = {
  title: string;
  generatedAt: string | null;
  generatedBy: string | null;
  scope: string | null;
  template: string | null;
  filingMetadata: FilingMetadata;
  documents: ReportDocumentSummary[];
  findings: ReportFindingSummary[];
  statistics: Record<string, unknown>;
};

type CourtPaperControlItem = {
  label: string;
  status: "READY" | "NEEDS REVIEW" | "BLOCKED";
  detail: string;
};

type ReportExportQualityManifest = {
  canonicalMarkdown: boolean;
  sourceControlIncluded: boolean;
  reliabilityCertificateIncluded: boolean;
  findingLedgerIncluded: boolean;
  courtReadinessSheetIncluded: boolean;
  qcGateNoticeIncluded: boolean;
  filingCaptionIncluded: boolean;
  pleadingPaperPdf: boolean;
  lineNumberedPdf: boolean;
  humanReviewRequired: boolean;
  availableFormats: ReportExportFormat[];
  pageFormat: {
    size: "LETTER";
    pdfMargins: string;
    lineNumberCount: number;
    lineNumberRestart: "each page";
    pleadingRules: string[];
  };
  includedSections: string[];
  pdfControls: string[];
  docxControls: string[];
  filingBlockers: Array<{ label: string; status: string; detail: string }>;
  binaryFormatsGeneratedOnDemand: boolean;
  courtUseChecklist: Array<{ label: string; detail: string }>;
  courtPaperControl: CourtPaperControlItem[];
  courtFilingReadiness: Array<{
    label: string;
    status: string;
    detail: string;
  }>;
};

const EXPORT_MIME_TYPES: Record<ReportExportFormat, string> = {
  markdown: "text/markdown;charset=utf-8",
  html: "text/html;charset=utf-8",
  json: "application/json;charset=utf-8",
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

const EXPORT_EXTENSIONS: Record<ReportExportFormat, string> = {
  markdown: "md",
  html: "html",
  json: "json",
  pdf: "pdf",
  docx: "docx",
};

const COLORS = {
  ink: "#111827",
  muted: "#4b5563",
  faint: "#e5e7eb",
  pleadingLine: "#cbd5e1",
  pleadingNumber: "#64748b",
  panel: "#f8fafc",
  caution: "#fef3c7",
  cautionText: "#78350f",
  accent: "#b7791f",
  accentDark: "#7c4a03",
  green: "#047857",
  red: "#b91c1c",
};

const PLEADING = {
  lineCount: 28,
  lineNumberX: 34,
  ruleX: 72,
  top: 74,
  bottom: 704,
  margins: { top: 72, bottom: 72, left: 92, right: 72 },
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function decodeBasicHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripHtmlToText(html: string): string {
  return decodeBasicHtmlEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

function parseMetadata(metadata: string | null): Record<string, unknown> {
  if (!metadata) return {};
  try {
    const parsed = JSON.parse(metadata);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function asNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1" || value === "true") return true;
  if (value === 0 || value === "0" || value === "false") return false;
  return null;
}

function normalizeFilingMetadata(value: unknown): FilingMetadata {
  const metadata = asObject(value) ?? {};
  return {
    courtName: asString(metadata.courtName),
    jurisdiction: asString(metadata.jurisdiction),
    caseNumber: asString(metadata.caseNumber),
    petitioner: asString(metadata.petitioner),
    respondent: asString(metadata.respondent),
    plaintiff: asString(metadata.plaintiff),
    defendant: asString(metadata.defendant),
    filingTitle: asString(metadata.filingTitle),
    filingSubtitle: asString(metadata.filingSubtitle),
    preparedFor: asString(metadata.preparedFor),
  };
}

function filingMetadataHasContent(metadata: FilingMetadata): boolean {
  return Object.values(metadata).some(value => Boolean(value));
}

function filingPartyLine(metadata: FilingMetadata): string | null {
  if (metadata.petitioner || metadata.respondent) {
    return `${metadata.petitioner ?? "Petitioner"} v. ${metadata.respondent ?? "Respondent"}`;
  }
  if (metadata.plaintiff || metadata.defendant) {
    return `${metadata.plaintiff ?? "Plaintiff"} v. ${metadata.defendant ?? "Defendant"}`;
  }
  return null;
}

function formatTemplate(value: string | null): string {
  return value
    ? value.replace(/_/g, " ").replace(/\b\w/g, letter => letter.toUpperCase())
    : "Report";
}

function normalizeMetadata(
  input: unknown,
  fallbackTitle: string
): ReportDescriptor {
  const root = asObject(input) ?? {};
  const reportMeta = asObject(root.metadata) ?? root;
  const filingMetadata = normalizeFilingMetadata(
    root.filingMetadata ?? reportMeta.filingMetadata
  );
  const statistics =
    asObject(root.statistics) ?? asObject(reportMeta.statistics) ?? {};
  const documents = asArray(root.documents).map(item => {
    const document = asObject(item) ?? {};
    return {
      fileName:
        asString(document.fileName) ??
        asString(document.name) ??
        `Document ${asString(document.id) ?? ""}`.trim(),
      status: asString(document.status) ?? "unknown",
      analysisReady: asBoolean(document.analysisReady) ?? false,
      documentHash: asString(document.documentHash),
      extractionQualityScore: asNumber(document.extractionQualityScore),
      uploadedAt: asString(document.uploadedAt) ?? asString(document.createdAt),
    };
  });
  const findings = asArray(root.findings).map(item => {
    const finding = asObject(item) ?? {};
    return {
      title: asString(finding.title) ?? "Untitled finding",
      confidence: asNumber(finding.confidence),
      leverageScore: asNumber(finding.leverageScore),
      qcStatus: asString(finding.qcStatus),
      includedInReports: asBoolean(finding.includedInReports),
    };
  });

  return {
    title: asString(reportMeta.title) ?? fallbackTitle,
    generatedAt: asString(reportMeta.generatedAt),
    generatedBy: asString(reportMeta.generatedBy),
    scope: asString(reportMeta.scope),
    template: asString(reportMeta.template),
    filingMetadata,
    documents,
    findings,
    statistics,
  };
}

function descriptorFromStoredReport(
  report: StoredReportForExport
): ReportDescriptor {
  return normalizeMetadata(parseMetadata(report.metadata), report.title);
}

export function markdownFromStoredReport(
  report: StoredReportForExport
): string {
  const metadata = parseMetadata(report.metadata);
  if (
    typeof metadata.markdown === "string" &&
    metadata.markdown.trim().length > 0
  ) {
    return metadata.markdown;
  }

  if (report.format === "markdown") {
    return report.content;
  }

  if (report.format === "json") {
    try {
      const parsed = JSON.parse(report.content) as Record<string, unknown>;
      if (
        typeof parsed.markdown === "string" &&
        parsed.markdown.trim().length > 0
      ) {
        return parsed.markdown;
      }
      if (typeof parsed.executiveSummary === "string") {
        return `# ${report.title}\n\n${parsed.executiveSummary}`;
      }
      return `# ${report.title}\n\n\`\`\`json\n${JSON.stringify(
        parsed,
        null,
        2
      )}\n\`\`\``;
    } catch {
      return `# ${report.title}\n\n${report.content}`;
    }
  }

  if (report.format === "html") {
    return stripHtmlToText(report.content)
      .split("\n")
      .map((line, index) =>
        index === 0 && !line.startsWith("#") ? `# ${line}` : line
      )
      .join("\n");
  }

  return report.content;
}

function stripMarkdown(value: string): string {
  return decodeBasicHtmlEntities(value)
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/~/g, "")
    .trim();
}

function cleanInlineMarkdown(value: string): string {
  return decodeBasicHtmlEntities(value)
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/~/g, "");
}

function splitInlineMarkdown(
  value: string
): Array<{ text: string; bold: boolean }> {
  const runs: Array<{ text: string; bold: boolean }> = [];
  const pattern = /\*\*([^*]+)\*\*/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(value)) !== null) {
    if (match.index > cursor) {
      runs.push({
        text: cleanInlineMarkdown(value.slice(cursor, match.index)),
        bold: false,
      });
    }
    runs.push({ text: cleanInlineMarkdown(match[1] ?? ""), bold: true });
    cursor = match.index + match[0].length;
  }

  if (cursor < value.length) {
    runs.push({ text: cleanInlineMarkdown(value.slice(cursor)), bold: false });
  }

  return runs.filter(run => run.text.length > 0);
}

function parseMarkdownTableRow(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return null;
  const cells = trimmed
    .slice(1, -1)
    .split("|")
    .map(cell => stripMarkdown(cell.trim()));
  return cells.length >= 2 ? cells : null;
}

function isMarkdownTableSeparator(cells: string[]): boolean {
  return (
    cells.length >= 2 &&
    cells.every(cell => /^:?-{3,}:?$/.test(cell.replace(/\s+/g, "")))
  );
}

function parseMarkdownBlocks(markdown: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  const paragraphLines: string[] = [];
  let inCode = false;
  let codeLines: string[] = [];
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    blocks.push({ kind: "paragraph", text: paragraphLines.join(" ") });
    paragraphLines.length = 0;
  };

  const flushCode = () => {
    if (codeLines.length === 0) return;
    blocks.push({ kind: "code", text: codeLines.join("\n") });
    codeLines = [];
  };

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const rawLine = lines[lineIndex] ?? "";
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      if (inCode) {
        flushCode();
        inCode = false;
      } else {
        flushParagraph();
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    if (!trimmed) {
      flushParagraph();
      continue;
    }

    const headerCells = parseMarkdownTableRow(trimmed);
    const separatorCells = parseMarkdownTableRow(
      (lines[lineIndex + 1] ?? "").trim()
    );
    if (
      headerCells &&
      separatorCells &&
      isMarkdownTableSeparator(separatorCells)
    ) {
      flushParagraph();
      const rows: string[][] = [];
      lineIndex += 2;
      while (lineIndex < lines.length) {
        const rowCells = parseMarkdownTableRow((lines[lineIndex] ?? "").trim());
        if (!rowCells) break;
        rows.push(rowCells);
        lineIndex += 1;
      }
      lineIndex -= 1;
      blocks.push({ kind: "table", headers: headerCells, rows });
      continue;
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (heading) {
      flushParagraph();
      blocks.push({
        kind: "heading",
        level: Math.min(heading[1].length, 3) as 1 | 2 | 3,
        text: stripMarkdown(heading[2] ?? ""),
      });
      continue;
    }

    const boldHeading = /^\*\*([^*]+)\*\*$/.exec(trimmed);
    if (boldHeading) {
      flushParagraph();
      blocks.push({
        kind: "heading",
        level: 3,
        text: stripMarkdown(boldHeading[1] ?? ""),
      });
      continue;
    }

    const bullet = /^[-*]\s+(.+)$/.exec(trimmed);
    if (bullet) {
      flushParagraph();
      blocks.push({ kind: "bullet", text: stripMarkdown(bullet[1] ?? "") });
      continue;
    }

    const numbered = /^(\d+\.)\s+(.+)$/.exec(trimmed);
    if (numbered) {
      flushParagraph();
      blocks.push({
        kind: "numbered",
        marker: numbered[1] ?? "1.",
        text: stripMarkdown(numbered[2] ?? ""),
      });
      continue;
    }

    const quote = /^>\s*(.+)$/.exec(trimmed);
    if (quote) {
      flushParagraph();
      blocks.push({ kind: "quote", text: stripMarkdown(quote[1] ?? "") });
      continue;
    }

    paragraphLines.push(trimmed);
  }

  flushParagraph();
  flushCode();
  return blocks;
}

function fileNameForExport(
  report: StoredReportForExport,
  format: ReportExportFormat
): string {
  const sourceName = report.fileName || report.title || "dueprocess-report";
  const baseName =
    sourceName
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "dueprocess-report";
  return `${baseName}.${EXPORT_EXTENSIONS[format]}`;
}

function descriptorStats(
  descriptor: ReportDescriptor
): Array<[string, string]> {
  const readyDocuments =
    asNumber(descriptor.statistics.readyDocuments) ??
    descriptor.documents.filter(document => document.analysisReady).length;
  const documentCount =
    asNumber(descriptor.statistics.documents) ?? descriptor.documents.length;
  const findingCount =
    asNumber(descriptor.statistics.structuredFindings) ??
    descriptor.findings.length;

  return [
    ["Template", formatTemplate(descriptor.template)],
    ["Scope", descriptor.scope ?? "case"],
    ["Court", descriptor.filingMetadata.courtName ?? "not supplied"],
    ["Case no.", descriptor.filingMetadata.caseNumber ?? "not supplied"],
    ["Generated", descriptor.generatedAt ?? "not recorded"],
    ["Generated by", descriptor.generatedBy ?? "DueProcess AI user"],
    ["Sources", `${readyDocuments}/${documentCount} analysis-ready`],
    [
      "Findings",
      `${findingCount} structured finding${findingCount === 1 ? "" : "s"}`,
    ],
  ];
}

function shortHash(value: string | null): string {
  return value ? value.slice(0, 18) : "missing";
}

function shortText(value: string, maxLength: number): string {
  return value.length > maxLength
    ? `${value.slice(0, Math.max(0, maxLength - 3))}...`
    : value;
}

function findingInclusionLabel(finding: ReportFindingSummary): string {
  if (finding.includedInReports === true) return "Included";
  if (finding.includedInReports === false) return "Held out";
  return "Unknown";
}

function reliabilityChecklist(
  descriptor: ReportDescriptor
): Array<[string, string]> {
  const readyDocuments = descriptor.documents.filter(
    document => document.analysisReady
  ).length;
  const includedFindings = descriptor.findings.filter(
    finding => finding.includedInReports
  ).length;
  const heldFindings = descriptor.findings.filter(
    finding => finding.includedInReports === false
  ).length;
  const missingHashes = descriptor.documents.filter(
    document => !document.documentHash
  ).length;

  return [
    [
      "Source control",
      `${readyDocuments}/${descriptor.documents.length} source${descriptor.documents.length === 1 ? "" : "s"} analysis-ready; ${missingHashes} missing hash${missingHashes === 1 ? "" : "es"}.`,
    ],
    [
      "Finding ledger",
      `${includedFindings} included finding${includedFindings === 1 ? "" : "s"}; ${heldFindings} held out or blocked.`,
    ],
    [
      "QC envelope",
      "Report material should come from QC-cleared or explicitly overridden findings only.",
    ],
    [
      "Court-use limit",
      "Review citations, authorities, captions, local rules, and factual assertions before filing.",
    ],
  ];
}

function courtFilingReadinessChecklist(
  descriptor: ReportDescriptor
): Array<[string, string, string]> {
  const metadata = descriptor.filingMetadata;
  const hasCaption =
    Boolean(metadata.courtName || metadata.jurisdiction) &&
    Boolean(metadata.caseNumber) &&
    Boolean(filingPartyLine(metadata)) &&
    Boolean(metadata.filingTitle);
  const readySources = descriptor.documents.filter(
    document => document.analysisReady
  ).length;
  const allSourcesReady =
    descriptor.documents.length > 0 &&
    readySources === descriptor.documents.length;
  const includedFindings = descriptor.findings.filter(
    finding => finding.includedInReports
  ).length;
  const approvedFindings = descriptor.findings.filter(finding =>
    [
      "approved",
      "downgraded",
      "not_required",
      "cleared",
      "report_ready",
    ].includes((finding.qcStatus ?? "").toLowerCase())
  ).length;
  const template = (descriptor.template ?? "").toLowerCase();
  const isMandamus = template.includes("mandamus") || template.includes("writ");

  return [
    [
      "Caption / parties",
      hasCaption ? "READY" : "NEEDS REVIEW",
      hasCaption
        ? "Court, case number, parties, and filing title are present."
        : "Before filing, supply court/forum, case number, parties, and exact filing title.",
    ],
    [
      "Source appendix",
      allSourcesReady ? "READY" : "NEEDS REVIEW",
      `${readySources}/${descriptor.documents.length} source${descriptor.documents.length === 1 ? "" : "s"} analysis-ready. Confirm pagination, exhibit labels, and hash/source control before filing.`,
    ],
    [
      "QC / report use",
      includedFindings > 0 && approvedFindings >= includedFindings
        ? "READY"
        : includedFindings > 0
          ? "NEEDS REVIEW"
          : "BLOCKED",
      `${includedFindings} included finding${includedFindings === 1 ? "" : "s"}; ${approvedFindings} have report-ready QC status. Blocked or unsupported material should stay out of factual sections.`,
    ],
    [
      "Authority verification",
      "NEEDS REVIEW",
      "Verify statutes, cases, rules, preservation posture, and local authority before any court filing.",
    ],
    [
      "Adverse facts",
      "NEEDS REVIEW",
      "Confirm adverse facts, limits, waiver, mootness, exhaustion, immunity, and ordinary-remedy risks are fairly disclosed.",
    ],
    [
      isMandamus ? "Writ command" : "Relief requested",
      "NEEDS REVIEW",
      isMandamus
        ? "Confirm clear duty, beneficial interest, refusal/delay, no plain/speedy/adequate remedy, appendix proof, and a narrow command."
        : "Confirm the requested relief matches the procedural vehicle and does not ask for unsupported factual findings.",
    ],
    [
      "Service / deadlines / local rules",
      "NEEDS REVIEW",
      "Check service list, deadlines, page limits, signatures, exhibits, filing fee/fee waiver, and court-specific formatting.",
    ],
  ];
}

function courtPaperControlSheet(
  descriptor: ReportDescriptor
): CourtPaperControlItem[] {
  const metadata = descriptor.filingMetadata;
  const hasCaption =
    Boolean(metadata.courtName || metadata.jurisdiction) &&
    Boolean(metadata.caseNumber) &&
    Boolean(filingPartyLine(metadata)) &&
    Boolean(metadata.filingTitle);
  const readySources = descriptor.documents.filter(
    document => document.analysisReady
  ).length;
  const allSourcesReady =
    descriptor.documents.length > 0 &&
    readySources === descriptor.documents.length;
  const includedFindings = descriptor.findings.filter(
    finding => finding.includedInReports
  ).length;
  const template = (descriptor.template ?? "").toLowerCase();
  const isMandamus = template.includes("mandamus") || template.includes("writ");

  return [
    {
      label: "Pleading-paper PDF",
      status: "READY",
      detail:
        "PDF exports use letter-size pleading margins, 28 line numbers per page, double rule, caption block, source-control cover, and page footer.",
    },
    {
      label: "DOCX filing packet",
      status: "NEEDS REVIEW",
      detail:
        "DOCX preserves caption, readiness, source, and finding tables. Verify local court forms, pleading rules, and Word pagination before filing.",
    },
    {
      label: "Caption block",
      status: hasCaption ? "READY" : "NEEDS REVIEW",
      detail: hasCaption
        ? "Court/forum, case number, parties, and filing title are present."
        : "Supply court/forum, case number, parties, filing title, department/judge if required, and any local caption text before filing.",
    },
    {
      label: "Source appendix",
      status: allSourcesReady ? "READY" : "NEEDS REVIEW",
      detail: `${readySources}/${descriptor.documents.length} source${descriptor.documents.length === 1 ? "" : "s"} are analysis-ready. Confirm exhibit labels, page references, quotes, and hashes.`,
    },
    {
      label: "Finding ledger",
      status: includedFindings > 0 ? "READY" : "BLOCKED",
      detail:
        includedFindings > 0
          ? `${includedFindings} finding${includedFindings === 1 ? "" : "s"} are marked for report use. Blocked or unsupported material should stay out of factual sections.`
          : "No findings are marked for report use. Generate or approve source-bound findings before filing-facing export.",
    },
    {
      label: isMandamus ? "Writ relief block" : "Relief block",
      status: "NEEDS REVIEW",
      detail: isMandamus
        ? "Confirm clear duty, refusal/delay, beneficial interest, no adequate remedy, appendix proof, and narrow command."
        : "Confirm relief, proposed-order language, preservation, service, deadlines, and local-rule compliance.",
    },
  ];
}

function buildExportQualityManifest(
  descriptor: ReportDescriptor
): ReportExportQualityManifest {
  const courtFilingReadiness = courtFilingReadinessChecklist(descriptor).map(
    ([label, status, detail]) => ({ label, status, detail })
  );

  return {
    canonicalMarkdown: true,
    sourceControlIncluded: true,
    reliabilityCertificateIncluded: true,
    findingLedgerIncluded: descriptor.findings.length > 0,
    courtReadinessSheetIncluded: true,
    qcGateNoticeIncluded: true,
    filingCaptionIncluded: filingMetadataHasContent(descriptor.filingMetadata),
    pleadingPaperPdf: true,
    lineNumberedPdf: true,
    humanReviewRequired: true,
    availableFormats: ["markdown", "html", "json", "pdf", "docx"],
    pageFormat: {
      size: "LETTER",
      pdfMargins:
        "1 inch top/bottom, 1.28 inch left pleading gutter, 1 inch right",
      lineNumberCount: PLEADING.lineCount,
      lineNumberRestart: "each page",
      pleadingRules: [
        "left-side line numbers 1-28",
        "double vertical pleading rule",
        "caption block before body text",
        "source-control and readiness cover sheets",
        "footer with work-product label and page count",
      ],
    },
    includedSections: [
      "caption block",
      "metadata grid",
      "QC gate notice",
      "reliability certificate",
      "court paper control sheet",
      "court filing readiness sheet",
      "source control ledger",
      "finding ledger",
      "body markdown converted to print sections",
    ],
    pdfControls: [
      "Letter-size PDF",
      "28 pleading line numbers per page",
      "double pleading rule",
      "caption block",
      "source-control cover",
      "readiness and QC sheets",
      "page-number footer",
    ],
    docxControls: [
      "caption table",
      "metadata table",
      "QC gate notice",
      "source-control table",
      "finding ledger table",
      "court filing readiness table",
      "page-number footer",
    ],
    filingBlockers: courtFilingReadiness.filter(
      item => item.status !== "READY"
    ),
    binaryFormatsGeneratedOnDemand: true,
    courtUseChecklist: reliabilityChecklist(descriptor).map(
      ([label, detail]) => ({ label, detail })
    ),
    courtPaperControl: courtPaperControlSheet(descriptor),
    courtFilingReadiness,
  };
}

function htmlId(value: string, index: number): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug ? `${slug}-${index}` : `section-${index}`;
}

function htmlBlock(block: MarkdownBlock, index: number): string {
  const inlineHtml = (value: string) =>
    splitInlineMarkdown(value)
      .map(run =>
        run.bold
          ? `<strong>${escapeHtml(run.text)}</strong>`
          : escapeHtml(run.text)
      )
      .join("");

  if (block.kind === "heading") {
    const tag = `h${block.level}`;
    return `<${tag} id="${htmlId(block.text, index)}">${escapeHtml(block.text)}</${tag}>`;
  }
  if (block.kind === "bullet") return `<li>${inlineHtml(block.text)}</li>`;
  if (block.kind === "numbered") {
    return `<p class="numbered"><span>${escapeHtml(block.marker)}</span>${inlineHtml(block.text)}</p>`;
  }
  if (block.kind === "table") {
    const maxColumns = Math.max(
      block.headers.length,
      ...block.rows.map(row => row.length)
    );
    const normalizeRow = (row: string[]) =>
      Array.from({ length: maxColumns }, (_, index) => row[index] ?? "");
    return `<table class="markdown-table"><thead><tr>${normalizeRow(
      block.headers
    )
      .map(cell => `<th>${inlineHtml(cell)}</th>`)
      .join("")}</tr></thead><tbody>${block.rows
      .map(
        row =>
          `<tr>${normalizeRow(row)
            .map(cell => `<td>${inlineHtml(cell)}</td>`)
            .join("")}</tr>`
      )
      .join("")}</tbody></table>`;
  }
  if (block.kind === "quote")
    return `<blockquote>${inlineHtml(block.text)}</blockquote>`;
  if (block.kind === "code") return `<pre>${escapeHtml(block.text)}</pre>`;
  return `<p>${inlineHtml(block.text)}</p>`;
}

function groupHtmlBlocks(blocks: MarkdownBlock[]): string {
  const html: string[] = [];
  let bulletBuffer: string[] = [];

  const flushBullets = () => {
    if (bulletBuffer.length === 0) return;
    html.push(`<ul>${bulletBuffer.join("")}</ul>`);
    bulletBuffer = [];
  };

  blocks.forEach((block, index) => {
    if (block.kind === "bullet") {
      bulletBuffer.push(htmlBlock(block, index));
      return;
    }
    flushBullets();
    html.push(htmlBlock(block, index));
  });
  flushBullets();
  return html.join("\n");
}

function pleadingLineY(line: number): number {
  if (PLEADING.lineCount <= 1) return PLEADING.top;
  return (
    PLEADING.top +
    ((line - 1) * (PLEADING.bottom - PLEADING.top)) / (PLEADING.lineCount - 1)
  );
}

export function markdownToReportHtml(
  markdown: string,
  title: string,
  metadata?: unknown
): string {
  const descriptor = normalizeMetadata(metadata, title);
  const blocks = parseMarkdownBlocks(markdown);
  const headings = blocks
    .map((block, index) => ({ block, index }))
    .filter(
      (
        item
      ): item is {
        block: Extract<MarkdownBlock, { kind: "heading" }>;
        index: number;
      } => item.block.kind === "heading" && item.block.level <= 2
    );
  const stats = descriptorStats(descriptor);
  const sourcePreview = descriptor.documents.slice(0, 8);
  const findingPreview = descriptor.findings.slice(0, 12);
  const checklist = reliabilityChecklist(descriptor);
  const readinessChecklist = courtFilingReadinessChecklist(descriptor);
  const courtPaperControls = courtPaperControlSheet(descriptor);
  const captionPartyLine = filingPartyLine(descriptor.filingMetadata);
  const captionRows = [
    ["Court", descriptor.filingMetadata.courtName],
    ["Jurisdiction", descriptor.filingMetadata.jurisdiction],
    ["Case number", descriptor.filingMetadata.caseNumber],
    ["Parties", captionPartyLine],
    ["Filing", descriptor.filingMetadata.filingTitle],
    ["Prepared for", descriptor.filingMetadata.preparedFor],
  ].filter(([, value]) => Boolean(value)) as Array<[string, string]>;

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: letter; margin: 0.65in; }
    :root { color-scheme: light; --ink: #111827; --muted: #4b5563; --line: #d6d3d1; --panel: #f8fafc; --accent: #b7791f; --warn: #92400e; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #f7f2e8; color: var(--ink); font-family: Arial, Helvetica, sans-serif; line-height: 1.55; }
    main { max-width: 980px; margin: 24px auto; background: #fffdf8; border: 1px solid var(--line); box-shadow: 0 24px 80px rgba(15, 23, 42, 0.12); }
    .cover { padding: 36px 42px 24px; border-bottom: 3px solid var(--accent); }
    .kicker { color: var(--accent); font-size: 11px; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase; }
    h1 { margin: 10px 0 12px; font-size: 30px; line-height: 1.12; letter-spacing: 0; }
    h2 { margin: 32px 0 10px; border-top: 1px solid var(--line); padding-top: 16px; font-size: 20px; }
    h3 { margin: 22px 0 8px; font-size: 15px; color: #1f2937; }
    p { margin: 0 0 12px; }
    ul { margin: 0 0 16px 20px; padding: 0; }
    li { margin: 0 0 7px; }
    blockquote, pre { margin: 16px 0; border-left: 4px solid var(--accent); background: var(--panel); padding: 12px 14px; }
    pre { white-space: pre-wrap; font-size: 12px; }
    .meta-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-top: 20px; }
    .meta-card { border: 1px solid var(--line); background: var(--panel); padding: 10px 12px; min-height: 68px; }
    .meta-card span { display: block; color: var(--muted); font-size: 10px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; }
    .meta-card strong { display: block; margin-top: 5px; font-size: 13px; }
    .caption-box { margin-top: 18px; border: 1px solid var(--ink); display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr); }
    .caption-cell { padding: 12px 14px; min-height: 96px; }
    .caption-cell + .caption-cell { border-left: 1px solid var(--ink); text-align: center; }
    .caption-label { color: var(--accent); font-size: 10px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; }
    .caption-main { margin-top: 6px; font-size: 15px; font-weight: 800; }
    .caption-detail { margin-top: 4px; color: var(--muted); font-size: 12px; }
    .notice { margin-top: 18px; border: 1px solid #f59e0b; background: #fffbeb; color: #78350f; padding: 12px 14px; font-size: 13px; }
    .toc, .sources { padding: 20px 42px; border-bottom: 1px solid var(--line); }
    .toc a { color: var(--ink); text-decoration: none; }
    .certificate { padding: 20px 42px; border-bottom: 1px solid var(--line); background: #fffaf0; }
    .check-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .check-item { border: 1px solid #f59e0b; background: #fffbeb; padding: 10px 12px; font-size: 12px; }
    .check-item strong { display: block; margin-bottom: 4px; color: #7c2d12; }
    .readiness-table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
    .readiness-table th { background: #111827; color: white; text-align: left; padding: 8px; }
    .readiness-table td { border: 1px solid var(--line); padding: 8px; vertical-align: top; background: #fff; }
    .court-paper-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 10px; }
    .court-paper-card { border: 1px solid var(--line); background: #fff; padding: 11px 12px; break-inside: avoid; }
    .court-paper-card strong { display: block; margin-bottom: 4px; font-size: 12px; }
    .court-paper-card p { margin: 5px 0 0; color: var(--muted); font-size: 12px; }
    .readiness-status { font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; white-space: nowrap; }
    .readiness-ready { color: #047857; }
    .readiness-review { color: #92400e; }
    .readiness-blocked { color: #b91c1c; }
    .body { padding: 10px 42px 42px; }
    .source-list { display: grid; gap: 8px; }
    .source-item { border: 1px solid var(--line); background: #fff; padding: 9px 11px; font-size: 12px; }
    .source-item strong { display: block; font-size: 13px; }
    .ledger { width: 100%; border-collapse: collapse; font-size: 12px; }
    .ledger th { background: #111827; color: white; text-align: left; padding: 8px; }
    .ledger td { border: 1px solid var(--line); padding: 8px; vertical-align: top; }
    .markdown-table { width: 100%; border-collapse: collapse; margin: 16px 0 20px; font-size: 12px; break-inside: avoid; }
    .markdown-table th { background: #111827; color: white; text-align: left; padding: 8px; border: 1px solid #111827; }
    .markdown-table td { border: 1px solid var(--line); padding: 8px; vertical-align: top; background: #fff; }
    .numbered span { display: inline-block; min-width: 2rem; color: var(--accent); font-weight: 800; }
    @media print {
      body { background: white; }
      main { margin: 0; border: 0; box-shadow: none; }
      .cover, .toc, .sources, .body { padding-left: 0; padding-right: 0; }
      a { color: inherit; }
      h2 { break-after: avoid; }
      .source-item, .meta-card, .notice { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <main>
    <section class="cover">
      <div class="kicker">DueProcess AI - Legal Intelligence Export</div>
      <h1>${escapeHtml(descriptor.title)}</h1>
      <div class="caption-box">
        <div class="caption-cell">
          <div class="caption-label">${captionPartyLine ? "Parties" : "Caption"}</div>
          <div class="caption-main">${escapeHtml(captionPartyLine ?? descriptor.title)}</div>
          ${
            captionRows.length > 0
              ? captionRows
                  .slice(0, 4)
                  .map(
                    ([label, value]) =>
                      `<div class="caption-detail">${escapeHtml(label)}: ${escapeHtml(value)}</div>`
                  )
                  .join("")
              : '<div class="caption-detail">Court caption metadata was not supplied.</div>'
          }
        </div>
        <div class="caption-cell">
          <div class="caption-label">Filing</div>
          <div class="caption-main">${escapeHtml(descriptor.filingMetadata.filingTitle ?? descriptor.title)}</div>
          <div class="caption-detail">${escapeHtml(descriptor.filingMetadata.filingSubtitle ?? formatTemplate(descriptor.template))}</div>
        </div>
      </div>
      <div class="meta-grid">
        ${stats
          .map(
            ([label, value]) =>
              `<div class="meta-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`
          )
          .join("")}
      </div>
      <div class="notice"><strong>Export quality gate:</strong> This packet is generated from QC-cleared or explicitly overridden findings. Unsupported accusations should appear as gaps, demands, or inferences - not proven facts.</div>
    </section>
    ${
      headings.length > 0
        ? `<section class="toc"><div class="kicker">Contents</div><ol>${headings
            .map(
              ({ block, index }) =>
                `<li><a href="#${htmlId(block.text, index)}">${escapeHtml(block.text)}</a></li>`
            )
            .join("")}</ol></section>`
        : ""
    }
    <section class="certificate">
      <div class="kicker">Reliability Certificate</div>
      <div class="check-grid">
        ${checklist
          .map(
            ([label, detail]) =>
              `<div class="check-item"><strong>${escapeHtml(label)}</strong>${escapeHtml(detail)}</div>`
          )
          .join("")}
      </div>
    </section>
    <section class="sources">
      <div class="kicker">Court Paper Control Sheet</div>
      <div class="court-paper-grid">
        ${courtPaperControls
          .map(item => {
            const statusClass =
              item.status === "READY"
                ? "readiness-ready"
                : item.status === "BLOCKED"
                  ? "readiness-blocked"
                  : "readiness-review";
            return `<div class="court-paper-card"><strong>${escapeHtml(item.label)}</strong><span class="readiness-status ${statusClass}">${escapeHtml(item.status)}</span><p>${escapeHtml(item.detail)}</p></div>`;
          })
          .join("")}
      </div>
    </section>
    <section class="sources">
      <div class="kicker">Court Filing Readiness</div>
      <table class="readiness-table">
        <thead><tr><th>Gate</th><th>Status</th><th>Required human review</th></tr></thead>
        <tbody>
          ${readinessChecklist
            .map(([label, status, detail]) => {
              const statusClass =
                status === "READY"
                  ? "readiness-ready"
                  : status === "BLOCKED"
                    ? "readiness-blocked"
                    : "readiness-review";
              return `<tr><td>${escapeHtml(label)}</td><td class="readiness-status ${statusClass}">${escapeHtml(status)}</td><td>${escapeHtml(detail)}</td></tr>`;
            })
            .join("")}
        </tbody>
      </table>
    </section>
    ${
      sourcePreview.length > 0
        ? `<section class="sources"><div class="kicker">Source Control</div><div class="source-list">${sourcePreview
            .map(
              document =>
                `<div class="source-item"><strong>${escapeHtml(document.fileName)}</strong>${escapeHtml(document.status)} - ${document.analysisReady ? "analysis-ready" : "not analysis-ready"} - OCR ${document.extractionQualityScore ?? "n/a"}/100<br />SHA: ${escapeHtml(shortHash(document.documentHash))}</div>`
            )
            .join("")}</div>${
            descriptor.documents.length > sourcePreview.length
              ? `<p>${descriptor.documents.length - sourcePreview.length} additional source(s) listed in the report body.</p>`
              : ""
          }</section>`
        : ""
    }
    ${
      findingPreview.length > 0
        ? `<section class="sources"><div class="kicker">Finding Ledger</div><table class="ledger"><thead><tr><th>Finding</th><th>Confidence</th><th>Leverage</th><th>QC / Report Use</th></tr></thead><tbody>${findingPreview
            .map(
              finding =>
                `<tr><td>${escapeHtml(shortText(finding.title, 110))}</td><td>${escapeHtml(String(finding.confidence ?? "n/a"))}</td><td>${escapeHtml(String(finding.leverageScore ?? "n/a"))}</td><td>${escapeHtml(finding.qcStatus ?? "unknown")} - ${escapeHtml(findingInclusionLabel(finding))}</td></tr>`
            )
            .join("")}</tbody></table>${
            descriptor.findings.length > findingPreview.length
              ? `<p>${descriptor.findings.length - findingPreview.length} additional finding(s) are preserved in the saved report metadata.</p>`
              : ""
          }</section>`
        : ""
    }
    <section class="body">${groupHtmlBlocks(blocks)}</section>
  </main>
</body>
</html>`;
}

function drawPleadingPaper(doc: PDFKit.PDFDocument) {
  const contentRight = doc.page.width - doc.page.margins.right;
  const originalX = doc.x;
  const originalY = doc.y;

  doc.save();
  doc
    .font("Times-Roman")
    .fontSize(7.5)
    .fillColor(COLORS.pleadingNumber)
    .strokeColor(COLORS.pleadingLine)
    .lineWidth(0.45);

  doc
    .moveTo(PLEADING.ruleX, PLEADING.top - 14)
    .lineTo(PLEADING.ruleX, PLEADING.bottom + 14)
    .stroke();
  doc
    .moveTo(PLEADING.ruleX + 4, PLEADING.top - 14)
    .lineTo(PLEADING.ruleX + 4, PLEADING.bottom + 14)
    .stroke();

  for (let line = 1; line <= PLEADING.lineCount; line += 1) {
    const y = pleadingLineY(line);
    doc.text(String(line), PLEADING.lineNumberX, y - 4, {
      width: 20,
      align: "right",
      lineBreak: false,
    });
    doc
      .strokeColor("#eef2f7")
      .lineWidth(0.25)
      .moveTo(PLEADING.ruleX + 14, y + 2)
      .lineTo(contentRight, y + 2)
      .stroke();
  }

  doc.restore();
  doc.x = originalX;
  doc.y = originalY;
  doc.font("Times-Roman").fontSize(11).fillColor(COLORS.ink);
}

function drawPdfCaptionBlock(
  doc: PDFKit.PDFDocument,
  title: string,
  descriptor: ReportDescriptor
) {
  const filing = descriptor.filingMetadata;
  const partyLine = filingPartyLine(filing);
  const leftTitle = partyLine ?? descriptor.title ?? title;
  const filingTitle = filing.filingTitle ?? descriptor.title ?? title;
  const courtLine =
    filing.courtName ?? filing.jurisdiction ?? "Court / forum not supplied";
  const caseLine = filing.caseNumber
    ? `Case No. ${filing.caseNumber}`
    : "Case No. not supplied";
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const width = right - left;
  const top = doc.y;
  const leftColumn = width * 0.47;
  const rightColumn = width - leftColumn;
  const boxHeight = 128;

  doc
    .font("Times-Bold")
    .fontSize(10)
    .fillColor(COLORS.ink)
    .text("DUEPROCESS AI", left, top, {
      width,
      align: "center",
      characterSpacing: 1.2,
    });
  doc
    .font("Times-Roman")
    .fontSize(8)
    .fillColor(COLORS.muted)
    .text("SOURCE-BOUND LEGAL WORK PRODUCT", left, top + 14, {
      width,
      align: "center",
      characterSpacing: 0.9,
    });

  const boxTop = top + 40;
  doc
    .strokeColor(COLORS.ink)
    .lineWidth(0.8)
    .rect(left, boxTop, width, boxHeight)
    .stroke();
  doc
    .moveTo(left + leftColumn, boxTop)
    .lineTo(left + leftColumn, boxTop + boxHeight)
    .stroke();
  doc
    .moveTo(left + leftColumn, boxTop + 74)
    .lineTo(right, boxTop + 74)
    .stroke();

  doc
    .font("Times-Roman")
    .fontSize(9)
    .fillColor(COLORS.ink)
    .text(partyLine ? "Parties:" : "In re:", left + 10, boxTop + 14, {
      width: leftColumn - 20,
    })
    .font("Times-Bold")
    .fontSize(10.5)
    .text(leftTitle, left + 10, boxTop + 30, {
      width: leftColumn - 20,
      lineGap: 2,
    })
    .font("Times-Roman")
    .fontSize(8)
    .fillColor(COLORS.muted)
    .text(courtLine, left + 10, boxTop + 78, {
      width: leftColumn - 20,
      lineGap: 1,
    })
    .text(caseLine, left + 10, boxTop + 94, {
      width: leftColumn - 20,
      lineGap: 1,
    });

  const reportType = formatTemplate(descriptor.template);
  doc
    .font("Times-Bold")
    .fontSize(9.5)
    .text(filingTitle.toUpperCase(), left + leftColumn + 10, boxTop + 12, {
      width: rightColumn - 20,
      align: "center",
    })
    .font("Times-Roman")
    .fontSize(8.5)
    .text(
      filing.filingSubtitle ?? reportType,
      left + leftColumn + 10,
      boxTop + 34,
      {
        width: rightColumn - 20,
        align: "center",
      }
    );

  const stats = descriptorStats(descriptor)
    .slice(0, 4)
    .map(([label, value]) => `${label}: ${value}`)
    .join("\n");
  doc
    .font("Times-Roman")
    .fontSize(8.3)
    .fillColor(COLORS.muted)
    .text(stats, left + leftColumn + 10, boxTop + 84, {
      width: rightColumn - 20,
      lineGap: 2,
    });

  doc.y = boxTop + boxHeight + 22;
}

function addPdfFooter(doc: PDFKit.PDFDocument, title: string) {
  const range = doc.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index);
    const pageNumber = index - range.start + 1;
    const footerY = doc.page.height - doc.page.margins.bottom - 16;
    const width =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;

    doc
      .font("Times-Roman")
      .fontSize(7.5)
      .fillColor(COLORS.muted)
      .text(
        "DueProcess AI - source-bound legal work product",
        doc.page.margins.left,
        footerY,
        {
          width,
          align: "left",
          lineBreak: false,
        }
      )
      .text(
        `Page ${pageNumber} of ${range.count}`,
        doc.page.margins.left,
        footerY,
        {
          width,
          align: "right",
          lineBreak: false,
        }
      );
    doc.info.Title = title;
  }
}

function pdfEnsureSpace(doc: PDFKit.PDFDocument, height: number) {
  if (doc.y + height > doc.page.height - doc.page.margins.bottom - 32) {
    doc.addPage();
  }
}

function writePdfText(
  doc: PDFKit.PDFDocument,
  text: string,
  options: {
    font?: string;
    size?: number;
    color?: string;
    indent?: number;
    paragraphGap?: number;
  } = {}
) {
  doc
    .font(options.font ?? "Times-Roman")
    .fontSize(options.size ?? 11)
    .fillColor(options.color ?? COLORS.ink)
    .text(text, {
      indent: options.indent,
      paragraphGap: options.paragraphGap ?? 8,
      lineGap: 5,
    });
}

function writePdfMetadata(
  doc: PDFKit.PDFDocument,
  descriptor: ReportDescriptor
) {
  const startX = doc.page.margins.left;
  const startY = doc.y;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const columnWidth = width / 3 - 8;
  const rowHeight = 54;

  const stats = descriptorStats(descriptor);
  stats.forEach(([label, value], index) => {
    const x = startX + (index % 3) * (columnWidth + 12);
    const y = startY + Math.floor(index / 3) * (rowHeight + 10);
    doc
      .roundedRect(x, y, columnWidth, rowHeight, 5)
      .fillAndStroke(COLORS.panel, COLORS.faint);
    doc
      .font("Times-Bold")
      .fontSize(7)
      .fillColor(COLORS.accentDark)
      .text(label.toUpperCase(), x + 10, y + 10, { width: columnWidth - 20 });
    doc
      .font("Times-Bold")
      .fontSize(9.5)
      .fillColor(COLORS.ink)
      .text(value, x + 10, y + 25, { width: columnWidth - 20, lineGap: 1 });
  });

  doc.y = startY + Math.ceil(stats.length / 3) * (rowHeight + 10) + 12;
}

function writePdfNotice(doc: PDFKit.PDFDocument) {
  const x = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const y = doc.y;
  const text =
    "Export quality gate: this packet is generated from QC-cleared or explicitly overridden findings. Unsupported accusations should appear as gaps, demands, or inferences - not proven facts.";

  doc.roundedRect(x, y, width, 52, 5).fillAndStroke(COLORS.caution, "#f59e0b");
  doc
    .font("Times-Bold")
    .fontSize(9)
    .fillColor(COLORS.cautionText)
    .text(text, x + 12, y + 12, { width: width - 24, lineGap: 2 });
  doc.y = y + 66;
}

function writePdfReliabilityCertificate(
  doc: PDFKit.PDFDocument,
  descriptor: ReportDescriptor
) {
  const checklist = reliabilityChecklist(descriptor);
  const x = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const columnGap = 10;
  const columnWidth = (width - columnGap) / 2;
  const rowHeight = 58;

  pdfEnsureSpace(doc, 170);
  writePdfText(doc, "Reliability Certificate", {
    font: "Times-Bold",
    size: 12,
    color: COLORS.accentDark,
    paragraphGap: 8,
  });

  const startY = doc.y;
  checklist.forEach(([label, detail], index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const cellX = x + col * (columnWidth + columnGap);
    const cellY = startY + row * (rowHeight + 8);

    doc
      .roundedRect(cellX, cellY, columnWidth, rowHeight, 5)
      .fillAndStroke("#fffbeb", "#f59e0b");
    doc
      .font("Times-Bold")
      .fontSize(8)
      .fillColor(COLORS.cautionText)
      .text(label.toUpperCase(), cellX + 10, cellY + 9, {
        width: columnWidth - 20,
      });
    doc
      .font("Times-Roman")
      .fontSize(8)
      .fillColor(COLORS.ink)
      .text(detail, cellX + 10, cellY + 24, {
        width: columnWidth - 20,
        lineGap: 1,
      });
  });

  doc.y = startY + rowHeight * 2 + 28;
}

function writePdfCourtPaperControlSheet(
  doc: PDFKit.PDFDocument,
  descriptor: ReportDescriptor
) {
  const controls = courtPaperControlSheet(descriptor);
  const x = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const columnGap = 10;
  const columnWidth = (width - columnGap) / 2;
  const rowHeight = 78;

  pdfEnsureSpace(doc, 240);
  writePdfText(doc, "Court Paper Control Sheet", {
    font: "Times-Bold",
    size: 12,
    color: COLORS.accentDark,
    paragraphGap: 8,
  });

  const startY = doc.y;
  controls.forEach((item, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const cellX = x + col * (columnWidth + columnGap);
    const cellY = startY + row * (rowHeight + 8);
    const statusColor =
      item.status === "READY"
        ? COLORS.green
        : item.status === "BLOCKED"
          ? COLORS.red
          : COLORS.cautionText;

    doc
      .roundedRect(cellX, cellY, columnWidth, rowHeight, 5)
      .fillAndStroke("#ffffff", COLORS.faint);
    doc
      .font("Times-Bold")
      .fontSize(8)
      .fillColor(COLORS.ink)
      .text(item.label.toUpperCase(), cellX + 10, cellY + 9, {
        width: columnWidth - 20,
      });
    doc
      .font("Times-Bold")
      .fontSize(7.4)
      .fillColor(statusColor)
      .text(item.status, cellX + 10, cellY + 24, {
        width: columnWidth - 20,
      });
    doc
      .font("Times-Roman")
      .fontSize(7.6)
      .fillColor(COLORS.muted)
      .text(item.detail, cellX + 10, cellY + 39, {
        width: columnWidth - 20,
        lineGap: 1,
        height: rowHeight - 44,
        ellipsis: true,
      });
  });

  doc.y = startY + Math.ceil(controls.length / 2) * (rowHeight + 8) + 14;
}

function writePdfCourtReadinessSheet(
  doc: PDFKit.PDFDocument,
  descriptor: ReportDescriptor
) {
  const checklist = courtFilingReadinessChecklist(descriptor);
  const x = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const columns = [width * 0.28, width * 0.18, width * 0.54];
  const headers = ["Gate", "Status", "Required human review"];

  pdfEnsureSpace(doc, 190);
  writePdfText(doc, "Court Filing Readiness", {
    font: "Times-Bold",
    size: 12,
    color: COLORS.accentDark,
    paragraphGap: 8,
  });

  let cursorX = x;
  const headerY = doc.y;
  headers.forEach((header, index) => {
    doc
      .rect(cursorX, headerY, columns[index], 20)
      .fillAndStroke(COLORS.ink, COLORS.ink);
    doc
      .font("Times-Bold")
      .fontSize(7.5)
      .fillColor("#ffffff")
      .text(header, cursorX + 5, headerY + 6, {
        width: columns[index] - 10,
        lineBreak: false,
      });
    cursorX += columns[index];
  });
  doc.y = headerY + 22;

  checklist.forEach(([label, status, detail]) => {
    const rowHeight = Math.min(
      54,
      Math.max(
        32,
        doc.heightOfString(detail, {
          width: columns[2] - 10,
          lineGap: 1,
        }) + 14
      )
    );
    pdfEnsureSpace(doc, rowHeight + 8);
    const y = doc.y;
    cursorX = x;
    const values = [label, status, detail];
    values.forEach((value, index) => {
      doc
        .rect(cursorX, y, columns[index], rowHeight)
        .fillAndStroke("#ffffff", COLORS.faint);
      const statusColor =
        index !== 1
          ? COLORS.ink
          : value === "READY"
            ? COLORS.green
            : value === "BLOCKED"
              ? COLORS.red
              : COLORS.cautionText;
      doc
        .font(
          index === 1
            ? "Times-Bold"
            : index === 0
              ? "Times-Bold"
              : "Times-Roman"
        )
        .fontSize(index === 1 ? 7.2 : 7.8)
        .fillColor(statusColor)
        .text(value, cursorX + 5, y + 7, {
          width: columns[index] - 10,
          height: rowHeight - 10,
          lineGap: 1,
          ellipsis: true,
        });
      cursorX += columns[index];
    });
    doc.y = y + rowHeight;
  });

  doc.moveDown(0.6);
}

function writePdfSourcePreview(
  doc: PDFKit.PDFDocument,
  descriptor: ReportDescriptor
) {
  if (descriptor.documents.length === 0) return;
  pdfEnsureSpace(doc, 120);
  writePdfText(doc, "Source Control", {
    font: "Times-Bold",
    size: 12,
    color: COLORS.accentDark,
    paragraphGap: 8,
  });

  descriptor.documents.slice(0, 6).forEach(document => {
    pdfEnsureSpace(doc, 42);
    const statusColor = document.analysisReady ? COLORS.green : COLORS.red;
    doc
      .font("Times-Bold")
      .fontSize(9)
      .fillColor(COLORS.ink)
      .text(document.fileName, { continued: false, paragraphGap: 1 });
    doc
      .font("Times-Roman")
      .fontSize(8)
      .fillColor(statusColor)
      .text(
        `${document.status} - ${document.analysisReady ? "analysis-ready" : "not analysis-ready"} - OCR ${document.extractionQualityScore ?? "n/a"}/100`,
        { paragraphGap: 1 }
      );
    doc
      .font("Times-Roman")
      .fontSize(7.5)
      .fillColor(COLORS.muted)
      .text(`SHA: ${shortHash(document.documentHash)}`, { paragraphGap: 5 });
  });

  if (descriptor.documents.length > 6) {
    writePdfText(
      doc,
      `${descriptor.documents.length - 6} additional source(s) are listed in the report body.`,
      {
        size: 8,
        color: COLORS.muted,
      }
    );
  }
}

function writePdfFindingLedger(
  doc: PDFKit.PDFDocument,
  descriptor: ReportDescriptor
) {
  if (descriptor.findings.length === 0) return;
  pdfEnsureSpace(doc, 120);
  writePdfText(doc, "Finding Ledger", {
    font: "Times-Bold",
    size: 12,
    color: COLORS.accentDark,
    paragraphGap: 8,
  });

  const x = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const columns = [width * 0.5, width * 0.14, width * 0.14, width * 0.22];
  const headers = ["Finding", "Conf.", "Leverage", "QC / Use"];
  const rowHeight = 34;

  const drawHeader = () => {
    pdfEnsureSpace(doc, rowHeight + 8);
    let cursorX = x;
    const y = doc.y;
    doc.font("Times-Bold").fontSize(7.5).fillColor("#ffffff");
    headers.forEach((header, index) => {
      doc
        .rect(cursorX, y, columns[index], 20)
        .fillAndStroke(COLORS.ink, COLORS.ink);
      doc
        .font("Times-Bold")
        .fontSize(7.5)
        .fillColor("#ffffff")
        .text(header, cursorX + 5, y + 6, {
          width: columns[index] - 10,
          lineBreak: false,
        });
      cursorX += columns[index];
    });
    doc.y = y + 22;
  };

  drawHeader();
  descriptor.findings.slice(0, 14).forEach(finding => {
    pdfEnsureSpace(doc, rowHeight + 8);
    let cursorX = x;
    const y = doc.y;
    const values = [
      shortText(finding.title, 90),
      String(finding.confidence ?? "n/a"),
      String(finding.leverageScore ?? "n/a"),
      `${finding.qcStatus ?? "unknown"} / ${findingInclusionLabel(finding)}`,
    ];

    values.forEach((value, index) => {
      doc
        .rect(cursorX, y, columns[index], rowHeight)
        .fillAndStroke("#ffffff", COLORS.faint);
      doc
        .font(index === 0 ? "Times-Bold" : "Times-Roman")
        .fontSize(7.8)
        .fillColor(index === 3 ? COLORS.muted : COLORS.ink)
        .text(value, cursorX + 5, y + 7, {
          width: columns[index] - 10,
          height: rowHeight - 10,
          ellipsis: true,
        });
      cursorX += columns[index];
    });
    doc.y = y + rowHeight;
  });

  if (descriptor.findings.length > 14) {
    writePdfText(
      doc,
      `${descriptor.findings.length - 14} additional finding(s) are preserved in the saved report metadata.`,
      { size: 8, color: COLORS.muted, paragraphGap: 8 }
    );
  } else {
    doc.moveDown(0.5);
  }
}

function writePdfMarkdownTable(
  doc: PDFKit.PDFDocument,
  table: Extract<MarkdownBlock, { kind: "table" }>
) {
  const maxColumns = Math.max(
    table.headers.length,
    ...table.rows.map(row => row.length)
  );
  if (maxColumns === 0) return;

  const x = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const columnWidth = width / maxColumns;
  const normalizeRow = (row: string[]) =>
    Array.from({ length: maxColumns }, (_, index) => row[index] ?? "");
  const allRows = [
    { cells: normalizeRow(table.headers), header: true },
    ...table.rows.map(row => ({ cells: normalizeRow(row), header: false })),
  ];

  allRows.forEach(row => {
    doc.font(row.header ? "Times-Bold" : "Times-Roman").fontSize(7.8);
    const rowHeight = Math.min(
      86,
      Math.max(
        row.header ? 24 : 28,
        ...row.cells.map(
          cell =>
            doc.heightOfString(cell, {
              width: columnWidth - 10,
              lineGap: 1,
            }) + 14
        )
      )
    );
    pdfEnsureSpace(doc, rowHeight + 8);

    let cursorX = x;
    const y = doc.y;
    row.cells.forEach(cell => {
      doc
        .rect(cursorX, y, columnWidth, rowHeight)
        .fillAndStroke(
          row.header ? COLORS.ink : "#ffffff",
          row.header ? COLORS.ink : COLORS.faint
        );
      doc
        .font(row.header ? "Times-Bold" : "Times-Roman")
        .fontSize(7.8)
        .fillColor(row.header ? "#ffffff" : COLORS.ink)
        .text(cell, cursorX + 5, y + 7, {
          width: columnWidth - 10,
          height: rowHeight - 10,
          lineGap: 1,
          ellipsis: true,
        });
      cursorX += columnWidth;
    });
    doc.x = x;
    doc.y = y + rowHeight;
  });

  doc.x = x;
  doc.moveDown(0.65);
}

async function markdownToPdfBuffer(
  markdown: string,
  title: string,
  descriptor: ReportDescriptor
): Promise<Buffer> {
  const doc = new PDFDocument({
    autoFirstPage: true,
    bufferPages: true,
    margins: PLEADING.margins,
    size: "LETTER",
  });
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  doc.info.Title = descriptor.title || title;
  doc.info.Author = "DueProcess AI";
  doc.info.Subject = "Source-bound legal work product on pleading paper";

  doc.on("pageAdded", () => {
    drawPleadingPaper(doc);
  });
  drawPleadingPaper(doc);
  drawPdfCaptionBlock(doc, title, descriptor);
  writePdfMetadata(doc, descriptor);
  writePdfNotice(doc);
  writePdfReliabilityCertificate(doc, descriptor);
  writePdfCourtPaperControlSheet(doc, descriptor);
  writePdfCourtReadinessSheet(doc, descriptor);
  writePdfSourcePreview(doc, descriptor);
  writePdfFindingLedger(doc, descriptor);

  doc.addPage();
  parseMarkdownBlocks(markdown).forEach(block => {
    if (block.kind === "heading") {
      const sizes = { 1: 18, 2: 14, 3: 11.5 } as const;
      const colors = {
        1: COLORS.ink,
        2: COLORS.accentDark,
        3: "#1f2937",
      } as const;
      pdfEnsureSpace(doc, block.level === 1 ? 64 : 42);
      if (block.level === 2) {
        doc
          .strokeColor(COLORS.faint)
          .lineWidth(0.75)
          .moveTo(doc.page.margins.left, doc.y)
          .lineTo(doc.page.width - doc.page.margins.right, doc.y)
          .stroke();
        doc.moveDown(0.45);
      }
      writePdfText(doc, block.text, {
        font: "Times-Bold",
        size: sizes[block.level],
        color: colors[block.level],
        paragraphGap: block.level === 1 ? 10 : 6,
      });
      return;
    }

    if (block.kind === "bullet") {
      pdfEnsureSpace(doc, 28);
      writePdfText(doc, `- ${block.text}`, { indent: 12, paragraphGap: 3 });
      return;
    }

    if (block.kind === "numbered") {
      pdfEnsureSpace(doc, 28);
      writePdfText(doc, `${block.marker} ${block.text}`, {
        indent: 12,
        paragraphGap: 3,
      });
      return;
    }

    if (block.kind === "table") {
      pdfEnsureSpace(doc, 72);
      writePdfMarkdownTable(doc, block);
      return;
    }

    if (block.kind === "quote") {
      pdfEnsureSpace(doc, 48);
      const x = doc.page.margins.left;
      const y = doc.y;
      const width =
        doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const quoteHeight =
        doc.heightOfString(stripMarkdown(block.text), {
          width: width - 24,
          lineGap: 2,
        }) + 20;
      doc
        .rect(x, y, width, quoteHeight)
        .fillAndStroke(COLORS.panel, COLORS.faint);
      doc
        .font("Times-Italic")
        .fontSize(9)
        .fillColor(COLORS.muted)
        .text(stripMarkdown(block.text), x + 12, y + 9, {
          width: width - 24,
          lineGap: 2,
        });
      doc.y = y + quoteHeight + 8;
      return;
    }

    if (block.kind === "code") {
      pdfEnsureSpace(doc, 48);
      writePdfText(doc, block.text, {
        font: "Courier",
        size: 8.5,
        color: COLORS.muted,
        paragraphGap: 8,
      });
      return;
    }

    pdfEnsureSpace(doc, 24);
    writePdfText(doc, stripMarkdown(block.text), { paragraphGap: 5 });
  });

  addPdfFooter(doc, descriptor.title || title);
  doc.end();
  return done;
}

function docxRun(
  value: string,
  options: { bold?: boolean; color?: string } = {}
) {
  return new TextRun({
    text: value,
    bold: options.bold,
    color: options.color ?? "111827",
    font: "Arial",
    size: 21,
  });
}

function docxInlineRuns(value: string): TextRun[] {
  const runs = splitInlineMarkdown(value).map(
    run =>
      new TextRun({
        text: run.text,
        bold: run.bold,
        font: "Arial",
        size: 21,
        color: "111827",
      })
  );
  return runs.length > 0 ? runs : [docxRun(stripMarkdown(value))];
}

function docxParagraph(
  text: string,
  options: { bold?: boolean; color?: string } = {}
) {
  return new Paragraph({
    children: [docxRun(text, options)],
    spacing: { after: 140, line: 286 },
  });
}

function docxMetaCell(label: string, value: string) {
  return new TableCell({
    margins: { top: 120, bottom: 120, left: 140, right: 140 },
    verticalAlign: VerticalAlign.CENTER,
    width: { size: 3120, type: WidthType.DXA },
    shading: { fill: "F8FAFC" },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
    },
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text: label.toUpperCase(),
            bold: true,
            color: "7C4A03",
            font: "Arial",
            size: 14,
          }),
        ],
        spacing: { after: 70 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: value,
            bold: true,
            color: "111827",
            font: "Arial",
            size: 18,
          }),
        ],
      }),
    ],
  });
}

function docxMetadataTable(descriptor: ReportDescriptor) {
  const stats = descriptorStats(descriptor);
  const rows: TableRow[] = [];
  for (let index = 0; index < stats.length; index += 3) {
    rows.push(
      new TableRow({
        children: stats
          .slice(index, index + 3)
          .map(([label, value]) => docxMetaCell(label, value)),
      })
    );
  }

  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [3120, 3120, 3120],
    layout: TableLayoutType.FIXED,
    borders: {
      top: { style: BorderStyle.NIL, size: 0, color: "FFFFFF" },
      bottom: { style: BorderStyle.NIL, size: 0, color: "FFFFFF" },
      left: { style: BorderStyle.NIL, size: 0, color: "FFFFFF" },
      right: { style: BorderStyle.NIL, size: 0, color: "FFFFFF" },
      insideHorizontal: { style: BorderStyle.NIL, size: 0, color: "FFFFFF" },
      insideVertical: { style: BorderStyle.NIL, size: 0, color: "FFFFFF" },
    },
    rows,
  });
}

function docxCaptionTable(descriptor: ReportDescriptor, fallbackTitle: string) {
  const filing = descriptor.filingMetadata;
  const partyLine =
    filingPartyLine(filing) ?? descriptor.title ?? fallbackTitle;
  const filingTitle = filing.filingTitle ?? descriptor.title ?? fallbackTitle;
  const captionLines = [
    filing.courtName ?? filing.jurisdiction ?? "Court / forum not supplied",
    filing.caseNumber
      ? `Case No. ${filing.caseNumber}`
      : "Case No. not supplied",
    filing.preparedFor ? `Prepared for: ${filing.preparedFor}` : null,
  ].filter((line): line is string => Boolean(line));

  const cell = (children: Paragraph[]) =>
    new TableCell({
      margins: { top: 180, bottom: 180, left: 180, right: 180 },
      verticalAlign: VerticalAlign.CENTER,
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1, color: "111827" },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: "111827" },
        left: { style: BorderStyle.SINGLE, size: 1, color: "111827" },
        right: { style: BorderStyle.SINGLE, size: 1, color: "111827" },
      },
      children,
    });

  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [4300, 5060],
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({
        children: [
          cell([
            new Paragraph({
              children: [
                new TextRun({
                  text: filingPartyLine(filing) ? "PARTIES" : "IN RE",
                  bold: true,
                  color: "7C4A03",
                  font: "Arial",
                  size: 14,
                }),
              ],
              spacing: { after: 90 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: partyLine,
                  bold: true,
                  color: "111827",
                  font: "Arial",
                  size: 20,
                }),
              ],
              spacing: { after: 100 },
            }),
            ...captionLines.map(
              line =>
                new Paragraph({
                  children: [
                    new TextRun({
                      text: line,
                      color: "4B5563",
                      font: "Arial",
                      size: 16,
                    }),
                  ],
                  spacing: { after: 45 },
                })
            ),
          ]),
          cell([
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: filingTitle.toUpperCase(),
                  bold: true,
                  color: "111827",
                  font: "Arial",
                  size: 20,
                }),
              ],
              spacing: { after: 100 },
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text:
                    filing.filingSubtitle ??
                    formatTemplate(descriptor.template),
                  color: "4B5563",
                  font: "Arial",
                  size: 17,
                }),
              ],
            }),
          ]),
        ],
      }),
    ],
  });
}

function docxNotice() {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: "F59E0B" },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: "F59E0B" },
      left: { style: BorderStyle.SINGLE, size: 2, color: "F59E0B" },
      right: { style: BorderStyle.SINGLE, size: 2, color: "F59E0B" },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            margins: { top: 160, bottom: 160, left: 180, right: 180 },
            shading: { fill: "FFFBEB" },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Export quality gate: ",
                    bold: true,
                    color: "78350F",
                    font: "Arial",
                    size: 19,
                  }),
                  new TextRun({
                    text: "this packet is generated from QC-cleared or explicitly overridden findings. Unsupported accusations should appear as gaps, demands, or inferences - not proven facts.",
                    color: "78350F",
                    font: "Arial",
                    size: 19,
                  }),
                ],
                spacing: { after: 0, line: 276 },
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function docxReliabilityCertificate(descriptor: ReportDescriptor) {
  const checklist = reliabilityChecklist(descriptor);
  const rows: TableRow[] = [];

  for (let index = 0; index < checklist.length; index += 2) {
    rows.push(
      new TableRow({
        children: checklist.slice(index, index + 2).map(
          ([label, detail]) =>
            new TableCell({
              margins: { top: 120, bottom: 120, left: 140, right: 140 },
              width: { size: 4680, type: WidthType.DXA },
              shading: { fill: "FFFBEB" },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 2, color: "F59E0B" },
                bottom: { style: BorderStyle.SINGLE, size: 2, color: "F59E0B" },
                left: { style: BorderStyle.SINGLE, size: 2, color: "F59E0B" },
                right: { style: BorderStyle.SINGLE, size: 2, color: "F59E0B" },
              },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: label.toUpperCase(),
                      bold: true,
                      color: "78350F",
                      font: "Arial",
                      size: 15,
                    }),
                  ],
                  spacing: { after: 70 },
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: detail,
                      color: "111827",
                      font: "Arial",
                      size: 17,
                    }),
                  ],
                  spacing: { after: 0, line: 240 },
                }),
              ],
            })
        ),
      })
    );
  }

  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [4680, 4680],
    layout: TableLayoutType.FIXED,
    borders: {
      top: { style: BorderStyle.NIL, size: 0, color: "FFFFFF" },
      bottom: { style: BorderStyle.NIL, size: 0, color: "FFFFFF" },
      left: { style: BorderStyle.NIL, size: 0, color: "FFFFFF" },
      right: { style: BorderStyle.NIL, size: 0, color: "FFFFFF" },
      insideHorizontal: { style: BorderStyle.NIL, size: 0, color: "FFFFFF" },
      insideVertical: { style: BorderStyle.NIL, size: 0, color: "FFFFFF" },
    },
    rows,
  });
}

function docxCourtPaperControlSheet(descriptor: ReportDescriptor) {
  const controls = courtPaperControlSheet(descriptor);
  const rows: TableRow[] = [];

  for (let index = 0; index < controls.length; index += 2) {
    rows.push(
      new TableRow({
        children: controls.slice(index, index + 2).map(item => {
          const statusColor =
            item.status === "READY"
              ? "047857"
              : item.status === "BLOCKED"
                ? "B91C1C"
                : "92400E";
          return new TableCell({
            margins: { top: 120, bottom: 120, left: 140, right: 140 },
            width: { size: 4680, type: WidthType.DXA },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
              bottom: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
              left: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
              right: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
            },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: item.label.toUpperCase(),
                    bold: true,
                    color: "111827",
                    font: "Arial",
                    size: 15,
                  }),
                ],
                spacing: { after: 60 },
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: item.status,
                    bold: true,
                    color: statusColor,
                    font: "Arial",
                    size: 14,
                  }),
                ],
                spacing: { after: 60 },
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: item.detail,
                    color: "4B5563",
                    font: "Arial",
                    size: 16,
                  }),
                ],
                spacing: { after: 0, line: 230 },
              }),
            ],
          });
        }),
      })
    );
  }

  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [4680, 4680],
    layout: TableLayoutType.FIXED,
    borders: {
      top: { style: BorderStyle.NIL, size: 0, color: "FFFFFF" },
      bottom: { style: BorderStyle.NIL, size: 0, color: "FFFFFF" },
      left: { style: BorderStyle.NIL, size: 0, color: "FFFFFF" },
      right: { style: BorderStyle.NIL, size: 0, color: "FFFFFF" },
      insideHorizontal: { style: BorderStyle.NIL, size: 0, color: "FFFFFF" },
      insideVertical: { style: BorderStyle.NIL, size: 0, color: "FFFFFF" },
    },
    rows,
  });
}

function docxCourtReadinessTable(descriptor: ReportDescriptor) {
  const checklist = courtFilingReadinessChecklist(descriptor);
  const headerCell = (label: string) =>
    new TableCell({
      shading: { fill: "111827" },
      margins: { top: 90, bottom: 90, left: 110, right: 110 },
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text: label,
              bold: true,
              color: "FFFFFF",
              font: "Arial",
              size: 16,
            }),
          ],
        }),
      ],
    });
  const bodyCell = (
    value: string,
    width: number,
    options: { bold?: boolean; color?: string } = {}
  ) =>
    new TableCell({
      margins: { top: 90, bottom: 90, left: 110, right: 110 },
      width: { size: width, type: WidthType.DXA },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
        left: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
        right: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
      },
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text: value,
              bold: options.bold,
              color: options.color ?? "111827",
              font: "Arial",
              size: 16,
            }),
          ],
          spacing: { after: 0, line: 230 },
        }),
      ],
    });

  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2400, 1500, 5460],
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({
        children: [
          headerCell("Gate"),
          headerCell("Status"),
          headerCell("Required human review"),
        ],
      }),
      ...checklist.map(([label, status, detail]) => {
        const statusColor =
          status === "READY"
            ? "047857"
            : status === "BLOCKED"
              ? "B91C1C"
              : "92400E";
        return new TableRow({
          children: [
            bodyCell(label, 2400, { bold: true }),
            bodyCell(status, 1500, { bold: true, color: statusColor }),
            bodyCell(detail, 5460),
          ],
        });
      }),
    ],
  });
}

function docxSourceTable(descriptor: ReportDescriptor): Table | null {
  if (descriptor.documents.length === 0) return null;

  const headerCell = (label: string) =>
    new TableCell({
      shading: { fill: "111827" },
      margins: { top: 90, bottom: 90, left: 110, right: 110 },
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text: label,
              bold: true,
              color: "FFFFFF",
              font: "Arial",
              size: 16,
            }),
          ],
        }),
      ],
    });

  const bodyCell = (value: string, width: number) =>
    new TableCell({
      margins: { top: 90, bottom: 90, left: 110, right: 110 },
      width: { size: width, type: WidthType.DXA },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
        left: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
        right: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
      },
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text: value,
              color: "111827",
              font: "Arial",
              size: 16,
            }),
          ],
          spacing: { after: 0, line: 240 },
        }),
      ],
    });

  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [4560, 1600, 1200, 2000],
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({
        children: [
          headerCell("Source"),
          headerCell("Status"),
          headerCell("OCR"),
          headerCell("SHA"),
        ],
      }),
      ...descriptor.documents.slice(0, 10).map(
        document =>
          new TableRow({
            children: [
              bodyCell(document.fileName, 4560),
              bodyCell(
                document.analysisReady ? "Ready" : document.status,
                1600
              ),
              bodyCell(String(document.extractionQualityScore ?? "n/a"), 1200),
              bodyCell(shortHash(document.documentHash), 2000),
            ],
          })
      ),
    ],
  });
}

function docxFindingTable(descriptor: ReportDescriptor): Table | null {
  if (descriptor.findings.length === 0) return null;

  const headerCell = (label: string) =>
    new TableCell({
      shading: { fill: "111827" },
      margins: { top: 90, bottom: 90, left: 110, right: 110 },
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text: label,
              bold: true,
              color: "FFFFFF",
              font: "Arial",
              size: 16,
            }),
          ],
        }),
      ],
    });

  const bodyCell = (value: string, width: number) =>
    new TableCell({
      margins: { top: 90, bottom: 90, left: 110, right: 110 },
      width: { size: width, type: WidthType.DXA },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
        left: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
        right: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
      },
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text: value,
              color: "111827",
              font: "Arial",
              size: 16,
            }),
          ],
          spacing: { after: 0, line: 240 },
        }),
      ],
    });

  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [4860, 1200, 1200, 2100],
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({
        children: [
          headerCell("Finding"),
          headerCell("Conf."),
          headerCell("Lev."),
          headerCell("QC / Use"),
        ],
      }),
      ...descriptor.findings.slice(0, 14).map(
        finding =>
          new TableRow({
            children: [
              bodyCell(shortText(finding.title, 120), 4860),
              bodyCell(String(finding.confidence ?? "n/a"), 1200),
              bodyCell(String(finding.leverageScore ?? "n/a"), 1200),
              bodyCell(
                `${finding.qcStatus ?? "unknown"} / ${findingInclusionLabel(finding)}`,
                2100
              ),
            ],
          })
      ),
    ],
  });
}

function docxMarkdownTable(
  table: Extract<MarkdownBlock, { kind: "table" }>
): Table {
  const maxColumns = Math.max(
    table.headers.length,
    ...table.rows.map(row => row.length)
  );
  const normalizeRow = (row: string[]) =>
    Array.from({ length: maxColumns }, (_, index) => row[index] ?? "");
  const cellWidth = Math.floor(9360 / Math.max(1, maxColumns));
  const makeCell = (value: string, header: boolean) =>
    new TableCell({
      margins: { top: 90, bottom: 90, left: 110, right: 110 },
      width: { size: cellWidth, type: WidthType.DXA },
      shading: header ? { fill: "111827" } : undefined,
      borders: {
        top: {
          style: BorderStyle.SINGLE,
          size: 1,
          color: header ? "111827" : "E5E7EB",
        },
        bottom: {
          style: BorderStyle.SINGLE,
          size: 1,
          color: header ? "111827" : "E5E7EB",
        },
        left: {
          style: BorderStyle.SINGLE,
          size: 1,
          color: header ? "111827" : "E5E7EB",
        },
        right: {
          style: BorderStyle.SINGLE,
          size: 1,
          color: header ? "111827" : "E5E7EB",
        },
      },
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text: value,
              bold: header,
              color: header ? "FFFFFF" : "111827",
              font: "Arial",
              size: 16,
            }),
          ],
          spacing: { after: 0, line: 226 },
        }),
      ],
    });

  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: Array.from({ length: maxColumns }, () => cellWidth),
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({
        children: normalizeRow(table.headers).map(cell => makeCell(cell, true)),
      }),
      ...table.rows.map(
        row =>
          new TableRow({
            children: normalizeRow(row).map(cell => makeCell(cell, false)),
          })
      ),
    ],
  });
}

function markdownBlockToDocx(block: MarkdownBlock): Paragraph | Table {
  if (block.kind === "heading") {
    return new Paragraph({
      text: block.text,
      heading:
        block.level === 1
          ? HeadingLevel.HEADING_1
          : block.level === 2
            ? HeadingLevel.HEADING_2
            : HeadingLevel.HEADING_3,
      spacing: { before: block.level === 1 ? 240 : 200, after: 100 },
    });
  }
  if (block.kind === "bullet") {
    return new Paragraph({
      bullet: { level: 0 },
      children: docxInlineRuns(block.text),
      spacing: { after: 80, line: 276 },
      indent: { left: 420, hanging: 180 },
    });
  }
  if (block.kind === "numbered") {
    return new Paragraph({
      children: [
        new TextRun({
          text: `${block.marker} `,
          bold: true,
          color: "7C4A03",
          font: "Arial",
          size: 21,
        }),
        ...docxInlineRuns(block.text),
      ],
      spacing: { after: 90, line: 276 },
    });
  }
  if (block.kind === "table") {
    return docxMarkdownTable(block);
  }
  if (block.kind === "quote") {
    return new Paragraph({
      children: [
        new TextRun({
          text: block.text,
          italics: true,
          color: "4B5563",
          font: "Arial",
          size: 20,
        }),
      ],
      border: {
        left: { style: BorderStyle.SINGLE, size: 8, color: "B7791F" },
      },
      indent: { left: 240 },
      spacing: { before: 120, after: 120, line: 276 },
    });
  }
  if (block.kind === "code") {
    return new Paragraph({
      children: [
        new TextRun({
          text: block.text,
          font: "Courier New",
          color: "4B5563",
          size: 17,
        }),
      ],
      spacing: { before: 120, after: 120, line: 240 },
      shading: { fill: "F8FAFC" },
    });
  }
  return new Paragraph({
    children: docxInlineRuns(block.text),
    spacing: { after: 140, line: 286 },
  });
}

function markdownToDocxChildren(
  markdown: string,
  title: string,
  descriptor: ReportDescriptor
) {
  const sourceTable = docxSourceTable(descriptor);
  const findingTable = docxFindingTable(descriptor);
  return [
    new Paragraph({
      children: [
        new TextRun({
          text: "DUEPROCESS AI - LEGAL INTELLIGENCE EXPORT",
          bold: true,
          color: "7C4A03",
          font: "Arial",
          size: 16,
        }),
      ],
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text:
            descriptor.filingMetadata.filingTitle || descriptor.title || title,
          bold: true,
          color: "111827",
          font: "Arial",
          size: 38,
        }),
      ],
      spacing: { after: 260 },
    }),
    docxCaptionTable(descriptor, title),
    new Paragraph({ children: [new TextRun("")], spacing: { after: 120 } }),
    docxMetadataTable(descriptor),
    new Paragraph({ children: [new TextRun("")], spacing: { after: 120 } }),
    docxNotice(),
    new Paragraph({ children: [new TextRun("")], spacing: { after: 160 } }),
    new Paragraph({
      text: "Reliability Certificate",
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 160, after: 100 },
    }),
    docxReliabilityCertificate(descriptor),
    new Paragraph({ children: [new TextRun("")], spacing: { after: 160 } }),
    new Paragraph({
      text: "Court Paper Control Sheet",
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 160, after: 100 },
    }),
    docxCourtPaperControlSheet(descriptor),
    new Paragraph({ children: [new TextRun("")], spacing: { after: 160 } }),
    new Paragraph({
      text: "Court Filing Readiness",
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 160, after: 100 },
    }),
    docxCourtReadinessTable(descriptor),
    new Paragraph({ children: [new TextRun("")], spacing: { after: 160 } }),
    new Paragraph({
      text: "Source Control",
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 160, after: 100 },
    }),
    sourceTable ??
      docxParagraph("No source metadata was attached to this export."),
    new Paragraph({ children: [new TextRun("")], spacing: { after: 160 } }),
    new Paragraph({
      text: "Finding Ledger",
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 160, after: 100 },
    }),
    findingTable ??
      docxParagraph("No structured findings were attached to this export."),
    new Paragraph({ children: [new TextRun("")], spacing: { after: 160 } }),
    ...parseMarkdownBlocks(markdown).map(markdownBlockToDocx),
  ];
}

async function markdownToDocxBuffer(
  markdown: string,
  title: string,
  descriptor: ReportDescriptor
): Promise<Buffer> {
  const document = new Document({
    creator: "DueProcess AI",
    description: "DueProcess AI source-bound exported report",
    title: descriptor.title || title,
    styles: {
      default: {
        document: {
          run: { font: "Arial", size: 21, color: "111827" },
          paragraph: { spacing: { after: 140, line: 286 } },
        },
      },
      paragraphStyles: [
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { font: "Arial", size: 30, bold: true, color: "111827" },
          paragraph: { spacing: { before: 280, after: 140 }, keepNext: true },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { font: "Arial", size: 24, bold: true, color: "7C4A03" },
          paragraph: { spacing: { before: 240, after: 120 }, keepNext: true },
        },
        {
          id: "Heading3",
          name: "Heading 3",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { font: "Arial", size: 21, bold: true, color: "1F2937" },
          paragraph: { spacing: { before: 180, after: 80 }, keepNext: true },
        },
      ],
    },
    sections: [
      {
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "DueProcess AI",
                    bold: true,
                    color: "7C4A03",
                    font: "Arial",
                    size: 16,
                  }),
                  new TextRun({
                    text: " - source-bound export",
                    color: "4B5563",
                    font: "Arial",
                    size: 16,
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: "Page ",
                    color: "6B7280",
                    font: "Arial",
                    size: 16,
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    color: "6B7280",
                    font: "Arial",
                    size: 16,
                  }),
                  new TextRun({
                    text: " of ",
                    color: "6B7280",
                    font: "Arial",
                    size: 16,
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    color: "6B7280",
                    font: "Arial",
                    size: 16,
                  }),
                ],
              }),
            ],
          }),
        },
        properties: {
          page: {
            margin: {
              top: 900,
              right: 720,
              bottom: 720,
              left: 720,
              header: 420,
              footer: 420,
            },
          },
        },
        children: markdownToDocxChildren(markdown, title, descriptor),
      },
    ],
  });

  return Packer.toBuffer(document);
}

export async function buildReportExportArtifact(
  report: StoredReportForExport,
  format: ReportExportFormat
): Promise<ReportExportArtifact> {
  const markdown = markdownFromStoredReport(report);
  const fileName = fileNameForExport(report, format);
  const mimeType = EXPORT_MIME_TYPES[format];
  const descriptor = descriptorFromStoredReport(report);

  if (format === "markdown") {
    return { content: markdown, encoding: "utf8", fileName, format, mimeType };
  }

  if (format === "html") {
    return {
      content: markdownToReportHtml(
        markdown,
        report.title,
        parseMetadata(report.metadata)
      ),
      encoding: "utf8",
      fileName,
      format,
      mimeType,
    };
  }

  if (format === "json") {
    return {
      content: JSON.stringify(
        {
          title: report.title,
          exportedAt: new Date().toISOString(),
          sourceFormat: report.format,
          exportQuality: buildExportQualityManifest(descriptor),
          markdown,
          metadata: parseMetadata(report.metadata),
        },
        null,
        2
      ),
      encoding: "utf8",
      fileName,
      format,
      mimeType,
    };
  }

  if (format === "pdf") {
    const pdf = await markdownToPdfBuffer(markdown, report.title, descriptor);
    return {
      content: pdf.toString("base64"),
      encoding: "base64",
      fileName,
      format,
      mimeType,
    };
  }

  const docx = await markdownToDocxBuffer(markdown, report.title, descriptor);
  return {
    content: docx.toString("base64"),
    encoding: "base64",
    fileName,
    format,
    mimeType,
  };
}
