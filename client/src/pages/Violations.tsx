import { useMemo, useState } from "react";
import { Link } from "wouter";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowRight,
  Archive,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Clock,
  Database,
  FileText,
  FileSearch,
  FolderSearch,
  Gavel,
  Loader2,
  Scale,
  Search,
  SearchCheck,
  ShieldCheck,
  type LucideIcon,
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

type ViolationCluster = {
  label: string;
  count: number;
  anchored: number;
  reportReady: number;
  blocked: number;
  missingRecords: number;
  topLeverage: number;
  averageConfidence: number;
  nextAction: string;
};

type ConfidenceFilter = "all" | "low";
type FindingAction = {
  label: string;
  detail: string;
  href: string;
  icon: LucideIcon;
  tone: "primary" | "warning" | "neutral";
};

const LOW_CONFIDENCE_THRESHOLD = 95;

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

function getInitialConfidenceFilter(): ConfidenceFilter {
  if (typeof window === "undefined") return "all";
  return new URLSearchParams(window.location.search).get("confidence") ===
    "low"
    ? "low"
    : "all";
}

function isLowConfidence(finding: Finding) {
  return (
    finding.confidence > 0 && finding.confidence < LOW_CONFIDENCE_THRESHOLD
  );
}

function findingSearchText(finding: Finding) {
  return [
    finding.title,
    finding.summary,
    finding.agentName,
    finding.findingType,
    finding.liabilityVector,
    finding.remedyPath,
    finding.severity,
    finding.nextAction,
    finding.qcReason,
    ...finding.missingRecords,
    ...finding.legalAuthorities,
    ...finding.sourceAnchors.map(
      anchor =>
        `${anchor.fileName || ""} ${anchor.quote || ""} ${anchor.support || ""}`
    ),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function reportTemplateForFinding(finding: Finding) {
  const text = findingSearchText(finding);
  if (/monell|municipal|policy|custom|train|supervis|ratification/.test(text)) {
    return {
      template: "case_strategy",
      path: "monell_outline",
      label: "Build Monell outline",
      detail: "Policy/custom map",
      icon: Scale,
    };
  }
  if (/mandamus|writ|refusal|delay|rule|findings|adequate remedy/.test(text)) {
    return {
      template: "mandamus_writ",
      path: "mandamus_quality",
      label: "Build writ packet",
      detail: "Mandamus gates",
      icon: Gavel,
    };
  }
  if (/immunity|judge|prosecutor|qualified|judicial|prosecutorial|actor/.test(text)) {
    return {
      template: "immunity_relief",
      path: "actor_matrix",
      label: "Build actor matrix",
      detail: "Immunity route",
      icon: ShieldCheck,
    };
  }
  if (/timeline|date|gap|contradiction|retaliation|sequence/.test(text)) {
    return {
      template: "evidence_chronology",
      path: "timeline_gaps",
      label: "Build timeline map",
      detail: "Events and gaps",
      icon: CalendarDays,
    };
  }
  if (/source|quote|appendix|hash|exhibit|citation/.test(text)) {
    return {
      template: "source_appendix",
      path: "source_appendix",
      label: "Build source appendix",
      detail: "Evidence ledger",
      icon: Archive,
    };
  }
  return {
    template: "case_strategy",
    path: "cause_of_action",
    label: "Build cause map",
    detail: "Claims and remedies",
    icon: FileText,
  };
}

function findingReportHref(finding: Finding, template: string, path?: string) {
  const pathParam = path ? `&path=${encodeURIComponent(path)}` : "";
  return `/reports?template=${encodeURIComponent(template)}${pathParam}&finding=${finding.id}#build`;
}

function findingActions(finding: Finding): FindingAction[] {
  const actions: FindingAction[] = [];
  const reportRoute = reportTemplateForFinding(finding);
  actions.push({
    label: reportRoute.label,
    detail: reportRoute.detail,
    href: findingReportHref(finding, reportRoute.template, reportRoute.path),
    icon: reportRoute.icon,
    tone: "primary",
  });

  if (finding.missingRecords.length > 0) {
    actions.push({
      label: "Demand records",
      detail: `${finding.missingRecords.length} gap${finding.missingRecords.length === 1 ? "" : "s"}`,
      href: findingReportHref(
        finding,
        "discovery_demands",
        "discovery_demands"
      ),
      icon: SearchCheck,
      tone: "warning",
    });
  }

  if (finding.sourceAnchors.length === 0 || isLowConfidence(finding)) {
    actions.push({
      label: "Fix proof",
      detail:
        finding.sourceAnchors.length === 0
          ? "Add source support"
          : "Review confidence",
      href: "/sector/evidence",
      icon: Database,
      tone: "warning",
    });
  }

  if (qcTone(finding.qcStatus) === "blocked") {
    actions.push({
      label: "Run QC again",
      detail: "Arsenal review",
      href: "/sector/arsenal",
      icon: ShieldCheck,
      tone: "warning",
    });
  }

  actions.push({
    label: "Assign to case",
    detail: "Clean case lane",
    href: "/cases#assign",
    icon: FolderSearch,
    tone: "neutral",
  });

  return actions.slice(0, 5);
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
  const toneClass = tone.includes("emerald")
    ? "text-emerald-700 dark:text-emerald-300"
    : tone.includes("amber")
      ? "text-amber-700 dark:text-amber-300"
      : tone.includes("blue")
        ? "text-blue-700 dark:text-blue-300"
        : tone.includes("red")
          ? "text-red-700 dark:text-red-300"
          : "text-zinc-950 dark:text-white";

  return (
    <div className="rounded-md border border-zinc-200 bg-white/72 px-3 py-2.5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
      <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-slate-500">
        {label}
      </p>
      <div className="mt-1 flex items-baseline justify-between gap-3">
        <p className={cn("text-2xl font-semibold tracking-tight", toneClass)}>
          {value}
        </p>
        <p className="min-w-0 truncate text-xs text-zinc-500 dark:text-slate-400">
          {detail}
        </p>
      </div>
    </div>
  );
}

export default function Violations() {
  const [query, setQuery] = useState("");
  const [qcFilter, setQcFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [confidenceFilter, setConfidenceFilter] =
    useState<ConfidenceFilter>(getInitialConfidenceFilter);
  const { activeCase, cases, isWholeWorkspace } = useWorkspaceCaseContext();
  const activeCaseId =
    !isWholeWorkspace && activeCase?.id !== null ? activeCase?.id : undefined;
  const activeScopeLabel = activeCase?.title ?? "Whole workspace";
  const findingsQuery = trpc.agents.listFindings.useQuery(
    activeCaseId ? { caseId: activeCaseId } : undefined,
    { retry: false }
  );
  const documentsQuery = trpc.documents.list.useQuery();
  const findings = (findingsQuery.data ?? []) as Finding[];
  const documents = (documentsQuery.data ?? []) as DocumentRecord[];
  const updateConfidenceFilter = (value: ConfidenceFilter) => {
    setConfidenceFilter(value);
    if (typeof window === "undefined") return;
    window.history.replaceState(
      null,
      "",
      value === "low" ? "/violations?confidence=low" : "/violations"
    );
  };

  const documentById = useMemo(
    () => new Map(documents.map(document => [document.id, document])),
    [documents]
  );
  const documentCaseLabels = useMemo(() => {
    const map = new Map<number, string[]>();
    cases.forEach(caseItem => {
      if (caseItem.virtual || caseItem.id === null) return;
      caseItem.documentIds.forEach(documentId => {
        map.set(documentId, [...(map.get(documentId) ?? []), caseItem.title]);
      });
    });
    return map;
  }, [cases]);

  const findingCaseLabels = (finding: Finding) => {
    if (activeCase && !activeCase.virtual && activeCase.id !== null) {
      return [activeCase.title];
    }
    const labels = new Set<string>();
    finding.sourceAnchors.forEach(anchor => {
      if (!anchor.documentId) return;
      (documentCaseLabels.get(anchor.documentId) ?? []).forEach(label =>
        labels.add(label)
      );
    });
    return labels.size > 0 ? Array.from(labels) : ["Unassigned / workspace"];
  };

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
        if (confidenceFilter === "low" && !isLowConfidence(finding))
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
  }, [confidenceFilter, findings, qcFilter, query, typeFilter]);

  const anchoredCount = findings.filter(
    finding => finding.sourceAnchors.length > 0
  ).length;
  const reportReadyCount = findings.filter(
    finding => finding.includedInReports && qcTone(finding.qcStatus) === "ready"
  ).length;
  const blockedCount = findings.filter(
    finding => qcTone(finding.qcStatus) === "blocked"
  ).length;
  const lowConfidenceCount = findings.filter(isLowConfidence).length;
  const missingRecordsCount = findings.reduce(
    (total, finding) => total + finding.missingRecords.length,
    0
  );
  const unanchoredCount = findings.length - anchoredCount;

  const violationClusters = useMemo<ViolationCluster[]>(() => {
    const grouped = new Map<string, Finding[]>();
    findings.forEach(finding => {
      const label =
        normalize(finding.liabilityVector) ||
        normalize(finding.remedyPath) ||
        normalize(finding.findingType) ||
        "Unclassified issue";
      grouped.set(label, [...(grouped.get(label) ?? []), finding]);
    });

    return Array.from(grouped.entries())
      .map(([label, group]) => {
        const sorted = group.slice().sort((left, right) => {
          const leverage = right.leverageScore - left.leverageScore;
          if (leverage !== 0) return leverage;
          return right.confidence - left.confidence;
        });
        const reportReady = group.filter(
          finding =>
            finding.includedInReports && qcTone(finding.qcStatus) === "ready"
        ).length;
        const confidenceTotal = group.reduce(
          (sum, finding) => sum + finding.confidence,
          0
        );
        return {
          label,
          count: group.length,
          anchored: group.filter(finding => finding.sourceAnchors.length > 0)
            .length,
          reportReady,
          blocked: group.filter(
            finding => qcTone(finding.qcStatus) === "blocked"
          ).length,
          missingRecords: group.reduce(
            (sum, finding) => sum + finding.missingRecords.length,
            0
          ),
          topLeverage: sorted[0]?.leverageScore ?? 0,
          averageConfidence: Math.round(confidenceTotal / group.length),
          nextAction:
            sorted.find(finding => finding.nextAction)?.nextAction ||
            (reportReady > 0
              ? "Use the report-ready findings in a court packet."
              : "Add source support or resolve QC before report use."),
        };
      })
      .sort((left, right) => {
        const leverage = right.topLeverage - left.topLeverage;
        if (leverage !== 0) return leverage;
        return right.count - left.count;
      });
  }, [findings]);

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
    <CommandSurface>
      <CommandTopBar
        title="Violation Evidence Map"
        eyebrow="Violations"
        actions={
          <>
            <Link href="/sector/arsenal">
              <Button
                variant="outline"
                size="sm"
                className="border-zinc-300 bg-white/80 dark:border-white/10 dark:bg-white/5"
              >
                Run analysis
              </Button>
            </Link>
            <Link href="/cases">
              <Button
                variant="outline"
                size="sm"
                className="hidden border-zinc-300 bg-white/80 dark:border-white/10 dark:bg-white/5 sm:inline-flex"
              >
                Compare cases
              </Button>
            </Link>
            <Link href="/reports">
              <Button
                size="sm"
                className="bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-amber-300 dark:text-zinc-950 dark:hover:bg-amber-200"
              >
                Build report
              </Button>
            </Link>
          </>
        }
      />
      <CommandMain>
        <section className="mb-3 rounded-md border border-zinc-200 bg-white/72 px-4 py-3 shadow-sm backdrop-blur dark:border-white/10 dark:bg-[#0c1118]/72">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">
                Violation ledger
              </p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight text-zinc-950 dark:text-white">
                Ranked issues with evidence, QC, timeline, and next action.
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className="w-fit rounded-md border-blue-500/25 bg-blue-500/10 px-3 py-1.5 text-blue-800 dark:text-blue-200"
              >
                Scope: {activeScopeLabel}
              </Badge>
              <Link href="/reports">
                <Button
                  size="sm"
                  className="justify-between bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-amber-300 dark:text-zinc-950 dark:hover:bg-amber-200"
                >
                  Build report
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/sector/evidence">
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-between border-zinc-300 bg-white/80 dark:border-white/10 dark:bg-white/5"
                >
                  Timeline
                  <CalendarDays className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
        <WorkspaceCaseStrip className="mb-3" />
        <CommandWorkflowBar className="mb-3" />

        <section className="mb-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label={activeCaseId ? "Case violations" : "Violations"}
            value={findingsQuery.isLoading ? "..." : findings.length}
            detail={`${blockedCount} blocked or held by QC · ${activeScopeLabel}`}
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

        <section className="mb-3 rounded-md border border-zinc-200 bg-white/72 p-3 shadow-sm dark:border-white/10 dark:bg-[#0c1118]/72">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-slate-500">
                Case-aware filters
              </p>
            </div>
            <Badge
              variant="outline"
              className={cn(
                "rounded-md px-3 py-1.5",
                activeCaseId
                  ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                  : "border-amber-500/25 bg-amber-500/10 text-amber-800 dark:text-amber-200"
              )}
            >
              {activeCaseId ? "case scoped" : "whole workspace"}
            </Badge>
          </div>
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_13rem_13rem_13rem]">
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
            <select
              value={confidenceFilter}
              onChange={event =>
                updateConfidenceFilter(event.target.value as ConfidenceFilter)
              }
              className="h-11 rounded-md border border-zinc-200 bg-zinc-50 px-3 text-sm dark:border-white/10 dark:bg-black/20"
            >
              <option value="all">All confidence</option>
              <option value="low">Below 95%</option>
            </select>
          </div>
          {confidenceFilter === "low" ? (
            <div
              data-testid="low-confidence-review-mode"
              className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-100"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-semibold">Low confidence review mode</p>
                  <p className="mt-1 leading-6 text-amber-800/80 dark:text-amber-100/75">
                    Showing {filteredFindings.length} of {lowConfidenceCount}{" "}
                    finding{lowConfidenceCount === 1 ? "" : "s"} below{" "}
                    {LOW_CONFIDENCE_THRESHOLD}% confidence. Fix these by adding
                    source quotes, resolving QC blocks, or downgrading the claim
                    before it goes into a report.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => updateConfidenceFilter("all")}
                  className="w-full border-amber-500/30 bg-white/70 text-amber-800 hover:bg-white dark:bg-black/20 dark:text-amber-100 sm:w-auto"
                >
                  Show all
                </Button>
              </div>
            </div>
          ) : null}
        </section>

        <section className="mb-4 rounded-md border border-zinc-200 bg-white/78 shadow-sm dark:border-white/10 dark:bg-[#0c1118]/78">
          <div className="border-b border-zinc-200 px-4 py-4 dark:border-white/10">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
                  Issue clusters
                </p>
                <h2 className="mt-1 text-base font-semibold tracking-tight text-zinc-950 dark:text-white">
                  Strongest groups first. Weak proof stays loud.
                </h2>
              </div>
              {unanchoredCount > 0 ? (
                <Badge
                  variant="outline"
                  className="rounded-md border-red-500/30 bg-red-500/10 px-3 py-1.5 text-red-700 dark:text-red-200"
                >
                  {unanchoredCount} unanchored
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="rounded-md border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-emerald-700 dark:text-emerald-200"
                >
                  anchors clean
                </Badge>
              )}
            </div>
          </div>
          <div className="grid gap-3 p-4 md:grid-cols-2 2xl:grid-cols-3">
            {violationClusters.length === 0 ? (
              <div className="rounded-md border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-white/15 dark:text-slate-400 md:col-span-2 2xl:col-span-3">
                No violation clusters yet. Run Legal Analysis on processed
                files.
              </div>
            ) : (
              violationClusters.slice(0, 6).map(cluster => {
                const clusterReady = cluster.reportReady > 0;
                const clusterNeedsProof =
                  cluster.anchored < cluster.count ||
                  cluster.missingRecords > 0 ||
                  cluster.blocked > 0;
                return (
                  <div
                    key={cluster.label}
                    className="rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-white/10 dark:bg-white/[0.035]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-words text-sm font-semibold text-zinc-950 dark:text-white">
                          {cluster.label}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500 dark:text-slate-500">
                          {cluster.count} finding
                          {cluster.count === 1 ? "" : "s"} · leverage{" "}
                          {cluster.topLeverage}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "rounded-md",
                          clusterReady &&
                            !clusterNeedsProof &&
                            "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200",
                          clusterReady &&
                            clusterNeedsProof &&
                            "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200",
                          !clusterReady &&
                            "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-200"
                        )}
                      >
                        {clusterReady
                          ? clusterNeedsProof
                            ? "use carefully"
                            : "report-ready"
                          : "not ready"}
                      </Badge>
                    </div>

                    <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs">
                      <div className="rounded-md border border-zinc-200 bg-white p-2 dark:border-white/10 dark:bg-black/20">
                        <p className="font-semibold text-zinc-950 dark:text-white">
                          {cluster.anchored}
                        </p>
                        <p className="mt-1 text-zinc-500 dark:text-slate-500">
                          anchors
                        </p>
                      </div>
                      <div className="rounded-md border border-zinc-200 bg-white p-2 dark:border-white/10 dark:bg-black/20">
                        <p className="font-semibold text-emerald-700 dark:text-emerald-300">
                          {cluster.reportReady}
                        </p>
                        <p className="mt-1 text-zinc-500 dark:text-slate-500">
                          ready
                        </p>
                      </div>
                      <div className="rounded-md border border-zinc-200 bg-white p-2 dark:border-white/10 dark:bg-black/20">
                        <p className="font-semibold text-amber-700 dark:text-amber-300">
                          {cluster.missingRecords}
                        </p>
                        <p className="mt-1 text-zinc-500 dark:text-slate-500">
                          gaps
                        </p>
                      </div>
                      <div className="rounded-md border border-zinc-200 bg-white p-2 dark:border-white/10 dark:bg-black/20">
                        <p className="font-semibold text-blue-700 dark:text-blue-300">
                          {cluster.averageConfidence}
                        </p>
                        <p className="mt-1 text-zinc-500 dark:text-slate-500">
                          conf
                        </p>
                      </div>
                    </div>

                    <p className="mt-4 text-xs leading-5 text-zinc-600 dark:text-slate-400">
                      <span className="font-semibold text-amber-700 dark:text-amber-300">
                        Next:
                      </span>{" "}
                      {cluster.nextAction}
                    </p>

                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setQuery(cluster.label);
                          setQcFilter("all");
                          setTypeFilter("all");
                          window.location.hash = "violations-list";
                        }}
                        className="w-full border-zinc-300 bg-white/80 text-zinc-800 hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100 sm:flex-1"
                      >
                        Filter ledger
                      </Button>
                      <Link href="/reports">
                        <Button className="w-full bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-amber-300 dark:text-zinc-950 dark:hover:bg-amber-200 sm:w-auto">
                          Build report
                        </Button>
                      </Link>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
          <section id="violations-list" className="min-w-0 space-y-3">
            {findingsQuery.isLoading ? (
              <div className="rounded-md border border-zinc-200 bg-white/78 p-8 text-center text-sm text-zinc-500 dark:border-white/10 dark:bg-[#0c1118]/86 dark:text-slate-400">
                <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />
                Loading violations
              </div>
            ) : filteredFindings.length === 0 ? (
              <div className="rounded-md border border-dashed border-zinc-300 bg-white/78 p-8 text-center text-sm text-zinc-500 dark:border-white/15 dark:bg-[#0c1118]/86 dark:text-slate-400">
                <ShieldCheck className="mx-auto mb-3 h-8 w-8 text-zinc-400 dark:text-slate-500" />
                No violations match this view. Run Legal Analysis or clear the
                filters.
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
                        {findingCaseLabels(finding)
                          .slice(0, 2)
                          .map(label => (
                            <Badge
                              key={`${finding.id}-${label}`}
                              variant="outline"
                              className="rounded-md border-blue-500/25 bg-blue-500/10 text-blue-800 dark:text-blue-200"
                            >
                              {label}
                            </Badge>
                          ))}
                      </div>
                      <p className="mt-1 text-xs text-zinc-500 dark:text-slate-500">
                        {finding.agentName} · {normalize(finding.findingType)} ·{" "}
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

                  <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-white/[0.035]">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-slate-500">
                        Fix or use this issue
                      </p>
                      <Badge
                        variant="outline"
                        className="rounded-md border-zinc-200 bg-white/70 text-zinc-600 dark:border-white/10 dark:bg-black/20 dark:text-slate-400"
                      >
                        {isLowConfidence(finding)
                          ? "needs review"
                          : qcTone(finding.qcStatus)}
                      </Badge>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {findingActions(finding).map(action => {
                        const ActionIcon = action.icon;
                        return (
                          <Link
                            key={`${finding.id}-${action.label}`}
                            href={action.href}
                          >
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className={cn(
                                "w-full justify-start gap-2 border-zinc-300 bg-white/80 text-left text-zinc-800 hover:bg-white dark:border-white/10 dark:bg-black/20 dark:text-slate-100",
                                action.tone === "primary" &&
                                  "border-blue-500/30 bg-blue-500/10 text-blue-800 dark:text-blue-100",
                                action.tone === "warning" &&
                                  "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-100"
                              )}
                            >
                              <ActionIcon className="h-4 w-4 shrink-0" />
                              <span className="min-w-0">
                                <span className="block truncate">
                                  {action.label}
                                </span>
                                <span className="block truncate text-[0.68rem] font-normal opacity-75">
                                  {action.detail}
                                </span>
                              </span>
                            </Button>
                          </Link>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_18rem]">
                    <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-white/[0.035]">
                      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-slate-500">
                        <FileSearch className="h-3.5 w-3.5" />
                        Evidence support
                      </div>
                      {finding.sourceAnchors.length === 0 ? (
                        <p className="text-sm text-amber-700 dark:text-amber-200">
                          No source anchors attached. Treat as not court-ready.
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
                            {finding.missingRecords.slice(0, 5).map(record => (
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
                            {finding.legalAuthorities.slice(0, 4).join("; ")}
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
      </CommandMain>
    </CommandSurface>
  );
}
