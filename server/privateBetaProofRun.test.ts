import { describe, expect, it } from "vitest";
import type { AgentFinding, AgentOutput, Document } from "../drizzle/schema";
import { isDocumentReadyForAnalysis, withSourceAnchor } from "./extractionReadiness";
import {
  applyRiskBasedQcGate,
  fallbackQcAuditForFinding,
  isReportEligible,
  parseStructuredAgentOutput,
  usageFromResponse,
  verifyFindingQuotes,
  type StructuredFinding,
} from "./leverageEngine";
import { buildPlainReport, reportPreflightError } from "./reportGenerator";
import { buildReportExportArtifact, type StoredReportForExport } from "./reportExport";

const now = new Date("2026-06-29T12:00:00.000Z");
const sourceHash = "d".repeat(64);

const proofDocument = {
  id: 7101,
  userId: 17,
  fileName: "messy-proof-run-motion.pdf",
  fileUrl: "memory://messy-proof-run-motion.pdf",
  fileKey: "proof/messy-proof-run-motion.pdf",
  mimeType: "application/pdf",
  fileSize: 8192,
  documentHash: sourceHash,
  extractionMethod: "test_fixture",
  extractionNote: "Private beta proof-run fixture.",
  extractionTextLength: 620,
  extractionQualityScore: 97,
  extractionWarnings: JSON.stringify([]),
  extractedText: withSourceAnchor(
    [
      "The court has not ruled on the pending motion for discovery sanctions.",
      "The filing asks for the tracker warrant, application, return, and installation log.",
      "The docket shows no written findings explaining the delay.",
    ].join("\n"),
    sourceHash
  ),
  embedding: null,
  status: "completed",
  summary: "Fixture motion with pending ruling and tracker-warrant demands.",
  createdAt: now,
  updatedAt: now,
} satisfies Document;

const failedOcrDocument = {
  ...proofDocument,
  id: 7102,
  fileName: "blank-scan.pdf",
  documentHash: null,
  extractionTextLength: 0,
  extractionQualityScore: 0,
  extractionWarnings: JSON.stringify(["empty_extracted_text"]),
  extractedText: "",
  status: "failed",
  summary: null,
} satisfies Document;

const legacyOutput = {
  id: 7201,
  documentId: proofDocument.id,
  agentId: "legacy_brainstorm",
  agentName: "Legacy Brainstorm",
  output: "UNSUPPORTED ACCUSATION: everyone conspired without source support.",
  jesterMemeCaption: null,
  jesterTiktokScript: null,
  jesterQuote: null,
  clerkViolations: null,
  clerkCaseLaw: null,
  clerkMotionDraft: null,
  hobotProductName: null,
  hobotDescription: null,
  hobotLink: null,
  createdAt: now,
  updatedAt: now,
} satisfies AgentOutput;

function toAgentFinding(
  finding: StructuredFinding,
  overrides: Partial<AgentFinding> = {}
): AgentFinding {
  const id = overrides.id ?? 7300;
  return {
    id,
    runId: 7401,
    outputId: legacyOutput.id,
    userId: proofDocument.userId,
    agentId: "private_beta_proof_agent",
    agentName: "Private Beta Proof Agent",
    title: finding.title,
    findingType: finding.findingType,
    liabilityVector: finding.liabilityVector,
    remedyPath: finding.remedyPath,
    severity: finding.severity,
    confidence: finding.confidence,
    leverageScore: finding.leverageScore,
    summary: finding.summary,
    sourceAnchors: JSON.stringify(finding.sourceAnchors),
    missingRecords: JSON.stringify(finding.missingRecords),
    legalAuthorities: JSON.stringify(finding.legalAuthorities),
    nextAction: finding.nextAction,
    qcStatus: finding.qcStatus ?? "not_required",
    qcReason: finding.qcReason ?? null,
    includedInReports: isReportEligible(finding.qcStatus) ? 1 : 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("private beta proof run gate", () => {
  it("proves the source-ready finding -> QC -> report -> export contract", async () => {
    expect(isDocumentReadyForAnalysis(proofDocument)).toBe(true);
    expect(isDocumentReadyForAnalysis(failedOcrDocument)).toBe(false);

    const parsed = parseStructuredAgentOutput(
      { id: "private_beta_proof_agent", name: "Private Beta Proof Agent" },
      JSON.stringify({
        summary: "Private beta proof-run structured output.",
        findings: [
          {
            title: "Pending ruling creates a narrow writ question",
            findingType: "record_supported",
            liabilityVector: "Mandamus / due process",
            remedyPath: "mandamus",
            severity: "high",
            confidence: 98,
            leverageScore: 87,
            summary:
              "The record supports asking whether a narrow writ should compel a ruling or written findings.",
            sourceAnchors: [
              {
                documentId: proofDocument.id,
                fileName: proofDocument.fileName,
                quote: "The court has not ruled on the pending motion for discovery sanctions.",
              },
            ],
            missingRecords: ["minute order", "hearing transcript", "written findings"],
            legalAuthorities: ["NRS 34.160", "NRS 34.170"],
            nextAction:
              "DEMAND_RECORDS_FIRST: confirm docket status and missing written findings before filing.",
          },
          {
            title: "Unsupported conspiracy claim should be blocked",
            findingType: "record_supported",
            liabilityVector: "Conspiracy",
            remedyPath: "damages",
            severity: "critical",
            confidence: 99,
            leverageScore: 92,
            summary:
              "This intentionally overclaims beyond the fixture record and should not survive QC.",
            sourceAnchors: [
              {
                documentId: proofDocument.id,
                fileName: proofDocument.fileName,
                quote: "every official secretly agreed to fabricate the case",
              },
            ],
            missingRecords: [],
            legalAuthorities: [],
            nextAction: "Do not include unless actual source proof exists.",
          },
        ],
      }),
      [proofDocument]
    );

    expect(parsed.findings).toHaveLength(2);

    const verifiedFindings = parsed.findings.map(finding =>
      applyRiskBasedQcGate(verifyFindingQuotes(finding, [proofDocument]))
    );
    const supported = verifiedFindings[0];
    const unsupported = verifiedFindings[1];

    expect(supported.sourceAnchors[0].support ?? "").not.toContain(
      "Quote not found"
    );
    expect(unsupported.sourceAnchors[0].support).toContain(
      "Quote not found verbatim"
    );

    const approvedFinding = toAgentFinding(
      {
        ...supported,
        qcStatus: "approved",
        qcReason: "Fixture source quote matched extracted text.",
      },
      { id: 7301, includedInReports: 1 }
    );
    const blockedAudit = fallbackQcAuditForFinding(unsupported);
    const blockedFinding = toAgentFinding(
      {
        ...unsupported,
        qcStatus: blockedAudit.status,
        qcReason: blockedAudit.issues.join("; "),
      },
      { id: 7302, includedInReports: 0 }
    );

    expect(isReportEligible(approvedFinding.qcStatus)).toBe(true);
    expect(isReportEligible(blockedFinding.qcStatus)).toBe(false);
    expect(reportPreflightError({
      findings: [approvedFinding],
      legacyAgentOutputsIncluded: false,
    })).toBeNull();

    const reportFindings = [approvedFinding, blockedFinding].filter(
      finding => finding.includedInReports && isReportEligible(finding.qcStatus)
    );
    const markdown = buildPlainReport({
      title: "Private Beta Proof Packet",
      generatedAt: now.toISOString(),
      generatedBy: "Private Beta Test",
      scope: "files",
      template: "mandamus_writ",
      documents: [proofDocument],
      outputs: [legacyOutput],
      legacyAgentOutputsIncluded: false,
      legacyAgentOutputsAvailable: 1,
      findings: reportFindings,
      executiveSummary:
        "The fixture proves that supported findings can become report-ready while unsupported claims are excluded.",
    });

    expect(markdown).toContain("Private Beta Proof Packet");
    expect(markdown).toContain("Pending ruling creates a narrow writ question");
    expect(markdown).toContain("Mandamus / Extraordinary Writ Viability");
    expect(markdown).toContain("minute order");
    expect(markdown).toContain("Source Appendix");
    expect(markdown).not.toContain("Unsupported conspiracy claim should be blocked");
    expect(markdown).not.toContain("UNSUPPORTED ACCUSATION");

    const storedReport: StoredReportForExport = {
      id: 7601,
      userId: proofDocument.userId,
      title: "Private Beta Proof Packet",
      fileName: "private-beta-proof-packet.md",
      format: "markdown",
      content: markdown,
      metadata: JSON.stringify({
        markdown,
        metadata: {
          title: "Private Beta Proof Packet",
          generatedAt: now.toISOString(),
          generatedBy: "Private Beta Test",
          scope: "files",
          template: "mandamus_writ",
        },
        documents: [
          {
            fileName: proofDocument.fileName,
            status: proofDocument.status,
            analysisReady: true,
            documentHash: proofDocument.documentHash,
            extractionQualityScore: proofDocument.extractionQualityScore,
          },
        ],
        findings: reportFindings.map(finding => ({
          title: finding.title,
          confidence: finding.confidence,
          leverageScore: finding.leverageScore,
          qcStatus: finding.qcStatus,
          includedInReports: Boolean(finding.includedInReports),
        })),
        statistics: {
          documents: 1,
          readyDocuments: 1,
          structuredFindings: reportFindings.length,
        },
      }),
      documentIds: JSON.stringify([proofDocument.id]),
      selectedFindingIds: JSON.stringify(reportFindings.map(finding => finding.id)),
      minConfidence: 0,
      includeBlockedFindings: 0,
      includeLegacyAgentOutputs: 0,
      createdAt: now,
      updatedAt: now,
    };

    const jsonExport = await buildReportExportArtifact(storedReport, "json");
    const pdfExport = await buildReportExportArtifact(storedReport, "pdf");
    const docxExport = await buildReportExportArtifact(storedReport, "docx");

    expect(JSON.parse(jsonExport.content).exportQuality.sourceControlIncluded).toBe(
      true
    );
    expect(Buffer.from(pdfExport.content, "base64").subarray(0, 4).toString()).toBe(
      "%PDF"
    );
    expect(Buffer.from(docxExport.content, "base64").subarray(0, 2).toString()).toBe(
      "PK"
    );

    const usage = usageFromResponse({
      id: "proof-run-response",
      created: Math.floor(now.getTime() / 1000),
      model: "proof-fixture-model",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: parsed.summary },
          finish_reason: "stop",
        },
      ],
      usage: {
        prompt_tokens: 1200,
        completion_tokens: 300,
        total_tokens: 1500,
      },
    });

    expect(usage.totalTokens).toBe(1500);
    expect(usage.estimatedCostCents).toBeGreaterThan(0);
  });
});
