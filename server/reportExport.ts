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
  | { kind: "code"; text: string };

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

type ReportDescriptor = {
  title: string;
  generatedAt: string | null;
  generatedBy: string | null;
  scope: string | null;
  template: string | null;
  documents: ReportDocumentSummary[];
  findings: ReportFindingSummary[];
  statistics: Record<string, unknown>;
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
  panel: "#f8fafc",
  caution: "#fef3c7",
  cautionText: "#78350f",
  accent: "#b7791f",
  accentDark: "#7c4a03",
  green: "#047857",
  red: "#b91c1c",
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
    .replace(/[_~]/g, "")
    .trim();
}

function cleanInlineMarkdown(value: string): string {
  return decodeBasicHtmlEntities(value)
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/[_~]/g, "");
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

function parseMarkdownBlocks(markdown: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  const paragraphLines: string[] = [];
  let inCode = false;
  let codeLines: string[] = [];

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

  for (const rawLine of markdown.replace(/\r\n/g, "\n").split("\n")) {
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
    ["Generated", descriptor.generatedAt ?? "not recorded"],
    ["Generated by", descriptor.generatedBy ?? "DueProcess AI user"],
    ["Sources", `${readyDocuments}/${documentCount} analysis-ready`],
    [
      "Findings",
      `${findingCount} structured finding${findingCount === 1 ? "" : "s"}`,
    ],
  ];
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
    .notice { margin-top: 18px; border: 1px solid #f59e0b; background: #fffbeb; color: #78350f; padding: 12px 14px; font-size: 13px; }
    .toc, .sources { padding: 20px 42px; border-bottom: 1px solid var(--line); }
    .toc a { color: var(--ink); text-decoration: none; }
    .body { padding: 10px 42px 42px; }
    .source-list { display: grid; gap: 8px; }
    .source-item { border: 1px solid var(--line); background: #fff; padding: 9px 11px; font-size: 12px; }
    .source-item strong { display: block; font-size: 13px; }
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
    ${
      sourcePreview.length > 0
        ? `<section class="sources"><div class="kicker">Source Control</div><div class="source-list">${sourcePreview
            .map(
              document =>
                `<div class="source-item"><strong>${escapeHtml(document.fileName)}</strong>${escapeHtml(document.status)} - ${document.analysisReady ? "analysis-ready" : "not analysis-ready"} - OCR ${document.extractionQualityScore ?? "n/a"}/100<br />SHA: ${escapeHtml(document.documentHash ?? "missing")}</div>`
            )
            .join("")}</div>${
            descriptor.documents.length > sourcePreview.length
              ? `<p>${descriptor.documents.length - sourcePreview.length} additional source(s) listed in the report body.</p>`
              : ""
          }</section>`
        : ""
    }
    <section class="body">${groupHtmlBlocks(blocks)}</section>
  </main>
</body>
</html>`;
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
      .strokeColor(COLORS.faint)
      .lineWidth(0.5)
      .moveTo(doc.page.margins.left, footerY - 10)
      .lineTo(doc.page.width - doc.page.margins.right, footerY - 10)
      .stroke();
    doc
      .font("Helvetica")
      .fontSize(7.5)
      .fillColor(COLORS.muted)
      .text(
        "DueProcess AI - source-bound report export",
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
    .font(options.font ?? "Helvetica")
    .fontSize(options.size ?? 10)
    .fillColor(options.color ?? COLORS.ink)
    .text(text, {
      indent: options.indent,
      paragraphGap: options.paragraphGap ?? 5,
      lineGap: 2,
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

  descriptorStats(descriptor).forEach(([label, value], index) => {
    const x = startX + (index % 3) * (columnWidth + 12);
    const y = startY + Math.floor(index / 3) * (rowHeight + 10);
    doc
      .roundedRect(x, y, columnWidth, rowHeight, 5)
      .fillAndStroke(COLORS.panel, COLORS.faint);
    doc
      .font("Helvetica-Bold")
      .fontSize(7)
      .fillColor(COLORS.accentDark)
      .text(label.toUpperCase(), x + 10, y + 10, { width: columnWidth - 20 });
    doc
      .font("Helvetica-Bold")
      .fontSize(9.5)
      .fillColor(COLORS.ink)
      .text(value, x + 10, y + 25, { width: columnWidth - 20, lineGap: 1 });
  });

  doc.y = startY + rowHeight * 2 + 22;
}

function writePdfNotice(doc: PDFKit.PDFDocument) {
  const x = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const y = doc.y;
  const text =
    "Export quality gate: this packet is generated from QC-cleared or explicitly overridden findings. Unsupported accusations should appear as gaps, demands, or inferences - not proven facts.";

  doc.roundedRect(x, y, width, 52, 5).fillAndStroke(COLORS.caution, "#f59e0b");
  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor(COLORS.cautionText)
    .text(text, x + 12, y + 12, { width: width - 24, lineGap: 2 });
  doc.y = y + 66;
}

function writePdfSourcePreview(
  doc: PDFKit.PDFDocument,
  descriptor: ReportDescriptor
) {
  if (descriptor.documents.length === 0) return;
  pdfEnsureSpace(doc, 120);
  writePdfText(doc, "Source Control", {
    font: "Helvetica-Bold",
    size: 12,
    color: COLORS.accentDark,
    paragraphGap: 8,
  });

  descriptor.documents.slice(0, 6).forEach(document => {
    pdfEnsureSpace(doc, 42);
    const statusColor = document.analysisReady ? COLORS.green : COLORS.red;
    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor(COLORS.ink)
      .text(document.fileName, { continued: false, paragraphGap: 1 });
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(statusColor)
      .text(
        `${document.status} - ${document.analysisReady ? "analysis-ready" : "not analysis-ready"} - OCR ${document.extractionQualityScore ?? "n/a"}/100`,
        { paragraphGap: 1 }
      );
    doc
      .font("Helvetica")
      .fontSize(7.5)
      .fillColor(COLORS.muted)
      .text(`SHA: ${document.documentHash ?? "missing"}`, { paragraphGap: 5 });
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

async function markdownToPdfBuffer(
  markdown: string,
  title: string,
  descriptor: ReportDescriptor
): Promise<Buffer> {
  const doc = new PDFDocument({
    autoFirstPage: true,
    bufferPages: true,
    margins: { top: 54, bottom: 54, left: 54, right: 54 },
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
  doc.info.Subject = "Source-bound legal intelligence report";

  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor(COLORS.accentDark)
    .text("DUEPROCESS AI - LEGAL INTELLIGENCE EXPORT", {
      characterSpacing: 1.4,
    });
  doc.moveDown(0.45);
  doc
    .font("Helvetica-Bold")
    .fontSize(23)
    .fillColor(COLORS.ink)
    .text(descriptor.title || title, { lineGap: 2, paragraphGap: 8 });
  doc
    .strokeColor(COLORS.accent)
    .lineWidth(2)
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .stroke();
  doc.moveDown(1.3);
  writePdfMetadata(doc, descriptor);
  writePdfNotice(doc);
  writePdfSourcePreview(doc, descriptor);

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
        font: "Helvetica-Bold",
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
        .font("Helvetica-Oblique")
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
              bodyCell(document.documentHash?.slice(0, 18) ?? "missing", 2000),
            ],
          })
      ),
    ],
  });
}

function markdownBlockToDocx(block: MarkdownBlock): Paragraph {
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
          text: descriptor.title || title,
          bold: true,
          color: "111827",
          font: "Arial",
          size: 38,
        }),
      ],
      spacing: { after: 260 },
    }),
    docxMetadataTable(descriptor),
    new Paragraph({ children: [new TextRun("")], spacing: { after: 120 } }),
    docxNotice(),
    new Paragraph({ children: [new TextRun("")], spacing: { after: 160 } }),
    new Paragraph({
      text: "Source Control",
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 160, after: 100 },
    }),
    sourceTable ??
      docxParagraph("No source metadata was attached to this export."),
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
          exportQuality: {
            canonicalMarkdown: true,
            sourceControlIncluded: true,
            qcGateNoticeIncluded: true,
            binaryFormatsGeneratedOnDemand: true,
          },
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
