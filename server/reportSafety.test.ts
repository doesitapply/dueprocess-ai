import { describe, expect, it } from "vitest";
import type { AgentFinding, AgentOutput, Document } from "../drizzle/schema";
import {
  buildDeterministicDraftAssistantResponse,
  buildFilingDraftPacket,
  buildPlainReport,
  reportPreflightError,
} from "./reportGenerator";

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
  summary:
    "The report-safe framing is to demand tracker warrant materials, not assert proven misconduct.",
  sourceAnchors: JSON.stringify([
    {
      documentId: documentRecord.id,
      fileName: documentRecord.fileName,
      quote: "tracker issue",
    },
  ]),
  missingRecords: JSON.stringify(["tracker warrant", "application", "return"]),
  legalAuthorities: JSON.stringify(["United States v. Jones"]),
  nextAction: "Demand the warrant packet or a written disclaimer.",
  qcStatus: "downgraded",
  qcReason: "Missing-record demand only.",
  includedInReports: 1,
  createdAt: now,
  updatedAt: now,
} satisfies AgentFinding;

function report(
  overrides: Partial<Parameters<typeof buildPlainReport>[0]> = {}
) {
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

    expect(content).toContain("Market Proof Pack");
    expect(content).toContain("Buyer lane: Motion / report packet buyer.");
    expect(content).toContain("Sellable artifact:");
    expect(content).toContain("Proof Included");
    expect(content).toContain("Blockers Before Charging Real Money");
    expect(content).toContain("Legacy / Freeform Agent Outputs");
    expect(content).toContain("excluded from this report");
    expect(content).toContain(
      "Default reports use QC-cleared structured findings only"
    );
    expect(content).toContain("Tracker warrant materials should be demanded");
    expect(content).not.toContain(
      "UNSUPPORTED SECRET CONSPIRACY CLAIM SHOULD NOT LEAK"
    );
  });

  it("shows provider citation verification posture when available", () => {
    const content = report({
      citationVerification: {
        provider: "CourtListener",
        status: "checked",
        checkedAt: now.toISOString(),
        entries: [
          {
            authority: "United States v. Jones",
            kind: "case",
            status: "verified",
            citation: "565 U.S. 400",
            normalizedCitations: ["565 U.S. 400"],
            matches: ["United States v. Jones - scotus - 2012-01-23"],
            detail:
              "CourtListener resolved this opinion citation. Still verify current law, hierarchy, holding, and pin cite before filing.",
          },
          {
            authority: "NRS 34.160",
            kind: "statute/rule",
            status: "manual_required",
            citation: "",
            normalizedCitations: [],
            matches: [],
            detail:
              "Manual verification required. CourtListener citation lookup covers court-opinion citations, not this authority type.",
          },
        ],
        notes: [
          "Case citation lookup ran through CourtListener. This verifies citation existence only.",
        ],
      },
    });

    expect(content).toContain("Provider Verification Status");
    expect(content).toContain("Status: Checked");
    expect(content).toContain("Citation Verification Ledger");
    expect(content).toContain("United States v. Jones");
    expect(content).toContain("565 U.S. 400");
    expect(content).toContain("Manual Required");
  });

  it("includes legacy/freeform output only when explicitly requested", () => {
    const content = report({ legacyAgentOutputsIncluded: true });

    expect(content).toContain("Legacy Brainstorm Agent");
    expect(content).toContain(
      "UNSUPPORTED SECRET CONSPIRACY CLAIM SHOULD NOT LEAK"
    );
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
    expect(
      reportPreflightError({
        findings: [],
        legacyAgentOutputsIncluded: true,
      })
    ).toBeNull();
  });

  it("adds a mandamus viability gate for writ packets", () => {
    const content = report({
      template: "mandamus_writ",
      draftCommand: {
        filingType: "Mandamus petition / writ packet",
        respondingTo: "trial court refusal to rule on a pending motion",
        courtLevel: "Nevada appellate writ review",
        requestedRelief: "compel a ruling or written findings",
        keyIssues: ["clear duty", "no adequate ordinary remedy"],
        draftingStyle: "Mandamus petition quality",
      },
      filingMetadata: {
        courtName: "Supreme Court of Nevada",
        caseNumber: "CR23-0657",
        petitioner: "Cameron Church",
        respondent: "State of Nevada",
        filingTitle: "Petition for Writ of Mandamus",
      },
      findings: [
        {
          ...approvedFinding,
          title: "Court has not ruled on pending motion",
          remedyPath: "mandamus",
          summary:
            "The writ question is whether the record proves a clear duty to rule and a refusal or delay.",
          nextAction:
            "Identify why ordinary appeal is not plain, speedy, and adequate.",
          missingRecords: JSON.stringify([
            "file-stamped motion",
            "docket entry",
            "minute order",
          ]),
        },
      ],
    });

    expect(content).toContain("Mandamus / Extraordinary Writ Viability");
    expect(content).toContain("Buyer lane: Mandamus / urgent writ buyer.");
    expect(content).toContain("Writ viability packet");
    expect(content).toContain("Delivery readiness: Blocked.");
    expect(content).toContain("Caption And Filing Metadata");
    expect(content).toContain("Supreme Court of Nevada");
    expect(content).toContain("Cameron Church v. State of Nevada");
    expect(content).toContain("Petition for Writ of Mandamus");
    expect(content).toContain("Filing Command");
    expect(content).toContain("Mandamus petition / writ packet");
    expect(content).toContain("trial court refusal to rule");
    expect(content).toContain("Filing Director Plan");
    expect(content).toContain("Route: Mandamus petition / writ packet");
    expect(content).toContain("Readiness: Records First");
    expect(content).toContain("Proof Requirements");
    expect(content).toContain("clear legal duty or required act");
    expect(content).toContain("Next Questions For Human Review");
    expect(content).toContain("Drafting Quality Standard");
    expect(content).toContain("appellate-work-product quality");
    expect(content).toContain("Legal Research And Citation Spine");
    expect(content).toContain("Citation Ledger");
    expect(content).toContain("United States v. Jones");
    expect(content).toContain("Citation-Safe Drafting Rules");
    expect(content).toContain("Citation-Ready Paragraph Pattern");
    expect(content).toContain("Appellate / Writ Polish Checklist");
    expect(content).toContain("Question Presented");
    expect(content).toContain("Standard of Review / Authority");
    expect(content).toContain("Narrow Command");
    expect(content).toContain("Appendix / Source Proof");
    expect(content).toContain("Human Review / Current Law");
    expect(content).toContain("verify current law");
    expect(content).toContain("Court-Facing Relief Calibration");
    expect(content).toContain("Safe ask");
    expect(content).toContain("Do not ask for");
    expect(content).toContain("Do not use mandamus to seek damages");
    expect(content).toContain("Proof gate before export");
    expect(content).toContain("Records-first lane");
    expect(content).toContain("Written Opinion Style Analysis");
    expect(content).toContain("Question Presented.");
    expect(content).toContain("Short Answer.");
    expect(content).toContain("Rule / Legal Frame.");
    expect(content).toContain("Preliminary Disposition.");
    expect(content).toContain("Issue / Standard / Preservation Matrix");
    expect(content).toContain("Standard / authority to verify");
    expect(content).toContain("Preservation / record posture");
    expect(content).toContain("Source status");
    expect(content).toContain("Filing use");
    expect(content).toContain("Court-Ready Drafting Blueprint");
    expect(content).toContain("Questions Presented / Issues For Review");
    expect(content).toContain("Governing Standards And Authorities To Verify");
    expect(content).toContain("Relief / Order Requested");
    expect(content).toContain("Filing Quality Review");
    expect(content).toContain("Filing command: READY");
    expect(content).toContain("Caption: READY");
    expect(content).toContain("Finding support: READY");
    expect(content).toContain("Authority posture: NEEDS REVIEW");
    expect(content).toContain("Confidence: NEEDS REVIEW");
    expect(content).toContain("Mandamus posture: BLOCKED");
    expect(content).toContain(
      "For mandamus, do not file as a writ unless the route is FILE_WRIT"
    );
    expect(content).toContain("Filing Execution Playbook");
    expect(content).toContain("Record Appendix Build");
    expect(content).toContain("Argument Build");
    expect(content).toContain("Mandamus Route Check");
    expect(content).toContain("DEMAND_RECORDS_FIRST issues: 1");
    expect(content).toContain("Service, Deadline, And Local-Rule Checks");
    expect(content).toContain("Filing Assistant Prompts");
    expect(content).toContain(
      "Turn this packet into a Petition for Writ of Mandamus outline"
    );
    expect(content).toContain("no adequate ordinary remedy");
    expect(content).toContain("Mandamus is screened through five gates");
    expect(content).toContain("Mandamus Element Matrix");
    expect(content).toContain("Clear legal duty / right");
    expect(content).toContain("Beneficial interest / standing");
    expect(content).toContain("Appendix / source proof");
    expect(content).toContain("Overall writ posture");
    expect(content).toContain("DEMAND_RECORDS_FIRST:");
    expect(content).toContain("Route label: DEMAND_RECORDS_FIRST");
    expect(content).toContain("Demand records first");
    expect(content).toContain("Petition Scaffold");
    expect(content).toContain("Draft command language");
    expect(content).toContain("Writ posture: mandamus");
    expect(content).toContain("Clear-duty question:");
    expect(content).toContain("Adequate-remedy question:");
    expect(content).toContain("file-stamped motion");
  });

  it("separates appeal-preservation writ issues from non-mandamus issues", () => {
    const content = report({
      template: "mandamus_writ",
      findings: [
        {
          ...approvedFinding,
          id: 302,
          title: "Discretionary ruling should be preserved",
          findingType: "record_supported",
          remedyPath: "mandamus / appeal",
          summary:
            "This is writ-related, but ordinary appeal may be adequate because the ruling is discretionary.",
          nextAction:
            "PRESERVE_FOR_APPEAL: object, make the record, and brief the issue on appeal unless the record later proves no adequate remedy.",
          missingRecords: JSON.stringify([]),
        },
        {
          ...approvedFinding,
          id: 303,
          title: "Damages claim is not mandamus",
          findingType: "record_supported",
          remedyPath: "damages",
          summary:
            "This is not mandamus because it seeks damages and generalized misconduct review rather than a narrow writ command.",
          nextAction:
            "NOT_MANDAMUS: route this to civil-rights damages analysis or ordinary motion practice.",
          missingRecords: JSON.stringify([]),
        },
      ],
    });

    expect(content).toContain("Preserve for appeal");
    expect(content).toContain("Route label: PRESERVE_FOR_APPEAL");
    expect(content).toContain("Not mandamus");
    expect(content).toContain("Route label: NOT_MANDAMUS");
    expect(content).not.toContain("PRESERVE_FOR_APPEAL / NOT_MANDAMUS");
  });

  it("adds an opinion-style bench memo control sheet for written-opinion packets", () => {
    const content = report({
      template: "written_opinion",
      title: "Opinion Bench Memo",
      draftCommand: {
        filingType: "Opinion-style bench memo",
        respondingTo: "record-supported tracker issue",
        requestedRelief:
          "State the source-bound recommended disposition and limits.",
        keyIssues: ["question presented", "rule", "record facts"],
        draftingStyle: "Written opinion quality",
      },
      findings: [
        {
          ...approvedFinding,
          findingType: "record_supported",
          title: "Tracker representation requires rule-and-record treatment",
          summary:
            "The record supports a cautious analysis of the tracker representation, but missing warrant materials limit the disposition.",
          missingRecords: JSON.stringify(["tracker warrant packet"]),
          legalAuthorities: JSON.stringify(["United States v. Jones"]),
        },
      ],
    });

    expect(content).toContain("Opinion Bench Memo Control Sheet");
    expect(content).toContain("Written-Opinion Polish Checklist");
    expect(content).toContain("Question Presented");
    expect(content).toContain("Rule Statement");
    expect(content).toContain("Adverse Facts");
    expect(content).toContain("Recommended Disposition");
    expect(content).toContain("Human Review / Current Law");
    expect(content).toContain("Proposed Holdings / Dispositions");
    expect(content).toContain("Authority And Rule Verification");
    expect(content).toContain("Adverse Facts And Limits");
    expect(content).toContain(
      "Records That Keep The Opinion From Overreaching"
    );
    expect(content).toContain("Court-Facing Relief Calibration");
    expect(content).toContain("Bench-memo lane");
    expect(content).toContain("State only a source-bound disposition");
    expect(content).toContain("Do not write final findings");
    expect(content).toContain("Proof gate before export");
    expect(content).toContain("For written-opinion output");
    expect(content).toContain("question presented");
    expect(content).toContain("recommended disposition");
    expect(content).toContain("United States v. Jones");
    expect(content).toContain("tracker warrant packet");
  });

  it("routes plain-English filing chat into mandamus command structure", () => {
    const response = buildDeterministicDraftAssistantResponse({
      message:
        "Draft a mandamus petition in the Supreme Court of Nevada, CR23-0657, petitioner is Cameron Church, respondent is State of Nevada, to compel written findings and production of the hearing transcript.",
      currentTemplate: "court_packet",
      currentCommand: undefined,
      currentKeyIssues: [],
    });

    expect(response.template).toBe("mandamus_writ");
    expect(response.draftCommand.filingType).toContain("Mandamus");
    expect(response.draftCommand.draftingStyle).toBe(
      "Mandamus petition quality"
    );
    expect(response.draftCommand.keyIssues).toContain("Clear legal duty");
    expect(response.draftCommand.keyIssues).toContain("Appendix proof");
    expect(response.filingPlan?.routeLabel).toContain("Mandamus");
    expect(response.filingPlan?.readiness).toBe("do_not_file_yet");
    expect(response.filingPlan?.proofRequirements).toContain(
      "clear legal duty or required act"
    );
    expect(response.filingPlan?.nextQuestions.join(" ")).toContain(
      "appendix record"
    );
    expect(response.filingPlan?.nextQuestions.join(" ")).toContain(
      "exact legal act"
    );
    expect(response.filingMetadata?.courtName).toBe("Supreme Court of Nevada");
    expect(response.filingMetadata?.caseNumber).toBe("CR23-0657");
    expect(response.filingMetadata?.petitioner).toBe("Cameron Church");
    expect(response.filingMetadata?.respondent).toBe("State of Nevada");
    expect(response.warnings.join(" ")).toContain("extraordinary");
    expect(response.assistantReply).toContain("Do not file yet");
    expect(response.assistantReply).toContain("Next:");
  });

  it("routes plain-English filing chat into written-opinion structure", () => {
    const response = buildDeterministicDraftAssistantResponse({
      message:
        "Make this read like a written opinion bench memo with findings of fact, conclusions of law, adverse facts, and recommended disposition.",
      currentTemplate: "court_packet",
      currentCommand: undefined,
      currentKeyIssues: [],
    });

    expect(response.template).toBe("written_opinion");
    expect(response.reportTitle).toBe("Opinion-Style Bench Memo");
    expect(response.draftCommand.filingType).toBe("Opinion-style bench memo");
    expect(response.draftCommand.draftingStyle).toBe("Written opinion quality");
    expect(response.draftCommand.keyIssues).toContain("Question presented");
    expect(response.draftCommand.keyIssues).toContain(
      "Recommended disposition"
    );
    expect(response.filingPlan?.routeLabel).toBe("Opinion-style bench memo");
    expect(response.filingPlan?.proofRequirements).toContain(
      "recommended disposition"
    );
    expect(response.filingPlan?.nextQuestions.join(" ")).toContain(
      "clean question presented"
    );
  });

  it("preserves current filing metadata during deterministic filing chat", () => {
    const response = buildDeterministicDraftAssistantResponse({
      message: "Make this an appellate memo and preserve the current caption.",
      currentTemplate: "court_packet",
      currentCommand: undefined,
      currentFilingMetadata: {
        courtName: "Eighth Judicial District Court",
        caseNumber: "C-22-123456-1",
        petitioner: "People",
        respondent: "John Doe",
      },
      currentKeyIssues: [],
      chatHistory: [
        {
          role: "assistant",
          content: "What filing do you need?",
        },
      ],
    });

    expect(response.template).toBe("written_opinion");
    expect(response.draftCommand.filingType).toBe("Appellate issue memo");
    expect(response.draftCommand.draftingStyle).toBe("Appellate quality");
    expect(response.draftCommand.keyIssues).toContain("Question presented");
    expect(response.draftCommand.keyIssues).toContain("Standard of review");
    expect(response.draftCommand.keyIssues).toContain("Issue preservation");
    expect(response.filingMetadata?.courtName).toBe(
      "Eighth Judicial District Court"
    );
    expect(response.filingMetadata?.caseNumber).toBe("C-22-123456-1");
    expect(response.filingMetadata?.petitioner).toBe("People");
    expect(response.filingMetadata?.respondent).toBe("John Doe");
  });

  it("routes missing-record chat into discovery demand structure", () => {
    const response = buildDeterministicDraftAssistantResponse({
      message:
        "Build the missing records demand for Brady material and the tracker warrant packet.",
      currentTemplate: "court_packet",
      currentCommand: undefined,
      currentKeyIssues: [],
    });

    expect(response.template).toBe("discovery_demands");
    expect(response.draftCommand.filingType).toBe("Discovery demand packet");
    expect(response.draftCommand.keyIssues).toContain("Missing records");
    expect(response.filingPlan?.routeLabel).toBe("Discovery demand packet");
    expect(response.filingPlan?.proofRequirements).toContain(
      "exact missing record name"
    );
    expect(response.warnings.join(" ")).toContain(
      "Missing records are demands"
    );
  });

  it("turns a saved report into a source-bound filing draft handoff packet", () => {
    const sourceMarkdown = report({
      template: "mandamus_writ",
      draftCommand: {
        filingType: "Mandamus petition / writ packet",
        respondingTo: "trial court refusal to rule on a pending motion",
        requestedRelief: "compel written findings or a ruling",
        keyIssues: ["clear legal duty", "no adequate ordinary remedy"],
        draftingStyle: "Mandamus petition quality",
      },
      filingMetadata: {
        courtName: "Supreme Court of Nevada",
        caseNumber: "CR23-0657",
        petitioner: "Cameron Church",
        respondent: "State of Nevada",
        filingTitle: "Petition for Writ of Mandamus",
      },
    });

    const draft = buildFilingDraftPacket({
      title: "Petition for Writ of Mandamus",
      sourceReportTitle: "Mandamus / Extraordinary Writ Packet",
      sourceReportId: 99,
      generatedAt: now.toISOString(),
      generatedBy: "Test User",
      sourceTemplate: "mandamus_writ",
      sourceScope: "files",
      sourceMarkdown,
      draftCommand: {
        filingType: "Mandamus petition / writ packet",
        respondingTo: "trial court refusal to rule on a pending motion",
        requestedRelief: "compel written findings or a ruling",
        keyIssues: ["clear legal duty", "no adequate ordinary remedy"],
        draftingStyle: "Mandamus petition quality",
      },
      filingMetadata: {
        courtName: "Supreme Court of Nevada",
        caseNumber: "CR23-0657",
        petitioner: "Cameron Church",
        respondent: "State of Nevada",
        filingTitle: "Petition for Writ of Mandamus",
      },
    });

    expect(draft).toContain("# Petition for Writ of Mandamus");
    expect(draft).toContain("Filing Draft Status");
    expect(draft).toContain("Draft readiness:");
    expect(draft).toContain("structured filing draft handoff");
    expect(draft).toContain("This is not a final pleading");
    expect(draft).toContain("Caption And Filing Metadata");
    expect(draft).toContain("Supreme Court of Nevada");
    expect(draft).toContain("Filing Command");
    expect(draft).toContain("Filing-Quality Control Matrix");
    expect(draft).toContain("no-fantasy gate");
    expect(draft).toContain("Authority and standard");
    expect(draft).toContain("Adverse facts and limits");
    expect(draft).toContain("Mandamus / writ gate");
    expect(draft).toContain("Court-Facing Relief Calibration");
    expect(draft).toContain("Safe ask");
    expect(draft).toContain("Do not ask for");
    expect(draft).toContain("Records-first lane");
    expect(draft).toContain("Appellate / Writ Framing Scaffold");
    expect(draft).toContain("Standard Of Review / Authority To Verify");
    expect(draft).toContain("Jurisdiction / Procedure / Preservation");
    expect(draft).toContain("Adverse Facts, Limits, And Missing Proof");
    expect(draft).toContain("Mandamus Element Application");
    expect(draft).toContain("Clear legal duty / required act");
    expect(draft).toContain("No plain, speedy, adequate remedy");
    expect(draft).toContain("Exact narrow command");
    expect(draft).toContain("Written-Opinion Analysis Scaffold");
    expect(draft).toContain("Short Answer");
    expect(draft).toContain("Recommended Disposition");
    expect(draft).toContain("Court Filing Skeleton");
    expect(draft).toContain("Pleading Paper And Export Controls");
    expect(draft).toContain("Caption Block");
    expect(draft).toContain("Ordered Filing Sections");
    expect(draft).toContain("Argument / reasons relief should issue");
    expect(draft).toContain("Appendix Index Starter");
    expect(draft).toContain("Certificate of service");
    expect(draft).toContain("Do Not File Until");
    expect(draft).toContain("Questions Presented");
    expect(draft).toContain("Whether the record and governing law support");
    expect(draft).toContain("Preliminary Statement Draft Source");
    expect(draft).toContain("Record Statement Draft Source");
    expect(draft).toContain("Argument Outline");
    expect(draft).toContain("Issue-To-Evidence Draft Matrix");
    expect(draft).toContain("Source quote / anchor");
    expect(draft).toContain("tracker-motion.pdf");
    expect(draft).toContain("tracker issue");
    expect(draft).toContain("Source-Bound Draft Argument Sections");
    expect(draft).toContain("Record support to cite");
    expect(draft).toContain("Missing proof / limits");
    expect(draft).toContain("Authorities to verify");
    expect(draft).toContain("Filing use:");
    expect(draft).toContain("Relief Requested");
    expect(draft).toContain("Mandamus gate");
    expect(draft).toContain("Source And Appendix Build");
    expect(draft).toContain("Missing Proof And Blockers");
    expect(draft).toContain("Human Filing Review Checklist");
    expect(draft).toContain("Verify current statutes");
    expect(draft).toContain("QC And Reliability Source");
    expect(draft).toContain("Draft Assembly Notes");
  });
});
