import { eq, desc } from "drizzle-orm";
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
  Payment
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
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
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

