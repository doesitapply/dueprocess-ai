import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  CheckCircle2,
  GitCompare,
  Plus,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";

const ACTIVE_CASE_STORAGE_KEY = "dueprocess.activeCaseId";
export const WORKSPACE_CASE_KEY = "workspace";

export type WorkspaceCaseSummary = {
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
  latestReport?: {
    id: number;
    title: string;
    template: string;
    format: string;
    createdAt?: Date | string;
  } | null;
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

function readStoredCaseKey() {
  if (typeof window === "undefined") return WORKSPACE_CASE_KEY;
  return localStorage.getItem(ACTIVE_CASE_STORAGE_KEY) || WORKSPACE_CASE_KEY;
}

export function writeStoredCaseKey(caseKey: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACTIVE_CASE_STORAGE_KEY, caseKey);
}

export function caseKey(caseItem: WorkspaceCaseSummary) {
  return caseItem.id === null ? WORKSPACE_CASE_KEY : String(caseItem.id);
}

function humanStatus(status: string) {
  return status.replace(/_/g, " ");
}

function statusTone(status: string) {
  if (status === "packet_ready" || status === "findings_ready") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200";
  }
  if (status === "blocked" || status === "empty") {
    return "border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-200";
  }
  return "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200";
}

function statusIcon(status: string) {
  if (status === "packet_ready" || status === "findings_ready") {
    return CheckCircle2;
  }
  return AlertTriangle;
}

export function useWorkspaceCaseContext() {
  const [activeCaseKey, setActiveCaseKeyState] = useState(readStoredCaseKey);
  const casesQuery = trpc.cases.list.useQuery(undefined, {
    retry: false,
    staleTime: 15_000,
  });
  const cases = (casesQuery.data?.cases ?? []) as WorkspaceCaseSummary[];
  const durableCases = useMemo(
    () => cases.filter(caseItem => !caseItem.virtual && caseItem.id !== null),
    [cases]
  );
  const activeCase = useMemo(
    () =>
      cases.find(caseItem => caseKey(caseItem) === activeCaseKey) ??
      durableCases.find(caseItem => caseKey(caseItem) === activeCaseKey) ??
      null,
    [activeCaseKey, cases, durableCases]
  );

  useEffect(() => {
    if (activeCaseKey === WORKSPACE_CASE_KEY || cases.length === 0) return;
    const stillExists = cases.some(
      caseItem => caseKey(caseItem) === activeCaseKey
    );
    if (!stillExists) {
      setActiveCaseKeyState(WORKSPACE_CASE_KEY);
      writeStoredCaseKey(WORKSPACE_CASE_KEY);
    }
  }, [activeCaseKey, cases]);

  const setActiveCaseKey = (nextCaseKey: string) => {
    setActiveCaseKeyState(nextCaseKey);
    writeStoredCaseKey(nextCaseKey);
  };

  return {
    activeCase,
    activeCaseKey,
    activeDocumentIds: activeCase?.documentIds ?? [],
    cases,
    casesQuery,
    durableCases,
    isWholeWorkspace: activeCaseKey === WORKSPACE_CASE_KEY,
    setActiveCaseKey,
  };
}

export function WorkspaceCaseStrip({
  className,
  onUseDocuments,
  useDocumentsLabel = "Use this case",
}: {
  className?: string;
  onUseDocuments?: (documentIds: number[], caseId: number | null) => void;
  useDocumentsLabel?: string;
}) {
  const {
    activeCase,
    activeCaseKey,
    activeDocumentIds,
    casesQuery,
    durableCases,
    isWholeWorkspace,
    setActiveCaseKey,
  } = useWorkspaceCaseContext();
  const selectedStatus = activeCase?.healthStatus ?? "workspace";
  const StatusIcon = statusIcon(selectedStatus);
  const durableCaseCount = durableCases.length;
  const comparisonReady = durableCaseCount >= 2;
  const canUseDocuments =
    Boolean(onUseDocuments) &&
    !isWholeWorkspace &&
    activeDocumentIds.length > 0;

  return (
    <section
      className={cn(
        "rounded-md border border-zinc-200 bg-white/86 px-3 py-2 shadow-sm backdrop-blur dark:border-white/10 dark:bg-[#0b1118]/88",
        className
      )}
    >
      <div className="grid gap-3 xl:grid-cols-[minmax(16rem,0.36fr)_minmax(0,1fr)_auto] xl:items-center">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-slate-500">
            <Briefcase className="h-3.5 w-3.5" />
            Matter
          </div>
          <select
            value={activeCaseKey}
            onChange={event => setActiveCaseKey(event.target.value)}
            className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-950 outline-none focus:border-amber-500 dark:border-white/10 dark:bg-slate-950 dark:text-white"
          >
            <option value={WORKSPACE_CASE_KEY}>Whole workspace baseline</option>
            {durableCases.map(caseItem => (
              <option
                key={caseItem.id ?? caseItem.title}
                value={caseKey(caseItem)}
              >
                {caseItem.title}
              </option>
            ))}
          </select>
          {casesQuery.data?.migrationRequired ? (
            <p className="mt-2 text-xs text-red-700 dark:text-red-300">
              Workspace case migration is missing.
            </p>
          ) : null}
        </div>

        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span
              className={cn(
                "inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold",
                activeCase
                  ? statusTone(activeCase.healthStatus)
                  : statusTone("processing")
              )}
            >
              <StatusIcon className="mr-1 h-3 w-3" />
              {activeCase ? humanStatus(activeCase.healthStatus) : "workspace"}
            </span>
            <span
              className={cn(
                "inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold",
                comparisonReady
                  ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
                  : "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-200"
              )}
            >
              <GitCompare className="mr-1 h-3 w-3" />
              {durableCaseCount} lane{durableCaseCount === 1 ? "" : "s"}
            </span>
            <span className="truncate text-xs font-medium text-zinc-600 dark:text-slate-400">
              {activeCase?.title ?? "Whole workspace baseline"}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric label="Docs" value={activeCase?.stats.documents ?? 0} />
            <Metric
              label="Ready"
              value={`${activeCase?.stats.readiness ?? 0}%`}
            />
            <Metric
              label="Findings"
              value={activeCase?.stats.reportReadyFindings ?? 0}
            />
            <Metric
              label="Reports"
              value={activeCase?.stats.savedReports ?? 0}
            />
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3 xl:w-[19rem]">
          {canUseDocuments ? (
            <Button
              type="button"
              size="sm"
              onClick={() =>
                onUseDocuments?.(activeDocumentIds, activeCase?.id ?? null)
              }
              className="justify-between gap-2 bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-amber-300 dark:text-zinc-950 dark:hover:bg-amber-200"
            >
              {useDocumentsLabel}
            </Button>
          ) : null}
          <Link href="/cases#new-case">
            <Button
              type="button"
              size="sm"
              className="w-full justify-between gap-2 bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-amber-300 dark:text-zinc-950 dark:hover:bg-amber-200"
            >
              <Plus className="h-4 w-4" />
              New
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
          <Link href="/cases">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full justify-between gap-2 border-zinc-300 bg-white/80 text-zinc-800 hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100"
            >
              <GitCompare className="h-4 w-4" />
              Cases
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1.5 dark:border-white/10 dark:bg-white/[0.035]">
      <p className="text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-slate-500">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold text-zinc-950 dark:text-white">
        {value}
      </p>
    </div>
  );
}
