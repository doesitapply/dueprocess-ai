import "dotenv/config";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { inArray } from "drizzle-orm";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";
import {
  createAgentFindingAudit,
  createAgentFinding,
  createAgentOutput,
  createAgentRun,
  createDocument,
  createGeneratedReport,
  getDb,
  getUserByOpenId,
  upsertUser,
} from "./db";
import {
  agentFindingAudits,
  agentFindings,
  agentOutputs,
  agentRuns,
  documents,
  generatedReports,
  users,
  type User,
} from "../drizzle/schema";

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

type TestFixture = {
  documentAId: number;
  documentBId: number;
  outputAId: number;
  outputBId: number;
  reportAId: number;
  reportBId: number;
  runAId: number;
  runBId: number;
  findingAId: number;
  findingBId: number;
  auditAId: number;
  auditBId: number;
  userA: User;
  userB: User;
  userOpenIds: string[];
};

function createContext(user: User): TrpcContext {
  return {
    req: { headers: {}, hostname: "localhost", protocol: "http" } as TrpcContext["req"],
    res: {
      clearCookie: () => undefined,
      cookie: () => undefined,
    } as unknown as TrpcContext["res"],
    user,
  };
}

async function expectNotFoundOrUnauthorized(operation: Promise<unknown>) {
  await expect(operation).rejects.toThrow(/not found|unauthorized/i);
}

async function createSyntheticUser(openId: string, label: string) {
  await upsertUser({
    openId,
    name: `Isolation ${label}`,
    email: `${openId}@example.test`,
    loginMethod: "test",
    lastSignedIn: new Date(),
  });
  const user = await getUserByOpenId(openId);
  if (!user) throw new Error(`Failed to create synthetic user ${openId}`);
  return user;
}

async function createFixture(): Promise<TestFixture> {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const userA = await createSyntheticUser(`isolation-a-${suffix}`, "A");
  const userB = await createSyntheticUser(`isolation-b-${suffix}`, "B");
  const documentA = await createDocument({
    userId: userA.id,
    fileName: `isolation-a-${suffix}.txt`,
    fileUrl: "memory://isolation-a",
    fileKey: `isolation/${suffix}/a.txt`,
    mimeType: "text/plain",
    fileSize: 128,
    extractedText: "Private User A record text for access-control testing.",
    status: "completed",
    summary: "Private User A summary",
  });
  const documentB = await createDocument({
    userId: userB.id,
    fileName: `isolation-b-${suffix}.txt`,
    fileUrl: "memory://isolation-b",
    fileKey: `isolation/${suffix}/b.txt`,
    mimeType: "text/plain",
    fileSize: 128,
    extractedText: "Private User B record text for access-control testing.",
    status: "completed",
    summary: "Private User B summary",
  });
  const outputA = await createAgentOutput({
    documentId: documentA.id,
    agentId: "isolation_agent",
    agentName: "Isolation Agent",
    output: "Private User A output",
  });
  const outputB = await createAgentOutput({
    documentId: documentB.id,
    agentId: "isolation_agent",
    agentName: "Isolation Agent",
    output: "Private User B output",
  });
  const runA = await createAgentRun({
    userId: userA.id,
    anchorDocumentId: documentA.id,
    sector: "legal",
    scope: "file",
    documentIds: JSON.stringify([documentA.id]),
    agentIds: JSON.stringify(["isolation_agent"]),
    status: "completed",
    totalAgents: 1,
    completedAgents: 1,
  });
  const runB = await createAgentRun({
    userId: userB.id,
    anchorDocumentId: documentB.id,
    sector: "legal",
    scope: "file",
    documentIds: JSON.stringify([documentB.id]),
    agentIds: JSON.stringify(["isolation_agent"]),
    status: "completed",
    totalAgents: 1,
    completedAgents: 1,
  });
  const findingA = await createAgentFinding({
    runId: runA.id,
    outputId: outputA.id,
    userId: userA.id,
    agentId: "isolation_agent",
    agentName: "Isolation Agent",
    title: "Private User A finding",
    findingType: "record_supported",
    severity: "high",
    confidence: 99,
    leverageScore: 80,
    summary: "Private User A finding summary",
    sourceAnchors: JSON.stringify([{ documentId: documentA.id, fileName: documentA.fileName, quote: "Private User A record text" }]),
    qcStatus: "approved",
    includedInReports: 1,
  });
  const findingB = await createAgentFinding({
    runId: runB.id,
    outputId: outputB.id,
    userId: userB.id,
    agentId: "isolation_agent",
    agentName: "Isolation Agent",
    title: "Private User B finding",
    findingType: "record_supported",
    severity: "high",
    confidence: 99,
    leverageScore: 80,
    summary: "Private User B finding summary",
    sourceAnchors: JSON.stringify([{ documentId: documentB.id, fileName: documentB.fileName, quote: "Private User B record text" }]),
    qcStatus: "approved",
    includedInReports: 1,
  });
  const auditA = await createAgentFindingAudit({
    findingId: findingA.id,
    runId: runA.id,
    status: "approved",
    confidence: 99,
    issues: JSON.stringify([]),
  });
  const auditB = await createAgentFindingAudit({
    findingId: findingB.id,
    runId: runB.id,
    status: "approved",
    confidence: 99,
    issues: JSON.stringify([]),
  });
  const reportA = await createGeneratedReport({
    userId: userA.id,
    title: "Private User A report",
    template: "court_packet",
    scope: "files",
    format: "markdown",
    fileName: "private-user-a-report.md",
    documentIds: JSON.stringify([documentA.id]),
    selectedFindingIds: JSON.stringify([findingA.id]),
    minConfidence: 0,
    includeBlockedFindings: 0,
    content: "# Private User A report\n\nPrivate content.",
    metadata: JSON.stringify({ statistics: { documents: 1, structuredFindings: 1 }, markdown: "# Private User A report\n\nPrivate content." }),
  });
  const reportB = await createGeneratedReport({
    userId: userB.id,
    title: "Private User B report",
    template: "court_packet",
    scope: "files",
    format: "markdown",
    fileName: "private-user-b-report.md",
    documentIds: JSON.stringify([documentB.id]),
    selectedFindingIds: JSON.stringify([findingB.id]),
    minConfidence: 0,
    includeBlockedFindings: 0,
    content: "# Private User B report\n\nPrivate content.",
    metadata: JSON.stringify({ statistics: { documents: 1, structuredFindings: 1 }, markdown: "# Private User B report\n\nPrivate content." }),
  });

  return {
    documentAId: documentA.id,
    documentBId: documentB.id,
    outputAId: outputA.id,
    outputBId: outputB.id,
    reportAId: reportA.id,
    reportBId: reportB.id,
    runAId: runA.id,
    runBId: runB.id,
    findingAId: findingA.id,
    findingBId: findingB.id,
    auditAId: auditA.id,
    auditBId: auditB.id,
    userA,
    userB,
    userOpenIds: [userA.openId, userB.openId],
  };
}

async function cleanupFixture(fixture: TestFixture | null) {
  if (!fixture) return;
  const db = await getDb();
  if (!db) return;

  await db.delete(agentFindingAudits).where(inArray(agentFindingAudits.findingId, [fixture.findingAId, fixture.findingBId]));
  await db.delete(agentFindings).where(inArray(agentFindings.id, [fixture.findingAId, fixture.findingBId]));
  await db.delete(generatedReports).where(inArray(generatedReports.id, [fixture.reportAId, fixture.reportBId]));
  await db.delete(agentOutputs).where(inArray(agentOutputs.id, [fixture.outputAId, fixture.outputBId]));
  await db.delete(agentRuns).where(inArray(agentRuns.id, [fixture.runAId, fixture.runBId]));
  await db.delete(documents).where(inArray(documents.id, [fixture.documentAId, fixture.documentBId]));
  await db.delete(users).where(inArray(users.openId, fixture.userOpenIds));
}

describeWithDb("cross-user isolation", () => {
  let fixture: TestFixture | null = null;

  beforeEach(async () => {
    fixture = await createFixture();
  });

  afterEach(async () => {
    await cleanupFixture(fixture);
    fixture = null;
  });

  it("filters document, agent, finding, and saved-report lists to the current user", async () => {
    if (!fixture) throw new Error("Fixture missing");
    const callerA = appRouter.createCaller(createContext(fixture.userA));
    const callerB = appRouter.createCaller(createContext(fixture.userB));

    const [documentsA, documentsB, runsA, runsB, findingsA, findingsB, reportsA, reportsB] = await Promise.all([
      callerA.documents.list(),
      callerB.documents.list(),
      callerA.agents.listSavedRuns(),
      callerB.agents.listSavedRuns(),
      callerA.agents.listFindings(),
      callerB.agents.listFindings(),
      callerA.reports.saved(),
      callerB.reports.saved(),
    ]);

    expect(documentsA.map((document) => document.id)).toContain(fixture.documentAId);
    expect(documentsA.map((document) => document.id)).not.toContain(fixture.documentBId);
    expect(documentsB.map((document) => document.id)).toContain(fixture.documentBId);
    expect(documentsB.map((document) => document.id)).not.toContain(fixture.documentAId);
    expect(runsA.map((run) => run.id)).toContain(fixture.outputAId);
    expect(runsA.map((run) => run.id)).not.toContain(fixture.outputBId);
    expect(runsB.map((run) => run.id)).toContain(fixture.outputBId);
    expect(runsB.map((run) => run.id)).not.toContain(fixture.outputAId);
    expect(findingsA.map((finding) => finding.id)).toContain(fixture.findingAId);
    expect(findingsA.map((finding) => finding.id)).not.toContain(fixture.findingBId);
    expect(findingsB.map((finding) => finding.id)).toContain(fixture.findingBId);
    expect(findingsB.map((finding) => finding.id)).not.toContain(fixture.findingAId);
    expect(reportsA.map((report) => report.id)).toContain(fixture.reportAId);
    expect(reportsA.map((report) => report.id)).not.toContain(fixture.reportBId);
    expect(reportsB.map((report) => report.id)).toContain(fixture.reportBId);
    expect(reportsB.map((report) => report.id)).not.toContain(fixture.reportAId);
  });

  it("blocks direct cross-user document, report, export, and delete access", async () => {
    if (!fixture) throw new Error("Fixture missing");
    const callerA = appRouter.createCaller(createContext(fixture.userA));
    const callerB = appRouter.createCaller(createContext(fixture.userB));

    await expectNotFoundOrUnauthorized(callerB.documents.getById({ id: fixture.documentAId }));
    await expectNotFoundOrUnauthorized(callerB.documents.delete({ id: fixture.documentAId }));
    await expectNotFoundOrUnauthorized(callerB.agents.getOutputs({ documentId: fixture.documentAId }));
    await expectNotFoundOrUnauthorized(callerB.agents.deleteOutput({ id: fixture.outputAId }));
    await expectNotFoundOrUnauthorized(callerB.reports.getSaved({ id: fixture.reportAId }));
    await expectNotFoundOrUnauthorized(callerB.reports.exportSaved({ id: fixture.reportAId, format: "pdf" }));
    await expectNotFoundOrUnauthorized(callerB.reports.deleteSaved({ id: fixture.reportAId }));

    const ownDocument = await callerA.documents.getById({ id: fixture.documentAId });
    const ownReport = await callerA.reports.getSaved({ id: fixture.reportAId });
    const ownExport = await callerA.reports.exportSaved({ id: fixture.reportAId, format: "docx" });

    expect(ownDocument.document.id).toBe(fixture.documentAId);
    expect(ownReport.id).toBe(fixture.reportAId);
    expect(ownExport.encoding).toBe("base64");
  });

  it("does not include another user's selected file in report previews", async () => {
    if (!fixture) throw new Error("Fixture missing");
    const callerB = appRouter.createCaller(createContext(fixture.userB));

    const preview = await callerB.reports.preview({
      scope: "files",
      documentIds: [fixture.documentAId],
    });

    expect(preview.statistics.documents).toBe(0);
    expect(preview.documents).toHaveLength(0);
    expect(preview.outputs).toHaveLength(0);
    expect(preview.findings).toHaveLength(0);
  });

  it("deletes source-bound analysis artifacts for the owner without touching another user", async () => {
    if (!fixture) throw new Error("Fixture missing");
    const callerA = appRouter.createCaller(createContext(fixture.userA));
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    await callerA.documents.delete({ id: fixture.documentAId });

    const [
      remainingDocuments,
      remainingOutputs,
      remainingRuns,
      remainingFindings,
      remainingAudits,
      remainingReports,
    ] = await Promise.all([
      db.select().from(documents).where(inArray(documents.id, [fixture.documentAId, fixture.documentBId])),
      db.select().from(agentOutputs).where(inArray(agentOutputs.id, [fixture.outputAId, fixture.outputBId])),
      db.select().from(agentRuns).where(inArray(agentRuns.id, [fixture.runAId, fixture.runBId])),
      db.select().from(agentFindings).where(inArray(agentFindings.id, [fixture.findingAId, fixture.findingBId])),
      db.select().from(agentFindingAudits).where(inArray(agentFindingAudits.id, [fixture.auditAId, fixture.auditBId])),
      db.select().from(generatedReports).where(inArray(generatedReports.id, [fixture.reportAId, fixture.reportBId])),
    ]);

    expect(remainingDocuments.map((document) => document.id)).not.toContain(fixture.documentAId);
    expect(remainingOutputs.map((output) => output.id)).not.toContain(fixture.outputAId);
    expect(remainingRuns.map((run) => run.id)).not.toContain(fixture.runAId);
    expect(remainingFindings.map((finding) => finding.id)).not.toContain(fixture.findingAId);
    expect(remainingAudits.map((audit) => audit.id)).not.toContain(fixture.auditAId);
    expect(remainingReports.map((report) => report.id)).not.toContain(fixture.reportAId);

    expect(remainingDocuments.map((document) => document.id)).toContain(fixture.documentBId);
    expect(remainingOutputs.map((output) => output.id)).toContain(fixture.outputBId);
    expect(remainingRuns.map((run) => run.id)).toContain(fixture.runBId);
    expect(remainingFindings.map((finding) => finding.id)).toContain(fixture.findingBId);
    expect(remainingAudits.map((audit) => audit.id)).toContain(fixture.auditBId);
    expect(remainingReports.map((report) => report.id)).toContain(fixture.reportBId);
  });
});
