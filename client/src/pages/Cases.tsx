import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  CommandBadge,
  CommandCard,
  CommandCardBody,
  CommandCardHeader,
  CommandMain,
  CommandMetric,
  CommandNotice,
  CommandSurface,
  CommandTopBar,
  CommandWorkflowBar,
} from "@/components/command-ui";
import {
  caseKey,
  WorkspaceCaseStrip,
  writeStoredCaseKey,
} from "@/components/WorkspaceCaseStrip";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Briefcase,
  CheckCircle2,
  CircleAlert,
  Database,
  FolderOpen,
  FolderSearch,
  LayoutDashboard,
  Loader2,
  Plus,
  ReceiptText,
  SearchCheck,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

type DocumentRecord = {
  id: number;
  fileName: string;
  status: string;
  mimeType?: string | null;
  createdAt?: Date | string;
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

type CasesWorkbenchMode = "compare" | "assign" | "create";

type SuggestedCaseProfile = {
  title: string;
  caseNumber: string;
  jurisdiction: string;
  confidence: "high" | "medium" | "low";
  basis: string[];
};

function formatNumber(value: number | undefined | null) {
  return new Intl.NumberFormat().format(value ?? 0);
}

function healthLabel(status: string) {
  return status.replace(/_/g, " ");
}

function healthBadgeClass(status: string) {
  if (status === "packet_ready" || status === "findings_ready") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200";
  }
  if (status === "analysis_ready" || status === "processing") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200";
  }
  if (status === "blocked" || status === "empty") {
    return "border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-200";
  }
  return "border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-200";
}

function statusIcon(status: string) {
  if (status === "blocked" || status === "empty") return CircleAlert;
  if (status === "processing" || status === "analysis_ready")
    return AlertTriangle;
  return CheckCircle2;
}

function titleCaseWords(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map(
      word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    )
    .join(" ");
}

function inferCaseProfileFromDocuments(
  documents: DocumentRecord[]
): SuggestedCaseProfile | null {
  if (documents.length === 0) return null;
  const fileNames = documents.map(document => document.fileName).filter(Boolean);
  const corpusText = fileNames.join(" ");
  const caseNumberMatch =
    corpusText.match(/\b(?:CR|CV|C|A|CASE)[-\s]?\d[\w-]{2,}\b/i) ??
    corpusText.match(/\b\d{2,4}[-\s][A-Z]{1,4}[-\s]\d{2,8}\b/i);
  const jurisdictionPatterns: Array<[RegExp, string]> = [
    [/eighth judicial|8th judicial|clark county|nevada/i, "State of Nevada"],
    [/washoe|reno/i, "Washoe County, Nevada"],
    [/federal|district of nevada|u\.s\. district/i, "U.S. District Court, District of Nevada"],
    [/california/i, "California"],
    [/arizona/i, "Arizona"],
  ];
  const jurisdiction =
    jurisdictionPatterns.find(([pattern]) => pattern.test(corpusText))?.[1] ??
    (/state|people|criminal|prosecut/i.test(corpusText) &&
    /^CR/i.test(caseNumberMatch?.[0] ?? "")
      ? "State court criminal case"
      : "");
  const lowerText = corpusText.toLowerCase();
  const ignoredNameTokens = new Set([
    "bodycam",
    "complaint",
    "copy",
    "court",
    "county",
    "discovery",
    "draft",
    "email",
    "exhibit",
    "file",
    "final",
    "gmail",
    "hearing",
    "legal",
    "motion",
    "notice",
    "order",
    "page",
    "police",
    "record",
    "report",
    "state",
    "transcript",
  ]);
  const tokenCounts = fileNames
    .flatMap(fileName =>
      fileName
        .replace(/\.[^.]+$/, "")
        .split(/[^a-zA-Z]+/)
        .map(token => token.toLowerCase())
        .filter(token => token.length > 3 && !ignoredNameTokens.has(token))
    )
    .reduce((counts, token) => {
      counts.set(token, (counts.get(token) ?? 0) + 1);
      return counts;
    }, new Map<string, number>());
  const likelyNameTokens = Array.from(tokenCounts.entries())
    .sort((left, right) => {
      const countDelta = right[1] - left[1];
      if (countDelta !== 0) return countDelta;
      return right[0].length - left[0].length;
    })
    .map(([token]) => token);
  const partyName =
    tokenCounts.has("cameron") && tokenCounts.has("church")
      ? "Cameron Church"
      : likelyNameTokens[0]
        ? titleCaseWords(likelyNameTokens.slice(0, 2).join(" "))
        : "";
  const captionPlaintiff =
    jurisdiction === "State court criminal case"
      ? "State"
      : jurisdiction || "State";
  const title =
    /state|people|nevada|criminal|prosecut/i.test(corpusText) && partyName
      ? `${captionPlaintiff} v. ${partyName}`
      : partyName
        ? `${partyName} case file`
        : "Workspace case profile";
  const basis = [
    `${documents.length} workspace document${documents.length === 1 ? "" : "s"} scanned`,
    caseNumberMatch ? `case number candidate: ${caseNumberMatch[0]}` : null,
    jurisdiction ? `jurisdiction signal: ${jurisdiction}` : null,
    lowerText.includes("transcript") ? "transcript files detected" : null,
    lowerText.includes("motion") || lowerText.includes("order")
      ? "motion/order files detected"
      : null,
  ].filter((item): item is string => Boolean(item));
  const confidence =
    caseNumberMatch && jurisdiction
      ? "high"
      : caseNumberMatch || jurisdiction
        ? "medium"
        : "low";

  return {
    title,
    caseNumber: caseNumberMatch?.[0].replace(/\s+/g, "-") ?? "",
    jurisdiction,
    confidence,
    basis,
  };
}

function CaseHeroStat({
  label,
  value,
  detail,
  icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail: string;
  icon?: LucideIcon;
  tone?: "neutral" | "success" | "warning" | "danger" | "info" | "accent";
}) {
  return (
    <CommandMetric
      label={label}
      value={value}
      detail={detail}
      icon={icon}
      tone={tone}
    />
  );
}

function CaseScorecard({
  caseItem,
  rank,
}: {
  caseItem: WorkspaceCaseSummary;
  rank: number;
}) {
  const StatusIcon = statusIcon(caseItem.healthStatus);
  const problemCount =
    caseItem.stats.failedDocuments +
    caseItem.stats.pendingDocuments +
    caseItem.stats.blockedFindings;
  const outputSignals = [
    {
      label: "Text",
      value: `${caseItem.stats.readiness}%`,
      ok: caseItem.stats.readiness === 100,
    },
    {
      label: "Findings",
      value: formatNumber(caseItem.stats.reportReadyFindings),
      ok: caseItem.stats.reportReadyFindings > 0,
    },
    {
      label: "Packet",
      value: formatNumber(caseItem.stats.savedReports),
      ok: caseItem.stats.savedReports > 0,
    },
  ];

  return (
    <article className="flex min-w-0 flex-col rounded-md border border-zinc-200 bg-white/80 p-4 shadow-sm dark:border-white/10 dark:bg-[#111821]/86">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200">
            {caseItem.virtual ? (
              <FolderOpen className="h-5 w-5" />
            ) : (
              <Briefcase className="h-5 w-5" />
            )}
          </span>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-zinc-950 dark:text-white">
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
          <StatusIcon className="mr-1 h-3 w-3" />
          {healthLabel(caseItem.healthStatus)}
        </Badge>
      </div>

      <div className="mt-5 rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-slate-950/55">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-slate-500">
            Matter quality score
          </p>
          <p className="text-sm font-semibold text-zinc-950 dark:text-white">
            #{rank} · {caseItem.stats.comparisonScore}%
          </p>
        </div>
        <Progress value={caseItem.stats.comparisonScore} className="mt-3 h-2" />
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {outputSignals.map(signal => (
            <div
              key={signal.label}
              className={cn(
                "rounded-md border px-2 py-2 text-xs",
                signal.ok
                  ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                  : "border-zinc-200 bg-white text-zinc-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-400"
              )}
            >
              <span className="font-semibold">{signal.label}</span>
              <span className="float-right">{signal.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["Docs", caseItem.stats.documents],
          ["Ready", `${caseItem.stats.readiness}%`],
          ["Findings", caseItem.stats.reportReadyFindings],
          ["Packets", caseItem.stats.savedReports],
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

      <div
        className={cn(
          "mt-4 rounded-md border p-3 text-xs leading-5",
          problemCount > 0
            ? "border-red-500/25 bg-red-500/10 text-red-800 dark:text-red-200"
            : "border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
        )}
      >
        {problemCount > 0
          ? `${formatNumber(problemCount)} issue${problemCount === 1 ? "" : "s"} need attention before this case should be trusted.`
          : "No blocked OCR, pending files, or held findings are showing for this case."}
      </div>

      <p className="mt-4 text-sm leading-6 text-zinc-600 dark:text-slate-400">
        {caseItem.nextAction.detail}
      </p>

      <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-slate-950/55">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-slate-500">
              Latest packet
            </p>
            {caseItem.latestReport ? (
              <>
                <p className="mt-1 truncate text-sm font-semibold text-zinc-950 dark:text-white">
                  {caseItem.latestReport.title}
                </p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-slate-500">
                  {caseItem.latestReport.template.replace(/_/g, " ")} ·{" "}
                  {caseItem.latestReport.format.toUpperCase()}
                </p>
              </>
            ) : (
              <p className="mt-1 text-sm text-zinc-600 dark:text-slate-400">
                No saved packet yet. This case is still only evidence and
                findings, not buyer proof.
              </p>
            )}
          </div>
          <Badge
            variant="outline"
            className={cn(
              "shrink-0 rounded-md",
              caseItem.latestReport
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                : "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200"
            )}
          >
            {caseItem.latestReport ? "exported" : "missing"}
          </Badge>
        </div>
      </div>

      <div className="mt-auto flex flex-col gap-2 pt-4 sm:flex-row">
        <Link href={caseItem.nextAction.route}>
          <Button
            onClick={() => writeStoredCaseKey(caseKey(caseItem))}
            className="w-full gap-2 bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-amber-300 dark:text-zinc-950 dark:hover:bg-amber-200 sm:w-auto"
          >
            {caseItem.nextAction.label}
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
        <Link href="/violations">
          <Button
            variant="outline"
            onClick={() => writeStoredCaseKey(caseKey(caseItem))}
            className="w-full border-zinc-300 bg-white/80 text-zinc-800 hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100 sm:w-auto"
          >
            View violations
          </Button>
        </Link>
      </div>
    </article>
  );
}

function blockerCount(caseItem: WorkspaceCaseSummary) {
  return (
    caseItem.stats.failedDocuments +
    caseItem.stats.pendingDocuments +
    caseItem.stats.blockedFindings
  );
}

function CaseComparisonMatrix({ cases }: { cases: WorkspaceCaseSummary[] }) {
  if (cases.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center text-sm text-zinc-600 dark:border-white/15 dark:bg-slate-950/55 dark:text-slate-400">
        No cases to compare yet. Create matters, assign evidence, then this
        becomes the scoreboard.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[56rem] border-separate border-spacing-0 text-left text-sm">
        <thead>
          <tr className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-slate-500">
            <th className="border-b border-zinc-200 px-3 py-3 dark:border-white/10">
              Matter
            </th>
            <th className="border-b border-zinc-200 px-3 py-3 dark:border-white/10">
              Score
            </th>
            <th className="border-b border-zinc-200 px-3 py-3 dark:border-white/10">
              Ready text
            </th>
            <th className="border-b border-zinc-200 px-3 py-3 dark:border-white/10">
              Findings
            </th>
            <th className="border-b border-zinc-200 px-3 py-3 dark:border-white/10">
              Reports
            </th>
            <th className="border-b border-zinc-200 px-3 py-3 dark:border-white/10">
              Blockers
            </th>
            <th className="border-b border-zinc-200 px-3 py-3 dark:border-white/10">
              Next move
            </th>
          </tr>
        </thead>
        <tbody>
          {cases.map(caseItem => {
            const blockers = blockerCount(caseItem);
            const score = caseItem.stats.comparisonScore;
            const isStrong = score >= 67 && blockers === 0;
            const isBlocked =
              blockers > 0 || caseItem.healthStatus === "blocked";

            return (
              <tr
                key={`${caseItem.id ?? "virtual"}-${caseItem.title}`}
                className="align-top"
              >
                <td className="border-b border-zinc-200 px-3 py-4 dark:border-white/10">
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      className={cn(
                        "mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full",
                        isStrong
                          ? "bg-emerald-500"
                          : isBlocked
                            ? "bg-red-500"
                            : "bg-amber-500"
                      )}
                    />
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-zinc-950 dark:text-white">
                        {caseItem.title}
                      </p>
                      <p className="mt-1 truncate text-xs text-zinc-500 dark:text-slate-500">
                        {caseItem.caseNumber ||
                          caseItem.jurisdiction ||
                          "No case metadata"}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="border-b border-zinc-200 px-3 py-4 dark:border-white/10">
                  <div className="w-28">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-zinc-950 dark:text-white">
                        {score}%
                      </span>
                      <span className="text-xs text-zinc-500 dark:text-slate-500">
                        proof
                      </span>
                    </div>
                    <Progress value={score} className="mt-2 h-2" />
                  </div>
                </td>
                <td className="border-b border-zinc-200 px-3 py-4 dark:border-white/10">
                  <p className="font-semibold text-zinc-950 dark:text-white">
                    {caseItem.stats.completedDocuments}/
                    {caseItem.stats.documents}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-slate-500">
                    {caseItem.stats.readiness}% OCR ready
                  </p>
                </td>
                <td className="border-b border-zinc-200 px-3 py-4 dark:border-white/10">
                  <p className="font-semibold text-zinc-950 dark:text-white">
                    {caseItem.stats.reportReadyFindings}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-slate-500">
                    {caseItem.stats.highLeverageFindings} high leverage
                  </p>
                </td>
                <td className="border-b border-zinc-200 px-3 py-4 dark:border-white/10">
                  <p className="font-semibold text-zinc-950 dark:text-white">
                    {caseItem.stats.savedReports}
                  </p>
                  <p className="mt-1 max-w-36 truncate text-xs text-zinc-500 dark:text-slate-500">
                    {caseItem.latestReport?.title ?? "No packet yet"}
                  </p>
                </td>
                <td className="border-b border-zinc-200 px-3 py-4 dark:border-white/10">
                  <Badge
                    variant="outline"
                    className={cn(
                      "rounded-md",
                      blockers > 0
                        ? "border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-200"
                        : "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                    )}
                  >
                    {blockers > 0 ? `${blockers} loud` : "clear"}
                  </Badge>
                </td>
                <td className="border-b border-zinc-200 px-3 py-4 dark:border-white/10">
                  <Link href={caseItem.nextAction.route}>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => writeStoredCaseKey(caseKey(caseItem))}
                      className="w-full justify-between gap-2 border-zinc-300 bg-white/80 text-zinc-800 hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100"
                    >
                      {caseItem.nextAction.label}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                  <Link href="/violations">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => writeStoredCaseKey(caseKey(caseItem))}
                      className="mt-2 w-full justify-between gap-2 text-zinc-700 hover:bg-zinc-100 dark:text-slate-300 dark:hover:bg-white/5"
                    >
                      Scoped violations
                      <ShieldCheck className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CaseCreateForm({
  title,
  caseNumber,
  jurisdiction,
  suggestedProfile,
  isCreating,
  onTitleChange,
  onCaseNumberChange,
  onJurisdictionChange,
  onApplySuggestion,
  onCreate,
}: {
  title: string;
  caseNumber: string;
  jurisdiction: string;
  suggestedProfile: SuggestedCaseProfile | null;
  isCreating: boolean;
  onTitleChange: (value: string) => void;
  onCaseNumberChange: (value: string) => void;
  onJurisdictionChange: (value: string) => void;
  onApplySuggestion: (profile: SuggestedCaseProfile) => void;
  onCreate: () => void;
}) {
  return (
    <section>
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-200">
          <Plus className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">
            New case
          </h2>
          <p className="mt-1 text-xs leading-5 text-zinc-600 dark:text-slate-400">
            Create a matter shell, then assign evidence below.
          </p>
        </div>
      </div>
      {suggestedProfile ? (
        <div className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/10 p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">
                Suggested from workspace
              </p>
              <p className="mt-1 text-sm font-semibold text-zinc-950 dark:text-white">
                {suggestedProfile.title}
              </p>
              <p className="mt-1 text-xs leading-5 text-zinc-600 dark:text-slate-400">
                {suggestedProfile.caseNumber || "No case number detected"} ·{" "}
                {suggestedProfile.jurisdiction || "No jurisdiction detected"} ·{" "}
                {suggestedProfile.confidence} confidence
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onApplySuggestion(suggestedProfile)}
              className="border-amber-500/30 bg-white/70 text-amber-800 hover:bg-white dark:bg-black/20 dark:text-amber-100"
            >
              Apply
            </Button>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {suggestedProfile.basis.slice(0, 4).map(item => (
              <div
                key={item}
                className="rounded-md border border-amber-500/20 bg-white/60 px-3 py-2 text-xs leading-5 text-zinc-700 dark:bg-black/20 dark:text-slate-300"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <div className="mt-4 grid gap-2">
        <input
          value={title}
          onChange={event => onTitleChange(event.target.value)}
          placeholder="Case name"
          className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-amber-500 dark:border-white/10 dark:bg-black/20 dark:text-slate-100"
        />
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
    </section>
  );
}

function EvidenceAssignment({
  cases,
  documents,
  selectedCaseId,
  selectedDocumentIds,
  isSaving,
  onCaseChange,
  onToggleDocument,
  onSave,
}: {
  cases: WorkspaceCaseSummary[];
  documents: DocumentRecord[];
  selectedCaseId: string;
  selectedDocumentIds: number[];
  isSaving: boolean;
  onCaseChange: (caseId: string) => void;
  onToggleDocument: (documentId: number) => void;
  onSave: () => void;
}) {
  const selectedSet = new Set(selectedDocumentIds);
  const hasDurableCases = cases.length > 0;

  return (
    <section className="rounded-md border border-zinc-200 bg-white/80 p-4 shadow-sm dark:border-white/10 dark:bg-[#111821]/86">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200">
          <FolderSearch className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">
            Evidence assignment
          </h2>
          <p className="mt-1 text-xs leading-5 text-zinc-600 dark:text-slate-400">
            This controls case-level comparison and report scoping.
          </p>
        </div>
      </div>

      {!hasDurableCases ? (
        <div className="mt-4 rounded-md border border-amber-500/25 bg-amber-500/10 p-3 text-sm leading-6 text-amber-800 dark:text-amber-100">
          Create a case first. File assignment stays hidden until there is a
          real case lane to assign into.
        </div>
      ) : (
        <select
          value={selectedCaseId}
          onChange={event => onCaseChange(event.target.value)}
          className="mt-4 h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-amber-500 dark:border-white/10 dark:bg-black/20 dark:text-slate-100"
        >
          <option value="">Choose a durable case</option>
          {cases.map(caseItem => (
            <option
              key={caseItem.id ?? caseItem.title}
              value={caseItem.id ?? ""}
            >
              {caseItem.title}
            </option>
          ))}
        </select>
      )}

      {hasDurableCases ? (
        <div className="mt-4 max-h-[28rem] space-y-2 overflow-y-auto pr-1">
          {documents.length === 0 ? (
            <div className="rounded-md border border-dashed border-zinc-300 p-4 text-sm text-zinc-600 dark:border-white/15 dark:text-slate-400">
              No documents yet. Upload evidence in Corpus first.
            </div>
          ) : (
            documents.map(document => (
              <label
                key={document.id}
                className="flex cursor-pointer items-start gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm transition hover:border-zinc-400 dark:border-white/10 dark:bg-slate-950/55 dark:hover:border-white/25"
              >
                <input
                  type="checkbox"
                  checked={selectedSet.has(document.id)}
                  onChange={() => onToggleDocument(document.id)}
                  disabled={!selectedCaseId}
                  className="mt-1 h-4 w-4 rounded border-zinc-300"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-zinc-900 dark:text-slate-100">
                    {document.fileName}
                  </span>
                  <span className="mt-1 block text-xs text-zinc-500 dark:text-slate-500">
                    {document.status}
                  </span>
                </span>
              </label>
            ))
          )}
        </div>
      ) : null}

      {hasDurableCases ? (
        <Button
          onClick={onSave}
          disabled={!selectedCaseId || isSaving}
          className="mt-4 w-full gap-2 bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-emerald-300 dark:text-zinc-950 dark:hover:bg-emerald-200"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FolderSearch className="h-4 w-4" />
          )}
          Save assignment
        </Button>
      ) : null}
    </section>
  );
}

export default function Cases() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const trpcUtils = trpc.useUtils();
  const [workbenchMode, setWorkbenchMode] = useState<CasesWorkbenchMode>(() =>
    typeof window !== "undefined" && window.location.hash === "#new-case"
      ? "create"
      : "compare"
  );
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
      toast.success("Evidence assignment saved");
    },
    onError: error => toast.error(error.message),
  });

  const typedDocuments = documents as DocumentRecord[];
  const workspaceCases = (casesQuery.data?.cases ??
    []) as WorkspaceCaseSummary[];
  const durableCases = workspaceCases.filter(
    caseItem => !caseItem.virtual && caseItem.id !== null
  );
  const sortedCases = useMemo(
    () =>
      [...workspaceCases].sort(
        (left, right) =>
          right.stats.comparisonScore - left.stats.comparisonScore
      ),
    [workspaceCases]
  );
  const bestCase = sortedCases[0];
  const migrationRequired = Boolean(casesQuery.data?.migrationRequired);
  const totalDocuments = sortedCases.reduce(
    (total, caseItem) => total + caseItem.stats.documents,
    0
  );
  const totalFindings = sortedCases.reduce(
    (total, caseItem) => total + caseItem.stats.reportReadyFindings,
    0
  );
  const blockedCases = sortedCases.filter(
    caseItem =>
      caseItem.stats.failedDocuments > 0 || caseItem.stats.blockedFindings > 0
  ).length;
  const activeMatter = durableCases[0] ?? bestCase ?? null;
  const suggestedCaseProfile = useMemo(
    () => inferCaseProfileFromDocuments(typedDocuments),
    [typedDocuments]
  );
  const caseModeOptions: Array<{
    id: CasesWorkbenchMode;
    title: string;
    detail: string;
    meta: string;
    icon: LucideIcon;
  }> = [
    {
      id: "compare",
      title: "Compare matters",
      detail: "See which case is ready, blocked, or worth pushing first.",
      meta: `${formatNumber(durableCases.length)} case lanes`,
      icon: Briefcase,
    },
    {
      id: "assign",
      title: "Assign evidence",
      detail: "Attach uploaded files to the right matter before analysis.",
      meta: `${formatNumber(typedDocuments.length)} files available`,
      icon: FolderSearch,
    },
    {
      id: "create",
      title: "Create case",
      detail: "Start a clean lane so evidence stops becoming soup.",
      meta: migrationRequired ? "migration warning" : "ready",
      icon: Plus,
    },
  ];

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
        "Assign evidence, run source-bound analysis, compare findings, and generate exportable work product.",
    });
  };

  const handleApplySuggestedProfile = (profile: SuggestedCaseProfile) => {
    setNewCaseTitle(profile.title);
    setNewCaseNumber(profile.caseNumber);
    setNewCaseJurisdiction(profile.jurisdiction);
    toast.success("Suggested case profile applied for review");
  };

  const handleAssignmentCaseChange = (caseId: string) => {
    setAssignmentCaseId(caseId);
    const selectedCase = durableCases.find(
      caseItem => String(caseItem.id) === caseId
    );
    setAssignmentDocumentIds(selectedCase?.documentIds ?? []);
  };

  const handleDocumentToggle = (documentId: number) => {
    setAssignmentDocumentIds(current =>
      current.includes(documentId)
        ? current.filter(id => id !== documentId)
        : [...current, documentId]
    );
  };

  const handleSaveAssignment = () => {
    const caseId = Number(assignmentCaseId);
    if (!Number.isInteger(caseId)) {
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
      <div className="flex min-h-screen items-center justify-center bg-[#070a0d]">
        <Loader2 className="h-8 w-8 animate-spin text-amber-300" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#070a0d] px-6">
        <div className="max-w-md space-y-4 text-center">
          <h1 className="text-2xl font-semibold text-white">
            Sign in required
          </h1>
          <p className="text-sm leading-6 text-slate-400">
            Cases belong to an authenticated workspace.
          </p>
          <a href={getLoginUrl()}>
            <Button className="bg-amber-300 text-zinc-950 hover:bg-amber-200">
              Sign in
            </Button>
          </a>
        </div>
      </div>
    );
  }

  return (
    <CommandSurface>
      <CommandTopBar
        title="Cases"
        eyebrow="Workspace command"
        actions={
          <>
            <Link href="/dashboard">
              <Button
                variant="outline"
                size="sm"
                className="gap-2 border-zinc-300 bg-white/80 dark:border-white/10 dark:bg-white/5"
              >
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Button>
            </Link>
            <Link href="/sector/corpus">
              <Button
                size="sm"
                className="gap-2 bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-amber-300 dark:text-zinc-950 dark:hover:bg-amber-200"
              >
                <Database className="h-4 w-4" />
                Corpus
              </Button>
            </Link>
          </>
        }
      />
      <CommandMain>
        <section className="mb-3 rounded-md border border-zinc-200 bg-white/86 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-[#10161d]/86">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
                  Case manager
                </p>
                {bestCase ? (
                  <CommandBadge tone="success">
                    Best current matter: {bestCase.title}
                  </CommandBadge>
                ) : (
                  <CommandBadge tone="warning">No scored case yet</CommandBadge>
                )}
              </div>
              <h1 className="mt-2 text-xl font-semibold text-zinc-950 dark:text-white">
                One workspace. Multiple cases. No evidence soup.
              </h1>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-zinc-600 dark:text-slate-400">
                Pick the active matter, assign files, then compare which case is
                ready for analysis, reports, and court-facing work.
              </p>
            </div>
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-slate-950/55">
              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-slate-500">
                Next case action
              </p>
              <p className="mt-1 truncate text-sm font-semibold text-zinc-950 dark:text-white">
                {activeMatter?.nextAction.label ?? "Create a case"}
              </p>
              <p className="mt-1 max-h-10 overflow-hidden text-xs leading-5 text-zinc-600 dark:text-slate-400">
                {activeMatter?.nextAction.detail ??
                  "Create a case lane before comparing work product."}
              </p>
              <div className="mt-3 flex gap-2">
                <Link href={activeMatter?.nextAction.route ?? "#new-case"}>
                  <Button
                    size="sm"
                    onClick={() => {
                      if (activeMatter) {
                        writeStoredCaseKey(caseKey(activeMatter));
                      } else {
                        setWorkbenchMode("create");
                      }
                    }}
                    className="gap-2 bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-amber-300 dark:text-zinc-950 dark:hover:bg-amber-200"
                  >
                    Open
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
                <Link href="/violations">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (activeMatter)
                        writeStoredCaseKey(caseKey(activeMatter));
                    }}
                    className="border-zinc-300 bg-white/80 text-zinc-800 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100"
                  >
                    Violations
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        <WorkspaceCaseStrip className="mb-3" />
        <CommandWorkflowBar className="mb-3" />

        <section className="mb-3 grid gap-2 md:grid-cols-3">
          {caseModeOptions.map(option => {
            const Icon = option.icon;
            const active = workbenchMode === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setWorkbenchMode(option.id)}
                className={cn(
                  "rounded-md border p-3 text-left shadow-sm transition",
                  active
                    ? "border-amber-500/55 bg-amber-500/10 text-zinc-950 dark:bg-amber-300/10 dark:text-white"
                    : "border-zinc-200 bg-white/70 text-zinc-700 hover:border-zinc-400 dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-300 dark:hover:border-white/25"
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-current/20 bg-white/50 dark:bg-black/20">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-slate-500">
                    {option.meta}
                  </span>
                </div>
                <p className="mt-3 text-sm font-semibold">{option.title}</p>
                <p className="mt-1 text-xs leading-5 text-zinc-600 dark:text-slate-400">
                  {option.detail}
                </p>
              </button>
            );
          })}
        </section>

        <details className="mb-3 rounded-md border border-zinc-200 bg-white/70 shadow-sm dark:border-white/10 dark:bg-white/[0.035]">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-zinc-800 dark:text-slate-200">
            Workspace numbers
          </summary>
          <section className="grid gap-3 border-t border-zinc-200 p-3 dark:border-white/10 sm:grid-cols-2 xl:grid-cols-4">
            <CaseHeroStat
              label="Durable cases"
              value={formatNumber(durableCases.length)}
              detail={
                migrationRequired ? "migration warning active" : "saved matters"
              }
            />
            <CaseHeroStat
              label="Evidence in lanes"
              value={formatNumber(totalDocuments)}
              detail={`${formatNumber(typedDocuments.length)} workspace files total`}
            />
            <CaseHeroStat
              label="Report-ready findings"
              value={formatNumber(totalFindings)}
              detail="case-scoped leverage signals"
            />
            <CaseHeroStat
              label="Cases with loud problems"
              value={formatNumber(blockedCases)}
              detail="OCR, pending, or QC issues"
            />
          </section>
        </details>

        {migrationRequired ? (
          <CommandNotice
            title="Workspace case tables are not fully migrated"
            tone="warning"
            icon={AlertTriangle}
            className="mb-4"
          >
            The app can still show a whole-workspace virtual case, but durable
            multi-case comparison needs the workspace-case migration applied.
          </CommandNotice>
        ) : null}

        {workbenchMode === "compare" ? (
          <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="min-w-0 space-y-4">
              <CommandCard>
                <CommandCardHeader
                  title="Case comparison"
                  description="The fastest read on which matter is usable, blocked, or ready to turn into work product."
                  icon={Briefcase}
                  action={
                    bestCase ? (
                      <CommandBadge tone="success">
                        {bestCase.title}
                      </CommandBadge>
                    ) : null
                  }
                />
                <CommandCardBody>
                  {casesQuery.isLoading || documentsLoading ? (
                    <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-white/10 dark:bg-slate-950/55 dark:text-slate-400">
                      <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                      Loading cases
                    </div>
                  ) : sortedCases.length === 0 ? (
                    <div className="mt-4 rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center text-sm text-zinc-600 dark:border-white/15 dark:bg-slate-950/55 dark:text-slate-400">
                      No case lanes yet. Create one and attach files.
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      <CaseComparisonMatrix cases={sortedCases} />
                      <details className="rounded-md border border-zinc-200 bg-zinc-50 dark:border-white/10 dark:bg-slate-950/55">
                        <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-zinc-800 dark:text-slate-200">
                          Matter detail cards
                        </summary>
                        <div className="grid gap-3 border-t border-zinc-200 p-3 dark:border-white/10 lg:grid-cols-2">
                          {sortedCases.map((caseItem, index) => (
                            <CaseScorecard
                              key={`${caseItem.id ?? "virtual"}-${caseItem.title}`}
                              caseItem={caseItem}
                              rank={index + 1}
                            />
                          ))}
                        </div>
                      </details>
                    </div>
                  )}
                </CommandCardBody>
              </CommandCard>

              <details className="rounded-md border border-zinc-200 bg-white/70 shadow-sm dark:border-white/10 dark:bg-white/[0.035]">
                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-zinc-800 dark:text-slate-200">
                  How the comparison score works
                </summary>
                <div className="border-t border-zinc-200 p-3 dark:border-white/10">
                  <div className="grid gap-3 md:grid-cols-3">
                    {[
                      {
                        icon: SearchCheck,
                        title: "Trust the text",
                        detail:
                          "Completed OCR and source hashes before agent work.",
                      },
                      {
                        icon: ShieldCheck,
                        title: "Trust the findings",
                        detail:
                          "Report-ready findings beat unsupported volume.",
                      },
                      {
                        icon: ReceiptText,
                        title: "Trust the output",
                        detail:
                          "Saved packets prove the work can be used outside the app.",
                      },
                    ].map(item => {
                      const Icon = item.icon;
                      return (
                        <div
                          key={item.title}
                          className="rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-slate-950/55"
                        >
                          <Icon className="h-5 w-5 text-amber-700 dark:text-amber-300" />
                          <p className="mt-3 text-sm font-semibold text-zinc-950 dark:text-white">
                            {item.title}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-zinc-600 dark:text-slate-400">
                            {item.detail}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </details>
            </div>

            <aside className="rounded-md border border-zinc-200 bg-white/80 p-4 shadow-sm dark:border-white/10 dark:bg-[#111821]/86">
              <div className="flex items-center gap-3 text-sm font-semibold text-zinc-950 dark:text-white">
                <BarChart3 className="h-4 w-4 text-amber-700 dark:text-amber-300" />
                Quality ladder
              </div>
              <div className="mt-4 space-y-2">
                {[
                  ["0-33", "Evidence pile. Not trustworthy yet."],
                  ["34-66", "Usable, but still needs cleanup or analysis."],
                  ["67-100", "Ready for serious report/export review."],
                ].map(([score, detail]) => (
                  <div
                    key={score}
                    className="rounded-md border border-zinc-200 bg-zinc-50 p-2 text-xs leading-5 dark:border-white/10 dark:bg-slate-950/55"
                  >
                    <span className="font-semibold text-amber-700 dark:text-amber-300">
                      {score}:
                    </span>{" "}
                    {detail}
                  </div>
                ))}
              </div>
            </aside>
          </div>
        ) : null}

        {workbenchMode === "assign" ? (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <EvidenceAssignment
              cases={durableCases}
              documents={typedDocuments}
              selectedCaseId={assignmentCaseId}
              selectedDocumentIds={assignmentDocumentIds}
              isSaving={setCaseDocumentsMutation.isPending}
              onCaseChange={handleAssignmentCaseChange}
              onToggleDocument={handleDocumentToggle}
              onSave={handleSaveAssignment}
            />
            <CommandCard>
              <CommandCardHeader
                title="Assignment rule"
                description="Analysis and reports should use case-scoped documents unless you explicitly choose the whole workspace baseline."
                icon={ShieldCheck}
              />
              <CommandCardBody>
                <div className="mt-4 space-y-2 text-sm leading-6 text-zinc-600 dark:text-slate-400">
                  <p>
                    One file can belong to multiple cases when it truly crosses
                    matters.
                  </p>
                  <p>
                    Whole-workspace review is for comparison. Court packets
                    should come from a named case lane.
                  </p>
                </div>
              </CommandCardBody>
            </CommandCard>
          </div>
        ) : null}

        {workbenchMode === "create" ? (
          <div
            id="new-case"
            className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]"
          >
            <CommandCard>
              <CommandCardHeader
                title="Create case"
                description="Create a durable lane before comparing, assigning evidence, or generating case-specific work product."
                icon={Plus}
              />
              <CommandCardBody>
                <div className="mt-4">
                  <CaseCreateForm
                    title={newCaseTitle}
                    caseNumber={newCaseNumber}
                    jurisdiction={newCaseJurisdiction}
                    suggestedProfile={suggestedCaseProfile}
                    isCreating={createCaseMutation.isPending}
                    onTitleChange={setNewCaseTitle}
                    onCaseNumberChange={setNewCaseNumber}
                    onJurisdictionChange={setNewCaseJurisdiction}
                    onApplySuggestion={handleApplySuggestedProfile}
                    onCreate={handleCreateCase}
                  />
                </div>
              </CommandCardBody>
            </CommandCard>
            <CommandCard>
              <CommandCardHeader
                title="What this unlocks"
                description="The app can compare cases only after each matter has its own evidence lane."
                icon={FolderOpen}
              />
              <CommandCardBody>
                <div className="mt-4 grid gap-2">
                  {[
                    "Separate uploads by case instead of dumping everything into one workspace.",
                    "Compare readiness, blocked OCR, report-ready findings, and saved packets matter by matter.",
                    "Keep Legal Analysis, Violations, Reports, and Dashboard pointed at the active case.",
                  ].map(item => (
                    <div
                      key={item}
                      className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm leading-6 text-zinc-700 dark:border-white/10 dark:bg-slate-950/55 dark:text-slate-300"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </CommandCardBody>
            </CommandCard>
          </div>
        ) : null}
      </CommandMain>
    </CommandSurface>
  );
}
