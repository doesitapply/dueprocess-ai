import { TRPCError } from "@trpc/server";
import type { User } from "../drizzle/schema";
import { getSubscriptionByUserId, getUserDocuments } from "./db";
import { PLATFORM_SUBSCRIPTIONS, type PlatformSubscription, type SubscriptionTier } from "./products";

function isConfiguredOwner(user: Pick<User, "role" | "openId">) {
  return Boolean(process.env.OWNER_OPEN_ID && user.openId === process.env.OWNER_OPEN_ID && user.role === "admin");
}

function forbidden(message: string): never {
  throw new TRPCError({ code: "FORBIDDEN", message });
}

export async function getEffectivePlan(user: User): Promise<PlatformSubscription> {
  if (isConfiguredOwner(user)) return PLATFORM_SUBSCRIPTIONS.firm;

  const subscription = await getSubscriptionByUserId(user.id);
  const planId = (subscription?.status === "active" ? subscription.plan : "free") as SubscriptionTier;
  return PLATFORM_SUBSCRIPTIONS[planId] ?? PLATFORM_SUBSCRIPTIONS.free;
}

export async function enforceDocumentUploadLimit(user: User) {
  const plan = await getEffectivePlan(user);
  const limit = plan.limits.documentUploads;
  if (limit === "unlimited" || limit === "metered") return;

  const documents = await getUserDocuments(user.id);
  if (documents.length >= limit) {
    forbidden(`${plan.name} allows ${limit} document upload${limit === 1 ? "" : "s"}. Upgrade before uploading more private records.`);
  }
}

export async function enforceAgentRunAccess(user: User, sector: "tactical" | "legal" | "intel" | "evidence" | "offensive") {
  const plan = await getEffectivePlan(user);
  if (plan.agentAccess === "all") return;
  if (plan.agentAccess === "evidence" && sector === "evidence") return;
  forbidden(`${plan.name} does not include ${sector} agent runs.`);
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
