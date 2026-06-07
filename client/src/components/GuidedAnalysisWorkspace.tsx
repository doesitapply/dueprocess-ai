import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowLeft,
  Brain,
  CalendarDays,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  FileText,
  FolderSearch,
  Gauge,
  Layers3,
  ListChecks,
  Loader2,
  Moon,
  Play,
  Scale,
  ShieldCheck,
  Sparkles,
  Sun,
  Target,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

type AnalysisSector = "tactical" | "legal" | "intel" | "evidence" | "offensive";
type AnalysisScope = "all" | "file" | "time";
type Accent = "blue" | "emerald" | "amber" | "rose" | "violet";
type AgentDivision = "research" | "analysis" | "tactical" | "evidence" | "offensive";

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

const ANALYSIS_READY_MIN_TEXT_LENGTH = 100;
const ANALYSIS_READY_MIN_QUALITY_SCORE = 70;
const ANALYSIS_BLOCKING_WARNINGS = new Set([
  "extraction_failed",
  "missing_source_hash",
  "empty_extracted_text",
  "very_short_extracted_text",
  "low_text_signal",
]);

const scopeOptions: Array<{ id: AnalysisScope; label: string; description: string; icon: typeof FolderSearch }> = [
  {
    id: "all",
    label: "Whole case",
    description: "Best for patterns, repeat actors, contradictions, and Monell routes.",
    icon: FolderSearch,
  },
  {
    id: "file",
    label: "Selected files",
    description: "Use checkboxes when one filing, exhibit group, or transcript set matters.",
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
    reason: "Maximum skepticism: timeline gaps, contradictions, constitutional/criminal procedure, Monell, evasion, missing records, authority, and ruthless QC.",
    agentIds: [
      "timeline_constructor",
      "contradiction_detector",
      "pattern_recognition_engine",
      "constitutional_analyst",
      "civil_rights_expert",
      "criminal_law_specialist",
      "immunity_piercer",
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
    reason: "Ranks the highest-payoff issues, routes around immunity risk, and produces the QC-backed synthesis.",
    agentIds: ["liability_remedy_ranker", "monell_pattern_mapper", "immunity_piercer", "criminal_law_specialist", "contradiction_detector", "qc_auditor"],
  },
  {
    id: "monell_pattern",
    name: "Monell Pattern Map",
    reason: "Policy, custom, failure to train, ratification, deliberate indifference, and missing municipal proof.",
    agentIds: ["monell_pattern_mapper", "liability_remedy_ranker", "civil_rights_expert", "pattern_recognition_engine", "discovery_tactician"],
  },
  {
    id: "brady_napue",
    name: "Brady / Napue / Discovery",
    reason: "Hidden evidence, false-evidence pathways, contradictions, and exact records to demand.",
    agentIds: ["criminal_law_specialist", "contradiction_detector", "timeline_constructor", "discovery_tactician", "qc_auditor"],
  },
  {
    id: "gps_search",
    name: "GPS / Search / Tracker",
    reason: "Tracker claims, search warrants, chain of custody, probable cause, and Fourth Amendment leverage.",
    agentIds: ["constitutional_analyst", "criminal_law_specialist", "liability_remedy_ranker", "discovery_tactician", "qc_auditor"],
  },
  {
    id: "immunity_relief",
    name: "Immunity + Relief Pathway",
    reason: "Damages barriers, non-damages routes, nonimmune actors, Monell, mandamus, habeas, appeal, and recusal.",
    agentIds: ["immunity_piercer", "monell_pattern_mapper", "civil_rights_expert", "precedent_miner", "qc_auditor"],
  },
  {
    id: "motion_packet",
    name: "Motion / Report Packet",
    reason: "Turns issue spotting into motion, complaint, discovery, and report-ready scaffolding.",
    agentIds: ["motion_drafter", "complaint_constructor", "liability_remedy_ranker", "constitutional_analyst", "qc_auditor"],
  },
];

const evidenceWorkflowOptions: Recommendation[] = [
  {
    id: "timeline_gap_architect",
    name: "Timeline + Gap Builder",
    reason: "Builds the chronology first, then marks missing orders, absent logs, unexplained delays, and proof gaps.",
    agentIds: ["timeline_constructor", "skeptical_adversarial_reader", "discovery_tactician", "qc_auditor"],
  },
  {
    id: "contradiction_pattern",
    name: "Contradiction + Pattern Sweep",
    reason: "Compares files against each other for inconsistent claims, repeated tactics, and record-level contradictions.",
    agentIds: ["contradiction_detector", "pattern_recognition_engine", "timeline_constructor", "qc_auditor"],
  },
  {
    id: "missing_records",
    name: "Missing Records Hunt",
    reason: "Turns suspicious absences into exact records to demand before agents overclaim anything.",
    agentIds: ["discovery_tactician", "skeptical_adversarial_reader", "timeline_constructor", "qc_auditor"],
  },
  {
    id: "evidence_readiness",
    name: "Evidence Readiness Gate",
    reason: "Checks what is processed, what is blocked, what can be analyzed now, and what should not run yet.",
    agentIds: ["timeline_constructor", "pattern_recognition_engine", "qc_auditor"],
  },
  {
    id: "record_to_claim_bridge",
    name: "Record-to-Claim Bridge",
    reason: "Connects clean record facts to legal theories only after the evidence agents build the support trail.",
    agentIds: ["timeline_constructor", "contradiction_detector", "criminal_law_specialist", "liability_remedy_ranker", "qc_auditor"],
  },
];

const accentTokens: Record<Accent, { accent: string; accentSoft: string; accentText: string; button: string; active: string }> = {
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
  legal: ["constitutional_analyst", "criminal_law_specialist", "civil_rights_expert", "appellate_strategist"],
  intel: ["canon_hunter", "precedent_miner", "statute_scanner"],
  evidence: ["pattern_recognition_engine", "timeline_constructor", "contradiction_detector"],
  offensive: ["motion_drafter", "complaint_constructor"],
};

function uniqueIds(ids: string[]): string[] {
  return Array.from(new Set(ids));
}

function parseStringArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
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
    !warnings.some((warning) => ANALYSIS_BLOCKING_WARNINGS.has(warning))
  );
}

function sourceAnchored(document: CorpusDocument): boolean {
  return Boolean(document.documentHash || document.extractedText?.includes("SOURCE_SHA256:"));
}

function extractedLength(document: CorpusDocument): number {
  if (typeof document.extractionTextLength === "number" && document.extractionTextLength > 0) return document.extractionTextLength;
  return (document.extractedText || "").replace(/^SOURCE_SHA256:\s*[a-f0-9]{64}\s*/im, "").trim().length;
}

function qualityScore(document: CorpusDocument): number {
  if (typeof document.extractionQualityScore === "number" && document.extractionQualityScore > 0) return document.extractionQualityScore;
  if (document.status !== "completed") return 0;
  let score = 100;
  if (!sourceAnchored(document)) score -= 45;
  const length = extractedLength(document);
  if (length === 0) score -= 80;
  else if (length < ANALYSIS_READY_MIN_TEXT_LENGTH) score -= 25;
  else if (length < 500) score -= 10;
  return Math.max(0, Math.min(100, score));
}

function inDateScope(document: CorpusDocument, fromDate: string, toDate: string): boolean {
  if (!fromDate && !toDate) return true;
  const createdAt = document.createdAt ? new Date(document.createdAt) : null;
  if (!createdAt || Number.isNaN(createdAt.getTime())) return false;
  if (fromDate && createdAt < new Date(`${fromDate}T00:00:00.000`)) return false;
  if (toDate && createdAt > new Date(`${toDate}T23:59:59.999`)) return false;
  return true;
}

function safeFileName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "agent-output";
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
  const blob = new Blob([`${agentName}\n\n${output}`], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${safeFileName(agentName)}.txt`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function buildRecommendations(sector: AnalysisSector, scope: AnalysisScope): Recommendation[] {
  const base = sectorDefaults[sector];
  const eraSupport = ["timeline_constructor", "contradiction_detector"];
  const authoritySupport = ["precedent_miner", "statute_scanner"];
  const draftingSupport = ["motion_drafter", "complaint_constructor"];
  const primary = sector === "evidence" ? evidenceWorkflowOptions : legalWorkflowOptions;
  const scoped: Recommendation[] = [
    {
      id: "recommended_scope",
      name: scope === "time" ? "Era contradiction pass" : sector === "evidence" ? "Record-first pass" : "Best legal fit",
      reason: scope === "file" ? "Focused pass for selected filings or exhibits." : sector === "evidence" ? "Builds the proof map before legal conclusions." : "Broad pass for proof gaps, issue spotting, and next actions.",
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
}: {
  icon: typeof ListChecks;
  label: string;
  value: string | number;
  detail?: string;
  tone: string;
}) {
  return (
    <div className="min-w-0 rounded-md border border-zinc-200 bg-white/70 p-3 shadow-sm dark:border-white/10 dark:bg-slate-950/70 sm:p-4">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="min-w-0 break-words text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-slate-500">{label}</div>
        <Icon className={cn("h-4 w-4 flex-none", tone)} />
      </div>
      <div className="mt-2 break-words text-xl font-semibold text-zinc-950 dark:text-white sm:text-2xl">{value}</div>
      {detail && <div className="mt-1 break-words text-xs leading-5 text-zinc-500 dark:text-slate-400">{detail}</div>}
    </div>
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
            <h3 className="min-w-0 break-words text-base font-semibold text-zinc-950 dark:text-white">{finding.title}</h3>
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
            <div className={finding.confidence >= 95 ? "text-emerald-600 dark:text-emerald-300" : finding.confidence >= 80 ? "text-amber-600 dark:text-amber-300" : "text-red-600 dark:text-red-300"}>
              {finding.confidence}
            </div>
          </div>
          <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-white/10 dark:bg-white/[0.04]">
            <div className="text-zinc-500 dark:text-slate-500">Leverage</div>
            <div className="text-blue-600 dark:text-blue-300">{finding.leverageScore}</div>
          </div>
        </div>
      </div>

      <p className="mt-3 break-words text-sm leading-6 text-zinc-700 dark:text-slate-300">{finding.summary}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {finding.liabilityVector && <Badge className="bg-zinc-100 text-zinc-700 dark:bg-white/10 dark:text-slate-200">{finding.liabilityVector}</Badge>}
        {finding.remedyPath && <Badge className="bg-zinc-100 text-zinc-700 dark:bg-white/10 dark:text-slate-200">{finding.remedyPath}</Badge>}
        <Badge className="bg-zinc-100 text-zinc-700 dark:bg-white/10 dark:text-slate-200">{finding.severity}</Badge>
      </div>

      {anchors.length > 0 && (
        <div className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-white/[0.03]">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5" />
            Source support
          </div>
          <div className="space-y-2">
            {anchors.slice(0, 3).map((anchor, index) => (
              <div key={`${anchor.documentId || "source"}-${index}`} className="min-w-0 break-words text-xs leading-5 text-zinc-700 dark:text-slate-300">
                <span className="font-medium text-zinc-950 dark:text-slate-100">{anchor.fileName || `Document ${anchor.documentId || index + 1}`}</span>
                {anchor.quote && <span className="block break-words text-zinc-500 dark:text-slate-400">"{anchor.quote}"</span>}
                {anchor.support && <span className="block break-words text-amber-700 dark:text-amber-200">{anchor.support}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {(missingRecords.length > 0 || authorities.length > 0 || finding.nextAction) && (
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {missingRecords.length > 0 && <FindingMini label="Missing records" value={missingRecords.slice(0, 4).join("; ")} />}
          {authorities.length > 0 && <FindingMini label="Authority" value={authorities.slice(0, 4).join("; ")} />}
          {finding.nextAction && <FindingMini label="Next action" value={finding.nextAction} />}
        </div>
      )}
      {finding.qcReason && <p className="mt-3 text-xs leading-5 text-amber-700 dark:text-amber-200">{finding.qcReason}</p>}
    </article>
  );
}

function FindingMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-slate-500">{label}</div>
      <p className="mt-2 break-words text-xs leading-5 text-zinc-700 dark:text-slate-300">{value}</p>
    </div>
  );
}

function rankCounts(items: string[]) {
  const counts = new Map<string, number>();
  items.filter(Boolean).forEach((item) => counts.set(item, (counts.get(item) ?? 0) + 1));
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
}

function formatShortDate(value?: Date | string) {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function findingTypeCount(findings: FindingCardData[], types: string[]) {
  return findings.filter((finding) => types.includes(finding.findingType)).length;
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
    usage?: { totalTokens: number; estimatedCostCents: number; model?: string };
  };
}) {
  return (
    <Card className="min-w-0 overflow-hidden border-zinc-200 bg-white/80 shadow-sm dark:border-white/10 dark:bg-slate-950/75">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-zinc-950 dark:text-white">
          <Brain className="h-5 w-5 text-blue-600 dark:text-blue-300" />
          Backend State
        </CardTitle>
        <CardDescription className="text-zinc-500 dark:text-slate-400">
          What the engine can actually use right now.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <FindingMini label="Selected backend agents" value={selectedAgentIds.length > 0 ? selectedAgentIds.join(", ") : sector === "evidence" ? "Default evidence stack" : "Default legal stack"} />
        <FindingMini label="Record gate" value={`${readyDocuments.length} ready; ${blockedDocuments.length} blocked. Agents cannot run whole-case analysis while files are unprocessed.`} />
        <FindingMini label="Scope payload" value={selectedDocumentIds.length > 0 ? `${selectedDocumentIds.length} file IDs selected` : "Whole case or era scope will use all ready records."} />
        <FindingMini label="Persistence" value={`${savedFindingsCount} structured findings; ${savedRunsCount} saved legacy outputs.`} />
        {currentRun && (
          <>
            <FindingMini label="Latest run" value={`Run ${currentRun.runId}; ${currentRun.completedAgents}/${currentRun.totalAgents} agents; ${currentRun.documentCount} records.`} />
            <FindingMini label="Usage" value={currentRun.usage ? `${currentRun.usage.totalTokens} tokens; $${(currentRun.usage.estimatedCostCents / 100).toFixed(4)} estimated; ${currentRun.usage.model || "model recorded"}.` : "No token usage returned yet."} />
          </>
        )}
      </CardContent>
    </Card>
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
  const timelineDocs = documents
    .slice()
    .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime())
    .slice(0, 8);
  const missingCount = findingTypeCount(visibleFindings, ["missing_record", "missing_critical", "suspicious_absence"]);
  const contradictionCount = findingTypeCount(visibleFindings, ["contradiction"]);
  const adverseCount = findingTypeCount(visibleFindings, ["adverse_fact"]);
  const timelineAgents = ["timeline_constructor", "skeptical_adversarial_reader", "discovery_tactician", "qc_auditor"].filter((id) => availableAgentIds.has(id));
  const contradictionAgents = ["contradiction_detector", "pattern_recognition_engine", "timeline_constructor", "qc_auditor"].filter((id) => availableAgentIds.has(id));

  return (
    <Card className="min-w-0 overflow-hidden border-emerald-200 bg-white/85 shadow-sm dark:border-emerald-500/20 dark:bg-slate-950/75">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-zinc-950 dark:text-white">
          <CalendarDays className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
          Timeline Builder
        </CardTitle>
        <CardDescription className="text-zinc-500 dark:text-slate-400">
          Evidence Review starts with chronology, contradictions, and missing records before legal theories.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <StatTile icon={CalendarDays} label="Chronology" value={timelineDocs.length} detail="records in preview" tone="text-emerald-600 dark:text-emerald-300" />
          <StatTile icon={AlertTriangle} label="Gaps" value={missingCount} detail="missing or suspicious absences" tone="text-amber-600 dark:text-amber-300" />
          <StatTile icon={ListChecks} label="Conflicts" value={contradictionCount + adverseCount} detail={`${contradictionCount} contradictions; ${adverseCount} adverse facts`} tone="text-rose-600 dark:text-rose-300" />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Button type="button" variant="outline" onClick={() => { setScope("all"); setAgentSelection(timelineAgents); }} className="min-h-11 border-emerald-500/30 bg-emerald-500/10 text-emerald-800 hover:bg-emerald-500/15 dark:text-emerald-100">
            Build whole-case timeline
          </Button>
          <Button type="button" variant="outline" onClick={() => { setScope("time"); setAgentSelection(contradictionAgents); }} className="min-h-11 border-zinc-200 bg-white hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10">
            Review a specific era
          </Button>
        </div>

        <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-white/[0.03]">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-slate-500">Record timeline preview</div>
          <div className="space-y-3">
            {timelineDocs.length === 0 && <p className="text-sm text-zinc-500 dark:text-slate-400">No uploaded records found yet.</p>}
            {timelineDocs.map((document, index) => (
              <div key={document.id} className="grid min-w-0 grid-cols-[1.5rem_minmax(0,1fr)] gap-3">
                <div className="flex flex-col items-center">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  {index < timelineDocs.length - 1 && <span className="mt-1 h-full min-h-6 w-px bg-zinc-200 dark:bg-white/10" />}
                </div>
                <div className="min-w-0 pb-2">
                  <div className="text-xs text-zinc-500 dark:text-slate-500">{formatShortDate(document.createdAt)}</div>
                  <div className="truncate text-sm font-medium text-zinc-950 dark:text-white">{document.fileName}</div>
                  <div className="text-xs text-zinc-500 dark:text-slate-500">
                    {isAnalysisReady(document) ? "ready for analysis" : sourceAnchored(document) ? document.status : "missing source hash"} · OCR {qualityScore(document)}
                  </div>
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
  const legalAuthorities = rankCounts(visibleFindings.flatMap((finding) => finding.legalAuthorities ?? []));
  const remedyPaths = rankCounts(visibleFindings.map((finding) => finding.remedyPath || ""));
  const immunityRisk = visibleFindings.filter((finding) => (finding.liabilityVector || "").toLowerCase().includes("immunity") || (finding.summary || "").toLowerCase().includes("immunity")).length;
  const monellAgents = ["monell_pattern_mapper", "liability_remedy_ranker", "civil_rights_expert", "pattern_recognition_engine", "discovery_tactician", "qc_auditor"].filter((id) => availableAgentIds.has(id));
  const immunityAgents = ["immunity_piercer", "monell_pattern_mapper", "civil_rights_expert", "precedent_miner", "qc_auditor"].filter((id) => availableAgentIds.has(id));

  return (
    <Card className="min-w-0 overflow-hidden border-violet-200 bg-white/85 shadow-sm dark:border-violet-500/20 dark:bg-slate-950/75">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-zinc-950 dark:text-white">
          <Scale className="h-5 w-5 text-violet-700 dark:text-violet-300" />
          Legal Theory Board
        </CardTitle>
        <CardDescription className="text-zinc-500 dark:text-slate-400">
          Legal Analysis turns proof into claims, remedies, defenses, and court-safe next moves.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <StatTile icon={Scale} label="Remedy paths" value={remedyPaths.length} detail="from structured findings" tone="text-violet-600 dark:text-violet-300" />
          <StatTile icon={ShieldCheck} label="Authority hooks" value={legalAuthorities.length} detail="statutes, cases, canons" tone="text-blue-600 dark:text-blue-300" />
          <StatTile icon={AlertTriangle} label="Immunity risk" value={immunityRisk} detail="items needing careful framing" tone="text-amber-600 dark:text-amber-300" />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Button type="button" variant="outline" onClick={() => setAgentSelection(monellAgents)} className="min-h-11 border-violet-500/30 bg-violet-500/10 text-violet-800 hover:bg-violet-500/15 dark:text-violet-100">
            Map Monell / systemic liability
          </Button>
          <Button type="button" variant="outline" onClick={() => setAgentSelection(immunityAgents)} className="min-h-11 border-zinc-200 bg-white hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10">
            Build immunity-safe route
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <FindingMini label="Top remedy paths" value={remedyPaths.length > 0 ? remedyPaths.map(([label, count]) => `${label} (${count})`).join("; ") : "No remedy paths stored yet. Run a legal workflow to create them."} />
          <FindingMini label="Top authorities" value={legalAuthorities.length > 0 ? legalAuthorities.map(([label, count]) => `${label} (${count})`).join("; ") : "No authority hooks stored yet."} />
        </div>
      </CardContent>
    </Card>
  );
}

export function GuidedAnalysisWorkspace({
  sector,
  title,
  eyebrow,
  description,
  accent,
  focusAreas,
}: GuidedAnalysisWorkspaceProps) {
  const styles = accentTokens[accent];
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [scope, setScope] = useState<AnalysisScope>("all");
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<number[]>([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [showRawOutput, setShowRawOutput] = useState(false);
  const utils = trpc.useUtils();

  const documentsQuery = trpc.documents.list.useQuery();
  const savedRunsQuery = trpc.agents.listSavedRuns.useQuery();
  const savedFindingsQuery = trpc.agents.listFindings.useQuery();
  const catalogQuery = trpc.agents.catalog.useQuery(undefined, { enabled: isAdmin, retry: false });

  const processScope = trpc.agents.processScope.useMutation({
    onSuccess: (data) => {
      toast.success(`Analysis complete: ${data.completedAgents}/${data.totalAgents} agents finished.`);
      utils.agents.listSavedRuns.invalidate();
      utils.agents.listFindings.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteOutput = trpc.agents.deleteOutput.useMutation({
    onSuccess: () => {
      toast.success("Saved output deleted");
      utils.agents.listSavedRuns.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteSavedRuns = trpc.agents.deleteSavedRuns.useMutation({
    onSuccess: () => {
      toast.success("Saved agent runs cleared");
      utils.agents.listSavedRuns.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const documents: CorpusDocument[] = documentsQuery.data ?? [];
  const readyDocuments = documents.filter(isAnalysisReady);
  const blockedDocuments = documents.filter((document) => !isAnalysisReady(document));
  const catalogAgents: CatalogAgent[] = catalogQuery.data?.agents ?? [];
  const superAgents: SuperAgent[] = catalogQuery.data?.superAgents ?? [];
  const savedRuns = savedRunsQuery.data ?? [];
  const savedFindings: FindingCardData[] = savedFindingsQuery.data ?? [];
  const currentFindings: FindingCardData[] = processScope.data?.findings ?? [];
  const visibleFindings = currentFindings.length > 0 ? currentFindings : savedFindings;
  const recommendations = useMemo(() => buildRecommendations(sector, scope), [scope, sector]);
  const availableAgentIds = useMemo(() => new Set(catalogAgents.map((agent) => agent.id)), [catalogAgents]);
  const isEvidenceWorkspace = sector === "evidence";
  const isLegalWorkspace = sector === "legal";
  const workspaceNoun = isEvidenceWorkspace ? "Record Lab" : isLegalWorkspace ? "Legal War Room" : "Analysis Workspace";
  const boardTitle = isEvidenceWorkspace ? "Evidence Board" : isLegalWorkspace ? "Legal Strategy Board" : "Intelligence Board";
  const boardDescription = isEvidenceWorkspace
    ? "Chronology, contradictions, missing records, adverse facts, and source support."
    : isLegalWorkspace
      ? "Claims ranked by leverage, confidence, remedy path, immunity posture, and QC status."
      : "Findings ranked by leverage, confidence, and QC posture.";

  useEffect(() => {
    if (!isAdmin || selectedAgentIds.length > 0 || catalogAgents.length === 0) return;
    setSelectedAgentIds(recommendations[0]?.agentIds.filter((agentId) => availableAgentIds.has(agentId)) ?? []);
  }, [availableAgentIds, catalogAgents.length, isAdmin, recommendations, selectedAgentIds.length]);

  const agentsByDivision = useMemo(() => {
    return catalogAgents.reduce<Record<AgentDivision, CatalogAgent[]>>(
      (groups, agent) => {
        groups[agent.division].push(agent);
        return groups;
      },
      { research: [], analysis: [], tactical: [], evidence: [], offensive: [] }
    );
  }, [catalogAgents]);

  const selectedWorkflow = recommendations.find((recommendation) => {
    const usableIds = recommendation.agentIds.filter((agentId) => availableAgentIds.has(agentId));
    return usableIds.length > 0 && usableIds.every((agentId) => selectedAgentIds.includes(agentId)) && selectedAgentIds.length === usableIds.length;
  });

  const timeScopedReadyDocuments = readyDocuments.filter((document) => inDateScope(document, fromDate, toDate));
  const timeScopedBlockedDocuments = blockedDocuments.filter((document) => inDateScope(document, fromDate, toDate));
  const matchingDocumentCount = scope === "file" ? selectedDocumentIds.length : scope === "time" ? timeScopedReadyDocuments.length : readyDocuments.length;
  const qcClearedCount = savedFindings.filter((finding) => ["approved", "not_required", "downgraded"].includes(finding.qcStatus || "")).length;
  const highLeverageCount = savedFindings.filter((finding) => finding.leverageScore >= 80).length;
  const needsProofCount = savedFindings.filter((finding) => ["pending", "needs_more_proof", "blocked"].includes(finding.qcStatus || "")).length;
  const avgConfidence = savedFindings.length === 0 ? 0 : Math.round(savedFindings.reduce((sum, finding) => sum + finding.confidence, 0) / savedFindings.length);
  const topLiabilityVectors = rankCounts(savedFindings.map((finding) => finding.liabilityVector || ""));
  const topMissingRecords = rankCounts(savedFindings.flatMap((finding) => finding.missingRecords ?? []));
  const highRiskFindings = visibleFindings.filter((finding) => finding.leverageScore >= 80 || finding.severity === "critical").slice(0, 6);

  const resolveAgentIds = (agentIds: string[]) => availableAgentIds.size > 0 ? agentIds.filter((agentId) => availableAgentIds.has(agentId)) : agentIds;
  const setAgentSelection = (agentIds: string[]) => setSelectedAgentIds(resolveAgentIds(agentIds));
  const toggleAgent = (agentId: string) => {
    setSelectedAgentIds((current) => (current.includes(agentId) ? current.filter((id) => id !== agentId) : [...current, agentId]));
  };
  const toggleDocument = (documentId: number) => {
    setSelectedDocumentIds((current) => (current.includes(documentId) ? current.filter((id) => id !== documentId) : [...current, documentId]));
  };

  const runAnalysis = () => {
    if (documents.length === 0) {
      toast.error("Upload at least one record in Corpus before running analysis.");
      return;
    }
    if (scope === "all" && blockedDocuments.length > 0) {
      toast.error("Wait until every Corpus file is processed, or choose only ready files with Selected files.");
      return;
    }
    if (scope === "time" && timeScopedBlockedDocuments.length > 0) {
      toast.error("The selected date range includes files that need extraction review. Narrow the range or fix those files first.");
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
      documentIds: scope === "file" ? selectedDocumentIds : undefined,
      agentIds: isAdmin ? selectedAgentIds : undefined,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
    });
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f7f3eb] text-zinc-950 dark:bg-[#090d14] dark:text-slate-100">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-[#fbf8f1]/90 backdrop-blur dark:border-white/10 dark:bg-slate-950/85">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-2 px-3 py-3 sm:gap-3 sm:px-4">
          <Link href="/dashboard">
            <Button variant="ghost" className="min-w-0 gap-2 text-zinc-700 hover:bg-zinc-100 dark:text-slate-300 dark:hover:bg-white/10">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden xs:inline sm:inline">Dashboard</span>
            </Button>
          </Link>
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
            {isAdmin && <Badge className="border-0 bg-emerald-600 text-white">Admin</Badge>}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={toggleTheme}
              className="gap-2 border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              <span className="hidden sm:inline">{theme === "dark" ? "Light" : "Dark"}</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl space-y-5 px-3 py-4 sm:space-y-6 sm:px-4 sm:py-6">
        <section className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)] lg:items-stretch">
          <div className="min-w-0 rounded-md border border-zinc-200 bg-white/70 p-4 shadow-sm dark:border-white/10 dark:bg-slate-950/70 sm:p-5">
            <p className={cn("text-xs font-semibold uppercase tracking-[0.2em]", styles.accentText)}>{eyebrow}</p>
            <h1 className="mt-3 break-words text-2xl font-semibold tracking-tight text-zinc-950 dark:text-white sm:text-3xl md:text-5xl">{title}</h1>
            <p className="mt-3 max-w-3xl break-words text-sm leading-6 text-zinc-600 dark:text-slate-300">{description}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {focusAreas.map((area) => (
                <Badge key={area} className="max-w-full whitespace-normal break-words border border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-200">
                  {area}
                </Badge>
              ))}
            </div>
          </div>

          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:auto-rows-fr">
            <StatTile icon={FolderSearch} label="Ready corpus" value={`${readyDocuments.length}/${documents.length}`} detail={blockedDocuments.length > 0 ? `${blockedDocuments.length} still processing or failed` : "All available records are ready"} tone={readyDocuments.length === documents.length && documents.length > 0 ? "text-emerald-600 dark:text-emerald-300" : "text-amber-600 dark:text-amber-300"} />
            <StatTile icon={ListChecks} label="Findings" value={savedFindingsQuery.isLoading ? "..." : savedFindings.length} detail={`${qcClearedCount} QC-cleared`} tone="text-blue-600 dark:text-blue-300" />
            <StatTile icon={Gauge} label="High leverage" value={highLeverageCount} detail={`${avgConfidence || 0} avg confidence`} tone="text-amber-600 dark:text-amber-300" />
            <StatTile icon={AlertTriangle} label="Needs proof" value={needsProofCount} detail="Pending, blocked, or needs more proof" tone="text-rose-600 dark:text-rose-300" />
          </div>
        </section>

        <section className="grid min-w-0 gap-5 lg:grid-cols-[minmax(18rem,0.86fr)_minmax(0,1.14fr)] lg:gap-6">
          <div className="min-w-0 space-y-5 sm:space-y-6">
            <Card className="min-w-0 overflow-hidden border-zinc-200 bg-white/80 shadow-sm dark:border-white/10 dark:bg-slate-950/75">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-zinc-950 dark:text-white">
                  <Target className={cn("h-5 w-5", styles.accentText)} />
                  {isEvidenceWorkspace ? "Record Plan" : isLegalWorkspace ? "Claim Plan" : "Attack Plan"}
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
                {recommendations.slice(0, 6).map((recommendation) => {
                  const usableIds = resolveAgentIds(recommendation.agentIds);
                  const active = usableIds.length > 0 && usableIds.every((agentId) => selectedAgentIds.includes(agentId)) && selectedAgentIds.length === usableIds.length;
                  return (
                    <button
                      key={recommendation.id}
                      type="button"
                      onClick={() => setAgentSelection(usableIds)}
                      className={cn(
                        "min-w-0 w-full rounded-md border p-3 text-left transition",
                        active ? styles.active : "border-zinc-200 bg-white hover:bg-zinc-50 dark:border-white/10 dark:bg-white/[0.035] dark:hover:bg-white/[0.07]"
                      )}
                    >
                      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0 break-words font-medium text-zinc-950 dark:text-white">{recommendation.name}</div>
                        <Badge className="shrink-0 bg-zinc-100 text-zinc-700 dark:bg-white/10 dark:text-slate-200">{usableIds.length} agents</Badge>
                      </div>
                      <p className="mt-1 break-words text-xs leading-5 text-zinc-500 dark:text-slate-400">{recommendation.reason}</p>
                    </button>
                  );
                })}
              </CardContent>
            </Card>

            <Card className="min-w-0 overflow-hidden border-zinc-200 bg-white/80 shadow-sm dark:border-white/10 dark:bg-slate-950/75">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-zinc-950 dark:text-white">
                  <Layers3 className={cn("h-5 w-5", styles.accentText)} />
                  {isEvidenceWorkspace ? "Record Scope" : "Evidence Scope"}
                </CardTitle>
                <CardDescription className="text-zinc-500 dark:text-slate-400">
                  {matchingDocumentCount} record{matchingDocumentCount === 1 ? "" : "s"} selected for this run.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-3">
                  {scopeOptions.map((option) => {
                    const Icon = option.icon;
                    const active = scope === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setScope(option.id)}
                        className={cn(
                          "min-w-0 rounded-md border p-3 text-left transition",
                          active ? styles.active : "border-zinc-200 bg-white hover:bg-zinc-50 dark:border-white/10 dark:bg-white/[0.035] dark:hover:bg-white/[0.07]"
                        )}
                      >
                        <Icon className={cn("mb-2 h-4 w-4", active ? styles.accentText : "text-zinc-400 dark:text-slate-500")} />
                        <div className="break-words text-sm font-medium text-zinc-950 dark:text-white">{option.label}</div>
                        <p className="mt-1 break-words text-xs leading-5 text-zinc-500 dark:text-slate-400">{option.description}</p>
                      </button>
                    );
                  })}
                </div>

                {scope === "file" && (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium text-zinc-700 dark:text-slate-200">Files</span>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setSelectedDocumentIds(readyDocuments.map((document) => document.id))} className="h-8 border-zinc-200 bg-white dark:border-white/10 dark:bg-white/5">Ready</Button>
                        <Button size="sm" variant="outline" onClick={() => setSelectedDocumentIds([])} className="h-8 border-zinc-200 bg-white dark:border-white/10 dark:bg-white/5">Clear</Button>
                      </div>
                    </div>
                    <div className="max-h-72 space-y-2 overflow-auto rounded-md border border-zinc-200 bg-zinc-50 p-2 dark:border-white/10 dark:bg-slate-950/80">
                      {documents.map((document) => {
                        const ready = isAnalysisReady(document);
                        const checked = selectedDocumentIds.includes(document.id);
                        return (
                          <label key={document.id} className={cn("flex min-w-0 gap-3 rounded-md border p-3", ready ? "cursor-pointer" : "cursor-not-allowed opacity-55", checked ? styles.active : "border-zinc-200 bg-white dark:border-white/10 dark:bg-white/[0.03]")}>
                            <Checkbox checked={checked} disabled={!ready} onCheckedChange={() => ready && toggleDocument(document.id)} className="mt-1" />
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium text-zinc-950 dark:text-white">{document.fileName}</span>
                              <span className="text-xs text-zinc-500 dark:text-slate-500">
                                {document.mimeType || "unknown"} · {ready ? "ready" : sourceAnchored(document) ? document.status : "missing source hash"} · OCR {qualityScore(document)}
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
                      <label className="text-sm font-medium text-zinc-700 dark:text-slate-200" htmlFor="from-date">From</label>
                      <Input id="from-date" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="border-zinc-200 bg-white dark:border-white/10 dark:bg-slate-950" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-700 dark:text-slate-200" htmlFor="to-date">To</label>
                      <Input id="to-date" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className="border-zinc-200 bg-white dark:border-white/10 dark:bg-slate-950" />
                    </div>
                  </div>
                )}

                <Button
                  onClick={runAnalysis}
                  disabled={processScope.isPending || documentsQuery.isLoading || catalogQuery.isLoading || readyDocuments.length === 0 || (scope === "all" && blockedDocuments.length > 0) || (scope === "time" && (timeScopedBlockedDocuments.length > 0 || timeScopedReadyDocuments.length === 0))}
                  className={cn("min-h-12 h-auto w-full gap-2 whitespace-normal px-3 py-3 text-sm sm:text-base", styles.button)}
                >
                  {processScope.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Running {workspaceNoun}</> : <><Play className="h-4 w-4" /> Run {selectedWorkflow?.name || title}</>}
                </Button>
              </CardContent>
            </Card>

            {isAdmin && (
              <Card className="min-w-0 overflow-hidden border-zinc-200 bg-white/80 shadow-sm dark:border-white/10 dark:bg-slate-950/75">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-zinc-950 dark:text-white">
                    <Brain className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
                    Agent Stack
                  </CardTitle>
                  <CardDescription className="text-zinc-500 dark:text-slate-400">
                    {selectedAgentIds.length} selected. Full control is admin-only.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {superAgents.length > 0 && (
                    <div className="grid gap-2">
                      {superAgents.slice(0, 3).map((superAgent) => {
                        const usableIds = superAgent.agentIds.filter((agentId) => availableAgentIds.has(agentId));
                        return (
                          <button key={superAgent.id} type="button" onClick={() => setAgentSelection(usableIds)} className="min-w-0 rounded-md border border-zinc-200 bg-white p-3 text-left hover:bg-zinc-50 dark:border-white/10 dark:bg-white/[0.035] dark:hover:bg-white/[0.07]">
                            <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                              <span className="min-w-0 break-words text-sm font-medium text-zinc-950 dark:text-white">{superAgent.name}</span>
                              <span className="text-xs text-zinc-500 dark:text-slate-400">{usableIds.length}</span>
                            </div>
                            <p className="mt-1 break-words text-xs leading-5 text-zinc-500 dark:text-slate-500">{superAgent.description}</p>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setAgentSelection(catalogAgents.map((agent) => agent.id))} className="border-zinc-200 bg-white dark:border-white/10 dark:bg-white/5">All</Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => setSelectedAgentIds([])} className="border-zinc-200 bg-white dark:border-white/10 dark:bg-white/5">Clear</Button>
                  </div>
                  <div className="max-h-[25rem] space-y-4 overflow-auto pr-1">
                    {(Object.keys(agentsByDivision) as AgentDivision[]).map((division) => {
                      const agents = agentsByDivision[division];
                      if (agents.length === 0) return null;
                      return (
                        <div key={division} className="space-y-2">
                          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-slate-500">{divisionLabels[division]}</div>
                          {agents.map((agent) => {
                            const checked = selectedAgentIds.includes(agent.id);
                            return (
                              <label key={agent.id} className={cn("flex min-w-0 cursor-pointer gap-3 rounded-md border p-3", checked ? "border-emerald-500 bg-emerald-500/10" : "border-zinc-200 bg-white dark:border-white/10 dark:bg-white/[0.03]")}>
                                <Checkbox checked={checked} onCheckedChange={() => toggleAgent(agent.id)} className="mt-1" />
                                <span className="min-w-0">
                                  <span className="block break-words text-sm font-medium text-zinc-950 dark:text-white">{agent.name}</span>
                                  <span className="mt-1 block break-words text-xs leading-5 text-zinc-500 dark:text-slate-400">{agent.description}</span>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
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

            <Card className="min-w-0 overflow-hidden border-zinc-200 bg-white/80 shadow-sm dark:border-white/10 dark:bg-slate-950/75">
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
                    <Button variant="outline" className="border-zinc-200 bg-white dark:border-white/10 dark:bg-white/5">
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
                    <StatTile icon={CheckCircle2} label="Run" value={processScope.data.runId} detail={`${processScope.data.completedAgents}/${processScope.data.totalAgents} agents`} tone="text-emerald-600 dark:text-emerald-300" />
                    <StatTile icon={ListChecks} label="Findings" value={currentFindings.length} detail={`${processScope.data.documentCount} records analyzed`} tone="text-blue-600 dark:text-blue-300" />
                    <StatTile icon={Gauge} label="Tokens" value={processScope.data.usage.totalTokens} detail={processScope.data.usage.model || "model recorded"} tone="text-amber-600 dark:text-amber-300" />
                    <StatTile icon={Scale} label="Cost" value={`$${(processScope.data.usage.estimatedCostCents / 100).toFixed(4)}`} detail="estimated" tone="text-emerald-600 dark:text-emerald-300" />
                  </div>
                )}

                {processScope.data?.synthesis && (
                  <div className={cn("rounded-md border p-4", styles.accent, styles.accentSoft)}>
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-zinc-950 dark:text-white">
                      <Target className="h-4 w-4" />
                      War Room Synthesis
                    </div>
                    <div className="max-h-72 overflow-auto whitespace-pre-wrap text-sm leading-6 text-zinc-700 dark:text-slate-200">{processScope.data.synthesis}</div>
                  </div>
                )}

                {(topLiabilityVectors.length > 0 || topMissingRecords.length > 0) && (
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="min-w-0 rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                      <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-slate-500">Top liability vectors</div>
                      <div className="space-y-2">
                        {topLiabilityVectors.map(([label, count]) => (
                          <div key={label} className="flex min-w-0 items-center justify-between gap-3 text-sm">
                            <span className="min-w-0 truncate text-zinc-700 dark:text-slate-300">{label}</span>
                            <Badge className="bg-white text-zinc-700 dark:bg-white/10 dark:text-slate-200">{count}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="min-w-0 rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                      <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-slate-500">Most requested missing records</div>
                      <div className="space-y-2">
                        {topMissingRecords.map(([label, count]) => (
                          <div key={label} className="flex min-w-0 items-center justify-between gap-3 text-sm">
                            <span className="min-w-0 truncate text-zinc-700 dark:text-slate-300">{label}</span>
                            <Badge className="bg-white text-zinc-700 dark:bg-white/10 dark:text-slate-200">{count}</Badge>
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
                      <h2 className="break-words text-base font-semibold text-zinc-950 dark:text-white">Highest-Leverage Findings</h2>
                      <Badge variant="outline" className="border-zinc-200 bg-white text-zinc-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                        {visibleFindings.length} total
                      </Badge>
                    </div>
                    {highRiskFindings
                      .slice()
                      .sort((a, b) => b.leverageScore - a.leverageScore || b.confidence - a.confidence)
                      .map((finding, index) => (
                        <FindingCard key={`${finding.id || finding.title}-${index}`} finding={finding} />
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="min-w-0 overflow-hidden border-zinc-200 bg-white/80 shadow-sm dark:border-white/10 dark:bg-slate-950/75">
              <CardHeader className="pb-3">
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="text-zinc-950 dark:text-white">Agent Output</CardTitle>
                    <CardDescription className="text-zinc-500 dark:text-slate-400">
                      Raw transcripts are secondary; structured findings above are what reports use.
                    </CardDescription>
                  </div>
                  <Button variant="outline" onClick={() => setShowRawOutput((value) => !value)} className="border-zinc-200 bg-white dark:border-white/10 dark:bg-white/5">
                    {showRawOutput ? "Hide raw" : "Show raw"}
                  </Button>
                </div>
              </CardHeader>
              {showRawOutput && (
                <CardContent className="space-y-4">
                  {processScope.data && (
                    <>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-600 dark:text-slate-300">
                        <Badge className={styles.button}>{processScope.data.completedAgents}/{processScope.data.totalAgents} complete</Badge>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="w-full border-zinc-200 bg-white dark:border-white/10 dark:bg-white/5 sm:ml-auto sm:w-auto"
                          onClick={() => {
                            const output = processScope.data.results
                              .map((result) => ("output" in result ? `${result.agentName}\n\n${result.output}` : `${result.agentName}\n\nFAILED: ${result.error}`))
                              .join("\n\n==============================\n\n");
                            downloadOutput(`${title} full run`, output);
                          }}
                        >
                          <Download className="mr-1 h-3.5 w-3.5" />
                          Export run
                        </Button>
                      </div>
                      {processScope.data.results.map((result) => (
                        <article key={result.agentId} className="min-w-0 rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-white/[0.035] sm:p-4">
                          <div className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-2">
                            <h3 className="min-w-0 break-words text-sm font-semibold text-zinc-950 dark:text-white">{result.agentName}</h3>
                            <div className="flex flex-wrap gap-2">
                              {"output" in result && (
                                <>
                                  <Button size="sm" variant="outline" onClick={() => copyOutput(result.agentName, result.output)} className="h-8 border-zinc-200 bg-white dark:border-white/10 dark:bg-white/5"><Copy className="mr-1 h-3.5 w-3.5" />Copy</Button>
                                  <Button size="sm" variant="outline" onClick={() => downloadOutput(result.agentName, result.output)} className="h-8 border-zinc-200 bg-white dark:border-white/10 dark:bg-white/5"><Download className="mr-1 h-3.5 w-3.5" />Export</Button>
                                </>
                              )}
                              <Badge variant={result.status === "completed" ? "secondary" : "destructive"}>{result.status}</Badge>
                            </div>
                          </div>
                          {"output" in result ? (
                            <div className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-md bg-white p-3 text-sm leading-6 text-zinc-700 dark:bg-slate-950 dark:text-slate-300">{result.output}</div>
                          ) : (
                            <p className="text-sm text-red-600 dark:text-rose-300">{result.error}</p>
                          )}
                        </article>
                      ))}
                    </>
                  )}

                  {savedRuns.length > 0 && (
                    <div className="min-w-0 space-y-3 border-t border-zinc-200 pt-4 dark:border-white/10">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <h3 className="text-base font-semibold text-zinc-950 dark:text-white">Saved Legacy Outputs</h3>
                        <Button size="sm" variant="outline" disabled={deleteSavedRuns.isPending} onClick={() => deleteSavedRuns.mutate()} className="border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-200">
                          <Trash2 className="mr-1 h-3.5 w-3.5" />
                          Delete all
                        </Button>
                      </div>
                      {savedRuns.slice(0, 8).map((run) => {
                        const output = run.output ?? "";
                        const runTitle = run.agentName || run.agentId || "Saved agent output";
                        return (
                          <article key={run.id} className="min-w-0 rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-white/[0.035] sm:p-4">
                            <div className="mb-3 flex min-w-0 flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0">
                                <h4 className="break-words text-sm font-semibold text-zinc-950 dark:text-white">{runTitle}</h4>
                                <p className="mt-1 break-words text-xs text-zinc-500 dark:text-slate-500">{run.documentName} · {new Date(run.createdAt).toLocaleString()}</p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Button size="sm" variant="outline" onClick={() => copyOutput(runTitle, output)} className="h-8 border-zinc-200 bg-white dark:border-white/10 dark:bg-white/5"><Copy className="mr-1 h-3.5 w-3.5" />Copy</Button>
                                <Button size="sm" variant="outline" onClick={() => downloadOutput(runTitle, output)} className="h-8 border-zinc-200 bg-white dark:border-white/10 dark:bg-white/5"><Download className="mr-1 h-3.5 w-3.5" />Export</Button>
                                <Button size="sm" variant="outline" disabled={deleteOutput.isPending} onClick={() => deleteOutput.mutate({ id: run.id })} className="h-8 border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-200">Delete</Button>
                              </div>
                            </div>
                            <div className="max-h-44 overflow-auto whitespace-pre-wrap break-words rounded-md bg-white p-3 text-sm leading-6 text-zinc-700 dark:bg-slate-950 dark:text-slate-300">{output || "No output text saved."}</div>
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
      </main>
    </div>
  );
}
