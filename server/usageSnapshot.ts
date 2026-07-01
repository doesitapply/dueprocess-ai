import type {
  AgentRun,
  Document,
  GeneratedReport,
  LlmUsageEvent,
  Subscription,
} from "../drizzle/schema";
import { estimateSelectedPages } from "./accessControl";
import type { PlatformSubscription } from "./products";

const FIRM_INCLUDED_PAGES = 5000;
const FIRM_INCLUDED_AGENT_CALLS = 500;
const FIRM_INCLUDED_API_CALLS = 10000;
const FIRM_PAGE_OVERAGE_USD = 0.02;
const FIRM_AGENT_OVERAGE_USD = 0.1;
const FIRM_API_OVERAGE_USD = 0.001;

type PeriodInput = Pick<
  Subscription,
  "currentPeriodStart" | "currentPeriodEnd"
> | null;

type UsageDocument = Pick<
  Document,
  | "id"
  | "createdAt"
  | "extractionTextLength"
  | "extractedText"
  | "summary"
  | "fileSize"
>;

type UsageRun = Pick<
  AgentRun,
  "createdAt" | "documentIds" | "agentIds" | "totalAgents"
>;

type UsageReport = Pick<GeneratedReport, "createdAt">;

type UsageEvent = Pick<
  LlmUsageEvent,
  "createdAt" | "totalTokens" | "estimatedCostCents"
>;

function periodDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfCurrentMonth(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
}

function startOfNextMonth(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
}

function inPeriod(value: Date | string, start: Date, end: Date): boolean {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date >= start && date < end;
}

function safeJsonArray(value: string | null | undefined): unknown[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function numberArrayFromJson(value: string | null | undefined): number[] {
  return safeJsonArray(value)
    .map(item => Number(item))
    .filter(item => Number.isFinite(item));
}

function agentCountForRun(run: UsageRun): number {
  if (run.totalAgents > 0) return run.totalAgents;
  return safeJsonArray(run.agentIds).length || 1;
}

function ratio(used: number, limit: number | "metered" | "unlimited") {
  if (typeof limit !== "number" || limit <= 0) return null;
  return used / limit;
}

function money(value: number): number {
  return Number(value.toFixed(4));
}

export function billingPeriodFor(subscription: PeriodInput, now = new Date()) {
  const subscriptionStart = periodDate(subscription?.currentPeriodStart);
  const subscriptionEnd = periodDate(subscription?.currentPeriodEnd);

  if (
    subscriptionStart &&
    subscriptionEnd &&
    subscriptionEnd > subscriptionStart
  ) {
    return {
      start: subscriptionStart,
      end: subscriptionEnd,
      source: "subscription" as const,
    };
  }

  return {
    start: startOfCurrentMonth(now),
    end: startOfNextMonth(now),
    source: "calendar_month" as const,
  };
}

export function buildUsageSnapshot(input: {
  plan: PlatformSubscription;
  subscription: PeriodInput;
  documents: UsageDocument[];
  agentRuns: UsageRun[];
  reports: UsageReport[];
  usageEvents: UsageEvent[];
  now?: Date;
}) {
  const period = billingPeriodFor(input.subscription, input.now);
  const documentsById = new Map(
    input.documents.map(document => [document.id, document])
  );
  const periodDocuments = input.documents.filter(document =>
    inPeriod(document.createdAt, period.start, period.end)
  );
  const periodRuns = input.agentRuns.filter(run =>
    inPeriod(run.createdAt, period.start, period.end)
  );
  const periodReports = input.reports.filter(report =>
    inPeriod(report.createdAt, period.start, period.end)
  );
  const periodUsageEvents = input.usageEvents.filter(event =>
    inPeriod(event.createdAt, period.start, period.end)
  );

  const pagesUploaded = estimateSelectedPages(periodDocuments);
  const pagesAnalyzed = periodRuns.reduce((total, run) => {
    const runDocuments = numberArrayFromJson(run.documentIds)
      .map(documentId => documentsById.get(documentId))
      .filter((document): document is UsageDocument => Boolean(document));
    return total + estimateSelectedPages(runDocuments);
  }, 0);
  const agentCalls = periodRuns.reduce(
    (total, run) => total + agentCountForRun(run),
    0
  );
  const exactLlmCalls = periodUsageEvents.length;
  const exactTokens = periodUsageEvents.reduce(
    (total, event) => total + event.totalTokens,
    0
  );
  const exactCostUsd = money(
    periodUsageEvents.reduce(
      (total, event) => total + event.estimatedCostCents,
      0
    ) / 100
  );

  const alerts: string[] = [];
  const pagesRatio = ratio(pagesAnalyzed, input.plan.limits.pagesAnalyzed);
  const uploadRatio = ratio(
    periodDocuments.length,
    input.plan.limits.documentUploads
  );
  if (pagesRatio !== null && pagesRatio >= 0.8) {
    alerts.push(
      `${input.plan.name} page usage is at ${Math.round(pagesRatio * 100)}% of the plan limit.`
    );
  }
  if (uploadRatio !== null && uploadRatio >= 0.8) {
    alerts.push(
      `${input.plan.name} upload usage is at ${Math.round(uploadRatio * 100)}% of the plan limit.`
    );
  }

  const firmUsage =
    input.plan.id === "firm"
      ? {
          includedPages: FIRM_INCLUDED_PAGES,
          includedAgentCalls: FIRM_INCLUDED_AGENT_CALLS,
          includedApiCalls: FIRM_INCLUDED_API_CALLS,
          pagesOverIncluded: Math.max(0, pagesAnalyzed - FIRM_INCLUDED_PAGES),
          agentCallsOverIncluded: Math.max(
            0,
            agentCalls - FIRM_INCLUDED_AGENT_CALLS
          ),
          apiCallsOverIncluded: 0,
          pageOverageUsd: money(
            Math.max(0, pagesAnalyzed - FIRM_INCLUDED_PAGES) *
              FIRM_PAGE_OVERAGE_USD
          ),
          agentOverageUsd: money(
            Math.max(0, agentCalls - FIRM_INCLUDED_AGENT_CALLS) *
              FIRM_AGENT_OVERAGE_USD
          ),
          apiOverageUsd: 0,
          estimatedOverageUsd: 0,
          rates: {
            page: FIRM_PAGE_OVERAGE_USD,
            agentCall: FIRM_AGENT_OVERAGE_USD,
            apiCall: FIRM_API_OVERAGE_USD,
          },
        }
      : null;

  if (firmUsage) {
    firmUsage.estimatedOverageUsd = money(
      firmUsage.pageOverageUsd +
        firmUsage.agentOverageUsd +
        firmUsage.apiOverageUsd
    );
    if (pagesAnalyzed >= FIRM_INCLUDED_PAGES * 0.8) {
      alerts.push(
        `Firm analyzed pages are at ${Math.round((pagesAnalyzed / FIRM_INCLUDED_PAGES) * 100)}% of included pages.`
      );
    }
    if (agentCalls >= FIRM_INCLUDED_AGENT_CALLS * 0.8) {
      alerts.push(
        `Firm agent calls are at ${Math.round((agentCalls / FIRM_INCLUDED_AGENT_CALLS) * 100)}% of included agent calls.`
      );
    }
  }

  return {
    period: {
      start: period.start.toISOString(),
      end: period.end.toISOString(),
      source: period.source,
    },
    current: {
      documentUploads: periodDocuments.length,
      pagesUploaded,
      pagesAnalyzed,
      agentRuns: periodRuns.length,
      agentCalls,
      reportsGenerated: periodReports.length,
      exactLlmCalls,
      exactTokens,
      exactCostUsd,
    },
    limits: {
      documentUploads: input.plan.limits.documentUploads,
      pagesAnalyzed: input.plan.limits.pagesAnalyzed,
      chatMessages: input.plan.limits.chatMessages,
    },
    firmUsage,
    alerts,
  };
}
