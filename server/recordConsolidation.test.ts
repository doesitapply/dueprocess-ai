import { describe, expect, it } from "vitest";
import type { Document } from "../drizzle/schema";
import { withSourceAnchor } from "./extractionReadiness";
import { buildMasterRecords, consolidateDocumentsForAnalysis } from "./recordConsolidation";

const readyBody = "This legal record has enough readable text to support analysis. It names a filing, hearing date, party, exhibit, court action, and source details for careful review.";

function doc(overrides: Partial<Document>): Document {
  const hash = Object.prototype.hasOwnProperty.call(overrides, "documentHash")
    ? overrides.documentHash
    : "a".repeat(64);
  const text = overrides.extractedText ?? (hash ? withSourceAnchor(readyBody, hash) : readyBody);
  return {
    id: overrides.id ?? 1,
    userId: overrides.userId ?? 1,
    fileName: overrides.fileName ?? `file-${overrides.id ?? 1}.pdf`,
    fileUrl: overrides.fileUrl ?? `memory://${overrides.id ?? 1}`,
    fileKey: overrides.fileKey ?? `${overrides.userId ?? 1}-uploads/${(hash || "nohash").slice(0, 16)}-file.pdf`,
    mimeType: overrides.mimeType ?? "application/pdf",
    fileSize: overrides.fileSize ?? 1000,
    documentHash: hash,
    extractionMethod: overrides.extractionMethod ?? "pdf_text",
    extractionNote: overrides.extractionNote ?? null,
    extractionTextLength: overrides.extractionTextLength ?? readyBody.length,
    extractionQualityScore: overrides.extractionQualityScore ?? 100,
    extractionWarnings: overrides.extractionWarnings ?? "[]",
    extractedText: text,
    embedding: overrides.embedding ?? null,
    status: overrides.status ?? "completed",
    summary: overrides.summary ?? null,
    createdAt: overrides.createdAt ?? new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: overrides.updatedAt ?? new Date("2026-01-01T00:00:00.000Z"),
  } satisfies Document;
}

describe("record consolidation", () => {
  it("groups exact source-hash duplicates and picks the analysis-ready canonical", () => {
    const hash = "b".repeat(64);
    const documents = [
      doc({ id: 1, fileName: "bad-copy.pdf", documentHash: hash, status: "completed", extractedText: "", extractionTextLength: 0, extractionQualityScore: 0, extractionWarnings: JSON.stringify(["empty_extracted_text"]) }),
      doc({ id: 2, fileName: "clean-copy.pdf", documentHash: hash, extractionQualityScore: 98 }),
    ];

    const [record] = buildMasterRecords(documents);

    expect(record.matchType).toBe("exact_hash");
    expect(record.documentCount).toBe(2);
    expect(record.duplicateSafe).toBe(true);
    expect(record.canonicalDocumentId).toBe(2);
    expect(record.documents[0].role).toBe("canonical");
  });

  it("uses only the canonical exact duplicate for analysis and skips blocked duplicate copies", () => {
    const hash = "c".repeat(64);
    const documents = [
      doc({ id: 1, documentHash: hash, extractedText: "", extractionTextLength: 0, extractionQualityScore: 0, extractionWarnings: JSON.stringify(["empty_extracted_text"]) }),
      doc({ id: 2, documentHash: hash, extractionQualityScore: 100 }),
    ];

    const consolidated = consolidateDocumentsForAnalysis(documents);

    expect(consolidated.documents.map((document) => document.id)).toEqual([2]);
    expect(consolidated.skippedDuplicateIds).toEqual([1]);
    expect(consolidated.blockingDocuments).toHaveLength(0);
  });

  it("marks filename and size matches as candidates, not safe automatic duplicates", () => {
    const documents = [
      doc({ id: 1, fileName: "Motion.pdf", documentHash: null, extractedText: "", extractionTextLength: 0, fileSize: 400 }),
      doc({ id: 2, fileName: "motion.PDF", documentHash: null, extractedText: "", extractionTextLength: 0, fileSize: 400 }),
    ];

    const [record] = buildMasterRecords(documents);

    expect(record.matchType).toBe("name_size_candidate");
    expect(record.duplicateSafe).toBe(false);
    expect(record.recommendation).toContain("Review before merging");
  });
});
