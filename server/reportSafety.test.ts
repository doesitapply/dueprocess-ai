import { describe, expect, it } from "vitest";
import type { AgentFinding, AgentOutput, Document } from "../drizzle/schema";
import { buildPlainReport, reportPreflightError } from "./reportGenerator";

const now = new Date("2026-06-07T12:00:00.000Z");

const documentRecord = {
  id: 101,
  userId: 1,
  fileName: "tracker-motion.pdf",
  fileUrl: "memory://tracker-motion.pdf",
  fileKey: "test/tracker-motion.pdf",
  mimeType: "application/pdf",
  fileSize: 4096,
  documentHash: "c".repeat(64),
  extractionMethod: "pdf_text",
  extractionNote: null,
  extractionTextLength: 160,
  extractionQualityScore: 98,
  extractionWarnings: JSON.stringify([]),
  extractedText: `SOURCE_SHA256: ${"c".repeat(64)}\n\nThe State represented a tracker issue in the motion record.`,
  embedding: null,
  status: "completed",
  summary: "Tracker motion summary",
  createdAt: now,
  updatedAt: now,
} satisfies Document;

const legacyOutput = {
  id: 201,
  documentId: documentRecord.id,
  agentId: "legacy_agent",
  agentName: "Legacy Brainstorm Agent",
  output: "UNSUPPORTED SECRET CONSPIRACY CLAIM SHOULD NOT LEAK",
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

const approvedFinding = {
  id: 301,
  runId: 401,
  outputId: legacyOutput.id,
  userId: 1,
  agentId: "qc_agent",
  agentName: "QC Agent",
  title: "Tracker warrant materials should be demanded",
  findingType: "missing_record",
  liabilityVector: "Fourth Amendment GPS tracker",
  remedyPath: "discovery",
  severity: "high",
  confidence: 88,
  leverageScore: 90,
  summary: "The report-safe framing is to demand tracker warrant materials, not assert proven misconduct.",
  sourceAnchors: JSON.stringify([{ documentId: documentRecord.id, fileName: documentRecord.fileName, quote: "tracker issue" }]),
  missingRecords: JSON.stringify(["tracker warrant", "application", "return"]),
  legalAuthorities: JSON.stringify(["United States v. Jones"]),
  nextAction: "Demand the warrant packet or a written disclaimer.",
  qcStatus: "downgraded",
  qcReason: "Missing-record demand only.",
  includedInReports: 1,
  createdAt: now,
  updatedAt: now,
} satisfies AgentFinding;

function report(overrides: Partial<Parameters<typeof buildPlainReport>[0]> = {}) {
  return buildPlainReport({
    title: "Safety Report",
    generatedAt: now.toISOString(),
    generatedBy: "Test User",
    scope: "files",
    template: "court_packet",
    documents: [documentRecord],
    outputs: [legacyOutput],
    legacyAgentOutputsIncluded: false,
    legacyAgentOutputsAvailable: 1,
    findings: [approvedFinding],
    executiveSummary: "Use QC-cleared material.",
    ...overrides,
  });
}

describe("report safety", () => {
  it("excludes legacy/freeform agent output from default reports", () => {
    const content = report();

    expect(content).toContain("Legacy / Freeform Agent Outputs");
    expect(content).toContain("excluded from this report");
    expect(content).toContain("Default reports use QC-cleared structured findings only");
    expect(content).toContain("Tracker warrant materials should be demanded");
    expect(content).not.toContain("UNSUPPORTED SECRET CONSPIRACY CLAIM SHOULD NOT LEAK");
  });

  it("includes legacy/freeform output only when explicitly requested", () => {
    const content = report({ legacyAgentOutputsIncluded: true });

    expect(content).toContain("Legacy Brainstorm Agent");
    expect(content).toContain("UNSUPPORTED SECRET CONSPIRACY CLAIM SHOULD NOT LEAK");
  });

  it("blocks default generation when no report-ready findings match", () => {
    const error = reportPreflightError({
      findings: [],
      legacyAgentOutputsIncluded: false,
      selectedFindingIds: [999],
      minConfidence: 95,
    });

    expect(error).toContain("No report-ready structured findings");
    expect(error).toContain("selected finding filter");
    expect(error).toContain("minimum confidence filter is 95");
  });

  it("allows an explicit admin legacy-output override to pass preflight", () => {
    expect(reportPreflightError({
      findings: [],
      legacyAgentOutputsIncluded: true,
    })).toBeNull();
  });
});
