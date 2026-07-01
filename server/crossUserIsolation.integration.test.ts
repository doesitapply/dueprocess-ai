import "dotenv/config";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";
import {
  createAgentFindingAudit,
  createAgentFinding,
  createAgentOutput,
  createAgentRun,
  createDocument,
  createGeneratedReport,
  createReportRevision,
  getDb,
  getUserByOpenId,
  upsertSubscription,
  upsertUser,
} from "./db";
import {
  agentFindingAudits,
  agentFindings,
  agentOutputs,
  agentRuns,
  caseDocuments,
  documents,
  generatedReports,
  reportRevisions,
  subscriptions,
  users,
  workspaceCases,
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
  revisionAId: number;
  revisionBId: number;
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

function revisionSections(markdown: string) {
  return JSON.stringify([
    {
      sectionId: "01-summary",
      title: "Summary",
      kind: "packet_section",
      level: 1,
      markdown,
      includedInExport: true,
      sourceFindingIds: [],
      sourceDocumentIds: [],
      edited: false,
      generatedVersion: markdown,
    },
  ]);
}

async function createFixture(): Promise<TestFixture> {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const userA = await createSyntheticUser(`isolation-a-${suffix}`, "A");
  const userB = await createSyntheticUser(`isolation-b-${suffix}`, "B");
  await Promise.all(
    [userA, userB].map(testUser =>
      upsertSubscription({
        userId: testUser.id,
        stripeCustomerId: `cus_isolation_${testUser.id}`,
        stripeSubscriptionId: `sub_isolation_${testUser.id}`,
        stripePriceId: "price_litigator_test",
        plan: "litigator",
        status: "active",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        cancelAtPeriodEnd: 0,
      })
    )
  );
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
    sourceAnchors: JSON.stringify([
      {
        documentId: documentA.id,
        fileName: documentA.fileName,
        quote: "Private User A record text",
      },
    ]),
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
    sourceAnchors: JSON.stringify([
      {
        documentId: documentB.id,
        fileName: documentB.fileName,
        quote: "Private User B record text",
      },
    ]),
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
    metadata: JSON.stringify({
      statistics: { documents: 1, structuredFindings: 1 },
      markdown: "# Private User A report\n\nPrivate content.",
    }),
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
    metadata: JSON.stringify({
      statistics: { documents: 1, structuredFindings: 1 },
      markdown: "# Private User B report\n\nPrivate content.",
    }),
  });
  const revisionA = await createReportRevision({
    reportId: reportA.id,
    userId: userA.id,
    title: "Private User A report",
    markdown: "# Private User A report\n\nPrivate revision content.",
    sections: revisionSections("# Private User A report\n\nPrivate revision content."),
    editReason: "Initial fixture revision",
  });
  const revisionB = await createReportRevision({
    reportId: reportB.id,
    userId: userB.id,
    title: "Private User B report",
    markdown: "# Private User B report\n\nPrivate revision content.",
    sections: revisionSections("# Private User B report\n\nPrivate revision content."),
    editReason: "Initial fixture revision",
  });

  return {
    documentAId: documentA.id,
    documentBId: documentB.id,
    outputAId: outputA.id,
    outputBId: outputB.id,
    reportAId: reportA.id,
    reportBId: reportB.id,
    revisionAId: revisionA.id,
    revisionBId: revisionB.id,
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

  await db
    .delete(agentFindingAudits)
    .where(
      inArray(agentFindingAudits.findingId, [
        fixture.findingAId,
        fixture.findingBId,
      ])
    );
  await db
    .delete(agentFindings)
    .where(inArray(agentFindings.id, [fixture.findingAId, fixture.findingBId]));
  await db
    .delete(reportRevisions)
    .where(
      inArray(reportRevisions.reportId, [fixture.reportAId, fixture.reportBId])
    );
  await db
    .delete(generatedReports)
    .where(
      inArray(generatedReports.id, [fixture.reportAId, fixture.reportBId])
    );
  await db
    .delete(agentOutputs)
    .where(inArray(agentOutputs.id, [fixture.outputAId, fixture.outputBId]));
  await db
    .delete(agentRuns)
    .where(inArray(agentRuns.id, [fixture.runAId, fixture.runBId]));
  await db
    .delete(documents)
    .where(inArray(documents.id, [fixture.documentAId, fixture.documentBId]));
  await db
    .delete(subscriptions)
    .where(inArray(subscriptions.userId, [fixture.userA.id, fixture.userB.id]));
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

    const [
      documentsA,
      documentsB,
      runsA,
      runsB,
      findingsA,
      findingsB,
      reportsA,
      reportsB,
    ] = await Promise.all([
      callerA.documents.list(),
      callerB.documents.list(),
      callerA.agents.listSavedRuns(),
      callerB.agents.listSavedRuns(),
      callerA.agents.listFindings(),
      callerB.agents.listFindings(),
      callerA.reports.saved(),
      callerB.reports.saved(),
    ]);

    expect(documentsA.map(document => document.id)).toContain(
      fixture.documentAId
    );
    expect(documentsA.map(document => document.id)).not.toContain(
      fixture.documentBId
    );
    expect(documentsB.map(document => document.id)).toContain(
      fixture.documentBId
    );
    expect(documentsB.map(document => document.id)).not.toContain(
      fixture.documentAId
    );
    expect(runsA.map(run => run.id)).toContain(fixture.outputAId);
    expect(runsA.map(run => run.id)).not.toContain(fixture.outputBId);
    expect(runsB.map(run => run.id)).toContain(fixture.outputBId);
    expect(runsB.map(run => run.id)).not.toContain(fixture.outputAId);
    expect(findingsA.map(finding => finding.id)).toContain(fixture.findingAId);
    expect(findingsA.map(finding => finding.id)).not.toContain(
      fixture.findingBId
    );
    expect(findingsB.map(finding => finding.id)).toContain(fixture.findingBId);
    expect(findingsB.map(finding => finding.id)).not.toContain(
      fixture.findingAId
    );
    expect(reportsA.map(report => report.id)).toContain(fixture.reportAId);
    expect(reportsA.map(report => report.id)).not.toContain(fixture.reportBId);
    expect(reportsB.map(report => report.id)).toContain(fixture.reportBId);
    expect(reportsB.map(report => report.id)).not.toContain(fixture.reportAId);
  });

  it("blocks direct cross-user document, report, export, and delete access", async () => {
    if (!fixture) throw new Error("Fixture missing");
    const callerA = appRouter.createCaller(createContext(fixture.userA));
    const callerB = appRouter.createCaller(createContext(fixture.userB));

    await expectNotFoundOrUnauthorized(
      callerB.documents.getById({ id: fixture.documentAId })
    );
    await expectNotFoundOrUnauthorized(
      callerB.documents.delete({ id: fixture.documentAId })
    );
    await expectNotFoundOrUnauthorized(
      callerB.agents.getOutputs({ documentId: fixture.documentAId })
    );
    await expectNotFoundOrUnauthorized(
      callerB.agents.deleteOutput({ id: fixture.outputAId })
    );
    await expectNotFoundOrUnauthorized(
      callerB.reports.getSaved({ id: fixture.reportAId })
    );
    await expectNotFoundOrUnauthorized(
      callerB.reports.exportSaved({ id: fixture.reportAId, format: "pdf" })
    );
    await expectNotFoundOrUnauthorized(
      callerB.reports.revisions({ reportId: fixture.reportAId })
    );
    await expectNotFoundOrUnauthorized(
      callerB.reports.saveRevision({
        reportId: fixture.reportAId,
        sections: JSON.parse(revisionSections("# Cross-user edit attempt")),
      })
    );
    await expectNotFoundOrUnauthorized(
      callerB.reports.updateSection({
        reportId: fixture.reportAId,
        sectionId: "01-summary",
        markdown: "# Cross-user update attempt",
      })
    );
    await expectNotFoundOrUnauthorized(
      callerB.reports.restoreSection({
        reportId: fixture.reportAId,
        sectionId: "01-summary",
      })
    );
    await expectNotFoundOrUnauthorized(
      callerB.reports.regenerateSection({
        reportId: fixture.reportAId,
        sectionId: "01-summary",
      })
    );
    await expectNotFoundOrUnauthorized(
      callerB.reports.exportRevision({
        reportId: fixture.reportAId,
        revisionId: fixture.revisionAId,
        format: "json",
      })
    );
    await expectNotFoundOrUnauthorized(
      callerB.reports.exportRevision({
        reportId: fixture.reportBId,
        revisionId: fixture.revisionAId,
        format: "json",
      })
    );
    await expectNotFoundOrUnauthorized(
      callerB.reports.deleteSaved({ id: fixture.reportAId })
    );

    const ownDocument = await callerA.documents.getById({
      id: fixture.documentAId,
    });
    const ownReport = await callerA.reports.getSaved({ id: fixture.reportAId });
    const ownExport = await callerA.reports.exportSaved({
      id: fixture.reportAId,
      format: "docx",
    });
    const ownRevisions = await callerA.reports.revisions({
      reportId: fixture.reportAId,
    });
    const ownRevisionExport = await callerA.reports.exportRevision({
      reportId: fixture.reportAId,
      revisionId: fixture.revisionAId,
      format: "json",
    });
    const editedRevision = await callerA.reports.updateSection({
      reportId: fixture.reportAId,
      sectionId: "01-summary",
      markdown: "# Private User A report\n\nEdited revision content.",
    });
    const editedExport = await callerA.reports.exportRevision({
      reportId: fixture.reportAId,
      revisionId: editedRevision.id,
      format: "json",
    });
    const excludedSections = [
      {
        sectionId: "01-include",
        title: "Included",
        kind: "packet_section",
        level: 1,
        markdown: "# Included\n\nThis text should export.",
        includedInExport: true,
        sourceFindingIds: [],
        sourceDocumentIds: [],
        edited: true,
        generatedVersion: "# Included\n\nThis text should export.",
      },
      {
        sectionId: "02-exclude",
        title: "Excluded",
        kind: "packet_section",
        level: 2,
        markdown: "This text should not export.",
        includedInExport: false,
        sourceFindingIds: [],
        sourceDocumentIds: [],
        edited: true,
        generatedVersion: "This text should not export.",
      },
    ];
    const excludedRevision = await callerA.reports.saveRevision({
      reportId: fixture.reportAId,
      title: "Private User A exclusion test",
      sections: excludedSections,
      editReason: "Exclude weak section",
    });
    const excludedExport = await callerA.reports.exportRevision({
      reportId: fixture.reportAId,
      revisionId: excludedRevision.id,
      format: "json",
    });
    const restoredRevision = await callerA.reports.restoreSection({
      reportId: fixture.reportAId,
      sectionId: "01-include",
    });
    const reloadedReport = await callerA.reports.getSaved({
      id: fixture.reportAId,
    });

    expect(ownDocument.document.id).toBe(fixture.documentAId);
    expect(ownReport.id).toBe(fixture.reportAId);
    expect(ownExport.encoding).toBe("base64");
    expect(ownRevisions.map(revision => revision.id)).toContain(
      fixture.revisionAId
    );
    expect(JSON.parse(ownRevisionExport.content).markdown).toContain(
      "Private revision content"
    );
    expect(JSON.parse(editedExport.content).markdown).toContain(
      "Edited revision content"
    );
    expect(JSON.parse(excludedExport.content).markdown).toContain(
      "This text should export"
    );
    expect(JSON.parse(excludedExport.content).markdown).not.toContain(
      "This text should not export"
    );
    expect(restoredRevision.markdown).toContain("This text should export");
    expect(reloadedReport.revisions.map(revision => revision.id)).toContain(
      restoredRevision.id
    );
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

  it("keeps case-scoped report previews inside assigned case documents", async () => {
    if (!fixture) throw new Error("Fixture missing");
    const callerA = appRouter.createCaller(createContext(fixture.userA));
    const callerB = appRouter.createCaller(createContext(fixture.userB));
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const extraDocument = await createDocument({
      userId: fixture.userA.id,
      fileName: `isolation-a-extra-${Date.now()}.txt`,
      fileUrl: "memory://isolation-a-extra",
      fileKey: `isolation/extra-${Date.now()}.txt`,
      mimeType: "text/plain",
      fileSize: 128,
      extractedText:
        "Private User A extra record text that is not assigned to this case.",
      status: "completed",
      summary: "Private User A extra summary",
    });
    const insertedCase = await db.insert(workspaceCases).values({
      userId: fixture.userA.id,
      title: "Isolation A case lane",
      caseNumber: "A-CASE-1",
      jurisdiction: "Test jurisdiction",
      status: "active",
    });
    const caseId = Number(insertedCase[0].insertId);
    let caseReportId: number | null = null;

    try {
      await db.insert(caseDocuments).values({
        userId: fixture.userA.id,
        caseId,
        documentId: fixture.documentAId,
        role: "primary",
      });

      const preview = await callerA.reports.preview({
        scope: "case",
        caseId,
      });
      const caseFindings = await callerA.agents.listFindings({ caseId });

      expect(preview.documents.map(document => document.id)).toEqual([
        fixture.documentAId,
      ]);
      expect(preview.documents.map(document => document.id)).not.toContain(
        extraDocument.id
      );
      expect(caseFindings.map(finding => finding.id)).toContain(
        fixture.findingAId
      );
      expect(
        caseFindings.every(finding => finding.id !== fixture.findingBId)
      ).toBe(true);

      const caseReport = await createGeneratedReport({
        userId: fixture.userA.id,
        title: "Isolation A case packet",
        template: "court_packet",
        scope: "case",
        format: "markdown",
        fileName: "isolation-a-case-packet.md",
        documentIds: JSON.stringify([fixture.documentAId]),
        selectedFindingIds: JSON.stringify([]),
        minConfidence: 0,
        includeBlockedFindings: 0,
        content: "# Isolation A case packet",
        metadata: JSON.stringify({
          caseId,
          metadata: { caseId, title: "Isolation A case packet" },
          statistics: { documents: 1, structuredFindings: 0 },
        }),
      });
      caseReportId = caseReport.id;
      const savedReports = await callerA.reports.saved();
      expect(
        savedReports.find(report => report.id === caseReport.id)?.caseId
      ).toBe(caseId);

      await expect(
        callerA.reports.preview({
          scope: "files",
          caseId,
          documentIds: [extraDocument.id],
        })
      ).rejects.toThrow(/not assigned to this workspace case/i);

      await expect(
        callerB.reports.preview({
          scope: "case",
          caseId,
        })
      ).rejects.toThrow(/case not found/i);
      await expect(callerB.agents.listFindings({ caseId })).rejects.toThrow(
        /case not found/i
      );
    } finally {
      if (caseReportId !== null) {
        await db
          .delete(reportRevisions)
          .where(eq(reportRevisions.reportId, caseReportId));
        await db
          .delete(generatedReports)
          .where(eq(generatedReports.id, caseReportId));
      }
      await db.delete(caseDocuments).where(eq(caseDocuments.caseId, caseId));
      await db.delete(workspaceCases).where(eq(workspaceCases.id, caseId));
      await db.delete(documents).where(eq(documents.id, extraDocument.id));
    }
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
      remainingRevisions,
    ] = await Promise.all([
      db
        .select()
        .from(documents)
        .where(
          inArray(documents.id, [fixture.documentAId, fixture.documentBId])
        ),
      db
        .select()
        .from(agentOutputs)
        .where(
          inArray(agentOutputs.id, [fixture.outputAId, fixture.outputBId])
        ),
      db
        .select()
        .from(agentRuns)
        .where(inArray(agentRuns.id, [fixture.runAId, fixture.runBId])),
      db
        .select()
        .from(agentFindings)
        .where(
          inArray(agentFindings.id, [fixture.findingAId, fixture.findingBId])
        ),
      db
        .select()
        .from(agentFindingAudits)
        .where(
          inArray(agentFindingAudits.id, [fixture.auditAId, fixture.auditBId])
        ),
      db
        .select()
        .from(generatedReports)
        .where(
          inArray(generatedReports.id, [fixture.reportAId, fixture.reportBId])
        ),
      db
        .select()
        .from(reportRevisions)
        .where(
          inArray(reportRevisions.id, [fixture.revisionAId, fixture.revisionBId])
        ),
    ]);

    expect(remainingDocuments.map(document => document.id)).not.toContain(
      fixture.documentAId
    );
    expect(remainingOutputs.map(output => output.id)).not.toContain(
      fixture.outputAId
    );
    expect(remainingRuns.map(run => run.id)).not.toContain(fixture.runAId);
    expect(remainingFindings.map(finding => finding.id)).not.toContain(
      fixture.findingAId
    );
    expect(remainingAudits.map(audit => audit.id)).not.toContain(
      fixture.auditAId
    );
    expect(remainingReports.map(report => report.id)).not.toContain(
      fixture.reportAId
    );
    expect(remainingRevisions.map(revision => revision.id)).not.toContain(
      fixture.revisionAId
    );

    expect(remainingDocuments.map(document => document.id)).toContain(
      fixture.documentBId
    );
    expect(remainingOutputs.map(output => output.id)).toContain(
      fixture.outputBId
    );
    expect(remainingRuns.map(run => run.id)).toContain(fixture.runBId);
    expect(remainingFindings.map(finding => finding.id)).toContain(
      fixture.findingBId
    );
    expect(remainingAudits.map(audit => audit.id)).toContain(fixture.auditBId);
    expect(remainingReports.map(report => report.id)).toContain(
      fixture.reportBId
    );
    expect(remainingRevisions.map(revision => revision.id)).toContain(
      fixture.revisionBId
    );
  });
});
