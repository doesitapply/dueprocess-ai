import { ONE_YEAR_MS } from "@shared/const";
import { and, desc, eq, inArray } from "drizzle-orm";
import express, { type Express, type Request, type Response } from "express";
import { z } from "zod";
import {
  agentFindings,
  agentRuns,
  caseDocuments,
  documents,
  generatedReports,
  type User,
  workspaceCases,
} from "../drizzle/schema";
import { enforceDocumentUploadLimit } from "./accessControl";
import { ENV } from "./_core/env";
import { sdk } from "./_core/sdk";
import {
  getDb,
  getUserDocuments,
  getAgentFindingsByUserId,
  upsertUser,
  getUserByOpenId,
} from "./db";
import { appRouter } from "./routers";

const DEFAULT_CASE_ID = "default";
const ACCESS_TOKEN_MS = 7 * 24 * 60 * 60 * 1000;

const mobileRouter = express.Router();

type PendingUpload = {
  caseId: string;
  createdAt: number;
  fileName: string;
  mimeType: string;
  userId: number;
};

const pendingUploads = new Map<string, PendingUpload>();
const completedUploads = new Map<string, unknown>();

const loginSchema = z.object({
  accessKey: z.string().optional(),
  adminAccessKey: z.string().optional(),
  email: z.string().email().optional(),
  name: z.string().optional(),
  password: z.string().optional(),
});

const uploadUrlSchema = z.object({
  caseId: z.string().default(DEFAULT_CASE_ID),
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
});

const directUploadSchema = uploadUrlSchema.extend({
  fileData: z.string().min(1),
});

const agentRunSchema = z.object({
  agentTypes: z.array(z.string()).optional(),
  caseId: z.string().default(DEFAULT_CASE_ID),
  fromDate: z.string().optional(),
  scope: z.enum(["all", "file", "time"]).optional(),
  scopeDocumentIds: z.array(z.union([z.string(), z.number()])).optional(),
  sector: z
    .enum(["tactical", "legal", "intel", "evidence", "offensive"])
    .default("legal"),
  toDate: z.string().optional(),
});

const reportSchema = z.object({
  caseId: z.string().default(DEFAULT_CASE_ID),
  documentIds: z.array(z.number()).optional(),
  format: z.enum(["markdown", "html", "json"]).default("markdown"),
  fromDate: z.string().optional(),
  includeBlockedFindings: z.boolean().default(false),
  includeSources: z.boolean().default(true),
  minConfidence: z.number().min(0).max(100).default(0),
  scope: z.enum(["case", "files", "time"]).default("case"),
  selectedFindingIds: z.array(z.number()).optional(),
  template: z
    .enum([
      "court_packet",
      "case_strategy",
      "written_opinion",
      "evidence_chronology",
      "immunity_relief",
      "mandamus_writ",
      "discovery_demands",
      "executive_summary",
    ])
    .default("executive_summary"),
  toDate: z.string().optional(),
});

type MobileRequest = Request & { user?: User };

function asyncHandler(
  handler: (req: MobileRequest, res: Response) => Promise<void>
) {
  return (req: MobileRequest, res: Response) => {
    handler(req, res).catch(error => sendError(res, error));
  };
}

function sendError(res: Response, error: unknown) {
  const message = error instanceof Error ? error.message : "Request failed";
  const status =
    message.toLowerCase().includes("unauthorized") ||
    message.toLowerCase().includes("forbidden") ||
    message.toLowerCase().includes("invalid session") ||
    message.toLowerCase().includes("missing bearer")
      ? 401
      : message.toLowerCase().includes("not found")
        ? 404
        : message.toLowerCase().includes("not configured") ||
            message.toLowerCase().includes("disabled")
          ? 503
          : 400;

  res.status(status).json({ error: message });
}

function isLoopbackHost(req: Request) {
  const host = req.hostname;
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "10.0.2.2"
  );
}

function getMobileOrigin(req: Request) {
  const protocol = String(
    req.headers["x-forwarded-proto"] || req.protocol || "http"
  ).split(",")[0];
  return `${protocol}://${req.get("host")}`;
}

function numberIds(values: Array<string | number> | undefined) {
  return Array.from(
    new Set(
      (values || [])
        .map(Number)
        .filter(value => Number.isInteger(value) && value > 0)
    )
  );
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

function safeJsonNumberArray(value: string | null | undefined): number[] {
  return safeJsonArray(value)
    .map(Number)
    .filter(value => Number.isInteger(value) && value > 0);
}

function findingDocumentIds(value: string | null | undefined) {
  return safeJsonArray(value)
    .map(anchor => {
      if (!anchor || typeof anchor !== "object") return null;
      const documentId = Number((anchor as Record<string, unknown>).documentId);
      return Number.isInteger(documentId) && documentId > 0 ? documentId : null;
    })
    .filter((documentId): documentId is number => documentId !== null);
}

function intersects(left: Set<number>, right: number[]) {
  return right.some(item => left.has(item));
}

function firstAnchorDocumentId(value: string | null | undefined) {
  for (const anchor of safeJsonArray(value)) {
    if (!anchor || typeof anchor !== "object") continue;
    const documentId = Number((anchor as Record<string, unknown>).documentId);
    if (Number.isInteger(documentId) && documentId > 0)
      return String(documentId);
  }
  return DEFAULT_CASE_ID;
}

function mapMobileCase(input: {
  id: string;
  name: string;
  court?: string | null;
  documentCount: number;
  findingCount: number;
  latestDate?: Date | string | null;
  status: string;
  isActive: boolean;
}) {
  return {
    id: input.id,
    name: input.name,
    court: input.court || "Unassigned",
    documentCount: input.documentCount,
    findingCount: input.findingCount,
    date:
      input.latestDate instanceof Date
        ? input.latestDate.toISOString()
        : input.latestDate
          ? String(input.latestDate)
          : "",
    status: input.status,
    isActive: input.isActive,
  };
}

async function getMobileCaseDocumentIds(userId: number, caseId: string) {
  if (caseId === DEFAULT_CASE_ID) return null;
  const numericCaseId = Number(caseId);
  if (!Number.isInteger(numericCaseId) || numericCaseId <= 0) {
    throw new Error("Case not found");
  }
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [caseRecord] = await db
    .select({ id: workspaceCases.id })
    .from(workspaceCases)
    .where(
      and(
        eq(workspaceCases.id, numericCaseId),
        eq(workspaceCases.userId, userId)
      )
    )
    .limit(1);
  if (!caseRecord) throw new Error("Case not found");
  const memberships = await db
    .select({ documentId: caseDocuments.documentId })
    .from(caseDocuments)
    .where(
      and(
        eq(caseDocuments.userId, userId),
        eq(caseDocuments.caseId, numericCaseId)
      )
    );
  return memberships.map(membership => membership.documentId);
}

async function getMobileDocumentsForCase(userId: number, caseId: string) {
  const docs = await getUserDocuments(userId);
  const documentIds = await getMobileCaseDocumentIds(userId, caseId);
  if (documentIds === null) return docs;
  const allowedIds = new Set(documentIds);
  return docs.filter(document => allowedIds.has(document.id));
}

async function assignMobileDocumentToCase(
  userId: number,
  caseId: string,
  documentId: number | undefined
) {
  if (!documentId || caseId === DEFAULT_CASE_ID) return;
  const numericCaseId = Number(caseId);
  if (!Number.isInteger(numericCaseId) || numericCaseId <= 0) return;
  const db = await getDb();
  if (!db) return;
  await getMobileCaseDocumentIds(userId, caseId);
  const existing = await db
    .select({ id: caseDocuments.id })
    .from(caseDocuments)
    .where(
      and(
        eq(caseDocuments.userId, userId),
        eq(caseDocuments.caseId, numericCaseId),
        eq(caseDocuments.documentId, documentId)
      )
    )
    .limit(1);
  if (existing[0]) return;
  await db.insert(caseDocuments).values({
    userId,
    caseId: numericCaseId,
    documentId,
    role: "primary",
  });
}

async function scopeMobileReportInput(
  userId: number,
  input: z.infer<typeof reportSchema>
) {
  const { caseId, ...reportInput } = input;
  const caseDocumentIds = await getMobileCaseDocumentIds(userId, caseId);
  if (caseDocumentIds === null || reportInput.documentIds?.length) {
    return reportInput;
  }
  return {
    ...reportInput,
    scope: "files" as const,
    documentIds: caseDocumentIds,
  };
}

function documentCategory(mimeType: string | null) {
  if (!mimeType) return "Evidence";
  if (mimeType.includes("pdf") || mimeType.includes("word")) return "Filings";
  if (
    mimeType.includes("image") ||
    mimeType.includes("audio") ||
    mimeType.includes("video")
  )
    return "Media";
  if (mimeType.includes("text")) return "Transcripts";
  return "Evidence";
}

function mapDocument(
  document: Awaited<ReturnType<typeof getUserDocuments>>[number],
  caseId = DEFAULT_CASE_ID
) {
  return {
    id: String(document.id),
    caseId,
    title: document.fileName,
    category: documentCategory(document.mimeType),
    status: document.status,
    qualityScore: document.extractionQualityScore ?? 0,
    aiSummary: document.summary || document.extractionNote || "",
    dateAdded:
      document.createdAt instanceof Date
        ? document.createdAt.toISOString()
        : String(document.createdAt),
    mimeType: document.mimeType,
    fileSize: document.fileSize,
    documentHash: document.documentHash,
    analysisReady:
      document.status === "completed" &&
      Boolean(
        document.extractedText && document.extractedText.trim().length > 0
      ) &&
      Boolean(document.documentHash),
  };
}

function mapFinding(
  finding: Awaited<ReturnType<typeof getAgentFindingsByUserId>>[number]
) {
  return {
    id: String(finding.id),
    documentId: firstAnchorDocumentId(finding.sourceAnchors),
    tag: finding.findingType,
    title: finding.title,
    description: finding.summary,
    severity: finding.severity,
    confidenceScore: finding.confidence,
    actionRequired: finding.nextAction || "",
    status: finding.qcStatus,
    leverageScore: finding.leverageScore,
    liabilityVector: finding.liabilityVector,
    remedyPath: finding.remedyPath,
    sourceAnchors: safeJsonArray(finding.sourceAnchors),
    missingRecords: safeJsonArray(finding.missingRecords),
    legalAuthorities: safeJsonArray(finding.legalAuthorities),
    includedInReports: Boolean(finding.includedInReports),
    createdAt:
      finding.createdAt instanceof Date
        ? finding.createdAt.toISOString()
        : String(finding.createdAt),
  };
}

function mapReport(report: typeof generatedReports.$inferSelect) {
  return {
    id: String(report.id),
    title: report.title,
    template: report.template,
    scope: report.scope,
    format: report.format,
    fileName: report.fileName,
    minConfidence: report.minConfidence,
    includeBlockedFindings: Boolean(report.includeBlockedFindings),
    createdAt:
      report.createdAt instanceof Date
        ? report.createdAt.toISOString()
        : String(report.createdAt),
    updatedAt:
      report.updatedAt instanceof Date
        ? report.updatedAt.toISOString()
        : String(report.updatedAt),
  };
}

function caller(req: MobileRequest, res: Response) {
  if (!req.user) throw new Error("Unauthorized");
  return appRouter.createCaller({ req, res, user: req.user });
}

async function mobileAuth(req: MobileRequest, res: Response, next: () => void) {
  try {
    req.user = await sdk.authenticateBearerToken(req.headers.authorization);
    next();
  } catch (error) {
    sendError(res, error);
  }
}

async function issueTokensForUser(user: User) {
  const accessToken = await sdk.createSessionToken(user.openId, {
    name: user.name || "",
    email: user.email,
    loginMethod: "mobile",
    expiresInMs: ACCESS_TOKEN_MS,
  });
  const refreshToken = await sdk.createSessionToken(user.openId, {
    name: user.name || "",
    email: user.email,
    loginMethod: "mobile-refresh",
    expiresInMs: ONE_YEAR_MS,
  });

  return { accessToken, refreshToken };
}

async function resolveLoginUser(
  input: z.infer<typeof loginSchema>,
  req: Request
) {
  const configuredAccessKey = process.env.MOBILE_AUTH_ACCESS_KEY;
  const configuredAdminAccessKey = process.env.MOBILE_ADMIN_ACCESS_KEY;
  const submittedKey = input.accessKey || input.password || "";
  const submittedAdminKey = input.adminAccessKey || submittedKey;
  const adminKeyMatches = Boolean(
    configuredAdminAccessKey && submittedAdminKey === configuredAdminAccessKey
  );

  if (configuredAccessKey || configuredAdminAccessKey) {
    if (!adminKeyMatches && submittedKey !== configuredAccessKey) {
      throw new Error("Unauthorized mobile login");
    }
  } else if (process.env.NODE_ENV === "production" || !isLoopbackHost(req)) {
    throw new Error(
      "Mobile login disabled: set MOBILE_AUTH_ACCESS_KEY outside local development."
    );
  }

  const ownerEmail = process.env.OWNER_EMAIL?.toLowerCase();
  const email =
    input.email?.toLowerCase() ||
    process.env.OWNER_EMAIL?.toLowerCase() ||
    null;
  const isOwnerLogin = Boolean(
    ENV.ownerOpenId &&
      (adminKeyMatches ||
        (!configuredAccessKey && !configuredAdminAccessKey) ||
        (email && ownerEmail && email === ownerEmail))
  );
  const openId = isOwnerLogin ? ENV.ownerOpenId : `mobile:${email || "local"}`;
  const name = input.name || process.env.OWNER_NAME || email || "Mobile User";

  await upsertUser({
    openId,
    name,
    email,
    loginMethod: "mobile",
    lastSignedIn: new Date(),
  });

  const user = await getUserByOpenId(openId);
  if (!user) throw new Error("Mobile login failed");
  return user;
}

mobileRouter.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "dueprocess-mobile-api",
    version: 1,
  });
});

mobileRouter.post(
  "/auth/login",
  asyncHandler(async (req, res) => {
    const input = loginSchema.parse(req.body || {});
    const user = await resolveLoginUser(input, req);
    const tokens = await issueTokensForUser(user);
    res.json({
      ...tokens,
      userId: String(user.id),
      user: {
        id: String(user.id),
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  })
);

mobileRouter.post(
  "/auth/refresh",
  asyncHandler(async (req, res) => {
    const input = z
      .object({ refreshToken: z.string().min(1) })
      .parse(req.body || {});
    const user = await sdk.authenticateBearerToken(
      `Bearer ${input.refreshToken}`
    );
    const tokens = await issueTokensForUser(user);
    res.json({
      ...tokens,
      userId: String(user.id),
    });
  })
);

mobileRouter.get(
  "/auth/me",
  mobileAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    res.json({
      id: String(user.id),
      name: user.name,
      email: user.email,
      role: user.role,
    });
  })
);

mobileRouter.get(
  "/cases",
  mobileAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const [userDocuments, findings] = await Promise.all([
      getUserDocuments(user.id),
      getAgentFindingsByUserId(user.id),
    ]);
    const db = await getDb();
    const latestDocument = userDocuments[0];
    const fallbackCase = mapMobileCase({
      id: DEFAULT_CASE_ID,
      name: user.name
        ? `${user.name}'s DueProcess case file`
        : "DueProcess case file",
      court: "Unassigned",
      documentCount: userDocuments.length,
      findingCount: findings.length,
      latestDate: latestDocument?.createdAt,
      status: userDocuments.some(document => document.status === "failed")
        ? "needs_attention"
        : "synced",
      isActive: true,
    });

    if (!db) {
      res.json([fallbackCase]);
      return;
    }

    const cases = await db
      .select()
      .from(workspaceCases)
      .where(eq(workspaceCases.userId, user.id))
      .orderBy(desc(workspaceCases.updatedAt));
    if (cases.length === 0) {
      res.json([fallbackCase]);
      return;
    }

    const memberships = await db
      .select()
      .from(caseDocuments)
      .where(eq(caseDocuments.userId, user.id));
    const documentsById = new Map(
      userDocuments.map(document => [document.id, document])
    );
    const mappedCases = cases.map(caseItem => {
      const documentIds = memberships
        .filter(membership => membership.caseId === caseItem.id)
        .map(membership => membership.documentId);
      const documentIdSet = new Set(documentIds);
      const caseDocumentsInScope = documentIds
        .map(documentId => documentsById.get(documentId))
        .filter(Boolean);
      const findingsInScope = findings.filter(finding =>
        intersects(documentIdSet, findingDocumentIds(finding.sourceAnchors))
      );
      const latest = caseDocumentsInScope[0]?.createdAt;
      return mapMobileCase({
        id: String(caseItem.id),
        name: caseItem.title,
        court: caseItem.jurisdiction,
        documentCount: caseDocumentsInScope.length,
        findingCount: findingsInScope.length,
        latestDate: latest,
        status: caseDocumentsInScope.some(
          document => document?.status === "failed"
        )
          ? "needs_attention"
          : caseDocumentsInScope.some(
                document =>
                  document?.status === "pending" ||
                  document?.status === "processing"
              )
            ? "processing"
            : "synced",
        isActive: caseItem.status === "active",
      });
    });

    res.json([fallbackCase, ...mappedCases]);
  })
);

mobileRouter.get(
  "/cases/:caseId/documents",
  mobileAuth,
  asyncHandler(async (req, res) => {
    const docs = await getMobileDocumentsForCase(
      req.user!.id,
      req.params.caseId
    );
    res.json(docs.map(document => mapDocument(document, req.params.caseId)));
  })
);

mobileRouter.get(
  "/cases/:caseId/findings",
  mobileAuth,
  asyncHandler(async (req, res) => {
    const findings = await getAgentFindingsByUserId(req.user!.id);
    const documentIds = await getMobileCaseDocumentIds(
      req.user!.id,
      req.params.caseId
    );
    if (documentIds === null) {
      res.json(findings.map(mapFinding));
      return;
    }
    const documentIdSet = new Set(documentIds);
    res.json(
      findings
        .filter(finding =>
          intersects(documentIdSet, findingDocumentIds(finding.sourceAnchors))
        )
        .map(mapFinding)
    );
  })
);

mobileRouter.get(
  "/documents",
  mobileAuth,
  asyncHandler(async (req, res) => {
    const docs = await getUserDocuments(req.user!.id);
    res.json(docs.map(document => mapDocument(document)));
  })
);

mobileRouter.post(
  "/documents/upload-url",
  mobileAuth,
  asyncHandler(async (req, res) => {
    const input = uploadUrlSchema.parse(req.body || {});
    await enforceDocumentUploadLimit(req.user!);
    const uploadId = `mobile-upload-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    pendingUploads.set(uploadId, {
      caseId: input.caseId,
      createdAt: Date.now(),
      fileName: input.fileName,
      mimeType: input.mimeType,
      userId: req.user!.id,
    });

    res.json({
      documentId: uploadId,
      uploadId,
      method: "PUT",
      presignedUrl: `${getMobileOrigin(req)}/api/mobile/v1/documents/uploads/${uploadId}`,
      expiresInSeconds: 15 * 60,
      requiresAuthorization: true,
    });
  })
);

mobileRouter.put(
  "/documents/uploads/:uploadId",
  mobileAuth,
  express.raw({ type: "*/*", limit: "100mb" }),
  asyncHandler(async (req, res) => {
    const pending = pendingUploads.get(req.params.uploadId);
    if (!pending || pending.userId !== req.user!.id)
      throw new Error("Upload not found");
    if (Date.now() - pending.createdAt > 15 * 60 * 1000) {
      pendingUploads.delete(req.params.uploadId);
      throw new Error("Upload URL expired");
    }
    const body = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(req.body || "");
    if (body.length === 0) throw new Error("Upload body is empty");

    const result = await caller(req, res).upload.uploadFile({
      fileName: pending.fileName,
      fileData: body.toString("base64"),
      mimeType: pending.mimeType,
    });
    const documentId = Number(
      (result as { documentId?: unknown; existingDocumentId?: unknown })
        .documentId ??
        (result as { documentId?: unknown; existingDocumentId?: unknown })
          .existingDocumentId
    );
    await assignMobileDocumentToCase(
      req.user!.id,
      pending.caseId,
      Number.isInteger(documentId) ? documentId : undefined
    );
    pendingUploads.delete(req.params.uploadId);
    completedUploads.set(req.params.uploadId, result);
    res.json(result);
  })
);

mobileRouter.post(
  "/documents/upload",
  mobileAuth,
  asyncHandler(async (req, res) => {
    const input = directUploadSchema.parse(req.body || {});
    const result = await caller(req, res).upload.uploadFile({
      fileName: input.fileName,
      fileData: input.fileData,
      mimeType: input.mimeType,
    });
    const documentId = Number(
      (result as { documentId?: unknown; existingDocumentId?: unknown })
        .documentId ??
        (result as { documentId?: unknown; existingDocumentId?: unknown })
          .existingDocumentId
    );
    await assignMobileDocumentToCase(
      req.user!.id,
      input.caseId,
      Number.isInteger(documentId) ? documentId : undefined
    );
    res.json(result);
  })
);

mobileRouter.post(
  "/documents/confirm",
  mobileAuth,
  asyncHandler(async (req, res) => {
    const input = z
      .object({ documentId: z.string().min(1) })
      .parse(req.body || {});
    if (completedUploads.has(input.documentId)) {
      res.json(completedUploads.get(input.documentId));
      return;
    }
    if (pendingUploads.has(input.documentId)) {
      res.json({ documentId: input.documentId, status: "pending_upload" });
      return;
    }
    const id = Number(input.documentId);
    if (!Number.isInteger(id)) throw new Error("Upload not found");
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const [document] = await db
      .select()
      .from(documents)
      .where(and(eq(documents.id, id), eq(documents.userId, req.user!.id)))
      .limit(1);
    if (!document) throw new Error("Document not found");
    res.json(mapDocument(document));
  })
);

mobileRouter.post(
  "/documents/:id/retry-extraction",
  mobileAuth,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const result = await caller(req, res).upload.retryExtraction({ id });
    res.json(result);
  })
);

mobileRouter.delete(
  "/documents/:id",
  mobileAuth,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const result = await caller(req, res).documents.delete({ id });
    res.json(result);
  })
);

mobileRouter.get(
  "/agents/catalog",
  mobileAuth,
  asyncHandler(async (req, res) => {
    const result = await caller(req, res)
      .agents.catalog()
      .catch(() => ({ agents: [], superAgents: [] }));
    res.json(result);
  })
);

mobileRouter.post(
  "/agents/run",
  mobileAuth,
  asyncHandler(async (req, res) => {
    const input = agentRunSchema.parse(req.body || {});
    const caseDocumentIds = await getMobileCaseDocumentIds(
      req.user!.id,
      input.caseId
    );
    const explicitDocumentIds = numberIds(input.scopeDocumentIds);
    const documentIds =
      explicitDocumentIds.length > 0
        ? explicitDocumentIds
        : caseDocumentIds === null
          ? []
          : caseDocumentIds;
    const inferredScope =
      input.scope ||
      (documentIds.length > 0 || caseDocumentIds !== null ? "file" : "all");
    const result = await caller(req, res).agents.processScope({
      sector: input.sector,
      scope: inferredScope,
      documentIds,
      agentIds: input.agentTypes,
      fromDate: input.fromDate,
      toDate: input.toDate,
    });
    res.json({
      runId: String(result.runId),
      status: result.success ? "completed" : "failed",
      progress:
        result.totalAgents > 0
          ? Math.round((result.completedAgents / result.totalAgents) * 100)
          : 0,
      logs: result.results.map(item => `${item.agentName}: ${item.status}`),
      result,
    });
  })
);

mobileRouter.get(
  "/agents/run/:runId/status",
  mobileAuth,
  asyncHandler(async (req, res) => {
    const runId = Number(req.params.runId);
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const [run] = await db
      .select()
      .from(agentRuns)
      .where(and(eq(agentRuns.id, runId), eq(agentRuns.userId, req.user!.id)))
      .limit(1);
    if (!run) throw new Error("Run not found");
    const findings = await db
      .select()
      .from(agentFindings)
      .where(eq(agentFindings.runId, run.id))
      .orderBy(desc(agentFindings.leverageScore));
    res.json({
      runId: String(run.id),
      status: run.status,
      progress:
        run.totalAgents > 0
          ? Math.round((run.completedAgents / run.totalAgents) * 100)
          : 0,
      logs: [`${run.completedAgents}/${run.totalAgents} agents completed`],
      findings: findings.map(mapFinding),
      synthesis: run.synthesis,
    });
  })
);

mobileRouter.get(
  "/reports",
  mobileAuth,
  asyncHandler(async (req, res) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const reports = await db
      .select()
      .from(generatedReports)
      .where(eq(generatedReports.userId, req.user!.id))
      .orderBy(desc(generatedReports.createdAt));
    res.json(reports.map(mapReport));
  })
);

mobileRouter.post(
  "/reports/preview",
  mobileAuth,
  asyncHandler(async (req, res) => {
    const input = reportSchema.parse(req.body || {});
    const result = await caller(req, res).reports.preview(
      await scopeMobileReportInput(req.user!.id, input)
    );
    res.json(result);
  })
);

mobileRouter.post(
  "/reports",
  mobileAuth,
  asyncHandler(async (req, res) => {
    const input = reportSchema.parse(req.body || {});
    const result = await caller(req, res).reports.generate(
      await scopeMobileReportInput(req.user!.id, input)
    );
    res.json(result);
  })
);

mobileRouter.get(
  "/reports/:id/export",
  mobileAuth,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const format = z
      .enum(["markdown", "html", "json", "pdf", "docx"])
      .optional()
      .parse(req.query.format);
    const result = await caller(req, res).reports.exportSaved({ id, format });
    res.json(result);
  })
);

mobileRouter.delete(
  "/reports/:id",
  mobileAuth,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const result = await caller(req, res).reports.deleteSaved({ id });
    res.json(result);
  })
);

export function registerMobileRoutes(app: Express) {
  app.use("/api/mobile/v1", mobileRouter);
}
