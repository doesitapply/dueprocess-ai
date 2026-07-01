import { describe, expect, it } from "vitest";
import { PLATFORM_SUBSCRIPTIONS } from "./products";
import { billingPeriodFor, buildUsageSnapshot } from "./usageSnapshot";

const now = new Date("2026-06-29T12:00:00.000Z");

describe("usage snapshot", () => {
  it("uses subscription dates when present", () => {
    const period = billingPeriodFor(
      {
        currentPeriodStart: new Date("2026-06-15T00:00:00.000Z"),
        currentPeriodEnd: new Date("2026-07-15T00:00:00.000Z"),
      },
      now
    );

    expect(period.source).toBe("subscription");
    expect(period.start.toISOString()).toBe("2026-06-15T00:00:00.000Z");
    expect(period.end.toISOString()).toBe("2026-07-15T00:00:00.000Z");
  });

  it("falls back to the calendar month without subscription dates", () => {
    const period = billingPeriodFor(null, now);

    expect(period.source).toBe("calendar_month");
    expect(period.start.toISOString()).toBe(
      new Date(2026, 5, 1, 0, 0, 0, 0).toISOString()
    );
    expect(period.end.toISOString()).toBe(
      new Date(2026, 6, 1, 0, 0, 0, 0).toISOString()
    );
  });

  it("counts repeated analyzed pages per run and creates firm overage", () => {
    const documents = [
      {
        id: 10,
        createdAt: new Date("2026-06-20T12:00:00.000Z"),
        extractionTextLength: 9_000_000,
        extractedText: null,
        summary: null,
        fileSize: 0,
      },
    ];

    const snapshot = buildUsageSnapshot({
      plan: PLATFORM_SUBSCRIPTIONS.firm,
      subscription: null,
      now,
      documents,
      agentRuns: [
        {
          createdAt: new Date("2026-06-21T12:00:00.000Z"),
          documentIds: JSON.stringify([10]),
          agentIds: JSON.stringify(["a", "b", "c"]),
          totalAgents: 3,
        },
        {
          createdAt: new Date("2026-06-22T12:00:00.000Z"),
          documentIds: JSON.stringify([10]),
          agentIds: JSON.stringify(["a", "b"]),
          totalAgents: 2,
        },
      ],
      reports: [{ createdAt: new Date("2026-06-23T12:00:00.000Z") }],
      usageEvents: [
        {
          createdAt: new Date("2026-06-24T12:00:00.000Z"),
          totalTokens: 1000,
          estimatedCostCents: 12,
        },
      ],
    });

    expect(snapshot.current.documentUploads).toBe(1);
    expect(snapshot.current.pagesUploaded).toBe(3000);
    expect(snapshot.current.pagesAnalyzed).toBe(6000);
    expect(snapshot.current.agentRuns).toBe(2);
    expect(snapshot.current.agentCalls).toBe(5);
    expect(snapshot.current.reportsGenerated).toBe(1);
    expect(snapshot.current.exactTokens).toBe(1000);
    expect(snapshot.current.exactCostUsd).toBe(0.12);
    expect(snapshot.firmUsage?.pagesOverIncluded).toBe(1000);
    expect(snapshot.firmUsage?.pageOverageUsd).toBe(20);
    expect(snapshot.firmUsage?.estimatedOverageUsd).toBe(20);
    expect(
      snapshot.alerts.some(alert => alert.includes("included pages"))
    ).toBe(true);
  });

  it("ignores usage outside the current billing period", () => {
    const snapshot = buildUsageSnapshot({
      plan: PLATFORM_SUBSCRIPTIONS.advocate,
      subscription: null,
      now,
      documents: [
        {
          id: 10,
          createdAt: new Date("2026-05-20T12:00:00.000Z"),
          extractionTextLength: 3_000,
          extractedText: null,
          summary: null,
          fileSize: 0,
        },
      ],
      agentRuns: [
        {
          createdAt: new Date("2026-05-21T12:00:00.000Z"),
          documentIds: JSON.stringify([10]),
          agentIds: JSON.stringify(["a"]),
          totalAgents: 1,
        },
      ],
      reports: [{ createdAt: new Date("2026-05-22T12:00:00.000Z") }],
      usageEvents: [
        {
          createdAt: new Date("2026-05-23T12:00:00.000Z"),
          totalTokens: 1000,
          estimatedCostCents: 12,
        },
      ],
    });

    expect(snapshot.current.documentUploads).toBe(0);
    expect(snapshot.current.pagesAnalyzed).toBe(0);
    expect(snapshot.current.agentRuns).toBe(0);
    expect(snapshot.current.reportsGenerated).toBe(0);
    expect(snapshot.current.exactTokens).toBe(0);
  });
});
