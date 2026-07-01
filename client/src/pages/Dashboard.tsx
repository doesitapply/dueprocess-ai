import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  CommandMain,
  CommandSurface,
  CommandTopBar,
  CommandWorkflowBar,
} from "@/components/command-ui";
import {
  useWorkspaceCaseContext,
  WorkspaceCaseStrip,
} from "@/components/WorkspaceCaseStrip";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Archive,
  ArrowRight,
  Bot,
  Brain,
  Briefcase,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  Database,
  DollarSign,
  FileCheck,
  FileOutput,
  FileSearch,
  FileText,
  FolderOpen,
  GitCompare,
  FolderSearch,
  Gauge,
  Layers3,
  Loader2,
  Plus,
  ReceiptText,
  Rocket,
  Scale,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";

type DocumentRecord = {
  id: number;
  fileName: string;
  status: string;
  mimeType?: string | null;
  createdAt?: Date | string;
};

type CommandItem = {
  title: string;
  description: string;
  route: string;
  icon: LucideIcon;
  action: string;
  tone: string;
};

type GaugeItem = {
  title: string;
  value: string | number;
  detail: string;
  loading: boolean;
  route: string;
  icon: LucideIcon;
  tone: "neutral" | "success" | "warning" | "danger" | "info";
};

type WorkspaceCaseSummary = {
  id: number | null;
  title: string;
  caseNumber?: string | null;
  jurisdiction?: string | null;
  posture?: string | null;
  strategy?: string | null;
  status: string;
  healthStatus: string;
  virtual: boolean;
  documentIds: number[];
  stats: {
    documents: number;
    completedDocuments: number;
    failedDocuments: number;
    pendingDocuments: number;
    readiness: number;
    findings: number;
    reportReadyFindings: number;
    blockedFindings: number;
    highLeverageFindings: number;
    savedReports: number;
    reportCoverage: number;
    comparisonScore: number;
  };
  nextAction: {
    label: string;
    route: string;
    detail: string;
  };
};

type ReadinessStep = {
  title: string;
  status: "live" | "partial" | "blocked";
  metric: string;
  detail: string;
  route: string;
  icon: LucideIcon;
};

type ProofGate = {
  title: string;
  status: "live" | "partial" | "blocked";
  metric: string;
  detail: string;
  route: string;
  icon: LucideIcon;
  buyerMeaning: string;
};

type ProofPacket = {
  title: string;
  buyer: string;
  status: "live" | "partial" | "blocked";
  output: string;
  buildPath: string[];
  proofNeeded: string;
  primaryRoute: string;
  secondaryRoute: string;
  primaryAction: string;
  icon: LucideIcon;
};

type OperatorRunbookStep = {
  order: number;
  title: string;
  status: "ready" | "next" | "blocked";
  route: string;
  action: string;
  detail: string;
  proof: string;
  icon: LucideIcon;
};

type SettingsOverview = {
  commercial?: {
    effectivePlan?: {
      name?: string;
      adminOverride?: boolean;
    };
    revenueReadiness?: {
      readyChecks?: number;
      totalChecks?: number;
      checkoutReadyPlans?: number;
      subscriptionPlans?: number;
      blockers?: string[];
    };
  };
};

type UsageOverview = {
  aiUsage?: {
    exactTokenTelemetryEnabled?: boolean;
    exact?: {
      calls?: number;
      totalTokens?: number;
      estimatedUsd?: number;
    };
    savedAgentOutputs?: {
      outputs?: number;
      estimatedTokens?: number;
      estimatedUsd?: number;
    };
  };
};

const WORKSPACE_ITEMS: CommandItem[] = [
  {
    title: "Corpus",
    description: "Upload, process, dedupe, and inspect extracted text.",
    route: "/sector/corpus",
    icon: Database,
    action: "Manage evidence",
    tone: "text-emerald-600 dark:text-emerald-300",
  },
  {
    title: "Evidence Review",
    description:
      "Timelines, gaps, duplicate records, contradictions, and source readiness.",
    route: "/sector/evidence",
    icon: SearchCheck,
    action: "Review record",
    tone: "text-amber-600 dark:text-amber-300",
  },
  {
    title: "Legal Analysis",
    description: "Run specialized agents and build QC-cleared legal findings.",
    route: "/sector/arsenal",
    icon: Scale,
    action: "Run agents",
    tone: "text-blue-600 dark:text-blue-300",
  },
  {
    title: "Violations",
    description:
      "Map each violation to source evidence, timeline, QC, and next action.",
    route: "/violations",
    icon: ShieldCheck,
    action: "Map violations",
    tone: "text-rose-600 dark:text-rose-300",
  },
  {
    title: "Reports",
    description:
      "Turn cleared findings into court packets and exportable reports.",
    route: "/reports",
    icon: FileText,
    action: "Build packet",
    tone: "text-violet-600 dark:text-violet-300",
  },
  {
    title: "Filing Director",
    description:
      "Tell the app what filing you need and convert it into source-bound drafting commands.",
    route: "/drafts",
    icon: Bot,
    action: "Direct draft",
    tone: "text-sky-700 dark:text-sky-300",
  },
  {
    title: "Market Command",
    description:
      "Track what is still MVP, what is sellable, and what blocks revenue.",
    route: "/market",
    icon: Rocket,
    action: "Open market map",
    tone: "text-amber-700 dark:text-amber-300",
  },
];

const workflow = [
  {
    title: "Upload",
    detail: "Add filings, exhibits, images, transcripts, and productions.",
    route: "/sector/corpus",
    icon: Upload,
  },
  {
    title: "Process",
    detail: "OCR, anchor text, find duplicates, and flag unusable files.",
    route: "/sector/corpus",
    icon: FileCheck,
  },
  {
    title: "Analyze",
    detail: "Run agents only after files are actually ready.",
    route: "/sector/arsenal",
    icon: Brain,
  },
  {
    title: "Report",
    detail: "Package QC-cleared findings into exportable work product.",
    route: "/reports",
    icon: ReceiptText,
  },
];

function formatNumber(value: number | undefined | null) {
  return new Intl.NumberFormat().format(value ?? 0);
}

function formatUsd(value: number | undefined | null) {
  return `$${Number(value ?? 0).toFixed(2)}`;
}

function formatDateTime(value: Date | string | undefined) {
  if (!value) return "unknown";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function statusTone(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "completed" || normalized === "ready") return "ready";
  if (normalized === "failed" || normalized === "error") return "blocked";
  if (normalized === "processing" || normalized === "pending") return "warning";
  return "neutral";
}

function StatusBadge({ status }: { status: string }) {
  const tone = statusTone(status);
  return (
    <Badge
      variant="outline"
      className={cn(
        "max-w-full rounded-md px-2 py-1 text-xs font-semibold",
        tone === "ready" &&
          "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200",
        tone === "warning" &&
          "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200",
        tone === "blocked" &&
          "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-200",
        tone === "neutral" &&
          "border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-white/10 dark:bg-white/10 dark:text-slate-300"
      )}
    >
      {tone === "ready" ? <CheckCircle2 className="mr-1 h-3 w-3" /> : null}
      {tone === "warning" ? <AlertTriangle className="mr-1 h-3 w-3" /> : null}
      {tone === "blocked" ? <CircleAlert className="mr-1 h-3 w-3" /> : null}
      {status}
    </Badge>
  );
}

function GaugeCard({ item }: { item: GaugeItem }) {
  const toneClass = {
    neutral: "text-zinc-950 dark:text-white",
    success: "text-emerald-600 dark:text-emerald-300",
    warning: "text-amber-600 dark:text-amber-300",
    danger: "text-red-600 dark:text-red-300",
    info: "text-blue-600 dark:text-blue-300",
  }[item.tone];
  const Icon = item.icon;

  return (
    <Link href={item.route}>
      <div className="group h-full min-w-0 rounded-md border border-zinc-200 bg-white/76 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-zinc-400 hover:bg-white dark:border-white/10 dark:bg-white/[0.045] dark:hover:border-white/25 dark:hover:bg-white/[0.075]">
        <div className="flex items-center justify-between gap-3">
          <p className="truncate text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-slate-500">
            {item.title}
          </p>
          <Icon className={cn("h-4 w-4 shrink-0", toneClass)} />
        </div>
        <p
          className={cn(
            "mt-3 break-words text-3xl font-semibold tracking-tight",
            toneClass
          )}
        >
          {item.loading ? "..." : item.value}
        </p>
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="min-w-0 break-words text-xs leading-5 text-zinc-500 dark:text-slate-400">
            {item.detail}
          </p>
          <ArrowRight className="h-4 w-4 shrink-0 text-zinc-400 opacity-0 transition-opacity group-hover:opacity-100 dark:text-slate-500" />
        </div>
      </div>
    </Link>
  );
}

function healthBadgeClass(status: string) {
  if (status === "packet_ready" || status === "findings_ready") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200";
  }
  if (status === "analysis_ready" || status === "processing") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200";
  }
  if (status === "blocked" || status === "empty") {
    return "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-200";
  }
  return "border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-200";
}

function healthLabel(status: string) {
  return status.replace(/_/g, " ");
}

function WorkspaceCaseCard({
  caseItem,
  rank,
}: {
  caseItem: WorkspaceCaseSummary;
  rank: number;
}) {
  const hasBlockedWork =
    caseItem.stats.failedDocuments > 0 || caseItem.stats.blockedFindings > 0;

  return (
    <div className="flex h-full min-w-0 flex-col rounded-md border border-zinc-200 bg-white/76 p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200">
            {caseItem.virtual ? (
              <FolderOpen className="h-5 w-5" />
            ) : (
              <Briefcase className="h-5 w-5" />
            )}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-zinc-950 dark:text-white">
              {caseItem.title}
            </p>
            <p className="mt-1 truncate text-xs text-zinc-500 dark:text-slate-500">
              {caseItem.caseNumber ||
                caseItem.jurisdiction ||
                "No case metadata"}
            </p>
          </div>
        </div>
        <Badge
          variant="outline"
          className={cn(
            "shrink-0 rounded-md",
            healthBadgeClass(caseItem.healthStatus)
          )}
        >
          {healthLabel(caseItem.healthStatus)}
        </Badge>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {[
          ["Readiness", `${caseItem.stats.readiness}%`],
          ["Findings", formatNumber(caseItem.stats.reportReadyFindings)],
          ["Packet", formatNumber(caseItem.stats.savedReports)],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-md border border-zinc-200 bg-zinc-50 p-2 dark:border-white/10 dark:bg-slate-950/55"
          >
            <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-slate-500">
              {label}
            </p>
            <p className="mt-1 text-lg font-semibold text-zinc-950 dark:text-white">
              {value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-slate-950/55">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-slate-500">
            Compare score
          </p>
          <p className="text-sm font-semibold text-zinc-950 dark:text-white">
            #{rank} · {caseItem.stats.comparisonScore}%
          </p>
        </div>
        <Progress value={caseItem.stats.comparisonScore} className="mt-3 h-2" />
        <p className="mt-3 text-xs leading-5 text-zinc-600 dark:text-slate-400">
          {caseItem.nextAction.detail}
        </p>
      </div>

      {hasBlockedWork ? (
        <div className="mt-3 rounded-md border border-red-500/25 bg-red-500/10 p-2 text-xs leading-5 text-red-700 dark:text-red-200">
          Loud problem: {formatNumber(caseItem.stats.failedDocuments)} blocked
          file
          {caseItem.stats.failedDocuments === 1 ? "" : "s"} and{" "}
          {formatNumber(caseItem.stats.blockedFindings)} held finding
          {caseItem.stats.blockedFindings === 1 ? "" : "s"}.
        </div>
      ) : null}

      <div className="mt-auto flex flex-col gap-2 pt-4 sm:flex-row">
        <Link href={caseItem.nextAction.route}>
          <Button className="w-full gap-2 bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-amber-300 dark:text-zinc-950 dark:hover:bg-amber-200 sm:w-auto">
            {caseItem.nextAction.label}
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
        <Link href="/violations">
          <Button
            variant="outline"
            className="w-full border-zinc-300 bg-white/80 text-zinc-800 hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100 sm:w-auto"
          >
            Evidence map
          </Button>
        </Link>
      </div>
    </div>
  );
}

function CaseComparisonTable({ cases }: { cases: WorkspaceCaseSummary[] }) {
  if (cases.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-white/15 dark:bg-slate-950/55 dark:text-slate-400">
        No cases yet. Create one, then assign documents from the Corpus.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-zinc-200 dark:border-white/10">
      <div className="hidden grid-cols-[minmax(12rem,1fr)_7rem_7rem_7rem_8rem_9rem] bg-zinc-50 px-3 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:bg-slate-950/70 dark:text-slate-500 md:grid">
        <span>Case</span>
        <span>Docs</span>
        <span>Ready</span>
        <span>Findings</span>
        <span>Reports</span>
        <span>Quality</span>
      </div>
      <div className="divide-y divide-zinc-200 dark:divide-white/10">
        {cases.map(caseItem => (
          <Link
            key={`${caseItem.id ?? "virtual"}-${caseItem.title}`}
            href={caseItem.nextAction.route}
          >
            <div className="grid gap-3 px-3 py-3 text-sm transition-colors hover:bg-zinc-50 dark:hover:bg-white/[0.04] md:grid-cols-[minmax(12rem,1fr)_7rem_7rem_7rem_8rem_9rem] md:items-center">
              <div className="min-w-0">
                <p className="truncate font-semibold text-zinc-950 dark:text-white">
                  {caseItem.title}
                </p>
                <p className="truncate text-xs text-zinc-500 dark:text-slate-500">
                  {caseItem.posture || caseItem.caseNumber || "No posture set"}
                </p>
              </div>
              <span>{formatNumber(caseItem.stats.documents)}</span>
              <span>{caseItem.stats.readiness}%</span>
              <span>{formatNumber(caseItem.stats.reportReadyFindings)}</span>
              <span>{formatNumber(caseItem.stats.savedReports)}</span>
              <Badge
                variant="outline"
                className={cn(
                  "w-fit rounded-md",
                  healthBadgeClass(caseItem.healthStatus)
                )}
              >
                {caseItem.stats.comparisonScore}%
              </Badge>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function CreateCasePanel({
  title,
  caseNumber,
  jurisdiction,
  isCreating,
  onTitleChange,
  onCaseNumberChange,
  onJurisdictionChange,
  onCreate,
}: {
  title: string;
  caseNumber: string;
  jurisdiction: string;
  isCreating: boolean;
  onTitleChange: (value: string) => void;
  onCaseNumberChange: (value: string) => void;
  onJurisdictionChange: (value: string) => void;
  onCreate: () => void;
}) {
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-white/10 dark:bg-slate-950/55">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-200">
          <Plus className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-950 dark:text-white">
            Create comparison case
          </p>
          <p className="mt-1 text-xs leading-5 text-zinc-600 dark:text-slate-400">
            Add a matter shell now. Document assignment comes next from Corpus.
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-2">
        <input
          value={title}
          onChange={event => onTitleChange(event.target.value)}
          placeholder="Case name"
          className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-amber-500 dark:border-white/10 dark:bg-black/20 dark:text-slate-100"
        />
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            value={caseNumber}
            onChange={event => onCaseNumberChange(event.target.value)}
            placeholder="Case number"
            className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-amber-500 dark:border-white/10 dark:bg-black/20 dark:text-slate-100"
          />
          <input
            value={jurisdiction}
            onChange={event => onJurisdictionChange(event.target.value)}
            placeholder="Jurisdiction"
            className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-amber-500 dark:border-white/10 dark:bg-black/20 dark:text-slate-100"
          />
        </div>
        <Button
          onClick={onCreate}
          disabled={isCreating || title.trim().length < 2}
          className="mt-1 gap-2 bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-amber-300 dark:text-zinc-950 dark:hover:bg-amber-200"
        >
          {isCreating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Create case
        </Button>
      </div>
    </div>
  );
}

function CaseAssignmentPanel({
  cases,
  documents,
  selectedCaseId,
  selectedDocumentIds,
  isSaving,
  onCaseChange,
  onDocumentToggle,
  onSave,
}: {
  cases: WorkspaceCaseSummary[];
  documents: DocumentRecord[];
  selectedCaseId: string;
  selectedDocumentIds: number[];
  isSaving: boolean;
  onCaseChange: (caseId: string) => void;
  onDocumentToggle: (documentId: number) => void;
  onSave: () => void;
}) {
  const selectedSet = new Set(selectedDocumentIds);

  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-white/10 dark:bg-slate-950/55">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200">
          <FolderSearch className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-950 dark:text-white">
            Assign evidence to a case
          </p>
          <p className="mt-1 text-xs leading-5 text-zinc-600 dark:text-slate-400">
            These memberships drive case comparison, report scope, and quality
            scoring.
          </p>
        </div>
      </div>

      <select
        value={selectedCaseId}
        onChange={event => onCaseChange(event.target.value)}
        className="mt-4 h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-amber-500 dark:border-white/10 dark:bg-black/20 dark:text-slate-100"
      >
        <option value="">Choose a durable case</option>
        {cases.map(caseItem => (
          <option key={caseItem.id ?? caseItem.title} value={caseItem.id ?? ""}>
            {caseItem.title}
          </option>
        ))}
      </select>

      <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
        {documents.length === 0 ? (
          <p className="rounded-md border border-dashed border-zinc-300 p-3 text-xs text-zinc-600 dark:border-white/15 dark:text-slate-400">
            No documents exist yet. Upload evidence before assigning cases.
          </p>
        ) : (
          documents.slice(0, 16).map(document => (
            <label
              key={document.id}
              className="flex cursor-pointer items-start gap-3 rounded-md border border-zinc-200 bg-white p-2 text-xs transition hover:border-zinc-400 dark:border-white/10 dark:bg-black/20 dark:hover:border-white/25"
            >
              <input
                type="checkbox"
                checked={selectedSet.has(document.id)}
                onChange={() => onDocumentToggle(document.id)}
                disabled={!selectedCaseId}
                className="mt-1 h-4 w-4 rounded border-zinc-300"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-zinc-800 dark:text-slate-200">
                  {document.fileName}
                </span>
                <span className="mt-1 block text-zinc-500 dark:text-slate-500">
                  {document.status}
                </span>
              </span>
            </label>
          ))
        )}
        {documents.length > 16 ? (
          <p className="text-xs text-zinc-500 dark:text-slate-500">
            Showing first 16 documents. Use Corpus for deeper assignment once
            the dedicated case page lands.
          </p>
        ) : null}
      </div>

      <Button
        onClick={onSave}
        disabled={!selectedCaseId || isSaving}
        className="mt-3 w-full gap-2 bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-emerald-300 dark:text-zinc-950 dark:hover:bg-emerald-200"
      >
        {isSaving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FolderSearch className="h-4 w-4" />
        )}
        Save case evidence
      </Button>
    </div>
  );
}

function ReadinessCard({ step }: { step: ReadinessStep }) {
  const Icon = step.icon;
  const toneClass =
    step.status === "live"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
      : step.status === "partial"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200"
        : "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-200";

  return (
    <Link href={step.route}>
      <div className="group h-full rounded-md border border-zinc-200 bg-zinc-50 p-4 transition-all hover:-translate-y-0.5 hover:border-zinc-400 hover:bg-white dark:border-white/10 dark:bg-slate-950/55 dark:hover:border-white/25 dark:hover:bg-white/[0.07]">
        <div className="flex items-start justify-between gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-800 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-200">
            <Icon className="h-5 w-5" />
          </span>
          <Badge variant="outline" className={cn("rounded-md", toneClass)}>
            {step.status === "live" ? "live" : step.status}
          </Badge>
        </div>
        <p className="mt-4 text-sm font-semibold text-zinc-950 dark:text-white">
          {step.title}
        </p>
        <p className="mt-1 text-xl font-semibold tracking-tight text-zinc-950 dark:text-white">
          {step.metric}
        </p>
        <p className="mt-2 text-xs leading-5 text-zinc-600 dark:text-slate-400">
          {step.detail}
        </p>
        <div className="mt-4 flex items-center text-xs font-semibold text-amber-700 opacity-0 transition-opacity group-hover:opacity-100 dark:text-amber-300">
          Open
          <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </div>
      </div>
    </Link>
  );
}

function ProofGateCard({ gate }: { gate: ProofGate }) {
  const Icon = gate.icon;
  const toneClass =
    gate.status === "live"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
      : gate.status === "partial"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200"
        : "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-200";

  return (
    <Link href={gate.route}>
      <div className="group flex h-full min-w-0 flex-col rounded-md border border-zinc-200 bg-white/72 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-zinc-400 hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-white/25 dark:hover:bg-white/[0.075]">
        <div className="flex items-start justify-between gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 text-zinc-800 dark:border-white/10 dark:bg-black/20 dark:text-slate-200">
            <Icon className="h-5 w-5" />
          </span>
          <Badge variant="outline" className={cn("rounded-md", toneClass)}>
            {gate.status}
          </Badge>
        </div>
        <div className="mt-4 min-w-0">
          <p className="text-sm font-semibold text-zinc-950 dark:text-white">
            {gate.title}
          </p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-white">
            {gate.metric}
          </p>
          <p className="mt-2 text-xs leading-5 text-zinc-600 dark:text-slate-400">
            {gate.detail}
          </p>
        </div>
        <div className="mt-auto pt-4">
          <div className="rounded-md border border-zinc-200 bg-zinc-50 p-2 text-xs leading-5 text-zinc-600 dark:border-white/10 dark:bg-slate-950/55 dark:text-slate-300">
            {gate.buyerMeaning}
          </div>
          <div className="mt-3 flex items-center text-xs font-semibold text-amber-700 opacity-0 transition-opacity group-hover:opacity-100 dark:text-amber-300">
            Open proof
            <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </div>
        </div>
      </div>
    </Link>
  );
}

function ProofPacketCard({ packet }: { packet: ProofPacket }) {
  const Icon = packet.icon;
  const toneClass =
    packet.status === "live"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
      : packet.status === "partial"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200"
        : "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-200";

  return (
    <div className="flex h-full min-w-0 flex-col rounded-md border border-zinc-200 bg-zinc-50 p-4 shadow-sm dark:border-white/10 dark:bg-slate-950/55">
      <div className="flex items-start justify-between gap-3">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200">
          <Icon className="h-5 w-5" />
        </span>
        <Badge variant="outline" className={cn("rounded-md", toneClass)}>
          {packet.status}
        </Badge>
      </div>
      <div className="mt-4 min-w-0">
        <p className="text-sm font-semibold text-zinc-950 dark:text-white">
          {packet.title}
        </p>
        <p className="mt-1 text-xs font-medium text-zinc-500 dark:text-slate-500">
          Buyer: {packet.buyer}
        </p>
        <div className="mt-3 rounded-md border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs leading-5 text-emerald-800 dark:text-emerald-100">
          <p className="font-semibold">Deliverable</p>
          <p className="mt-1">{packet.output}</p>
        </div>
      </div>
      <div className="mt-4 space-y-3 text-xs leading-5">
        <div>
          <p className="font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-slate-500">
            Build path
          </p>
          <ol className="mt-2 space-y-1 text-zinc-700 dark:text-slate-300">
            {packet.buildPath.map((step, index) => (
              <li key={step} className="flex gap-2">
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-zinc-300 text-[0.65rem] font-semibold text-zinc-600 dark:border-white/15 dark:text-slate-300">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="rounded-md border border-amber-500/25 bg-amber-500/10 p-2 text-amber-800 dark:text-amber-100">
          <p className="font-semibold">Proof still needed</p>
          <p className="mt-1">{packet.proofNeeded}</p>
        </div>
      </div>
      <div className="mt-auto flex flex-col gap-2 pt-4 sm:flex-row">
        <Link href={packet.primaryRoute}>
          <Button className="w-full gap-2 bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-amber-300 dark:text-zinc-950 dark:hover:bg-amber-200 sm:w-auto">
            {packet.primaryAction}
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
        <Link href={packet.secondaryRoute}>
          <Button
            variant="outline"
            className="w-full border-zinc-300 bg-white/80 text-zinc-800 hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100 sm:w-auto"
          >
            Market fit
          </Button>
        </Link>
      </div>
    </div>
  );
}

function RunbookStepCard({ step }: { step: OperatorRunbookStep }) {
  const Icon = step.icon;
  const toneClass =
    step.status === "ready"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
      : step.status === "next"
        ? "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-200"
        : "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-200";

  return (
    <Link href={step.route}>
      <div className="group h-full rounded-md border border-zinc-200 bg-zinc-50 p-4 transition-all hover:-translate-y-0.5 hover:border-zinc-400 hover:bg-white dark:border-white/10 dark:bg-slate-950/55 dark:hover:border-white/25 dark:hover:bg-white/[0.07]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-white text-xs font-semibold text-zinc-700 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-200">
              {step.order}
            </span>
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-200">
              <Icon className="h-5 w-5" />
            </span>
          </div>
          <Badge variant="outline" className={cn("rounded-md", toneClass)}>
            {step.status === "ready"
              ? "ready"
              : step.status === "next"
                ? "next"
                : "blocked"}
          </Badge>
        </div>
        <p className="mt-4 text-sm font-semibold text-zinc-950 dark:text-white">
          {step.title}
        </p>
        <p className="mt-2 text-xs leading-5 text-zinc-600 dark:text-slate-400">
          {step.detail}
        </p>
        <div className="mt-4 rounded-md border border-zinc-200 bg-white p-2 text-xs leading-5 text-zinc-700 dark:border-white/10 dark:bg-black/20 dark:text-slate-300">
          <span className="font-semibold text-amber-700 dark:text-amber-300">
            Proof:
          </span>{" "}
          {step.proof}
        </div>
        <div className="mt-4 flex items-center text-xs font-semibold text-blue-700 opacity-0 transition-opacity group-hover:opacity-100 dark:text-blue-300">
          {step.action}
          <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </div>
      </div>
    </Link>
  );
}

function SectionShell({
  title,
  description,
  icon: Icon,
  children,
  className,
  id,
}: {
  title: string;
  description?: string;
  icon: LucideIcon;
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "rounded-md border border-zinc-200 bg-white/82 shadow-sm backdrop-blur dark:border-white/10 dark:bg-[#111722]/82",
        className
      )}
    >
      <div className="border-b border-zinc-200 px-4 py-4 dark:border-white/10 sm:px-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-200">
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="break-words text-base font-semibold tracking-tight text-zinc-950 dark:text-white">
              {title}
            </h2>
            {description ? (
              <p className="mt-1 break-words text-sm leading-5 text-zinc-600 dark:text-slate-400">
                {description}
              </p>
            ) : null}
          </div>
        </div>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

export default function Dashboard() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const trpcUtils = trpc.useUtils();
  const [newCaseTitle, setNewCaseTitle] = useState("");
  const [newCaseNumber, setNewCaseNumber] = useState("");
  const [newCaseJurisdiction, setNewCaseJurisdiction] = useState("");
  const [assignmentCaseId, setAssignmentCaseId] = useState("");
  const [assignmentDocumentIds, setAssignmentDocumentIds] = useState<number[]>(
    []
  );
  const { data: documents = [], isLoading: documentsLoading } =
    trpc.documents.list.useQuery(undefined, {
      enabled: isAuthenticated,
    });
  const casesQuery = trpc.cases.list.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
  });
  const createCaseMutation = trpc.cases.create.useMutation({
    onSuccess: async () => {
      setNewCaseTitle("");
      setNewCaseNumber("");
      setNewCaseJurisdiction("");
      await trpcUtils.cases.list.invalidate();
      toast.success("Case created");
    },
    onError: error => toast.error(error.message),
  });
  const setCaseDocumentsMutation = trpc.cases.setDocuments.useMutation({
    onSuccess: async () => {
      await trpcUtils.cases.list.invalidate();
      toast.success("Case evidence saved");
    },
    onError: error => toast.error(error.message),
  });
  const savedReportsQuery = trpc.reports.saved.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const overviewQuery = trpc.settings.overview.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const usageQuery = trpc.settings.usage.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const reportPreviewQuery = trpc.reports.preview.useQuery(
    { scope: "case", minConfidence: 0 },
    { enabled: isAuthenticated && documents.length > 0, retry: false }
  );

  const typedDocuments = documents as DocumentRecord[];
  const workspaceCases = (casesQuery.data?.cases ??
    []) as WorkspaceCaseSummary[];
  const { activeCase: activeWorkspaceCase, isWholeWorkspace } =
    useWorkspaceCaseContext();
  const durableWorkspaceCases = workspaceCases.filter(
    caseItem => !caseItem.virtual && caseItem.id !== null
  );
  const migrationRequired = Boolean(casesQuery.data?.migrationRequired);
  const overview = overviewQuery.data as SettingsOverview | undefined;
  const usage = usageQuery.data as UsageOverview | undefined;
  const completedDocuments = typedDocuments.filter(
    document => document.status === "completed"
  ).length;
  const failedDocuments = typedDocuments.filter(
    document => document.status === "failed"
  ).length;
  const pendingDocuments = typedDocuments.filter(
    document =>
      document.status === "pending" || document.status === "processing"
  ).length;
  const readiness =
    typedDocuments.length > 0
      ? Math.round((completedDocuments / typedDocuments.length) * 100)
      : 0;
  const reportReadyFindings =
    reportPreviewQuery.data?.statistics.reportReadyFindings ?? 0;
  const blockedFindings =
    reportPreviewQuery.data?.statistics.blockedFindingsInScope ?? 0;
  const savedReports = savedReportsQuery.data ?? [];
  const hasDocuments = typedDocuments.length > 0;
  const revenueReadiness = overview?.commercial?.revenueReadiness;
  const revenueBlockers = revenueReadiness?.blockers ?? [];
  const checkoutReadyPlans = revenueReadiness?.checkoutReadyPlans ?? 0;
  const activePlan = overview?.commercial?.effectivePlan?.name ?? "Free";
  const exactUsageCalls = usage?.aiUsage?.exact?.calls ?? 0;
  const exactUsageTokens = usage?.aiUsage?.exact?.totalTokens ?? 0;
  const exactUsageCost = usage?.aiUsage?.exact?.estimatedUsd ?? 0;
  const savedOutputCount = usage?.aiUsage?.savedAgentOutputs?.outputs ?? 0;
  const savedOutputTokens =
    usage?.aiUsage?.savedAgentOutputs?.estimatedTokens ?? 0;
  const hasExactTelemetry =
    usage?.aiUsage?.exactTokenTelemetryEnabled || exactUsageCalls > 0;
  const commercialScore =
    revenueReadiness && revenueReadiness.totalChecks
      ? Math.round(
          ((revenueReadiness.readyChecks ?? 0) / revenueReadiness.totalChecks) *
            100
        )
      : 0;
  const pipelineScore = Math.round(
    ([
      completedDocuments > 0,
      failedDocuments === 0 && pendingDocuments === 0 && completedDocuments > 0,
      reportReadyFindings > 0,
      savedReports.length > 0,
      checkoutReadyPlans > 0 && revenueBlockers.length === 0,
    ].filter(Boolean).length /
      5) *
      100
  );
  const activeDashboardCase =
    (activeWorkspaceCase as WorkspaceCaseSummary | null) ??
    workspaceCases[0] ??
    null;
  const activeCaseStats = activeDashboardCase?.stats;
  const activeCaseHealth = activeDashboardCase?.healthStatus ?? "empty";
  const activeCaseHasProblems =
    (activeCaseStats?.failedDocuments ?? failedDocuments) > 0 ||
    (activeCaseStats?.pendingDocuments ?? pendingDocuments) > 0 ||
    (activeCaseStats?.blockedFindings ?? blockedFindings) > 0;
  const caseLaneCount = durableWorkspaceCases.length;
  const comparisonReady = caseLaneCount >= 2;

  const nextAction = useMemo(() => {
    if (documentsLoading) {
      return {
        title: "Loading case record",
        detail:
          "DueProcess is pulling the Corpus state before recommending the next move.",
        route: "/sector/corpus",
        cta: "Open Corpus",
        icon: Loader2,
        tone: "info",
      };
    }
    if (!hasDocuments) {
      return {
        title: "Upload the record",
        detail:
          "No documents are in the Corpus yet. Start by adding the actual case files.",
        route: "/sector/corpus",
        cta: "Upload documents",
        icon: Upload,
        tone: "warning",
      };
    }
    if (failedDocuments > 0) {
      return {
        title: "Fix blocked OCR",
        detail: `${failedDocuments} document${failedDocuments === 1 ? "" : "s"} failed extraction. Agents and reports should not touch bad text.`,
        route: "/sector/corpus?status=failed",
        cta: "Review blocked files",
        icon: CircleAlert,
        tone: "danger",
      };
    }
    if (pendingDocuments > 0) {
      return {
        title: "Let processing finish",
        detail: `${pendingDocuments} document${pendingDocuments === 1 ? "" : "s"} still pending or processing. Legal runs should wait.`,
        route: "/sector/corpus?status=active",
        cta: "Check processing",
        icon: Gauge,
        tone: "warning",
      };
    }
    if (reportPreviewQuery.isLoading) {
      return {
        title: "Checking report readiness",
        detail:
          "The Corpus is ready. DueProcess is checking whether QC-cleared findings are available for reports.",
        route: "/sector/arsenal",
        cta: "Review Legal Analysis",
        icon: Loader2,
        tone: "info",
      };
    }
    if (reportReadyFindings === 0) {
      return {
        title: "Run legal analysis",
        detail:
          "The Corpus is ready, but there are no report-ready findings yet.",
        route: "/sector/arsenal",
        cta: "Open Legal Analysis",
        icon: Brain,
        tone: "info",
      };
    }
    return {
      title: "Build the packet",
      detail: `${reportReadyFindings} report-ready finding${reportReadyFindings === 1 ? "" : "s"} can be turned into work product.`,
      route: "/reports",
      cta: "Build report",
      icon: ReceiptText,
      tone: "success",
    };
  }, [
    documentsLoading,
    failedDocuments,
    hasDocuments,
    pendingDocuments,
    reportPreviewQuery.isLoading,
    reportReadyFindings,
  ]);

  const gauges: GaugeItem[] = [
    {
      title: "Corpus readiness",
      value: `${readiness}%`,
      detail: `${formatNumber(completedDocuments)} of ${formatNumber(typedDocuments.length)} files ready`,
      loading: documentsLoading,
      route: "/sector/corpus",
      icon: Database,
      tone:
        readiness === 100 && typedDocuments.length > 0
          ? "success"
          : typedDocuments.length > 0
            ? "warning"
            : "neutral",
    },
    {
      title: "Blocked OCR",
      value: failedDocuments,
      detail:
        failedDocuments > 0
          ? "needs attention before agents run"
          : "no extraction failures",
      loading: documentsLoading,
      route: "/sector/corpus?status=failed",
      icon: CircleAlert,
      tone: failedDocuments > 0 ? "danger" : "success",
    },
    {
      title: "Report-ready findings",
      value: reportReadyFindings,
      detail: `${formatNumber(blockedFindings)} blocked or held by QC`,
      loading: reportPreviewQuery.isLoading && hasDocuments,
      route: "/sector/arsenal",
      icon: ShieldCheck,
      tone: reportReadyFindings > 0 ? "success" : "info",
    },
    {
      title: "Saved reports",
      value: savedReports.length,
      detail: "durable packets and exports",
      loading: savedReportsQuery.isLoading,
      route: "/reports",
      icon: Archive,
      tone: "info",
    },
  ];

  const readinessSteps: ReadinessStep[] = [
    {
      title: "Intake proof",
      status:
        typedDocuments.length === 0
          ? "blocked"
          : failedDocuments > 0 || pendingDocuments > 0
            ? "partial"
            : "live",
      metric: `${formatNumber(completedDocuments)}/${formatNumber(typedDocuments.length)} ready`,
      detail:
        failedDocuments > 0
          ? `${failedDocuments} extraction failure${failedDocuments === 1 ? "" : "s"} need review before analysis.`
          : typedDocuments.length > 0
            ? "Corpus has usable text for analysis."
            : "Upload real files before the product can prove anything.",
      route: "/sector/corpus",
      icon: Database,
    },
    {
      title: "Leverage proof",
      status:
        reportReadyFindings > 0
          ? "live"
          : completedDocuments > 0
            ? "partial"
            : "blocked",
      metric: `${formatNumber(reportReadyFindings)} ready`,
      detail:
        reportReadyFindings > 0
          ? `${formatNumber(blockedFindings)} findings are blocked or held by QC.`
          : "Run legal analysis after intake is ready.",
      route: "/violations",
      icon: ShieldCheck,
    },
    {
      title: "Output proof",
      status:
        savedReports.length > 0
          ? "live"
          : reportReadyFindings > 0
            ? "partial"
            : "blocked",
      metric: `${formatNumber(savedReports.length)} reports`,
      detail:
        savedReports.length > 0
          ? "Saved packets exist and can be exported."
          : "The sale is the packet. Generate one from QC-cleared findings.",
      route: "/reports",
      icon: ReceiptText,
    },
    {
      title: "Revenue proof",
      status:
        checkoutReadyPlans > 0 && revenueBlockers.length === 0
          ? "live"
          : checkoutReadyPlans > 0 || activePlan !== "Free"
            ? "partial"
            : "blocked",
      metric:
        checkoutReadyPlans > 0
          ? `${formatNumber(checkoutReadyPlans)} checkout`
          : activePlan,
      detail:
        revenueBlockers.length > 0
          ? `${revenueBlockers.length} money blocker${revenueBlockers.length === 1 ? "" : "s"} still visible in Settings.`
          : "Pricing and billing are ready enough for the current state.",
      route: "/settings",
      icon: Rocket,
    },
  ];

  const proofGates: ProofGate[] = [
    {
      title: "Real record intake",
      status:
        typedDocuments.length === 0
          ? "blocked"
          : completedDocuments > 0
            ? "live"
            : "partial",
      metric: `${formatNumber(typedDocuments.length)} files`,
      detail:
        typedDocuments.length > 0
          ? `${formatNumber(completedDocuments)} ready, ${formatNumber(pendingDocuments)} pending, ${formatNumber(failedDocuments)} blocked.`
          : "No case documents are loaded yet.",
      route: "/sector/corpus",
      icon: Database,
      buyerMeaning:
        "A buyer pays for real document work, not a blank demo shell.",
    },
    {
      title: "Source trust",
      status:
        completedDocuments > 0 &&
        failedDocuments === 0 &&
        pendingDocuments === 0
          ? "live"
          : completedDocuments > 0
            ? "partial"
            : "blocked",
      metric: `${readiness}%`,
      detail:
        failedDocuments > 0
          ? "Blocked OCR must be loud and excluded from analysis."
          : "Ready files can be inspected before agents touch them.",
      route: "/sector/corpus",
      icon: SearchCheck,
      buyerMeaning:
        "This is the hallucination guardrail: bad extraction cannot quietly become legal analysis.",
    },
    {
      title: "Findings engine",
      status:
        reportReadyFindings > 0
          ? "live"
          : completedDocuments > 0
            ? "partial"
            : "blocked",
      metric: `${formatNumber(reportReadyFindings)} ready`,
      detail: `${formatNumber(blockedFindings)} findings are blocked or held by QC.`,
      route: "/violations",
      icon: ShieldCheck,
      buyerMeaning:
        "The sellable thing is structured, QC-visible findings tied back to records.",
    },
    {
      title: "Exportable work product",
      status:
        savedReports.length > 0
          ? "live"
          : reportReadyFindings > 0
            ? "partial"
            : "blocked",
      metric: `${formatNumber(savedReports.length)} packets`,
      detail:
        savedReports.length > 0
          ? "Saved reports exist and can leave the app."
          : "Generate at least one court-safe packet from cleared findings.",
      route: "/reports",
      icon: FileOutput,
      buyerMeaning:
        "Money comes from a usable packet: report, appendix, demand, motion scaffold, or export.",
    },
    {
      title: "Cost telemetry",
      status:
        hasExactTelemetry || exactUsageCalls > 0
          ? "live"
          : savedOutputCount > 0
            ? "partial"
            : "blocked",
      metric:
        exactUsageCalls > 0
          ? `${formatNumber(exactUsageCalls)} calls`
          : `${formatNumber(savedOutputCount)} outputs`,
      detail:
        exactUsageCalls > 0
          ? `${formatNumber(exactUsageTokens)} exact tokens, ${formatUsd(exactUsageCost)} estimated cost.`
          : `${formatNumber(savedOutputTokens)} estimated saved-output tokens.`,
      route: "/settings",
      icon: ClipboardCheck,
      buyerMeaning:
        "You cannot price firm usage honestly until token and run costs show up.",
    },
    {
      title: "Billing path",
      status:
        checkoutReadyPlans > 0 && revenueBlockers.length === 0
          ? "live"
          : checkoutReadyPlans > 0 || activePlan !== "Free"
            ? "partial"
            : "blocked",
      metric:
        checkoutReadyPlans > 0
          ? `${formatNumber(checkoutReadyPlans)} ready`
          : activePlan,
      detail:
        revenueBlockers.length > 0
          ? `${formatNumber(revenueBlockers.length)} blocker${revenueBlockers.length === 1 ? "" : "s"} in Settings.`
          : "No billing blocker reported by Settings.",
      route: revenueBlockers.length > 0 ? "/settings" : "/pricing",
      icon: DollarSign,
      buyerMeaning:
        "If checkout and limits are fuzzy, revenue is still pretend money.",
    },
  ];

  const proofPackets: ProofPacket[] = [
    {
      title: "Case Builder packet",
      buyer: "Pro se litigants and families",
      status:
        savedReports.length > 0
          ? "live"
          : reportReadyFindings > 0 || completedDocuments > 0
            ? "partial"
            : "blocked",
      output:
        "Plain-English timeline, issue map, missing-record list, next actions, and source appendix.",
      buildPath: [
        "Upload focused case records",
        "Fix OCR and inspect extracted text",
        "Run guided analysis after files are ready",
        "Export a court-safe packet",
      ],
      proofNeeded:
        savedReports.length > 0
          ? "Have a stranger read the export without app context and mark where they get lost."
          : "Generate one saved report from real or realistic records.",
      primaryRoute: "/reports",
      secondaryRoute: "/market",
      primaryAction: "Build packet",
      icon: Scale,
    },
    {
      title: "Civil-rights leverage memo",
      buyer: "Plaintiff firms and investigators",
      status:
        reportReadyFindings > 0 && savedReports.length > 0
          ? "live"
          : reportReadyFindings > 0
            ? "partial"
            : "blocked",
      output:
        "Ranked claims, Monell/pattern gaps, adverse facts, missing records, QC status, and exportable appendix.",
      buildPath: [
        "Process discovery-heavy records",
        "Map violations to sources",
        "Select high-leverage findings",
        "Export PDF/DOCX for attorney review",
      ],
      proofNeeded:
        reportReadyFindings > 0
          ? "Run this on one closed discovery set and compare against manual review."
          : "Create source-bound, QC-visible violation findings first.",
      primaryRoute: "/violations",
      secondaryRoute: "/market",
      primaryAction: "Open violations",
      icon: ShieldCheck,
    },
    {
      title: "Mandamus / writ packet",
      buyer: "Defense, post-conviction, urgent procedural relief",
      status: savedReports.some(report =>
        report.template?.toLowerCase().includes("mandamus")
      )
        ? "live"
        : reportReadyFindings > 0
          ? "partial"
          : "blocked",
      output:
        "Clear-duty gate, no-adequate-remedy analysis, appendix checklist, route lane, and guarded petition scaffold.",
      buildPath: [
        "Pick the stuck procedural issue",
        "Use the mandamus filing command",
        "Demand missing orders/transcripts/logs",
        "Export a writ-quality packet",
      ],
      proofNeeded:
        "A saved mandamus packet must classify FILE_WRIT, DEMAND_RECORDS_FIRST, PRESERVE_FOR_APPEAL, or NOT_MANDAMUS without treating gaps as proven misconduct.",
      primaryRoute: "/reports#draft-command",
      secondaryRoute: "/market",
      primaryAction: "Open writ builder",
      icon: FileOutput,
    },
    {
      title: "Defense transcript / Brady review",
      buyer: "Public defense, innocence, habeas, mitigation",
      status:
        reportReadyFindings > 0 && blockedFindings >= 0 ? "partial" : "blocked",
      output:
        "Brady/Napue tracker, competency gap map, speedy-trial/delay posture, contradictions, and writ/remedy routing.",
      buildPath: [
        "Upload transcript/order/discovery bundle",
        "Run criminal procedure and contradiction agents",
        "Capture adverse facts and missing records",
        "Generate doctrine-specific packet",
      ],
      proofNeeded:
        "Needs doctrine-specific saved packets and authority verification before this is hard-sold.",
      primaryRoute: "/sector/arsenal",
      secondaryRoute: "/market",
      primaryAction: "Run analysis",
      icon: FileSearch,
    },
    {
      title: "Watchdog evidence ledger",
      buyer: "Journalists, public-records teams, watchdogs",
      status:
        savedReports.length > 0 && reportReadyFindings > 0
          ? "partial"
          : "blocked",
      output:
        "Actor/date/source ledger, contradiction signals, missing-record targets, source quotes, and public/private export controls.",
      buildPath: [
        "Ingest public-records batch",
        "Build timeline and actor map",
        "Tie signals to source quotes",
        "Export checkable evidence ledger",
      ],
      proofNeeded:
        "Needs public/private archive controls and source-led exports before outside projects.",
      primaryRoute: "/violations",
      secondaryRoute: "/market",
      primaryAction: "Open ledger",
      icon: SearchCheck,
    },
  ];

  const operatorRunbook: OperatorRunbookStep[] = [
    {
      order: 1,
      title: "Lock the record",
      status:
        completedDocuments > 0 &&
        failedDocuments === 0 &&
        pendingDocuments === 0
          ? "ready"
          : hasDocuments
            ? "next"
            : "blocked",
      route: "/sector/corpus",
      action:
        completedDocuments > 0 &&
        failedDocuments === 0 &&
        pendingDocuments === 0
          ? "Review Corpus"
          : "Fix intake",
      detail: hasDocuments
        ? `${formatNumber(completedDocuments)} ready, ${formatNumber(pendingDocuments)} processing, ${formatNumber(failedDocuments)} blocked.`
        : "Upload the real case file set before running legal work.",
      proof:
        "Analysis-ready files with extracted text, visible failures, and no silent bad OCR.",
      icon: Database,
    },
    {
      order: 2,
      title: "Create source-bound findings",
      status:
        reportReadyFindings > 0
          ? "ready"
          : completedDocuments > 0
            ? "next"
            : "blocked",
      route: "/sector/arsenal",
      action: reportReadyFindings > 0 ? "Review findings" : "Run analysis",
      detail:
        reportReadyFindings > 0
          ? `${formatNumber(reportReadyFindings)} report-ready finding${reportReadyFindings === 1 ? "" : "s"}; ${formatNumber(blockedFindings)} blocked or held by QC.`
          : "Run Legal Analysis only after files are ready.",
      proof:
        "Structured findings with source support, confidence, QC status, remedy path, and missing records.",
      icon: Scale,
    },
    {
      order: 3,
      title: "Generate the outside-app packet",
      status:
        savedReports.length > 0
          ? "ready"
          : reportReadyFindings > 0
            ? "next"
            : "blocked",
      route: "/reports#draft-command",
      action: savedReports.length > 0 ? "Open reports" : "Build packet",
      detail:
        savedReports.length > 0
          ? `${formatNumber(savedReports.length)} saved packet${savedReports.length === 1 ? "" : "s"} available for export.`
          : "Use the filing director to choose mandamus, appeal, discovery, or court-packet posture.",
      proof:
        "PDF/DOCX/Markdown/JSON work product with source appendix and filing readiness review.",
      icon: ReceiptText,
    },
    {
      order: 4,
      title: "Turn proof into a sale",
      status:
        checkoutReadyPlans > 0 && revenueBlockers.length === 0
          ? "ready"
          : savedReports.length > 0
            ? "next"
            : "blocked",
      route: checkoutReadyPlans > 0 ? "/market" : "/settings",
      action:
        checkoutReadyPlans > 0 && revenueBlockers.length === 0
          ? "Open market map"
          : "Fix monetization",
      detail:
        checkoutReadyPlans > 0
          ? `${formatNumber(checkoutReadyPlans)} checkout plan${checkoutReadyPlans === 1 ? "" : "s"} ready; ${formatNumber(revenueBlockers.length)} blocker${revenueBlockers.length === 1 ? "" : "s"}.`
          : "Billing, usage limits, and buyer-lane proof decide whether this is a demo or a business.",
      proof:
        "A buyer-specific packet plus working checkout, usage telemetry, and server-side limits.",
      icon: DollarSign,
    },
  ];

  const privateBetaScore = Math.round(
    (proofGates.reduce((sum, gate) => {
      if (gate.status === "live") return sum + 1;
      if (gate.status === "partial") return sum + 0.5;
      return sum;
    }, 0) /
      proofGates.length) *
      100
  );
  const nextProofGate =
    proofGates.find(gate => gate.status === "blocked") ??
    proofGates.find(gate => gate.status === "partial") ??
    proofGates[proofGates.length - 1];

  const previewFindings = (reportPreviewQuery.data?.findings ?? []) as Array<{
    id: number;
    title: string;
    agentName: string;
    findingType: string;
    confidence: number;
    leverageScore: number;
    qcStatus: string;
  }>;
  const topFindings = previewFindings.slice(0, 5);
  const NextIcon = nextAction.icon;
  const handleCreateCase = () => {
    const title = newCaseTitle.trim();
    if (title.length < 2) {
      toast.error("Add a case name first.");
      return;
    }

    createCaseMutation.mutate({
      title,
      caseNumber: newCaseNumber.trim() || undefined,
      jurisdiction: newCaseJurisdiction.trim() || undefined,
      posture: "New case workspace",
      strategy:
        "Assign documents, run source-bound analysis, compare findings, and generate exportable work product.",
    });
  };
  const handleAssignmentCaseChange = (caseId: string) => {
    setAssignmentCaseId(caseId);
    const selectedCase = durableWorkspaceCases.find(
      caseItem => String(caseItem.id) === caseId
    );
    setAssignmentDocumentIds(selectedCase?.documentIds ?? []);
  };
  const handleDocumentAssignmentToggle = (documentId: number) => {
    setAssignmentDocumentIds(current =>
      current.includes(documentId)
        ? current.filter(id => id !== documentId)
        : [...current, documentId]
    );
  };
  const handleSaveCaseDocuments = () => {
    const caseId = Number(assignmentCaseId);
    if (!Number.isFinite(caseId)) {
      toast.error("Choose a case first.");
      return;
    }

    setCaseDocumentsMutation.mutate({
      caseId,
      documentIds: assignmentDocumentIds,
    });
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#090b0f]">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-300" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#090b0f] px-6">
        <div className="max-w-md space-y-4 text-center">
          <h2 className="text-2xl font-semibold text-white">
            Please sign in to continue
          </h2>
          <p className="text-sm leading-6 text-slate-400">
            DueProcess needs an authenticated workspace before it can show case
            records, reports, or legal findings.
          </p>
          <a href={getLoginUrl()}>
            <Button
              size="lg"
              className="bg-emerald-400 text-zinc-950 hover:bg-emerald-300"
            >
              Sign In
            </Button>
          </a>
        </div>
      </div>
    );
  }

  return (
    <CommandSurface>
      <CommandTopBar
        title="Case Operations Command"
        eyebrow="Dashboard"
        backHref="/"
        backLabel="Home"
        actions={
          <>
            <Badge
              variant="outline"
              className="hidden border-zinc-300 bg-white/70 text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 md:inline-flex"
            >
              {user?.name || user?.email}
            </Badge>
            <Link href="/drafts">
              <Button
                size="sm"
                className="gap-2 bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-amber-300 dark:text-zinc-950 dark:hover:bg-amber-200"
              >
                <Bot className="h-4 w-4" />
                Filing Director
              </Button>
            </Link>
          </>
        }
      />

      <CommandMain>
        <WorkspaceCaseStrip className="mb-3" />
        <CommandWorkflowBar className="mb-3" />

        {migrationRequired ? (
          <div className="mb-3 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-100">
            <AlertTriangle className="mr-2 inline h-4 w-4" />
            Workspace case tables need migration before durable comparison is
            fully reliable.
          </div>
        ) : null}

        <section className="mb-4 overflow-hidden rounded-md border border-zinc-200 bg-white/88 shadow-sm dark:border-white/10 dark:bg-[#10161d]/92">
          <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_19rem]">
            <div className="min-w-0 p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
                    Active matter
                  </p>
                  <h2 className="mt-2 truncate text-2xl font-semibold tracking-tight text-zinc-950 dark:text-white">
                    {activeDashboardCase?.title ?? "Whole workspace baseline"}
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600 dark:text-slate-400">
                    {activeDashboardCase?.strategy ||
                      activeDashboardCase?.posture ||
                      "Pick a case lane, process its files, run analysis, and build one exportable packet."}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      "rounded-md",
                      healthBadgeClass(activeCaseHealth)
                    )}
                  >
                    {healthLabel(activeCaseHealth)}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={
                      comparisonReady
                        ? "rounded-md border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
                        : "rounded-md border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200"
                    }
                  >
                    {caseLaneCount} case lane{caseLaneCount === 1 ? "" : "s"}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="rounded-md border-zinc-300 bg-zinc-50 text-zinc-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
                  >
                    {isWholeWorkspace ? "workspace baseline" : "selected case"}
                  </Badge>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  {
                    label: "Docs",
                    value: formatNumber(
                      activeCaseStats?.documents ?? typedDocuments.length
                    ),
                    detail: `${formatNumber(activeCaseStats?.completedDocuments ?? completedDocuments)} ready`,
                  },
                  {
                    label: "Readiness",
                    value: `${activeCaseStats?.readiness ?? readiness}%`,
                    detail: activeCaseHasProblems
                      ? "blocked or pending work exists"
                      : "source text is clean",
                  },
                  {
                    label: "Findings",
                    value: formatNumber(
                      activeCaseStats?.reportReadyFindings ??
                        reportReadyFindings
                    ),
                    detail: `${formatNumber(activeCaseStats?.blockedFindings ?? blockedFindings)} blocked`,
                  },
                  {
                    label: "Packets",
                    value: formatNumber(
                      activeCaseStats?.savedReports ?? savedReports.length
                    ),
                    detail: "saved reports",
                  },
                ].map(metric => (
                  <div
                    key={metric.label}
                    className="rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-slate-950/55"
                  >
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-slate-500">
                      {metric.label}
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-white">
                      {metric.value}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-slate-500">
                      {metric.detail}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div
              className={cn(
                "border-t border-zinc-200 p-4 dark:border-white/10 xl:border-l xl:border-t-0",
                nextAction.tone === "danger" && "bg-red-500/10",
                nextAction.tone === "warning" && "bg-amber-500/10",
                nextAction.tone === "success" && "bg-emerald-500/10",
                nextAction.tone === "info" && "bg-blue-500/10"
              )}
            >
              <div className="flex items-center gap-2">
                <NextIcon
                  className={cn(
                    "h-4 w-4 text-zinc-700 dark:text-slate-200",
                    nextAction.icon === Loader2 && "animate-spin"
                  )}
                />
                <p className="text-sm font-semibold text-zinc-950 dark:text-white">
                  {nextAction.title}
                </p>
              </div>
              <p className="mt-2 text-xs leading-5 text-zinc-600 dark:text-slate-300">
                {nextAction.detail}
              </p>
              <Link href={nextAction.route}>
                <Button className="mt-4 w-full gap-2 bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-amber-300 dark:text-zinc-950 dark:hover:bg-amber-200">
                  {nextAction.cta}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
              <Link href="/cases">
                <Button
                  variant="outline"
                  className="mt-2 w-full justify-between border-zinc-300 bg-white/70 text-zinc-800 hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100"
                >
                  Compare cases
                  <GitCompare className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <details className="mb-4 rounded-md border border-zinc-200 bg-white/76 p-3 shadow-sm dark:border-white/10 dark:bg-[#10161d]/76">
          <summary className="flex cursor-pointer items-center justify-between gap-3 text-sm font-semibold text-zinc-800 dark:text-slate-200">
            <span className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-amber-700 dark:text-amber-300" />
              Deep proof / operations drawer
            </span>
            <span className="text-xs font-medium text-zinc-500 dark:text-slate-500">
              Pipeline {pipelineScore}% · Revenue {commercialScore}%
            </span>
          </summary>
          <div className="mt-3 space-y-3">
            <details className="rounded-md border border-zinc-200 bg-white/70 p-3 shadow-sm dark:border-white/10 dark:bg-[#10161d]/72">
              <summary className="flex cursor-pointer items-center justify-between gap-3 text-sm font-semibold text-zinc-800 dark:text-slate-200">
                <span className="flex items-center gap-2">
                  <Gauge className="h-4 w-4 text-amber-700 dark:text-amber-300" />
                  Workspace health details
                </span>
                <span className="text-xs font-medium text-zinc-500 dark:text-slate-500">
                  Pipeline {pipelineScore}% · Revenue {commercialScore}%
                </span>
              </summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {gauges.map(gauge => (
                  <GaugeCard key={gauge.title} item={gauge} />
                ))}
              </div>
            </details>

            <details className="rounded-md border border-zinc-200 bg-white/70 p-3 shadow-sm dark:border-white/10 dark:bg-[#10161d]/72">
              <summary className="flex cursor-pointer items-center justify-between gap-3 text-sm font-semibold text-zinc-800 dark:text-slate-200">
                <span className="flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4 text-amber-700 dark:text-amber-300" />
                  Operating plan
                </span>
                <span className="text-xs font-medium text-zinc-500 dark:text-slate-500">
                  Current move:{" "}
                  {operatorRunbook.find(step => step.status === "next")
                    ?.title ??
                    operatorRunbook.find(step => step.status === "blocked")
                      ?.title ??
                    operatorRunbook[operatorRunbook.length - 1].title}
                </span>
              </summary>
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {operatorRunbook.map(step => (
                  <RunbookStepCard key={step.order} step={step} />
                ))}
              </div>
            </details>

            <details className="rounded-md border border-zinc-200 bg-white/70 p-3 shadow-sm dark:border-white/10 dark:bg-[#10161d]/72">
              <summary className="cursor-pointer text-sm font-semibold text-zinc-800 dark:text-slate-200">
                Advanced packet lanes
              </summary>
              <div className="mt-3">
                <SectionShell
                  icon={FileOutput}
                  title="Proof packet launcher"
                  description="Pick the buyer lane, then build the exact artifact that would make that customer care. This is the bridge from product UI to money."
                  className="border-0 bg-transparent shadow-none"
                >
                  <div className="mb-4 grid gap-4 rounded-md border border-blue-500/25 bg-blue-500/10 p-4 dark:border-blue-400/20 dark:bg-blue-400/8 xl:grid-cols-[minmax(0,1fr)_18rem]">
                    <div>
                      <p className="text-sm font-semibold text-zinc-950 dark:text-white">
                        Start with the output, then work backward.
                      </p>
                      <p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-slate-300">
                        The app should not ask users to understand the whole
                        engine first. Pick the artifact: case packet, leverage
                        memo, writ packet, defense review, or evidence ledger.
                        Then the UI walks them through intake, analysis, QC, and
                        export.
                      </p>
                    </div>
                    <div className="rounded-md border border-zinc-200 bg-white/70 p-3 dark:border-white/10 dark:bg-black/20">
                      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-slate-500">
                        Closest sellable packet
                      </p>
                      <p className="mt-2 text-lg font-semibold text-zinc-950 dark:text-white">
                        {proofPackets.find(packet => packet.status === "live")
                          ?.title ??
                          proofPackets.find(
                            packet => packet.status === "partial"
                          )?.title ??
                          proofPackets[0].title}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-zinc-600 dark:text-slate-400">
                        Based on current documents, findings, and saved reports.
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-3 xl:grid-cols-2 2xl:grid-cols-3">
                    {proofPackets.map(packet => (
                      <ProofPacketCard key={packet.title} packet={packet} />
                    ))}
                  </div>
                </SectionShell>
              </div>
            </details>

            <details className="rounded-md border border-zinc-200 bg-white/70 p-3 shadow-sm dark:border-white/10 dark:bg-[#10161d]/72">
              <summary className="cursor-pointer text-sm font-semibold text-zinc-800 dark:text-slate-200">
                Private beta proof gates
              </summary>
              <div className="mt-3">
                <SectionShell
                  icon={Rocket}
                  title="Private beta proof run"
                  description="The shortest honest path from alpha demo to something people can pay for."
                  className="border-0 bg-transparent shadow-none"
                >
                  <div className="grid gap-4 xl:grid-cols-[20rem_minmax(0,1fr)]">
                    <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-white/10 dark:bg-slate-950/55">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-slate-500">
                          Sellability proof
                        </p>
                        <Badge
                          variant="outline"
                          className={cn(
                            "rounded-md px-3 py-1",
                            privateBetaScore >= 80
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
                              : privateBetaScore >= 50
                                ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200"
                                : "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-200"
                          )}
                        >
                          {privateBetaScore}%
                        </Badge>
                      </div>
                      <p className="mt-4 text-4xl font-semibold tracking-tight text-zinc-950 dark:text-white">
                        {privateBetaScore}%
                      </p>
                      <Progress
                        value={privateBetaScore}
                        className="mt-4 h-2 bg-zinc-200 dark:bg-white/10"
                      />
                      <div className="mt-5 rounded-md border border-amber-500/30 bg-amber-500/10 p-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-200">
                          Next proof move
                        </p>
                        <p className="mt-2 text-sm font-semibold text-zinc-950 dark:text-white">
                          {nextProofGate.title}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-zinc-600 dark:text-slate-300">
                          {nextProofGate.detail}
                        </p>
                        <Link href={nextProofGate.route}>
                          <Button
                            size="sm"
                            className="mt-3 w-full gap-2 bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-amber-300 dark:text-zinc-950 dark:hover:bg-amber-200"
                          >
                            Fix this gate
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      </div>
                      <p className="mt-4 text-xs leading-5 text-zinc-500 dark:text-slate-400">
                        This score is intentionally strict. It favors proof that
                        the engine can ingest real files, keep bad OCR out,
                        produce QC-visible findings, export work product, track
                        cost, and charge correctly.
                      </p>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                      {proofGates.map(gate => (
                        <ProofGateCard key={gate.title} gate={gate} />
                      ))}
                    </div>
                  </div>
                </SectionShell>
              </div>
            </details>
          </div>
        </details>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0 space-y-5">
            <details className="rounded-md border border-zinc-200 bg-white/70 p-3 shadow-sm dark:border-white/10 dark:bg-[#10161d]/72">
              <summary className="flex cursor-pointer items-center justify-between gap-3 text-sm font-semibold text-zinc-800 dark:text-slate-200">
                <span className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-700 dark:text-amber-300" />
                  Pipeline shortcuts
                </span>
                <span className="text-xs font-medium text-zinc-500 dark:text-slate-500">
                  Upload, process, analyze, report
                </span>
              </summary>
              <div className="mt-3 grid gap-3 md:grid-cols-4">
                {workflow.map((step, index) => {
                  const Icon = step.icon;
                  return (
                    <Link key={step.title} href={step.route}>
                      <div className="group h-full min-w-0 rounded-md border border-zinc-200 bg-zinc-50 p-4 transition-all hover:-translate-y-0.5 hover:border-zinc-400 hover:bg-white dark:border-white/10 dark:bg-slate-950/55 dark:hover:border-white/25 dark:hover:bg-white/[0.07]">
                        <div className="flex items-center justify-between gap-3">
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-amber-500/30 bg-amber-500/10 text-sm font-semibold text-amber-700 dark:text-amber-200">
                            {index + 1}
                          </span>
                          <Icon className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
                        </div>
                        <p className="mt-4 text-sm font-semibold text-zinc-950 dark:text-white">
                          {step.title}
                        </p>
                        <p className="mt-2 break-words text-xs leading-5 text-zinc-600 dark:text-slate-400">
                          {step.detail}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </details>

            <SectionShell
              icon={FolderSearch}
              title="Recent documents"
              description="Open a record, review extraction, or jump back into the Corpus."
            >
              {typedDocuments.length === 0 ? (
                <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center dark:border-white/15 dark:bg-white/[0.025]">
                  <FileSearch className="mx-auto mb-3 h-8 w-8 text-zinc-400 dark:text-slate-500" />
                  <p className="text-sm text-zinc-600 dark:text-slate-400">
                    No documents uploaded yet.
                  </p>
                  <Link href="/sector/corpus">
                    <Button className="mt-4 bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-amber-300 dark:text-zinc-950 dark:hover:bg-amber-200">
                      Upload First Document
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="overflow-hidden rounded-md border border-zinc-200 dark:border-white/10">
                  <div className="hidden grid-cols-[minmax(0,1fr)_10rem_10rem_8rem] border-b border-zinc-200 bg-zinc-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:border-white/10 dark:bg-slate-950/55 dark:text-slate-500 md:grid">
                    <span>Document</span>
                    <span>Type</span>
                    <span>Status</span>
                    <span className="text-right">Added</span>
                  </div>
                  <div className="divide-y divide-zinc-200 dark:divide-white/10">
                    {typedDocuments.slice(0, 8).map(document => (
                      <Link key={document.id} href={`/process/${document.id}`}>
                        <div className="grid cursor-pointer gap-2 bg-white px-4 py-4 transition-colors hover:bg-zinc-50 dark:bg-white/[0.025] dark:hover:bg-white/[0.06] md:grid-cols-[minmax(0,1fr)_10rem_10rem_8rem] md:items-center">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-zinc-950 dark:text-white">
                              {document.fileName}
                            </p>
                            <p className="mt-1 text-xs text-zinc-500 dark:text-slate-500">
                              Document #{document.id}
                            </p>
                          </div>
                          <p className="truncate text-xs text-zinc-500 dark:text-slate-400">
                            {document.mimeType || "unknown type"}
                          </p>
                          <div>
                            <StatusBadge status={document.status} />
                          </div>
                          <p className="text-xs text-zinc-500 dark:text-slate-400 md:text-right">
                            {formatDateTime(document.createdAt)}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </SectionShell>
          </div>

          <aside className="min-w-0 space-y-5">
            <SectionShell
              icon={ShieldCheck}
              title="Top findings"
              description="Highest leverage report candidates in this scope."
            >
              {reportPreviewQuery.isLoading && hasDocuments ? (
                <div className="flex items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-white/10 dark:bg-slate-950/55 dark:text-slate-300">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Checking QC-cleared findings
                </div>
              ) : topFindings.length > 0 ? (
                <div className="space-y-2">
                  {topFindings.map(finding => (
                    <Link key={finding.id} href="/sector/arsenal">
                      <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 transition-colors hover:bg-white dark:border-white/10 dark:bg-slate-950/55 dark:hover:bg-white/[0.07]">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-zinc-950 dark:text-white">
                              {finding.title}
                            </p>
                            <p className="mt-1 truncate text-xs text-zinc-500 dark:text-slate-500">
                              {finding.findingType} · QC {finding.qcStatus}
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
                          >
                            {finding.confidence}
                          </Badge>
                        </div>
                        <div className="mt-3 flex items-center justify-between text-xs text-zinc-500 dark:text-slate-400">
                          <span>Leverage {finding.leverageScore}</span>
                          <span>{finding.agentName}</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-zinc-300 p-5 text-center text-sm text-zinc-500 dark:border-white/15 dark:text-slate-400">
                  No report-ready findings yet.
                </div>
              )}
            </SectionShell>

            <SectionShell
              icon={Gauge}
              title="System read"
              description="Honest health, not demo glitter."
            >
              <div className="space-y-4">
                <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-slate-950/55">
                  <div className="mb-2 flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-slate-500">
                    <span>Corpus readiness</span>
                    <span>{readiness}%</span>
                  </div>
                  <Progress
                    value={readiness}
                    className="h-2 bg-zinc-200 dark:bg-white/10"
                  />
                </div>
                <div className="grid gap-2 text-sm">
                  <div className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-white/10 dark:bg-slate-950/55">
                    <span className="text-zinc-600 dark:text-slate-300">
                      Processing
                    </span>
                    <Badge
                      variant="outline"
                      className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200"
                    >
                      {pendingDocuments}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-white/10 dark:bg-slate-950/55">
                    <span className="text-zinc-600 dark:text-slate-300">
                      Blocked findings
                    </span>
                    <Badge
                      variant="outline"
                      className={
                        blockedFindings > 0
                          ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200"
                          : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
                      }
                    >
                      {blockedFindings}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-white/10 dark:bg-slate-950/55">
                    <span className="text-zinc-600 dark:text-slate-300">
                      Saved reports
                    </span>
                    <Badge
                      variant="outline"
                      className="border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-200"
                    >
                      {savedReports.length}
                    </Badge>
                  </div>
                  <Link href="/settings">
                    <div className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 transition-colors hover:bg-white dark:border-white/10 dark:bg-slate-950/55 dark:hover:bg-white/[0.07]">
                      <span className="text-zinc-600 dark:text-slate-300">
                        Revenue blockers
                      </span>
                      <Badge
                        variant="outline"
                        className={
                          revenueBlockers.length > 0
                            ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-200"
                            : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
                        }
                      >
                        {revenueBlockers.length}
                      </Badge>
                    </div>
                  </Link>
                </div>
              </div>
            </SectionShell>
          </aside>
        </div>

        {failedDocuments > 0 ||
        blockedFindings > 0 ||
        reportReadyFindings > 0 ? (
          <section className="mt-5 grid gap-3 md:grid-cols-3">
            {failedDocuments > 0 ? (
              <Link href="/sector/corpus?status=failed">
                <div className="rounded-md border border-red-500/30 bg-red-500/10 p-4 text-red-700 dark:text-red-200">
                  <div className="flex items-center gap-2 font-semibold">
                    <CircleAlert className="h-4 w-4" />
                    Blocked OCR alert
                  </div>
                  <p className="mt-2 text-sm leading-6">
                    {failedDocuments} document
                    {failedDocuments === 1 ? "" : "s"} need extraction review.
                  </p>
                </div>
              </Link>
            ) : null}
            {blockedFindings > 0 ? (
              <Link href="/sector/arsenal">
                <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-4 text-amber-700 dark:text-amber-200">
                  <div className="flex items-center gap-2 font-semibold">
                    <AlertTriangle className="h-4 w-4" />
                    QC warning
                  </div>
                  <p className="mt-2 text-sm leading-6">
                    {blockedFindings} finding
                    {blockedFindings === 1 ? "" : "s"} are blocked or held by
                    QC.
                  </p>
                </div>
              </Link>
            ) : null}
            {reportReadyFindings > 0 ? (
              <Link href="/reports">
                <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-700 dark:text-emerald-200">
                  <div className="flex items-center gap-2 font-semibold">
                    <ShieldCheck className="h-4 w-4" />
                    Report path ready
                  </div>
                  <p className="mt-2 text-sm leading-6">
                    {reportReadyFindings} finding
                    {reportReadyFindings === 1 ? "" : "s"} can feed report
                    generation.
                  </p>
                </div>
              </Link>
            ) : null}
          </section>
        ) : null}
      </CommandMain>
    </CommandSurface>
  );
}
