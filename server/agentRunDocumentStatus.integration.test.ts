import "dotenv/config";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { inArray } from "drizzle-orm";
import type { TrpcContext } from "./_core/context";
import type { InvokeParams, InvokeResult } from "./_core/llm";
import type { User } from "../drizzle/schema";

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(async (params: InvokeParams): Promise<InvokeResult> => {
    const systemPrompt = String(params.messages[0]?.content || "");
    if (systemPrompt.includes("Contradiction Detector")) {
      throw new Error("Synthetic contradiction agent failure");
    }

    return {
      id: "mock-agent-run",
      created: Date.now(),
      model: "mock-model",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: JSON.stringify({
              summary: "No structured findings in this synthetic regression run.",
              findings: [],
            }),
          },
          finish_reason: "stop",
        },
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15,
      },
    };
  }),
}));

const { appRouter } = await import("./routers");
const {
  createDocument,
  getDb,
  getDocumentById,
  getSubscriptionByUserId,
  getUserByOpenId,
  upsertSubscription,
  upsertUser,
} = await import("./db");
const {
  agentFindingAudits,
  agentFindings,
  agentOutputs,
  agentRuns,
  documents,
  subscriptions,
  users,
} = await import("../drizzle/schema");

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;
const sourceHash = "d".repeat(64);

type Fixture = {
  user: User;
  documentId: number;
  openId: string;
};

function contextFor(user: User): TrpcContext {
  return {
    req: { headers: {}, hostname: "localhost", protocol: "http" } as TrpcContext["req"],
    res: {
      clearCookie: () => undefined,
      cookie: () => undefined,
    } as unknown as TrpcContext["res"],
    user,
  };
}

async function createFixture(): Promise<Fixture> {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const openId = `agent-run-status-${suffix}`;
  await upsertUser({
    openId,
    name: "Agent Run Status Test",
    email: `${openId}@example.test`,
    loginMethod: "test",
    lastSignedIn: new Date(),
  });
  const user = await getUserByOpenId(openId);
  if (!user) throw new Error("Synthetic user was not created");
  await upsertSubscription({
    userId: user.id,
    plan: "firm",
    status: "active",
    stripeCustomerId: `cus_${suffix}`,
    stripeSubscriptionId: `sub_${suffix}`,
    stripePriceId: "price_test_firm",
    cancelAtPeriodEnd: 0,
  });

  const document = await createDocument({
    userId: user.id,
    fileName: `agent-run-status-${suffix}.txt`,
    fileUrl: "memory://agent-run-status",
    fileKey: `agent-run-status/${suffix}.txt`,
    mimeType: "text/plain",
    fileSize: 512,
    documentHash: sourceHash,
    extractionMethod: "test_fixture",
    extractionNote: null,
    extractionTextLength: 148,
    extractionQualityScore: 100,
    extractionWarnings: JSON.stringify([]),
    extractedText: `SOURCE_SHA256: ${sourceHash}\n\nThis synthetic evidence record is complete and analysis-ready before any agent run. It must stay completed even if one later agent fails.`,
    status: "completed",
    summary: "Analysis-ready fixture document",
  });

  return { user, documentId: document.id, openId };
}

async function cleanupFixture(fixture: Fixture | null) {
  if (!fixture) return;
  const db = await getDb();
  if (!db) return;
  const runs = await db.select().from(agentRuns);
  const userRunIds = runs.filter((run) => run.userId === fixture.user.id).map((run) => run.id);
  const outputs = await db.select().from(agentOutputs);
  const userOutputIds = outputs.filter((output) => output.documentId === fixture.documentId).map((output) => output.id);
  const findings = await db.select().from(agentFindings);
  const userFindingIds = findings.filter((finding) => finding.userId === fixture.user.id).map((finding) => finding.id);

  if (userFindingIds.length > 0) {
    await db.delete(agentFindingAudits).where(inArray(agentFindingAudits.findingId, userFindingIds));
    await db.delete(agentFindings).where(inArray(agentFindings.id, userFindingIds));
  }
  if (userOutputIds.length > 0) {
    await db.delete(agentOutputs).where(inArray(agentOutputs.id, userOutputIds));
  }
  if (userRunIds.length > 0) {
    await db.delete(agentRuns).where(inArray(agentRuns.id, userRunIds));
  }
  await db.delete(documents).where(inArray(documents.id, [fixture.documentId]));
  const subscription = await getSubscriptionByUserId(fixture.user.id);
  if (subscription) {
    await db.delete(subscriptions).where(inArray(subscriptions.id, [subscription.id]));
  }
  await db.delete(users).where(inArray(users.openId, [fixture.openId]));
}

describeWithDb("agent run document status isolation", () => {
  let fixture: Fixture | null = null;

  beforeEach(async () => {
    fixture = await createFixture();
  });

  afterEach(async () => {
    await cleanupFixture(fixture);
    fixture = null;
  });

  it("keeps extraction status completed when a later scoped agent run partially fails", async () => {
    if (!fixture) throw new Error("Fixture missing");
    const caller = appRouter.createCaller(contextFor(fixture.user));

    const result = await caller.agents.processScope({
      sector: "evidence",
      scope: "file",
      documentIds: [fixture.documentId],
    });
    const document = await getDocumentById(fixture.documentId);

    expect(result.success).toBe(true);
    expect(result.completedAgents).toBeLessThan(result.totalAgents);
    expect(document?.status).toBe("completed");
    expect(document?.documentHash).toBe(sourceHash);
    expect(document?.extractionQualityScore).toBe(100);
  });
});
