import { useMemo } from "react";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { APP_LOGO, APP_TITLE, getLoginUrl } from "@/const";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ArrowRight,
  Brain,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  Database,
  DollarSign,
  FileArchive,
  FileCheck,
  FileSearch,
  FileText,
  Gauge,
  Landmark,
  Layers3,
  Loader2,
  Moon,
  ReceiptText,
  Rocket,
  Scale,
  SearchCheck,
  Settings as SettingsIcon,
  ShieldCheck,
  Smartphone,
  Sun,
  Target,
  Upload,
  Workflow,
} from "lucide-react";

type DocumentRecord = {
  id: number;
  fileName: string;
  status: string;
  extractedText?: string | null;
  summary?: string | null;
  createdAt?: Date | string;
};

type SourceAnchor = {
  documentId?: number;
  fileName?: string;
  quote?: string;
  support?: string;
};

type Finding = {
  id: number;
  title: string;
  findingType: string;
  confidence: number;
  leverageScore: number;
  qcStatus: string | null;
  includedInReports: boolean;
  sourceAnchors: SourceAnchor[];
  missingRecords: string[];
};

type SettingsUsage = {
  billing?: {
    subscription?: { plan?: string | null; status?: string | null } | null;
    usage?: {
      pages_used?: number | null;
      swarm_runs_used?: number | null;
      case_slots_used?: number | null;
    } | null;
  };
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
  exports?: Array<{ status: string; count: number | string }>;
};

type MonitorCheck = {
  id: string;
  name: string;
  status: "ok" | "warn" | "error" | string;
  detail: string;
};

type MarketGate = {
  label: string;
  status: "live" | "partial" | "missing";
  metric: string;
  detail: string;
  route: string;
  icon: LucideIcon;
};

type RoadmapItem = {
  title: string;
  status: "live" | "partial" | "missing";
  value: string;
  route: string;
  icon: LucideIcon;
};

function formatNumber(value: number | undefined | null) {
  return new Intl.NumberFormat().format(value ?? 0);
}

function formatUsd(value: number | undefined | null) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 4,
  }).format(value ?? 0);
}

function statusTone(status: MarketGate["status"]) {
  if (status === "live") return "ready";
  if (status === "partial") return "warning";
  return "blocked";
}

function qcReady(status: string | null | undefined) {
  return ["approved", "downgraded"].includes((status || "").toLowerCase());
}

function isReadyDocument(document: DocumentRecord) {
  const status = document.status.toLowerCase();
  const hasText = Boolean(
    document.extractedText?.trim() || document.summary?.trim()
  );
  return (status === "completed" || status === "ready") && hasText;
}

function StatusBadge({ status }: { status: MarketGate["status"] }) {
  const tone = statusTone(status);
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-md px-2 py-1 text-xs font-semibold capitalize",
        tone === "ready" &&
          "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200",
        tone === "warning" &&
          "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200",
        tone === "blocked" &&
          "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-200"
      )}
    >
      {tone === "ready" ? <CheckCircle2 className="mr-1 h-3 w-3" /> : null}
      {tone === "warning" ? <AlertTriangle className="mr-1 h-3 w-3" /> : null}
      {tone === "blocked" ? <CircleAlert className="mr-1 h-3 w-3" /> : null}
      {status}
    </Badge>
  );
}

function MetricCard({
  title,
  value,
  detail,
  icon: Icon,
  tone = "neutral",
}: {
  title: string;
  value: string | number;
  detail: string;
  icon: LucideIcon;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}) {
  const toneClass = {
    neutral: "text-zinc-950 dark:text-white",
    success: "text-emerald-700 dark:text-emerald-300",
    warning: "text-amber-700 dark:text-amber-300",
    danger: "text-red-700 dark:text-red-300",
    info: "text-blue-700 dark:text-blue-300",
  }[tone];

  return (
    <div className="rounded-md border border-zinc-200 bg-white/78 p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-slate-500">
          {title}
        </p>
        <Icon className={cn("h-4 w-4 shrink-0", toneClass)} />
      </div>
      <p
        className={cn("mt-3 text-3xl font-semibold tracking-tight", toneClass)}
      >
        {value}
      </p>
      <p className="mt-2 text-xs leading-5 text-zinc-500 dark:text-slate-400">
        {detail}
      </p>
    </div>
  );
}

function SectionShell({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-md border border-zinc-200 bg-white/82 shadow-sm backdrop-blur dark:border-white/10 dark:bg-[#111722]/84">
      <div className="border-b border-zinc-200 px-4 py-4 dark:border-white/10 sm:px-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-200">
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="break-words text-base font-semibold tracking-tight text-zinc-950 dark:text-white">
              {title}
            </h2>
            <p className="mt-1 break-words text-sm leading-5 text-zinc-600 dark:text-slate-400">
              {description}
            </p>
          </div>
        </div>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function GateCard({ gate }: { gate: MarketGate }) {
  const Icon = gate.icon;
  return (
    <Link href={gate.route}>
      <div className="group h-full rounded-md border border-zinc-200 bg-zinc-50 p-4 transition-all hover:-translate-y-0.5 hover:border-zinc-400 hover:bg-white dark:border-white/10 dark:bg-slate-950/55 dark:hover:border-white/25 dark:hover:bg-white/[0.07]">
        <div className="flex items-start justify-between gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-800 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-200">
            <Icon className="h-5 w-5" />
          </span>
          <StatusBadge status={gate.status} />
        </div>
        <p className="mt-4 text-sm font-semibold text-zinc-950 dark:text-white">
          {gate.label}
        </p>
        <p className="mt-1 text-xl font-semibold tracking-tight text-zinc-950 dark:text-white">
          {gate.metric}
        </p>
        <p className="mt-2 text-xs leading-5 text-zinc-600 dark:text-slate-400">
          {gate.detail}
        </p>
        <div className="mt-4 flex items-center text-xs font-semibold text-amber-700 opacity-0 transition-opacity group-hover:opacity-100 dark:text-amber-300">
          Open surface
          <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </div>
      </div>
    </Link>
  );
}

function RoadmapRow({ item }: { item: RoadmapItem }) {
  const Icon = item.icon;
  return (
    <Link href={item.route}>
      <div className="group flex min-w-0 items-center justify-between gap-4 rounded-md border border-zinc-200 bg-white/64 p-3 transition-colors hover:border-zinc-400 hover:bg-white dark:border-white/10 dark:bg-white/[0.035] dark:hover:border-white/25 dark:hover:bg-white/[0.07]">
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-white/10 dark:bg-black/20 dark:text-slate-300">
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-zinc-950 dark:text-white">
              {item.title}
            </p>
            <p className="truncate text-xs text-zinc-500 dark:text-slate-500">
              {item.value}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <StatusBadge status={item.status} />
          <ArrowRight className="h-4 w-4 text-zinc-400 opacity-0 transition-opacity group-hover:opacity-100 dark:text-slate-500" />
        </div>
      </div>
    </Link>
  );
}

export default function MarketCommand() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const documentsQuery = trpc.documents.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const findingsQuery = trpc.agents.listFindings.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const savedReportsQuery = trpc.reports.saved.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const usageQuery = trpc.settings.usage.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const monitorsQuery = trpc.settings.monitors.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const documents = (documentsQuery.data ?? []) as DocumentRecord[];
  const findings = (findingsQuery.data ?? []) as Finding[];
  const savedReports = savedReportsQuery.data ?? [];
  const usage = usageQuery.data as SettingsUsage | undefined;
  const monitorChecks = (monitorsQuery.data?.checks ?? []) as MonitorCheck[];

  const readyDocuments = documents.filter(isReadyDocument);
  const failedDocuments = documents.filter(document =>
    ["failed", "error"].includes(document.status.toLowerCase())
  );
  const pendingDocuments = documents.filter(document =>
    ["pending", "processing"].includes(document.status.toLowerCase())
  );
  const anchoredFindings = findings.filter(
    finding => finding.sourceAnchors.length > 0
  );
  const qcTouchedFindings = findings.filter(finding =>
    Boolean(finding.qcStatus)
  );
  const reportReadyFindings = findings.filter(
    finding => finding.includedInReports && qcReady(finding.qcStatus)
  );
  const blockedFindings = findings.filter(
    finding => (finding.qcStatus || "").toLowerCase() === "blocked"
  );
  const missingRecords = findings.reduce(
    (sum, finding) => sum + finding.missingRecords.length,
    0
  );
  const exactUsageEnabled = Boolean(usage?.aiUsage?.exactTokenTelemetryEnabled);
  const billingLive = Boolean(usage?.billing?.subscription?.plan);
  const monitorErrors = monitorChecks.filter(
    check => check.status === "error"
  ).length;
  const monitorWarnings = monitorChecks.filter(
    check => check.status === "warn"
  ).length;
  const dataLoading =
    documentsQuery.isLoading ||
    findingsQuery.isLoading ||
    savedReportsQuery.isLoading ||
    usageQuery.isLoading ||
    monitorsQuery.isLoading;

  const marketGates = useMemo<MarketGate[]>(() => {
    if (dataLoading) {
      return [
        {
          label: "Evidence intake",
          route: "/sector/corpus",
          icon: Database,
        },
        {
          label: "Structured findings",
          route: "/violations",
          icon: ShieldCheck,
        },
        {
          label: "QC guardrail",
          route: "/violations",
          icon: ClipboardCheck,
        },
        {
          label: "Report factory",
          route: "/reports",
          icon: ReceiptText,
        },
        {
          label: "Usage telemetry",
          route: "/settings",
          icon: Gauge,
        },
        {
          label: "Billing enforcement",
          route: "/pricing",
          icon: DollarSign,
        },
        {
          label: "Release monitors",
          route: "/settings",
          icon: AlertTriangle,
        },
      ].map(item => ({
        ...item,
        status: "partial" as const,
        metric: "Reading live data",
        detail:
          "Waiting for the backend to return the current workspace state.",
      }));
    }

    return [
      {
        label: "Evidence intake",
        status:
          documents.length === 0
            ? "missing"
            : failedDocuments.length > 0 || pendingDocuments.length > 0
              ? "partial"
              : readyDocuments.length > 0
                ? "live"
                : "missing",
        metric: `${formatNumber(readyDocuments.length)} / ${formatNumber(documents.length)} ready`,
        detail:
          failedDocuments.length > 0
            ? `${failedDocuments.length} files are blocked. Bad OCR cannot quietly enter analysis.`
            : "Files need extracted text and readiness status before agents touch them.",
        route: "/sector/corpus",
        icon: Database,
      },
      {
        label: "Structured findings",
        status:
          findings.length === 0
            ? "missing"
            : anchoredFindings.length === findings.length
              ? "live"
              : "partial",
        metric: `${formatNumber(anchoredFindings.length)} / ${formatNumber(findings.length)} anchored`,
        detail:
          "Market value starts when findings are stored as evidence-backed objects, not loose paragraphs.",
        route: "/violations",
        icon: ShieldCheck,
      },
      {
        label: "QC guardrail",
        status:
          findings.length === 0
            ? "missing"
            : qcTouchedFindings.length > 0
              ? "live"
              : "partial",
        metric: `${formatNumber(qcTouchedFindings.length)} reviewed`,
        detail: `${formatNumber(blockedFindings.length)} blocked. Court-safe output beats spicy nonsense every day.`,
        route: "/violations",
        icon: ClipboardCheck,
      },
      {
        label: "Report factory",
        status:
          savedReports.length > 0
            ? "live"
            : reportReadyFindings.length > 0
              ? "partial"
              : "missing",
        metric: `${formatNumber(savedReports.length)} saved reports`,
        detail: `${formatNumber(reportReadyFindings.length)} findings are eligible for packets and exports.`,
        route: "/reports",
        icon: ReceiptText,
      },
      {
        label: "Usage telemetry",
        status: exactUsageEnabled
          ? "live"
          : usage?.aiUsage?.savedAgentOutputs?.outputs
            ? "partial"
            : "missing",
        metric: exactUsageEnabled
          ? `${formatNumber(usage?.aiUsage?.exact?.calls)} exact calls`
          : `${formatNumber(usage?.aiUsage?.savedAgentOutputs?.outputs)} saved outputs`,
        detail: exactUsageEnabled
          ? `${formatNumber(usage?.aiUsage?.exact?.totalTokens)} tokens tracked, ${formatUsd(usage?.aiUsage?.exact?.estimatedUsd)} estimated.`
          : "Exact token/cost events need fresh LLM-backed runs to price usage honestly.",
        route: "/settings",
        icon: Gauge,
      },
      {
        label: "Billing enforcement",
        status: billingLive ? "live" : "partial",
        metric: usage?.billing?.subscription?.plan || "No active plan row",
        detail: billingLive
          ? `${usage?.billing?.subscription?.status || "unknown"} subscription state is visible.`
          : "Stripe can exist in env and still not be a business until plan limits are enforced server-side.",
        route: "/pricing",
        icon: DollarSign,
      },
      {
        label: "Release monitors",
        status:
          monitorChecks.length === 0
            ? "missing"
            : monitorErrors > 0
              ? "missing"
              : monitorWarnings > 0
                ? "partial"
                : "live",
        metric:
          monitorChecks.length === 0
            ? "No checks loaded"
            : `${formatNumber(monitorErrors)} errors, ${formatNumber(monitorWarnings)} warnings`,
        detail:
          "OCR failures, stuck runs, missing secrets, webhook failures, and cost spikes need alarms before customers do QA for us.",
        route: "/settings",
        icon: AlertTriangle,
      },
    ];
  }, [
    anchoredFindings.length,
    dataLoading,
    blockedFindings.length,
    documents.length,
    exactUsageEnabled,
    failedDocuments.length,
    findings.length,
    monitorChecks.length,
    monitorErrors,
    monitorWarnings,
    pendingDocuments.length,
    qcTouchedFindings.length,
    readyDocuments.length,
    reportReadyFindings.length,
    savedReports.length,
    usage,
    billingLive,
  ]);

  const liveGateCount = marketGates.filter(
    gate => gate.status === "live"
  ).length;
  const partialGateCount = marketGates.filter(
    gate => gate.status === "partial"
  ).length;
  const readinessScore = Math.round((liveGateCount / marketGates.length) * 100);
  const verdict = dataLoading
    ? "Reading live signals"
    : readinessScore >= 80
      ? "Sellable engine"
      : readinessScore >= 45
        ? "Private beta with sharp teeth"
        : "Still an MVP";

  const roadmapItems: RoadmapItem[] = [
    {
      title: "Own the category",
      status: anchoredFindings.length > 0 ? "live" : "partial",
      value: "Record-grounded violation intelligence, not generic legal chat.",
      route: "/violations",
      icon: Target,
    },
    {
      title: "Make intake impossible to ignore",
      status:
        failedDocuments.length > 0
          ? "partial"
          : documents.length > 0
            ? "live"
            : "missing",
      value: "OCR, dedupe, source hash, text preview, retry, and readiness.",
      route: "/sector/corpus",
      icon: Upload,
    },
    {
      title: "Turn findings into work product",
      status:
        savedReports.length > 0
          ? "live"
          : reportReadyFindings.length > 0
            ? "partial"
            : "missing",
      value:
        "War room, Monell map, discovery packet, timeline gaps, and motions.",
      route: "/reports",
      icon: FileArchive,
    },
    {
      title: "Charge without flinching",
      status: billingLive ? "live" : "partial",
      value: "Demo locked down, Case Builder subscription, Firm usage-based.",
      route: "/pricing",
      icon: DollarSign,
    },
    {
      title: "Make mobile a field terminal",
      status: "partial",
      value:
        "Phone app should upload, inspect, run, export, and diagnose backend access.",
      route: "/settings",
      icon: Smartphone,
    },
    {
      title: "Release like adults",
      status:
        monitorErrors > 0
          ? "missing"
          : monitorWarnings > 0
            ? "partial"
            : monitorChecks.length > 0
              ? "live"
              : "missing",
      value:
        "Auth isolation, billing, OCR, QC, export, and cost monitors as gates.",
      route: "/settings",
      icon: FileCheck,
    },
  ];

  const moatPillars = [
    {
      title: "Source ledger",
      detail:
        "Every useful claim must point back to a document, quote, status, and source anchor.",
      icon: Database,
    },
    {
      title: "Violation map",
      detail:
        "Brady, Monell, retaliation, search, due process, immunity, and remedies need one connected spine.",
      icon: Landmark,
    },
    {
      title: "QC before output",
      detail:
        "High-risk or low-confidence claims get downgraded, blocked, or turned into missing-record demands.",
      icon: ShieldCheck,
    },
    {
      title: "Exportable leverage",
      detail:
        "Reports, packets, drafts, and evidence appendices are the thing people pay for.",
      icon: FileText,
    },
  ];

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
            Market Command needs an authenticated workspace before it can read
            case readiness, billing, reports, or token usage.
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
    <div className="min-h-screen overflow-x-hidden bg-[#f7f2e8] text-zinc-950 dark:bg-[#070a0d] dark:text-slate-100">
      <div className="pointer-events-none fixed inset-0 opacity-50 dark:opacity-40">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(39,39,42,0.07)_1px,transparent_1px),linear-gradient(to_bottom,rgba(39,39,42,0.07)_1px,transparent_1px)] bg-[size:42px_42px] dark:bg-[linear-gradient(to_right,rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.045)_1px,transparent_1px)]" />
      </div>

      <div className="relative z-10 flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-zinc-200 bg-white/78 p-4 backdrop-blur-xl dark:border-white/10 dark:bg-[#0b1016]/92 lg:flex">
          <Link href="/">
            <div className="mb-6 flex min-w-0 cursor-pointer items-center gap-3">
              {APP_LOGO ? (
                <img
                  src={APP_LOGO}
                  alt={APP_TITLE}
                  className="h-10 w-10 shrink-0 rounded-md object-cover"
                />
              ) : (
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-200">
                  <Scale className="h-5 w-5" />
                </span>
              )}
              <div className="min-w-0">
                <h1 className="truncate text-sm font-semibold uppercase tracking-[0.18em] text-zinc-950 dark:text-white">
                  DueProcess AI
                </h1>
                <p className="truncate text-[0.68rem] uppercase tracking-[0.18em] text-zinc-500 dark:text-slate-500">
                  Legal intelligence command
                </p>
              </div>
            </div>
          </Link>

          <div className="space-y-5">
            <div>
              <p className="mb-2 px-2 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-slate-500">
                Command
              </p>
              <nav className="space-y-1">
                {[
                  { href: "/dashboard", label: "Dashboard", icon: Gauge },
                  { href: "/sector/corpus", label: "Corpus", icon: Database },
                  {
                    href: "/sector/evidence",
                    label: "Evidence Review",
                    icon: SearchCheck,
                  },
                  {
                    href: "/sector/arsenal",
                    label: "Legal Analysis",
                    icon: Scale,
                  },
                  {
                    href: "/violations",
                    label: "Violations",
                    icon: ShieldCheck,
                  },
                  { href: "/reports", label: "Reports", icon: ReceiptText },
                  {
                    href: "/market",
                    label: "Market Command",
                    icon: Rocket,
                    active: true,
                  },
                ].map(item => {
                  const Icon = item.icon;
                  return (
                    <Link key={item.href} href={item.href}>
                      <div
                        className={cn(
                          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                          item.active
                            ? "border border-amber-500/30 bg-amber-500/10 text-zinc-950 dark:border-amber-400/25 dark:bg-white/[0.08] dark:text-white"
                            : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-slate-400 dark:hover:bg-white/[0.07] dark:hover:text-white"
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-4 w-4",
                            item.active && "text-amber-700 dark:text-amber-300"
                          )}
                        />
                        {item.label}
                      </div>
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div>
              <p className="mb-2 px-2 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-slate-500">
                Money Surfaces
              </p>
              <nav className="space-y-1">
                {[
                  { href: "/pricing", label: "Pricing", icon: DollarSign },
                  {
                    href: "/settings",
                    label: "Usage & monitors",
                    icon: SettingsIcon,
                  },
                  { href: "/reports", label: "Exports", icon: FileArchive },
                ].map(item => {
                  const Icon = item.icon;
                  return (
                    <Link key={item.href} href={item.href}>
                      <div className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950 dark:text-slate-400 dark:hover:bg-white/[0.07] dark:hover:text-white">
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </div>
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>

          <div className="mt-auto rounded-md border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/8 dark:text-amber-100">
            <div className="flex items-center gap-2 font-semibold">
              <Rocket className="h-3.5 w-3.5" />
              {verdict}
            </div>
            <p className="mt-2 text-amber-800/80 dark:text-amber-100/80">
              {liveGateCount}/{marketGates.length} gates live.{" "}
              {partialGateCount} still partial.
            </p>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-zinc-200 bg-[#f7f2e8]/88 backdrop-blur-xl dark:border-white/10 dark:bg-[#0b1016]/88">
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 px-3 py-3 sm:px-5 lg:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <Link href="/dashboard">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-zinc-700 hover:bg-white/70 dark:text-slate-300 dark:hover:bg-white/10 lg:hidden"
                  >
                    <Gauge className="h-4 w-4" />
                  </Button>
                </Link>
                <div>
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-slate-500">
                    Market Command
                  </p>
                  <h1 className="text-lg font-semibold text-zinc-950 dark:text-white">
                    From MVP to sellable legal engine
                  </h1>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="hidden border-zinc-300 bg-white/70 text-zinc-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 sm:inline-flex"
                >
                  {user?.name || user?.email}
                </Badge>
                {toggleTheme ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleTheme}
                    className="text-zinc-700 hover:bg-white/70 dark:text-amber-200 dark:hover:bg-white/10"
                  >
                    {theme === "dark" ? (
                      <Sun className="h-4 w-4" />
                    ) : (
                      <Moon className="h-4 w-4" />
                    )}
                  </Button>
                ) : null}
                <Link href="/settings">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-zinc-700 hover:bg-white/70 dark:text-slate-300 dark:hover:bg-white/10"
                  >
                    <SettingsIcon className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
              <nav className="flex w-full max-w-full gap-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:hidden">
                {[
                  { href: "/dashboard", label: "Dashboard" },
                  { href: "/sector/corpus", label: "Corpus" },
                  { href: "/violations", label: "Violations" },
                  { href: "/reports", label: "Reports" },
                  { href: "/pricing", label: "Pricing" },
                ].map(item => (
                  <Link key={item.href} href={item.href}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0 text-zinc-600 hover:bg-white/70 hover:text-zinc-950 dark:text-slate-400 dark:hover:bg-white/8 dark:hover:text-white"
                    >
                      {item.label}
                    </Button>
                  </Link>
                ))}
              </nav>
            </div>
          </header>

          <main className="mx-auto w-full max-w-[96rem] px-3 py-4 sm:px-5 lg:px-6">
            <section className="mb-4 rounded-md border border-amber-500/25 bg-white/82 p-4 shadow-sm backdrop-blur dark:border-amber-400/25 dark:bg-[#0c1418]/84">
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
                <div>
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
                    Verdict
                  </p>
                  <h2 className="mt-2 max-w-4xl text-2xl font-semibold tracking-tight text-zinc-950 dark:text-white sm:text-3xl">
                    {verdict}. The market is the pipeline: evidence to violation
                    to QC to export to billing.
                  </h2>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600 dark:text-slate-400">
                    Another legal chatbot is a vendor tab. DueProcess becomes
                    its own category when it proves facts from the record, ranks
                    leverage, blocks overclaims, and ships usable packets
                    without pretending unsupported guesses are facts.
                  </p>
                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <MetricCard
                      title="Market score"
                      value={dataLoading ? "..." : `${readinessScore}%`}
                      detail={
                        dataLoading
                          ? "Reading live workspace state"
                          : `${liveGateCount} live gates, ${partialGateCount} partial`
                      }
                      icon={Rocket}
                      tone={
                        dataLoading
                          ? "info"
                          : readinessScore >= 80
                            ? "success"
                            : readinessScore >= 45
                              ? "warning"
                              : "danger"
                      }
                    />
                    <MetricCard
                      title="Record proof"
                      value={formatNumber(anchoredFindings.length)}
                      detail={`${formatNumber(findings.length)} total structured findings`}
                      icon={ShieldCheck}
                      tone={anchoredFindings.length > 0 ? "success" : "warning"}
                    />
                    <MetricCard
                      title="Revenue proof"
                      value={billingLive ? "Plan visible" : "Not enforced"}
                      detail={
                        billingLive
                          ? usage?.billing?.subscription?.status ||
                            "subscription state visible"
                          : "Billing still needs server-side tier reality."
                      }
                      icon={DollarSign}
                      tone={billingLive ? "success" : "warning"}
                    />
                  </div>
                </div>
                <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-white/10 dark:bg-black/20">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-slate-500">
                        Readiness
                      </p>
                      <p className="mt-1 text-4xl font-semibold text-zinc-950 dark:text-white">
                        {dataLoading ? "..." : `${readinessScore}%`}
                      </p>
                    </div>
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-200">
                      <Target className="h-6 w-6" />
                    </span>
                  </div>
                  <Progress
                    value={dataLoading ? 12 : readinessScore}
                    className="mt-4 h-2"
                  />
                  <div className="mt-4 space-y-2 text-xs leading-5 text-zinc-600 dark:text-slate-400">
                    <p>
                      {dataLoading
                        ? "Reading the live workspace before grading the business. No fake optimism, no fake panic."
                        : "MVP means the demo works when treated gently. A market means a stranger can upload ugly evidence, get useful work product, pay you, and not light the house on fire."}
                    </p>
                    <p>
                      {dataLoading
                        ? "Waiting for the live blocker profile."
                        : `Current blocker profile: ${formatNumber(failedDocuments.length)} OCR failures, ${formatNumber(blockedFindings.length)} blocked findings, ${formatNumber(missingRecords)} missing-record demands.`}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                title="Documents"
                value={documentsQuery.isLoading ? "..." : documents.length}
                detail={`${formatNumber(readyDocuments.length)} ready, ${formatNumber(pendingDocuments.length)} processing`}
                icon={Database}
                tone={failedDocuments.length > 0 ? "danger" : "success"}
              />
              <MetricCard
                title="Findings"
                value={findingsQuery.isLoading ? "..." : findings.length}
                detail={`${formatNumber(reportReadyFindings.length)} report-ready`}
                icon={Scale}
                tone={findings.length > 0 ? "info" : "warning"}
              />
              <MetricCard
                title="Reports"
                value={
                  savedReportsQuery.isLoading ? "..." : savedReports.length
                }
                detail="saved packets and exports"
                icon={ReceiptText}
                tone={savedReports.length > 0 ? "success" : "warning"}
              />
              <MetricCard
                title="AI cost"
                value={
                  exactUsageEnabled
                    ? formatUsd(usage?.aiUsage?.exact?.estimatedUsd)
                    : formatUsd(usage?.aiUsage?.savedAgentOutputs?.estimatedUsd)
                }
                detail={
                  exactUsageEnabled
                    ? "exact persisted telemetry"
                    : "estimated from saved output text"
                }
                icon={Gauge}
                tone={exactUsageEnabled ? "success" : "warning"}
              />
            </section>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
              <div className="min-w-0 space-y-5">
                <SectionShell
                  icon={Layers3}
                  title="Market gates"
                  description="These are the parts that convert a pretty MVP into something people can rely on and pay for."
                >
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {marketGates.map(gate => (
                      <GateCard key={gate.label} gate={gate} />
                    ))}
                  </div>
                </SectionShell>

                <SectionShell
                  icon={Landmark}
                  title="Category moat"
                  description="The product should own record-grounded legal leverage, not fight every generic AI assistant."
                >
                  <div className="grid gap-3 md:grid-cols-2">
                    {moatPillars.map(pillar => {
                      const Icon = pillar.icon;
                      return (
                        <div
                          key={pillar.title}
                          className="rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-white/10 dark:bg-slate-950/55"
                        >
                          <div className="flex items-start gap-3">
                            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200">
                              <Icon className="h-5 w-5" />
                            </span>
                            <div>
                              <p className="text-sm font-semibold text-zinc-950 dark:text-white">
                                {pillar.title}
                              </p>
                              <p className="mt-1 text-xs leading-5 text-zinc-600 dark:text-slate-400">
                                {pillar.detail}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </SectionShell>

                <SectionShell
                  icon={Workflow}
                  title="Execution plan"
                  description="Work the pipeline in order. Every shortcut before proof and billing is just cosplay with a nicer font."
                >
                  <div className="space-y-2">
                    {roadmapItems.map(item => (
                      <RoadmapRow key={item.title} item={item} />
                    ))}
                  </div>
                </SectionShell>
              </div>

              <aside className="min-w-0 space-y-5">
                <SectionShell
                  icon={Brain}
                  title="Next money moves"
                  description="The lowest-fiction path from this build to paid usage."
                >
                  <div className="space-y-3">
                    {[
                      {
                        title: "Private beta proof run",
                        detail:
                          "Upload a real messy case, run selected-file analysis, produce one exportable packet, and record cost.",
                        route: "/sector/corpus",
                        icon: FileSearch,
                      },
                      {
                        title: "Violation ledger demo",
                        detail:
                          "Lead with the crosswalk: violation, quote, document, timeline, missing records, QC.",
                        route: "/violations",
                        icon: ShieldCheck,
                      },
                      {
                        title: "Report sale motion",
                        detail:
                          "The thing being sold is the packet, not the chat. Make exports boringly reliable.",
                        route: "/reports",
                        icon: ReceiptText,
                      },
                      {
                        title: "Plan enforcement",
                        detail:
                          "Lock demo, enforce Case Builder, meter Firm usage, and fail loudly when Stripe config is wrong.",
                        route: "/pricing",
                        icon: DollarSign,
                      },
                    ].map(move => {
                      const Icon = move.icon;
                      return (
                        <Link key={move.title} href={move.route}>
                          <div className="rounded-md border border-zinc-200 bg-white/58 p-3 transition-colors hover:border-zinc-400 hover:bg-white dark:border-white/10 dark:bg-white/[0.035] dark:hover:border-white/25 dark:hover:bg-white/[0.07]">
                            <div className="flex items-start gap-3">
                              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-white/10 dark:bg-black/20 dark:text-slate-300">
                                <Icon className="h-4 w-4" />
                              </span>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-zinc-950 dark:text-white">
                                  {move.title}
                                </p>
                                <p className="mt-1 text-xs leading-5 text-zinc-600 dark:text-slate-400">
                                  {move.detail}
                                </p>
                              </div>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </SectionShell>

                <SectionShell
                  icon={AlertTriangle}
                  title="What still kills revenue"
                  description="These are not nice-to-haves. These are where money leaks out."
                >
                  <div className="space-y-3 text-sm">
                    {[
                      "Uploads must never silently produce empty OCR.",
                      "Unsupported claims must not enter reports as facts.",
                      "Stripe tier limits must be enforced on the server, not trusted from UI.",
                      "Exports need PDF/DOCX court formatting that survives outside the app.",
                      "Mobile must connect to the same backend without secret paste gymnastics.",
                      "Support and audit logs need to show what happened when a customer complains.",
                    ].map(item => (
                      <div
                        key={item}
                        className="flex items-start gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-slate-950/55"
                      >
                        <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
                        <p className="leading-5 text-zinc-700 dark:text-slate-300">
                          {item}
                        </p>
                      </div>
                    ))}
                  </div>
                </SectionShell>
              </aside>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
