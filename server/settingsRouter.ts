import mysql from "mysql2/promise";
import { protectedProcedure, router } from "./_core/trpc";
import { getAgentOutputsByDocumentIds, getLlmUsageEventsByUserId, getUserDocuments } from "./db";

type CountRow = { count: number | string };
type UsageTrackingRow = {
  pages_used: number | null;
  swarm_runs_used: number | null;
  case_slots_used: number | null;
  billing_period_start: Date | string | null;
  billing_period_end: Date | string | null;
};
type SubscriptionLimitRow = {
  plan: string;
  pagesPerMonth: number | null;
  swarmsPerMonth: number | null;
  maxCases: number | null;
};
type SubscriptionRow = {
  plan: string | null;
  status: string | null;
};
type ExportJobRow = {
  status: string;
  count: number | string;
};
type ChatUsageRow = {
  count: number | string;
  chars: number | string | null;
};

function estimateTokensFromText(value: string): number {
  return Math.ceil(value.length / 4);
}

function estimateUsd(tokens: number): number {
  // Stored output text does not include provider usage metadata yet.
  // This is a conservative display estimate for persisted text volume only.
  return Number(((tokens / 1_000_000) * 5).toFixed(4));
}

async function getRawConnection() {
  if (!process.env.DATABASE_URL) return null;
  return mysql.createConnection({
    uri: process.env.DATABASE_URL,
    connectTimeout: 8000,
  });
}

async function safeCount(connection: mysql.Connection, tableName: string, userIdColumn: string, userId: number) {
  try {
    const [rows] = await connection.query<mysql.RowDataPacket[]>(
      `SELECT COUNT(*) AS count FROM \`${tableName}\` WHERE \`${userIdColumn}\` = ?`,
      [userId]
    );
    return Number((rows[0] as CountRow | undefined)?.count ?? 0);
  } catch {
    return 0;
  }
}

export const settingsRouter = router({
  overview: protectedProcedure.query(async ({ ctx }) => {
    const documents = await getUserDocuments(ctx.user.id);
    const outputs = await getAgentOutputsByDocumentIds(documents.map((document) => document.id));
    const readyDocuments = documents.filter((document) => document.status === "completed" && document.extractedText?.trim()).length;

    let dbReachable = false;
    let exportJobs = 0;
    let conversations = 0;

    const connection = await getRawConnection();
    if (connection) {
      try {
        await connection.query("SELECT 1");
        dbReachable = true;
        exportJobs = await safeCount(connection, "export_jobs", "userId", ctx.user.id);
        conversations = await safeCount(connection, "chatConversations", "userId", ctx.user.id);
      } finally {
        await connection.end();
      }
    }

    return {
      user: {
        id: ctx.user.id,
        name: ctx.user.name,
        email: ctx.user.email,
        role: ctx.user.role,
        createdAt: ctx.user.createdAt,
        lastSignedIn: ctx.user.lastSignedIn,
      },
      inventory: {
        documents: documents.length,
        readyDocuments,
        processingDocuments: documents.filter((document) => document.status === "pending" || document.status === "processing").length,
        failedDocuments: documents.filter((document) => document.status === "failed").length,
        savedAgentOutputs: outputs.length,
        exportJobs,
        conversations,
      },
      services: {
        database: dbReachable,
        openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
        stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
        pineconeConfigured: Boolean(process.env.PINECONE_API_KEY && process.env.PINECONE_HOST),
        storageConfigured: true,
      },
      limits: {
        uploadRequestLimitMb: 100,
        reliableRawFileLimitMb: 50,
      },
    };
  }),

  usage: protectedProcedure.query(async ({ ctx }) => {
    const documents = await getUserDocuments(ctx.user.id);
    const outputs = await getAgentOutputsByDocumentIds(documents.map((document) => document.id));
    const usageEvents = await getLlmUsageEventsByUserId(ctx.user.id);
    const byAgent = new Map<string, { outputs: number; characters: number; estimatedTokens: number; estimatedUsd: number }>();
    const exactByOperation = new Map<string, { calls: number; promptTokens: number; completionTokens: number; totalTokens: number; estimatedUsd: number }>();

    outputs.forEach((output) => {
      const name = output.agentName || output.agentId || "Unknown agent";
      const text = output.output || "";
      const current = byAgent.get(name) ?? { outputs: 0, characters: 0, estimatedTokens: 0, estimatedUsd: 0 };
      current.outputs += 1;
      current.characters += text.length;
      current.estimatedTokens += estimateTokensFromText(text);
      current.estimatedUsd = estimateUsd(current.estimatedTokens);
      byAgent.set(name, current);
    });

    usageEvents.forEach((event) => {
      const key = event.operation || "unknown";
      const current = exactByOperation.get(key) ?? { calls: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedUsd: 0 };
      current.calls += 1;
      current.promptTokens += event.promptTokens;
      current.completionTokens += event.completionTokens;
      current.totalTokens += event.totalTokens;
      current.estimatedUsd += event.estimatedCostCents / 100;
      exactByOperation.set(key, current);
    });

    let usageTracking: UsageTrackingRow | null = null;
    let subscription: SubscriptionRow | null = null;
    let subscriptionLimit: SubscriptionLimitRow | null = null;
    let chat: { messages: number; characters: number; estimatedTokens: number; estimatedUsd: number } = {
      messages: 0,
      characters: 0,
      estimatedTokens: 0,
      estimatedUsd: 0,
    };
    let exportJobs: ExportJobRow[] = [];

    const connection = await getRawConnection();
    if (connection) {
      try {
        const [usageRows] = await connection.query<mysql.RowDataPacket[]>(
          "SELECT pages_used, swarm_runs_used, case_slots_used, billing_period_start, billing_period_end FROM usage_tracking WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1",
          [ctx.user.id]
        );
        usageTracking = (usageRows[0] as UsageTrackingRow | undefined) ?? null;

        const [subscriptionRows] = await connection.query<mysql.RowDataPacket[]>(
          "SELECT plan, status FROM subscriptions WHERE userId = ? ORDER BY updatedAt DESC LIMIT 1",
          [ctx.user.id]
        );
        subscription = (subscriptionRows[0] as SubscriptionRow | undefined) ?? null;

        if (subscription?.plan) {
          const [limitRows] = await connection.query<mysql.RowDataPacket[]>(
            "SELECT plan, pagesPerMonth, swarmsPerMonth, maxCases FROM subscription_limits WHERE plan = ? LIMIT 1",
            [subscription.plan]
          );
          subscriptionLimit = (limitRows[0] as SubscriptionLimitRow | undefined) ?? null;
        }

        const [chatRows] = await connection.query<mysql.RowDataPacket[]>(
          `SELECT COUNT(m.id) AS count, COALESCE(SUM(CHAR_LENGTH(m.content)), 0) AS chars
           FROM chatMessages m
           INNER JOIN chatConversations c ON c.id = m.conversationId
           WHERE c.userId = ?`,
          [ctx.user.id]
        );
        const chatRow = chatRows[0] as ChatUsageRow | undefined;
        const chatChars = Number(chatRow?.chars ?? 0);
        const chatTokens = estimateTokensFromText("x".repeat(chatChars));
        chat = {
          messages: Number(chatRow?.count ?? 0),
          characters: chatChars,
          estimatedTokens: chatTokens,
          estimatedUsd: estimateUsd(chatTokens),
        };

        const [exportRows] = await connection.query<mysql.RowDataPacket[]>(
          "SELECT status, COUNT(*) AS count FROM export_jobs WHERE userId = ? GROUP BY status",
          [ctx.user.id]
        );
        exportJobs = exportRows.map((row) => ({
          status: String(row.status),
          count: row.count,
        }));
      } catch {
        // Some Manus-era tables may not exist in every checkout/database. Keep the page live.
      } finally {
        await connection.end();
      }
    }

    const outputTokens = Array.from(byAgent.values()).reduce((sum, item) => sum + item.estimatedTokens, 0);
    const exactTotalTokens = usageEvents.reduce((sum, event) => sum + event.totalTokens, 0);
    const exactTotalCostCents = usageEvents.reduce((sum, event) => sum + event.estimatedCostCents, 0);

    return {
      billing: {
        subscription,
        limit: subscriptionLimit,
        usage: usageTracking,
      },
      aiUsage: {
        exactTokenTelemetryEnabled: usageEvents.length > 0,
        note: usageEvents.length > 0
          ? "Exact LLM token telemetry is persisted for new leverage-engine and report-generation runs. Legacy saved outputs remain estimated from text volume."
          : "No exact LLM usage events have been stored yet. Token and cost values below are estimates from stored text volume until a new leverage-engine run completes.",
        exact: {
          calls: usageEvents.length,
          promptTokens: usageEvents.reduce((sum, event) => sum + event.promptTokens, 0),
          completionTokens: usageEvents.reduce((sum, event) => sum + event.completionTokens, 0),
          totalTokens: exactTotalTokens,
          estimatedUsd: Number((exactTotalCostCents / 100).toFixed(4)),
          byOperation: Array.from(exactByOperation.entries()).map(([operation, metrics]) => ({
            operation,
            ...metrics,
            estimatedUsd: Number(metrics.estimatedUsd.toFixed(4)),
          })),
        },
        savedAgentOutputs: {
          outputs: outputs.length,
          estimatedTokens: outputTokens,
          estimatedUsd: estimateUsd(outputTokens),
          byAgent: Array.from(byAgent.entries()).map(([agentName, metrics]) => ({
            agentName,
            ...metrics,
          })),
        },
        chat,
      },
      exports: exportJobs,
    };
  }),

  monitors: protectedProcedure.query(async ({ ctx }) => {
    const documents = await getUserDocuments(ctx.user.id);
    const outputs = await getAgentOutputsByDocumentIds(documents.map((document) => document.id));
    const processingDocuments = documents.filter((document) => document.status === "pending" || document.status === "processing").length;
    const failedDocuments = documents.filter((document) => document.status === "failed").length;
    const readyDocuments = documents.filter((document) => document.status === "completed" && document.extractedText?.trim()).length;

    const checks = [
      {
        id: "database",
        name: "Database connection",
        status: process.env.DATABASE_URL ? "ok" : "error",
        detail: process.env.DATABASE_URL ? "DATABASE_URL is configured and app queries are active." : "DATABASE_URL is missing.",
      },
      {
        id: "corpus",
        name: "Corpus readiness",
        status: failedDocuments > 0 ? "warn" : "ok",
        detail: `${readyDocuments}/${documents.length} documents ready, ${processingDocuments} processing, ${failedDocuments} failed.`,
      },
      {
        id: "agent-output",
        name: "Saved agent output",
        status: outputs.length > 0 ? "ok" : "warn",
        detail: `${outputs.length} saved agent outputs available for reports and exports.`,
      },
      {
        id: "openai",
        name: "OpenAI API key",
        status: process.env.OPENAI_API_KEY ? "ok" : "error",
        detail: process.env.OPENAI_API_KEY ? "Configured." : "Missing OPENAI_API_KEY.",
      },
      {
        id: "stripe",
        name: "Stripe billing",
        status: process.env.STRIPE_SECRET_KEY ? "ok" : "warn",
        detail: process.env.STRIPE_SECRET_KEY ? "Stripe secret configured." : "Stripe secret missing.",
      },
      {
        id: "cost-telemetry",
        name: "Exact token telemetry",
        status: outputs.length > 0 ? "ok" : "warn",
        detail: "New leverage-engine and report-generation runs persist provider token metadata into llm_usage_events.",
      },
    ];

    return {
      checks,
      suggestedMonitors: [
        "Alert when any document remains processing for more than 10 minutes.",
        "Alert when failed document count is greater than zero.",
        "Alert when estimated saved-output token volume jumps sharply.",
        "Alert when Stripe price IDs or OpenAI key are missing in production.",
      ],
    };
  }),
});
