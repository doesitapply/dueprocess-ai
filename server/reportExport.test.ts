import { describe, expect, it } from "vitest";
import {
  buildReportExportArtifact,
  markdownFromStoredReport,
  markdownToReportHtml,
  type StoredReportForExport,
} from "./reportExport";

const sampleReport: StoredReportForExport = {
  title: "Sample Court Packet",
  fileName: "sample-court-packet.md",
  format: "markdown",
  content: [
    "# Sample Court Packet",
    "",
    "## Strongest Record Facts",
    "This is source-bound text.",
    "",
    "> Exact quote support belongs here.",
    "",
    "### Source Appendix",
    "- File A.pdf: quoted support",
  ].join("\n"),
  metadata: JSON.stringify({
    metadata: {
      title: "Sample Court Packet",
      generatedAt: "2026-06-29T12:00:00.000Z",
      generatedBy: "Test User",
      scope: "files",
      template: "court_packet",
    },
    documents: [
      {
        fileName: "File A.pdf",
        status: "completed",
        analysisReady: true,
        documentHash: "a".repeat(64),
        extractionQualityScore: 97,
      },
    ],
    findings: [
      {
        title: "Finding A",
        confidence: 96,
        leverageScore: 91,
        qcStatus: "approved",
        includedInReports: true,
      },
    ],
    statistics: { documents: 1, readyDocuments: 1, structuredFindings: 1 },
  }),
};

describe("report export", () => {
  it("uses canonical markdown from metadata when available", () => {
    const report: StoredReportForExport = {
      ...sampleReport,
      format: "html",
      content: "<h1>Rendered</h1>",
      metadata: JSON.stringify({ markdown: "# Canonical\n\nBody" }),
    };

    expect(markdownFromStoredReport(report)).toContain("# Canonical");
  });

  it("renders print-ready HTML from markdown", () => {
    const html = markdownToReportHtml(
      sampleReport.content,
      sampleReport.title,
      JSON.parse(sampleReport.metadata ?? "{}")
    );

    expect(html).toContain("<h1>Sample Court Packet</h1>");
    expect(html).toContain(">Strongest Record Facts</h2>");
    expect(html).toContain("Export quality gate");
    expect(html).toContain("Source Control");
    expect(html).toContain("File A.pdf");
  });

  it("exports JSON with canonical markdown and export quality metadata", async () => {
    const artifact = await buildReportExportArtifact(sampleReport, "json");
    const parsed = JSON.parse(artifact.content) as {
      exportQuality?: { sourceControlIncluded?: boolean };
      markdown?: string;
    };

    expect(artifact.encoding).toBe("utf8");
    expect(parsed.markdown).toContain("Exact quote support");
    expect(parsed.exportQuality?.sourceControlIncluded).toBe(true);
  });

  it("exports PDF as base64 PDF bytes", async () => {
    const artifact = await buildReportExportArtifact(sampleReport, "pdf");
    const bytes = Buffer.from(artifact.content, "base64");

    expect(artifact.encoding).toBe("base64");
    expect(artifact.mimeType).toBe("application/pdf");
    expect(bytes.subarray(0, 4).toString("utf8")).toBe("%PDF");
    expect(bytes.length).toBeGreaterThan(2500);
  });

  it("exports DOCX as base64 zip bytes", async () => {
    const artifact = await buildReportExportArtifact(sampleReport, "docx");
    const bytes = Buffer.from(artifact.content, "base64");

    expect(artifact.encoding).toBe("base64");
    expect(artifact.mimeType).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    expect(bytes.subarray(0, 2).toString("utf8")).toBe("PK");
    expect(bytes.length).toBeGreaterThan(5000);
  });
});
