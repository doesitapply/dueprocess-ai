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
  Archive,
  ArrowRight,
  Brain,
  CheckCircle2,
  CircleAlert,
  Database,
  FileCheck,
  FileSearch,
  FileText,
  FolderSearch,
  Gauge,
  Layers3,
  Loader2,
  Moon,
  ReceiptText,
  Rocket,
  Scale,
  SearchCheck,
  Settings as SettingsIcon,
  ShieldCheck,
  Sparkles,
  Sun,
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

function SectionShell({
  title,
  description,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  description?: string;
  icon: LucideIcon;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
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
  const { theme, toggleTheme } = useTheme();
  const { data: documents = [], isLoading: documentsLoading } =
    trpc.documents.list.useQuery(undefined, {
      enabled: isAuthenticated,
    });
  const savedReportsQuery = trpc.reports.saved.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const reportPreviewQuery = trpc.reports.preview.useQuery(
    { scope: "case", minConfidence: 0 },
    { enabled: isAuthenticated && documents.length > 0, retry: false }
  );

  const typedDocuments = documents as DocumentRecord[];
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
              ) : null}
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
                  {
                    href: "/dashboard",
                    label: "Dashboard",
                    icon: Gauge,
                    active: true,
                  },
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
                  },
                ].map(item => {
                  const Icon = item.icon;
                  return (
                    <Link key={item.href} href={item.href}>
                      <div
                        className={cn(
                          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                          item.active
                            ? "border border-zinc-200 bg-zinc-100 text-zinc-950 dark:border-white/10 dark:bg-white/[0.08] dark:text-white"
                            : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-slate-400 dark:hover:bg-white/[0.07] dark:hover:text-white"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </div>
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div>
              <p className="mb-2 px-2 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-slate-500">
                Admin
              </p>
              <nav className="space-y-1">
                {[
                  { href: "/settings", label: "Settings", icon: SettingsIcon },
                  { href: "/pricing", label: "Billing", icon: Archive },
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

          <div className="mt-auto space-y-3">
            {failedDocuments > 0 ? (
              <Link href="/sector/corpus?status=failed">
                <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-200">
                  <div className="flex items-center gap-2 font-semibold">
                    <CircleAlert className="h-4 w-4" />
                    OCR blocked
                  </div>
                  <p className="mt-2 text-xs leading-5">
                    {failedDocuments} file{failedDocuments === 1 ? "" : "s"}{" "}
                    need extraction review.
                  </p>
                </div>
              </Link>
            ) : null}
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span className="font-semibold">System visible</span>
              </div>
              <p className="mt-2">
                Corpus {readiness}% · {savedReports.length} saved reports
              </p>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-zinc-200 bg-[#f7f2e8]/88 backdrop-blur-xl dark:border-white/10 dark:bg-[#0b0f16]/88 lg:hidden">
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 overflow-hidden px-3 py-3">
              <Link href="/">
                <div className="flex max-w-[14.5rem] min-w-0 cursor-pointer items-center gap-3">
                  {APP_LOGO ? (
                    <img
                      src={APP_LOGO}
                      alt={APP_TITLE}
                      className="h-9 w-9 shrink-0 rounded-md object-cover"
                    />
                  ) : null}
                  <h1 className="truncate text-sm font-semibold uppercase tracking-[0.16em] text-zinc-950 dark:text-white">
                    DueProcess AI
                  </h1>
                </div>
              </Link>
              <div className="flex shrink-0 items-center gap-2">
                {toggleTheme ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleTheme}
                    className="border-zinc-300 bg-white/80 dark:border-white/10 dark:bg-white/5"
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
                    variant="outline"
                    size="sm"
                    className="border-zinc-300 bg-white/80 dark:border-white/10 dark:bg-white/5"
                  >
                    <SettingsIcon className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
              <nav className="flex w-full max-w-full gap-1 overflow-x-auto pb-1">
                {[
                  { href: "/sector/corpus", label: "Corpus" },
                  { href: "/sector/evidence", label: "Evidence" },
                  { href: "/sector/arsenal", label: "Legal" },
                  { href: "/violations", label: "Violations" },
                  { href: "/reports", label: "Reports" },
                  { href: "/market", label: "Market" },
                  { href: "/settings", label: "Settings" },
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
            <div className="mb-4 hidden items-center justify-between gap-4 lg:flex">
              <div className="min-w-0">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-slate-500">
                  Dashboard
                </p>
                <h2 className="mt-1 truncate text-xl font-semibold text-zinc-950 dark:text-white">
                  Case operations command
                </h2>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge
                  variant="outline"
                  className="border-zinc-300 bg-white/70 text-zinc-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                >
                  {user?.name || user?.email}
                </Badge>
                {toggleTheme ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleTheme}
                    className="gap-2 border-zinc-300 bg-white/80 dark:border-white/10 dark:bg-white/5"
                  >
                    {theme === "dark" ? (
                      <Sun className="h-4 w-4" />
                    ) : (
                      <Moon className="h-4 w-4" />
                    )}
                    {theme === "dark" ? "Light" : "Dark"}
                  </Button>
                ) : null}
                <Link href="/settings">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-zinc-300 bg-white/80 dark:border-white/10 dark:bg-white/5"
                  >
                    <SettingsIcon className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>

            <section className="mb-4 rounded-md border border-zinc-200 bg-white/78 p-3 shadow-sm backdrop-blur dark:border-white/10 dark:bg-[#10161d]/84 sm:p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
                    Corpus status
                  </p>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-slate-400">
                    Real readiness, QC, and report state. No old shiny dashboard
                    nonsense.
                  </p>
                </div>
                <Link href={nextAction.route}>
                  <Button className="gap-2 bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-amber-300 dark:text-zinc-950 dark:hover:bg-amber-200">
                    <NextIcon
                      className={cn(
                        "h-4 w-4",
                        nextAction.icon === Loader2 && "animate-spin"
                      )}
                    />
                    {nextAction.cta}
                  </Button>
                </Link>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {gauges.map(gauge => (
                  <GaugeCard key={gauge.title} item={gauge} />
                ))}
              </div>
            </section>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
              <div className="min-w-0 space-y-5">
                <SectionShell
                  icon={Sparkles}
                  title="Command center"
                  description="Run the pipeline from real records to reportable output."
                >
                  <div className="grid gap-4 2xl:grid-cols-[16rem_minmax(0,1fr)]">
                    <Link href={nextAction.route}>
                      <div
                        className={cn(
                          "flex h-full min-h-56 flex-col justify-between rounded-md border p-4 transition-all hover:-translate-y-0.5",
                          nextAction.tone === "danger" &&
                            "border-red-500/30 bg-red-500/10",
                          nextAction.tone === "warning" &&
                            "border-amber-500/30 bg-amber-500/10",
                          nextAction.tone === "success" &&
                            "border-emerald-500/30 bg-emerald-500/10",
                          nextAction.tone === "info" &&
                            "border-blue-500/30 bg-blue-500/10"
                        )}
                      >
                        <div>
                          <span className="inline-flex h-12 w-12 items-center justify-center rounded-md bg-white/80 text-zinc-950 shadow-sm dark:bg-black/20 dark:text-white">
                            <NextIcon
                              className={cn(
                                "h-6 w-6",
                                nextAction.icon === Loader2 && "animate-spin"
                              )}
                            />
                          </span>
                          <p className="mt-5 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-slate-500">
                            Next best action
                          </p>
                          <h3 className="mt-2 break-words text-xl font-semibold text-zinc-950 dark:text-white">
                            {nextAction.title}
                          </h3>
                          <p className="mt-2 break-words text-sm leading-6 text-zinc-600 dark:text-slate-300">
                            {nextAction.detail}
                          </p>
                        </div>
                        <Button className="mt-5 w-full bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-amber-300 dark:text-zinc-950 dark:hover:bg-amber-200">
                          {nextAction.cta}
                        </Button>
                      </div>
                    </Link>

                    <div className="grid gap-3 md:grid-cols-4">
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
                  </div>
                </SectionShell>

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
                          <Link
                            key={document.id}
                            href={`/process/${document.id}`}
                          >
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
                        {failedDocuments === 1 ? "" : "s"} need extraction
                        review.
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
                        {blockedFindings === 1 ? "" : "s"} are blocked or held
                        by QC.
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
          </main>
        </div>
      </div>
    </div>
  );
}
