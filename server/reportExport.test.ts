import { describe, expect, it } from "vitest";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
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
    "## Mandamus Element Matrix",
    "| Element | Status | What the packet must prove next |",
    "| --- | --- | --- |",
    "| Clear legal duty / right | READY TO ARGUE | Verify the exact legal duty. |",
    "| Appendix / source proof | PARTIAL | Demand the missing transcript before filing. |",
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
      marketProofPack: {
        buyerLane: "Civil-rights firm pilot",
        useCase: "Closed-matter discovery review",
        sellableArtifact: "Source-bound leverage memo",
        firstCloseMotion: "Run one low-risk matter and compare review time.",
        deliveryReadiness: "human_review_required",
        proofIncluded: ["1/1 source ready", "1 finding selected"],
        blockers: ["Authority still needs human verification."],
      },
      filingMetadata: {
        courtName: "Supreme Court of Nevada",
        caseNumber: "CR23-0657",
        petitioner: "Cameron Church",
        respondent: "State of Nevada",
        filingTitle: "Petition for Writ of Mandamus",
        filingSubtitle: "Source-bound appendix and narrow command review",
        preparedFor: "Cameron Church",
      },
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
    expect(html).toContain("Supreme Court of Nevada");
    expect(html).toContain("CR23-0657");
    expect(html).toContain("Cameron Church v. State of Nevada");
    expect(html).toContain("Petition for Writ of Mandamus");
    expect(html).toContain(">Strongest Record Facts</h2>");
    expect(html).toContain("Export quality gate");
    expect(html).toContain("Reliability Certificate");
    expect(html).toContain("Court Paper Control Sheet");
    expect(html).toContain("Pleading-paper PDF");
    expect(html).toContain("DOCX filing packet");
    expect(html).toContain("Court Filing Readiness");
    expect(html).toContain("Caption / parties");
    expect(html).toContain("Authority verification");
    expect(html).toContain("Service / deadlines / local rules");
    expect(html).toContain("Source Control");
    expect(html).toContain("File A.pdf");
    expect(html).toContain("Finding Ledger");
    expect(html).toContain("Finding A");
    expect(html).toContain('class="markdown-table"');
    expect(html).toContain("<th>Element</th>");
    expect(html).toContain("<td>Clear legal duty / right</td>");
    expect(html).toContain("<td>Appendix / source proof</td>");
  });

  it("exports JSON with canonical markdown and export quality metadata", async () => {
    const artifact = await buildReportExportArtifact(sampleReport, "json");
    const parsed = JSON.parse(artifact.content) as {
      exportQuality?: {
        sourceControlIncluded?: boolean;
        reliabilityCertificateIncluded?: boolean;
        findingLedgerIncluded?: boolean;
        courtReadinessSheetIncluded?: boolean;
        filingCaptionIncluded?: boolean;
        humanReviewRequired?: boolean;
        availableFormats?: string[];
        pageFormat?: {
          size?: string;
          pdfMargins?: string;
          lineNumberCount?: number;
          lineNumberRestart?: string;
          pleadingRules?: string[];
        };
        includedSections?: string[];
        pdfControls?: string[];
        docxControls?: string[];
        filingBlockers?: Array<{
          label: string;
          status: string;
          detail: string;
        }>;
        courtPaperControl?: Array<{
          label: string;
          status: string;
          detail: string;
        }>;
        courtUseChecklist?: Array<{ label: string; detail: string }>;
        courtFilingReadiness?: Array<{
          label: string;
          status: string;
          detail: string;
        }>;
      };
      metadata?: {
        metadata?: {
          marketProofPack?: {
            buyerLane?: string;
            sellableArtifact?: string;
            deliveryReadiness?: string;
          };
        };
      };
      markdown?: string;
    };

    expect(artifact.encoding).toBe("utf8");
    expect(parsed.markdown).toContain("Exact quote support");
    expect(parsed.markdown).toContain("Mandamus Element Matrix");
    expect(parsed.exportQuality?.sourceControlIncluded).toBe(true);
    expect(parsed.exportQuality?.reliabilityCertificateIncluded).toBe(true);
    expect(parsed.exportQuality?.findingLedgerIncluded).toBe(true);
    expect(parsed.exportQuality?.courtReadinessSheetIncluded).toBe(true);
    expect(parsed.exportQuality?.filingCaptionIncluded).toBe(true);
    expect(parsed.exportQuality?.humanReviewRequired).toBe(true);
    expect(parsed.exportQuality?.availableFormats).toEqual([
      "markdown",
      "html",
      "json",
      "pdf",
      "docx",
    ]);
    expect(parsed.exportQuality?.pageFormat?.size).toBe("LETTER");
    expect(parsed.exportQuality?.pageFormat?.lineNumberCount).toBe(28);
    expect(parsed.exportQuality?.pageFormat?.lineNumberRestart).toBe(
      "each page"
    );
    expect(parsed.exportQuality?.pageFormat?.pleadingRules).toContain(
      "left-side line numbers 1-28"
    );
    expect(parsed.exportQuality?.includedSections).toContain(
      "court filing readiness sheet"
    );
    expect(parsed.exportQuality?.pdfControls).toContain(
      "28 pleading line numbers per page"
    );
    expect(parsed.exportQuality?.docxControls).toContain(
      "court filing readiness table"
    );
    expect(
      parsed.exportQuality?.filingBlockers?.some(
        item => item.label === "Authority verification"
      )
    ).toBe(true);
    expect(
      parsed.exportQuality?.courtPaperControl?.some(
        item => item.label === "Pleading-paper PDF" && item.status === "READY"
      )
    ).toBe(true);
    expect(
      parsed.exportQuality?.courtPaperControl?.some(
        item => item.label === "Finding ledger" && item.status === "READY"
      )
    ).toBe(true);
    expect(parsed.exportQuality?.courtUseChecklist?.length).toBeGreaterThan(0);
    expect(parsed.exportQuality?.courtFilingReadiness?.length).toBeGreaterThan(
      0
    );
    expect(
      parsed.exportQuality?.courtFilingReadiness?.some(
        item => item.label === "Caption / parties" && item.status === "READY"
      )
    ).toBe(true);
    expect(parsed.metadata?.metadata?.marketProofPack?.buyerLane).toBe(
      "Civil-rights firm pilot"
    );
    expect(parsed.metadata?.metadata?.marketProofPack?.sellableArtifact).toBe(
      "Source-bound leverage memo"
    );
    expect(parsed.metadata?.metadata?.marketProofPack?.deliveryReadiness).toBe(
      "human_review_required"
    );
  });

  it("exports PDF as base64 PDF bytes", async () => {
    const artifact = await buildReportExportArtifact(sampleReport, "pdf");
    const bytes = Buffer.from(artifact.content, "base64");

    expect(artifact.encoding).toBe("base64");
    expect(artifact.mimeType).toBe("application/pdf");
    expect(bytes.subarray(0, 4).toString("utf8")).toBe("%PDF");
    expect(bytes.length).toBeGreaterThan(2500);
  });

  it("renders court filing controls into extractable PDF text", async () => {
    const artifact = await buildReportExportArtifact(sampleReport, "pdf");
    const bytes = Buffer.from(artifact.content, "base64");
    const parser = new PDFParse({ data: bytes });

    try {
      const result = await parser.getText();
      const text = result.text;

      expect(text).toContain("Cameron Church v. State of Nevada");
      expect(text).toContain("Supreme Court of Nevada");
      expect(text).toContain("Case No. CR23-0657");
      expect(text).toContain("PETITION FOR WRIT OF MANDAMUS");
      expect(text).toContain("Export quality gate");
      expect(text).toContain("Reliability Certificate");
      expect(text).toContain("Court Paper Control Sheet");
      expect(text).toContain("PLEADING-PAPER PDF");
      expect(text).toContain("Court Filing Readiness");
      expect(text).toContain("Source Control");
      expect(text).toContain("File A.pdf");
      expect(text).toContain("Finding Ledger");
      expect(text).toContain("Finding A");
      expect(text).toContain("Exact quote support belongs here.");
      expect(text).toContain("DueProcess AI - source-bound legal work product");
      expect(text).toMatch(/\n28\n/);
    } finally {
      await parser.destroy();
    }
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

  it("renders court filing controls into DOCX text", async () => {
    const artifact = await buildReportExportArtifact(sampleReport, "docx");
    const bytes = Buffer.from(artifact.content, "base64");
    const result = await mammoth.extractRawText({ buffer: bytes });
    const text = result.value;

    expect(text).toContain("DUEPROCESS AI - LEGAL INTELLIGENCE EXPORT");
    expect(text).toContain("Petition for Writ of Mandamus");
    expect(text).toContain("Cameron Church v. State of Nevada");
    expect(text).toContain("Supreme Court of Nevada");
    expect(text).toContain("Case No. CR23-0657");
    expect(text).toContain("Export quality gate");
    expect(text).toContain("Reliability Certificate");
    expect(text).toContain("Court Paper Control Sheet");
    expect(text).toContain("Court Filing Readiness");
    expect(text).toContain("Source Control");
    expect(text).toContain("File A.pdf");
    expect(text).toContain("Finding Ledger");
    expect(text).toContain("Finding A");
    expect(text).toContain("Exact quote support belongs here.");
  });
});
