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
    "### Source Appendix",
    "- File A.pdf: quoted support",
  ].join("\n"),
  metadata: JSON.stringify({ statistics: { documents: 1, structuredFindings: 2 } }),
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
    const html = markdownToReportHtml(sampleReport.content, sampleReport.title);

    expect(html).toContain("<h1>Sample Court Packet</h1>");
    expect(html).toContain("<h2>Strongest Record Facts</h2>");
  });

  it("exports PDF as base64 PDF bytes", async () => {
    const artifact = await buildReportExportArtifact(sampleReport, "pdf");
    const bytes = Buffer.from(artifact.content, "base64");

    expect(artifact.encoding).toBe("base64");
    expect(artifact.mimeType).toBe("application/pdf");
    expect(bytes.subarray(0, 4).toString("utf8")).toBe("%PDF");
  });

  it("exports DOCX as base64 zip bytes", async () => {
    const artifact = await buildReportExportArtifact(sampleReport, "docx");
    const bytes = Buffer.from(artifact.content, "base64");

    expect(artifact.encoding).toBe("base64");
    expect(artifact.mimeType).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    expect(bytes.subarray(0, 2).toString("utf8")).toBe("PK");
  });
});
