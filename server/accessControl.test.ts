import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "../drizzle/schema";

const dbMocks = vi.hoisted(() => ({
  getSubscriptionByUserId: vi.fn(),
  getUserDocuments: vi.fn(),
}));

vi.mock("./db", () => dbMocks);

import {
  enforceAgentRunAccess,
  enforceDocumentUploadLimit,
  enforcePageAnalysisLimit,
  enforceReportExportAccess,
  enforceSwarmProcessingAccess,
  estimateDocumentPages,
} from "./accessControl";

const now = new Date("2026-06-29T12:00:00.000Z");

function user(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    openId: "user-open-id",
    name: "Test User",
    email: "test@example.com",
    loginMethod: "local",
    role: "user",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
    ...overrides,
  };
}

function activePlan(plan: string) {
  dbMocks.getSubscriptionByUserId.mockResolvedValue({
    id: 1,
    userId: 1,
    plan,
    status: "active",
  });
}

describe("billing and tier access control", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.OWNER_OPEN_ID;
    dbMocks.getSubscriptionByUserId.mockResolvedValue(undefined);
    dbMocks.getUserDocuments.mockResolvedValue([]);
  });

  it("estimates pages from extracted text length", () => {
    expect(
      estimateDocumentPages({
        extractionTextLength: 6001,
        extractedText: null,
        summary: null,
        fileSize: 0,
      })
    ).toBe(3);
  });

  it("blocks free users after the private upload limit", async () => {
    dbMocks.getUserDocuments.mockResolvedValue([
      { id: 1 },
      { id: 2 },
      { id: 3 },
    ]);

    await expect(enforceDocumentUploadLimit(user())).rejects.toThrow(
      "Free allows 3 document uploads"
    );
  });

  it("keeps non-evidence agents out of the Advocate tier", async () => {
    activePlan("advocate");

    await expect(
      enforceAgentRunAccess(user(), "evidence")
    ).resolves.toBeUndefined();
    await expect(enforceAgentRunAccess(user(), "legal")).rejects.toThrow(
      "Advocate does not include legal agent runs"
    );
  });

  it("requires swarm entitlement for multi-agent processing", async () => {
    activePlan("advocate");

    await expect(
      enforceSwarmProcessingAccess(user(), 1)
    ).resolves.toBeUndefined();
    await expect(enforceSwarmProcessingAccess(user(), 3)).rejects.toThrow(
      "Advocate does not include multi-agent swarm processing"
    );

    activePlan("litigator");
    await expect(
      enforceSwarmProcessingAccess(user(), 3)
    ).resolves.toBeUndefined();
  });

  it("blocks selected scopes above the plan page limit", async () => {
    activePlan("advocate");

    await expect(
      enforcePageAnalysisLimit(
        user(),
        [
          {
            extractionTextLength: 4_503_001,
            extractedText: null,
            summary: null,
            fileSize: 0,
          },
        ],
        "scoped analysis"
      )
    ).rejects.toThrow("estimated at 1502 pages");

    activePlan("litigator");
    await expect(
      enforcePageAnalysisLimit(
        user(),
        [
          {
            extractionTextLength: 4_503_001,
            extractedText: null,
            summary: null,
            fileSize: 0,
          },
        ],
        "scoped analysis"
      )
    ).resolves.toBeUndefined();
  });

  it("gates saved report exports by plan and format", async () => {
    await expect(enforceReportExportAccess(user(), "markdown")).rejects.toThrow(
      "Free does not include private report export"
    );

    activePlan("advocate");
    await expect(
      enforceReportExportAccess(user(), "pdf")
    ).resolves.toBeUndefined();
    await expect(
      enforceReportExportAccess(user(), "docx")
    ).resolves.toBeUndefined();
  });

  it("gives only the configured owner admin the firm override", async () => {
    process.env.OWNER_OPEN_ID = "owner-open-id";
    const owner = user({ id: 99, openId: "owner-open-id", role: "admin" });

    dbMocks.getUserDocuments.mockResolvedValue(new Array(1000).fill({}));

    await expect(enforceDocumentUploadLimit(owner)).resolves.toBeUndefined();
    await expect(
      enforceSwarmProcessingAccess(owner, 50)
    ).resolves.toBeUndefined();
    await expect(
      enforcePageAnalysisLimit(owner, [
        {
          extractionTextLength: 30_000_000,
          extractedText: null,
          summary: null,
          fileSize: 0,
        },
      ])
    ).resolves.toBeUndefined();
  });
});
