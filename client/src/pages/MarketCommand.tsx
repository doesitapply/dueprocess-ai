import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  CommandMain,
  CommandSurface,
  CommandTopBar,
} from "@/components/command-ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { getLoginUrl } from "@/const";
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
  ExternalLink,
  FileArchive,
  FileCheck,
  FileSearch,
  FileText,
  Gauge,
  Landmark,
  Layers3,
  Loader2,
  ReceiptText,
  Rocket,
  Scale,
  SearchCheck,
  ShieldCheck,
  Smartphone,
  Target,
  Terminal,
  Upload,
  Users,
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
    snapshot?: {
      period?: {
        start?: string;
        end?: string;
        source?: string;
      };
      current?: {
        documentUploads?: number;
        pagesUploaded?: number;
        pagesAnalyzed?: number;
        agentRuns?: number;
        agentCalls?: number;
        reportsGenerated?: number;
        exactLlmCalls?: number;
        exactTokens?: number;
        exactCostUsd?: number;
      };
      firmUsage?: {
        estimatedOverageUsd?: number;
      } | null;
      alerts?: string[];
    };
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

type SettingsOverview = {
  commercial?: {
    effectivePlan?: {
      name?: string;
      billingModel?: string;
      adminOverride?: boolean;
    };
    revenueReadiness?: {
      readyChecks?: number;
      totalChecks?: number;
      checkoutReadyPlans?: number;
      subscriptionPlans?: number;
      computePacksConfigured?: number;
      computePacksTotal?: number;
      blockers?: string[];
    };
  };
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

type CustomerSegment = {
  name: string;
  buyer: string;
  pain: string;
  dueProcessWedge: string;
  firstOffer: string;
  proofNeeded: string;
  route: string;
  icon: LucideIcon;
};

type DemandSignal = {
  label: string;
  signal: string;
  implication: string;
  source: string;
  href: string;
};

type ResearchRefreshSignal = {
  label: string;
  source: string;
  href: string;
  verifiedSignal: string;
  marketNeed: string;
  productCommand: string;
  customerBase: string;
  firstProof: string;
  icon: LucideIcon;
};

type MarketEvidenceSignal = {
  label: string;
  buyerLane: string;
  source: string;
  href: string;
  signal: string;
  productDemand: string;
  proofToShow: string;
  status: "live" | "partial" | "missing";
  icon: LucideIcon;
};

type MonetizationLane = {
  lane: string;
  customer: string;
  offer: string;
  priceMotion: string;
  unlock: string;
  risk: string;
  route: string;
};

type BuyerReadiness = {
  segment: string;
  priority: string;
  status: "live" | "partial" | "missing";
  proof: string;
  missing: string;
  route: string;
  icon: LucideIcon;
};

type PilotOffer = {
  name: string;
  target: string;
  status: "live" | "partial" | "missing";
  package: string;
  priceTest: string;
  proofArtifact: string;
  sellWhen: string;
  blocker: string;
  route: string;
  icon: LucideIcon;
};

type ProofPack = {
  name: string;
  buyerLane: string;
  status: "live" | "partial" | "missing";
  paidJob: string;
  includes: string[];
  passGate: string;
  priceMotion: string;
  route: string;
  icon: LucideIcon;
};

type AcquisitionTarget = {
  rank: number;
  segment: string;
  buyer: string;
  status: "live" | "partial" | "missing";
  urgency: string;
  whereToFind: string;
  firstAsk: string;
  proofArtifact: string;
  priceTest: string;
  blocker: string;
  route: string;
  icon: LucideIcon;
};

type ProofRunStep = {
  order: number;
  title: string;
  status: "live" | "partial" | "missing";
  metric: string;
  proofArtifact: string;
  blocker: string;
  action: string;
  route: string;
  icon: LucideIcon;
};

type OutreachPool = {
  segment: string;
  channel: string;
  sourceSignal: string;
  whyItMatters: string;
  firstOutreach: string;
  firstProof: string;
  proofGate: string;
  status: "live" | "partial" | "missing";
  href: string;
  icon: LucideIcon;
};

type BuyerProofBrief = {
  lane: string;
  buyer: string;
  whyNow: string;
  proofToShow: string;
  firstAsk: string;
  priceMotion: string;
  blocker: string;
  status: "live" | "partial" | "missing";
  route: string;
  icon: LucideIcon;
};

type RevenuePipelineLane = {
  lane: string;
  buyer: string;
  status: "live" | "partial" | "missing";
  proofSignal: string;
  sellableArtifact: string;
  firstCloseMotion: string;
  revenuePath: string;
  blockingGap: string;
  nextProductAction: string;
  route: string;
  icon: LucideIcon;
};

type BuyerCloseSignal = {
  lane: string;
  buyer: string;
  marketNeed: string;
  source: string;
  href: string;
  productAnswer: string;
  proofArtifact: string;
  evidenceInWorkspace: string;
  closeScore: number;
  closeReadiness: "live" | "partial" | "missing";
  firstCloseAction: string;
  route: string;
  icon: LucideIcon;
};

type ClosePlaybook = {
  lane: string;
  beneficiary: string;
  status: "live" | "partial" | "missing";
  openingLine: string;
  qualifyWith: string[];
  showFirst: string;
  sustainabilityPath: string;
  successMetric: string;
  doNotLaunchUntil: string;
  route: string;
  icon: LucideIcon;
};

type FirstCustomerConversation = {
  rank: number;
  channel: string;
  buyer: string;
  count: number;
  status: "live" | "partial" | "missing";
  source: string;
  href: string;
  openingAsk: string;
  showArtifact: string;
  conversionTrigger: string;
  blocker: string;
  route: string;
  icon: LucideIcon;
};

type MarketCommandMode = "proof" | "customers" | "research" | "deep";

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

function closeReadinessFromScore(score: number): MarketGate["status"] {
  if (score >= 80) return "live";
  if (score >= 45) return "partial";
  return "missing";
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

function CustomerCard({ segment }: { segment: CustomerSegment }) {
  const Icon = segment.icon;
  return (
    <Link href={segment.route}>
      <div className="group h-full rounded-md border border-zinc-200 bg-zinc-50 p-4 transition-colors hover:border-zinc-400 hover:bg-white dark:border-white/10 dark:bg-slate-950/55 dark:hover:border-white/25 dark:hover:bg-white/[0.07]">
        <div className="flex items-start justify-between gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200">
            <Icon className="h-5 w-5" />
          </span>
          <ArrowRight className="h-4 w-4 text-zinc-400 opacity-0 transition-opacity group-hover:opacity-100 dark:text-slate-500" />
        </div>
        <p className="mt-4 text-sm font-semibold text-zinc-950 dark:text-white">
          {segment.name}
        </p>
        <p className="mt-1 text-xs font-medium text-zinc-500 dark:text-slate-500">
          Buyer: {segment.buyer}
        </p>
        <dl className="mt-4 space-y-3 text-xs leading-5">
          <div>
            <dt className="font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-slate-500">
              Pain
            </dt>
            <dd className="mt-1 text-zinc-700 dark:text-slate-300">
              {segment.pain}
            </dd>
          </div>
          <div>
            <dt className="font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-slate-500">
              Wedge
            </dt>
            <dd className="mt-1 text-zinc-700 dark:text-slate-300">
              {segment.dueProcessWedge}
            </dd>
          </div>
          <div>
            <dt className="font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-slate-500">
              First sale
            </dt>
            <dd className="mt-1 text-zinc-700 dark:text-slate-300">
              {segment.firstOffer}
            </dd>
          </div>
          <div>
            <dt className="font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-slate-500">
              Proof needed
            </dt>
            <dd className="mt-1 text-zinc-700 dark:text-slate-300">
              {segment.proofNeeded}
            </dd>
          </div>
        </dl>
      </div>
    </Link>
  );
}

function BuyerReadinessCard({ item }: { item: BuyerReadiness }) {
  const Icon = item.icon;
  return (
    <Link href={item.route}>
      <div className="group h-full rounded-md border border-zinc-200 bg-zinc-50 p-4 transition-colors hover:border-zinc-400 hover:bg-white dark:border-white/10 dark:bg-slate-950/55 dark:hover:border-white/25 dark:hover:bg-white/[0.07]">
        <div className="flex items-start justify-between gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-800 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-200">
            <Icon className="h-5 w-5" />
          </span>
          <StatusBadge status={item.status} />
        </div>
        <p className="mt-4 text-sm font-semibold text-zinc-950 dark:text-white">
          {item.segment}
        </p>
        <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-300">
          {item.priority}
        </p>
        <div className="mt-4 space-y-3 text-xs leading-5">
          <div>
            <p className="font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-slate-500">
              Proof in this build
            </p>
            <p className="mt-1 text-zinc-700 dark:text-slate-300">
              {item.proof}
            </p>
          </div>
          <div>
            <p className="font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-slate-500">
              Still missing
            </p>
            <p className="mt-1 text-zinc-700 dark:text-slate-300">
              {item.missing}
            </p>
          </div>
        </div>
        <div className="mt-4 flex items-center text-xs font-semibold text-amber-700 opacity-0 transition-opacity group-hover:opacity-100 dark:text-amber-300">
          Open proof surface
          <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </div>
      </div>
    </Link>
  );
}

function PilotOfferCard({ offer }: { offer: PilotOffer }) {
  const Icon = offer.icon;
  return (
    <Link href={offer.route}>
      <div className="group h-full rounded-md border border-zinc-200 bg-zinc-50 p-4 transition-colors hover:border-zinc-400 hover:bg-white dark:border-white/10 dark:bg-slate-950/55 dark:hover:border-white/25 dark:hover:bg-white/[0.07]">
        <div className="flex items-start justify-between gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200">
            <Icon className="h-5 w-5" />
          </span>
          <StatusBadge status={offer.status} />
        </div>
        <p className="mt-4 text-sm font-semibold text-zinc-950 dark:text-white">
          {offer.name}
        </p>
        <p className="mt-1 text-xs font-medium text-zinc-500 dark:text-slate-500">
          Target: {offer.target}
        </p>
        <div className="mt-4 space-y-3 text-xs leading-5">
          <div>
            <p className="font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-slate-500">
              Package
            </p>
            <p className="mt-1 text-zinc-700 dark:text-slate-300">
              {offer.package}
            </p>
          </div>
          <div>
            <p className="font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-slate-500">
              Price test
            </p>
            <p className="mt-1 text-zinc-700 dark:text-slate-300">
              {offer.priceTest}
            </p>
          </div>
          <div>
            <p className="font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-slate-500">
              Proof artifact
            </p>
            <p className="mt-1 text-zinc-700 dark:text-slate-300">
              {offer.proofArtifact}
            </p>
          </div>
          <div className="rounded-md border border-amber-500/25 bg-amber-500/10 p-2 text-amber-800 dark:text-amber-100">
            <p className="font-semibold">Sell when</p>
            <p className="mt-1">{offer.sellWhen}</p>
          </div>
          <div className="rounded-md border border-red-500/20 bg-red-500/10 p-2 text-red-800 dark:text-red-100">
            <p className="font-semibold">Blocker</p>
            <p className="mt-1">{offer.blocker}</p>
          </div>
        </div>
        <div className="mt-4 flex items-center text-xs font-semibold text-emerald-700 opacity-0 transition-opacity group-hover:opacity-100 dark:text-emerald-300">
          Open work surface
          <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </div>
      </div>
    </Link>
  );
}

function ProofPackCard({ pack }: { pack: ProofPack }) {
  const Icon = pack.icon;
  return (
    <Link href={pack.route}>
      <div className="group h-full rounded-md border border-zinc-200 bg-zinc-50 p-4 transition-colors hover:border-zinc-400 hover:bg-white dark:border-white/10 dark:bg-slate-950/55 dark:hover:border-white/25 dark:hover:bg-white/[0.07]">
        <div className="flex items-start justify-between gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-200">
            <Icon className="h-5 w-5" />
          </span>
          <StatusBadge status={pack.status} />
        </div>
        <p className="mt-4 text-sm font-semibold text-zinc-950 dark:text-white">
          {pack.name}
        </p>
        <p className="mt-1 text-xs font-medium text-zinc-500 dark:text-slate-500">
          Buyer lane: {pack.buyerLane}
        </p>
        <div className="mt-4 space-y-3 text-xs leading-5">
          <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 p-2 text-emerald-800 dark:text-emerald-100">
            <p className="font-semibold">Paid job</p>
            <p className="mt-1">{pack.paidJob}</p>
          </div>
          <div>
            <p className="font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-slate-500">
              Includes
            </p>
            <ul className="mt-1 space-y-1 text-zinc-700 dark:text-slate-300">
              {pack.includes.map(item => (
                <li key={item} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-300" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-md border border-amber-500/25 bg-amber-500/10 p-2 text-amber-800 dark:text-amber-100">
            <p className="font-semibold">Pass gate</p>
            <p className="mt-1">{pack.passGate}</p>
          </div>
          <div>
            <p className="font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-slate-500">
              Price motion
            </p>
            <p className="mt-1 text-zinc-700 dark:text-slate-300">
              {pack.priceMotion}
            </p>
          </div>
        </div>
        <div className="mt-4 flex items-center text-xs font-semibold text-blue-700 opacity-0 transition-opacity group-hover:opacity-100 dark:text-blue-300">
          Open pack surface
          <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </div>
      </div>
    </Link>
  );
}

function AcquisitionTargetCard({ target }: { target: AcquisitionTarget }) {
  const Icon = target.icon;
  return (
    <Link href={target.route}>
      <div className="group h-full rounded-md border border-zinc-200 bg-zinc-50 p-4 transition-colors hover:border-zinc-400 hover:bg-white dark:border-white/10 dark:bg-slate-950/55 dark:hover:border-white/25 dark:hover:bg-white/[0.07]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-amber-500/35 bg-amber-500/10 text-xs font-semibold text-amber-800 dark:text-amber-100">
              #{target.rank}
            </span>
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-800 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-200">
              <Icon className="h-5 w-5" />
            </span>
          </div>
          <StatusBadge status={target.status} />
        </div>
        <p className="mt-4 text-sm font-semibold text-zinc-950 dark:text-white">
          {target.segment}
        </p>
        <p className="mt-1 text-xs font-medium text-zinc-500 dark:text-slate-500">
          Buyer: {target.buyer}
        </p>
        <div className="mt-4 grid gap-3 text-xs leading-5">
          <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 p-2 text-emerald-800 dark:text-emerald-100">
            <p className="font-semibold">Why now</p>
            <p className="mt-1">{target.urgency}</p>
          </div>
          <div>
            <p className="font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-slate-500">
              Where to find them
            </p>
            <p className="mt-1 text-zinc-700 dark:text-slate-300">
              {target.whereToFind}
            </p>
          </div>
          <div>
            <p className="font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-slate-500">
              First ask
            </p>
            <p className="mt-1 text-zinc-700 dark:text-slate-300">
              {target.firstAsk}
            </p>
          </div>
          <div>
            <p className="font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-slate-500">
              Show them
            </p>
            <p className="mt-1 text-zinc-700 dark:text-slate-300">
              {target.proofArtifact}
            </p>
          </div>
          <div className="rounded-md border border-amber-500/25 bg-amber-500/10 p-2 text-amber-800 dark:text-amber-100">
            <p className="font-semibold">Price test</p>
            <p className="mt-1">{target.priceTest}</p>
          </div>
          <div className="rounded-md border border-red-500/20 bg-red-500/10 p-2 text-red-800 dark:text-red-100">
            <p className="font-semibold">Close blocker</p>
            <p className="mt-1">{target.blocker}</p>
          </div>
        </div>
        <div className="mt-4 flex items-center text-xs font-semibold text-amber-700 opacity-0 transition-opacity group-hover:opacity-100 dark:text-amber-300">
          Open proof surface
          <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </div>
      </div>
    </Link>
  );
}

function OutreachPoolCard({ pool }: { pool: OutreachPool }) {
  const Icon = pool.icon;
  return (
    <a
      href={pool.href}
      target="_blank"
      rel="noreferrer"
      className="group block h-full rounded-md border border-zinc-200 bg-zinc-50 p-4 transition-colors hover:border-zinc-400 hover:bg-white dark:border-white/10 dark:bg-slate-950/55 dark:hover:border-white/25 dark:hover:bg-white/[0.07]"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-200">
          <Icon className="h-5 w-5" />
        </span>
        <div className="flex items-center gap-2">
          <StatusBadge status={pool.status} />
          <ExternalLink className="h-4 w-4 text-zinc-400 transition-colors group-hover:text-zinc-700 dark:text-slate-500 dark:group-hover:text-slate-200" />
        </div>
      </div>
      <p className="mt-4 text-sm font-semibold text-zinc-950 dark:text-white">
        {pool.segment}
      </p>
      <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-300">
        {pool.channel}
      </p>
      <div className="mt-4 space-y-3 text-xs leading-5">
        <div className="rounded-md border border-blue-500/20 bg-blue-500/10 p-2 text-blue-800 dark:text-blue-100">
          <p className="font-semibold">Source signal</p>
          <p className="mt-1">{pool.sourceSignal}</p>
        </div>
        <div>
          <p className="font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-slate-500">
            Why this pool
          </p>
          <p className="mt-1 text-zinc-700 dark:text-slate-300">
            {pool.whyItMatters}
          </p>
        </div>
        <div>
          <p className="font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-slate-500">
            First outreach angle
          </p>
          <p className="mt-1 text-zinc-700 dark:text-slate-300">
            {pool.firstOutreach}
          </p>
        </div>
        <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 p-2 text-emerald-800 dark:text-emerald-100">
          <p className="font-semibold">Show them first</p>
          <p className="mt-1">{pool.firstProof}</p>
        </div>
        <div className="rounded-md border border-amber-500/25 bg-amber-500/10 p-2 text-amber-800 dark:text-amber-100">
          <p className="font-semibold">Do not pitch until</p>
          <p className="mt-1">{pool.proofGate}</p>
        </div>
      </div>
    </a>
  );
}

function ResearchRefreshCard({ signal }: { signal: ResearchRefreshSignal }) {
  const Icon = signal.icon;
  return (
    <a
      href={signal.href}
      target="_blank"
      rel="noreferrer"
      className="group block h-full rounded-md border border-zinc-200 bg-zinc-50 p-4 transition-colors hover:border-zinc-400 hover:bg-white dark:border-white/10 dark:bg-slate-950/55 dark:hover:border-white/25 dark:hover:bg-white/[0.07]"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200">
          <Icon className="h-5 w-5" />
        </span>
        <ExternalLink className="h-4 w-4 text-zinc-400 transition-colors group-hover:text-zinc-700 dark:text-slate-500 dark:group-hover:text-slate-200" />
      </div>
      <p className="mt-4 text-sm font-semibold text-zinc-950 dark:text-white">
        {signal.label}
      </p>
      <p className="mt-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-amber-700 dark:text-amber-300">
        {signal.source}
      </p>
      <div className="mt-4 grid gap-3 text-xs leading-5">
        <div className="rounded-md border border-blue-500/20 bg-blue-500/10 p-2 text-blue-800 dark:text-blue-100">
          <p className="font-semibold">Verified signal</p>
          <p className="mt-1">{signal.verifiedSignal}</p>
        </div>
        <div>
          <p className="font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-slate-500">
            Market need
          </p>
          <p className="mt-1 text-zinc-700 dark:text-slate-300">
            {signal.marketNeed}
          </p>
        </div>
        <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 p-2 text-emerald-800 dark:text-emerald-100">
          <p className="font-semibold">Product command</p>
          <p className="mt-1">{signal.productCommand}</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-md border border-zinc-200 bg-white/65 p-2 text-zinc-700 dark:border-white/10 dark:bg-black/20 dark:text-slate-300">
            <p className="font-semibold">Customer base</p>
            <p className="mt-1">{signal.customerBase}</p>
          </div>
          <div className="rounded-md border border-amber-500/25 bg-amber-500/10 p-2 text-amber-800 dark:text-amber-100">
            <p className="font-semibold">First proof</p>
            <p className="mt-1">{signal.firstProof}</p>
          </div>
        </div>
      </div>
    </a>
  );
}

function ProofRunStepCard({ step }: { step: ProofRunStep }) {
  const Icon = step.icon;
  return (
    <Link href={step.route}>
      <div className="group h-full rounded-md border border-zinc-200 bg-zinc-50 p-4 transition-colors hover:border-zinc-400 hover:bg-white dark:border-white/10 dark:bg-slate-950/55 dark:hover:border-white/25 dark:hover:bg-white/[0.07]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-white text-xs font-semibold text-zinc-700 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-200">
              {step.order}
            </span>
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-200">
              <Icon className="h-5 w-5" />
            </span>
          </div>
          <StatusBadge status={step.status} />
        </div>
        <p className="mt-4 text-sm font-semibold text-zinc-950 dark:text-white">
          {step.title}
        </p>
        <p className="mt-1 text-xl font-semibold tracking-tight text-zinc-950 dark:text-white">
          {step.metric}
        </p>
        <div className="mt-4 space-y-3 text-xs leading-5">
          <div>
            <p className="font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-slate-500">
              Proof artifact
            </p>
            <p className="mt-1 text-zinc-700 dark:text-slate-300">
              {step.proofArtifact}
            </p>
          </div>
          <div>
            <p className="font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-slate-500">
              Blocker
            </p>
            <p className="mt-1 text-zinc-700 dark:text-slate-300">
              {step.blocker}
            </p>
          </div>
        </div>
        <div className="mt-4 flex items-center text-xs font-semibold text-blue-700 opacity-0 transition-opacity group-hover:opacity-100 dark:text-blue-300">
          {step.action}
          <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </div>
      </div>
    </Link>
  );
}

function BuyerProofBriefCard({ brief }: { brief: BuyerProofBrief }) {
  const Icon = brief.icon;
  return (
    <Link href={brief.route}>
      <div className="group h-full rounded-md border border-zinc-200 bg-zinc-50 p-4 transition-colors hover:border-zinc-400 hover:bg-white dark:border-white/10 dark:bg-slate-950/55 dark:hover:border-white/25 dark:hover:bg-white/[0.07]">
        <div className="flex items-start justify-between gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200">
            <Icon className="h-5 w-5" />
          </span>
          <StatusBadge status={brief.status} />
        </div>
        <p className="mt-4 text-sm font-semibold text-zinc-950 dark:text-white">
          {brief.lane}
        </p>
        <p className="mt-1 text-xs font-medium text-zinc-500 dark:text-slate-500">
          Buyer: {brief.buyer}
        </p>
        <div className="mt-4 space-y-3 text-xs leading-5">
          <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 p-2 text-emerald-800 dark:text-emerald-100">
            <p className="font-semibold">Why now</p>
            <p className="mt-1">{brief.whyNow}</p>
          </div>
          <div>
            <p className="font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-slate-500">
              Show first
            </p>
            <p className="mt-1 text-zinc-700 dark:text-slate-300">
              {brief.proofToShow}
            </p>
          </div>
          <div>
            <p className="font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-slate-500">
              First ask
            </p>
            <p className="mt-1 text-zinc-700 dark:text-slate-300">
              {brief.firstAsk}
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-md border border-amber-500/25 bg-amber-500/10 p-2 text-amber-800 dark:text-amber-100">
              <p className="font-semibold">Price motion</p>
              <p className="mt-1">{brief.priceMotion}</p>
            </div>
            <div className="rounded-md border border-red-500/20 bg-red-500/10 p-2 text-red-800 dark:text-red-100">
              <p className="font-semibold">Blocker</p>
              <p className="mt-1">{brief.blocker}</p>
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-center text-xs font-semibold text-emerald-700 opacity-0 transition-opacity group-hover:opacity-100 dark:text-emerald-300">
          Open proof surface
          <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </div>
      </div>
    </Link>
  );
}

function MarketEvidenceCard({ item }: { item: MarketEvidenceSignal }) {
  const Icon = item.icon;
  return (
    <a
      href={item.href}
      target="_blank"
      rel="noreferrer"
      className="group block h-full rounded-md border border-zinc-200 bg-zinc-50 p-4 transition-colors hover:border-zinc-400 hover:bg-white dark:border-white/10 dark:bg-slate-950/55 dark:hover:border-white/25 dark:hover:bg-white/[0.07]"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-200">
          <Icon className="h-5 w-5" />
        </span>
        <div className="flex items-center gap-2">
          <StatusBadge status={item.status} />
          <ExternalLink className="h-4 w-4 text-zinc-400 transition-colors group-hover:text-zinc-700 dark:text-slate-500 dark:group-hover:text-slate-200" />
        </div>
      </div>
      <p className="mt-4 text-sm font-semibold text-zinc-950 dark:text-white">
        {item.label}
      </p>
      <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-300">
        Buyer lane: {item.buyerLane}
      </p>
      <div className="mt-4 space-y-3 text-xs leading-5">
        <div className="rounded-md border border-blue-500/20 bg-blue-500/10 p-2 text-blue-800 dark:text-blue-100">
          <p className="font-semibold">What the source proves</p>
          <p className="mt-1">{item.signal}</p>
        </div>
        <div>
          <p className="font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-slate-500">
            Product demand
          </p>
          <p className="mt-1 text-zinc-700 dark:text-slate-300">
            {item.productDemand}
          </p>
        </div>
        <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 p-2 text-emerald-800 dark:text-emerald-100">
          <p className="font-semibold">Proof to show</p>
          <p className="mt-1">{item.proofToShow}</p>
        </div>
      </div>
      <p className="mt-4 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-slate-500">
        Source: {item.source}
      </p>
    </a>
  );
}

function RevenuePipelineLaneCard({ lane }: { lane: RevenuePipelineLane }) {
  const Icon = lane.icon;
  return (
    <Link href={lane.route}>
      <div className="group h-full rounded-md border border-zinc-200 bg-zinc-50 p-4 transition-colors hover:border-zinc-400 hover:bg-white dark:border-white/10 dark:bg-slate-950/55 dark:hover:border-white/25 dark:hover:bg-white/[0.07]">
        <div className="flex items-start justify-between gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-200">
            <Icon className="h-5 w-5" />
          </span>
          <StatusBadge status={lane.status} />
        </div>
        <p className="mt-4 text-sm font-semibold text-zinc-950 dark:text-white">
          {lane.lane}
        </p>
        <p className="mt-1 text-xs font-medium text-zinc-500 dark:text-slate-500">
          Buyer: {lane.buyer}
        </p>
        <div className="mt-4 space-y-3 text-xs leading-5">
          <div className="rounded-md border border-blue-500/20 bg-blue-500/10 p-2 text-blue-800 dark:text-blue-100">
            <p className="font-semibold">Proof signal</p>
            <p className="mt-1">{lane.proofSignal}</p>
          </div>
          <div>
            <p className="font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-slate-500">
              Sellable artifact
            </p>
            <p className="mt-1 text-zinc-700 dark:text-slate-300">
              {lane.sellableArtifact}
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <p className="font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-slate-500">
                First close motion
              </p>
              <p className="mt-1 text-zinc-700 dark:text-slate-300">
                {lane.firstCloseMotion}
              </p>
            </div>
            <div>
              <p className="font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-slate-500">
                Revenue path
              </p>
              <p className="mt-1 text-zinc-700 dark:text-slate-300">
                {lane.revenuePath}
              </p>
            </div>
          </div>
          <div className="rounded-md border border-red-500/20 bg-red-500/10 p-2 text-red-800 dark:text-red-100">
            <p className="font-semibold">Blocking gap</p>
            <p className="mt-1">{lane.blockingGap}</p>
          </div>
          <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 p-2 text-emerald-800 dark:text-emerald-100">
            <p className="font-semibold">Next product action</p>
            <p className="mt-1">{lane.nextProductAction}</p>
          </div>
        </div>
        <div className="mt-4 flex items-center text-xs font-semibold text-blue-700 opacity-0 transition-opacity group-hover:opacity-100 dark:text-blue-300">
          Open revenue surface
          <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </div>
      </div>
    </Link>
  );
}

function ClosePlaybookCard({ playbook }: { playbook: ClosePlaybook }) {
  const Icon = playbook.icon;
  return (
    <Link href={playbook.route}>
      <div className="group h-full rounded-md border border-zinc-200 bg-zinc-50 p-4 transition-colors hover:border-zinc-400 hover:bg-white dark:border-white/10 dark:bg-slate-950/55 dark:hover:border-white/25 dark:hover:bg-white/[0.07]">
        <div className="flex items-start justify-between gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200">
            <Icon className="h-5 w-5" />
          </span>
          <StatusBadge status={playbook.status} />
        </div>
        <p className="mt-4 text-sm font-semibold text-zinc-950 dark:text-white">
          {playbook.lane}
        </p>
        <p className="mt-1 text-xs font-medium text-zinc-500 dark:text-slate-500">
          Beneficiary: {playbook.beneficiary}
        </p>
        <div className="mt-4 space-y-3 text-xs leading-5">
          <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 p-2 text-emerald-800 dark:text-emerald-100">
            <p className="font-semibold">Opening line</p>
            <p className="mt-1">{playbook.openingLine}</p>
          </div>
          <div>
            <p className="font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-slate-500">
              Qualify with
            </p>
            <ul className="mt-1 space-y-1 text-zinc-700 dark:text-slate-300">
              {playbook.qualifyWith.map(question => (
                <li key={question} className="flex gap-2">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-zinc-400 dark:bg-slate-500" />
                  <span>{question}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-md border border-blue-500/20 bg-blue-500/10 p-2 text-blue-800 dark:text-blue-100">
              <p className="font-semibold">Show first</p>
              <p className="mt-1">{playbook.showFirst}</p>
            </div>
            <div className="rounded-md border border-amber-500/25 bg-amber-500/10 p-2 text-amber-800 dark:text-amber-100">
              <p className="font-semibold">Sustainability path</p>
              <p className="mt-1">{playbook.sustainabilityPath}</p>
            </div>
          </div>
          <div className="rounded-md border border-zinc-200 bg-white/70 p-2 text-zinc-700 dark:border-white/10 dark:bg-black/20 dark:text-slate-300">
            <p className="font-semibold">Success metric</p>
            <p className="mt-1">{playbook.successMetric}</p>
          </div>
          <div className="rounded-md border border-red-500/20 bg-red-500/10 p-2 text-red-800 dark:text-red-100">
            <p className="font-semibold">Do not launch until</p>
            <p className="mt-1">{playbook.doNotLaunchUntil}</p>
          </div>
        </div>
        <div className="mt-4 flex items-center text-xs font-semibold text-emerald-700 opacity-0 transition-opacity group-hover:opacity-100 dark:text-emerald-300">
          Open proof surface
          <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </div>
      </div>
    </Link>
  );
}

function BuyerCloseSignalCard({ signal }: { signal: BuyerCloseSignal }) {
  const Icon = signal.icon;
  return (
    <div className="h-full rounded-md border border-zinc-200 bg-zinc-50 p-4 shadow-sm dark:border-white/10 dark:bg-slate-950/55">
      <div className="flex items-start justify-between gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200">
          <Icon className="h-5 w-5" />
        </span>
        <StatusBadge status={signal.closeReadiness} />
      </div>

      <div className="mt-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-950 dark:text-white">
            {signal.lane}
          </p>
          <p className="mt-1 text-xs font-medium text-zinc-500 dark:text-slate-500">
            Buyer: {signal.buyer}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-white">
            {signal.closeScore}
          </p>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-slate-500">
            close score
          </p>
        </div>
      </div>

      <Progress value={signal.closeScore} className="mt-4 h-2" />

      <div className="mt-4 grid gap-3 text-xs leading-5">
        <div className="rounded-md border border-blue-500/20 bg-blue-500/10 p-2 text-blue-800 dark:text-blue-100">
          <p className="font-semibold">Market need</p>
          <p className="mt-1">{signal.marketNeed}</p>
        </div>
        <div>
          <p className="font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-slate-500">
            Product answer
          </p>
          <p className="mt-1 text-zinc-700 dark:text-slate-300">
            {signal.productAnswer}
          </p>
        </div>
        <div>
          <p className="font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-slate-500">
            Proof artifact
          </p>
          <p className="mt-1 text-zinc-700 dark:text-slate-300">
            {signal.proofArtifact}
          </p>
        </div>
        <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 p-2 text-emerald-800 dark:text-emerald-100">
          <p className="font-semibold">Workspace proof</p>
          <p className="mt-1">{signal.evidenceInWorkspace}</p>
        </div>
        <div className="rounded-md border border-amber-500/25 bg-amber-500/10 p-2 text-amber-800 dark:text-amber-100">
          <p className="font-semibold">First close action</p>
          <p className="mt-1">{signal.firstCloseAction}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button asChild size="sm" variant="outline" className="rounded-md">
          <Link href={signal.route}>
            Open proof surface
            <ArrowRight className="ml-2 h-3.5 w-3.5" />
          </Link>
        </Button>
        <Button asChild size="sm" variant="ghost" className="rounded-md">
          <a href={signal.href} target="_blank" rel="noreferrer">
            Source
            <ExternalLink className="ml-2 h-3.5 w-3.5" />
          </a>
        </Button>
      </div>

      <p className="mt-3 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-slate-500">
        {signal.source}
      </p>
    </div>
  );
}

function FirstCustomerConversationCard({
  conversation,
}: {
  conversation: FirstCustomerConversation;
}) {
  const Icon = conversation.icon;
  return (
    <div className="h-full rounded-md border border-zinc-200 bg-zinc-50 p-4 shadow-sm dark:border-white/10 dark:bg-slate-950/55">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-amber-500/35 bg-amber-500/10 text-xs font-semibold text-amber-800 dark:text-amber-100">
            #{conversation.rank}
          </span>
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-800 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-200">
            <Icon className="h-5 w-5" />
          </span>
        </div>
        <StatusBadge status={conversation.status} />
      </div>

      <div className="mt-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words text-sm font-semibold text-zinc-950 dark:text-white">
            {conversation.channel}
          </p>
          <p className="mt-1 text-xs font-medium text-zinc-500 dark:text-slate-500">
            Buyer: {conversation.buyer}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-white">
            {conversation.count}
          </p>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-slate-500">
            talks
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 text-xs leading-5">
        <div className="rounded-md border border-blue-500/20 bg-blue-500/10 p-2 text-blue-800 dark:text-blue-100">
          <p className="font-semibold">Opening ask</p>
          <p className="mt-1">{conversation.openingAsk}</p>
        </div>
        <div>
          <p className="font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-slate-500">
            Show first
          </p>
          <p className="mt-1 text-zinc-700 dark:text-slate-300">
            {conversation.showArtifact}
          </p>
        </div>
        <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 p-2 text-emerald-800 dark:text-emerald-100">
          <p className="font-semibold">Conversion trigger</p>
          <p className="mt-1">{conversation.conversionTrigger}</p>
        </div>
        <div className="rounded-md border border-red-500/20 bg-red-500/10 p-2 text-red-800 dark:text-red-100">
          <p className="font-semibold">Do not push until</p>
          <p className="mt-1">{conversation.blocker}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button asChild size="sm" variant="outline" className="rounded-md">
          <Link href={conversation.route}>
            Open proof surface
            <ArrowRight className="ml-2 h-3.5 w-3.5" />
          </Link>
        </Button>
        <Button asChild size="sm" variant="ghost" className="rounded-md">
          <a href={conversation.href} target="_blank" rel="noreferrer">
            Source
            <ExternalLink className="ml-2 h-3.5 w-3.5" />
          </a>
        </Button>
      </div>

      <p className="mt-3 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-slate-500">
        {conversation.source}
      </p>
    </div>
  );
}

function MonetizationRow({ lane }: { lane: MonetizationLane }) {
  return (
    <Link href={lane.route}>
      <div className="grid gap-3 rounded-md border border-zinc-200 bg-white/64 p-3 text-sm transition-colors hover:border-zinc-400 hover:bg-white dark:border-white/10 dark:bg-white/[0.035] dark:hover:border-white/25 dark:hover:bg-white/[0.07] lg:grid-cols-[0.9fr_1fr_1fr_1fr]">
        <div>
          <p className="font-semibold text-zinc-950 dark:text-white">
            {lane.lane}
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-slate-500">
            {lane.customer}
          </p>
        </div>
        <p className="text-xs leading-5 text-zinc-700 dark:text-slate-300">
          {lane.offer}
        </p>
        <p className="text-xs leading-5 text-zinc-700 dark:text-slate-300">
          <span className="font-semibold text-amber-700 dark:text-amber-300">
            {lane.priceMotion}
          </span>
          <br />
          {lane.unlock}
        </p>
        <p className="text-xs leading-5 text-zinc-600 dark:text-slate-400">
          Risk: {lane.risk}
        </p>
      </div>
    </Link>
  );
}

const demandSignals: DemandSignal[] = [
  {
    label: "Access gap",
    signal:
      "Low-income Americans did not receive any or enough legal help for 92% of civil legal problems; cost remains a core barrier.",
    implication:
      "The pro se/legal-aid version must guide record prep and packets, not sell fantasy lawyer replacement.",
    source: "Legal Services Corporation Justice Gap Report",
    href: "https://justicegap.lsc.gov/",
  },
  {
    label: "AI adoption",
    signal:
      "Professional AI adoption is moving from curiosity into workflow; the buying question is confidence, verification, and usable output.",
    implication:
      "DueProcess should sell source-bound work product and QC, not generic chat.",
    source: "Thomson Reuters 2026 AI in Professional Services Report",
    href: "https://www.thomsonreuters.com/en/reports/2026-ai-in-professional-services-report",
  },
  {
    label: "Client expectation",
    signal:
      "Clio frames the market around AI, firm profitability, case context, client service, and consumers now turning to AI first.",
    implication:
      "Small firms need a usage-based, case-load-aligned system that produces visible output.",
    source: "Clio Legal Trends Report",
    href: "https://www.clio.com/resources/legal-trends/",
  },
  {
    label: "Ethics guardrail",
    signal:
      "ABA Formal Opinion 512 ties lawyer AI use to competence, confidentiality, communication, supervision, candor, and reasonable fees.",
    implication:
      "Court-safe citations, source appendices, and QC are not decoration. They are the product.",
    source: "ABA Formal Opinion 512",
    href: "https://www.americanbar.org/groups/professional_responsibility/resources/opinions/",
  },
  {
    label: "Public defense load",
    signal:
      "Public defense work is document-heavy and workload-constrained; the wedge is faster record review, not replacing counsel.",
    implication:
      "Post-conviction and defense pilots should start with transcript, Brady, competency, speedy-trial, and writ proof packs.",
    source: "RAND National Public Defense Workload Study",
    href: "https://www.rand.org/pubs/research_reports/RRA2559-1.html",
  },
];

const researchRefreshSignals: ResearchRefreshSignal[] = [
  {
    label: "Access gap is the human problem",
    source: "Legal Services Corporation Justice Gap",
    href: "https://justicegap.lsc.gov/resource/executive-summary/",
    verifiedSignal:
      "LSC reports low-income Americans do not get any or enough legal help for 92% of substantial civil legal problems.",
    marketNeed:
      "The pro se lane needs record organization, source-backed next steps, and understandable packets. It does not need a fake-lawyer chatbot with a liability grenade taped to it.",
    productCommand:
      "Make Case Builder a guided upload-to-packet workflow: timeline, issue map, missing records, source appendix, plain-English limits, and export.",
    customerBase:
      "Self-represented litigants, families, legal-aid referral overflow, law libraries, and court self-help ecosystems.",
    firstProof:
      "One messy case becomes a before/after packet a non-lawyer can follow without a founder walkthrough.",
    icon: Scale,
  },
  {
    label: "AI adoption is workflow, not magic",
    source: "Thomson Reuters 2026 AI in Professional Services",
    href: "https://www.thomsonreuters.com/en/reports/2026-ai-in-professional-services-report",
    verifiedSignal:
      "Thomson Reuters' 2026 report is based on 1,500+ professionals and positions AI as transforming legal, risk, fraud, government, tax, and accounting work.",
    marketNeed:
      "Professional buyers are not paying for vibes. They need verification, governance, ROI, usage visibility, and work product a human reviewer can trust.",
    productCommand:
      "Sell source-bound legal packets with QC status, blocked claims, adverse facts, usage telemetry, and PDF/DOCX exports.",
    customerBase:
      "Small civil-rights firms, defense teams, legal-aid clinics, investigations teams, and professional service workflows.",
    firstProof:
      "Closed-matter leverage memo compared against manual attorney or investigator review time.",
    icon: ShieldCheck,
  },
  {
    label: "Lawyer ethics make QC mandatory",
    source: "ABA Formal Opinion 512",
    href: "https://www.americanbar.org/content/dam/aba/administrative/professional_responsibility/ethics-opinions/aba-formal-opinion-512.pdf",
    verifiedSignal:
      "The ABA's generative-AI guidance makes human competence, confidentiality, supervision, communication, candor, and fee reasonableness central to lawyer use.",
    marketNeed:
      "Attorney-facing output must show what is verified, what is inferred, what is missing, what is adverse, and what needs human review.",
    productCommand:
      "Every court-facing packet needs a reliability certificate, source appendix, authority posture, adverse-fact review, and visible filing gates.",
    customerBase:
      "Attorneys, clinics, supervised law students, firm investigators, and paralegal review teams.",
    firstProof:
      "A report export with command completeness, caption state, source/QC gates, authority warnings, and blocked-claim visibility.",
    icon: ClipboardCheck,
  },
  {
    label: "Defense overload is a record-review wedge",
    source: "RAND National Public Defense Workload Study",
    href: "https://www.rand.org/pubs/research_reports/RRA2559-1.html",
    verifiedSignal:
      "RAND's workload study frames public defense as workload constrained and modern defense practice as more complex, including digital discovery and forensic evidence.",
    marketNeed:
      "Defense and post-conviction buyers need faster transcript, order, discovery, competency, Brady, and writ review without replacing counsel.",
    productCommand:
      "Prioritize selected-file analysis, timeline/gap maps, Brady/Napue trackers, competency gaps, speedy-trial posture, and mandamus route labels.",
    customerBase:
      "Public defenders, innocence teams, habeas counsel, mitigation investigators, and defense clinics.",
    firstProof:
      "One transcript/order/discovery bundle produces a doctrine-specific gap map and writ/no-writ packet.",
    icon: FileSearch,
  },
  {
    label: "Client-facing firms need usable context",
    source: "Clio Legal Trends",
    href: "https://www.clio.com/resources/legal-trends/",
    verifiedSignal:
      "Clio's Legal Trends hub centers AI, firm profitability, client service, case context, and consumer-facing legal workflow.",
    marketNeed:
      "Small firms will not buy a platform just because it has agents. They buy faster case context, better client explanations, and reviewable packets.",
    productCommand:
      "Make the output easy to hand to a partner or client: executive summary, source support, adverse facts, missing proof, and next-action checklist.",
    customerBase:
      "Small plaintiff firms, civil-rights lawyers, employment lawyers, solos, and high-volume matter reviewers.",
    firstProof:
      "A partner-facing memo that explains the case in ten minutes and shows exactly where the record supports or fails each point.",
    icon: DollarSign,
  },
];

const verifiedMarketEvidence: MarketEvidenceSignal[] = [
  {
    label: "Access-to-justice demand is structural",
    buyerLane: "Pro se Case Builder / legal aid",
    source: "Legal Services Corporation Justice Gap",
    href: "https://justicegap.lsc.gov/resource/executive-summary/",
    signal:
      "LSC's Justice Gap work supports the basic market reality: many people cannot get enough legal help, and legal-aid programs cannot absorb all demand.",
    productDemand:
      "The product must organize records, explain next steps plainly, and produce reviewable packets without pretending to replace counsel.",
    proofToShow:
      "Before/after one-case packet: messy uploads turned into timeline, issue map, missing-record list, source appendix, and cautious next actions.",
    status: "live",
    icon: Scale,
  },
  {
    label: "Legal-aid overload creates an intake product",
    buyerLane: "Clinics / access-to-justice programs",
    source: "LSC grantees and technology programs",
    href: "https://www.lsc.gov/grants/our-grantees",
    signal:
      "Legal-aid is already organized around high-volume service delivery, grantee operations, and technology-funded intake improvement.",
    productDemand:
      "Do not lead with aggressive filings. Lead with attorney handoff: facts, adverse facts, deadlines, missing records, exclusions, and reviewer notes.",
    proofToShow:
      "Three anonymized intake packets with measured reviewer-time reduction and clear proof of what the system refused to overclaim.",
    status: "partial",
    icon: Landmark,
  },
  {
    label: "AI adoption requires verification, not magic",
    buyerLane: "Small firms / professional users",
    source: "Thomson Reuters AI in Professional Services",
    href: "https://www.thomsonreuters.com/en/reports/2026-ai-in-professional-services-report",
    signal:
      "Professional AI adoption is moving into workflow, but buyers still need governance, confidence, and usable work product.",
    productDemand:
      "DueProcess has to sell source-bound outputs, QC status, usage telemetry, and exportable work product instead of generic chat.",
    proofToShow:
      "Civil-rights leverage memo with quote anchors, QC status, blocked claims, adverse facts, and PDF/DOCX exports that survive outside the app.",
    status: "partial",
    icon: ShieldCheck,
  },
  {
    label: "Lawyer AI ethics make QC the product",
    buyerLane: "Attorneys / firms / clinics",
    source: "ABA Formal Opinion 512",
    href: "https://www.americanbar.org/content/dam/aba/administrative/professional_responsibility/ethics-opinions/aba-formal-opinion-512.pdf",
    signal:
      "The AI-in-lawyer-workflow problem is competence, confidentiality, communication, supervision, candor, and reasonable fees.",
    productDemand:
      "Every court-facing report needs source appendices, confidence gates, authority verification prompts, adverse-fact review, and visible human-review warnings.",
    proofToShow:
      "Filing readiness review and reliability certificate showing command completeness, caption state, source/QC gate, authority posture, and adverse-fact status.",
    status: "live",
    icon: ClipboardCheck,
  },
  {
    label: "Defense work is document-heavy and overloaded",
    buyerLane: "Defense / habeas / innocence teams",
    source: "RAND National Public Defense Workload Study",
    href: "https://www.rand.org/pubs/research_reports/RRA2559-1.html",
    signal:
      "Public-defense workload pressure is real, and modern defense work includes digital discovery, forensic evidence, transcripts, and complex records.",
    productDemand:
      "The strongest wedge is not general legal chat. It is transcript/order/discovery review with Brady, competency, speedy-trial, writ, and missing-record routing.",
    proofToShow:
      "Defense transcript and writ packet with timeline, Brady/Napue tracker, competency gap map, speedy-trial posture, and mandamus gate.",
    status: "partial",
    icon: FileSearch,
  },
  {
    label: "Small-firm workflow pressure is commercial",
    buyerLane: "Small civil-rights firms",
    source: "Clio Legal Trends",
    href: "https://www.clio.com/resources/legal-trends/",
    signal:
      "Small firms buy workflow improvement when it helps profitability, case context, client service, and faster review.",
    productDemand:
      "The sellable unit should be a narrow matter review and usage-based firm plan, not enterprise seat theater.",
    proofToShow:
      "Closed-matter pilot comparing DueProcess issue map, source appendix, and attorney-review time against manual review.",
    status: "partial",
    icon: DollarSign,
  },
];

const customerSegments: CustomerSegment[] = [
  {
    name: "Pro se case builders",
    buyer: "Self-represented litigants and families",
    pain: "They have records, deadlines, and misconduct concerns, but no clean way to organize proof into usable legal packets.",
    dueProcessWedge:
      "Guided upload, timeline/gap map, violation ledger, missing-record demands, and plain-English report exports.",
    firstOffer:
      "Case Builder subscription with private uploads, limited runs, and court-safe exports.",
    proofNeeded:
      "One real case that goes from ugly uploads to a coherent packet without unsupported factual claims.",
    route: "/sector/corpus",
    icon: Scale,
  },
  {
    name: "Legal aid and clinics",
    buyer: "Nonprofits, law-school clinics, access-to-justice teams",
    pain: "High intake volume, limited attorney hours, and constant need to triage facts before a lawyer touches the file.",
    dueProcessWedge:
      "Structured intake, OCR readiness, issue triage, adverse-fact capture, and review-ready summaries.",
    firstOffer:
      "Team plan with staff seats, intake dashboards, and exportable review packets.",
    proofNeeded:
      "Time saved per intake, low hallucination rate, and clean attorney review workflow.",
    route: "/dashboard",
    icon: Landmark,
  },
  {
    name: "Small civil-rights firms",
    buyer: "Plaintiff-side lawyers and investigators",
    pain: "They need to spot Monell, retaliation, Brady/Napue, search, detention, and immunity routes before spending weeks in review.",
    dueProcessWedge:
      "Leverage ranking, Monell pattern mapping, source appendices, court packets, and firm usage billing.",
    firstOffer:
      "Firm base subscription plus metered pages, agent runs, API calls, and additional seats.",
    proofNeeded:
      "One discovery-heavy matter where the tool finds high-value claims, gaps, and exportable drafts.",
    route: "/violations",
    icon: ShieldCheck,
  },
  {
    name: "Public defense and post-conviction",
    buyer: "Defense teams, innocence projects, habeas counsel",
    pain: "Transcripts, discovery, competency records, detention orders, and timelines are scattered across painful files.",
    dueProcessWedge:
      "Speedy-trial clocks, competency-procedure gaps, Brady risk, transcript contradictions, and writ/remedy routing.",
    firstOffer:
      "Matter-based review package or usage-based firm plan for document-heavy cases.",
    proofNeeded:
      "Verified timeline and issue map that survives attorney scrutiny and does not overstate doctrine.",
    route: "/sector/arsenal",
    icon: FileSearch,
  },
  {
    name: "Investigative desks",
    buyer: "Journalists, watchdogs, policy investigators",
    pain: "They need to connect actors, timelines, records, and violation signals without filing a legal brief.",
    dueProcessWedge:
      "Public-records gap map, actor timeline, contradiction review, and source ledger exports.",
    firstOffer:
      "Project workspace with read/export seats and API access for document archives.",
    proofNeeded:
      "A publishable evidence ledger with quotes, dates, actors, and missing-record targets.",
    route: "/market",
    icon: SearchCheck,
  },
];

const monetizationLanes: MonetizationLane[] = [
  {
    lane: "Demo",
    customer: "Curious users and partners",
    offer:
      "Sample case, no sensitive private upload, guided walkthrough, example reports.",
    priceMotion: "Free only as demo",
    unlock:
      "Converts users into Case Builder or Firm by showing the end product.",
    risk: "Free private uploads create cost and liability with no revenue.",
    route: "/pricing",
  },
  {
    lane: "Case Builder",
    customer: "Pro se / single-case users",
    offer:
      "Private upload, guided analysis, limited reports, source appendix, export quality controls.",
    priceMotion: "$99/mo anchor",
    unlock: "Clear value: one coherent packet beats dozens of panic documents.",
    risk: "Must be plain-English and court-safe or refunds/support explode.",
    route: "/pricing",
  },
  {
    lane: "Firm",
    customer: "Small firms, clinics, defense teams",
    offer:
      "Unlimited cases, all agents, team seats, API access, usage-based heavy work.",
    priceMotion: "$199/mo base + usage",
    unlock: "Cost scales with pages and runs instead of weird seat friction.",
    risk: "Needs hard backend limits, billing telemetry, and no surprise bills without alerts.",
    route: "/pricing",
  },
  {
    lane: "Archive/API",
    customer: "Investigators, watchdogs, integrators",
    offer:
      "Public/private archive API, ingest endpoint, violation taxonomy, timeline, webhooks, SDK.",
    priceMotion: "Project/API contract",
    unlock: "Turns DueProcess into infrastructure, not just an app.",
    risk: "Needs multi-tenant key scoping and callbacks before this is a real product.",
    route: "/settings",
  },
];

export default function MarketCommand() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [marketMode, setMarketMode] = useState<MarketCommandMode>("proof");

  const documentsQuery = trpc.documents.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const findingsQuery = trpc.agents.listFindings.useQuery(undefined, {
    enabled: isAuthenticated,
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
  const monitorsQuery = trpc.settings.monitors.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const documents = (documentsQuery.data ?? []) as DocumentRecord[];
  const findings = (findingsQuery.data ?? []) as Finding[];
  const savedReports = (savedReportsQuery.data ?? []) as Array<
    Record<string, unknown>
  >;
  const overview = overviewQuery.data as SettingsOverview | undefined;
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
  const searchableFindingText = (finding: Finding) =>
    [
      finding.title,
      finding.findingType,
      finding.missingRecords.join(" "),
      finding.sourceAnchors
        .map(anchor => anchor.quote || anchor.support || "")
        .join(" "),
    ]
      .join(" ")
      .toLowerCase();
  const writFindings = findings.filter(finding =>
    /mandamus|writ|prohibition|clear duty|adequate remedy|rule on|written findings/.test(
      searchableFindingText(finding)
    )
  );
  const monellFindings = findings.filter(finding =>
    /monell|policy|custom|failure to train|ratification|deliberate indifference/.test(
      searchableFindingText(finding)
    )
  );
  const bradyFindings = findings.filter(finding =>
    /brady|napue|giglio|discovery|suppressed|false evidence/.test(
      searchableFindingText(finding)
    )
  );
  const timelineFindings = findings.filter(finding =>
    /timeline|chronology|delay|gap|docket|transcript|date/.test(
      searchableFindingText(finding)
    )
  );
  const reportText = (report: Record<string, unknown>) =>
    [report.title, report.template, report.fileName, report.name]
      .map(value => String(value ?? ""))
      .join(" ")
      .toLowerCase();
  const writReports = savedReports.filter(report =>
    /mandamus|writ|prohibition/.test(reportText(report))
  );
  const exactUsageEnabled = Boolean(usage?.aiUsage?.exactTokenTelemetryEnabled);
  const billingSnapshot = usage?.billing?.snapshot;
  const snapshotUsagePoints =
    (billingSnapshot?.current?.pagesAnalyzed ?? 0) +
    (billingSnapshot?.current?.agentCalls ?? 0) +
    (billingSnapshot?.current?.reportsGenerated ?? 0);
  const billingLive = Boolean(usage?.billing?.subscription?.plan);
  const commercialReadiness = overview?.commercial?.revenueReadiness;
  const revenueBlockers = commercialReadiness?.blockers ?? [];
  const checkoutReadyPlans = commercialReadiness?.checkoutReadyPlans ?? 0;
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
    overviewQuery.isLoading ||
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
        status:
          checkoutReadyPlans > 0 && revenueBlockers.length === 0
            ? "live"
            : checkoutReadyPlans > 0 || billingLive
              ? "partial"
              : "missing",
        metric:
          checkoutReadyPlans > 0
            ? `${formatNumber(checkoutReadyPlans)} checkout plans ready`
            : usage?.billing?.subscription?.plan || "No paid checkout",
        detail:
          revenueBlockers.length > 0
            ? `${formatNumber(revenueBlockers.length)} monetization blockers are visible in Settings.`
            : billingLive
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
    checkoutReadyPlans,
    revenueBlockers.length,
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

  const exactUsageCalls = usage?.aiUsage?.exact?.calls ?? 0;
  const savedOutputCount = usage?.aiUsage?.savedAgentOutputs?.outputs ?? 0;
  const proofRunSteps: ProofRunStep[] = [
    {
      order: 1,
      title: "Focused record set",
      status:
        documents.length === 0
          ? "missing"
          : readyDocuments.length > 0
            ? "live"
            : "partial",
      metric: `${formatNumber(readyDocuments.length)} / ${formatNumber(documents.length)} ready`,
      proofArtifact:
        "A real matter or clinic-style sample with filings, orders, transcripts, exhibits, or discovery in Corpus.",
      blocker:
        documents.length === 0
          ? "No documents exist yet, so every downstream claim is still theater."
          : pendingDocuments.length > 0 || failedDocuments.length > 0
            ? "Some records are still pending or blocked; whole-case analysis should stay gated."
            : "Record set exists and is ready for the next step.",
      action: "Open Corpus",
      route: "/sector/corpus",
      icon: Database,
    },
    {
      order: 2,
      title: "Extraction and source anchors",
      status:
        readyDocuments.length === 0
          ? "missing"
          : failedDocuments.length > 0 || pendingDocuments.length > 0
            ? "partial"
            : "live",
      metric: `${formatNumber(failedDocuments.length)} blocked OCR`,
      proofArtifact:
        "Extracted text that a user can inspect, with source hashes and no silent empty OCR entering agent runs.",
      blocker:
        failedDocuments.length > 0
          ? "Blocked files need retry, exclusion, or visible explanation before analysis."
          : pendingDocuments.length > 0
            ? "Processing files need to finish before a whole-case proof run."
            : readyDocuments.length > 0
              ? "Source readiness is usable for selected-file proof runs."
              : "No analysis-ready extracted text yet.",
      action: "Fix readiness",
      route: "/sector/corpus",
      icon: FileCheck,
    },
    {
      order: 3,
      title: "Selected-file legal analysis",
      status:
        anchoredFindings.length > 0
          ? "live"
          : findings.length > 0
            ? "partial"
            : "missing",
      metric: `${formatNumber(anchoredFindings.length)} anchored findings`,
      proofArtifact:
        "Structured findings with source anchors, confidence, leverage, remedy path, missing records, and next action.",
      blocker:
        anchoredFindings.length > 0
          ? "Now prove the top findings are understandable to a human reviewer."
          : findings.length > 0
            ? "Findings exist, but not all are source-anchored enough for market proof."
            : "No structured analysis output exists yet.",
      action: "Run analysis",
      route: "/sector/arsenal",
      icon: Brain,
    },
    {
      order: 4,
      title: "QC and violation ledger",
      status:
        reportReadyFindings.length > 0
          ? "live"
          : qcTouchedFindings.length > 0
            ? "partial"
            : "missing",
      metric: `${formatNumber(reportReadyFindings.length)} report-ready`,
      proofArtifact:
        "Violation ledger showing what is approved, downgraded, blocked, or needs more proof before court-facing export.",
      blocker:
        reportReadyFindings.length > 0
          ? `${formatNumber(blockedFindings.length)} blocked findings stay out of reports by default.`
          : qcTouchedFindings.length > 0
            ? "QC touched findings, but the packet still needs report-ready material."
            : "No QC trail yet; this is where hallucination risk gets expensive.",
      action: "Open violations",
      route: "/violations",
      icon: ShieldCheck,
    },
    {
      order: 5,
      title: "Report and export packet",
      status:
        savedReports.length > 0
          ? "live"
          : reportReadyFindings.length > 0
            ? "partial"
            : "missing",
      metric: `${formatNumber(savedReports.length)} saved reports`,
      proofArtifact:
        "A saved War Room, court packet, timeline, mandamus, discovery, or source-led report exportable outside the app.",
      blocker:
        savedReports.length > 0
          ? "Now verify PDF/DOCX output quality and plain-English usefulness."
          : reportReadyFindings.length > 0
            ? "Report-ready findings exist; a saved/exported report still needs to be generated."
            : "Reports need QC-cleared findings before they can be product proof.",
      action: "Build report",
      route: "/reports",
      icon: ReceiptText,
    },
    {
      order: 6,
      title: "Cost and usage telemetry",
      status:
        snapshotUsagePoints > 0 && exactUsageEnabled && exactUsageCalls > 0
          ? "live"
          : snapshotUsagePoints > 0 || savedOutputCount > 0
            ? "partial"
            : "missing",
      metric:
        snapshotUsagePoints > 0
          ? `${formatNumber(billingSnapshot?.current?.pagesAnalyzed)} pages / ${formatNumber(billingSnapshot?.current?.agentCalls)} agent calls`
          : exactUsageEnabled
            ? `${formatNumber(exactUsageCalls)} exact calls`
            : `${formatNumber(savedOutputCount)} saved outputs`,
      proofArtifact:
        "LLM call, token, page, report, and export usage that supports Case Builder and Firm pricing without guessing.",
      blocker:
        snapshotUsagePoints > 0 && exactUsageEnabled && exactUsageCalls > 0
          ? `${formatUsd(billingSnapshot?.current?.exactCostUsd)} exact current-period LLM cost; ${formatUsd(billingSnapshot?.firmUsage?.estimatedOverageUsd)} estimated Firm overage.`
          : snapshotUsagePoints > 0
            ? "Current-period usage exists, but exact token events need fresh LLM-backed runs."
            : savedOutputCount > 0
              ? "Only estimate-level cost telemetry is available from saved outputs."
              : "No usage proof yet, so firm metering would be vibes with invoices.",
      action: "Open usage",
      route: "/settings",
      icon: Gauge,
    },
    {
      order: 7,
      title: "Billing and limits",
      status:
        checkoutReadyPlans > 0 && revenueBlockers.length === 0
          ? "live"
          : checkoutReadyPlans > 0 || billingLive
            ? "partial"
            : "missing",
      metric:
        checkoutReadyPlans > 0
          ? `${formatNumber(checkoutReadyPlans)} checkout plans`
          : "No paid checkout",
      proofArtifact:
        "Stripe price IDs, checkout, subscription state, server-side tier limits, and loud failure when billing config is missing.",
      blocker:
        revenueBlockers.length > 0
          ? `${formatNumber(revenueBlockers.length)} revenue blockers remain visible in Settings.`
          : checkoutReadyPlans > 0
            ? "Billing looks closer; still needs a real customer-path checkout smoke."
            : "Pricing UI exists, but money is not real until checkout and limits are enforced.",
      action: "Open pricing",
      route: "/pricing",
      icon: DollarSign,
    },
  ];
  const proofRunLiveCount = proofRunSteps.filter(
    step => step.status === "live"
  ).length;
  const proofRunScore = Math.round(
    (proofRunLiveCount / proofRunSteps.length) * 100
  );
  const nextProofRunStep =
    proofRunSteps.find(step => step.status !== "live") ??
    proofRunSteps[proofRunSteps.length - 1];

  const buyerReadiness: BuyerReadiness[] = [
    {
      segment: "Pro se case builders",
      priority: "Best first paid individual lane",
      status:
        readyDocuments.length > 0 && savedReports.length > 0
          ? "live"
          : readyDocuments.length > 0 || reportReadyFindings.length > 0
            ? "partial"
            : "missing",
      proof: `${formatNumber(readyDocuments.length)} ready documents, ${formatNumber(reportReadyFindings.length)} report-ready findings, ${formatNumber(savedReports.length)} saved reports.`,
      missing:
        savedReports.length > 0
          ? "Now prove a repeatable before/after case packet with plain-English guidance."
          : "Needs a real exported packet from a messy user-like case.",
      route: "/reports",
      icon: Scale,
    },
    {
      segment: "Legal aid and clinics",
      priority: "High-volume triage lane",
      status:
        readyDocuments.length > 0 && blockedFindings.length >= 0
          ? "partial"
          : "missing",
      proof: `${formatNumber(readyDocuments.length)} sources can be reviewed; ${formatNumber(blockedFindings.length)} findings are blocked by QC instead of leaking into packets.`,
      missing:
        "Needs intake-time benchmark, staff workflow, and reviewer handoff instead of only case-owner UX.",
      route: "/dashboard",
      icon: Landmark,
    },
    {
      segment: "Small civil-rights firms",
      priority: "Highest-dollar near-term lane",
      status:
        reportReadyFindings.length > 0 && checkoutReadyPlans > 0
          ? "live"
          : reportReadyFindings.length > 0 || checkoutReadyPlans > 0
            ? "partial"
            : "missing",
      proof: `${formatNumber(reportReadyFindings.length)} findings can feed reports; ${formatNumber(checkoutReadyPlans)} subscription checkout plans are configured.`,
      missing:
        revenueBlockers.length > 0
          ? `${formatNumber(revenueBlockers.length)} monetization blockers remain in Settings.`
          : "Needs one discovery-heavy proof run with measured attorney-review savings.",
      route: "/settings",
      icon: ShieldCheck,
    },
    {
      segment: "Defense and post-conviction",
      priority: "Strong legal-need lane",
      status:
        anchoredFindings.length > 0 && missingRecords > 0
          ? "partial"
          : anchoredFindings.length > 0
            ? "partial"
            : "missing",
      proof: `${formatNumber(anchoredFindings.length)} anchored findings and ${formatNumber(missingRecords)} missing-record demands are available.`,
      missing:
        "Needs doctrine-specific proof packs for speedy trial, competency, Brady, habeas, and writ routes.",
      route: "/sector/arsenal",
      icon: FileSearch,
    },
    {
      segment: "Investigative desks and watchdogs",
      priority: "Archive/API expansion lane",
      status:
        anchoredFindings.length > 0 && savedReports.length > 0
          ? "partial"
          : anchoredFindings.length > 0
            ? "partial"
            : "missing",
      proof: `${formatNumber(anchoredFindings.length)} findings have source anchors; ${formatNumber(savedReports.length)} saved packets exist.`,
      missing:
        "Needs multi-tenant API keys, webhooks, public/private archive controls, and evidence-led exports.",
      route: "/violations",
      icon: SearchCheck,
    },
  ];

  const pilotOffers: PilotOffer[] = [
    {
      name: "Case Builder proof packet",
      target: "Pro se litigants with one messy active case",
      status:
        readyDocuments.length > 0 && savedReports.length > 0
          ? "live"
          : readyDocuments.length > 0 || reportReadyFindings.length > 0
            ? "partial"
            : "missing",
      package:
        "Upload a focused record set, run selected-file analysis, generate a plain-English packet with timeline, issue map, missing records, and source appendix.",
      priceTest: "$99/mo subscription or $149 one-case review package.",
      proofArtifact:
        "Before/after case packet showing raw documents converted into reviewable findings and next actions.",
      sellWhen:
        savedReports.length > 0
          ? "The report export is clean enough to hand to a human reviewer without app context."
          : "One saved report exists from real uploaded sources, not sample copy.",
      blocker:
        savedReports.length > 0
          ? "Plain-English onboarding and refund-safe scope language still need polish."
          : "Needs a complete upload-to-export proof run.",
      route: "/reports",
      icon: Scale,
    },
    {
      name: "Civil-rights discovery triage",
      target: "Small plaintiff firms and civil-rights investigators",
      status:
        reportReadyFindings.length > 0 && checkoutReadyPlans > 0
          ? "live"
          : reportReadyFindings.length > 0 || checkoutReadyPlans > 0
            ? "partial"
            : "missing",
      package:
        "Review a discovery-heavy matter for Monell, retaliation, search/seizure, detention, Brady/Napue, immunity, and missing-record leverage.",
      priceTest: "$499-$1,500 pilot matter, then $199/mo firm base plus usage.",
      proofArtifact:
        "Partner-facing leverage memo with ranked claims, source quotes, adverse facts, gaps, and exportable appendix.",
      sellWhen:
        reportReadyFindings.length > 0
          ? "A discovery-heavy matter produces ranked findings and a usable attorney-review report."
          : "The violation ledger has real source-bound findings from uploaded records.",
      blocker:
        checkoutReadyPlans > 0
          ? "Needs firm usage limits, alerting, and billing telemetry tested under load."
          : "Stripe price IDs and server-side tier enforcement are not fully productized.",
      route: "/violations",
      icon: ShieldCheck,
    },
    {
      name: "Clinic intake accelerator",
      target: "Legal aid, clinics, and access-to-justice programs",
      status:
        readyDocuments.length > 0 && blockedFindings.length >= 0
          ? "partial"
          : "missing",
      package:
        "Convert intake documents into an attorney handoff: facts, adverse facts, deadlines, missing records, and risk-screened issue summary.",
      priceTest:
        "$750-$2,500 clinic pilot or sponsored access-to-justice workspace.",
      proofArtifact:
        "Measured intake packet showing time saved, what was excluded, and what a reviewer still must decide.",
      sellWhen:
        readyDocuments.length > 0
          ? "You can time a staff member using the flow on three sample intakes."
          : "Corpus intake can process real clinic-style files without silent OCR failures.",
      blocker:
        "Needs intake-specific workflow, reviewer notes, role permissions, and time-saved measurement.",
      route: "/dashboard",
      icon: Landmark,
    },
    {
      name: "Watchdog evidence ledger",
      target: "Journalists, watchdogs, public-records teams",
      status:
        anchoredFindings.length > 0 && savedReports.length > 0
          ? "partial"
          : anchoredFindings.length > 0
            ? "partial"
            : "missing",
      package:
        "Build a source-led public-interest ledger: actors, dates, contradiction map, missing records, violation tags, and exportable evidence appendix.",
      priceTest: "$1,500-$5,000 project workspace or API/archive contract.",
      proofArtifact:
        "Publishable evidence ledger that can be checked without trusting the AI output.",
      sellWhen:
        anchoredFindings.length > 0
          ? "The ledger ties every signal to a source, quote, date, actor, and missing-record demand."
          : "The archive can ingest and expose source-bound findings reliably.",
      blocker:
        "Needs multi-tenant API keys, webhooks, public/private controls, and SDK packaging before scale.",
      route: "/settings",
      icon: SearchCheck,
    },
  ];

  const proofPacks: ProofPack[] = [
    {
      name: "Mandamus / writ viability packet",
      buyerLane: "Defense, post-conviction, pro se urgent-relief cases",
      status:
        writReports.length > 0
          ? "live"
          : writFindings.length > 0 || missingRecords > 0
            ? "partial"
            : "missing",
      paidJob:
        "Decide whether the record supports a narrow writ route, a records demand first, appeal preservation, or no writ.",
      includes: [
        "clear-duty and no-adequate-remedy gate",
        "FILE_WRIT / DEMAND_RECORDS_FIRST / PRESERVE_FOR_APPEAL / NOT_MANDAMUS lane",
        "appendix records checklist",
        "guarded petition scaffold language",
      ],
      passGate:
        writReports.length > 0
          ? "At least one saved writ-style report exists. Next proof is human review quality."
          : writFindings.length > 0
            ? "Writ signals exist, but a saved mandamus report still needs to be generated."
            : "Needs source-bound writ findings or missing-record demands from processed files.",
      priceMotion: "$149 one-case urgent packet or $499-$2,500 matter review.",
      route: "/reports",
      icon: FileCheck,
    },
    {
      name: "Civil-rights discovery leverage memo",
      buyerLane: "Small plaintiff firms and civil-rights investigators",
      status:
        monellFindings.length > 0 && reportReadyFindings.length > 0
          ? "live"
          : reportReadyFindings.length > 0
            ? "partial"
            : "missing",
      paidJob:
        "Turn discovery into ranked claims, Monell gaps, adverse facts, immunity routes, and missing-record leverage.",
      includes: [
        "top claim ranking",
        "Monell policy/custom/failure-to-train map",
        "source appendix and QC status",
        "missing-record demand list",
      ],
      passGate:
        monellFindings.length > 0
          ? "Monell-like signals are present. Package needs a saved export if one is not already built."
          : "Needs at least one discovery-heavy proof run with Monell or pattern findings.",
      priceMotion:
        "$499-$1,500 pilot matter, then $199/mo firm base plus usage.",
      route: "/violations",
      icon: ShieldCheck,
    },
    {
      name: "Pro se case-builder packet",
      buyerLane: "Self-represented litigants and families",
      status:
        readyDocuments.length > 0 && savedReports.length > 0
          ? "live"
          : readyDocuments.length > 0 || reportReadyFindings.length > 0
            ? "partial"
            : "missing",
      paidJob:
        "Convert messy files into a plain-English timeline, issue map, missing-record list, and source-backed report.",
      includes: [
        "guided upload and readiness warnings",
        "timeline and issue map",
        "plain-English next actions",
        "source appendix export",
      ],
      passGate:
        savedReports.length > 0
          ? "Saved reports exist. Now test whether a stranger can follow the packet without help."
          : "Needs a full upload-to-export proof run from real or realistic records.",
      priceMotion: "$99/mo Case Builder or $149 one-case packet.",
      route: "/reports",
      icon: Scale,
    },
    {
      name: "Defense transcript and Brady review",
      buyerLane: "Public defense, innocence, habeas, and mitigation teams",
      status:
        bradyFindings.length > 0 || timelineFindings.length > 0
          ? "partial"
          : "missing",
      paidJob:
        "Review transcripts, orders, discovery, and jail/competency records for gaps, contradictions, Brady/Napue risk, and speedy-trial posture.",
      includes: [
        "Brady/Napue tracker",
        "competency and detention gap list",
        "speedy-trial and delay timeline",
        "writ/remedy routing",
      ],
      passGate:
        bradyFindings.length > 0 || timelineFindings.length > 0
          ? "Relevant signals exist, but doctrine-specific saved packets and authority verification are still needed."
          : "Needs transcript/order/discovery bundle proof run with source-bound findings.",
      priceMotion: "$499-$2,500 matter review depending on volume.",
      route: "/sector/arsenal",
      icon: FileSearch,
    },
    {
      name: "Watchdog evidence ledger",
      buyerLane: "Journalists, public-records teams, watchdogs",
      status:
        anchoredFindings.length > 0 && savedReports.length > 0
          ? "partial"
          : anchoredFindings.length > 0
            ? "partial"
            : "missing",
      paidJob:
        "Produce a checkable evidence ledger with actors, dates, contradiction signals, missing records, and source quotes.",
      includes: [
        "actor and timeline-ready facts",
        "source quotes and file IDs",
        "public-records gap list",
        "exportable appendix",
      ],
      passGate:
        anchoredFindings.length > 0
          ? "Source-bound signals exist. The blocker is public/private controls and archive packaging."
          : "Needs source-bound findings tied to documents before outreach.",
      priceMotion: "$1,500-$5,000 project workspace or archive/API contract.",
      route: "/violations",
      icon: SearchCheck,
    },
  ];

  const buyerProofBriefs: BuyerProofBrief[] = [
    {
      lane: "Civil-rights firm pilot",
      buyer: "Owner attorney, investigator, paralegal lead",
      whyNow:
        "Discovery review is expensive, pattern-heavy, and document-bound. Firms will pay if the first artifact saves senior review time without creating unsupported claims.",
      proofToShow:
        "Civil-rights discovery leverage memo with ranked claims, Monell gaps, adverse facts, immunity routes, missing records, QC status, and PDF/DOCX appendix.",
      firstAsk:
        "Give DueProcess one closed or low-risk discovery set and compare the issue map against what the team already found.",
      priceMotion:
        "$499-$1,500 pilot matter; convert to $199/month firm base plus usage.",
      blocker:
        checkoutReadyPlans > 0
          ? "Run one discovery-heavy proof set and measure attorney-review savings."
          : "Finish checkout, firm usage alerts, and tier enforcement before hard selling.",
      status:
        reportReadyFindings.length > 0 && savedReports.length > 0
          ? checkoutReadyPlans > 0
            ? "live"
            : "partial"
          : reportReadyFindings.length > 0
            ? "partial"
            : "missing",
      route: "/violations",
      icon: ShieldCheck,
    },
    {
      lane: "Pro se Case Builder",
      buyer: "Self-represented litigants and families",
      whyNow:
        "The access-to-justice gap is massive. The sellable job is not legal magic; it is turning panic files into a coherent record packet.",
      proofToShow:
        "Before/after one-case packet: uploads, timeline, issue map, missing-record demands, plain-English next actions, and source appendix.",
      firstAsk:
        "Upload one narrow issue set and verify whether the exported packet is understandable without app context.",
      priceMotion: "$99/month Case Builder or $149 one-case packet.",
      blocker:
        savedReports.length > 0
          ? "Tighten onboarding, disclaimers, and refund-safe limits."
          : "Generate one real uploaded-source report, then test it with a stranger.",
      status:
        readyDocuments.length > 0 && savedReports.length > 0
          ? "live"
          : readyDocuments.length > 0 || reportReadyFindings.length > 0
            ? "partial"
            : "missing",
      route: "/reports",
      icon: Scale,
    },
    {
      lane: "Clinic intake accelerator",
      buyer: "Legal-aid intake lead, clinic director, A2J program manager",
      whyNow:
        "Legal-aid overload is a workflow problem before it is a drafting problem. Buyers need faster reviewer handoff, not aggressive pleadings.",
      proofToShow:
        "Attorney handoff packet with facts, adverse facts, deadlines, missing records, issue screen, and what the system excluded.",
      firstAsk:
        "Run three anonymized intake packets and time the reviewer before and after DueProcess.",
      priceMotion: "$750-$2,500 clinic pilot or sponsored workspace.",
      blocker:
        "Needs reviewer notes, staff roles, intake templates, and time-saved measurement.",
      status: readyDocuments.length > 0 ? "partial" : "missing",
      route: "/dashboard",
      icon: Landmark,
    },
    {
      lane: "Defense / post-conviction review",
      buyer: "Defense investigator, habeas counsel, innocence team",
      whyNow:
        "Public defense and post-conviction work is drowning in transcripts, digital discovery, competency records, and procedural deadlines.",
      proofToShow:
        "Transcript/Brady/writ review with chronology, Brady/Napue tracker, competency gap map, speedy-trial posture, and mandamus gate.",
      firstAsk:
        "Process one transcript/order/discovery bundle and compare the gap map to manual review.",
      priceMotion: "$499-$2,500 matter review depending on page volume.",
      blocker:
        bradyFindings.length > 0 || writFindings.length > 0
          ? "Export a doctrine-specific saved packet and verify authority posture."
          : "Run a transcript/order proof set through Legal Analysis.",
      status:
        bradyFindings.length > 0 || writFindings.length > 0
          ? "partial"
          : "missing",
      route: "/sector/arsenal",
      icon: FileSearch,
    },
    {
      lane: "Watchdog evidence ledger",
      buyer: "Investigative editor, public-records researcher, watchdog lead",
      whyNow:
        "Investigators need checkable ledgers with actors, dates, quotes, gaps, and record requests. They do not need legal conclusions pretending to be reporting.",
      proofToShow:
        "Source-led evidence ledger with dates, actors, quotes, contradiction signals, file IDs, and public-records targets.",
      firstAsk:
        "Turn one public-records batch into a timeline, actor map, contradiction list, and missing-record list.",
      priceMotion: "$1,500-$5,000 project workspace or archive/API contract.",
      blocker:
        "Needs public/private archive controls, tenant-safe API keys, webhooks, and SDK packaging.",
      status:
        anchoredFindings.length > 0 && savedReports.length > 0
          ? "partial"
          : anchoredFindings.length > 0
            ? "partial"
            : "missing",
      route: "/violations",
      icon: SearchCheck,
    },
  ];

  const revenuePipelineLanes: RevenuePipelineLane[] = [
    {
      lane: "One-case packet sale",
      buyer: "Pro se litigant or family support team",
      status:
        readyDocuments.length > 0 && savedReports.length > 0
          ? "live"
          : readyDocuments.length > 0 || reportReadyFindings.length > 0
            ? "partial"
            : "missing",
      proofSignal: `${formatNumber(readyDocuments.length)} ready documents, ${formatNumber(reportReadyFindings.length)} report-ready findings, ${formatNumber(savedReports.length)} saved reports.`,
      sellableArtifact:
        "Plain-English case packet with timeline, issue map, missing-record demands, source appendix, and exportable PDF/DOCX.",
      firstCloseMotion:
        "Sell a narrow before/after packet, not unlimited legal AI access.",
      revenuePath: "$149 one-case packet or $99/month Case Builder.",
      blockingGap:
        savedReports.length > 0
          ? "Needs stranger test, refund-safe boundaries, and sharper onboarding."
          : "No real upload-to-export packet exists yet, so the value proof is still incomplete.",
      nextProductAction:
        savedReports.length > 0
          ? "Put the best exported packet in front of a non-technical user and see where they get confused."
          : "Run one selected-file proof set through Reports and save/export the packet.",
      route: "/reports",
      icon: Scale,
    },
    {
      lane: "Civil-rights firm pilot",
      buyer: "Owner attorney, investigator, paralegal lead",
      status:
        reportReadyFindings.length > 0 && checkoutReadyPlans > 0
          ? "live"
          : reportReadyFindings.length > 0 || checkoutReadyPlans > 0
            ? "partial"
            : "missing",
      proofSignal: `${formatNumber(reportReadyFindings.length)} report-ready findings, ${formatNumber(monellFindings.length)} Monell-pattern signals, ${formatNumber(checkoutReadyPlans)} checkout plans.`,
      sellableArtifact:
        "Partner-facing leverage memo with ranked claims, Monell gaps, adverse facts, immunity route, missing records, and source appendix.",
      firstCloseMotion:
        "Offer one closed or low-risk discovery review and compare against manual attorney review.",
      revenuePath:
        "$499-$1,500 pilot matter, then $199/month firm base plus usage.",
      blockingGap:
        checkoutReadyPlans > 0
          ? "Needs one discovery-heavy proof run with attorney time-saved measurement and usage alerts tested."
          : "Firm checkout, tier limits, and server-side billing enforcement are not close-proof yet.",
      nextProductAction:
        reportReadyFindings.length > 0
          ? "Generate a civil-rights leverage memo export and record how long manual review would have taken."
          : "Run Legal Analysis on discovery-heavy selected files until the violation ledger has usable findings.",
      route: "/violations",
      icon: ShieldCheck,
    },
    {
      lane: "Mandamus / urgent writ packet",
      buyer: "Defense, post-conviction, or stuck-case pro se user",
      status:
        writReports.length > 0
          ? "live"
          : writFindings.length > 0 || missingRecords > 0
            ? "partial"
            : "missing",
      proofSignal: `${formatNumber(writFindings.length)} writ signals, ${formatNumber(writReports.length)} writ-style reports, ${formatNumber(missingRecords)} missing-record demands.`,
      sellableArtifact:
        "Writ viability packet with FILE_WRIT / DEMAND_RECORDS_FIRST / PRESERVE_FOR_APPEAL / NOT_MANDAMUS routing and appendix checklist.",
      firstCloseMotion:
        "Sell urgency and clarity: is this a writ, a records demand, appeal preservation, or no-go?",
      revenuePath: "$149 urgent one-case packet or $499-$2,500 matter review.",
      blockingGap:
        writReports.length > 0
          ? "Needs human legal review of the petition scaffold and authority posture."
          : "Mandamus findings exist only as signals until a saved writ report proves the route cleanly.",
      nextProductAction:
        writFindings.length > 0 || missingRecords > 0
          ? "Generate a mandamus/writ report and verify it does not treat missing records as proven misconduct."
          : "Run selected-file analysis on orders, docket entries, transcripts, and unanswered filings.",
      route: "/reports",
      icon: FileCheck,
    },
    {
      lane: "Clinic intake accelerator",
      buyer: "Legal-aid or law-clinic intake lead",
      status: readyDocuments.length > 0 ? "partial" : "missing",
      proofSignal: `${formatNumber(readyDocuments.length)} ready sources and ${formatNumber(blockedFindings.length)} blocked findings available for reviewer-safe handoff proof.`,
      sellableArtifact:
        "Attorney handoff packet with facts, adverse facts, deadlines, missing records, issue screen, exclusions, and reviewer notes.",
      firstCloseMotion:
        "Ask for three anonymized intakes and measure reviewer time before/after.",
      revenuePath: "$750-$2,500 clinic pilot or sponsored workspace.",
      blockingGap:
        "Needs intake templates, staff roles, reviewer notes, and time-saved measurement before this is credible procurement.",
      nextProductAction:
        "Add a reviewer handoff mode that emphasizes triage, adverse facts, and what the system refused to claim.",
      route: "/dashboard",
      icon: Landmark,
    },
    {
      lane: "Archive / API workspace",
      buyer: "Watchdog, public-records team, legal-tech integrator",
      status:
        anchoredFindings.length > 0 && savedReports.length > 0
          ? exactUsageEnabled
            ? "partial"
            : "partial"
          : "missing",
      proofSignal: `${formatNumber(anchoredFindings.length)} anchored findings, ${formatNumber(savedReports.length)} saved packets, exact telemetry ${exactUsageEnabled ? "on" : "off"}.`,
      sellableArtifact:
        "Source-led evidence ledger plus ingest/search/timeline/violation API with tenant-safe keys, callbacks, and SDK examples.",
      firstCloseMotion:
        "Sell one project workspace or archive integration, not broad SaaS seats.",
      revenuePath: "$1,500-$5,000 project workspace or custom API contract.",
      blockingGap:
        "Needs multi-tenant API key scoping, webhooks, SDK packaging, and public/private archive controls.",
      nextProductAction:
        "Build the integration contract: tenant namespace, ingest completion webhook, and typed JS client.",
      route: "/settings",
      icon: Workflow,
    },
  ];

  const civilRightsCloseScore =
    (readyDocuments.length > 0 ? 10 : 0) +
    (anchoredFindings.length > 0 ? 15 : 0) +
    (reportReadyFindings.length > 0 ? 20 : 0) +
    (monellFindings.length > 0 ? 15 : 0) +
    (savedReports.length > 0 ? 15 : 0) +
    (checkoutReadyPlans > 0 ? 15 : 0) +
    (snapshotUsagePoints > 0 || exactUsageCalls > 0 ? 10 : 0);
  const proSeCloseScore =
    (readyDocuments.length > 0 ? 20 : 0) +
    (anchoredFindings.length > 0 ? 15 : 0) +
    (reportReadyFindings.length > 0 ? 20 : 0) +
    (savedReports.length > 0 ? 25 : 0) +
    (checkoutReadyPlans > 0 || billingLive ? 10 : 0) +
    (blockedFindings.length >= 0 && qcTouchedFindings.length > 0 ? 10 : 0);
  const clinicCloseScore =
    (readyDocuments.length > 0 ? 20 : 0) +
    (qcTouchedFindings.length > 0 ? 20 : 0) +
    (reportReadyFindings.length > 0 ? 15 : 0) +
    (savedReports.length > 0 ? 15 : 0) +
    (blockedFindings.length > 0 ? 10 : 0);
  const defenseCloseScore =
    (readyDocuments.length > 0 ? 15 : 0) +
    (bradyFindings.length > 0 ? 20 : 0) +
    (timelineFindings.length > 0 ? 15 : 0) +
    (writFindings.length > 0 ? 15 : 0) +
    (reportReadyFindings.length > 0 ? 15 : 0) +
    (savedReports.length > 0 ? 20 : 0);
  const mandamusCloseScore =
    (readyDocuments.length > 0 ? 10 : 0) +
    (writFindings.length > 0 ? 25 : 0) +
    (missingRecords > 0 ? 10 : 0) +
    (reportReadyFindings.length > 0 ? 15 : 0) +
    (writReports.length > 0 ? 30 : 0) +
    (savedReports.length > 0 ? 10 : 0);
  const watchdogCloseScore =
    (readyDocuments.length > 0 ? 10 : 0) +
    (anchoredFindings.length > 0 ? 25 : 0) +
    (timelineFindings.length > 0 ? 15 : 0) +
    (savedReports.length > 0 ? 20 : 0) +
    (exactUsageEnabled ? 10 : 0) +
    (snapshotUsagePoints > 0 ? 10 : 0);
  const apiCloseScore =
    (anchoredFindings.length > 0 ? 15 : 0) +
    (savedReports.length > 0 ? 15 : 0) +
    (exactUsageEnabled ? 15 : 0) +
    (checkoutReadyPlans > 0 ? 10 : 0) +
    (monitorChecks.length > 0 && monitorErrors === 0 ? 10 : 0);

  const closePlaybooks: ClosePlaybook[] = [
    {
      lane: "Civil-rights reviewer packet",
      beneficiary:
        "Civil-rights attorney, investigator, paralegal, or clinic reviewer",
      status: closeReadinessFromScore(civilRightsCloseScore),
      openingLine:
        "Send one closed or low-risk discovery set. DueProcess returns a source-bound leverage memo showing what is supported, what is missing, what is risky, and what should not be alleged yet.",
      qualifyWith: [
        "Is the record large enough that manual review is delaying strategy?",
        "Do you need Monell, immunity, retaliation, or discovery-gap routing?",
        "Can the team compare the output against what a human reviewer already found?",
      ],
      showFirst:
        "Civil-rights leverage memo with ranked findings, Monell gaps, adverse facts, missing records, QC status, and source appendix.",
      sustainabilityPath:
        "$499-$1,500 pilot review, then firm base plus usage only after the proof packet saves review time.",
      successMetric:
        "Attorney or senior reviewer can use the packet to find, confirm, or reject issue paths faster than manual review.",
      doNotLaunchUntil:
        savedReports.length > 0 && reportReadyFindings.length > 0
          ? "Human reviewer still verifies authority, local rules, and adverse facts before any filing."
          : "No outreach until a civil-rights leverage memo export exists with source anchors and blocked-claim visibility.",
      route: "/violations",
      icon: ShieldCheck,
    },
    {
      lane: "Pro se Case Builder",
      beneficiary:
        "Self-represented litigant, family support team, jail-support helper",
      status: closeReadinessFromScore(proSeCloseScore),
      openingLine:
        "Bring the messy record. DueProcess turns it into a plain-English packet with timeline, issue map, missing records, source appendix, and careful next actions.",
      qualifyWith: [
        "Can the user narrow the first run to one issue or date range?",
        "Are uploads private and processed enough for analysis?",
        "Can a non-lawyer understand the exported packet without a walkthrough?",
      ],
      showFirst:
        "Before/after one-case packet with source appendix and clear limits.",
      sustainabilityPath:
        "$99/month Case Builder or $149 one-case packet only after support and refund boundaries are clear.",
      successMetric:
        "A non-lawyer can understand the packet, see its limits, and know the next records to request.",
      doNotLaunchUntil:
        savedReports.length > 0
          ? "Run stranger testing and fix confusing language, support expectations, and refund boundaries."
          : "No broad pro se launch until one real upload-to-export packet survives stranger testing.",
      route: "/reports",
      icon: Scale,
    },
    {
      lane: "Legal aid / clinic intake",
      beneficiary:
        "Clinic director, legal-aid intake lead, supervised student team",
      status: closeReadinessFromScore(clinicCloseScore),
      openingLine:
        "Use it as intake compression, not replacement counsel: facts, adverse facts, deadlines, missing records, exclusions, and reviewer notes.",
      qualifyWith: [
        "Do you process repeat intake packets?",
        "Can three anonymized intakes be timed before and after?",
        "Who is the human reviewer responsible for final triage?",
      ],
      showFirst:
        "Reviewer handoff packet with adverse facts, deadlines, missing records, exclusions, and what the system refused to claim.",
      sustainabilityPath:
        "$750-$2,500 clinic pilot or sponsored workspace after reviewer-time savings are measured.",
      successMetric:
        "Reviewer time decreases while overclaims and unsupported factual claims remain blocked.",
      doNotLaunchUntil:
        "Reviewer notes, staff roles, non-lawyer boundaries, and time-saved measurement exist.",
      route: "/dashboard",
      icon: Landmark,
    },
    {
      lane: "Defense / writ review",
      beneficiary:
        "Defense investigator, habeas counsel, innocence team, or stuck-case reviewer",
      status: closeReadinessFromScore(defenseCloseScore),
      openingLine:
        "Upload transcripts, orders, discovery, and competency records. The packet maps Brady/Napue risk, timeline gaps, speedy-trial posture, and writ routes.",
      qualifyWith: [
        "Are transcripts, orders, and discovery already processed?",
        "Is the issue Brady, competency, speedy trial, detention, or mandamus?",
        "Can the team compare against an existing manual gap map?",
      ],
      showFirst:
        "Defense transcript and writ review with Brady tracker, competency gap map, speedy-trial posture, and mandamus route labels.",
      sustainabilityPath:
        "$499-$2,500 matter review depending on volume, with authority verification before filing use.",
      successMetric:
        "Reviewer sees missing records and writ/no-writ posture faster, without turning gaps into allegations.",
      doNotLaunchUntil:
        writReports.length > 0 || bradyFindings.length > 0
          ? "Doctrine-specific export must still get human authority verification."
          : "Run selected-file analysis on transcripts, orders, discovery, and competency records first.",
      route: "/sector/arsenal",
      icon: FileSearch,
    },
    {
      lane: "Watchdog evidence ledger",
      beneficiary:
        "Investigative editor, public-records researcher, watchdog team",
      status: closeReadinessFromScore(watchdogCloseScore),
      openingLine:
        "This is not a legal conclusion machine. It turns public-record batches into checkable actor/date/source/quote ledgers and missing-record targets.",
      qualifyWith: [
        "Is the record public or safe to publish?",
        "Does the team need a timeline, actor map, contradiction list, or request list?",
        "What material must stay private or redacted?",
      ],
      showFirst:
        "Source-led evidence ledger with dates, actors, quotes, contradictions, missing records, and export controls.",
      sustainabilityPath:
        "$1,500-$5,000 project workspace or archive contract after public/private controls are clear.",
      successMetric:
        "An external reader can verify the ledger against source quotes and file IDs.",
      doNotLaunchUntil:
        "Public/private controls, redaction posture, and export format are clear.",
      route: "/violations",
      icon: SearchCheck,
    },
    {
      lane: "Archive / API integration",
      beneficiary:
        "Legal-tech builder, civic-data team, archive owner, integration partner",
      status: closeReadinessFromScore(apiCloseScore),
      openingLine:
        "Use DueProcess as source-bound ingest and analysis infrastructure: documents in, searchable ledger/timeline/violations out.",
      qualifyWith: [
        "Does each tenant need a separate case/project namespace?",
        "Do ingest jobs need completion webhooks?",
        "Which client needs SDK examples first?",
      ],
      showFirst:
        "One external client ingesting a document and retrieving a source-bound result plus timeline/violation data.",
      sustainabilityPath:
        "$1,500-$5,000 project workspace or custom API contract after tenant boundaries and callbacks exist.",
      successMetric:
        "External client can ingest, poll or receive callback, and fetch source-bound records without direct database access.",
      doNotLaunchUntil:
        "Tenant-scoped API keys, webhooks, SDK packaging, and entitlement boundaries are defined.",
      route: "/settings",
      icon: Workflow,
    },
  ];

  const buyerCloseSignals: BuyerCloseSignal[] = [
    {
      lane: "Civil-rights firm pilot",
      buyer: "Owner attorney, investigator, paralegal lead",
      marketNeed:
        "Professional AI buyers are moving toward AI workflow, but the close depends on governance, confidence, ROI, and reviewable work product.",
      source: "Thomson Reuters 2026 AI in Professional Services",
      href: "https://www.thomsonreuters.com/en/reports/2026-ai-in-professional-services-report",
      productAnswer:
        "A source-bound civil-rights leverage memo with Monell gaps, immunity routing, adverse facts, missing records, and exportable appendix.",
      proofArtifact:
        "One discovery-heavy closed-matter memo compared against manual attorney review time.",
      evidenceInWorkspace: `${formatNumber(reportReadyFindings.length)} report-ready findings, ${formatNumber(monellFindings.length)} Monell-pattern signals, ${formatNumber(savedReports.length)} saved packets, ${formatNumber(checkoutReadyPlans)} checkout-ready plans.`,
      closeScore: civilRightsCloseScore,
      closeReadiness: closeReadinessFromScore(civilRightsCloseScore),
      firstCloseAction:
        civilRightsCloseScore >= 80
          ? "Run the first paid pilot and measure attorney-review time saved."
          : "Generate one civil-rights leverage memo export, then finish firm checkout and usage alerts.",
      route: "/violations",
      icon: ShieldCheck,
    },
    {
      lane: "Pro se Case Builder",
      buyer: "Self-represented litigants and support teams",
      marketNeed:
        "The access-to-justice gap is massive; the useful job is turning scattered records into a coherent, court-safe packet.",
      source: "LSC Justice Gap executive summary",
      href: "https://justicegap.lsc.gov/resource/executive-summary/",
      productAnswer:
        "Guided upload, OCR readiness, plain-English timeline, issue map, missing-record demands, and source appendix export.",
      proofArtifact:
        "Before/after one-case packet a non-lawyer can understand without a live walkthrough.",
      evidenceInWorkspace: `${formatNumber(readyDocuments.length)} ready documents, ${formatNumber(reportReadyFindings.length)} report-ready findings, ${formatNumber(savedReports.length)} saved reports.`,
      closeScore: proSeCloseScore,
      closeReadiness: closeReadinessFromScore(proSeCloseScore),
      firstCloseAction:
        proSeCloseScore >= 80
          ? "Put the exported packet in front of a stranger and fix every confusion point."
          : "Finish one real upload-to-export proof run and make the limits/refund boundary obvious.",
      route: "/reports",
      icon: Scale,
    },
    {
      lane: "Legal aid / clinic intake",
      buyer: "Intake lead, clinic director, access-to-justice manager",
      marketNeed:
        "Legal-aid organizations are capacity constrained; intake compression and safer attorney handoff are more sellable than aggressive drafting.",
      source: "LSC grantees and technology programs",
      href: "https://www.lsc.gov/grants/our-grantees",
      productAnswer:
        "Reviewer handoff packet with source facts, adverse facts, deadlines, missing records, excluded claims, and staff notes.",
      proofArtifact:
        "Three anonymized intakes showing time saved and what the system refused to overclaim.",
      evidenceInWorkspace: `${formatNumber(readyDocuments.length)} ready sources, ${formatNumber(qcTouchedFindings.length)} QC-touched findings, ${formatNumber(blockedFindings.length)} blocked findings.`,
      closeScore: clinicCloseScore,
      closeReadiness: closeReadinessFromScore(clinicCloseScore),
      firstCloseAction:
        "Build the clinic reviewer handoff mode: staff notes, adverse-fact checklist, and before/after timing.",
      route: "/dashboard",
      icon: Landmark,
    },
    {
      lane: "Defense / post-conviction review",
      buyer: "Defense investigator, habeas counsel, innocence team",
      marketNeed:
        "Defense and post-conviction work is transcript-heavy, discovery-heavy, and deadline-sensitive.",
      source: "RAND National Public Defense Workload Study",
      href: "https://www.rand.org/pubs/research_reports/RRA2559-1.html",
      productAnswer:
        "Transcript/order/discovery review with Brady/Napue tracker, competency gaps, speedy-trial posture, timeline, and writ routing.",
      proofArtifact:
        "One transcript-order-discovery bundle compared against a manual gap map.",
      evidenceInWorkspace: `${formatNumber(bradyFindings.length)} Brady/discovery signals, ${formatNumber(timelineFindings.length)} timeline signals, ${formatNumber(writFindings.length)} writ signals.`,
      closeScore: defenseCloseScore,
      closeReadiness: closeReadinessFromScore(defenseCloseScore),
      firstCloseAction:
        defenseCloseScore >= 80
          ? "Export a doctrine-specific packet and do authority verification on every court-facing section."
          : "Run selected-file analysis on transcripts, orders, discovery, and competency records.",
      route: "/sector/arsenal",
      icon: FileSearch,
    },
    {
      lane: "Mandamus / urgent writ packet",
      buyer: "Stuck-case pro se user, appellate counsel, defense team",
      marketNeed:
        "Urgent-relief buyers need a fast no-bullshit answer: writ, records-first, preserve for appeal, or no-go.",
      source: "ABA AI ethics plus Nevada writ workflow guardrails",
      href: "https://www.americanbar.org/content/dam/aba/administrative/professional_responsibility/ethics-opinions/aba-formal-opinion-512.pdf",
      productAnswer:
        "Mandamus element matrix, route classification, appendix checklist, clear-duty gate, ordinary-remedy gate, and guarded petition scaffold.",
      proofArtifact:
        "Saved mandamus report showing FILE_WRIT / DEMAND_RECORDS_FIRST / PRESERVE_FOR_APPEAL / NOT_MANDAMUS lanes.",
      evidenceInWorkspace: `${formatNumber(writFindings.length)} writ signals, ${formatNumber(writReports.length)} writ reports, ${formatNumber(missingRecords)} missing-record demands.`,
      closeScore: mandamusCloseScore,
      closeReadiness: closeReadinessFromScore(mandamusCloseScore),
      firstCloseAction:
        writReports.length > 0
          ? "Human-review the petition scaffold and authority posture before selling urgent filing support."
          : "Generate a mandamus report from orders, docket gaps, refused filings, or missing findings.",
      route: "/reports",
      icon: FileCheck,
    },
    {
      lane: "Watchdog evidence ledger",
      buyer: "Investigative editor, public-records researcher, watchdog lead",
      marketNeed:
        "Investigators need checkable source ledgers, timelines, actors, contradictions, and records to demand without pretending every signal is a legal conclusion.",
      source: "MuckRock / public-records workflow",
      href: "https://www.muckrock.com/",
      productAnswer:
        "Evidence ledger with actor/date/source/quote mapping, contradiction signals, missing-record targets, and public/private export controls.",
      proofArtifact:
        "Public-records batch converted into a source-led ledger that can be checked outside the app.",
      evidenceInWorkspace: `${formatNumber(anchoredFindings.length)} anchored findings, ${formatNumber(timelineFindings.length)} timeline signals, ${formatNumber(savedReports.length)} saved packets.`,
      closeScore: watchdogCloseScore,
      closeReadiness: closeReadinessFromScore(watchdogCloseScore),
      firstCloseAction:
        "Export one source-led ledger and separate investigative facts from legal conclusions.",
      route: "/violations",
      icon: SearchCheck,
    },
    {
      lane: "Archive / API integration",
      buyer: "Legal-tech builder, civic-data team, archive owner",
      marketNeed:
        "Integration buyers need tenant-safe ingestion, search, timelines, violations, callbacks, and predictable usage boundaries.",
      source: "OpenAPI / MCP integration demand",
      href: "https://www.openapis.org/",
      productAnswer:
        "Tenant-scoped API workspace with ingest, source ledger, violations, timeline, webhook callbacks, SDK examples, and usage telemetry.",
      proofArtifact:
        "One external client ingesting a document and receiving a source-bound result plus completion callback.",
      evidenceInWorkspace: `${formatNumber(anchoredFindings.length)} anchored findings, exact telemetry ${exactUsageEnabled ? "on" : "off"}, ${formatNumber(monitorChecks.length)} monitor checks.`,
      closeScore: apiCloseScore,
      closeReadiness: closeReadinessFromScore(apiCloseScore),
      firstCloseAction:
        "Define tenant namespace, ingest-complete webhook, typed JS client, and entitlement boundaries.",
      route: "/settings",
      icon: Workflow,
    },
  ];
  const topBuyerCloseSignal =
    buyerCloseSignals
      .slice()
      .sort((left, right) => right.closeScore - left.closeScore)[0] ??
    buyerCloseSignals[0];
  const closeAverageScore = Math.round(
    buyerCloseSignals.reduce((sum, signal) => sum + signal.closeScore, 0) /
      buyerCloseSignals.length
  );
  const liveCloseSignals = buyerCloseSignals.filter(
    signal => signal.closeReadiness === "live"
  ).length;

  const firstCustomerConversations: FirstCustomerConversation[] = [
    {
      rank: 1,
      channel: "Police accountability and civil-rights firms",
      buyer: "Owner attorney, investigator, paralegal lead",
      count: 8,
      status:
        reportReadyFindings.length > 0 && savedReports.length > 0
          ? checkoutReadyPlans > 0
            ? "live"
            : "partial"
          : "missing",
      source: "NPAP / NELA / plaintiff-side civil-rights networks",
      href: "https://nationalpoliceaccountability.org/",
      openingAsk:
        "Send one closed or low-risk discovery set; we return a source-bound leverage memo and compare it to what your team already found.",
      showArtifact:
        "Civil-rights leverage memo with Monell gaps, immunity routing, adverse facts, missing records, QC status, and PDF/DOCX source appendix.",
      conversionTrigger:
        "The attorney says the packet found or clarified issues faster than a manual first pass.",
      blocker:
        checkoutReadyPlans > 0
          ? "Needs one paid checkout and usage-alert smoke."
          : "Firm checkout, tier limits, usage alerts, and billing telemetry must be real.",
      route: "/violations",
      icon: ShieldCheck,
    },
    {
      rank: 2,
      channel: "Legal-aid and clinic intake teams",
      buyer: "Clinic director, legal-aid intake lead, A2J manager",
      count: 6,
      status:
        readyDocuments.length > 0 && reportReadyFindings.length > 0
          ? "partial"
          : "missing",
      source: "LSC grantees and legal-aid technology programs",
      href: "https://www.lsc.gov/grants/our-grantees",
      openingAsk:
        "Run three anonymized intakes and measure whether attorney review is faster, safer, and less repetitive.",
      showArtifact:
        "Clinic handoff packet with source facts, adverse facts, deadlines, missing records, issue screen, excluded claims, and reviewer notes.",
      conversionTrigger:
        "A reviewer can triage faster and see exactly what the tool refused to overclaim.",
      blocker:
        "Needs reviewer notes, staff roles, intake templates, time-saved measurement, and non-lawyer guidance boundaries.",
      route: "/dashboard",
      icon: Landmark,
    },
    {
      rank: 3,
      channel: "Defense, habeas, and innocence teams",
      buyer: "Defense investigator, habeas counsel, innocence team",
      count: 5,
      status:
        anchoredFindings.length > 0 && missingRecords > 0
          ? "partial"
          : "missing",
      source: "NLADA defenders / Innocence Network / RAND workload evidence",
      href: "https://innocencenetwork.org/directory",
      openingAsk:
        "Process one transcript, order, discovery, or competency bundle and compare the gap map against manual review.",
      showArtifact:
        "Defense packet with Brady/Napue tracker, competency gaps, speedy-trial posture, timeline, writ route, and missing-record demands.",
      conversionTrigger:
        "Counsel or investigator can use the packet to decide what record, motion, or writ route comes next.",
      blocker:
        "Needs doctrine-specific templates, selected-file proof runs, and legal-authority verification before hard selling.",
      route: "/sector/arsenal",
      icon: FileSearch,
    },
    {
      rank: 4,
      channel: "Pro se support and law-library ecosystems",
      buyer: "Self-represented litigant, family helper, law-library staff",
      count: 5,
      status:
        readyDocuments.length > 0 && savedReports.length > 0
          ? "partial"
          : "missing",
      source: "LSC legal-help locator and Justice Gap demand",
      href: "https://www.lsc.gov/about-lsc/what-legal-aid/i-need-legal-help",
      openingAsk:
        "Upload one narrow issue set and see whether the output makes the record understandable without founder walkthrough.",
      showArtifact:
        "Before/after one-case packet: timeline, issue map, missing-record list, plain-English limits, and source appendix.",
      conversionTrigger:
        "A non-lawyer can explain the packet back accurately and understands what it is not proving.",
      blocker:
        "Needs onboarding, support limits, disclaimers, refund-safe boundaries, and private-upload limits.",
      route: "/reports",
      icon: Scale,
    },
    {
      rank: 5,
      channel: "Watchdogs and public-records teams",
      buyer: "Investigative editor, public-records researcher, watchdog lead",
      count: 3,
      status:
        anchoredFindings.length > 0 && savedReports.length > 0
          ? "partial"
          : "missing",
      source: "MuckRock and public-records workflow",
      href: "https://www.muckrock.com/",
      openingAsk:
        "Turn one public-records batch into a source-led ledger and a records-still-missing list.",
      showArtifact:
        "Evidence ledger with dates, actors, source quotes, contradiction signals, file IDs, missing-record requests, and export controls.",
      conversionTrigger:
        "An outside reader can verify the ledger against the source quotes and file IDs.",
      blocker:
        "Needs public/private controls, redaction posture, archive packaging, and export format clarity.",
      route: "/violations",
      icon: SearchCheck,
    },
    {
      rank: 6,
      channel: "Archive and API integration partners",
      buyer: "Legal-tech builder, civic-data team, document archive owner",
      count: 3,
      status:
        savedReports.length > 0 && exactUsageEnabled ? "partial" : "missing",
      source: "OpenAPI / MCP integration workflow",
      href: "https://www.openapis.org/",
      openingAsk:
        "Point one external archive at the ingest flow and retrieve source-bound documents, violations, timeline, and report metadata.",
      showArtifact:
        "API demo with ingest job, source ledger, violation taxonomy, timeline endpoint, webhook callback, SDK example, and usage telemetry.",
      conversionTrigger:
        "External client can ingest, track completion, and fetch source-bound results without touching the database.",
      blocker:
        "Needs tenant-scoped keys, webhooks, SDK packaging, entitlement boundaries, and usage limits.",
      route: "/settings",
      icon: Workflow,
    },
  ];
  const firstConversationCount = firstCustomerConversations.reduce(
    (sum, conversation) => sum + conversation.count,
    0
  );
  const firstConversationReadyCount = firstCustomerConversations.filter(
    conversation => conversation.status !== "missing"
  ).length;

  const acquisitionTargets: AcquisitionTarget[] = [
    {
      rank: 1,
      segment: "Small civil-rights firms",
      buyer: "Owner attorney, senior associate, investigator, paralegal lead",
      status:
        reportReadyFindings.length > 0 && savedReports.length > 0
          ? checkoutReadyPlans > 0
            ? "live"
            : "partial"
          : reportReadyFindings.length > 0
            ? "partial"
            : "missing",
      urgency:
        "They already pay for review hours. A ranked leverage memo with source quotes can be sold as time saved and missed-claim insurance.",
      whereToFind:
        "State and local plaintiff/civil-rights bars, Section 1983 practitioners, litigation investigators, public-interest referral networks.",
      firstAsk:
        "Let DueProcess process one closed or low-risk discovery set and compare its issue map against what the team already found.",
      proofArtifact:
        "Partner-facing leverage memo: top claims, Monell gaps, adverse facts, missing records, QC status, source appendix, PDF/DOCX export.",
      priceTest:
        "$499-$1,500 pilot matter; convert to $199/mo firm base plus usage.",
      blocker:
        checkoutReadyPlans > 0
          ? "Needs one live paid checkout and usage alert smoke."
          : "Firm checkout, tier limits, and usage billing need to be real before serious outreach.",
      route: "/violations",
      icon: ShieldCheck,
    },
    {
      rank: 2,
      segment: "Pro se case builders",
      buyer: "Self-represented litigants, families, jail-support teams",
      status:
        readyDocuments.length > 0 && savedReports.length > 0
          ? "live"
          : readyDocuments.length > 0 || reportReadyFindings.length > 0
            ? "partial"
            : "missing",
      urgency:
        "The access gap is massive, and these users need a guided packet more than another blank chatbot box.",
      whereToFind:
        "Court self-help ecosystems, law libraries, legal-aid referral overflow, family support groups, pro se communities.",
      firstAsk:
        "Upload one narrow issue set and see if the app can produce a plain-English timeline, gap list, and report-ready packet.",
      proofArtifact:
        "Before/after packet: raw filings into timeline, issue map, missing-record demands, source appendix, and court-safe export.",
      priceTest: "$99/mo Case Builder or $149 one-case packet.",
      blocker:
        savedReports.length > 0
          ? "Needs clearer onboarding, scope disclaimers, and refund-safe limits."
          : "Needs a complete user-like upload-to-export proof run.",
      route: "/reports",
      icon: Scale,
    },
    {
      rank: 3,
      segment: "Legal aid and clinics",
      buyer: "Clinic director, legal-aid intake lead, A2J program manager",
      status:
        readyDocuments.length > 0 && blockedFindings.length >= 0
          ? "partial"
          : "missing",
      urgency:
        "They have too much intake and too little attorney time; triage packets are more believable than full legal drafting.",
      whereToFind:
        "LSC-funded organizations, law-school clinics, state access-to-justice commissions, pro bono coordinators.",
      firstAsk:
        "Run three anonymized intake packets and measure whether attorney review is faster and safer.",
      proofArtifact:
        "Attorney handoff packet: facts, adverse facts, missing records, deadlines, issue screen, and what was excluded.",
      priceTest: "$750-$2,500 clinic pilot or sponsored workspace.",
      blocker:
        "Needs reviewer notes, staff roles, intake templates, time-saved measurement, and better non-lawyer guidance.",
      route: "/dashboard",
      icon: Landmark,
    },
    {
      rank: 4,
      segment: "Public defense and post-conviction",
      buyer: "Defense investigator, habeas counsel, innocence team",
      status:
        anchoredFindings.length > 0 && missingRecords > 0
          ? "partial"
          : anchoredFindings.length > 0
            ? "partial"
            : "missing",
      urgency:
        "The record burden is ugly: transcripts, competency, Brady, speedy-trial, jail logs, and missing records scattered everywhere.",
      whereToFind:
        "Public defender associations, innocence projects, mitigation investigators, post-conviction counsel, habeas clinics.",
      firstAsk:
        "Process one transcript/order/discovery bundle and compare the timeline, gaps, and writ/remedy routing to manual review.",
      proofArtifact:
        "Doctrine-specific packet: Brady/Napue tracker, competency gap map, speedy-trial clock, writ gate, missing-record demands.",
      priceTest: "$499-$2,500 matter review depending on page volume.",
      blocker:
        "Needs more doctrine-specific templates and authority verification before this can be sold hard.",
      route: "/sector/arsenal",
      icon: FileSearch,
    },
    {
      rank: 5,
      segment: "Watchdogs and investigative desks",
      buyer: "Investigative editor, public-records researcher, watchdog lead",
      status:
        anchoredFindings.length > 0 && savedReports.length > 0
          ? "partial"
          : anchoredFindings.length > 0
            ? "partial"
            : "missing",
      urgency:
        "They need checkable evidence ledgers, not legal conclusions; source-bound timelines are a clean wedge.",
      whereToFind:
        "Local investigative nonprofits, public-records groups, accountability reporters, civic tech and FOIA communities.",
      firstAsk:
        "Turn one public-records batch into a timeline, actor map, contradiction list, and records still missing.",
      proofArtifact:
        "Publishable ledger with dates, actors, source quotes, file IDs, missing-record requests, and public/private export controls.",
      priceTest: "$1,500-$5,000 project workspace.",
      blocker:
        "Needs public/private controls, multi-tenant keys, webhooks, and archive packaging for serious adoption.",
      route: "/reports",
      icon: SearchCheck,
    },
    {
      rank: 6,
      segment: "API and archive integrators",
      buyer: "Legal-tech builders, civic-data teams, document archive owners",
      status:
        savedReports.length > 0 && exactUsageEnabled ? "partial" : "missing",
      urgency:
        "Infrastructure buyers care about ingest, taxonomy, timeline, search, webhooks, SDKs, and tenant-safe keys.",
      whereToFind:
        "Legal-tech agencies, open-data groups, public-records archive projects, litigation-support developers.",
      firstAsk:
        "Use one external archive or mobile client to ingest documents and retrieve source-bound documents, violations, and timeline.",
      proofArtifact:
        "API demo: ingest job, source ledger, violation taxonomy, timeline endpoint, webhook callback, typed SDK example.",
      priceTest: "Project contract or API workspace starting at $1,500+.",
      blocker:
        "Needs multi-tenant key scoping, webhooks, SDK packaging, and clearer entitlement boundaries.",
      route: "/settings",
      icon: Workflow,
    },
  ];

  const outreachPools: OutreachPool[] = [
    {
      segment: "Police accountability and Section 1983 lawyers",
      channel: "National Police Accountability Project",
      sourceSignal:
        "NPAP is a national network focused on law-enforcement and detention-officer accountability.",
      whyItMatters:
        "This is the cleanest early professional lane: attorneys already think in misconduct patterns, source records, Monell gaps, and damages leverage.",
      firstOutreach:
        "Offer one closed-matter discovery review, not a software demo: ask for a small production set and return a source-bound leverage memo.",
      firstProof:
        "Civil-rights discovery leverage memo with ranked findings, Monell map, adverse facts, missing records, and source appendix.",
      proofGate:
        "The memo exports cleanly to PDF/DOCX with QC status, source quotes, blocked claims, and attorney-review notes.",
      status:
        reportReadyFindings.length > 0 && savedReports.length > 0
          ? "live"
          : reportReadyFindings.length > 0
            ? "partial"
            : "missing",
      href: "https://nationalpoliceaccountability.org/",
      icon: ShieldCheck,
    },
    {
      segment: "Legal aid organizations and A2J programs",
      channel: "LSC grantees and legal-help locator",
      sourceSignal:
        "LSC funds legal-aid programs nationally and publishes grantee and legal-help locators; technology improvement is already a grant category.",
      whyItMatters:
        "The legal-aid market has real overload and existing technology budgets, but it will only buy reviewer-safe intake compression.",
      firstOutreach:
        "Ask for three anonymized intakes and measure reviewer time saved, confusion reduced, and overclaims blocked.",
      firstProof:
        "Clinic intake accelerator packet: facts, adverse facts, deadlines, missing records, issue screen, and excluded claims.",
      proofGate:
        "Reviewer notes, adverse-fact checklist, time-saved measurement, and non-lawyer guidance boundaries exist.",
      status: readyDocuments.length > 0 ? "partial" : "missing",
      href: "https://www.lsc.gov/grants/our-grantees",
      icon: Landmark,
    },
    {
      segment: "Innocence, habeas, and post-conviction teams",
      channel: "Innocence Network directory",
      sourceSignal:
        "The Innocence Network directory lists innocence organizations doing investigation-heavy post-conviction work.",
      whyItMatters:
        "These teams already live in transcripts, discovery gaps, Brady/Napue, competency problems, and missing records.",
      firstOutreach:
        "Offer a transcript/order/discovery gap map and make the output records-first unless the source proof is already strong.",
      firstProof:
        "Defense transcript and writ review with Brady tracker, speedy-trial timeline, competency gap map, and mandamus gate.",
      proofGate:
        "Selected-file analysis works on transcripts/orders/discovery and exports a doctrine-specific packet with authority verification status.",
      status:
        bradyFindings.length > 0 || writReports.length > 0
          ? "partial"
          : "missing",
      href: "https://innocencenetwork.org/directory",
      icon: FileSearch,
    },
    {
      segment: "Public defense leaders and defender offices",
      channel: "NLADA Defender resources",
      sourceSignal:
        "NLADA organizes defender communities; RAND workload research shows modern defense work is overloaded and record-heavy.",
      whyItMatters:
        "Defender teams need faster review of transcripts, digital discovery, jail records, and procedural gaps without replacing counsel.",
      firstOutreach:
        "Lead with a low-risk closed-file review that returns a Brady/timeline/writ gap packet and a manual-review comparison.",
      firstProof:
        "Defense review packet with chronology, discovery gaps, competency flags, speedy-trial posture, and missing-record demands.",
      proofGate:
        "The product can process a realistic bundle and show what it found, missed, downgraded, and refused to plead.",
      status:
        bradyFindings.length > 0 || timelineFindings.length > 0
          ? "partial"
          : "missing",
      href: "https://www.nlada.org/defender",
      icon: FileArchive,
    },
    {
      segment: "Plaintiff-side employment and civil-rights firms",
      channel: "NELA Find-A-Lawyer",
      sourceSignal:
        "NELA's directory exposes employee-side attorneys who already evaluate retaliation, discrimination, wage, and civil-rights records.",
      whyItMatters:
        "Employee-side firms buy tools that shorten record review and expose retaliation, pattern evidence, and damages leverage.",
      firstOutreach:
        "Offer a retaliation chronology and contradiction map for one closed matter with source quotes and adverse facts.",
      firstProof:
        "Retaliation and pattern packet with chronology, actor map, protected-activity timeline, missing records, and source quotes.",
      proofGate:
        "The timeline builder can tie protected activity, adverse action, source quotes, and missing records without overclaiming causation.",
      status:
        timelineFindings.length > 0 || reportReadyFindings.length > 0
          ? "partial"
          : "missing",
      href: "https://engagement.nela.org/NELA/nela/findalawyer.aspx",
      icon: Target,
    },
    {
      segment: "Civil-rights referral and movement lawyers",
      channel: "National Lawyers Guild referral directory",
      sourceSignal:
        "NLG's referral directory is searchable by practice area and location, which makes it useful for narrow issue-specific outreach.",
      whyItMatters:
        "This pool is more accessible than enterprise legal buyers and may tolerate a pilot if the packet is useful immediately.",
      firstOutreach:
        "Send a short sample packet and ask for one narrow record set where the desired output is a timeline, gap map, or writ screen.",
      firstProof:
        "Compact issue packet with timeline, source appendix, missing-record list, and next-action memo.",
      proofGate:
        "A stranger can understand the exported packet without a founder walkthrough.",
      status:
        savedReports.length > 0 && anchoredFindings.length > 0
          ? "partial"
          : "missing",
      href: "https://www.nlg.org/referral-directory/",
      icon: Users,
    },
    {
      segment: "Pro se litigants and family support teams",
      channel: "Court self-help, law libraries, LawHelp, referral overflow",
      sourceSignal:
        "LSC's legal-help locator and Justice Gap research point to unmet demand, but this lane needs strict legal-information boundaries.",
      whyItMatters:
        "The access gap is massive, but this lane only works if the app produces plain-English packets without pretending to be a lawyer.",
      firstOutreach:
        "Do not pitch unlimited AI. Pitch one guided case packet: upload, process, timeline, missing records, and source appendix.",
      firstProof:
        "Case Builder before/after packet: uploads turned into timeline, issue map, missing-record list, and source appendix.",
      proofGate:
        "Onboarding, disclaimers, support limits, refund boundaries, and private-upload limits are explicit.",
      status:
        readyDocuments.length > 0 && savedReports.length > 0
          ? "live"
          : readyDocuments.length > 0
            ? "partial"
            : "missing",
      href: "https://www.lsc.gov/about-lsc/what-legal-aid/i-need-legal-help",
      icon: Scale,
    },
    {
      segment: "Public-records watchdogs and investigative desks",
      channel: "FOIA/public-records and accountability communities",
      sourceSignal:
        "Public-records communities need source-led ledgers, timeline reconstruction, and records still to request.",
      whyItMatters:
        "They need checkable evidence ledgers and missing-record targets, not legal conclusions dressed up as certainty.",
      firstOutreach:
        "Offer to turn one public-records batch into a source ledger, actor/date timeline, contradiction list, and missing-record request list.",
      firstProof:
        "Watchdog evidence ledger: dates, actors, source quotes, contradiction signals, missing records, and public/private export controls.",
      proofGate:
        "Public/private controls, redaction posture, and export format are clear enough for an external project.",
      status:
        anchoredFindings.length > 0 && savedReports.length > 0
          ? "partial"
          : "missing",
      href: "https://www.muckrock.com/",
      icon: SearchCheck,
    },
  ];

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
    <CommandSurface>
      <CommandTopBar
        title="From MVP to sellable legal engine"
        eyebrow="Market Command"
        actions={
          <>
            <Badge
              variant="outline"
              className="hidden border-zinc-300 bg-white/70 text-zinc-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 sm:inline-flex"
            >
              {user?.name || user?.email}
            </Badge>
            <Link href="/pricing">
              <Button
                size="sm"
                variant="outline"
                className="hidden gap-2 border-zinc-300 bg-white/70 text-zinc-800 hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100 sm:inline-flex"
              >
                <DollarSign className="h-4 w-4" />
                Pricing
              </Button>
            </Link>
            <Link href="/settings">
              <Button
                size="sm"
                className="gap-2 bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-amber-300 dark:text-zinc-950 dark:hover:bg-amber-200"
              >
                <Gauge className="h-4 w-4" />
                Monitors
              </Button>
            </Link>
          </>
        }
      />

      <CommandMain>
        <section className="mb-4 rounded-md border border-amber-500/25 bg-white/82 p-4 shadow-sm backdrop-blur dark:border-amber-400/25 dark:bg-[#0c1418]/84">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
                Verdict
              </p>
              <h2 className="mt-2 max-w-4xl text-2xl font-semibold tracking-tight text-zinc-950 dark:text-white sm:text-3xl">
                {verdict}. The market is the pipeline: evidence to violation to
                QC to export to billing.
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600 dark:text-slate-400">
                Another legal chatbot is a vendor tab. DueProcess becomes its
                own category when it proves facts from the record, ranks
                leverage, blocks overclaims, and ships usable packets without
                pretending unsupported guesses are facts.
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
                  value={
                    checkoutReadyPlans > 0
                      ? `${checkoutReadyPlans} plans`
                      : "Not ready"
                  }
                  detail={
                    revenueBlockers.length > 0
                      ? `${revenueBlockers.length} blockers in Settings`
                      : billingLive
                        ? usage?.billing?.subscription?.status ||
                          "subscription state visible"
                        : "Billing still needs server-side tier reality."
                  }
                  icon={DollarSign}
                  tone={
                    checkoutReadyPlans > 0 && revenueBlockers.length === 0
                      ? "success"
                      : "warning"
                  }
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
            value={savedReportsQuery.isLoading ? "..." : savedReports.length}
            detail="saved packets and exports"
            icon={ReceiptText}
            tone={savedReports.length > 0 ? "success" : "warning"}
          />
          <MetricCard
            title="AI cost"
            value={
              exactUsageEnabled
                ? formatUsd(
                    billingSnapshot?.current?.exactCostUsd ??
                      usage?.aiUsage?.exact?.estimatedUsd
                  )
                : formatUsd(usage?.aiUsage?.savedAgentOutputs?.estimatedUsd)
            }
            detail={
              snapshotUsagePoints > 0
                ? `${formatNumber(billingSnapshot?.current?.pagesAnalyzed)} pages this period`
                : exactUsageEnabled
                  ? "exact persisted telemetry"
                  : "estimated from saved output text"
            }
            icon={Gauge}
            tone={exactUsageEnabled ? "success" : "warning"}
          />
        </section>

        <section className="mb-5 rounded-md border border-emerald-500/25 bg-white/82 p-4 shadow-sm backdrop-blur dark:border-emerald-400/20 dark:bg-[#0e1716]/86 sm:p-5">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className="rounded-md border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
                >
                  Current acquisition command
                </Badge>
                <Badge
                  variant="outline"
                  className="rounded-md border-zinc-300 bg-zinc-50 text-zinc-700 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-300"
                >
                  source refresh 2026-06-30
                </Badge>
              </div>
              <h2 className="mt-3 max-w-4xl text-xl font-semibold tracking-tight text-zinc-950 dark:text-white sm:text-2xl">
                Sell {topBuyerCloseSignal.lane} first, but only as a proof
                packet.
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600 dark:text-slate-400">
                Current source checks point to the same wedge: overloaded record
                reviewers need exportable, source-bound work product. Do not
                sell "legal AI." Sell the packet, measure whether it made review
                faster or safer, and use that proof to decide whether the lane
                deserves real outreach.
              </p>
            </div>
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-white/10 dark:bg-black/20">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-slate-500">
                    Closest lane score
                  </p>
                  <p className="mt-1 text-4xl font-semibold text-zinc-950 dark:text-white">
                    {topBuyerCloseSignal.closeScore}
                  </p>
                </div>
                <StatusBadge status={topBuyerCloseSignal.closeReadiness} />
              </div>
              <Progress
                value={topBuyerCloseSignal.closeScore}
                className="mt-4 h-2"
              />
              <p className="mt-3 text-xs leading-5 text-zinc-600 dark:text-slate-400">
                Buyer: {topBuyerCloseSignal.buyer}
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-4">
            {[
              {
                label: "Market need",
                value: topBuyerCloseSignal.marketNeed,
                icon: SearchCheck,
              },
              {
                label: "Proof artifact",
                value: topBuyerCloseSignal.proofArtifact,
                icon: FileCheck,
              },
              {
                label: "First close motion",
                value: topBuyerCloseSignal.firstCloseAction,
                icon: ArrowRight,
              },
              {
                label: "Do not pitch until",
                value:
                  revenueBlockers.length > 0
                    ? `${revenueBlockers.length} revenue blocker${revenueBlockers.length === 1 ? "" : "s"} remain in Settings.`
                    : "One ugly-case upload-to-export proof run passes with usage telemetry and export review.",
                icon: CircleAlert,
              },
            ].map(item => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-black/20"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-slate-500">
                      {item.label}
                    </p>
                    <Icon className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" />
                  </div>
                  <p className="mt-3 text-xs leading-5 text-zinc-700 dark:text-slate-300">
                    {item.value}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mb-5 rounded-md border border-zinc-200 bg-white/82 p-3 shadow-sm backdrop-blur dark:border-white/10 dark:bg-[#111722]/84">
          <div className="grid gap-2 md:grid-cols-4">
            {[
              {
                id: "proof" as const,
                label: "Proof board",
                detail: "what can sell now",
                icon: ClipboardCheck,
              },
              {
                id: "customers" as const,
                label: "Customer lanes",
                detail: "who to talk to first",
                icon: Users,
              },
              {
                id: "research" as const,
                label: "Research",
                detail: "market signals",
                icon: SearchCheck,
              },
              {
                id: "deep" as const,
                label: "Full board",
                detail: "all gates and details",
                icon: Layers3,
              },
            ].map(item => {
              const Icon = item.icon;
              const active = marketMode === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setMarketMode(item.id)}
                  className={cn(
                    "flex min-h-16 items-center gap-3 rounded-md border px-3 py-2 text-left transition",
                    active
                      ? "border-amber-500/40 bg-amber-500/10 text-zinc-950 dark:border-amber-300/35 dark:bg-amber-300/10 dark:text-white"
                      : "border-transparent bg-zinc-50 text-zinc-700 hover:border-zinc-200 hover:bg-white dark:bg-white/[0.035] dark:text-slate-300 dark:hover:border-white/10 dark:hover:bg-white/[0.06]"
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border",
                      active
                        ? "border-amber-500/30 bg-white/70 text-amber-700 dark:bg-black/20 dark:text-amber-200"
                        : "border-zinc-200 bg-white text-zinc-500 dark:border-white/10 dark:bg-black/20 dark:text-slate-400"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">
                      {item.label}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-zinc-500 dark:text-slate-500">
                      {item.detail}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {marketMode === "proof" ? (
          <section className="mb-5 rounded-md border border-zinc-200 bg-white/82 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-[#111722]/84 sm:p-5">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className="rounded-md border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
                  >
                    Operating board
                  </Badge>
                  <Badge
                    variant="outline"
                    className="rounded-md border-zinc-300 bg-zinc-50 text-zinc-700 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-300"
                  >
                    {proofRunLiveCount}/{proofRunSteps.length} proof gates
                  </Badge>
                </div>
                <h2 className="mt-3 max-w-4xl text-xl font-semibold tracking-tight text-zinc-950 dark:text-white sm:text-2xl">
                  Build the market around one exported proof packet, then repeat
                  by lane.
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600 dark:text-slate-400">
                  The product is strongest when the buyer can inspect the packet
                  outside the app: source facts, missing records, blocked
                  claims, QC status, next actions, PDF/DOCX export, and billing
                  boundaries. That is the sale. The chatbot is just the steering
                  wheel.
                </p>
              </div>
              <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-white/10 dark:bg-black/20">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-slate-500">
                  Next proof move
                </p>
                <p className="mt-2 text-sm font-semibold text-zinc-950 dark:text-white">
                  {nextProofRunStep.title}
                </p>
                <p className="mt-2 text-xs leading-5 text-zinc-600 dark:text-slate-400">
                  {nextProofRunStep.blocker}
                </p>
                <Link href={nextProofRunStep.route}>
                  <Button className="mt-4 w-full bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-amber-300 dark:text-zinc-950 dark:hover:bg-amber-200">
                    {nextProofRunStep.action}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_18rem]">
              <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-white/10 dark:bg-black/20">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-slate-500">
                      Automated contract gate
                    </p>
                    <h3 className="mt-1 text-sm font-semibold text-zinc-950 dark:text-white">
                      Run this before claiming the engine is intact.
                    </h3>
                  </div>
                  <Terminal className="h-5 w-5 text-amber-700 dark:text-amber-300" />
                </div>
                <pre className="mt-3 overflow-x-auto rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-800 dark:border-white/10 dark:bg-black/30 dark:text-slate-200">
                  pnpm exec vitest run server/privateBetaProofRun.test.ts
                </pre>
                <p className="mt-3 text-xs leading-5 text-zinc-600 dark:text-slate-400">
                  Automated proof confirms source anchoring, structured
                  findings, QC blocking, report generation, export packaging,
                  and usage telemetry. Live proof still requires a real browser
                  run on ugly documents.
                </p>
              </div>
              <div className="rounded-md border border-red-500/20 bg-red-500/10 p-4 dark:border-red-400/20 dark:bg-red-400/10">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-red-800 dark:text-red-100">
                  Paid pilot line
                </p>
                <p className="mt-2 text-sm font-semibold leading-6 text-zinc-950 dark:text-white">
                  Do not sell a firm/API pilot until usage telemetry, billing
                  limits, and one live upload-to-export proof run are visibly
                  passing.
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              {revenuePipelineLanes.slice(0, 3).map(lane => (
                <RevenuePipelineLaneCard key={lane.lane} lane={lane} />
              ))}
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              {proofRunSteps.slice(0, 3).map(step => (
                <ProofRunStepCard key={step.order} step={step} />
              ))}
            </div>
          </section>
        ) : null}

        <section
          className={cn(
            "mb-5 rounded-md border border-zinc-200 bg-white/82 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-[#111722]/84 sm:p-5",
            marketMode !== "research" && marketMode !== "deep" && "hidden"
          )}
        >
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className="rounded-md border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-200"
                >
                  Research refresh
                </Badge>
                <Badge
                  variant="outline"
                  className="rounded-md border-zinc-300 bg-zinc-50 text-zinc-700 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-300"
                >
                  {researchRefreshSignals.length} source-backed signals
                </Badge>
              </div>
              <h2 className="mt-3 max-w-4xl text-xl font-semibold tracking-tight text-zinc-950 dark:text-white sm:text-2xl">
                The market needs proof packets, not another blank legal AI box.
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600 dark:text-slate-400">
                The buyer evidence points in one direction: organize ugly
                records, anchor facts, run QC, expose gaps, and export work
                product a human can verify. The customer bases are not abstract
                personas. They are overloaded people with records: pro se users,
                clinics, civil-rights firms, defense teams, and investigators.
              </p>
            </div>
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-white/10 dark:bg-black/20">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-slate-500">
                Build command
              </p>
              <p className="mt-2 text-sm font-semibold text-zinc-950 dark:text-white">
                Treat market research as product gates.
              </p>
              <p className="mt-2 text-xs leading-5 text-zinc-600 dark:text-slate-400">
                If a lane cannot produce its proof artifact, it is not ready to
                sell. If a packet cannot survive outside the app, it is still a
                demo wearing a suit.
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            {researchRefreshSignals.map(signal => (
              <ResearchRefreshCard key={signal.label} signal={signal} />
            ))}
          </div>
        </section>

        <section
          className={cn(
            "mb-5 rounded-md border border-zinc-200 bg-white/82 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-[#111722]/84 sm:p-5",
            marketMode !== "customers" && marketMode !== "deep" && "hidden"
          )}
        >
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className="rounded-md border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-200"
                >
                  Buyer close map
                </Badge>
                <Badge
                  variant="outline"
                  className="rounded-md border-zinc-300 bg-zinc-50 text-zinc-700 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-300"
                >
                  {liveCloseSignals} live lanes
                </Badge>
              </div>
              <h2 className="mt-3 max-w-4xl text-xl font-semibold tracking-tight text-zinc-950 dark:text-white sm:text-2xl">
                The closest market is {topBuyerCloseSignal.lane}.
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600 dark:text-slate-400">
                This turns current market research into an operating board: each
                lane has a buyer, source-backed need, exact proof artifact,
                close score, and next action. It keeps the product honest: if
                the packet cannot be exported and understood outside the app,
                the lane is not ready to sell.
              </p>
            </div>
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-white/10 dark:bg-black/20">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-slate-500">
                    Average close score
                  </p>
                  <p className="mt-1 text-4xl font-semibold text-zinc-950 dark:text-white">
                    {closeAverageScore}
                  </p>
                </div>
                <StatusBadge status={topBuyerCloseSignal.closeReadiness} />
              </div>
              <Progress value={closeAverageScore} className="mt-4 h-2" />
              <p className="mt-3 text-xs leading-5 text-zinc-600 dark:text-slate-400">
                Top lane score: {topBuyerCloseSignal.closeScore}. Next:{" "}
                {topBuyerCloseSignal.firstCloseAction}
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            {buyerCloseSignals.map(signal => (
              <BuyerCloseSignalCard key={signal.lane} signal={signal} />
            ))}
          </div>
        </section>

        <section
          className={cn(
            "mb-5 rounded-md border border-zinc-200 bg-white/82 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-[#111722]/84 sm:p-5",
            marketMode !== "customers" && marketMode !== "deep" && "hidden"
          )}
        >
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className="rounded-md border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
                >
                  First 30 conversations
                </Badge>
                <Badge
                  variant="outline"
                  className="rounded-md border-zinc-300 bg-zinc-50 text-zinc-700 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-300"
                >
                  {firstConversationReadyCount}/
                  {firstCustomerConversations.length} lanes have proof
                </Badge>
              </div>
              <h2 className="mt-3 max-w-4xl text-xl font-semibold tracking-tight text-zinc-950 dark:text-white sm:text-2xl">
                Customer discovery starts with {firstConversationCount}{" "}
                proof-led conversations.
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600 dark:text-slate-400">
                This is the no-fiction outreach board. Each lane names the
                buyer, the channel, the first ask, the artifact to show, the
                conversion trigger, and the blocker. If there is no artifact to
                show, do not pitch the platform yet.
              </p>
            </div>
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-white/10 dark:bg-black/20">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-slate-500">
                Operating rule
              </p>
              <p className="mt-2 text-sm font-semibold text-zinc-950 dark:text-white">
                Sell one proof artifact per lane.
              </p>
              <p className="mt-2 text-xs leading-5 text-zinc-600 dark:text-slate-400">
                Do not ask strangers to buy "AI." Ask them to judge a
                source-bound packet on one matter, then measure review time,
                clarity, and what the system refused to overclaim.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            {firstCustomerConversations.map(conversation => (
              <FirstCustomerConversationCard
                key={conversation.channel}
                conversation={conversation}
              />
            ))}
          </div>
        </section>

        <div
          className={cn(
            "grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]",
            marketMode !== "deep" && "hidden"
          )}
        >
          <div className="min-w-0 space-y-5">
            <SectionShell
              icon={SearchCheck}
              title="Verified market evidence"
              description="Outside signals mapped directly to buyer lanes, product requirements, and the proof artifact that has to sell the first pilot."
            >
              <div className="mb-4 rounded-md border border-blue-500/25 bg-blue-500/10 p-4 dark:border-blue-400/20 dark:bg-blue-400/8">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
                  <div>
                    <p className="text-sm font-semibold text-zinc-950 dark:text-white">
                      Research says the wedge is packets, not chat.
                    </p>
                    <p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-slate-300">
                      The verified signals line up: access-to-justice demand,
                      overloaded public defense, legal-aid intake pressure,
                      lawyer AI ethics, and firm workflow pain all reward the
                      same product shape: source-bound packets, visible QC,
                      export quality, and narrow buyer-specific proof.
                    </p>
                  </div>
                  <div className="rounded-md border border-zinc-200 bg-white/70 p-3 dark:border-white/10 dark:bg-black/20">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-slate-500">
                      Source count
                    </p>
                    <p className="mt-2 text-lg font-semibold text-zinc-950 dark:text-white">
                      {verifiedMarketEvidence.length} verified lanes
                    </p>
                    <p className="mt-1 text-xs leading-5 text-zinc-600 dark:text-slate-400">
                      Each one is tied to a source link and a sellable proof
                      artifact.
                    </p>
                  </div>
                </div>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                {verifiedMarketEvidence.map(item => (
                  <MarketEvidenceCard key={item.label} item={item} />
                ))}
              </div>
            </SectionShell>

            <SectionShell
              icon={ClipboardCheck}
              title="Buyer proof brief"
              description="The market does not buy a general AI promise. It buys a proof artifact for a specific overloaded buyer with a clear first ask, price test, and blocker."
            >
              <div className="mb-4 rounded-md border border-emerald-500/25 bg-emerald-500/10 p-4 dark:border-emerald-400/20 dark:bg-emerald-400/8">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
                  <div>
                    <p className="text-sm font-semibold text-zinc-950 dark:text-white">
                      Sell the evidence-to-packet outcome.
                    </p>
                    <p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-slate-300">
                      Current market signals point the same way: people need
                      more legal help, legal teams need AI they can verify, and
                      defense/investigation teams need relief from document
                      overload. The product answer is a source-bound packet with
                      QC, not another chat window.
                    </p>
                  </div>
                  <div className="rounded-md border border-zinc-200 bg-white/70 p-3 dark:border-white/10 dark:bg-black/20">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-slate-500">
                      Closest impact proof
                    </p>
                    <p className="mt-2 text-lg font-semibold text-zinc-950 dark:text-white">
                      {buyerProofBriefs.find(brief => brief.status === "live")
                        ?.lane ??
                        buyerProofBriefs.find(
                          brief => brief.status === "partial"
                        )?.lane ??
                        buyerProofBriefs[0].lane}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-zinc-600 dark:text-slate-400">
                      Based on current documents, findings, reports, and impact
                      readiness.
                    </p>
                  </div>
                </div>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                {buyerProofBriefs.map(brief => (
                  <BuyerProofBriefCard key={brief.lane} brief={brief} />
                ))}
              </div>
            </SectionShell>

            <SectionShell
              icon={DollarSign}
              title="Revenue pipeline"
              description="How the impact work stays funded: who can pay, what artifact proves value, and what gap still blocks responsible rollout."
            >
              <div className="mb-4 rounded-md border border-amber-500/25 bg-amber-500/10 p-4 dark:border-amber-400/20 dark:bg-amber-400/8">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
                  <div>
                    <p className="text-sm font-semibold text-zinc-950 dark:text-white">
                      This is the sustainability board.
                    </p>
                    <p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-slate-300">
                      Each lane ties a buyer to a concrete packet and a launch
                      blocker. The work is sustainable when the artifact exists,
                      the buyer can understand it outside the app, and
                      billing/limits do not require founder duct tape.
                    </p>
                  </div>
                  <div className="rounded-md border border-zinc-200 bg-white/70 p-3 dark:border-white/10 dark:bg-black/20">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-slate-500">
                      Closest sustainability path
                    </p>
                    <p className="mt-2 text-lg font-semibold text-zinc-950 dark:text-white">
                      {revenuePipelineLanes.find(lane => lane.status === "live")
                        ?.lane ??
                        revenuePipelineLanes.find(
                          lane => lane.status === "partial"
                        )?.lane ??
                        revenuePipelineLanes[0].lane}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-zinc-600 dark:text-slate-400">
                      Based on live documents, findings, reports, billing, and
                      telemetry in this workspace.
                    </p>
                  </div>
                </div>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                {revenuePipelineLanes.map(lane => (
                  <RevenuePipelineLaneCard key={lane.lane} lane={lane} />
                ))}
              </div>
            </SectionShell>

            <SectionShell
              icon={Target}
              title="Customer acquisition command"
              description="Ranked first beneficiaries, first ask, proof artifact, sustainability test, and the specific blocker that keeps each lane from responsible launch."
            >
              <div className="mb-4 rounded-md border border-emerald-500/25 bg-emerald-500/10 p-4 dark:border-emerald-400/20 dark:bg-emerald-400/8">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
                  <div>
                    <p className="text-sm font-semibold text-zinc-950 dark:text-white">
                      Lead with the usable packet, not the platform.
                    </p>
                    <p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-slate-300">
                      The fastest impact path is a narrow proof artifact for a
                      person or team already drowning in records: civil-rights
                      reviewers, pro se users, clinics, defense teams,
                      watchdogs, then API integrators. Big enterprise can wait
                      until billing, roles, and tenant boundaries are less
                      cursed.
                    </p>
                  </div>
                  <div className="rounded-md border border-zinc-200 bg-white/70 p-3 dark:border-white/10 dark:bg-black/20">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-slate-500">
                      Best next lane
                    </p>
                    <p className="mt-2 text-lg font-semibold text-zinc-950 dark:text-white">
                      {acquisitionTargets.find(
                        target => target.status !== "missing"
                      )?.segment ?? acquisitionTargets[0].segment}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-zinc-600 dark:text-slate-400">
                      Based on current proof artifacts in this workspace.
                    </p>
                  </div>
                </div>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                {acquisitionTargets.map(target => (
                  <AcquisitionTargetCard key={target.segment} target={target} />
                ))}
              </div>
            </SectionShell>

            <SectionShell
              icon={Users}
              title="Impact close playbooks"
              description="What to show first, who benefits, how to qualify the need, how impact is measured, and what must be true before launch."
            >
              <div className="mb-4 rounded-md border border-cyan-500/25 bg-cyan-500/10 p-4 dark:border-cyan-400/20 dark:bg-cyan-400/8">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
                  <div>
                    <p className="text-sm font-semibold text-zinc-950 dark:text-white">
                      Impact first. Sustainability second.
                    </p>
                    <p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-slate-300">
                      Each playbook starts with the person or team helped, the
                      first usable packet, and the safety gate. Revenue language
                      stays because the work has to survive, but it is not the
                      mission.
                    </p>
                  </div>
                  <div className="rounded-md border border-zinc-200 bg-white/70 p-3 dark:border-white/10 dark:bg-black/20">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-slate-500">
                      Closest impact proof
                    </p>
                    <p className="mt-2 text-lg font-semibold text-zinc-950 dark:text-white">
                      {closePlaybooks.find(
                        playbook => playbook.status !== "missing"
                      )?.lane ?? closePlaybooks[0].lane}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-zinc-600 dark:text-slate-400">
                      Based on live documents, findings, reports, and readiness
                      signals.
                    </p>
                  </div>
                </div>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                {closePlaybooks.map(playbook => (
                  <ClosePlaybookCard key={playbook.lane} playbook={playbook} />
                ))}
              </div>
            </SectionShell>

            <SectionShell
              icon={ExternalLink}
              title="Actual outreach pools"
              description="Named places to find the first buyers. The play is not mass marketing; it is showing the right proof packet to people already drowning in records."
            >
              <div className="mb-4 rounded-md border border-blue-500/25 bg-blue-500/10 p-4 dark:border-blue-400/20 dark:bg-blue-400/8">
                <p className="text-sm font-semibold text-zinc-950 dark:text-white">
                  Outreach rule: lead with the artifact.
                </p>
                <p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-slate-300">
                  Every pool below gets a different first proof. A civil rights
                  lawyer gets a leverage memo. Legal aid gets intake
                  compression. Defense gets transcript/Brady/writ review. Pro se
                  users get a plain-English case packet. Watchdogs get a
                  checkable source ledger.
                </p>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                {outreachPools.map(pool => (
                  <OutreachPoolCard
                    key={`${pool.segment}-${pool.channel}`}
                    pool={pool}
                  />
                ))}
              </div>
            </SectionShell>

            <SectionShell
              icon={Rocket}
              title="Private beta proof run"
              description="The sellability test: one messy record set must move through intake, source anchoring, analysis, QC, export, usage telemetry, and billing limits."
            >
              <div className="mb-4 grid gap-3 rounded-md border border-amber-500/25 bg-amber-500/10 p-4 dark:border-amber-400/20 dark:bg-amber-400/8 lg:grid-cols-[12rem_minmax(0,1fr)_12rem]">
                <div>
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-amber-800 dark:text-amber-200">
                    Proof score
                  </p>
                  <p className="mt-1 text-4xl font-semibold text-zinc-950 dark:text-white">
                    {proofRunScore}%
                  </p>
                  <p className="mt-1 text-xs text-amber-900/80 dark:text-amber-100/80">
                    {proofRunLiveCount}/{proofRunSteps.length} gates live
                  </p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-950 dark:text-white">
                    Next proof move: {nextProofRunStep.title}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-slate-300">
                    {nextProofRunStep.blocker}
                  </p>
                </div>
                <Link href={nextProofRunStep.route}>
                  <Button className="h-full min-h-12 w-full bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-amber-300 dark:text-zinc-950 dark:hover:bg-amber-200">
                    {nextProofRunStep.action}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
              <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_18rem]">
                <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-white/10 dark:bg-slate-950/55">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-slate-500">
                        Automated contract gate
                      </p>
                      <h3 className="mt-1 text-sm font-semibold text-zinc-950 dark:text-white">
                        Proves the internal engine contract, not market fit.
                      </h3>
                    </div>
                    <Terminal className="h-5 w-5 text-amber-700 dark:text-amber-300" />
                  </div>
                  <pre className="mt-3 overflow-x-auto rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-800 dark:border-white/10 dark:bg-black/30 dark:text-slate-200">
                    pnpm exec vitest run server/privateBetaProofRun.test.ts
                  </pre>
                  <p className="mt-3 text-xs leading-5 text-zinc-600 dark:text-slate-400">
                    This contract checks source-ready text, structured findings,
                    quote verification, QC filtering, court-safe report
                    generation, export packaging, and usage telemetry
                    normalization. It does not replace the live ugly-case
                    browser run.
                  </p>
                </div>
                <div className="rounded-md border border-red-500/20 bg-red-500/10 p-4 dark:border-red-400/20 dark:bg-red-400/10">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-red-800 dark:text-red-100">
                    Paid pilot line
                  </p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-zinc-950 dark:text-white">
                    Do not sell a firm/API pilot until usage telemetry, billing
                    limits, and one live upload-to-export proof run are visibly
                    passing.
                  </p>
                  <Link href="/settings">
                    <Button
                      variant="outline"
                      className="mt-3 w-full justify-between border-red-500/30 bg-white/60 text-red-800 hover:bg-white dark:border-red-300/30 dark:bg-black/20 dark:text-red-100"
                    >
                      Check settings gates
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {proofRunSteps.map(step => (
                  <ProofRunStepCard key={step.order} step={step} />
                ))}
              </div>
            </SectionShell>

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
              icon={ClipboardCheck}
              title="Buyer readiness"
              description="Each customer base needs different proof. This maps live product evidence to the sale you can credibly make."
            >
              <div className="grid gap-3 lg:grid-cols-2">
                {buyerReadiness.map(item => (
                  <BuyerReadinessCard key={item.segment} item={item} />
                ))}
              </div>
            </SectionShell>

            <SectionShell
              icon={Rocket}
              title="Pilot offers"
              description="Turn the customer-base map into concrete first sales. Each offer has a price test, proof artifact, sell trigger, and blocker."
            >
              <div className="grid gap-3 lg:grid-cols-2">
                {pilotOffers.map(offer => (
                  <PilotOfferCard key={offer.name} offer={offer} />
                ))}
              </div>
            </SectionShell>

            <SectionShell
              icon={FileCheck}
              title="Sellable proof packs"
              description="The product becomes real money when each buyer lane has a concrete packet with a pass gate, not just a promise that agents are smart."
            >
              <div className="mb-4 rounded-md border border-blue-500/25 bg-blue-500/10 p-4 dark:border-blue-400/20 dark:bg-blue-400/8">
                <p className="text-sm font-semibold text-zinc-950 dark:text-white">
                  Package the outcome, then sell the run.
                </p>
                <p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-slate-300">
                  Each pack is a narrow paid artifact: what the buyer gets, what
                  proof it must contain, what output blocks overclaiming, and
                  what price motion to test. This keeps outreach grounded in
                  deliverables instead of generic AI hype.
                </p>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                {proofPacks.map(pack => (
                  <ProofPackCard key={pack.name} pack={pack} />
                ))}
              </div>
            </SectionShell>

            <SectionShell
              icon={Target}
              title="Actual customer bases"
              description="These are the people with real pain, real workflows, and a plausible reason to pay if the engine proves itself."
            >
              <div className="grid gap-3 lg:grid-cols-2">
                {customerSegments.map(segment => (
                  <CustomerCard key={segment.name} segment={segment} />
                ))}
              </div>
            </SectionShell>

            <SectionShell
              icon={DollarSign}
              title="Monetization lanes"
              description="The pricing story should match the job being done: demo confidence, pro se packets, firm throughput, and archive/API infrastructure."
            >
              <div className="space-y-2">
                {monetizationLanes.map(lane => (
                  <MonetizationRow key={lane.lane} lane={lane} />
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
              icon={SearchCheck}
              title="Market need"
              description="Current demand signals that shape the product. This is strategy, not fake app telemetry."
            >
              <div className="space-y-3">
                {demandSignals.map(signal => (
                  <a
                    key={signal.label}
                    href={signal.href}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-md border border-zinc-200 bg-white/58 p-3 transition-colors hover:border-zinc-400 hover:bg-white dark:border-white/10 dark:bg-white/[0.035] dark:hover:border-white/25 dark:hover:bg-white/[0.07]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-zinc-950 dark:text-white">
                          {signal.label}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-zinc-700 dark:text-slate-300">
                          {signal.signal}
                        </p>
                      </div>
                      <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400 dark:text-slate-500" />
                    </div>
                    <p className="mt-3 text-xs leading-5 text-zinc-600 dark:text-slate-400">
                      <span className="font-semibold text-amber-700 dark:text-amber-300">
                        Product implication:
                      </span>{" "}
                      {signal.implication}
                    </p>
                    <p className="mt-2 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-slate-500">
                      Source: {signal.source}
                    </p>
                  </a>
                ))}
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
      </CommandMain>
    </CommandSurface>
  );
}
