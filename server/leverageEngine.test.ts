import { describe, expect, it } from "vitest";
import type { Document } from "../drizzle/schema";
import {
  applyRiskBasedQcGate,
  fallbackQcAuditForFinding,
  isReportEligible,
  normalizeQcAuditForReportUse,
  parseStructuredAgentOutput,
  verifyFindingQuotes,
  type StructuredFinding,
} from "./leverageEngine";

const document = {
  id: 7,
  userId: 1,
  fileName: "tracker-motion.pdf",
  fileUrl: "s3://test",
  fileKey: "test",
  mimeType: "application/pdf",
  fileSize: 1000,
  documentHash: "b".repeat(64),
  extractionMethod: "test_fixture",
  extractionNote: null,
  extractionTextLength: 74,
  extractionQualityScore: 100,
  extractionWarnings: JSON.stringify([]),
  extractedText: "The State represented that a GPS tracker was installed on the vehicle.",
  embedding: null,
  status: "completed",
  summary: null,
  createdAt: new Date(),
  updatedAt: new Date(),
} satisfies Document;

function finding(overrides: Partial<StructuredFinding> = {}): StructuredFinding {
  return {
    title: "GPS tracker proof gap",
    findingType: "record_supported",
    liabilityVector: "Fourth Amendment GPS tracker",
    remedyPath: "discovery",
    severity: "high",
    confidence: 96,
    leverageScore: 88,
    summary: "The record supports demanding tracker warrant materials.",
    sourceAnchors: [{ documentId: document.id, fileName: document.fileName, quote: "GPS tracker was installed" }],
    missingRecords: ["warrant", "application", "return"],
    legalAuthorities: ["United States v. Jones"],
    nextAction: "Demand production or disclaimer.",
    ...overrides,
  };
}

describe("leverageEngine guardrails", () => {
  it("parses structured findings from agent JSON", () => {
    const output = parseStructuredAgentOutput(
      { id: "monell_pattern_mapper", name: "Monell Pattern Mapper" },
      JSON.stringify({
        summary: "One finding",
        findings: [finding()],
      }),
      [document]
    );

    expect(output.findings).toHaveLength(1);
    expect(output.findings[0].sourceAnchors[0].fileName).toBe("tracker-motion.pdf");
  });

  it("downgrades unmatched quotes and requires QC", () => {
    const verified = verifyFindingQuotes(
      finding({ sourceAnchors: [{ documentId: document.id, fileName: document.fileName, quote: "a helicopter followed him" }] }),
      [document]
    );

    expect(verified.confidence).toBeLessThan(95);
    expect(verified.qcStatus).toBe("pending");
  });

  it("requires QC for high-risk findings even above the threshold", () => {
    const gated = applyRiskBasedQcGate(finding({ confidence: 99, liabilityVector: "Monell municipal liability" }));

    expect(gated.qcStatus).toBe("pending");
    expect(gated.qcReason).toContain("high-risk");
  });

  it("requires QC for v2 skeptical inference labels", () => {
    const gated = applyRiskBasedQcGate(finding({ confidence: 99, findingType: "suspicious_absence" }));

    expect(gated.qcStatus).toBe("pending");
  });

  it("excludes blocked and needs-more-proof findings from reports", () => {
    expect(isReportEligible("approved")).toBe(true);
    expect(isReportEligible("downgraded")).toBe(true);
    expect(isReportEligible("blocked")).toBe(false);
    expect(isReportEligible("needs_more_proof")).toBe(false);
  });

  it("converts missing-record QC needs into report-safe downgraded demands", () => {
    const normalized = normalizeQcAuditForReportUse(
      finding({ findingType: "missing_critical", confidence: 81, sourceAnchors: [] }),
      { status: "needs_more_proof", confidence: 72, issues: ["needs source"] }
    );

    expect(normalized.status).toBe("downgraded");
    expect(normalized.correctedSummary).toContain("missing-record demand");
  });

  it("fallback QC blocks record-supported claims with no anchors", () => {
    const audit = fallbackQcAuditForFinding(finding({ sourceAnchors: [] }), new Error("auditor unavailable"));

    expect(audit.status).toBe("blocked");
  });
});
