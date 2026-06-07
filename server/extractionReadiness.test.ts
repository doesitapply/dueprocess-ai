import { describe, expect, it } from "vitest";
import {
  analyzeExtractionDiagnostics,
  documentReadinessReason,
  extractedTextBody,
  isDocumentReadyForAnalysis,
  sourceHashFromText,
  withSourceAnchor,
} from "./extractionReadiness";

const hash = "a".repeat(64);

describe("extraction readiness", () => {
  it("anchors source text with a SHA-256 marker", () => {
    const anchored = withSourceAnchor("  Court filing text\n\n\n\nPage 2  ", hash);

    expect(sourceHashFromText(anchored)).toBe(hash);
    expect(extractedTextBody(anchored)).toBe("Court filing text\n\n\nPage 2");
  });

  it("marks completed anchored extraction as analysis-ready", () => {
    const text = withSourceAnchor("This is a full legal record with enough readable words to trust for first-pass analysis. The order discusses bail, counsel, and a hearing date.", hash);
    const diagnostics = analyzeExtractionDiagnostics({ text, method: "pdf_text", status: "completed" }, hash);

    expect(diagnostics.qualityScore).toBeGreaterThanOrEqual(90);
    expect(diagnostics.textLength).toBeGreaterThan(100);
    expect(isDocumentReadyForAnalysis({ status: "completed", extractedText: text, documentHash: hash, extractionQualityScore: diagnostics.qualityScore })).toBe(true);
  });

  it("blocks completed text that lacks a source hash", () => {
    const text = "The document has words, but no source anchor.";
    const diagnostics = analyzeExtractionDiagnostics({ text, method: "legacy_unknown", status: "completed" }, null);

    expect(diagnostics.warnings).toContain("missing_source_hash");
    expect(isDocumentReadyForAnalysis({ status: "completed", extractedText: text, extractionQualityScore: diagnostics.qualityScore })).toBe(false);
    expect(documentReadinessReason({ status: "completed", fileName: "legacy.txt", extractedText: text })).toContain("missing a source hash");
  });

  it("keeps OCR fallback visible without blocking usable anchored text", () => {
    const text = withSourceAnchor("Scanned motion text with names, dates, exhibit labels, and enough content to support a cautious review.", hash);
    const diagnostics = analyzeExtractionDiagnostics({ text, method: "pdf_vision_ocr", status: "completed", note: "Vision OCR fallback used." }, hash);

    expect(diagnostics.warnings).toContain("vision_ocr_used");
    expect(isDocumentReadyForAnalysis({ status: "completed", extractedText: text, documentHash: hash, extractionQualityScore: diagnostics.qualityScore })).toBe(true);
  });

  it("blocks failed or empty extraction", () => {
    const diagnostics = analyzeExtractionDiagnostics({ text: "", method: "pdf_text", status: "failed", note: "No text." }, hash);

    expect(diagnostics.qualityScore).toBe(0);
    expect(diagnostics.warnings).toContain("extraction_failed");
    expect(diagnostics.warnings).toContain("empty_extracted_text");
    expect(isDocumentReadyForAnalysis({ status: "failed", extractedText: "", documentHash: hash, extractionQualityScore: diagnostics.qualityScore })).toBe(false);
  });
});
