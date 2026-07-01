import "dotenv/config";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import type { TrpcContext } from "./_core/context";
import type { InvokeParams, InvokeResult } from "./_core/llm";
import type { User } from "../drizzle/schema";

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(async (_params: InvokeParams): Promise<InvokeResult> => ({
    id: "mock-report-section-regeneration",
    created: Date.now(),
    model: "mock-model",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: "# Section One\n\nRegenerated only this section.",
        },
        finish_reason: "stop",
      },
    ],
    usage: {
      prompt_tokens: 20,
      completion_tokens: 8,
      total_tokens: 28,
    },
  })),
}));

const { appRouter } = await import("./routers");
const {
  createGeneratedReport,
  createReportRevision,
  getDb,
  getUserByOpenId,
  upsertSubscription,
  upsertUser,
} = await import("./db");
const {
  generatedReports,
  llmUsageEvents,
  reportRevisions,
  subscriptions,
  users,
} = await import("../drizzle/schema");

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

type Fixture = {
  user: User;
  openId: string;
  reportId: number;
  revisionId: number;
};

const initialSections = [
  {
    sectionId: "section-one",
    title: "Section One",
    kind: "packet_section",
    level: 1,
    markdown: "# Section One\n\nOriginal first section.",
    includedInExport: true,
    sourceFindingIds: [],
    sourceDocumentIds: [],
    edited: false,
    generatedVersion: "# Section One\n\nOriginal first section.",
  },
  {
    sectionId: "section-two",
    title: "Section Two",
    kind: "packet_section",
    level: 1,
    markdown: "# Section Two\n\nThis second section must stay untouched.",
    includedInExport: true,
    sourceFindingIds: [],
    sourceDocumentIds: [],
    edited: false,
    generatedVersion: "# Section Two\n\nThis second section must stay untouched.",
  },
];

function contextFor(user: User): TrpcContext {
  return {
    req: {
      headers: {},
      hostname: "localhost",
      protocol: "http",
    } as TrpcContext["req"],
    res: {
      clearCookie: () => undefined,
      cookie: () => undefined,
    } as unknown as TrpcContext["res"],
    user,
  };
}

async function createFixture(): Promise<Fixture> {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const openId = `report-regenerate-${suffix}`;
  await upsertUser({
    openId,
    name: "Report Regenerate Test",
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

  const markdown = initialSections.map(section => section.markdown).join("\n\n");
  const report = await createGeneratedReport({
    userId: user.id,
    title: "Regeneration Fixture Report",
    template: "court_packet",
    scope: "case",
    format: "markdown",
    fileName: "regeneration-fixture-report.md",
    documentIds: JSON.stringify([]),
    selectedFindingIds: JSON.stringify([]),
    minConfidence: 0,
    includeBlockedFindings: 0,
    content: markdown,
    metadata: JSON.stringify({ sections: initialSections, markdown }),
  });
  const revision = await createReportRevision({
    reportId: report.id,
    userId: user.id,
    title: report.title,
    markdown,
    sections: JSON.stringify(initialSections),
    editReason: "Initial fixture revision",
  });

  return {
    user,
    openId,
    reportId: report.id,
    revisionId: revision.id,
  };
}

async function cleanupFixture(fixture: Fixture | null) {
  if (!fixture) return;
  const db = await getDb();
  if (!db) return;

  await db.delete(llmUsageEvents).where(eq(llmUsageEvents.userId, fixture.user.id));
  await db
    .delete(reportRevisions)
    .where(eq(reportRevisions.reportId, fixture.reportId));
  await db
    .delete(generatedReports)
    .where(eq(generatedReports.id, fixture.reportId));
  await db
    .delete(subscriptions)
    .where(eq(subscriptions.userId, fixture.user.id));
  await db.delete(users).where(eq(users.openId, fixture.openId));
}

describeWithDb("report section regeneration", () => {
  let fixture: Fixture | null = null;

  beforeEach(async () => {
    fixture = await createFixture();
  });

  afterEach(async () => {
    await cleanupFixture(fixture);
    fixture = null;
  });

  it("saves a new revision while changing only the requested section", async () => {
    if (!fixture) throw new Error("Fixture missing");
    const caller = appRouter.createCaller(contextFor(fixture.user));

    const regenerated = await caller.reports.regenerateSection({
      reportId: fixture.reportId,
      sectionId: "section-one",
      instruction: "Make this section clearer.",
    });
    const exported = await caller.reports.exportRevision({
      reportId: fixture.reportId,
      revisionId: regenerated.id,
      format: "json",
    });
    const exportBody = JSON.parse(exported.content);

    expect(regenerated.id).not.toBe(fixture.revisionId);
    expect(regenerated.revisionNumber).toBe(2);
    expect(regenerated.sections[0].markdown).toContain(
      "Regenerated only this section."
    );
    expect(regenerated.sections[0].edited).toBe(true);
    expect(regenerated.sections[0].generatedVersion).toContain(
      "Original first section."
    );
    expect(regenerated.sections[1].markdown).toContain(
      "This second section must stay untouched."
    );
    expect(exportBody.markdown).toContain("Regenerated only this section.");
    expect(exportBody.markdown).toContain(
      "This second section must stay untouched."
    );
  });
});
