import { useAuth } from "@/_core/hooks/useAuth";
import {
  CommandMain,
  CommandSurface,
  CommandTopBar,
  CommandWorkflowBar,
} from "@/components/command-ui";
import { WorkspaceCaseStrip } from "@/components/WorkspaceCaseStrip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Brain,
  CalendarDays,
  ClipboardList,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  ExternalLink,
  FileWarning,
  FileText,
  FolderSearch,
  Gauge,
  GitBranch,
  Layers3,
  ListChecks,
  Loader2,
  Play,
  Scale,
  ShieldCheck,
  Target,
  Trash2,
  Wrench,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

type AnalysisSector = "tactical" | "legal" | "intel" | "evidence" | "offensive";
type AnalysisScope = "all" | "file" | "time";
type Accent = "blue" | "emerald" | "amber" | "rose" | "violet";
type AgentDivision =
  | "research"
  | "analysis"
  | "tactical"
  | "evidence"
  | "offensive";

type CorpusDocument = {
  id: number;
  fileName: string;
  mimeType: string | null;
  status: "pending" | "processing" | "completed" | "failed";
  extractedText?: string | null;
  documentHash?: string | null;
  extractionMethod?: string | null;
  extractionTextLength?: number | null;
  extractionQualityScore?: number | null;
  extractionWarnings?: string | null;
  createdAt?: Date | string;
};

interface GuidedAnalysisWorkspaceProps {
  sector: AnalysisSector;
  title: string;
  eyebrow: string;
  description: string;
  accent: Accent;
  focusAreas: string[];
}

interface CatalogAgent {
  id: string;
  name: string;
  division: AgentDivision;
  description: string;
  capabilities: string[];
}

interface SuperAgent {
  id: string;
  name: string;
  description: string;
  agentIds: string[];
}

interface Recommendation {
  id: string;
  name: string;
  reason: string;
  agentIds: string[];
}

type SourceAnchor = {
  documentId?: number;
  fileName?: string;
  quote?: string;
  support?: string;
};

type FindingCardData = {
  id?: number;
  agentName: string;
  title: string;
  findingType: string;
  liabilityVector?: string | null;
  remedyPath?: string | null;
  severity: string;
  confidence: number;
  leverageScore: number;
  summary: string;
  sourceAnchors: SourceAnchor[];
  missingRecords: string[];
  legalAuthorities: string[];
  nextAction?: string | null;
  qcStatus?: string | null;
  qcReason?: string | null;
  includedInReports?: boolean;
  createdAt?: Date | string;
};

type FindingCardDataInput = Omit<
  FindingCardData,
  "agentName" | "sourceAnchors" | "missingRecords" | "legalAuthorities"
> & {
  agentName?: string;
  sourceAnchors: readonly unknown[];
  missingRecords: readonly unknown[];
  legalAuthorities: readonly unknown[];
};

const ANALYSIS_READY_MIN_TEXT_LENGTH = 100;
const ANALYSIS_READY_MIN_QUALITY_SCORE = 70;
const ANALYSIS_BLOCKING_WARNINGS = new Set([
  "extraction_failed",
  "missing_source_hash",
  "empty_extracted_text",
  "very_short_extracted_text",
  "low_text_signal",
]);

const scopeOptions: Array<{
  id: AnalysisScope;
  label: string;
  description: string;
  icon: typeof FolderSearch;
}> = [
  {
    id: "all",
    label: "Whole case",
    description:
      "Best for patterns, repeat actors, contradictions, and Monell routes.",
    icon: FolderSearch,
  },
  {
    id: "file",
    label: "Selected files",
    description:
      "Use checkboxes when one filing, exhibit group, or transcript set matters.",
    icon: FileText,
  },
  {
    id: "time",
    label: "Case era",
    description: "Focus on facts and contradictions tied to a date range.",
    icon: CalendarDays,
  },
];

const legalWorkflowOptions: Recommendation[] = [
  {
    id: "leverage_engine_v2",
    name: "Leverage Engine v2 Strike Team",
    reason:
      "Maximum skepticism: timeline gaps, contradictions, constitutional/criminal procedure, Monell, evasion, missing records, authority, and ruthless QC.",
    agentIds: [
      "timeline_constructor",
      "contradiction_detector",
      "pattern_recognition_engine",
      "constitutional_analyst",
      "civil_rights_expert",
      "criminal_law_specialist",
      "immunity_piercer",
      "mandamus_writ_architect",
      "monell_pattern_mapper",
      "skeptical_adversarial_reader",
      "liability_remedy_ranker",
      "discovery_tactician",
      "precedent_miner",
      "canon_hunter",
      "qc_auditor",
    ],
  },
  {
    id: "liability_war_room",
    name: "Liability War Room",
    reason:
      "Ranks the highest-payoff issues, routes around immunity risk, and produces the QC-backed synthesis.",
    agentIds: [
      "liability_remedy_ranker",
      "monell_pattern_mapper",
      "immunity_piercer",
      "criminal_law_specialist",
      "contradiction_detector",
      "qc_auditor",
    ],
  },
  {
    id: "monell_pattern",
    name: "Monell Pattern Map",
    reason:
      "Policy, custom, failure to train, ratification, deliberate indifference, and missing municipal proof.",
    agentIds: [
      "monell_pattern_mapper",
      "liability_remedy_ranker",
      "civil_rights_expert",
      "pattern_recognition_engine",
      "discovery_tactician",
    ],
  },
  {
    id: "brady_napue",
    name: "Brady / Napue / Discovery",
    reason:
      "Hidden evidence, false-evidence pathways, contradictions, and exact records to demand.",
    agentIds: [
      "criminal_law_specialist",
      "contradiction_detector",
      "timeline_constructor",
      "discovery_tactician",
      "qc_auditor",
    ],
  },
  {
    id: "gps_search",
    name: "GPS / Search / Tracker",
    reason:
      "Tracker claims, search warrants, chain of custody, probable cause, and Fourth Amendment leverage.",
    agentIds: [
      "constitutional_analyst",
      "criminal_law_specialist",
      "liability_remedy_ranker",
      "discovery_tactician",
      "qc_auditor",
    ],
  },
  {
    id: "immunity_relief",
    name: "Immunity + Relief Pathway",
    reason:
      "Damages barriers, non-damages routes, nonimmune actors, Monell, mandamus, habeas, appeal, and recusal.",
    agentIds: [
      "immunity_piercer",
      "mandamus_writ_architect",
      "monell_pattern_mapper",
      "civil_rights_expert",
      "precedent_miner",
      "qc_auditor",
    ],
  },
  {
    id: "mandamus_writ",
    name: "Mandamus / Writ Builder",
    reason:
      "Tests clear duty, no adequate remedy, abuse-of-discretion risk, missing writ records, and petition-ready relief.",
    agentIds: [
      "mandamus_writ_architect",
      "appellate_strategist",
      "constitutional_analyst",
      "discovery_tactician",
      "precedent_miner",
      "qc_auditor",
    ],
  },
  {
    id: "motion_packet",
    name: "Motion / Report Packet",
    reason:
      "Turns issue spotting into motion, complaint, discovery, and report-ready scaffolding.",
    agentIds: [
      "motion_drafter",
      "mandamus_writ_architect",
      "complaint_constructor",
      "liability_remedy_ranker",
      "constitutional_analyst",
      "qc_auditor",
    ],
  },
];

const evidenceWorkflowOptions: Recommendation[] = [
  {
    id: "timeline_gap_architect",
    name: "Timeline + Gap Builder",
    reason:
      "Builds the chronology first, then marks missing orders, absent logs, unexplained delays, and proof gaps.",
    agentIds: [
      "timeline_constructor",
      "skeptical_adversarial_reader",
      "discovery_tactician",
      "qc_auditor",
    ],
  },
  {
    id: "contradiction_pattern",
    name: "Contradiction + Pattern Sweep",
    reason:
      "Compares files against each other for inconsistent claims, repeated tactics, and record-level contradictions.",
    agentIds: [
      "contradiction_detector",
      "pattern_recognition_engine",
      "timeline_constructor",
      "qc_auditor",
    ],
  },
  {
    id: "missing_records",
    name: "Missing Records Hunt",
    reason:
      "Turns suspicious absences into exact records to demand before agents overclaim anything.",
    agentIds: [
      "discovery_tactician",
      "skeptical_adversarial_reader",
      "timeline_constructor",
      "qc_auditor",
    ],
  },
  {
    id: "evidence_readiness",
    name: "Evidence Readiness Gate",
    reason:
      "Checks what is processed, what is blocked, what can be analyzed now, and what should not run yet.",
    agentIds: [
      "timeline_constructor",
      "pattern_recognition_engine",
      "qc_auditor",
    ],
  },
  {
    id: "record_to_claim_bridge",
    name: "Record-to-Claim Bridge",
    reason:
      "Connects clean record facts to legal theories only after the evidence agents build the support trail.",
    agentIds: [
      "timeline_constructor",
      "contradiction_detector",
      "criminal_law_specialist",
      "liability_remedy_ranker",
      "qc_auditor",
    ],
  },
];

const workflowGuides: Record<
  string,
  { bestFor: string; answers: string; feeds: string }
> = {
  leverage_engine_v2: {
    bestFor: "Full case pressure test",
    answers: "What are the strongest facts, gaps, claims, and weak spots?",
    feeds: "War Room Report",
  },
  liability_war_room: {
    bestFor: "Small firm triage",
    answers:
      "What is most valuable, most provable, and least likely to die on immunity?",
    feeds: "Claim ranking",
  },
  monell_pattern: {
    bestFor: "Civil-rights pattern work",
    answers:
      "Is there policy, custom, ratification, training failure, or missing municipal proof?",
    feeds: "Monell map",
  },
  brady_napue: {
    bestFor: "Criminal discovery review",
    answers: "What was hidden, contradicted, unsupported, or needs production?",
    feeds: "Discovery demand",
  },
  gps_search: {
    bestFor: "Search and tracker claims",
    answers:
      "What warrant, affidavit, log, return, or chain-of-custody record is missing?",
    feeds: "Suppression packet",
  },
  immunity_relief: {
    bestFor: "Court-safe relief routing",
    answers:
      "What survives damages immunity, and what belongs in mandamus, habeas, appeal, or recusal?",
    feeds: "Relief pathway",
  },
  mandamus_writ: {
    bestFor: "Compel action / fix record gaps",
    answers:
      "Is there a clear duty, no adequate remedy, and a precise command to request?",
    feeds: "Writ scaffold",
  },
  motion_packet: {
    bestFor: "Report-to-filing conversion",
    answers:
      "Which facts and claims can become a motion, complaint, or packet?",
    feeds: "Draft packet",
  },
  timeline_gap_architect: {
    bestFor: "Chronology first",
    answers: "What happened, when, what is missing, and what should exist?",
    feeds: "Timeline report",
  },
  contradiction_pattern: {
    bestFor: "Impeachment and inconsistency",
    answers: "What does one record say that another record contradicts?",
    feeds: "Contradiction memo",
  },
  missing_records: {
    bestFor: "Discovery and PRR prep",
    answers: "What records should exist but are absent from the file?",
    feeds: "Missing-record list",
  },
  evidence_readiness: {
    bestFor: "Before running agents",
    answers:
      "What is processed, blocked, duplicate, short, or unsafe to analyze?",
    feeds: "Readiness gate",
  },
  record_to_claim_bridge: {
    bestFor: "Evidence-to-legal handoff",
    answers:
      "Which clean record facts are strong enough to support legal theories?",
    feeds: "Violation map",
  },
  recommended_scope: {
    bestFor: "Fast default pass",
    answers: "What should this page check first for the selected scope?",
    feeds: "Initial findings",
  },
  proof_authority: {
    bestFor: "Record plus law",
    answers:
      "What facts have source support and what authority needs verification?",
    feeds: "Authority-backed findings",
  },
  draft_ready: {
    bestFor: "Export preparation",
    answers:
      "Which analyzed issues are close enough to become usable work product?",
    feeds: "Report builder",
  },
};

const mandamusSkillGates = [
  {
    label: "Clear duty",
    detail:
      "What exact act did the law require: rule, make findings, accept a filing, hold a hearing, produce a record, or perform a ministerial duty?",
  },
  {
    label: "Beneficial interest",
    detail:
      "Why this petitioner is directly affected by the refusal, delay, rejected filing, missing ruling, or missing record.",
  },
  {
    label: "Refusal or delay",
    detail:
      "What filed motion, docket entry, order, transcript, notice, or clerk record proves the act was requested and still has not happened?",
  },
  {
    label: "No adequate remedy",
    detail:
      "Why appeal, later review, another motion, or habeas is not plain, speedy, and adequate for this harm right now.",
  },
  {
    label: "Narrow command",
    detail:
      "The requested relief must be specific: make the court or officer do the required thing, not decide the whole case for you.",
  },
];

const mandamusSkillRoutes = [
  {
    label: "FILE_WRIT",
    detail:
      "Use only when the record already proves the duty, refusal/delay, inadequate ordinary remedy, and exact command.",
  },
  {
    label: "DEMAND_RECORDS_FIRST",
    detail:
      "Use when the issue is promising but needs the order, transcript, docket proof, filing receipt, log, or certification first.",
  },
  {
    label: "PRESERVE_FOR_APPEAL",
    detail:
      "Use when the issue is real but ordinary appeal or later review is probably the cleaner path.",
  },
  {
    label: "NOT_MANDAMUS",
    detail:
      "Use when the ask is really merits review, fact reweighing, damages, or generalized misconduct outrage.",
  },
];

const mandamusSkillOutputs = [
  {
    label: "Viability lanes",
    detail:
      "Sorts issues into file now, demand records first, preserve for appeal, or not mandamus.",
  },
  {
    label: "Appendix checklist",
    detail:
      "Lists the orders, docket entries, transcripts, notices, and logs needed before a writ packet is safe.",
  },
  {
    label: "Petition scaffold",
    detail:
      "Builds issue, relief, statutory hook, ordinary-remedy problem, and guarded command language.",
  },
];

const accentTokens: Record<
  Accent,
  {
    accent: string;
    accentSoft: string;
    accentText: string;
    button: string;
    active: string;
  }
> = {
  blue: {
    accent: "border-blue-500",
    accentSoft: "bg-blue-500/10",
    accentText: "text-blue-600 dark:text-blue-300",
    button: "bg-blue-600 text-white hover:bg-blue-500",
    active: "border-blue-500 bg-blue-500/10",
  },
  emerald: {
    accent: "border-emerald-500",
    accentSoft: "bg-emerald-500/10",
    accentText: "text-emerald-700 dark:text-emerald-300",
    button: "bg-emerald-600 text-white hover:bg-emerald-500",
    active: "border-emerald-500 bg-emerald-500/10",
  },
  amber: {
    accent: "border-amber-500",
    accentSoft: "bg-amber-500/10",
    accentText: "text-amber-700 dark:text-amber-300",
    button: "bg-amber-600 text-white hover:bg-amber-500",
    active: "border-amber-500 bg-amber-500/10",
  },
  rose: {
    accent: "border-rose-500",
    accentSoft: "bg-rose-500/10",
    accentText: "text-rose-700 dark:text-rose-300",
    button: "bg-rose-600 text-white hover:bg-rose-500",
    active: "border-rose-500 bg-rose-500/10",
  },
  violet: {
    accent: "border-violet-500",
    accentSoft: "bg-violet-500/10",
    accentText: "text-violet-700 dark:text-violet-300",
    button: "bg-violet-600 text-white hover:bg-violet-500",
    active: "border-violet-500 bg-violet-500/10",
  },
};

const divisionLabels: Record<AgentDivision, string> = {
  research: "Authority",
  analysis: "Analysis",
  tactical: "Strategy",
  evidence: "Evidence",
  offensive: "Drafting",
};

const sectorDefaults: Record<AnalysisSector, string[]> = {
  tactical: ["immunity_piercer", "abstention_destroyer", "discovery_tactician"],
  legal: [
    "constitutional_analyst",
    "criminal_law_specialist",
    "civil_rights_expert",
    "appellate_strategist",
    "mandamus_writ_architect",
  ],
  intel: ["canon_hunter", "precedent_miner", "statute_scanner"],
  evidence: [
    "pattern_recognition_engine",
    "timeline_constructor",
    "contradiction_detector",
  ],
  offensive: ["motion_drafter", "complaint_constructor"],
};

function uniqueIds(ids: string[]): string[] {
  return Array.from(new Set(ids));
}

function parseStringArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function isAnalysisReady(document: CorpusDocument): boolean {
  const warnings = parseStringArray(document.extractionWarnings);
  return (
    document.status === "completed" &&
    sourceAnchored(document) &&
    extractedLength(document) >= ANALYSIS_READY_MIN_TEXT_LENGTH &&
    qualityScore(document) >= ANALYSIS_READY_MIN_QUALITY_SCORE &&
    !warnings.some(warning => ANALYSIS_BLOCKING_WARNINGS.has(warning))
  );
}

function sourceAnchored(document: CorpusDocument): boolean {
  return Boolean(
    document.documentHash || document.extractedText?.includes("SOURCE_SHA256:")
  );
}

function extractedLength(document: CorpusDocument): number {
  if (
    typeof document.extractionTextLength === "number" &&
    document.extractionTextLength > 0
  )
    return document.extractionTextLength;
  return (document.extractedText || "")
    .replace(/^SOURCE_SHA256:\s*[a-f0-9]{64}\s*/im, "")
    .trim().length;
}

function qualityScore(document: CorpusDocument): number {
  if (
    typeof document.extractionQualityScore === "number" &&
    document.extractionQualityScore > 0
  )
    return document.extractionQualityScore;
  if (document.status !== "completed") return 0;
  let score = 100;
  if (!sourceAnchored(document)) score -= 45;
  const length = extractedLength(document);
  if (length === 0) score -= 80;
  else if (length < ANALYSIS_READY_MIN_TEXT_LENGTH) score -= 25;
  else if (length < 500) score -= 10;
  return Math.max(0, Math.min(100, score));
}

function documentBlocker(document: CorpusDocument): string {
  const warnings = parseStringArray(document.extractionWarnings);
  if (document.status !== "completed") return `status is ${document.status}`;
  if (!sourceAnchored(document)) return "missing source hash";
  if (extractedLength(document) < ANALYSIS_READY_MIN_TEXT_LENGTH)
    return `only ${extractedLength(document)} extracted characters`;
  if (qualityScore(document) < ANALYSIS_READY_MIN_QUALITY_SCORE)
    return `OCR quality ${qualityScore(document)}`;
  const blockingWarning = warnings.find(warning =>
    ANALYSIS_BLOCKING_WARNINGS.has(warning)
  );
  if (blockingWarning) return blockingWarning.replace(/_/g, " ");
  return "not analysis-ready";
}

function errorMessage(error: unknown): string {
  if (!error) return "";
  if (error instanceof Error) return error.message;
  if (
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeSourceAnchors(value: readonly unknown[]): SourceAnchor[] {
  return value.flatMap(item => {
    if (!isRecord(item)) return [];
    const anchor: SourceAnchor = {};
    if (typeof item.documentId === "number") {
      anchor.documentId = item.documentId;
    }
    if (typeof item.fileName === "string") {
      anchor.fileName = item.fileName;
    }
    if (typeof item.quote === "string") {
      anchor.quote = item.quote;
    }
    if (typeof item.support === "string") {
      anchor.support = item.support;
    }
    return Object.keys(anchor).length > 0 ? [anchor] : [];
  });
}

function normalizeStringArray(value: readonly unknown[]): string[] {
  return value.filter((item): item is string => typeof item === "string");
}

function isFindingCardDataInput(
  value: FindingCardDataInput | undefined
): value is FindingCardDataInput {
  return Boolean(value);
}

function normalizeFindingCardData(
  finding: FindingCardDataInput
): FindingCardData {
  return {
    ...finding,
    agentName: finding.agentName ?? "Unknown agent",
    sourceAnchors: normalizeSourceAnchors(finding.sourceAnchors),
    missingRecords: normalizeStringArray(finding.missingRecords),
    legalAuthorities: normalizeStringArray(finding.legalAuthorities),
  };
}

function inDateScope(
  document: CorpusDocument,
  fromDate: string,
  toDate: string
): boolean {
  if (!fromDate && !toDate) return true;
  const createdAt = document.createdAt ? new Date(document.createdAt) : null;
  if (!createdAt || Number.isNaN(createdAt.getTime())) return false;
  if (fromDate && createdAt < new Date(`${fromDate}T00:00:00.000`))
    return false;
  if (toDate && createdAt > new Date(`${toDate}T23:59:59.999`)) return false;
  return true;
}

function safeFileName(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "agent-output"
  );
}

async function copyOutput(agentName: string, output: string) {
  try {
    await navigator.clipboard.writeText(`${agentName}\n\n${output}`);
    toast.success(`${agentName} copied`);
  } catch {
    toast.error("Clipboard access failed. Use export instead.");
  }
}

function downloadOutput(agentName: string, output: string) {
  const blob = new Blob([`${agentName}\n\n${output}`], {
    type: "text/plain;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${safeFileName(agentName)}.txt`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function buildRecommendations(
  sector: AnalysisSector,
  scope: AnalysisScope
): Recommendation[] {
  const base = sectorDefaults[sector];
  const eraSupport = ["timeline_constructor", "contradiction_detector"];
  const authoritySupport = ["precedent_miner", "statute_scanner"];
  const draftingSupport = ["motion_drafter", "complaint_constructor"];
  const primary =
    sector === "evidence" ? evidenceWorkflowOptions : legalWorkflowOptions;
  const scoped: Recommendation[] = [
    {
      id: "recommended_scope",
      name:
        scope === "time"
          ? "Era contradiction pass"
          : sector === "evidence"
            ? "Record-first pass"
            : "Best legal fit",
      reason:
        scope === "file"
          ? "Focused pass for selected filings or exhibits."
          : sector === "evidence"
            ? "Builds the proof map before legal conclusions."
            : "Broad pass for proof gaps, issue spotting, and next actions.",
      agentIds: uniqueIds(scope === "time" ? [...base, ...eraSupport] : base),
    },
    {
      id: "proof_authority",
      name: "Proof + Authority",
      reason: "Pairs record analysis with statutes, rules, and precedent.",
      agentIds: uniqueIds([...base, ...eraSupport, ...authoritySupport]),
    },
    {
      id: "draft_ready",
      name: "Draft-Ready Package",
      reason: "Adds drafting agents after issue spotting.",
      agentIds: uniqueIds([...base, ...authoritySupport, ...draftingSupport]),
    },
  ];

  return [...primary, ...scoped];
}

function qcBadgeClass(status?: string | null) {
  switch (status) {
    case "approved":
    case "not_required":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200";
    case "downgraded":
      return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200";
    case "blocked":
      return "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-200";
    case "needs_more_proof":
    case "pending":
    default:
      return "border-yellow-500/30 bg-yellow-500/10 text-yellow-700 dark:text-yellow-200";
  }
}

function statusLabel(status?: string | null) {
  return (status || "pending").replace(/_/g, " ");
}

function StatTile({
  icon: Icon,
  label,
  value,
  detail,
  tone,
  compactMobile = false,
}: {
  icon: typeof ListChecks;
  label: string;
  value: string | number;
  detail?: string;
  tone: string;
  compactMobile?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-md border border-zinc-200 bg-white/70 p-3 shadow-sm dark:border-white/10 dark:bg-slate-950/70 sm:p-4">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="min-w-0 break-words text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-slate-500">
          {label}
        </div>
        <Icon className={cn("h-4 w-4 flex-none", tone)} />
      </div>
      <div className="mt-2 break-words text-xl font-semibold text-zinc-950 dark:text-white sm:text-2xl">
        {value}
      </div>
      {detail && (
        <div
          className={cn(
            "mt-1 break-words text-xs leading-5 text-zinc-500 dark:text-slate-400",
            compactMobile && "hidden sm:block"
          )}
        >
          {detail}
        </div>
      )}
    </div>
  );
}

function WorkflowNavBar({
  isEvidenceWorkspace,
  processPending,
}: {
  isEvidenceWorkspace: boolean;
  processPending: boolean;
}) {
  const siblingHref = isEvidenceWorkspace
    ? "/sector/arsenal"
    : "/sector/evidence";
  const siblingLabel = isEvidenceWorkspace
    ? "Legal War Room"
    : "Evidence Review";
  const navItems = [
    { href: "#status", label: "Status", icon: Activity },
    { href: "#plan", label: "Plan", icon: Target },
    { href: "#scope", label: "Scope", icon: Layers3 },
    { href: "#results", label: "Results", icon: Scale },
  ];

  return (
    <nav className="rounded-md border border-zinc-200 bg-white/72 px-2 py-2 shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-950/72">
      <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <span className="inline-flex min-h-9 shrink-0 items-center px-2 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-slate-500">
          Jump
        </span>
        {navItems.map(({ href, label, icon: Icon }) => (
          <a
            key={href}
            href={href}
            className="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
          >
            <Icon className="h-4 w-4" />
            {label}
          </a>
        ))}
        <Link href={siblingHref}>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto min-h-9 shrink-0 gap-2 border-zinc-200 bg-white dark:border-white/10 dark:bg-white/5"
          >
            <GitBranch className="h-4 w-4" />
            {siblingLabel}
          </Button>
        </Link>
        {processPending && (
          <Badge className="min-h-9 shrink-0 gap-2 bg-amber-600 px-3 text-white">
            <Loader2 className="h-4 w-4 animate-spin" />
            Running
          </Badge>
        )}
      </div>
    </nav>
  );
}

function WorkspaceModeBrief({
  isEvidenceWorkspace,
  isLegalWorkspace,
}: {
  isEvidenceWorkspace: boolean;
  isLegalWorkspace: boolean;
}) {
  const mode = isEvidenceWorkspace
    ? {
        eyebrow: "Evidence-first workflow",
        title: "Build the record before you ask for legal firepower.",
        description:
          "This page is for timeline building, source support, contradictions, missing records, OCR readiness, and adverse facts. It should tell you what the record actually says and what is still missing.",
        accent:
          "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:border-emerald-300/25 dark:bg-emerald-300/10 dark:text-emerald-100",
        steps: [
          {
            icon: CalendarDays,
            label: "Timeline",
            detail:
              "Turn filings, transcripts, exhibits, and uploads into dated events.",
          },
          {
            icon: GitBranch,
            label: "Contradictions",
            detail:
              "Compare what one record says against another before making claims.",
          },
          {
            icon: FolderSearch,
            label: "Missing records",
            detail:
              "Convert gaps into demands instead of pretending they prove misconduct.",
          },
        ],
      }
    : isLegalWorkspace
      ? {
          eyebrow: "Law-first workflow",
          title:
            "Turn a clean record into claims, remedies, and filing posture.",
          description:
            "This page is for liability theories, Monell patterns, immunity-safe routes, Brady/Napue, mandamus gates, remedy ranking, and court-packet strategy. It should not run ahead of the proof.",
          accent:
            "border-violet-500/30 bg-violet-500/10 text-violet-800 dark:border-violet-300/25 dark:bg-violet-300/10 dark:text-violet-100",
          steps: [
            {
              icon: Scale,
              label: "Claim route",
              detail:
                "Choose the doctrine lane: mandamus, Monell, Brady, immunity, appeal, or motion.",
            },
            {
              icon: ShieldCheck,
              label: "QC pressure",
              detail:
                "Keep low-confidence and unsupported findings out of filing language.",
            },
            {
              icon: ClipboardList,
              label: "Report handoff",
              detail:
                "Feed Reports with source-bound findings, missing records, and remedy paths.",
            },
          ],
        }
      : {
          eyebrow: "Analysis workflow",
          title: "Run scoped agents against ready records.",
          description:
            "Choose the scope, pick the agent team, keep bad OCR out, and send only reviewable results into reports.",
          accent:
            "border-blue-500/30 bg-blue-500/10 text-blue-800 dark:border-blue-300/25 dark:bg-blue-300/10 dark:text-blue-100",
          steps: [
            {
              icon: Layers3,
              label: "Scope",
              detail: "Whole case, selected files, or date era.",
            },
            {
              icon: Brain,
              label: "Agents",
              detail: "Use the team that matches the job.",
            },
            {
              icon: ClipboardList,
              label: "Outputs",
              detail: "Save findings and reports only after QC.",
            },
          ],
        };

  return (
    <section className="grid gap-3 rounded-md border border-zinc-200 bg-white/78 p-3 shadow-sm dark:border-white/10 dark:bg-slate-950/72 sm:p-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <div className="min-w-0">
        <Badge variant="outline" className={cn("rounded-md", mode.accent)}>
          {mode.eyebrow}
        </Badge>
        <h2 className="mt-3 break-words text-xl font-semibold text-zinc-950 dark:text-white sm:text-2xl">
          {mode.title}
        </h2>
        <p className="mt-2 max-w-3xl break-words text-sm leading-6 text-zinc-600 dark:text-slate-400">
          {mode.description}
        </p>
      </div>
      <div className="grid min-w-0 gap-2 sm:grid-cols-3">
        {mode.steps.map(step => {
          const Icon = step.icon;
          return (
            <div
              key={step.label}
              className="min-w-0 rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-white/[0.04]"
            >
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 shrink-0 text-zinc-700 dark:text-slate-200" />
                <p className="break-words text-sm font-semibold text-zinc-950 dark:text-white">
                  {step.label}
                </p>
              </div>
              <p className="mt-2 break-words text-xs leading-5 text-zinc-500 dark:text-slate-500">
                {step.detail}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function LoudStatusPanel({
  issues,
  readyPercent,
  readyDocuments,
  blockedDocuments,
  selectedDocumentIds,
  matchingDocumentCount,
  runDisabledReason,
  setScope,
  setSelectedDocumentIds,
}: {
  issues: Array<{
    id: string;
    title: string;
    detail: string;
    severity: "critical" | "warning" | "info";
    actionHref?: string;
    actionLabel?: string;
  }>;
  readyPercent: number;
  readyDocuments: CorpusDocument[];
  blockedDocuments: CorpusDocument[];
  selectedDocumentIds: number[];
  matchingDocumentCount: number;
  runDisabledReason: string | null;
  setScope: (scope: AnalysisScope) => void;
  setSelectedDocumentIds: (ids: number[]) => void;
}) {
  const critical = issues.filter(issue => issue.severity === "critical");
  const warnings = issues.filter(issue => issue.severity === "warning");
  const info = issues.filter(issue => issue.severity === "info");

  return (
    <section id="status" className="scroll-mt-28 space-y-2">
      <Card
        className={cn(
          "min-w-0 overflow-hidden border shadow-sm",
          critical.length > 0
            ? "border-red-500 bg-red-50 dark:bg-red-950/30"
            : warnings.length > 0
              ? "border-amber-500 bg-amber-50 dark:bg-amber-950/25"
              : "border-emerald-500/40 bg-white/85 dark:bg-emerald-950/10"
        )}
      >
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2 text-zinc-950 dark:text-white">
                {critical.length > 0 ? (
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-300" />
                ) : warnings.length > 0 ? (
                  <FileWarning className="h-5 w-5 text-amber-600 dark:text-amber-300" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
                )}
                {critical.length > 0
                  ? "Blocked"
                  : warnings.length > 0
                    ? "Needs Attention"
                    : "Ready"}
              </CardTitle>
              <CardDescription className="mt-1 text-zinc-600 dark:text-slate-300">
                {runDisabledReason ||
                  `${matchingDocumentCount} ready record${matchingDocumentCount === 1 ? "" : "s"} available for this run.`}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/sector/corpus">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 border-zinc-200 bg-white dark:border-white/10 dark:bg-white/5"
                >
                  <Wrench className="h-4 w-4" />
                  Fix Corpus
                </Button>
              </Link>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={readyDocuments.length === 0}
                onClick={() => {
                  setScope("file");
                  setSelectedDocumentIds(
                    readyDocuments.map(document => document.id)
                  );
                }}
                className="gap-2 border-zinc-200 bg-white dark:border-white/10 dark:bg-white/5"
              >
                <FileText className="h-4 w-4" />
                Use Ready Files
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2.5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
            <StatTile
              icon={CheckCircle2}
              label="Ready"
              value={readyDocuments.length}
              detail="can be analyzed"
              tone="text-emerald-600 dark:text-emerald-300"
              compactMobile
            />
            <StatTile
              icon={FileWarning}
              label="Blocked"
              value={blockedDocuments.length}
              detail="fix or exclude"
              tone="text-red-600 dark:text-red-300"
              compactMobile
            />
            <StatTile
              icon={Layers3}
              label="Selected"
              value={selectedDocumentIds.length}
              detail="file-scope picks"
              tone="text-blue-600 dark:text-blue-300"
              compactMobile
            />
            <StatTile
              icon={Gauge}
              label="Readiness"
              value={`${readyPercent}%`}
              detail="Corpus usable"
              tone={
                readyPercent === 100
                  ? "text-emerald-600 dark:text-emerald-300"
                  : "text-amber-600 dark:text-amber-300"
              }
              compactMobile
            />
          </div>
          <Progress
            value={readyPercent}
            className="h-1.5 bg-zinc-200 dark:bg-white/10 sm:h-2"
          />

          {issues.length > 0 && (
            <div className="grid gap-2">
              {[...critical, ...warnings, ...info].map(issue => (
                <Alert
                  key={issue.id}
                  className={cn(
                    "border",
                    issue.severity === "critical"
                      ? "border-red-500 bg-red-100 text-red-950 dark:bg-red-950/40 dark:text-red-100"
                      : issue.severity === "warning"
                        ? "border-amber-500 bg-amber-100 text-amber-950 dark:bg-amber-950/35 dark:text-amber-100"
                        : "border-blue-500/40 bg-blue-50 text-blue-950 dark:bg-blue-950/25 dark:text-blue-100"
                  )}
                >
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle className="line-clamp-none">
                    {issue.title}
                  </AlertTitle>
                  <AlertDescription className="text-current/85">
                    <p>{issue.detail}</p>
                    {issue.actionHref && (
                      <Link href={issue.actionHref}>
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-2 gap-2 border-current/30 bg-white/60 text-current hover:bg-white/80 dark:bg-white/10 dark:hover:bg-white/15"
                        >
                          {issue.actionLabel || "Open"}
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    )}
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function FindingCard({ finding }: { finding: FindingCardData }) {
  const anchors = finding.sourceAnchors ?? [];
  const missingRecords = finding.missingRecords ?? [];
  const authorities = finding.legalAuthorities ?? [];
  return (
    <article className="min-w-0 rounded-md border border-zinc-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-slate-950/80 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="min-w-0 break-words text-base font-semibold text-zinc-950 dark:text-white">
              {finding.title}
            </h3>
            <Badge variant="outline" className={qcBadgeClass(finding.qcStatus)}>
              QC {statusLabel(finding.qcStatus)}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-slate-500">
            {finding.agentName} · {finding.findingType.replace(/_/g, " ")}
          </p>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 text-right text-xs sm:w-auto">
          <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-white/10 dark:bg-white/[0.04]">
            <div className="text-zinc-500 dark:text-slate-500">Confidence</div>
            <div
              className={
                finding.confidence >= 95
                  ? "text-emerald-600 dark:text-emerald-300"
                  : finding.confidence >= 80
                    ? "text-amber-600 dark:text-amber-300"
                    : "text-red-600 dark:text-red-300"
              }
            >
              {finding.confidence}
            </div>
          </div>
          <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-white/10 dark:bg-white/[0.04]">
            <div className="text-zinc-500 dark:text-slate-500">Leverage</div>
            <div className="text-blue-600 dark:text-blue-300">
              {finding.leverageScore}
            </div>
          </div>
        </div>
      </div>

      <p className="mt-3 line-clamp-4 break-words text-sm leading-6 text-zinc-700 dark:text-slate-300">
        {finding.summary}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {finding.liabilityVector && (
          <Badge className="bg-zinc-100 text-zinc-700 dark:bg-white/10 dark:text-slate-200">
            {finding.liabilityVector}
          </Badge>
        )}
        {finding.remedyPath && (
          <Badge className="bg-zinc-100 text-zinc-700 dark:bg-white/10 dark:text-slate-200">
            {finding.remedyPath}
          </Badge>
        )}
        <Badge className="bg-zinc-100 text-zinc-700 dark:bg-white/10 dark:text-slate-200">
          {finding.severity}
        </Badge>
      </div>

      {finding.nextAction && (
        <div className="mt-3">
          <FindingMini label="Next action" value={finding.nextAction} />
        </div>
      )}

      {(anchors.length > 0 ||
        missingRecords.length > 0 ||
        authorities.length > 0) && (
        <details className="mt-3 overflow-hidden rounded-md border border-zinc-200 bg-zinc-50 dark:border-white/10 dark:bg-white/[0.03]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 outline-none transition hover:bg-white dark:text-slate-500 dark:hover:bg-white/[0.04] [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5" />
              Proof drawer
            </span>
            <span className="normal-case tracking-normal text-zinc-400 dark:text-slate-500">
              {anchors.length} source{anchors.length === 1 ? "" : "s"}
              {missingRecords.length > 0
                ? ` · ${missingRecords.length} gap${missingRecords.length === 1 ? "" : "s"}`
                : ""}
            </span>
          </summary>
          <div className="space-y-3 border-t border-zinc-200 p-3 dark:border-white/10">
            {anchors.length > 0 && (
              <div className="space-y-2">
                {anchors.slice(0, 3).map((anchor, index) => (
                  <div
                    key={`${anchor.documentId || "source"}-${index}`}
                    className="min-w-0 break-words text-xs leading-5 text-zinc-700 dark:text-slate-300"
                  >
                    <span className="font-medium text-zinc-950 dark:text-slate-100">
                      {anchor.fileName ||
                        `Document ${anchor.documentId || index + 1}`}
                    </span>
                    {anchor.quote && (
                      <span className="block break-words text-zinc-500 dark:text-slate-400">
                        "{anchor.quote}"
                      </span>
                    )}
                    {anchor.support && (
                      <span className="block break-words text-amber-700 dark:text-amber-200">
                        {anchor.support}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
            {(missingRecords.length > 0 || authorities.length > 0) && (
              <div className="grid gap-3 md:grid-cols-2">
                {missingRecords.length > 0 && (
                  <FindingMini
                    label="Missing records"
                    value={missingRecords.slice(0, 4).join("; ")}
                  />
                )}
                {authorities.length > 0 && (
                  <FindingMini
                    label="Authority"
                    value={authorities.slice(0, 4).join("; ")}
                  />
                )}
              </div>
            )}
          </div>
        </details>
      )}
      {finding.qcReason && (
        <p className="mt-3 line-clamp-2 text-xs leading-5 text-amber-700 dark:text-amber-200">
          {finding.qcReason}
        </p>
      )}
    </article>
  );
}

function FindingMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-slate-500">
        {label}
      </div>
      <p className="mt-2 line-clamp-3 break-words text-xs leading-5 text-zinc-700 dark:text-slate-300">
        {value}
      </p>
    </div>
  );
}

function rankCounts(items: string[]) {
  const counts = new Map<string, number>();
  items
    .filter(Boolean)
    .forEach(item => counts.set(item, (counts.get(item) ?? 0) + 1));
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
}

function formatShortDate(value?: Date | string) {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function findingTypeCount(findings: FindingCardData[], types: string[]) {
  return findings.filter(finding => types.includes(finding.findingType)).length;
}

function BackendExposurePanel({
  sector,
  selectedAgentIds,
  selectedDocumentIds,
  readyDocuments,
  blockedDocuments,
  savedRunsCount,
  savedFindingsCount,
  currentRun,
}: {
  sector: AnalysisSector;
  selectedAgentIds: string[];
  selectedDocumentIds: number[];
  readyDocuments: CorpusDocument[];
  blockedDocuments: CorpusDocument[];
  savedRunsCount: number;
  savedFindingsCount: number;
  currentRun?: {
    runId: number;
    totalAgents: number;
    completedAgents: number;
    documentCount: number;
    usage?: {
      totalTokens: number;
      estimatedCostCents: number;
      model?: string | null;
    };
  };
}) {
  return (
    <details className="group overflow-hidden rounded-md border border-zinc-200 bg-white/72 shadow-sm dark:border-white/10 dark:bg-slate-950/72">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 outline-none transition hover:bg-zinc-50 dark:hover:bg-white/[0.04] [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-200">
            <Brain className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-zinc-950 dark:text-white">
              Backend engine details
            </span>
            <span className="block truncate text-xs text-zinc-500 dark:text-slate-400">
              Open when you need payloads, persistence, and cost telemetry.
            </span>
          </span>
        </span>
        <Badge className="shrink-0 border border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-200">
          {readyDocuments.length} ready / {blockedDocuments.length} blocked
        </Badge>
      </summary>
      <Card className="min-w-0 overflow-hidden rounded-none border-x-0 border-b-0 border-t border-zinc-200 bg-transparent shadow-none dark:border-white/10">
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2">
          <FindingMini
            label="Selected backend agents"
            value={
              selectedAgentIds.length > 0
                ? selectedAgentIds.join(", ")
                : sector === "evidence"
                  ? "Default evidence stack"
                  : "Default legal stack"
            }
          />
          <FindingMini
            label="Record gate"
            value={`${readyDocuments.length} ready; ${blockedDocuments.length} blocked. Agents cannot run whole-case analysis while files are unprocessed.`}
          />
          <FindingMini
            label="Scope payload"
            value={
              selectedDocumentIds.length > 0
                ? `${selectedDocumentIds.length} file IDs selected`
                : "Whole case or era scope will use all ready records."
            }
          />
          <FindingMini
            label="Persistence"
            value={`${savedFindingsCount} structured findings; ${savedRunsCount} saved legacy outputs.`}
          />
          {currentRun && (
            <>
              <FindingMini
                label="Latest run"
                value={`Run ${currentRun.runId}; ${currentRun.completedAgents}/${currentRun.totalAgents} agents; ${currentRun.documentCount} records.`}
              />
              <FindingMini
                label="Usage"
                value={
                  currentRun.usage
                    ? `${currentRun.usage.totalTokens} tokens; $${(currentRun.usage.estimatedCostCents / 100).toFixed(4)} estimated; ${currentRun.usage.model || "model recorded"}.`
                    : "No token usage returned yet."
                }
              />
            </>
          )}
        </CardContent>
      </Card>
    </details>
  );
}

function EvidenceTimelinePanel({
  documents,
  visibleFindings,
  setScope,
  setAgentSelection,
  availableAgentIds,
}: {
  documents: CorpusDocument[];
  visibleFindings: FindingCardData[];
  setScope: (scope: AnalysisScope) => void;
  setAgentSelection: (agentIds: string[]) => void;
  availableAgentIds: Set<string>;
}) {
  const readyDocs = documents.filter(isAnalysisReady);
  const blockedDocs = documents.filter(document => !isAnalysisReady(document));
  const timelineDocs = documents
    .slice()
    .sort(
      (a, b) =>
        new Date(a.createdAt || 0).getTime() -
        new Date(b.createdAt || 0).getTime()
    );
  const findingsByDocument = visibleFindings.reduce((map, finding) => {
    finding.sourceAnchors?.forEach(anchor => {
      if (!anchor.documentId) return;
      const existing = map.get(anchor.documentId) ?? [];
      existing.push(finding);
      map.set(anchor.documentId, existing);
    });
    return map;
  }, new Map<number, FindingCardData[]>());
  const documentSupportRows = documents
    .map(document => {
      const findings = findingsByDocument.get(document.id) ?? [];
      return {
        document,
        findings,
        anchorCount: findings.reduce(
          (sum, finding) =>
            sum +
            (finding.sourceAnchors ?? []).filter(
              anchor => anchor.documentId === document.id
            ).length,
          0
        ),
        missingCount: findings.reduce(
          (sum, finding) => sum + (finding.missingRecords?.length ?? 0),
          0
        ),
      };
    })
    .sort(
      (a, b) =>
        b.findings.length - a.findings.length ||
        Number(isAnalysisReady(b.document)) -
          Number(isAnalysisReady(a.document))
    );
  const anchoredFindingCount = visibleFindings.filter(
    finding => (finding.sourceAnchors ?? []).length > 0
  ).length;
  const unanchoredFindingCount = Math.max(
    0,
    visibleFindings.length - anchoredFindingCount
  );
  const hashGroups = documents.reduce((groups, document) => {
    const hash = document.documentHash?.trim();
    if (!hash) return groups;
    const existing = groups.get(hash) ?? [];
    existing.push(document);
    groups.set(hash, existing);
    return groups;
  }, new Map<string, CorpusDocument[]>());
  const duplicateGroups = Array.from(hashGroups.entries())
    .filter(([, group]) => group.length > 1)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 4);
  const missingRecordQueue = rankCounts(
    visibleFindings.flatMap(finding => finding.missingRecords ?? [])
  );
  const missingCount = findingTypeCount(visibleFindings, [
    "missing_record",
    "missing_critical",
    "suspicious_absence",
  ]);
  const contradictionCount = findingTypeCount(visibleFindings, [
    "contradiction",
  ]);
  const adverseCount = findingTypeCount(visibleFindings, ["adverse_fact"]);
  const timelineAgents = [
    "timeline_constructor",
    "skeptical_adversarial_reader",
    "discovery_tactician",
    "qc_auditor",
  ].filter(id => availableAgentIds.has(id));
  const contradictionAgents = [
    "contradiction_detector",
    "pattern_recognition_engine",
    "timeline_constructor",
    "qc_auditor",
  ].filter(id => availableAgentIds.has(id));

  return (
    <Card className="min-w-0 overflow-hidden border-emerald-200 bg-white/85 shadow-sm dark:border-emerald-500/20 dark:bg-slate-950/75">
      <CardHeader className="pb-3">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-zinc-950 dark:text-white">
              <CalendarDays className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
              Evidence Command Map
            </CardTitle>
            <CardDescription className="mt-1 text-zinc-500 dark:text-slate-400">
              Source readiness, duplicate consolidation, timelines, gaps, and
              quote support before the legal engine starts swinging.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/sector/corpus">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-2 border-zinc-200 bg-white dark:border-white/10 dark:bg-white/5"
              >
                <GitBranch className="h-4 w-4" />
                Master Records
              </Button>
            </Link>
            <Link href="/violations">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-2 border-zinc-200 bg-white dark:border-white/10 dark:bg-white/5"
              >
                <ExternalLink className="h-4 w-4" />
                Violations
              </Button>
            </Link>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            icon={CheckCircle2}
            label="Ready records"
            value={`${readyDocs.length}/${documents.length}`}
            detail={
              blockedDocs.length > 0
                ? `${blockedDocs.length} blocked from agent use`
                : "No intake blockers detected"
            }
            tone="text-emerald-600 dark:text-emerald-300"
          />
          <StatTile
            icon={AlertTriangle}
            label="Gap signals"
            value={missingCount}
            detail="missing or suspicious absences"
            tone="text-amber-600 dark:text-amber-300"
          />
          <StatTile
            icon={ListChecks}
            label="Conflicts"
            value={contradictionCount + adverseCount}
            detail={`${contradictionCount} contradictions; ${adverseCount} adverse facts`}
            tone="text-rose-600 dark:text-rose-300"
          />
          <StatTile
            icon={ShieldCheck}
            label="Source support"
            value={`${anchoredFindingCount}/${visibleFindings.length}`}
            detail={
              unanchoredFindingCount > 0
                ? `${unanchoredFindingCount} findings need anchors`
                : "all loaded findings have anchors"
            }
            tone="text-blue-600 dark:text-blue-300"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setScope("all");
              setAgentSelection(timelineAgents);
            }}
            className="min-h-11 border-emerald-500/30 bg-emerald-500/10 text-emerald-800 hover:bg-emerald-500/15 dark:text-emerald-100"
          >
            Build whole-case timeline
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setScope("time");
              setAgentSelection(contradictionAgents);
            }}
            className="min-h-11 border-zinc-200 bg-white hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
          >
            Review a specific era
          </Button>
        </div>

        {(blockedDocs.length > 0 || unanchoredFindingCount > 0) && (
          <Alert className="border-amber-500/40 bg-amber-50 text-amber-950 dark:bg-amber-950/25 dark:text-amber-100">
            <FileWarning className="h-4 w-4" />
            <AlertTitle>Evidence problems are still in the lane.</AlertTitle>
            <AlertDescription>
              {blockedDocs.length > 0
                ? `${blockedDocs.length} file${blockedDocs.length === 1 ? "" : "s"} cannot be analyzed until extraction/source anchoring is fixed. `
                : ""}
              {unanchoredFindingCount > 0
                ? `${unanchoredFindingCount} finding${unanchoredFindingCount === 1 ? "" : "s"} lack source anchors and should not be treated as court-ready.`
                : ""}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]">
          <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-slate-500">
                Record timeline
              </div>
              <Badge className="bg-emerald-600 text-white">
                {timelineDocs.length} records
              </Badge>
            </div>
            <div className="max-h-[28rem] space-y-3 overflow-auto pr-1">
              {timelineDocs.length === 0 && (
                <p className="text-sm text-zinc-500 dark:text-slate-400">
                  No uploaded records found yet.
                </p>
              )}
              {timelineDocs.slice(0, 14).map((document, index) => {
                const linkedFindings =
                  findingsByDocument.get(document.id) ?? [];
                return (
                  <div
                    key={document.id}
                    className="grid min-w-0 grid-cols-[1.5rem_minmax(0,1fr)] gap-3"
                  >
                    <div className="flex flex-col items-center">
                      <span
                        className={cn(
                          "h-2.5 w-2.5 rounded-full",
                          isAnalysisReady(document)
                            ? "bg-emerald-500"
                            : "bg-amber-500"
                        )}
                      />
                      {index < Math.min(timelineDocs.length, 14) - 1 && (
                        <span className="mt-1 h-full min-h-6 w-px bg-zinc-200 dark:bg-white/10" />
                      )}
                    </div>
                    <div className="min-w-0 rounded-md border border-zinc-200 bg-white p-3 dark:border-white/10 dark:bg-slate-950/60">
                      <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs text-zinc-500 dark:text-slate-500">
                            {formatShortDate(document.createdAt)}
                          </div>
                          <div className="truncate text-sm font-medium text-zinc-950 dark:text-white">
                            {document.fileName}
                          </div>
                        </div>
                        <Badge
                          className={cn(
                            "shrink-0 border",
                            isAnalysisReady(document)
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
                              : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200"
                          )}
                        >
                          {isAnalysisReady(document) ? "ready" : "blocked"}
                        </Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-500 dark:text-slate-500">
                        <span>OCR {qualityScore(document)}</span>
                        <span>
                          {extractedLength(document).toLocaleString()} chars
                        </span>
                        <span>
                          {sourceAnchored(document)
                            ? "source anchored"
                            : "missing source hash"}
                        </span>
                        <span>{linkedFindings.length} linked findings</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {timelineDocs.length > 14 && (
                <p className="text-xs text-zinc-500 dark:text-slate-500">
                  Showing the first 14 records. Use Corpus for the full master
                  record map.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-md border border-zinc-200 bg-white p-3 dark:border-white/10 dark:bg-white/[0.03]">
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-slate-500">
                <GitBranch className="h-4 w-4" />
                Duplicate consolidation
              </div>
              {duplicateGroups.length === 0 ? (
                <p className="text-sm leading-6 text-zinc-600 dark:text-slate-400">
                  No exact hash duplicate groups are visible in this scope.
                  Candidate duplicates still belong in Corpus master records.
                </p>
              ) : (
                <div className="space-y-2">
                  {duplicateGroups.map(([hash, group]) => (
                    <div
                      key={hash}
                      className="rounded-md border border-zinc-200 bg-zinc-50 p-2 dark:border-white/10 dark:bg-slate-950/60"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-zinc-700 dark:text-slate-200">
                          {group.length} exact copies
                        </span>
                        <span className="font-mono text-[0.68rem] text-zinc-500 dark:text-slate-500">
                          {hash.slice(0, 10)}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-xs text-zinc-500 dark:text-slate-400">
                        Canonical candidate: {group[0]?.fileName}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-md border border-zinc-200 bg-white p-3 dark:border-white/10 dark:bg-white/[0.03]">
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-slate-500">
                <FileWarning className="h-4 w-4" />
                Gap demand queue
              </div>
              {missingRecordQueue.length === 0 ? (
                <p className="text-sm leading-6 text-zinc-600 dark:text-slate-400">
                  No saved missing-record demands yet. Run the Missing Records
                  Hunt to turn gaps into discovery language.
                </p>
              ) : (
                <div className="space-y-2">
                  {missingRecordQueue.map(([record, count]) => (
                    <div
                      key={record}
                      className="flex min-w-0 items-start justify-between gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-2 dark:border-white/10 dark:bg-slate-950/60"
                    >
                      <p className="min-w-0 break-words text-xs leading-5 text-zinc-700 dark:text-slate-200">
                        {record}
                      </p>
                      <Badge className="shrink-0 bg-amber-600 text-white">
                        {count}
                      </Badge>
                    </div>
                  ))}
                  <Link href="/reports#draft-command">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="mt-1 w-full gap-2 border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-100"
                    >
                      Build demand packet
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-white/[0.03]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-slate-500">
              Source support board
            </div>
            <span className="text-xs text-zinc-500 dark:text-slate-500">
              Which files actually carry the findings
            </span>
          </div>
          <div className="grid gap-2 lg:grid-cols-2">
            {documentSupportRows.length === 0 && (
              <p className="text-sm text-zinc-500 dark:text-slate-400">
                Upload and process records before the support board can map
                findings to files.
              </p>
            )}
            {documentSupportRows.slice(0, 8).map(row => (
              <div
                key={row.document.id}
                className="min-w-0 rounded-md border border-zinc-200 bg-white p-3 dark:border-white/10 dark:bg-slate-950/60"
              >
                <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-950 dark:text-white">
                      {row.document.fileName}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-slate-500">
                      {formatShortDate(row.document.createdAt)} · OCR{" "}
                      {qualityScore(row.document)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-1">
                    <Badge className="bg-blue-600 text-white">
                      {row.findings.length} findings
                    </Badge>
                    {row.missingCount > 0 && (
                      <Badge className="bg-amber-600 text-white">
                        {row.missingCount} gaps
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <FindingMini
                    label="Anchors"
                    value={String(row.anchorCount)}
                  />
                  <FindingMini
                    label="Status"
                    value={
                      isAnalysisReady(row.document)
                        ? "Ready"
                        : documentBlocker(row.document)
                    }
                  />
                  <FindingMini
                    label="Hash"
                    value={
                      row.document.documentHash
                        ? row.document.documentHash.slice(0, 12)
                        : "Missing"
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LegalStrategyPanel({
  visibleFindings,
  setAgentSelection,
  availableAgentIds,
}: {
  visibleFindings: FindingCardData[];
  setAgentSelection: (agentIds: string[]) => void;
  availableAgentIds: Set<string>;
}) {
  const legalAuthorities = rankCounts(
    visibleFindings.flatMap(finding => finding.legalAuthorities ?? [])
  );
  const remedyPaths = rankCounts(
    visibleFindings.map(finding => finding.remedyPath || "")
  );
  const immunityRisk = visibleFindings.filter(
    finding =>
      (finding.liabilityVector || "").toLowerCase().includes("immunity") ||
      (finding.summary || "").toLowerCase().includes("immunity")
  ).length;
  const monellAgents = [
    "monell_pattern_mapper",
    "liability_remedy_ranker",
    "civil_rights_expert",
    "pattern_recognition_engine",
    "discovery_tactician",
    "qc_auditor",
  ].filter(id => availableAgentIds.has(id));
  const immunityAgents = [
    "immunity_piercer",
    "monell_pattern_mapper",
    "civil_rights_expert",
    "precedent_miner",
    "qc_auditor",
  ].filter(id => availableAgentIds.has(id));

  return (
    <Card className="min-w-0 overflow-hidden border-violet-200 bg-white/85 shadow-sm dark:border-violet-500/20 dark:bg-slate-950/75">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-zinc-950 dark:text-white">
          <Scale className="h-5 w-5 text-violet-700 dark:text-violet-300" />
          Legal Theory Board
        </CardTitle>
        <CardDescription className="text-zinc-500 dark:text-slate-400">
          Legal Analysis turns proof into claims, remedies, defenses, and
          court-safe next moves.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <StatTile
            icon={Scale}
            label="Remedy paths"
            value={remedyPaths.length}
            detail="from structured findings"
            tone="text-violet-600 dark:text-violet-300"
          />
          <StatTile
            icon={ShieldCheck}
            label="Authority hooks"
            value={legalAuthorities.length}
            detail="statutes, cases, canons"
            tone="text-blue-600 dark:text-blue-300"
          />
          <StatTile
            icon={AlertTriangle}
            label="Immunity risk"
            value={immunityRisk}
            detail="items needing careful framing"
            tone="text-amber-600 dark:text-amber-300"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setAgentSelection(monellAgents)}
            className="min-h-11 border-violet-500/30 bg-violet-500/10 text-violet-800 hover:bg-violet-500/15 dark:text-violet-100"
          >
            Map Monell / systemic liability
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setAgentSelection(immunityAgents)}
            className="min-h-11 border-zinc-200 bg-white hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
          >
            Build immunity-safe route
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <FindingMini
            label="Top remedy paths"
            value={
              remedyPaths.length > 0
                ? remedyPaths
                    .map(([label, count]) => `${label} (${count})`)
                    .join("; ")
                : "No remedy paths stored yet. Run a legal workflow to create them."
            }
          />
          <FindingMini
            label="Top authorities"
            value={
              legalAuthorities.length > 0
                ? legalAuthorities
                    .map(([label, count]) => `${label} (${count})`)
                    .join("; ")
                : "No authority hooks stored yet."
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}

export function GuidedAnalysisWorkspace({
  sector,
  title,
  eyebrow,
  accent,
}: GuidedAnalysisWorkspaceProps) {
  const styles = accentTokens[accent];
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [scope, setScope] = useState<AnalysisScope>("all");
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<number[]>([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [showRawOutput, setShowRawOutput] = useState(false);
  const utils = trpc.useUtils();

  const documentsQuery = trpc.documents.list.useQuery();
  const savedRunsQuery = trpc.agents.listSavedRuns.useQuery();
  const savedFindingsQuery = trpc.agents.listFindings.useQuery();
  const catalogQuery = trpc.agents.catalog.useQuery(undefined, {
    enabled: isAdmin,
    retry: false,
  });

  const processScope = trpc.agents.processScope.useMutation({
    onSuccess: data => {
      toast.success(
        `Analysis complete: ${data.completedAgents}/${data.totalAgents} agents finished.`
      );
      utils.agents.listSavedRuns.invalidate();
      utils.agents.listFindings.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const deleteOutput = trpc.agents.deleteOutput.useMutation({
    onSuccess: () => {
      toast.success("Saved output deleted");
      utils.agents.listSavedRuns.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const deleteSavedRuns = trpc.agents.deleteSavedRuns.useMutation({
    onSuccess: () => {
      toast.success("Saved agent runs cleared");
      utils.agents.listSavedRuns.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const documents: CorpusDocument[] = documentsQuery.data ?? [];
  const readyDocuments = documents.filter(isAnalysisReady);
  const blockedDocuments = documents.filter(
    document => !isAnalysisReady(document)
  );
  const catalogAgents: CatalogAgent[] = catalogQuery.data?.agents ?? [];
  const superAgents: SuperAgent[] = catalogQuery.data?.superAgents ?? [];
  const savedRuns = savedRunsQuery.data ?? [];
  const savedFindings: FindingCardData[] = (savedFindingsQuery.data ?? []).map(
    normalizeFindingCardData
  );
  const currentFindings: FindingCardData[] = (
    processScope.data?.results ?? []
  ).flatMap(result => {
    if (!("findings" in result)) return [];
    return (result.findings ?? []).filter(isFindingCardDataInput).map(finding =>
      normalizeFindingCardData({
        ...finding,
        agentName: result.agentName,
      })
    );
  });
  const visibleFindings =
    currentFindings.length > 0 ? currentFindings : savedFindings;
  const recommendations = useMemo(
    () => buildRecommendations(sector, scope),
    [scope, sector]
  );
  const availableAgentIds = useMemo(
    () => new Set(catalogAgents.map(agent => agent.id)),
    [catalogAgents]
  );
  const isEvidenceWorkspace = sector === "evidence";
  const isLegalWorkspace = sector === "legal";
  const workspaceNoun = isEvidenceWorkspace
    ? "Record Lab"
    : isLegalWorkspace
      ? "Legal War Room"
      : "Analysis Workspace";
  const boardTitle = isEvidenceWorkspace
    ? "Evidence Board"
    : isLegalWorkspace
      ? "Legal Strategy Board"
      : "Intelligence Board";
  const boardDescription = isEvidenceWorkspace
    ? "Chronology, contradictions, missing records, adverse facts, and source support."
    : isLegalWorkspace
      ? "Claims ranked by leverage, confidence, remedy path, immunity posture, and QC status."
      : "Findings ranked by leverage, confidence, and QC posture.";

  useEffect(() => {
    if (!isAdmin || selectedAgentIds.length > 0 || catalogAgents.length === 0)
      return;
    setSelectedAgentIds(
      recommendations[0]?.agentIds.filter(agentId =>
        availableAgentIds.has(agentId)
      ) ?? []
    );
  }, [
    availableAgentIds,
    catalogAgents.length,
    isAdmin,
    recommendations,
    selectedAgentIds.length,
  ]);

  const agentsByDivision = useMemo(() => {
    return catalogAgents.reduce<Record<AgentDivision, CatalogAgent[]>>(
      (groups, agent) => {
        groups[agent.division].push(agent);
        return groups;
      },
      { research: [], analysis: [], tactical: [], evidence: [], offensive: [] }
    );
  }, [catalogAgents]);

  const selectedWorkflow = recommendations.find(recommendation => {
    const usableIds = recommendation.agentIds.filter(agentId =>
      availableAgentIds.has(agentId)
    );
    return (
      usableIds.length > 0 &&
      usableIds.every(agentId => selectedAgentIds.includes(agentId)) &&
      selectedAgentIds.length === usableIds.length
    );
  });

  const timeScopedReadyDocuments = readyDocuments.filter(document =>
    inDateScope(document, fromDate, toDate)
  );
  const timeScopedBlockedDocuments = blockedDocuments.filter(document =>
    inDateScope(document, fromDate, toDate)
  );
  const matchingDocumentCount =
    scope === "file"
      ? selectedDocumentIds.length
      : scope === "time"
        ? timeScopedReadyDocuments.length
        : readyDocuments.length;
  const needsProofCount = savedFindings.filter(finding =>
    ["pending", "needs_more_proof", "blocked"].includes(finding.qcStatus || "")
  ).length;
  const topLiabilityVectors = rankCounts(
    savedFindings.map(finding => finding.liabilityVector || "")
  );
  const topMissingRecords = rankCounts(
    savedFindings.flatMap(finding => finding.missingRecords ?? [])
  );
  const highRiskFindings = visibleFindings
    .filter(
      finding => finding.leverageScore >= 80 || finding.severity === "critical"
    )
    .slice(0, 4);
  const failedAgentResults =
    processScope.data?.results.filter(result => result.status === "failed") ??
    [];
  const readyPercent =
    documents.length === 0
      ? 0
      : Math.round((readyDocuments.length / documents.length) * 100);

  const runDisabledReason =
    documentsQuery.isLoading ||
    savedRunsQuery.isLoading ||
    savedFindingsQuery.isLoading
      ? "Loading backend state..."
      : documents.length === 0
        ? "No Corpus records exist yet. Upload something before running agents."
        : readyDocuments.length === 0
          ? "No files are analysis-ready. Fix extraction first."
          : scope === "all" && blockedDocuments.length > 0
            ? "Whole-case analysis is blocked until every Corpus file is processed. Use Selected files if you want to run only ready records."
            : scope === "file" && selectedDocumentIds.length === 0
              ? "Selected-files scope needs at least one ready file checked."
              : scope === "time" && !fromDate && !toDate
                ? "Case-era scope needs a start date, end date, or both."
                : scope === "time" && timeScopedBlockedDocuments.length > 0
                  ? "This date range includes unprocessed files. Narrow it or fix Corpus extraction."
                  : scope === "time" && timeScopedReadyDocuments.length === 0
                    ? "No ready files match that date range."
                    : isAdmin && catalogQuery.error
                      ? "Admin agent catalog failed to load. Presets can still show, but custom agent selection is broken."
                      : isAdmin && selectedAgentIds.length === 0
                        ? "Choose a workflow or at least one agent."
                        : null;

  const loudIssues = [
    documentsQuery.error && {
      id: "documents-query",
      title: "Corpus API is not answering cleanly",
      detail: errorMessage(documentsQuery.error),
      severity: "critical" as const,
      actionHref: "/sector/corpus",
      actionLabel: "Open Corpus",
    },
    savedRunsQuery.error && {
      id: "saved-runs-query",
      title: "Saved run history failed to load",
      detail: errorMessage(savedRunsQuery.error),
      severity: "warning" as const,
      actionHref: "/settings",
      actionLabel: "Check Settings",
    },
    savedFindingsQuery.error && {
      id: "saved-findings-query",
      title: "Structured findings failed to load",
      detail: errorMessage(savedFindingsQuery.error),
      severity: "warning" as const,
      actionHref: "/reports",
      actionLabel: "Open Reports",
    },
    isAdmin &&
      catalogQuery.error && {
        id: "agent-catalog-query",
        title: "Admin agent catalog failed",
        detail: errorMessage(catalogQuery.error),
        severity: "warning" as const,
        actionHref: "/settings",
        actionLabel: "Check Settings",
      },
    processScope.error && {
      id: "process-scope-error",
      title: "Latest analysis run failed",
      detail: errorMessage(processScope.error),
      severity: "critical" as const,
      actionHref: "/sector/corpus",
      actionLabel: "Check Corpus",
    },
    blockedDocuments.length > 0 && {
      id: "blocked-documents",
      title: `${blockedDocuments.length} Corpus file${blockedDocuments.length === 1 ? "" : "s"} cannot be used by agents`,
      detail: blockedDocuments
        .slice(0, 4)
        .map(document => `${document.fileName}: ${documentBlocker(document)}`)
        .join("; "),
      severity: scope === "all" ? ("critical" as const) : ("warning" as const),
      actionHref: "/sector/corpus",
      actionLabel: "Fix Files",
    },
    failedAgentResults.length > 0 && {
      id: "failed-agent-results",
      title: `${failedAgentResults.length} agent${failedAgentResults.length === 1 ? "" : "s"} failed in the latest run`,
      detail: failedAgentResults
        .slice(0, 3)
        .map(
          result =>
            `${result.agentName}: ${"error" in result ? result.error : "unknown failure"}`
        )
        .join("; "),
      severity: "critical" as const,
      actionHref: "/settings",
      actionLabel: "Check API/Usage",
    },
    needsProofCount > 0 && {
      id: "needs-proof-findings",
      title: `${needsProofCount} finding${needsProofCount === 1 ? "" : "s"} are not court-ready`,
      detail:
        "Pending, blocked, or needs-more-proof findings should stay out of reports unless you intentionally override them.",
      severity: "info" as const,
      actionHref: "/reports",
      actionLabel: "Review Reports",
    },
  ].filter(Boolean) as Array<{
    id: string;
    title: string;
    detail: string;
    severity: "critical" | "warning" | "info";
    actionHref?: string;
    actionLabel?: string;
  }>;

  const resolveAgentIds = (agentIds: string[]) =>
    availableAgentIds.size > 0
      ? agentIds.filter(agentId => availableAgentIds.has(agentId))
      : agentIds;
  const setAgentSelection = (agentIds: string[]) =>
    setSelectedAgentIds(resolveAgentIds(agentIds));
  const toggleAgent = (agentId: string) => {
    setSelectedAgentIds(current =>
      current.includes(agentId)
        ? current.filter(id => id !== agentId)
        : [...current, agentId]
    );
  };
  const toggleDocument = (documentId: number) => {
    setSelectedCaseId(null);
    setSelectedDocumentIds(current =>
      current.includes(documentId)
        ? current.filter(id => id !== documentId)
        : [...current, documentId]
    );
  };

  const runAnalysis = () => {
    if (documents.length === 0) {
      toast.error(
        "Upload at least one record in Corpus before running analysis."
      );
      return;
    }
    if (scope === "all" && blockedDocuments.length > 0) {
      toast.error(
        "Wait until every Corpus file is processed, or choose only ready files with Selected files."
      );
      return;
    }
    if (scope === "time" && timeScopedBlockedDocuments.length > 0) {
      toast.error(
        "The selected date range includes files that need extraction review. Narrow the range or fix those files first."
      );
      return;
    }
    if (scope === "time" && timeScopedReadyDocuments.length === 0) {
      toast.error("No ready files match that date range.");
      return;
    }
    if (scope === "file" && selectedDocumentIds.length === 0) {
      toast.error("Choose one or more files for this run.");
      return;
    }
    if (scope === "time" && !fromDate && !toDate) {
      toast.error("Choose a start date, end date, or both.");
      return;
    }
    if (isAdmin && selectedAgentIds.length === 0) {
      toast.error("Choose at least one workflow or agent.");
      return;
    }

    processScope.mutate({
      sector,
      scope,
      caseId:
        scope === "file" && selectedCaseId !== null
          ? selectedCaseId
          : undefined,
      documentIds: scope === "file" ? selectedDocumentIds : undefined,
      agentIds: isAdmin ? selectedAgentIds : undefined,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
    });
  };
  const applyActiveCaseDocuments = (
    documentIds: number[],
    caseId: number | null
  ) => {
    const readyIds = new Set(readyDocuments.map(document => document.id));
    const usableDocumentIds = documentIds.filter(documentId =>
      readyIds.has(documentId)
    );
    if (usableDocumentIds.length === 0) {
      toast.error(
        "This case has no analysis-ready files yet. Fix OCR or assign processed files first."
      );
      return;
    }
    setScope("file");
    setSelectedCaseId(caseId);
    setSelectedDocumentIds(usableDocumentIds);
    toast.success(
      `Scoped this run to ${usableDocumentIds.length} ready case file${usableDocumentIds.length === 1 ? "" : "s"}.`
    );
  };

  return (
    <CommandSurface>
      <CommandTopBar
        title={title}
        eyebrow={eyebrow}
        actions={
          <>
            {isAdmin && (
              <Badge className="hidden border-0 bg-emerald-600 text-white sm:inline-flex">
                Admin
              </Badge>
            )}
          </>
        }
      />

      <CommandMain className="space-y-4">
        <WorkspaceCaseStrip
          onUseDocuments={applyActiveCaseDocuments}
          useDocumentsLabel="Use case files"
        />
        <CommandWorkflowBar />

        <LoudStatusPanel
          issues={loudIssues}
          readyPercent={readyPercent}
          readyDocuments={readyDocuments}
          blockedDocuments={blockedDocuments}
          selectedDocumentIds={selectedDocumentIds}
          matchingDocumentCount={matchingDocumentCount}
          runDisabledReason={runDisabledReason}
          setScope={setScope}
          setSelectedDocumentIds={setSelectedDocumentIds}
        />

        <section className="grid min-w-0 gap-4 lg:grid-cols-[minmax(18rem,0.82fr)_minmax(0,1.18fr)]">
          <div className="min-w-0 space-y-4">
            <Card
              id="plan"
              className="scroll-mt-28 min-w-0 overflow-hidden border-zinc-200 bg-white/80 shadow-sm dark:border-white/10 dark:bg-slate-950/75"
            >
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-zinc-950 dark:text-white">
                  <Target className={cn("h-5 w-5", styles.accentText)} />
                  {isEvidenceWorkspace
                    ? "Record Plan"
                    : isLegalWorkspace
                      ? "Claim Plan"
                      : "Attack Plan"}
                </CardTitle>
                <CardDescription className="text-zinc-500 dark:text-slate-400">
                  {isEvidenceWorkspace
                    ? "Pick the evidence job: timeline, contradiction, missing-record hunt, or readiness gate."
                    : isLegalWorkspace
                      ? "Pick the legal job: liability, Monell, immunity, procedure, or motion packet."
                      : "Pick the job. Admin can override the agent stack."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {recommendations.map(recommendation => {
                  const usableIds = resolveAgentIds(recommendation.agentIds);
                  const guide = workflowGuides[recommendation.id];
                  const active =
                    usableIds.length > 0 &&
                    usableIds.every(agentId =>
                      selectedAgentIds.includes(agentId)
                    ) &&
                    selectedAgentIds.length === usableIds.length;
                  return (
                    <button
                      key={recommendation.id}
                      type="button"
                      onClick={() => setAgentSelection(usableIds)}
                      className={cn(
                        "min-w-0 w-full rounded-md border p-3 text-left transition",
                        active
                          ? styles.active
                          : "border-zinc-200 bg-white hover:bg-zinc-50 dark:border-white/10 dark:bg-white/[0.035] dark:hover:bg-white/[0.07]"
                      )}
                    >
                      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0 break-words font-medium text-zinc-950 dark:text-white">
                          {recommendation.name}
                        </div>
                        <Badge className="shrink-0 bg-zinc-100 text-zinc-700 dark:bg-white/10 dark:text-slate-200">
                          {usableIds.length} agents
                        </Badge>
                      </div>
                      <p className="mt-1 break-words text-xs leading-5 text-zinc-500 dark:text-slate-400">
                        {recommendation.reason}
                      </p>
                      {guide && active && (
                        <p className="mt-2 break-words text-xs leading-5 text-zinc-600 dark:text-slate-300">
                          <span className="font-semibold">Best for:</span>{" "}
                          {guide.bestFor}{" "}
                          <span className="font-semibold">Feeds:</span>{" "}
                          {guide.feeds}
                        </p>
                      )}
                    </button>
                  );
                })}
              </CardContent>
            </Card>

            {selectedWorkflow?.id === "mandamus_writ" && (
              <Card className="min-w-0 overflow-hidden border-orange-500/35 bg-orange-50/80 shadow-sm dark:border-orange-500/25 dark:bg-orange-950/20">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-zinc-950 dark:text-white">
                    <Scale className="h-5 w-5 text-orange-700 dark:text-orange-300" />
                    Mandamus Skill Gate
                  </CardTitle>
                  <CardDescription className="text-zinc-600 dark:text-slate-300">
                    This workflow is for narrow extraordinary relief, not for
                    turning every bad ruling into an emergency writ.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2 sm:grid-cols-2">
                    {mandamusSkillGates.map(gate => (
                      <div
                        key={gate.label}
                        className="rounded-md border border-orange-500/20 bg-white/80 p-3 dark:border-orange-400/20 dark:bg-black/20"
                      >
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-700 dark:text-orange-300">
                          {gate.label}
                        </p>
                        <p className="mt-1 text-sm leading-5 text-zinc-700 dark:text-slate-200">
                          {gate.detail}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-md border border-zinc-200 bg-white/85 p-3 dark:border-white/10 dark:bg-slate-950/70">
                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-slate-500">
                      <ListChecks className="h-4 w-4" />
                      Required route labels
                    </div>
                    <div className="grid gap-2">
                      {mandamusSkillRoutes.map(route => (
                        <div
                          key={route.label}
                          className="grid gap-1 rounded-md border border-zinc-200 bg-zinc-50 p-2 dark:border-white/10 dark:bg-white/[0.035] sm:grid-cols-[10rem_minmax(0,1fr)]"
                        >
                          <Badge className="w-fit bg-orange-600 text-white">
                            {route.label}
                          </Badge>
                          <p className="text-sm leading-5 text-zinc-700 dark:text-slate-300">
                            {route.detail}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-2 lg:grid-cols-3">
                    {mandamusSkillOutputs.map(output => (
                      <div
                        key={output.label}
                        className="rounded-md border border-zinc-200 bg-white/85 p-3 dark:border-white/10 dark:bg-slate-950/70"
                      >
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-slate-500">
                          {output.label}
                        </p>
                        <p className="mt-1 text-sm leading-5 text-zinc-700 dark:text-slate-300">
                          {output.detail}
                        </p>
                      </div>
                    ))}
                  </div>

                  <Alert className="border-amber-500/40 bg-amber-50 text-amber-950 dark:bg-amber-950/25 dark:text-amber-100">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>
                      Mandamus is a gate, not a magic wand.
                    </AlertTitle>
                    <AlertDescription>
                      The report should say whether to file now, demand records
                      first, preserve for appeal, or drop the writ route. If the
                      record lacks the duty/refusal proof, the safe output is a
                      records demand, not an accusation.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            )}

            <Card
              id="scope"
              className="scroll-mt-28 min-w-0 overflow-hidden border-zinc-200 bg-white/80 shadow-sm dark:border-white/10 dark:bg-slate-950/75"
            >
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-zinc-950 dark:text-white">
                  <Layers3 className={cn("h-5 w-5", styles.accentText)} />
                  {isEvidenceWorkspace ? "Record Scope" : "Evidence Scope"}
                </CardTitle>
                <CardDescription className="text-zinc-500 dark:text-slate-400">
                  {matchingDocumentCount} record
                  {matchingDocumentCount === 1 ? "" : "s"} selected for this
                  run.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-3">
                  {scopeOptions.map(option => {
                    const Icon = option.icon;
                    const active = scope === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setScope(option.id)}
                        className={cn(
                          "min-w-0 rounded-md border p-3 text-left transition",
                          active
                            ? styles.active
                            : "border-zinc-200 bg-white hover:bg-zinc-50 dark:border-white/10 dark:bg-white/[0.035] dark:hover:bg-white/[0.07]"
                        )}
                      >
                        <Icon
                          className={cn(
                            "mb-2 h-4 w-4",
                            active
                              ? styles.accentText
                              : "text-zinc-400 dark:text-slate-500"
                          )}
                        />
                        <div className="break-words text-sm font-medium text-zinc-950 dark:text-white">
                          {option.label}
                        </div>
                        <p className="mt-1 break-words text-xs leading-5 text-zinc-500 dark:text-slate-400">
                          {option.description}
                        </p>
                      </button>
                    );
                  })}
                </div>

                {scope === "file" && (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium text-zinc-700 dark:text-slate-200">
                        Files
                      </span>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedCaseId(null);
                            setSelectedDocumentIds(
                              readyDocuments.map(document => document.id)
                            );
                          }}
                          className="h-8 border-zinc-200 bg-white dark:border-white/10 dark:bg-white/5"
                        >
                          Ready
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedCaseId(null);
                            setSelectedDocumentIds([]);
                          }}
                          className="h-8 border-zinc-200 bg-white dark:border-white/10 dark:bg-white/5"
                        >
                          Clear
                        </Button>
                      </div>
                    </div>
                    <div className="max-h-72 space-y-2 overflow-auto rounded-md border border-zinc-200 bg-zinc-50 p-2 dark:border-white/10 dark:bg-slate-950/80">
                      {documents.map(document => {
                        const ready = isAnalysisReady(document);
                        const checked = selectedDocumentIds.includes(
                          document.id
                        );
                        return (
                          <label
                            key={document.id}
                            className={cn(
                              "flex min-w-0 gap-3 rounded-md border p-3",
                              ready
                                ? "cursor-pointer"
                                : "cursor-not-allowed opacity-55",
                              checked
                                ? styles.active
                                : "border-zinc-200 bg-white dark:border-white/10 dark:bg-white/[0.03]"
                            )}
                          >
                            <Checkbox
                              checked={checked}
                              disabled={!ready}
                              onCheckedChange={() =>
                                ready && toggleDocument(document.id)
                              }
                              className="mt-1"
                            />
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium text-zinc-950 dark:text-white">
                                {document.fileName}
                              </span>
                              <span className="text-xs text-zinc-500 dark:text-slate-500">
                                {document.mimeType || "unknown"} ·{" "}
                                {ready
                                  ? "ready"
                                  : sourceAnchored(document)
                                    ? document.status
                                    : "missing source hash"}{" "}
                                · OCR {qualityScore(document)}
                              </span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {scope === "time" && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label
                        className="text-sm font-medium text-zinc-700 dark:text-slate-200"
                        htmlFor="from-date"
                      >
                        From
                      </label>
                      <Input
                        id="from-date"
                        type="date"
                        value={fromDate}
                        onChange={event => setFromDate(event.target.value)}
                        className="border-zinc-200 bg-white dark:border-white/10 dark:bg-slate-950"
                      />
                    </div>
                    <div className="space-y-2">
                      <label
                        className="text-sm font-medium text-zinc-700 dark:text-slate-200"
                        htmlFor="to-date"
                      >
                        To
                      </label>
                      <Input
                        id="to-date"
                        type="date"
                        value={toDate}
                        onChange={event => setToDate(event.target.value)}
                        className="border-zinc-200 bg-white dark:border-white/10 dark:bg-slate-950"
                      />
                    </div>
                  </div>
                )}

                <Button
                  onClick={runAnalysis}
                  disabled={
                    processScope.isPending ||
                    documentsQuery.isLoading ||
                    catalogQuery.isLoading ||
                    readyDocuments.length === 0 ||
                    (scope === "all" && blockedDocuments.length > 0) ||
                    (scope === "time" &&
                      (timeScopedBlockedDocuments.length > 0 ||
                        timeScopedReadyDocuments.length === 0))
                  }
                  className={cn(
                    "min-h-12 h-auto w-full gap-2 whitespace-normal px-3 py-3 text-sm sm:text-base",
                    styles.button
                  )}
                >
                  {processScope.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Running{" "}
                      {workspaceNoun}
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" /> Run{" "}
                      {selectedWorkflow?.name || title}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {isAdmin && (
              <details
                id="agents"
                className="group scroll-mt-28 overflow-hidden rounded-md border border-zinc-200 bg-white/76 shadow-sm dark:border-white/10 dark:bg-slate-950/72"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 text-zinc-950 outline-none transition hover:bg-zinc-50 dark:text-white dark:hover:bg-white/[0.04] [&::-webkit-details-marker]:hidden">
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200">
                      <Brain className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">
                        Advanced agent stack
                      </span>
                      <span className="block truncate text-xs text-zinc-500 dark:text-slate-400">
                        Admin-only overrides. Presets above are the normal path.
                      </span>
                    </span>
                  </span>
                  <Badge className="shrink-0 border border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-200">
                    {selectedAgentIds.length} selected
                  </Badge>
                </summary>
                <Card className="min-w-0 overflow-hidden rounded-none border-x-0 border-b-0 border-t border-zinc-200 bg-transparent shadow-none dark:border-white/10">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-zinc-950 dark:text-white">
                      Agent Stack
                    </CardTitle>
                    <CardDescription className="text-zinc-500 dark:text-slate-400">
                      Use this only when the preset workflow is not enough.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {superAgents.length > 0 && (
                      <div className="grid gap-2">
                        {superAgents.slice(0, 3).map(superAgent => {
                          const usableIds = superAgent.agentIds.filter(
                            agentId => availableAgentIds.has(agentId)
                          );
                          return (
                            <button
                              key={superAgent.id}
                              type="button"
                              onClick={() => setAgentSelection(usableIds)}
                              className="min-w-0 rounded-md border border-zinc-200 bg-white p-3 text-left hover:bg-zinc-50 dark:border-white/10 dark:bg-white/[0.035] dark:hover:bg-white/[0.07]"
                            >
                              <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                                <span className="min-w-0 break-words text-sm font-medium text-zinc-950 dark:text-white">
                                  {superAgent.name}
                                </span>
                                <span className="text-xs text-zinc-500 dark:text-slate-400">
                                  {usableIds.length}
                                </span>
                              </div>
                              <p className="mt-1 break-words text-xs leading-5 text-zinc-500 dark:text-slate-500">
                                {superAgent.description}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setAgentSelection(
                            catalogAgents.map(agent => agent.id)
                          )
                        }
                        className="border-zinc-200 bg-white dark:border-white/10 dark:bg-white/5"
                      >
                        All
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedAgentIds([])}
                        className="border-zinc-200 bg-white dark:border-white/10 dark:bg-white/5"
                      >
                        Clear
                      </Button>
                    </div>
                    <div className="max-h-[25rem] space-y-4 overflow-auto pr-1">
                      {(Object.keys(agentsByDivision) as AgentDivision[]).map(
                        division => {
                          const agents = agentsByDivision[division];
                          if (agents.length === 0) return null;
                          return (
                            <div key={division} className="space-y-2">
                              <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-slate-500">
                                {divisionLabels[division]}
                              </div>
                              {agents.map(agent => {
                                const checked = selectedAgentIds.includes(
                                  agent.id
                                );
                                return (
                                  <label
                                    key={agent.id}
                                    className={cn(
                                      "flex min-w-0 cursor-pointer gap-3 rounded-md border p-3",
                                      checked
                                        ? "border-emerald-500 bg-emerald-500/10"
                                        : "border-zinc-200 bg-white dark:border-white/10 dark:bg-white/[0.03]"
                                    )}
                                  >
                                    <Checkbox
                                      checked={checked}
                                      onCheckedChange={() =>
                                        toggleAgent(agent.id)
                                      }
                                      className="mt-1"
                                    />
                                    <span className="min-w-0">
                                      <span className="block break-words text-sm font-medium text-zinc-950 dark:text-white">
                                        {agent.name}
                                      </span>
                                      <span className="mt-1 block break-words text-xs leading-5 text-zinc-500 dark:text-slate-400">
                                        {agent.description}
                                      </span>
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          );
                        }
                      )}
                    </div>
                  </CardContent>
                </Card>
              </details>
            )}
          </div>

          <div className="min-w-0 space-y-5 sm:space-y-6">
            {isEvidenceWorkspace && (
              <EvidenceTimelinePanel
                documents={documents}
                visibleFindings={visibleFindings}
                setScope={setScope}
                setAgentSelection={setAgentSelection}
                availableAgentIds={availableAgentIds}
              />
            )}

            {isLegalWorkspace && (
              <LegalStrategyPanel
                visibleFindings={visibleFindings}
                setAgentSelection={setAgentSelection}
                availableAgentIds={availableAgentIds}
              />
            )}

            <BackendExposurePanel
              sector={sector}
              selectedAgentIds={selectedAgentIds}
              selectedDocumentIds={selectedDocumentIds}
              readyDocuments={readyDocuments}
              blockedDocuments={blockedDocuments}
              savedRunsCount={savedRuns.length}
              savedFindingsCount={savedFindings.length}
              currentRun={processScope.data}
            />

            <Card
              id="results"
              className="scroll-mt-28 min-w-0 overflow-hidden border-zinc-200 bg-white/80 shadow-sm dark:border-white/10 dark:bg-slate-950/75"
            >
              <CardHeader className="pb-3">
                <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="flex items-center gap-2 text-zinc-950 dark:text-white">
                      <Scale className={cn("h-5 w-5", styles.accentText)} />
                      {boardTitle}
                    </CardTitle>
                    <CardDescription className="text-zinc-500 dark:text-slate-400">
                      {boardDescription}
                    </CardDescription>
                  </div>
                  <Link href="/reports">
                    <Button
                      variant="outline"
                      className="border-zinc-200 bg-white dark:border-white/10 dark:bg-white/5"
                    >
                      {isEvidenceWorkspace ? "Send to reports" : "Build report"}
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {processScope.isPending && (
                  <div className="flex items-center gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
                    <Clock className={cn("h-4 w-4", styles.accentText)} />
                    {isEvidenceWorkspace
                      ? "Evidence agents are building the chronology, checking contradictions, and marking gaps before legal conclusions."
                      : "Agents are comparing the selected records and QC-checking risky findings."}
                  </div>
                )}

                {processScope.data?.usage && (
                  <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <StatTile
                      icon={CheckCircle2}
                      label="Run"
                      value={processScope.data.runId}
                      detail={`${processScope.data.completedAgents}/${processScope.data.totalAgents} agents`}
                      tone="text-emerald-600 dark:text-emerald-300"
                    />
                    <StatTile
                      icon={ListChecks}
                      label="Findings"
                      value={currentFindings.length}
                      detail={`${processScope.data.documentCount} records analyzed`}
                      tone="text-blue-600 dark:text-blue-300"
                    />
                    <StatTile
                      icon={Gauge}
                      label="Tokens"
                      value={processScope.data.usage.totalTokens}
                      detail={processScope.data.usage.model || "model recorded"}
                      tone="text-amber-600 dark:text-amber-300"
                    />
                    <StatTile
                      icon={Scale}
                      label="Cost"
                      value={`$${(processScope.data.usage.estimatedCostCents / 100).toFixed(4)}`}
                      detail="estimated"
                      tone="text-emerald-600 dark:text-emerald-300"
                    />
                  </div>
                )}

                {processScope.data?.synthesis && (
                  <div
                    className={cn(
                      "rounded-md border p-4",
                      styles.accent,
                      styles.accentSoft
                    )}
                  >
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-zinc-950 dark:text-white">
                      <Target className="h-4 w-4" />
                      War Room Synthesis
                    </div>
                    <div className="max-h-72 overflow-auto whitespace-pre-wrap text-sm leading-6 text-zinc-700 dark:text-slate-200">
                      {processScope.data.synthesis}
                    </div>
                  </div>
                )}

                {(topLiabilityVectors.length > 0 ||
                  topMissingRecords.length > 0) && (
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="min-w-0 rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                      <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-slate-500">
                        Top liability vectors
                      </div>
                      <div className="space-y-2">
                        {topLiabilityVectors.map(([label, count]) => (
                          <div
                            key={label}
                            className="flex min-w-0 items-center justify-between gap-3 text-sm"
                          >
                            <span className="min-w-0 truncate text-zinc-700 dark:text-slate-300">
                              {label}
                            </span>
                            <Badge className="bg-white text-zinc-700 dark:bg-white/10 dark:text-slate-200">
                              {count}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="min-w-0 rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                      <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-slate-500">
                        Most requested missing records
                      </div>
                      <div className="space-y-2">
                        {topMissingRecords.map(([label, count]) => (
                          <div
                            key={label}
                            className="flex min-w-0 items-center justify-between gap-3 text-sm"
                          >
                            <span className="min-w-0 truncate text-zinc-700 dark:text-slate-300">
                              {label}
                            </span>
                            <Badge className="bg-white text-zinc-700 dark:bg-white/10 dark:text-slate-200">
                              {count}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {visibleFindings.length === 0 && !processScope.isPending && (
                  <div className="rounded-md border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-white/15 dark:text-slate-400">
                    {isEvidenceWorkspace
                      ? "Run a timeline, contradiction, or missing-record pass to create source-bound evidence findings."
                      : "Run an analysis to create source-bound findings, QC status, confidence, leverage score, and report-ready next actions."}
                  </div>
                )}

                {highRiskFindings.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h2 className="break-words text-base font-semibold text-zinc-950 dark:text-white">
                        Highest-Leverage Findings
                      </h2>
                      <Badge
                        variant="outline"
                        className="border-zinc-200 bg-white text-zinc-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                      >
                        {visibleFindings.length} total
                      </Badge>
                    </div>
                    {highRiskFindings
                      .slice()
                      .sort(
                        (a, b) =>
                          b.leverageScore - a.leverageScore ||
                          b.confidence - a.confidence
                      )
                      .map((finding, index) => (
                        <FindingCard
                          key={`${finding.id || finding.title}-${index}`}
                          finding={finding}
                        />
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="min-w-0 overflow-hidden border-zinc-200 bg-white/80 shadow-sm dark:border-white/10 dark:bg-slate-950/75">
              <CardHeader className="pb-3">
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="text-zinc-950 dark:text-white">
                      Agent Output
                    </CardTitle>
                    <CardDescription className="text-zinc-500 dark:text-slate-400">
                      Raw transcripts are secondary; structured findings above
                      are what reports use.
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setShowRawOutput(value => !value)}
                    className="border-zinc-200 bg-white dark:border-white/10 dark:bg-white/5"
                  >
                    {showRawOutput ? "Hide raw" : "Show raw"}
                  </Button>
                </div>
              </CardHeader>
              {showRawOutput && (
                <CardContent className="space-y-4">
                  {processScope.data && (
                    <>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-600 dark:text-slate-300">
                        <Badge className={styles.button}>
                          {processScope.data.completedAgents}/
                          {processScope.data.totalAgents} complete
                        </Badge>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="w-full border-zinc-200 bg-white dark:border-white/10 dark:bg-white/5 sm:ml-auto sm:w-auto"
                          onClick={() => {
                            const output = processScope.data.results
                              .map(result =>
                                "output" in result
                                  ? `${result.agentName}\n\n${result.output ?? ""}`
                                  : `${result.agentName}\n\nFAILED: ${result.error}`
                              )
                              .join("\n\n==============================\n\n");
                            downloadOutput(`${title} full run`, output);
                          }}
                        >
                          <Download className="mr-1 h-3.5 w-3.5" />
                          Export run
                        </Button>
                      </div>
                      {processScope.data.results.map(result => (
                        <article
                          key={result.agentId}
                          className="min-w-0 rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-white/[0.035] sm:p-4"
                        >
                          <div className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-2">
                            <h3 className="min-w-0 break-words text-sm font-semibold text-zinc-950 dark:text-white">
                              {result.agentName}
                            </h3>
                            <div className="flex flex-wrap gap-2">
                              {"output" in result && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      copyOutput(
                                        result.agentName,
                                        result.output ?? ""
                                      )
                                    }
                                    className="h-8 border-zinc-200 bg-white dark:border-white/10 dark:bg-white/5"
                                  >
                                    <Copy className="mr-1 h-3.5 w-3.5" />
                                    Copy
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      downloadOutput(
                                        result.agentName,
                                        result.output ?? ""
                                      )
                                    }
                                    className="h-8 border-zinc-200 bg-white dark:border-white/10 dark:bg-white/5"
                                  >
                                    <Download className="mr-1 h-3.5 w-3.5" />
                                    Export
                                  </Button>
                                </>
                              )}
                              <Badge
                                variant={
                                  result.status === "completed"
                                    ? "secondary"
                                    : "destructive"
                                }
                              >
                                {result.status}
                              </Badge>
                            </div>
                          </div>
                          {"output" in result ? (
                            <div className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-md bg-white p-3 text-sm leading-6 text-zinc-700 dark:bg-slate-950 dark:text-slate-300">
                              {result.output}
                            </div>
                          ) : (
                            <p className="text-sm text-red-600 dark:text-rose-300">
                              {result.error}
                            </p>
                          )}
                        </article>
                      ))}
                    </>
                  )}

                  {savedRuns.length > 0 && (
                    <div className="min-w-0 space-y-3 border-t border-zinc-200 pt-4 dark:border-white/10">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <h3 className="text-base font-semibold text-zinc-950 dark:text-white">
                          Saved Legacy Outputs
                        </h3>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={deleteSavedRuns.isPending}
                          onClick={() => deleteSavedRuns.mutate()}
                          className="border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-200"
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5" />
                          Delete all
                        </Button>
                      </div>
                      {savedRuns.slice(0, 8).map(run => {
                        const output = run.output ?? "";
                        const runTitle =
                          run.agentName || run.agentId || "Saved agent output";
                        return (
                          <article
                            key={run.id}
                            className="min-w-0 rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-white/[0.035] sm:p-4"
                          >
                            <div className="mb-3 flex min-w-0 flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0">
                                <h4 className="break-words text-sm font-semibold text-zinc-950 dark:text-white">
                                  {runTitle}
                                </h4>
                                <p className="mt-1 break-words text-xs text-zinc-500 dark:text-slate-500">
                                  {run.documentName} ·{" "}
                                  {new Date(run.createdAt).toLocaleString()}
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => copyOutput(runTitle, output)}
                                  className="h-8 border-zinc-200 bg-white dark:border-white/10 dark:bg-white/5"
                                >
                                  <Copy className="mr-1 h-3.5 w-3.5" />
                                  Copy
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    downloadOutput(runTitle, output)
                                  }
                                  className="h-8 border-zinc-200 bg-white dark:border-white/10 dark:bg-white/5"
                                >
                                  <Download className="mr-1 h-3.5 w-3.5" />
                                  Export
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={deleteOutput.isPending}
                                  onClick={() =>
                                    deleteOutput.mutate({ id: run.id })
                                  }
                                  className="h-8 border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-200"
                                >
                                  Delete
                                </Button>
                              </div>
                            </div>
                            <div className="max-h-44 overflow-auto whitespace-pre-wrap break-words rounded-md bg-white p-3 text-sm leading-6 text-zinc-700 dark:bg-slate-950 dark:text-slate-300">
                              {output || "No output text saved."}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          </div>
        </section>
      </CommandMain>
    </CommandSurface>
  );
}
