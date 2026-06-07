import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import PDFDocument from "pdfkit";
import { z } from "zod";

export const reportExportFormatSchema = z.enum(["markdown", "html", "json", "pdf", "docx"]);

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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function decodeBasicHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
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
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

export function markdownFromStoredReport(report: StoredReportForExport): string {
  const metadata = parseMetadata(report.metadata);
  if (typeof metadata.markdown === "string" && metadata.markdown.trim().length > 0) {
    return metadata.markdown;
  }

  if (report.format === "markdown") {
    return report.content;
  }

  if (report.format === "json") {
    try {
      const parsed = JSON.parse(report.content) as Record<string, unknown>;
      if (typeof parsed.markdown === "string" && parsed.markdown.trim().length > 0) {
        return parsed.markdown;
      }
      if (typeof parsed.executiveSummary === "string") {
        return `# ${report.title}\n\n${parsed.executiveSummary}`;
      }
      return `# ${report.title}\n\n\`\`\`json\n${JSON.stringify(parsed, null, 2)}\n\`\`\``;
    } catch {
      return `# ${report.title}\n\n${report.content}`;
    }
  }

  if (report.format === "html") {
    return stripHtmlToText(report.content)
      .split("\n")
      .map((line, index) => index === 0 && !line.startsWith("#") ? `# ${line}` : line)
      .join("\n");
  }

  return report.content;
}

export function markdownToReportHtml(markdown: string, title: string): string {
  const body = escapeHtml(markdown)
    .replace(/^# (.*)$/gm, "<h1>$1</h1>")
    .replace(/^## (.*)$/gm, "<h2>$1</h2>")
    .replace(/^### (.*)$/gm, "<h3>$1</h3>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br />");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 920px; margin: 40px auto; line-height: 1.55; color: #111827; }
    h1, h2, h3 { color: #0f172a; }
    h1 { border-bottom: 2px solid #2563eb; padding-bottom: 12px; }
    @media print { body { margin: 24px; } }
  </style>
</head>
<body>${body}</body>
</html>`;
}

function fileNameForExport(report: StoredReportForExport, format: ReportExportFormat): string {
  const sourceName = report.fileName || report.title || "dueprocess-report";
  const baseName = sourceName.replace(/\.[a-z0-9]+$/i, "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "dueprocess-report";
  return `${baseName}.${EXPORT_EXTENSIONS[format]}`;
}

function pdfTextLines(markdown: string): string[] {
  return markdown
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd());
}

async function markdownToPdfBuffer(markdown: string, title: string): Promise<Buffer> {
  const doc = new PDFDocument({
    autoFirstPage: true,
    margins: { top: 54, bottom: 54, left: 54, right: 54 },
    size: "LETTER",
  });
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  doc.info.Title = title;
  doc.font("Helvetica");

  for (const rawLine of pdfTextLines(markdown)) {
    const line = rawLine.trim();
    if (!line) {
      doc.moveDown(0.45);
      continue;
    }
    if (line.startsWith("# ")) {
      doc.moveDown(0.4).font("Helvetica-Bold").fontSize(18).text(line.slice(2), { paragraphGap: 8 }).font("Helvetica").fontSize(10.5);
      continue;
    }
    if (line.startsWith("## ")) {
      doc.moveDown(0.55).font("Helvetica-Bold").fontSize(14).text(line.slice(3), { paragraphGap: 6 }).font("Helvetica").fontSize(10.5);
      continue;
    }
    if (line.startsWith("### ")) {
      doc.moveDown(0.35).font("Helvetica-Bold").fontSize(11.5).text(line.slice(4), { paragraphGap: 4 }).font("Helvetica").fontSize(10.5);
      continue;
    }
    doc.font("Helvetica").fontSize(10.5).text(line.replace(/\*\*/g, ""), { paragraphGap: 3 });
  }

  doc.end();
  return done;
}

function markdownToDocxParagraphs(markdown: string): Paragraph[] {
  return markdown
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((rawLine) => rawLine.trimEnd())
    .map((line) => {
      if (!line.trim()) {
        return new Paragraph({ children: [new TextRun("")] });
      }
      if (line.startsWith("# ")) {
        return new Paragraph({ text: line.slice(2), heading: HeadingLevel.HEADING_1 });
      }
      if (line.startsWith("## ")) {
        return new Paragraph({ text: line.slice(3), heading: HeadingLevel.HEADING_2 });
      }
      if (line.startsWith("### ")) {
        return new Paragraph({ text: line.slice(4), heading: HeadingLevel.HEADING_3 });
      }
      if (line.startsWith("- ")) {
        return new Paragraph({
          bullet: { level: 0 },
          children: [new TextRun(line.slice(2).replace(/\*\*/g, ""))],
        });
      }
      return new Paragraph({
        children: [new TextRun(line.replace(/\*\*/g, ""))],
      });
    });
}

async function markdownToDocxBuffer(markdown: string, title: string): Promise<Buffer> {
  const document = new Document({
    creator: "DueProcess AI",
    description: "DueProcess AI exported report",
    title,
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 720,
              right: 720,
              bottom: 720,
              left: 720,
            },
          },
        },
        children: markdownToDocxParagraphs(markdown),
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

  if (format === "markdown") {
    return { content: markdown, encoding: "utf8", fileName, format, mimeType };
  }

  if (format === "html") {
    return {
      content: markdownToReportHtml(markdown, report.title),
      encoding: "utf8",
      fileName,
      format,
      mimeType,
    };
  }

  if (format === "json") {
    return {
      content: JSON.stringify({
        title: report.title,
        exportedAt: new Date().toISOString(),
        sourceFormat: report.format,
        markdown,
        metadata: parseMetadata(report.metadata),
      }, null, 2),
      encoding: "utf8",
      fileName,
      format,
      mimeType,
    };
  }

  if (format === "pdf") {
    const pdf = await markdownToPdfBuffer(markdown, report.title);
    return { content: pdf.toString("base64"), encoding: "base64", fileName, format, mimeType };
  }

  const docx = await markdownToDocxBuffer(markdown, report.title);
  return { content: docx.toString("base64"), encoding: "base64", fileName, format, mimeType };
}
