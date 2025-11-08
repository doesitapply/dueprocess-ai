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
  extractedText: text("extractedText"), // Full text content extracted from file
  embedding: text("embedding"), // JSON string of vector embedding for semantic search
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
  
  // Generic agent fields (for new specialized agents)
  agentId: varchar("agentId", { length: 100 }),
  agentName: varchar("agentName", { length: 255 }),
  output: text("output"), // Full agent output
  
  // Justice Jester outputs (legacy)
  jesterMemeCaption: text("jesterMemeCaption"),
  jesterTiktokScript: text("jesterTiktokScript"),
  jesterQuote: text("jesterQuote"),
  
  // Law Clerk outputs (legacy)
  clerkViolations: text("clerkViolations"), // JSON array
  clerkCaseLaw: text("clerkCaseLaw"), // JSON array
  clerkMotionDraft: text("clerkMotionDraft"),
  
  // Hobot outputs (legacy)
  hobotProductName: varchar("hobotProductName", { length: 255 }),
  hobotDescription: text("hobotDescription"),
  hobotLink: text("hobotLink"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AgentOutput = typeof agentOutputs.$inferSelect;
export type InsertAgentOutput = typeof agentOutputs.$inferInsert;

/**
 * Agent divisions for specialized legal analysis
 */
export const agentDivisions = mysqlTable("agent_divisions", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  category: mysqlEnum("category", ["research", "analysis", "tactical", "evidence", "offensive"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AgentDivision = typeof agentDivisions.$inferSelect;
export type InsertAgentDivision = typeof agentDivisions.$inferInsert;

/**
 * Specialized agents within divisions
 */
export const agents = mysqlTable("agents", {
  id: int("id").autoincrement().primaryKey(),
  divisionId: int("divisionId").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  systemPrompt: text("systemPrompt").notNull(),
  capabilities: text("capabilities"), // JSON array of capabilities
  active: int("active").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Agent = typeof agents.$inferSelect;
export type InsertAgent = typeof agents.$inferInsert;

/**
 * Legal citations and sources
 */
export const legalCitations = mysqlTable("legal_citations", {
  id: int("id").autoincrement().primaryKey(),
  outputId: int("outputId").notNull(), // Links to agentOutputs
  citationType: mysqlEnum("citationType", ["case_law", "statute", "rule", "regulation", "constitution"]).notNull(),
  citation: text("citation").notNull(), // Full citation text
  source: varchar("source", { length: 100 }), // Justia, Westlaw, CourtListener, etc.
  url: text("url"),
  relevance: text("relevance"), // Why this citation matters
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LegalCitation = typeof legalCitations.$inferSelect;
export type InsertLegalCitation = typeof legalCitations.$inferInsert;

/**
 * Agent reasoning and explanations
 */
export const agentReasoning = mysqlTable("agent_reasoning", {
  id: int("id").autoincrement().primaryKey(),
  outputId: int("outputId").notNull(), // Links to agentOutputs
  step: int("step").notNull(), // Step number in reasoning chain
  reasoning: text("reasoning").notNull(), // Explanation of this step
  immunityPiercing: text("immunityPiercing"), // How this pierces immunity
  abstentionBypass: text("abstentionBypass"), // How this bypasses abstention
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AgentReasoning = typeof agentReasoning.$inferSelect;
export type InsertAgentReasoning = typeof agentReasoning.$inferInsert;

/**
 * Integration providers (Google Drive, Slack, etc.)
 */
export const integrationProviders = mysqlTable("integration_providers", {
  id: int("id").autoincrement().primaryKey(),
  providerId: varchar("providerId", { length: 50 }).notNull().unique(), // 'google-drive', 'slack', etc.
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  category: mysqlEnum("category", ["storage", "communication", "automation", "legal", "payment"]).notNull(),
  authType: mysqlEnum("authType", ["oauth2", "api_key", "webhook"]).notNull(),
  active: int("active").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type IntegrationProvider = typeof integrationProviders.$inferSelect;
export type InsertIntegrationProvider = typeof integrationProviders.$inferInsert;

/**
 * User connections to integration providers
 */
export const integrationConnections = mysqlTable("integration_connections", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  providerId: varchar("providerId", { length: 50 }).notNull(),
  accessToken: text("accessToken"), // Encrypted OAuth token
  refreshToken: text("refreshToken"), // Encrypted refresh token
  tokenExpiry: timestamp("tokenExpiry"),
  apiKey: text("apiKey"), // For API key auth
  webhookUrl: text("webhookUrl"),
  webhookSecret: text("webhookSecret"),
  settings: text("settings"), // JSON config
  status: mysqlEnum("status", ["connected", "disconnected", "error"]).default("connected").notNull(),
  lastSync: timestamp("lastSync"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type IntegrationConnection = typeof integrationConnections.$inferSelect;
export type InsertIntegrationConnection = typeof integrationConnections.$inferInsert;

/**
 * Event bus for integration events
 */
export const integrationEvents = mysqlTable("integration_events", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  eventType: varchar("eventType", { length: 100 }).notNull(), // 'export.ready', 'citation.inserted', etc.
  payload: text("payload").notNull(), // JSON event data
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed"]).default("pending").notNull(),
  retryCount: int("retryCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  processedAt: timestamp("processedAt"),
});

export type IntegrationEvent = typeof integrationEvents.$inferSelect;
export type InsertIntegrationEvent = typeof integrationEvents.$inferInsert;

/**
 * Job queue for async integration tasks
 */
export const integrationJobs = mysqlTable("integration_jobs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  connectionId: int("connectionId").notNull(),
  jobType: varchar("jobType", { length: 100 }).notNull(), // 'sync_file', 'send_notification', etc.
  payload: text("payload").notNull(), // JSON job data
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed"]).default("pending").notNull(),
  retryCount: int("retryCount").default(0).notNull(),
  maxRetries: int("maxRetries").default(3).notNull(),
  error: text("error"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
});

export type IntegrationJob = typeof integrationJobs.$inferSelect;
export type InsertIntegrationJob = typeof integrationJobs.$inferInsert;

/**
 * Swarm processing sessions - tracks multi-agent parallel runs
 */
export const swarmSessions = mysqlTable("swarm_sessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  documentId: int("documentId").notNull(),
  sector: varchar("sector", { length: 50 }).notNull(), // 'tactical', 'legal', 'intel', 'evidence', 'offensive'
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed"]).default("pending").notNull(),
  totalAgents: int("totalAgents").notNull(),
  completedAgents: int("completedAgents").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export type SwarmSession = typeof swarmSessions.$inferSelect;
export type InsertSwarmSession = typeof swarmSessions.$inferInsert;

/**
 * Swarm agent results - individual agent outputs within a swarm
 */
export const swarmAgentResults = mysqlTable("swarm_agent_results", {
  id: int("id").autoincrement().primaryKey(),
  swarmSessionId: int("swarmSessionId").notNull(),
  agentId: varchar("agentId", { length: 100 }).notNull(),
  agentName: varchar("agentName", { length: 255 }).notNull(),
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed"]).default("pending").notNull(),
  output: text("output"),
  error: text("error"),
  processingTime: int("processingTime"), // milliseconds
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export type SwarmAgentResult = typeof swarmAgentResults.$inferSelect;
export type InsertSwarmAgentResult = typeof swarmAgentResults.$inferInsert;

