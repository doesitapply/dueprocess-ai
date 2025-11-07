import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Subscriptions table - tracks user subscription status
 */
export const subscriptions = mysqlTable("subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 255 }),
  stripePriceId: varchar("stripePriceId", { length: 255 }),
  plan: mysqlEnum("plan", ["free", "pro", "enterprise"]).default("free").notNull(),
  status: mysqlEnum("status", ["active", "canceled", "past_due", "trialing"]).default("active"),
  currentPeriodStart: timestamp("currentPeriodStart"),
  currentPeriodEnd: timestamp("currentPeriodEnd"),
  cancelAtPeriodEnd: int("cancelAtPeriodEnd").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = typeof subscriptions.$inferInsert;

/**
 * Payments table - tracks payment history
 */
export const payments = mysqlTable("payments", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 255 }),
  stripeSessionId: varchar("stripeSessionId", { length: 255 }),
  amount: int("amount").notNull(), // in cents
  currency: varchar("currency", { length: 10 }).default("usd").notNull(),
  status: mysqlEnum("status", ["pending", "succeeded", "failed", "refunded"]).default("pending").notNull(),
  plan: varchar("plan", { length: 50 }),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = typeof payments.$inferInsert;

/**
 * Documents table - stores uploaded court transcripts
 */
export const documents = mysqlTable("documents", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileUrl: text("fileUrl").notNull(),
  fileKey: text("fileKey").notNull(),
  mimeType: varchar("mimeType", { length: 100 }),
  fileSize: int("fileSize"),
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed"]).default("pending").notNull(),
  summary: text("summary"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;

/**
 * Agent outputs table - stores results from Jester, Clerk, and Hobot
 */
export const agentOutputs = mysqlTable("agent_outputs", {
  id: int("id").autoincrement().primaryKey(),
  documentId: int("documentId").notNull(),
  
  // Justice Jester outputs
  jesterMemeCaption: text("jesterMemeCaption"),
  jesterTiktokScript: text("jesterTiktokScript"),
  jesterQuote: text("jesterQuote"),
  
  // Law Clerk outputs
  clerkViolations: text("clerkViolations"), // JSON array
  clerkCaseLaw: text("clerkCaseLaw"), // JSON array
  clerkMotionDraft: text("clerkMotionDraft"),
  
  // Hobot outputs
  hobotProductName: varchar("hobotProductName", { length: 255 }),
  hobotDescription: text("hobotDescription"),
  hobotLink: text("hobotLink"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AgentOutput = typeof agentOutputs.$inferSelect;
export type InsertAgentOutput = typeof agentOutputs.$inferInsert;

