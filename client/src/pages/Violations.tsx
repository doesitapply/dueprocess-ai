import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Clock,
  Database,
  FileSearch,
  FileText,
  Gauge,
  Loader2,
  Moon,
  Rocket,
  Scale,
  Search,
  SearchCheck,
  Settings as SettingsIcon,
  ShieldCheck,
  Sun,
} from "lucide-react";

type SourceAnchor = {
  documentId?: number;
  fileName?: string;
  quote?: string;
  support?: string;
};

type Finding = {
  id: number;
  runId: number;
  outputId: number | null;
  agentId: string;
  agentName: string;
  title: string;
  findingType: string;
  liabilityVector: string | null;
  remedyPath: string | null;
  severity: string;
  confidence: number;
  leverageScore: number;
  summary: string;
  sourceAnchors: SourceAnchor[];
  missingRecords: string[];
  legalAuthorities: string[];
  nextAction: string | null;
  qcStatus: string | null;
  qcReason: string | null;
  includedInReports: boolean;
  createdAt: Date | string;
};

type DocumentRecord = {
  id: number;
  fileName: string;
  status: string;
  mimeType?: string | null;
  createdAt?: Date | string;
};

const qcLabels: Record<string, string> = {
  approved: "approved",
  downgraded: "downgraded",
  blocked: "blocked",
  needs_more_proof: "needs proof",
  pending: "pending",
};

function formatDate(value: Date | string | undefined) {
  if (!value) return "undated";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function normalize(value: string | null | undefined) {
  return (value || "").replace(/_/g, " ").trim();
}

function qcTone(status: string | null | undefined) {
  const normalized = (status || "pending").toLowerCase();
  if (normalized === "approved") return "ready";
  if (normalized === "downgraded" || normalized === "needs_more_proof")
    return "warning";
  if (normalized === "blocked") return "blocked";
  return "neutral";
}

function QcBadge({ status }: { status: string | null | undefined }) {
  const tone = qcTone(status);
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-md px-2 py-1 text-xs font-semibold",
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
      QC {qcLabels[(status || "pending").toLowerCase()] || status || "pending"}
    </Badge>
  );
}

function StatTile({
  label,
  value,
  detail,
  tone = "text-zinc-950 dark:text-white",
}: {
  label: string;
  value: string | number;
  detail: string;
  tone?: string;
}) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white/78 p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-slate-500">
        {label}
      </p>
      <p className={cn("mt-2 text-3xl font-semibold tracking-tight", tone)}>
        {value}
      </p>
      <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-slate-400">
        {detail}
      </p>
    </div>
  );
}

export default function Violations() {
  const [query, setQuery] = useState("");
  const [qcFilter, setQcFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const { theme, toggleTheme } = useTheme();
  const findingsQuery = trpc.agents.listFindings.useQuery();
  const documentsQuery = trpc.documents.list.useQuery();
  const findings = (findingsQuery.data ?? []) as Finding[];
  const documents = (documentsQuery.data ?? []) as DocumentRecord[];

  const documentById = useMemo(
    () => new Map(documents.map(document => [document.id, document])),
    [documents]
  );

  const findingTypes = useMemo(
    () =>
      Array.from(
        new Set(findings.map(finding => finding.findingType).filter(Boolean))
      ).sort(),
    [findings]
  );

  const filteredFindings = useMemo(() => {
    const term = query.trim().toLowerCase();
    return findings
      .filter(finding => {
        if (qcFilter !== "all" && (finding.qcStatus || "pending") !== qcFilter)
          return false;
        if (typeFilter !== "all" && finding.findingType !== typeFilter)
          return false;
        if (!term) return true;
        const haystack = [
          finding.title,
          finding.summary,
          finding.agentName,
          finding.findingType,
          finding.liabilityVector,
          finding.remedyPath,
          finding.severity,
          ...finding.sourceAnchors.map(
            anchor =>
              `${anchor.fileName || ""} ${anchor.quote || ""} ${anchor.support || ""}`
          ),
          ...finding.missingRecords,
          ...finding.legalAuthorities,
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(term);
      })
      .sort((left, right) => {
        const leverage = right.leverageScore - left.leverageScore;
        if (leverage !== 0) return leverage;
        return right.confidence - left.confidence;
      });
  }, [findings, qcFilter, query, typeFilter]);

  const anchoredCount = findings.filter(
    finding => finding.sourceAnchors.length > 0
  ).length;
  const reportReadyCount = findings.filter(
    finding => finding.includedInReports && qcTone(finding.qcStatus) === "ready"
  ).length;
  const blockedCount = findings.filter(
    finding => qcTone(finding.qcStatus) === "blocked"
  ).length;
  const missingRecordsCount = findings.reduce(
    (total, finding) => total + finding.missingRecords.length,
    0
  );

  const timelineRows = useMemo(
    () =>
      filteredFindings
        .flatMap(finding => {
          const anchors =
            finding.sourceAnchors.length > 0
              ? finding.sourceAnchors
              : [{} as SourceAnchor];
          return anchors.map(anchor => {
            const document = anchor.documentId
              ? documentById.get(anchor.documentId)
              : undefined;
            return {
              finding,
              anchor,
              date: document?.createdAt || finding.createdAt,
              fileName:
                anchor.fileName || document?.fileName || "Unanchored finding",
            };
          });
        })
        .sort(
          (left, right) =>
            new Date(right.date || 0).getTime() -
            new Date(left.date || 0).getTime()
        ),
    [documentById, filteredFindings]
  );

  const documentRows = useMemo(() => {
    const counts = new Map<number, number>();
    findings.forEach(finding => {
      finding.sourceAnchors.forEach(anchor => {
        if (anchor.documentId)
          counts.set(
            anchor.documentId,
            (counts.get(anchor.documentId) ?? 0) + 1
          );
      });
    });
    return documents
      .map(document => ({ document, count: counts.get(document.id) ?? 0 }))
      .filter(row => row.count > 0)
      .sort((left, right) => right.count - left.count);
  }, [documents, findings]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f7f2e8] text-zinc-950 dark:bg-[#070a0d] dark:text-slate-100">
      <div className="pointer-events-none fixed inset-0 opacity-50 dark:opacity-40">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(39,39,42,0.07)_1px,transparent_1px),linear-gradient(to_bottom,rgba(39,39,42,0.07)_1px,transparent_1px)] bg-[size:42px_42px] dark:bg-[linear-gradient(to_right,rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.045)_1px,transparent_1px)]" />
      </div>

      <div className="relative z-10 flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-zinc-200 bg-white/78 p-4 backdrop-blur-xl dark:border-white/10 dark:bg-[#0b1016]/92 lg:flex">
          <div className="mb-6 flex min-w-0 items-center gap-3">
            <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-200">
              <Scale className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold uppercase tracking-[0.18em] text-zinc-950 dark:text-amber-200">
                DueProcess AI
              </h1>
              <p className="truncate text-[0.68rem] uppercase tracking-[0.18em] text-zinc-500 dark:text-slate-500">
                Legal intelligence command
              </p>
            </div>
          </div>

          <nav className="space-y-1">
            {[
              { href: "/dashboard", label: "Dashboard", icon: Gauge },
              { href: "/sector/corpus", label: "Corpus", icon: Database },
              {
                href: "/sector/evidence",
                label: "Evidence Review",
                icon: SearchCheck,
              },
              { href: "/sector/arsenal", label: "Legal Analysis", icon: Scale },
              {
                href: "/violations",
                label: "Violations",
                icon: ShieldCheck,
                active: true,
              },
              { href: "/reports", label: "Reports", icon: FileText },
              { href: "/market", label: "Market Command", icon: Rocket },
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

          <div className="mt-auto rounded-md border border-emerald-500/25 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/8 dark:text-emerald-100">
            <div className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Findings index live
            </div>
            <p className="mt-2 text-emerald-700/80 dark:text-emerald-200/80">
              {findings.length} findings · {anchoredCount} source-anchored
            </p>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-zinc-200 bg-[#f7f2e8]/88 backdrop-blur-xl dark:border-white/10 dark:bg-[#0b1016]/88">
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 px-3 py-3 sm:px-5 lg:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-zinc-700 hover:bg-white/70 dark:text-slate-300 dark:hover:bg-white/10 lg:hidden"
                >
                  <FileText className="h-4 w-4" />
                </Button>
                <div>
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-slate-500">
                    Violations
                  </p>
                  <h1 className="text-lg font-semibold text-zinc-950 dark:text-white">
                    Violation Evidence Map
                  </h1>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link href="/sector/arsenal">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-zinc-300 bg-white/80 dark:border-white/10 dark:bg-white/5"
                  >
                    Run analysis
                  </Button>
                </Link>
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
            </div>
          </header>

          <main className="mx-auto w-full max-w-[96rem] px-3 py-4 sm:px-5 lg:px-6">
            <section className="mb-4 rounded-md border border-amber-500/25 bg-white/78 p-4 shadow-sm backdrop-blur dark:border-amber-400/25 dark:bg-[#0c1418]/82">
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
                <div>
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
                    Record-grounded violations
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-white">
                    Each violation tied to evidence and time
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600 dark:text-slate-400">
                    This page is the crosswalk: violation, source quote,
                    document, timeline point, missing proof, QC status, and next
                    action.
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                  <Link href="/reports">
                    <Button className="w-full justify-between bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-amber-300 dark:text-zinc-950 dark:hover:bg-amber-200">
                      Build report from cleared findings
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href="/sector/evidence">
                    <Button
                      variant="outline"
                      className="w-full justify-between border-zinc-300 bg-white/80 dark:border-white/10 dark:bg-white/5"
                    >
                      Open Evidence timeline
                      <CalendarDays className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            </section>

            <section className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatTile
                label="Violations"
                value={findingsQuery.isLoading ? "..." : findings.length}
                detail={`${blockedCount} blocked or held by QC`}
              />
              <StatTile
                label="Source-anchored"
                value={anchoredCount}
                detail="findings tied to documents"
                tone="text-emerald-700 dark:text-emerald-300"
              />
              <StatTile
                label="Report-ready"
                value={reportReadyCount}
                detail="approved and included"
                tone="text-blue-700 dark:text-blue-300"
              />
              <StatTile
                label="Missing records"
                value={missingRecordsCount}
                detail="records to demand or verify"
                tone="text-amber-700 dark:text-amber-300"
              />
            </section>

            <section className="mb-4 rounded-md border border-zinc-200 bg-white/78 p-3 shadow-sm dark:border-white/10 dark:bg-[#0c1118]/86">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_13rem_13rem]">
                <div className="flex items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-white/10 dark:bg-black/20">
                  <Search className="h-4 w-4 text-zinc-500 dark:text-slate-500" />
                  <Input
                    value={query}
                    onChange={event => setQuery(event.target.value)}
                    placeholder="Search violation, quote, document, remedy, missing record..."
                    className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                  />
                </div>
                <select
                  value={typeFilter}
                  onChange={event => setTypeFilter(event.target.value)}
                  className="h-11 rounded-md border border-zinc-200 bg-zinc-50 px-3 text-sm dark:border-white/10 dark:bg-black/20"
                >
                  <option value="all">All violation types</option>
                  {findingTypes.map(type => (
                    <option key={type} value={type}>
                      {normalize(type)}
                    </option>
                  ))}
                </select>
                <select
                  value={qcFilter}
                  onChange={event => setQcFilter(event.target.value)}
                  className="h-11 rounded-md border border-zinc-200 bg-zinc-50 px-3 text-sm dark:border-white/10 dark:bg-black/20"
                >
                  <option value="all">All QC states</option>
                  <option value="approved">Approved</option>
                  <option value="downgraded">Downgraded</option>
                  <option value="needs_more_proof">Needs proof</option>
                  <option value="blocked">Blocked</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
            </section>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
              <section className="min-w-0 space-y-3">
                {findingsQuery.isLoading ? (
                  <div className="rounded-md border border-zinc-200 bg-white/78 p-8 text-center text-sm text-zinc-500 dark:border-white/10 dark:bg-[#0c1118]/86 dark:text-slate-400">
                    <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />
                    Loading violations
                  </div>
                ) : filteredFindings.length === 0 ? (
                  <div className="rounded-md border border-dashed border-zinc-300 bg-white/78 p-8 text-center text-sm text-zinc-500 dark:border-white/15 dark:bg-[#0c1118]/86 dark:text-slate-400">
                    <ShieldCheck className="mx-auto mb-3 h-8 w-8 text-zinc-400 dark:text-slate-500" />
                    No violations match this view. Run Legal Analysis or clear
                    the filters.
                  </div>
                ) : (
                  filteredFindings.map(finding => (
                    <article
                      key={finding.id}
                      className="rounded-md border border-zinc-200 bg-white/82 p-4 shadow-sm dark:border-white/10 dark:bg-[#0c1118]/86"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="break-words text-lg font-semibold text-zinc-950 dark:text-white">
                              {finding.title}
                            </h2>
                            <QcBadge status={finding.qcStatus} />
                          </div>
                          <p className="mt-1 text-xs text-zinc-500 dark:text-slate-500">
                            {finding.agentName} ·{" "}
                            {normalize(finding.findingType)} ·{" "}
                            {formatDate(finding.createdAt)}
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-right text-xs">
                          <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-white/10 dark:bg-white/[0.04]">
                            <div className="text-zinc-500 dark:text-slate-500">
                              Confidence
                            </div>
                            <div
                              className={
                                finding.confidence >= 95
                                  ? "text-emerald-700 dark:text-emerald-300"
                                  : "text-amber-700 dark:text-amber-300"
                              }
                            >
                              {finding.confidence}
                            </div>
                          </div>
                          <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-white/10 dark:bg-white/[0.04]">
                            <div className="text-zinc-500 dark:text-slate-500">
                              Leverage
                            </div>
                            <div className="text-blue-700 dark:text-blue-300">
                              {finding.leverageScore}
                            </div>
                          </div>
                        </div>
                      </div>

                      <p className="mt-3 text-sm leading-6 text-zinc-700 dark:text-slate-300">
                        {finding.summary}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {finding.liabilityVector ? (
                          <Badge className="bg-zinc-100 text-zinc-700 dark:bg-white/10 dark:text-slate-200">
                            {finding.liabilityVector}
                          </Badge>
                        ) : null}
                        {finding.remedyPath ? (
                          <Badge className="bg-zinc-100 text-zinc-700 dark:bg-white/10 dark:text-slate-200">
                            {finding.remedyPath}
                          </Badge>
                        ) : null}
                        <Badge className="bg-zinc-100 text-zinc-700 dark:bg-white/10 dark:text-slate-200">
                          {finding.severity}
                        </Badge>
                        {finding.includedInReports ? (
                          <Badge className="bg-emerald-600 text-white dark:bg-emerald-400 dark:text-zinc-950">
                            report-ready
                          </Badge>
                        ) : null}
                      </div>

                      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_18rem]">
                        <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-white/[0.035]">
                          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-slate-500">
                            <FileSearch className="h-3.5 w-3.5" />
                            Evidence support
                          </div>
                          {finding.sourceAnchors.length === 0 ? (
                            <p className="text-sm text-amber-700 dark:text-amber-200">
                              No source anchors attached. Treat as not
                              court-ready.
                            </p>
                          ) : (
                            <div className="space-y-3">
                              {finding.sourceAnchors.map((anchor, index) => {
                                const document = anchor.documentId
                                  ? documentById.get(anchor.documentId)
                                  : undefined;
                                return (
                                  <div
                                    key={`${finding.id}-${anchor.documentId || "anchor"}-${index}`}
                                    className="text-sm leading-6"
                                  >
                                    <p className="font-medium text-zinc-950 dark:text-white">
                                      {anchor.fileName ||
                                        document?.fileName ||
                                        `Document ${anchor.documentId || index + 1}`}
                                    </p>
                                    <p className="text-xs text-zinc-500 dark:text-slate-500">
                                      Timeline point:{" "}
                                      {formatDate(
                                        document?.createdAt || finding.createdAt
                                      )}
                                    </p>
                                    {anchor.quote ? (
                                      <blockquote className="mt-2 border-l-2 border-amber-500/60 pl-3 text-zinc-700 dark:text-slate-300">
                                        {anchor.quote}
                                      </blockquote>
                                    ) : null}
                                    {anchor.support ? (
                                      <p className="mt-1 text-xs text-amber-700 dark:text-amber-200">
                                        {anchor.support}
                                      </p>
                                    ) : null}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        <div className="space-y-3">
                          {finding.missingRecords.length > 0 ? (
                            <div className="rounded-md border border-amber-500/25 bg-amber-500/10 p-3">
                              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-200">
                                Missing records
                              </p>
                              <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-5 text-amber-800 dark:text-amber-100">
                                {finding.missingRecords
                                  .slice(0, 5)
                                  .map(record => (
                                    <li key={record}>{record}</li>
                                  ))}
                              </ul>
                            </div>
                          ) : null}
                          {finding.legalAuthorities.length > 0 ? (
                            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-white/[0.035]">
                              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-slate-500">
                                Authority
                              </p>
                              <p className="mt-2 text-xs leading-5 text-zinc-700 dark:text-slate-300">
                                {finding.legalAuthorities
                                  .slice(0, 4)
                                  .join("; ")}
                              </p>
                            </div>
                          ) : null}
                          {finding.nextAction ? (
                            <div className="rounded-md border border-blue-500/25 bg-blue-500/10 p-3">
                              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700 dark:text-blue-200">
                                Next action
                              </p>
                              <p className="mt-2 text-xs leading-5 text-blue-800 dark:text-blue-100">
                                {finding.nextAction}
                              </p>
                            </div>
                          ) : null}
                        </div>
                      </div>

                      {finding.qcReason ? (
                        <p className="mt-3 text-xs leading-5 text-amber-700 dark:text-amber-200">
                          {finding.qcReason}
                        </p>
                      ) : null}
                    </article>
                  ))
                )}
              </section>

              <aside className="space-y-4">
                <section className="rounded-md border border-zinc-200 bg-white/82 shadow-sm dark:border-white/10 dark:bg-[#0c1118]/86">
                  <div className="border-b border-zinc-200 px-4 py-4 dark:border-white/10">
                    <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-700 dark:text-slate-300">
                      Timeline link
                    </h2>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-slate-500">
                      Findings placed by anchored document date.
                    </p>
                  </div>
                  <div className="max-h-[34rem] space-y-3 overflow-auto p-4">
                    {timelineRows.length === 0 ? (
                      <p className="text-sm text-zinc-500 dark:text-slate-500">
                        No timeline rows yet.
                      </p>
                    ) : (
                      timelineRows.slice(0, 18).map((row, index) => (
                        <div
                          key={`${row.finding.id}-${index}`}
                          className="relative pl-6"
                        >
                          <span className="absolute left-0 top-1.5 h-3 w-3 rounded-full border border-amber-500 bg-amber-500/20" />
                          <span className="absolute bottom-[-1rem] left-[5px] top-5 w-px bg-zinc-200 dark:bg-white/10" />
                          <p className="text-xs font-semibold text-zinc-500 dark:text-slate-500">
                            {formatDate(row.date)}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-zinc-950 dark:text-white">
                            {row.finding.title}
                          </p>
                          <p className="mt-1 truncate text-xs text-zinc-500 dark:text-slate-500">
                            {row.fileName}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </section>

                <section className="rounded-md border border-zinc-200 bg-white/82 shadow-sm dark:border-white/10 dark:bg-[#0c1118]/86">
                  <div className="border-b border-zinc-200 px-4 py-4 dark:border-white/10">
                    <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-700 dark:text-slate-300">
                      Evidence crosswalk
                    </h2>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-slate-500">
                      Documents with the most attached findings.
                    </p>
                  </div>
                  <div className="space-y-2 p-4">
                    {documentRows.length === 0 ? (
                      <p className="text-sm text-zinc-500 dark:text-slate-500">
                        No document-linked findings yet.
                      </p>
                    ) : (
                      documentRows.slice(0, 10).map(row => (
                        <div
                          key={row.document.id}
                          className="rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-white/[0.035]"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-zinc-950 dark:text-white">
                                {row.document.fileName}
                              </p>
                              <p className="mt-1 text-xs text-zinc-500 dark:text-slate-500">
                                {formatDate(row.document.createdAt)}
                              </p>
                            </div>
                            <Badge className="bg-zinc-950 text-white dark:bg-amber-300 dark:text-zinc-950">
                              {row.count}
                            </Badge>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </aside>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
