import type { Document } from "../drizzle/schema";
import type { AgentConfig } from "./agentConfig";
import { invokeLLM, type InvokeResult } from "./_core/llm";
import {
  classifyMandamusRoute,
  hasMandamusRouteCode,
  isMandamusRelevantFinding,
  mandamusRouteAction,
  mandamusRouteCode,
} from "./mandamusSkill";

export const LEVERAGE_PROMPT_VERSION = "leverage-v1";
export const QC_CONFIDENCE_THRESHOLD = 95;

const nevadaCaseContext = `
NEVADA / CR23-0657 CONTEXT TO APPLY WHEN RELEVANT:
- Treat State of Nevada v. Cameron Doyle Church, CR23-0657 as a Nevada criminal case unless the selected records show otherwise.
- Competency is central. Scrutinize NRS 178.400, 178.405, 178.415, 178.417, 178.420, and related restoration procedure. Apply the Dusky present-ability framework: understanding charges, understanding proceedings, and aiding counsel with rational understanding.
- Matter of D.C. should be treated as a Nevada competency authority to verify/cite where relevant; retrospective competency determinations are disfavored.
- Flag conflicts between evaluators, refusal-to-interview issues, third-evaluator timing, evaluator raw data gaps, certification issues, restoration timing, Lake's Crossing / Stein Forensic issues, and retrospective competency risks.
- For felony/gross misdemeanor competency, look for two certified evaluators, independent reports, conflict resolution, hearing procedure, and whether any third evaluation was ordered for good cause.
- If incompetency/restoration appears, check NRS 178.425 issues, prompt restoration timing, Lake's Crossing / Stein Forensic placement, administrator/designee restoration certification, and whether current Nevada authority requires formal certification before restoration finding.
- Speedy trial: analyze NRS 178.556 and Barker v. Wingo. Attribute delay carefully. Competency tolling may be legitimate, but not an unlimited blank check.
- Right to counsel / pro se / Faretta: watch for the closed-loop trap: pro se filing ban, counsel withdrawal or breakdown, competency stay, and no meaningful path to be heard.
- Attorney ethics / judicial canons: consider NRPC 1.16, diligence/competence duties, prosecutor Brady duties, and Nevada judicial impartiality/diligence obligations as ethics or relief pressure points, not automatic damages claims.
- Discovery / Brady / Napue: demand raw evaluator data, evaluator communications, counsel files, harassment evidence, transport records, jail logs, warrant/tracker materials, and communications between court, prosecution, defense, jail, and evaluators.
- Bail / pretrial release: harassment or safety claims used to justify detention require concrete support; label missing support as missing_critical or suspicious_absence, not proven misconduct.
- Nevada remedies to consider: habeas, mandamus, appeal, recusal, supervisory relief, Nevada Commission on Judicial Discipline complaints, public records, Monell / Section 1983 against appropriate municipal actors.
- If a legal authority is not directly in the uploaded record or verified research, cite it as legal_authority needing verification before court filing.
`;

export type FindingType =
  | "record_supported"
  | "inference"
  | "strong_inference"
  | "weak_inference"
  | "missing_record"
  | "missing_critical"
  | "suspicious_absence"
  | "legal_authority"
  | "contradiction"
  | "adverse_fact";

export type FindingSeverity = "low" | "medium" | "high" | "critical";
export type QcStatus =
  | "not_required"
  | "pending"
  | "approved"
  | "downgraded"
  | "needs_more_proof"
  | "blocked";

export type SourceAnchor = {
  documentId: number;
  fileName: string;
  quote?: string;
  support?: string;
};

export type StructuredFinding = {
  title: string;
  findingType: FindingType;
  liabilityVector: string;
  remedyPath: string;
  severity: FindingSeverity;
  confidence: number;
  leverageScore: number;
  summary: string;
  sourceAnchors: SourceAnchor[];
  missingRecords: string[];
  legalAuthorities: string[];
  nextAction: string;
  qcStatus?: QcStatus;
  qcReason?: string;
};

export type StructuredAgentOutput = {
  agentId: string;
  agentName: string;
  summary: string;
  findings: StructuredFinding[];
};

export type QcAuditResult = {
  status: Exclude<QcStatus, "not_required" | "pending">;
  confidence: number;
  issues: string[];
  correctedSummary?: string;
};

const highRiskNeedles = [
  "brady",
  "napue",
  "fabricat",
  "false evidence",
  "gps",
  "tracker",
  "monell",
  "immunity",
  "damages",
  "constitutional",
  "detention",
  "jail",
  "probable cause",
  "search",
  "seizure",
  "malicious prosecution",
  "due process",
  "mandamus",
  "writ",
  "prohibition",
  "extraordinary relief",
  "clear duty",
  "no adequate remedy",
];

function clampScore(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function parseJsonObject(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    const match = value.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function normalizeArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => String(item).trim())
    .filter(Boolean)
    .slice(0, 12);
}

function normalizeAnchor(
  value: unknown,
  documents: Document[]
): SourceAnchor | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const documentId = Number(record.documentId);
  const document = documents.find(item => item.id === documentId);
  if (!document) return null;
  const quote =
    typeof record.quote === "string"
      ? record.quote.trim().slice(0, 1200)
      : undefined;
  const support =
    typeof record.support === "string"
      ? record.support.trim().slice(0, 1200)
      : undefined;
  return {
    documentId,
    fileName: document.fileName,
    quote,
    support,
  };
}

function coerceFinding(
  value: unknown,
  documents: Document[]
): StructuredFinding | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const findingType = String(record.findingType || "") as FindingType;
  const allowedTypes: FindingType[] = [
    "record_supported",
    "inference",
    "strong_inference",
    "weak_inference",
    "missing_record",
    "missing_critical",
    "suspicious_absence",
    "legal_authority",
    "contradiction",
    "adverse_fact",
  ];
  if (!allowedTypes.includes(findingType)) return null;

  const sourceAnchors = Array.isArray(record.sourceAnchors)
    ? record.sourceAnchors
        .map(anchor => normalizeAnchor(anchor, documents))
        .filter((anchor): anchor is SourceAnchor => Boolean(anchor))
    : [];

  const finding: StructuredFinding = {
    title: String(record.title || "Untitled finding").slice(0, 255),
    findingType,
    liabilityVector: String(record.liabilityVector || "Unclassified").slice(
      0,
      255
    ),
    remedyPath: String(record.remedyPath || "Needs strategy review").slice(
      0,
      255
    ),
    severity: (["low", "medium", "high", "critical"].includes(
      String(record.severity)
    )
      ? String(record.severity)
      : "medium") as FindingSeverity,
    confidence: clampScore(record.confidence, 50),
    leverageScore: clampScore(record.leverageScore, 50),
    summary:
      String(record.summary || "").trim() || "No finding summary provided.",
    sourceAnchors,
    missingRecords: normalizeArray(record.missingRecords),
    legalAuthorities: normalizeArray(record.legalAuthorities),
    nextAction: String(
      record.nextAction ||
        "Review supporting records and decide next filing step."
    ).trim(),
  };

  return enforceMandamusRouteLabel(finding);
}

function enforceMandamusRouteLabel(
  finding: StructuredFinding
): StructuredFinding {
  if (!isMandamusRelevantFinding(finding)) return finding;
  if (hasMandamusRouteCode(finding.nextAction)) return finding;

  const route = classifyMandamusRoute(finding);
  const code = mandamusRouteCode(route);
  return {
    ...finding,
    nextAction: `${code}: ${mandamusRouteAction(route)} ${finding.nextAction}`,
    qcStatus: finding.qcStatus || "pending",
    qcReason:
      finding.qcReason ||
      `Mandamus route label ${code} applied by deterministic writ gate.`,
  };
}

export function parseStructuredAgentOutput(
  agent: Pick<AgentConfig, "id" | "name">,
  rawContent: string,
  documents: Document[]
): StructuredAgentOutput {
  const parsed = parseJsonObject(rawContent);
  if (!parsed || typeof parsed !== "object") {
    return {
      agentId: agent.id,
      agentName: agent.name,
      summary:
        rawContent.slice(0, 1200) || "Agent produced unstructured output.",
      findings: [],
    };
  }

  const record = parsed as Record<string, unknown>;
  const findings = Array.isArray(record.findings)
    ? record.findings
        .map(finding => coerceFinding(finding, documents))
        .filter((finding): finding is StructuredFinding => Boolean(finding))
    : [];

  return {
    agentId: agent.id,
    agentName: agent.name,
    summary:
      String(record.summary || "").trim() ||
      findings.map(finding => finding.title).join("; ") ||
      "No summary provided.",
    findings,
  };
}

export function verifyFindingQuotes(
  finding: StructuredFinding,
  documents: Document[]
): StructuredFinding {
  const sourceAnchors = finding.sourceAnchors.map(anchor => {
    if (!anchor.quote) return anchor;
    const document = documents.find(item => item.id === anchor.documentId);
    const haystack = normalizeText(
      document?.extractedText || document?.summary || ""
    );
    const needle = normalizeText(anchor.quote);
    if (!needle || haystack.includes(needle)) return anchor;
    return {
      ...anchor,
      support: `${anchor.support ? `${anchor.support} ` : ""}Quote not found verbatim in extracted text; treat as paraphrase until checked.`,
    };
  });

  const hasMissingQuote = sourceAnchors.some(anchor =>
    anchor.support?.includes("Quote not found verbatim")
  );
  if (!hasMissingQuote) return { ...finding, sourceAnchors };

  return {
    ...finding,
    sourceAnchors,
    confidence: Math.min(finding.confidence, 84),
    qcStatus: "pending",
    qcReason: "One or more quotes did not match extracted text verbatim.",
  };
}

export function isHighRiskFinding(finding: StructuredFinding): boolean {
  if (finding.severity === "critical") return true;
  if (
    [
      "strong_inference",
      "weak_inference",
      "missing_critical",
      "suspicious_absence",
    ].includes(finding.findingType)
  )
    return true;
  const body = normalizeText(
    [
      finding.title,
      finding.summary,
      finding.liabilityVector,
      finding.remedyPath,
      finding.legalAuthorities.join(" "),
      finding.missingRecords.join(" "),
    ].join(" ")
  );
  return highRiskNeedles.some(needle => body.includes(needle));
}

export function applyRiskBasedQcGate(
  finding: StructuredFinding
): StructuredFinding {
  const needsQc =
    finding.confidence < QC_CONFIDENCE_THRESHOLD || isHighRiskFinding(finding);
  if (!needsQc) {
    return {
      ...finding,
      qcStatus: finding.qcStatus || "not_required",
      qcReason:
        finding.qcReason ||
        "Confidence at or above threshold and no high-risk trigger.",
    };
  }
  return {
    ...finding,
    qcStatus: "pending",
    qcReason:
      finding.qcReason ||
      `Risk-based QC required: ${finding.confidence < QC_CONFIDENCE_THRESHOLD ? "confidence below 95" : "high-risk legal category"}.`,
  };
}

export function isReportEligible(
  qcStatus: QcStatus | null | undefined
): boolean {
  return (
    qcStatus === "not_required" ||
    qcStatus === "approved" ||
    qcStatus === "downgraded"
  );
}

function isMissingRecordFinding(finding: StructuredFinding): boolean {
  return ["missing_record", "missing_critical", "suspicious_absence"].includes(
    finding.findingType
  );
}

function hasVerbatimQuoteProblem(finding: StructuredFinding): boolean {
  return finding.sourceAnchors.some(anchor =>
    anchor.support?.includes("Quote not found verbatim")
  );
}

export function normalizeQcAuditForReportUse(
  finding: StructuredFinding,
  audit: QcAuditResult
): QcAuditResult {
  if (audit.status !== "needs_more_proof") return audit;

  if (isMissingRecordFinding(finding)) {
    return {
      ...audit,
      status: "downgraded",
      confidence: Math.min(audit.confidence, 88),
      issues: [
        ...audit.issues,
        "Converted to report-eligible missing-record demand; do not state the missing record as a proven fact.",
      ],
      correctedSummary:
        audit.correctedSummary ||
        `${finding.summary} Treat this as a missing-record demand and proof gap, not as a proven factual accusation.`,
    };
  }

  if (finding.findingType === "legal_authority") {
    return {
      ...audit,
      status: "downgraded",
      confidence: Math.min(audit.confidence, 85),
      issues: [
        ...audit.issues,
        "Converted to report-eligible authority note; authority must be verified before filing.",
      ],
      correctedSummary:
        audit.correctedSummary ||
        `${finding.summary} Treat cited authority as a verification task before any court filing.`,
    };
  }

  if (
    finding.findingType !== "record_supported" &&
    finding.sourceAnchors.length > 0 &&
    !hasVerbatimQuoteProblem(finding)
  ) {
    return {
      ...audit,
      status: "downgraded",
      confidence: Math.min(audit.confidence, 85),
      issues: [
        ...audit.issues,
        "Converted to report-eligible inference with visible caution language because source anchors exist.",
      ],
      correctedSummary:
        audit.correctedSummary ||
        `${finding.summary} Treat this as a cautious inference requiring attorney review, not a final proven claim.`,
    };
  }

  return audit;
}

export function fallbackQcAuditForFinding(
  finding: StructuredFinding,
  error?: unknown
): QcAuditResult {
  const errorMessage =
    error instanceof Error
      ? error.message
      : "QC audit did not return a usable result.";
  if (
    finding.findingType === "record_supported" &&
    finding.sourceAnchors.length === 0
  ) {
    return {
      status: "blocked",
      confidence: Math.min(finding.confidence, 50),
      issues: [errorMessage, "Record-supported finding has no source anchors."],
    };
  }

  if (isMissingRecordFinding(finding)) {
    return {
      status: "downgraded",
      confidence: Math.min(finding.confidence, 88),
      issues: [
        errorMessage,
        "Fallback QC: usable only as a missing-record demand, not as a proven fact.",
      ],
      correctedSummary: `${finding.summary} Treat this as a missing-record demand and proof gap, not as a proven factual accusation.`,
    };
  }

  if (finding.findingType === "legal_authority") {
    return {
      status: "downgraded",
      confidence: Math.min(finding.confidence, 85),
      issues: [
        errorMessage,
        "Fallback QC: authority must be verified before filing.",
      ],
      correctedSummary: `${finding.summary} Treat cited authority as a verification task before any court filing.`,
    };
  }

  if (finding.sourceAnchors.length > 0 && !hasVerbatimQuoteProblem(finding)) {
    return {
      status: "downgraded",
      confidence: Math.min(finding.confidence, 84),
      issues: [
        errorMessage,
        "Fallback QC: source anchors exist, but attorney review is required before strong use.",
      ],
      correctedSummary: `${finding.summary} Treat this as cautious, source-linked analysis requiring review before filing.`,
    };
  }

  return {
    status: "needs_more_proof",
    confidence: Math.min(finding.confidence, 70),
    issues: [
      errorMessage,
      "Fallback QC could not make this finding report-ready.",
    ],
  };
}

export function estimateCostCents(totalTokens: number): number {
  return Math.max(0, Math.round((totalTokens / 1_000_000) * 500));
}

export function usageFromResponse(response: InvokeResult) {
  const promptTokens = response.usage?.prompt_tokens ?? 0;
  const completionTokens = response.usage?.completion_tokens ?? 0;
  const totalTokens =
    response.usage?.total_tokens ?? promptTokens + completionTokens;
  return {
    model: response.model,
    promptTokens,
    completionTokens,
    totalTokens,
    estimatedCostCents: estimateCostCents(totalTokens),
  };
}

export function buildStructuredAgentPrompt(
  agent: AgentConfig,
  scopeLabel: string,
  eraInstruction: string,
  caseRecord: string
): string {
  const mandamusRules =
    agent.id === "mandamus_writ_architect"
      ? `
Mandamus / writ-specific output rules:
- Treat this as an element test, not ordinary motion drafting.
- Every mandamus-relevant finding must put exactly one route code in nextAction: FILE_WRIT, DEMAND_RECORDS_FIRST, PRESERVE_FOR_APPEAL, or NOT_MANDAMUS.
- Use FILE_WRIT only when source anchors support clear legal duty, beneficial interest / standing, refusal/failure/delay, no plain/speedy/adequate ordinary remedy, and a narrow command.
- Use DEMAND_RECORDS_FIRST when the issue is promising but needs an order, docket entry, transcript, filing receipt, clerk notice, hearing log, certification, transport log, or other appendix proof.
- Use PRESERVE_FOR_APPEAL when appeal, habeas, ordinary motion practice, or later review may be adequate.
- Use NOT_MANDAMUS for merits review, fact reweighing, damages, generalized misconduct, or outrage unsupported by a narrow legal command.
- Missing records are demands, not proof of misconduct.
- Mandamus does not pierce judicial immunity for damages; it is a non-damages command or supervisory relief path.
`
      : "";

  return `Run ${agent.name} on ${scopeLabel}.

Return ONLY valid JSON using this exact shape:
{
  "summary": "short synthesis",
  "findings": [
    {
      "title": "short title",
      "findingType": "record_supported | strong_inference | weak_inference | missing_record | missing_critical | suspicious_absence | legal_authority | contradiction | adverse_fact",
      "liabilityVector": "Monell / Brady-Napue / Fourth Amendment / Due Process / Immunity / Discovery / Other",
      "remedyPath": "damages / suppression / mandamus / habeas / recusal / discovery / appeal / prospective relief / Monell / other",
      "severity": "low | medium | high | critical",
      "confidence": 0,
      "leverageScore": 0,
      "summary": "what the finding means, with restrained court-safe language",
      "sourceAnchors": [{"documentId": 0, "fileName": "source file", "quote": "short exact quote if present", "support": "why this source matters"}],
      "missingRecords": ["records that should exist or need to be demanded"],
      "legalAuthorities": ["case, statute, rule, or doctrine names only if relevant"],
      "nextAction": "concrete next step"
    }
  ]
}

Rules:
- No source, no factual claim. If the record does not prove it, label it strong_inference, weak_inference, missing_critical, or suspicious_absence.
- Be skeptical and adversarial, but do not convert suspicion into fact.
- Always ask what is not being said, what records should exist, and which gaps conveniently benefit the state.
- Spot procedural theater: weaponized competency, selective rule enforcement, pro se suppression, attorney-client breakdown timing, nunc pro tunc repair, punitive harassment framing, delay patterns, and accountability evasion.
- Do not invent quotes. Use short exact quotes only from the SOURCE DOCUMENTS.
- Separate what the record says from what should exist.
- For high-liability categories, avoid overclaiming and state the proof gap.
- Confidence must reflect source support, not outrage.
${mandamusRules}

${eraInstruction}

${nevadaCaseContext}

SOURCE DOCUMENTS:
${caseRecord}`;
}

export async function auditFindingWithLLM(
  finding: StructuredFinding,
  documents: Document[]
): Promise<QcAuditResult> {
  const sourceRecord = finding.sourceAnchors
    .map(anchor => {
      const document = documents.find(item => item.id === anchor.documentId);
      const text = document?.extractedText || document?.summary || "";
      return `Document ${anchor.documentId}: ${anchor.fileName}\nClaim quote: ${anchor.quote || "none"}\nSource text excerpt:\n${text.slice(0, 5000)}`;
    })
    .join("\n\n---\n\n");

  const response = await invokeLLM({
    responseFormat: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are DueProcess AI's QC Auditor. Audit legal findings for source support, overclaiming, immunity problems, missing elements, adverse facts, and report safety. Return only JSON.",
      },
      {
        role: "user",
        content: `Audit this finding. Status must be one of approved, downgraded, needs_more_proof, blocked. Confidence 0-100. Block unsupported factual claims. Downgrade overclaims. Require more proof when records should exist but are missing.

FINDING:
${JSON.stringify(finding, null, 2)}

SOURCES:
${sourceRecord || "No source anchors provided."}

Return JSON:
{"status":"approved","confidence":90,"issues":["issue"],"correctedSummary":"court-safe replacement if needed"}`,
      },
    ],
  });

  const raw = response.choices[0]?.message?.content;
  const parsed = typeof raw === "string" ? parseJsonObject(raw) : null;
  if (!parsed || typeof parsed !== "object") {
    return {
      status: "needs_more_proof",
      confidence: Math.min(finding.confidence, 70),
      issues: ["QC auditor returned unstructured output."],
    };
  }
  const record = parsed as Record<string, unknown>;
  const status = String(record.status);
  const allowed: QcAuditResult["status"][] = [
    "approved",
    "downgraded",
    "needs_more_proof",
    "blocked",
  ];
  return {
    status: allowed.includes(status as QcAuditResult["status"])
      ? (status as QcAuditResult["status"])
      : "needs_more_proof",
    confidence: clampScore(record.confidence, Math.min(finding.confidence, 80)),
    issues: normalizeArray(record.issues),
    correctedSummary:
      typeof record.correctedSummary === "string"
        ? record.correctedSummary
        : undefined,
  };
}

export function buildWarRoomSynthesis(findings: StructuredFinding[]): string {
  const eligible = findings.filter(finding =>
    isReportEligible(finding.qcStatus)
  );
  const ranked = [...eligible].sort(
    (a, b) => b.leverageScore - a.leverageScore || b.confidence - a.confidence
  );
  const blocked = findings.filter(
    finding => !isReportEligible(finding.qcStatus)
  );
  const section = (title: string, rows: StructuredFinding[]) =>
    [
      `## ${title}`,
      rows.length === 0
        ? "No findings in this category."
        : rows
            .slice(0, 12)
            .map(
              (finding, index) =>
                `${index + 1}. ${finding.title} (${finding.findingType}, confidence ${finding.confidence}, leverage ${finding.leverageScore}, QC ${finding.qcStatus})\n${finding.summary}\nNext: ${finding.nextAction}`
            )
            .join("\n\n"),
    ].join("\n");

  return [
    "# War Room Synthesis",
    section("Highest-Leverage Findings", ranked),
    section(
      "Monell / Pattern Findings",
      ranked.filter(
        finding =>
          normalizeText(finding.liabilityVector).includes("monell") ||
          normalizeText(finding.summary).includes("monell")
      )
    ),
    section(
      "Missing Records To Demand",
      ranked.filter(
        finding =>
          ["missing_record", "missing_critical", "suspicious_absence"].includes(
            finding.findingType
          ) || finding.missingRecords.length > 0
      )
    ),
    section(
      "Adverse Facts And Defense Risk",
      ranked.filter(finding => finding.findingType === "adverse_fact")
    ),
    section("Blocked Or Needs More Proof", blocked),
  ].join("\n\n");
}
