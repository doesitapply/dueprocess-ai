import { and, desc, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, 
  users, 
  documents, 
  InsertDocument, 
  Document, 
  agentOutputs, 
  InsertAgentOutput, 
  AgentOutput,
  subscriptions,
  InsertSubscription,
  Subscription,
  payments,
  InsertPayment,
  Payment,
  swarmSessions,
  InsertSwarmSession,
  SwarmSession,
  swarmAgentResults,
  InsertSwarmAgentResult,
  SwarmAgentResult,
  agentRuns,
  InsertAgentRun,
  AgentRun,
  agentFindings,
  InsertAgentFinding,
  AgentFinding,
  agentFindingAudits,
  InsertAgentFindingAudit,
  AgentFindingAudit,
  llmUsageEvents,
  InsertLlmUsageEvent,
  LlmUsageEvent,
  generatedReports,
  InsertGeneratedReport,
  GeneratedReport
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    } else if (user.role !== undefined && user.role !== 'admin') {
      values.role = user.role;
      updateSet.role = user.role;
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// Document queries
export async function createDocument(doc: InsertDocument): Promise<Document> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(documents).values(doc);
  const insertedId = Number(result[0].insertId);
  
  const inserted = await db.select().from(documents).where(eq(documents.id, insertedId)).limit(1);
  return inserted[0];
}

export async function getDocumentById(id: number): Promise<Document | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
  return result[0];
}

export async function getUserDocuments(userId: number): Promise<Document[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(documents).where(eq(documents.userId, userId)).orderBy(desc(documents.createdAt));
}

export async function updateDocumentStatus(id: number, status: Document['status'], summary?: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const updateData: Partial<Document> = { status };
  if (summary !== undefined) {
    updateData.summary = summary;
  }

  await db.update(documents).set(updateData).where(eq(documents.id, id));
}

// Agent output queries
export async function createAgentOutput(output: InsertAgentOutput): Promise<AgentOutput> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(agentOutputs).values(output);
  const insertedId = Number(result[0].insertId);
  
  const inserted = await db.select().from(agentOutputs).where(eq(agentOutputs.id, insertedId)).limit(1);
  return inserted[0];
}

export async function getAgentOutputByDocumentId(documentId: number): Promise<AgentOutput | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(agentOutputs).where(eq(agentOutputs.documentId, documentId)).limit(1);
  return result[0];
}

export async function getAgentOutputsByDocumentId(documentId: number): Promise<AgentOutput[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(agentOutputs).where(eq(agentOutputs.documentId, documentId)).orderBy(desc(agentOutputs.createdAt));
}

export async function getAgentOutputsByDocumentIds(documentIds: number[]): Promise<AgentOutput[]> {
  const db = await getDb();
  if (!db || documentIds.length === 0) return [];

  return db.select().from(agentOutputs).where(inArray(agentOutputs.documentId, documentIds)).orderBy(desc(agentOutputs.createdAt));
}

export async function deleteAgentOutputById(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(agentOutputs).where(eq(agentOutputs.id, id));
}

export async function deleteAgentOutputsByDocumentIds(documentIds: number[]): Promise<void> {
  const db = await getDb();
  if (!db || documentIds.length === 0) return;

  await db.delete(agentOutputs).where(inArray(agentOutputs.documentId, documentIds));
}

// Leverage engine queries
export async function createAgentRun(run: InsertAgentRun): Promise<AgentRun> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(agentRuns).values(run);
  const insertedId = Number(result[0].insertId);
  const inserted = await db.select().from(agentRuns).where(eq(agentRuns.id, insertedId)).limit(1);
  return inserted[0];
}

export async function updateAgentRun(id: number, update: Partial<AgentRun>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(agentRuns).set(update).where(eq(agentRuns.id, id));
}

export async function createAgentFinding(finding: InsertAgentFinding): Promise<AgentFinding> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(agentFindings).values(finding);
  const insertedId = Number(result[0].insertId);
  const inserted = await db.select().from(agentFindings).where(eq(agentFindings.id, insertedId)).limit(1);
  return inserted[0];
}

export async function updateAgentFinding(id: number, update: Partial<AgentFinding>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(agentFindings).set(update).where(eq(agentFindings.id, id));
}

export async function getAgentFindingsByUserId(userId: number): Promise<AgentFinding[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(agentFindings).where(eq(agentFindings.userId, userId)).orderBy(desc(agentFindings.createdAt));
}

export async function getAgentFindingsByRunId(runId: number): Promise<AgentFinding[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(agentFindings).where(eq(agentFindings.runId, runId)).orderBy(desc(agentFindings.leverageScore));
}

export async function createAgentFindingAudit(audit: InsertAgentFindingAudit): Promise<AgentFindingAudit> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(agentFindingAudits).values(audit);
  const insertedId = Number(result[0].insertId);
  const inserted = await db.select().from(agentFindingAudits).where(eq(agentFindingAudits.id, insertedId)).limit(1);
  return inserted[0];
}

export async function createLlmUsageEvent(event: InsertLlmUsageEvent): Promise<LlmUsageEvent> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(llmUsageEvents).values(event);
  const insertedId = Number(result[0].insertId);
  const inserted = await db.select().from(llmUsageEvents).where(eq(llmUsageEvents.id, insertedId)).limit(1);
  return inserted[0];
}

export async function getLlmUsageEventsByUserId(userId: number): Promise<LlmUsageEvent[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(llmUsageEvents).where(eq(llmUsageEvents.userId, userId)).orderBy(desc(llmUsageEvents.createdAt));
}

// Generated report queries
export async function createGeneratedReport(report: InsertGeneratedReport): Promise<GeneratedReport> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(generatedReports).values(report);
  const insertedId = Number(result[0].insertId);
  const inserted = await db.select().from(generatedReports).where(eq(generatedReports.id, insertedId)).limit(1);
  return inserted[0];
}

export async function getGeneratedReportsByUserId(userId: number): Promise<GeneratedReport[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(generatedReports).where(eq(generatedReports.userId, userId)).orderBy(desc(generatedReports.createdAt));
}

export async function getGeneratedReportById(id: number): Promise<GeneratedReport | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(generatedReports).where(eq(generatedReports.id, id)).limit(1);
  return result[0];
}

export async function deleteGeneratedReportById(id: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(generatedReports).where(and(eq(generatedReports.id, id), eq(generatedReports.userId, userId)));
}

function safeNumberArray(value: string | null | undefined): number[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => Number(item))
      .filter((item) => Number.isInteger(item) && item > 0);
  } catch {
    return [];
  }
}

function sourceAnchorsReferenceDocuments(value: string | null | undefined, documentIds: Set<number>): boolean {
  if (!value) return false;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return false;
    return parsed.some((item) => {
      if (!item || typeof item !== "object") return false;
      return documentIds.has(Number((item as Record<string, unknown>).documentId));
    });
  } catch {
    return false;
  }
}

function intersectsDocumentSet(values: number[], documentIds: Set<number>): boolean {
  return values.some((value) => documentIds.has(value));
}

export async function deleteAnalysisArtifactsForDocuments(userId: number, documentIds: number[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const uniqueDocumentIds = Array.from(new Set(documentIds.filter((id) => Number.isInteger(id) && id > 0)));
  if (uniqueDocumentIds.length === 0) {
    return {
      agentFindingAudits: 0,
      agentFindings: 0,
      generatedReports: 0,
      agentOutputs: 0,
      agentRuns: 0,
    };
  }

  const documentIdSet = new Set(uniqueDocumentIds);
  const [userRuns, userFindings, userReports, documentOutputs] = await Promise.all([
    db.select().from(agentRuns).where(eq(agentRuns.userId, userId)),
    db.select().from(agentFindings).where(eq(agentFindings.userId, userId)),
    db.select().from(generatedReports).where(eq(generatedReports.userId, userId)),
    db.select().from(agentOutputs).where(inArray(agentOutputs.documentId, uniqueDocumentIds)),
  ]);

  const affectedRunIds = new Set(
    userRuns
      .filter((run) => documentIdSet.has(run.anchorDocumentId) || intersectsDocumentSet(safeNumberArray(run.documentIds), documentIdSet))
      .map((run) => run.id)
  );
  const affectedOutputIds = new Set(documentOutputs.map((output) => output.id));
  const affectedFindingIds = new Set(
    userFindings
      .filter((finding) => (
        affectedRunIds.has(finding.runId) ||
        (finding.outputId ? affectedOutputIds.has(finding.outputId) : false) ||
        sourceAnchorsReferenceDocuments(finding.sourceAnchors, documentIdSet)
      ))
      .map((finding) => finding.id)
  );
  userFindings.forEach((finding) => {
    if (finding.outputId && affectedFindingIds.has(finding.id)) {
      affectedOutputIds.add(finding.outputId);
    }
  });

  const affectedReportIds = userReports
    .filter((report) => (
      intersectsDocumentSet(safeNumberArray(report.documentIds), documentIdSet) ||
      safeNumberArray(report.selectedFindingIds).some((findingId) => affectedFindingIds.has(findingId))
    ))
    .map((report) => report.id);

  const counts = {
    agentFindingAudits: 0,
    agentFindings: affectedFindingIds.size,
    generatedReports: affectedReportIds.length,
    agentOutputs: affectedOutputIds.size,
    agentRuns: affectedRunIds.size,
  };

  const affectedFindingIdList = Array.from(affectedFindingIds);
  if (affectedFindingIdList.length > 0) {
    await db.delete(agentFindingAudits).where(inArray(agentFindingAudits.findingId, affectedFindingIdList));
    counts.agentFindingAudits = affectedFindingIdList.length;
    await db.delete(agentFindings).where(inArray(agentFindings.id, affectedFindingIdList));
  }
  if (affectedReportIds.length > 0) {
    await db.delete(generatedReports).where(inArray(generatedReports.id, affectedReportIds));
  }
  const affectedOutputIdList = Array.from(affectedOutputIds);
  if (affectedOutputIdList.length > 0) {
    await db.delete(agentOutputs).where(inArray(agentOutputs.id, affectedOutputIdList));
  }
  const affectedRunIdList = Array.from(affectedRunIds);
  if (affectedRunIdList.length > 0) {
    await db.delete(agentRuns).where(inArray(agentRuns.id, affectedRunIdList));
  }

  return counts;
}

// Subscription queries
export async function getSubscriptionByUserId(userId: number): Promise<Subscription | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).limit(1);
  return result[0];
}

export async function upsertSubscription(sub: InsertSubscription): Promise<Subscription> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(subscriptions).values(sub).onDuplicateKeyUpdate({
    set: {
      stripeCustomerId: sub.stripeCustomerId,
      stripeSubscriptionId: sub.stripeSubscriptionId,
      stripePriceId: sub.stripePriceId,
      plan: sub.plan,
      status: sub.status,
      currentPeriodStart: sub.currentPeriodStart,
      currentPeriodEnd: sub.currentPeriodEnd,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    },
  });

  const result = await db.select().from(subscriptions).where(eq(subscriptions.userId, sub.userId)).limit(1);
  return result[0];
}

export async function getSubscriptionByStripeId(stripeSubscriptionId: string): Promise<Subscription | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(subscriptions).where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId)).limit(1);
  return result[0];
}

// Payment queries
export async function createPayment(payment: InsertPayment): Promise<Payment> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(payments).values(payment);
  const insertedId = Number(result[0].insertId);
  
  const inserted = await db.select().from(payments).where(eq(payments.id, insertedId)).limit(1);
  return inserted[0];
}

export async function getUserPayments(userId: number): Promise<Payment[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(payments).where(eq(payments.userId, userId)).orderBy(desc(payments.createdAt));
}

export async function updatePaymentStatus(stripeSessionId: string, status: Payment['status']): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(payments).set({ status }).where(eq(payments.stripeSessionId, stripeSessionId));
}



// ============================================
// SWARM PROCESSING HELPERS
// ============================================

export async function createSwarmSession(session: InsertSwarmSession): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(swarmSessions).values(session);
  return Number(result[0].insertId);
}

export async function getSwarmSession(id: number): Promise<SwarmSession | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(swarmSessions).where(eq(swarmSessions.id, id)).limit(1);
  return result[0];
}

export async function updateSwarmSession(id: number, updates: Partial<SwarmSession>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(swarmSessions).set(updates).where(eq(swarmSessions.id, id));
}

export async function getUserSwarmSessions(userId: number): Promise<SwarmSession[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(swarmSessions)
    .where(eq(swarmSessions.userId, userId))
    .orderBy(desc(swarmSessions.createdAt));
}

export async function createSwarmAgentResult(result: InsertSwarmAgentResult): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const insertResult = await db.insert(swarmAgentResults).values(result);
  return Number(insertResult[0].insertId);
}

export async function updateSwarmAgentResult(id: number, updates: Partial<SwarmAgentResult>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(swarmAgentResults).set(updates).where(eq(swarmAgentResults.id, id));
}

export async function getSwarmAgentResults(swarmSessionId: number): Promise<SwarmAgentResult[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(swarmAgentResults)
    .where(eq(swarmAgentResults.swarmSessionId, swarmSessionId))
    .orderBy(desc(swarmAgentResults.createdAt));
}
