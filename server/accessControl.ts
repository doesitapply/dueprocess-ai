import { TRPCError } from "@trpc/server";
import type { Document, User } from "../drizzle/schema";
import { getSubscriptionByUserId, getUserDocuments } from "./db";
import {
  PLATFORM_SUBSCRIPTIONS,
  type PlatformSubscription,
  type SubscriptionTier,
} from "./products";

function isConfiguredOwner(user: Pick<User, "role" | "openId">) {
  return Boolean(
    process.env.OWNER_OPEN_ID &&
      user.openId === process.env.OWNER_OPEN_ID &&
      user.role === "admin"
  );
}

function forbidden(message: string): never {
  throw new TRPCError({ code: "FORBIDDEN", message });
}

function textLengthForPageEstimate(
  document: Pick<
    Document,
    "extractionTextLength" | "extractedText" | "summary" | "fileSize"
  >
): number {
  if (
    typeof document.extractionTextLength === "number" &&
    document.extractionTextLength > 0
  ) {
    return document.extractionTextLength;
  }

  const extractedLength = document.extractedText?.trim().length ?? 0;
  if (extractedLength > 0) return extractedLength;

  const summaryLength = document.summary?.trim().length ?? 0;
  if (summaryLength > 0) return summaryLength;

  return Math.max(0, Math.floor((document.fileSize ?? 0) / 1200));
}

export function estimateDocumentPages(
  document: Pick<
    Document,
    "extractionTextLength" | "extractedText" | "summary" | "fileSize"
  >
): number {
  const textLength = textLengthForPageEstimate(document);
  if (textLength <= 0) return 0;
  return Math.max(1, Math.ceil(textLength / 3000));
}

export function estimateSelectedPages(
  documents: Array<
    Pick<
      Document,
      "extractionTextLength" | "extractedText" | "summary" | "fileSize"
    >
  >
): number {
  return documents.reduce(
    (total, document) => total + estimateDocumentPages(document),
    0
  );
}

export async function getEffectivePlan(
  user: User
): Promise<PlatformSubscription> {
  if (isConfiguredOwner(user)) return PLATFORM_SUBSCRIPTIONS.firm;

  const subscription = await getSubscriptionByUserId(user.id);
  const planId = (
    subscription?.status === "active" ? subscription.plan : "free"
  ) as SubscriptionTier;
  return PLATFORM_SUBSCRIPTIONS[planId] ?? PLATFORM_SUBSCRIPTIONS.free;
}

export async function enforceDocumentUploadLimit(user: User) {
  const plan = await getEffectivePlan(user);
  const limit = plan.limits.documentUploads;
  if (limit === "unlimited" || limit === "metered") return;

  const documents = await getUserDocuments(user.id);
  if (documents.length >= limit) {
    forbidden(
      `${plan.name} allows ${limit} document upload${limit === 1 ? "" : "s"}. Upgrade before uploading more private records.`
    );
  }
}

export async function enforceAgentRunAccess(
  user: User,
  sector: "tactical" | "legal" | "intel" | "evidence" | "offensive"
) {
  const plan = await getEffectivePlan(user);
  if (plan.agentAccess === "all") return;
  if (plan.agentAccess === "evidence" && sector === "evidence") return;
  forbidden(`${plan.name} does not include ${sector} agent runs.`);
}

export async function enforceSwarmProcessingAccess(
  user: User,
  agentCount: number
) {
  if (agentCount <= 1) return;

  const plan = await getEffectivePlan(user);
  if (plan.includesSwarmProcessing) return;

  forbidden(
    `${plan.name} does not include multi-agent swarm processing. Run one included agent at a time or upgrade before launching ${agentCount} agents together.`
  );
}

export async function enforcePageAnalysisLimit(
  user: User,
  documents: Array<
    Pick<
      Document,
      "extractionTextLength" | "extractedText" | "summary" | "fileSize"
    >
  >,
  operation = "analysis"
) {
  const plan = await getEffectivePlan(user);
  const limit = plan.limits.pagesAnalyzed;
  if (limit === "unlimited" || limit === "metered") return;

  const estimatedPages = estimateSelectedPages(documents);
  if (estimatedPages > limit) {
    forbidden(
      `${plan.name} allows ${limit} analyzed page${limit === 1 ? "" : "s"} per month. This ${operation} scope is estimated at ${estimatedPages} page${estimatedPages === 1 ? "" : "s"}; split the scope, buy a compute pack, or upgrade.`
    );
  }
}

export async function enforceDraftAccess(user: User) {
  const plan = await getEffectivePlan(user);
  if (plan.includesDrafting) return;
  forbidden(`${plan.name} does not include draft generation.`);
}

export async function enforceReportGenerationAccess(user: User) {
  const plan = await getEffectivePlan(user);
  if (plan.includesPdfExport || plan.agentAccess !== "none") return;
  forbidden(`${plan.name} does not include private report generation.`);
}

export async function enforceReportExportAccess(
  user: User,
  format: "markdown" | "html" | "json" | "pdf" | "docx"
) {
  const plan = await getEffectivePlan(user);

  if (!plan.includesPdfExport && plan.agentAccess === "none") {
    forbidden(`${plan.name} does not include private report export.`);
  }

  if ((format === "pdf" || format === "docx") && !plan.includesPdfExport) {
    forbidden(`${plan.name} does not include ${format.toUpperCase()} export.`);
  }
}
