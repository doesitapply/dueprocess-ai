export type ExtractionStatus = "completed" | "failed" | "pending" | "processing";

export type ExtractionDiagnostics = {
  documentHash: string | null;
  extractionMethod: string;
  extractionNote: string | null;
  textLength: number;
  qualityScore: number;
  warnings: string[];
};

export type ExtractionResultForDiagnostics = {
  text: string;
  method: string;
  status: "completed" | "failed";
  note?: string;
};

export type AnalysisReadyDocument = {
  status: ExtractionStatus | string;
  fileName?: string | null;
  extractedText?: string | null;
  documentHash?: string | null;
  extractionMethod?: string | null;
  extractionQualityScore?: number | null;
  extractionWarnings?: string | null;
};

const SOURCE_HASH_PATTERN = /^SOURCE_SHA256:\s*([a-f0-9]{64})\s*$/im;
export const ANALYSIS_READY_MIN_TEXT_LENGTH = 100;
export const ANALYSIS_READY_MIN_QUALITY_SCORE = 70;
const ANALYSIS_BLOCKING_WARNINGS = new Set([
  "extraction_failed",
  "missing_source_hash",
  "empty_extracted_text",
  "very_short_extracted_text",
  "low_text_signal",
]);

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function parseWarningList(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function normalizeExtractedText(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

export function sourceHashFromText(text: string | null | undefined): string | null {
  if (!text) return null;
  const match = text.match(SOURCE_HASH_PATTERN);
  return match?.[1]?.toLowerCase() ?? null;
}

export function extractedTextBody(text: string | null | undefined): string {
  if (!text) return "";
  return normalizeExtractedText(text.replace(SOURCE_HASH_PATTERN, ""));
}

export function withSourceAnchor(text: string, hash: string) {
  const normalized = normalizeExtractedText(text);
  if (!normalized) return "";
  return `SOURCE_SHA256: ${hash}\n\n${normalized}`;
}

export function analyzeExtractionDiagnostics(
  extraction: ExtractionResultForDiagnostics,
  documentHash: string | null
): ExtractionDiagnostics {
  const normalizedText = normalizeExtractedText(extraction.text || "");
  const embeddedHash = sourceHashFromText(normalizedText);
  const resolvedHash = (documentHash || embeddedHash)?.toLowerCase() ?? null;
  const body = extractedTextBody(normalizedText);
  const textLength = body.length;
  const warnings: string[] = [];

  if (extraction.status !== "completed") warnings.push("extraction_failed");
  if (!resolvedHash) warnings.push("missing_source_hash");
  if (!body) warnings.push("empty_extracted_text");
  if (body && body.length < ANALYSIS_READY_MIN_TEXT_LENGTH) warnings.push("very_short_extracted_text");
  if (extraction.method.includes("vision_ocr")) warnings.push("vision_ocr_used");

  const replacementCharacters = (body.match(/\uFFFD/g) || []).length;
  if (replacementCharacters > 0) warnings.push("replacement_characters_detected");

  const nonWhitespaceLength = body.replace(/\s/g, "").length;
  const alphanumericLength = body.replace(/[^a-z0-9]/gi, "").length;
  const alphanumericRatio = nonWhitespaceLength === 0 ? 0 : alphanumericLength / nonWhitespaceLength;
  if (body.length > 50 && alphanumericRatio < 0.35) warnings.push("low_text_signal");

  let qualityScore = extraction.status === "completed" ? 100 : 0;
  if (!resolvedHash) qualityScore -= 45;
  if (!body) qualityScore -= 80;
  else if (body.length < ANALYSIS_READY_MIN_TEXT_LENGTH) qualityScore -= 25;
  else if (body.length < 500) qualityScore -= 10;
  if (replacementCharacters > 0) qualityScore -= Math.min(20, replacementCharacters * 2);
  if (body.length > 50 && alphanumericRatio < 0.35) qualityScore -= 25;

  return {
    documentHash: resolvedHash,
    extractionMethod: extraction.method,
    extractionNote: extraction.note ?? null,
    textLength,
    qualityScore: clampScore(qualityScore),
    warnings: Array.from(new Set(warnings)),
  };
}

export function inferExtractionDiagnostics(document: AnalysisReadyDocument): ExtractionDiagnostics {
  const embeddedHash = sourceHashFromText(document.extractedText);
  const body = extractedTextBody(document.extractedText);
  const hash = (document.documentHash || embeddedHash)?.toLowerCase() ?? null;
  const computedDiagnostics = analyzeExtractionDiagnostics(
    {
      text: document.extractedText || "",
      method: document.extractionMethod || "legacy_unknown",
      status: document.status === "completed" ? "completed" : "failed",
    },
    hash
  );
  const score = document.extractionQualityScore ?? computedDiagnostics.qualityScore;

  const warnings = new Set([...computedDiagnostics.warnings, ...parseWarningList(document.extractionWarnings)]);
  if (!hash) warnings.add("missing_source_hash");
  if (!body) warnings.add("empty_extracted_text");
  if (body && body.length < ANALYSIS_READY_MIN_TEXT_LENGTH) warnings.add("very_short_extracted_text");
  if (score < ANALYSIS_READY_MIN_QUALITY_SCORE) warnings.add("review_extraction_quality");

  return {
    documentHash: hash,
    extractionMethod: document.extractionMethod || "legacy_unknown",
    extractionNote: null,
    textLength: body.length,
    qualityScore: clampScore(score),
    warnings: Array.from(warnings),
  };
}

export function isDocumentReadyForAnalysis(document: AnalysisReadyDocument): boolean {
  if (document.status !== "completed") return false;
  const diagnostics = inferExtractionDiagnostics(document);
  const hasBlockingWarning = diagnostics.warnings.some((warning) => ANALYSIS_BLOCKING_WARNINGS.has(warning));
  return (
    Boolean(diagnostics.documentHash) &&
    diagnostics.textLength >= ANALYSIS_READY_MIN_TEXT_LENGTH &&
    diagnostics.qualityScore >= ANALYSIS_READY_MIN_QUALITY_SCORE &&
    !hasBlockingWarning
  );
}

export function documentReadinessReason(document: AnalysisReadyDocument): string | null {
  if (document.status !== "completed") {
    return `${document.fileName || "Document"} is still ${document.status}; wait for extraction or retry OCR.`;
  }

  const diagnostics = inferExtractionDiagnostics(document);
  if (!diagnostics.textLength) {
    return `${document.fileName || "Document"} has no extracted text. Retry OCR or upload a cleaner copy.`;
  }
  if (!diagnostics.documentHash) {
    return `${document.fileName || "Document"} is missing a source hash. Retry OCR before analysis so findings can be anchored.`;
  }
  if (diagnostics.textLength < ANALYSIS_READY_MIN_TEXT_LENGTH) {
    return `${document.fileName || "Document"} only has ${diagnostics.textLength} extracted characters. Review OCR or upload a cleaner copy before agent analysis.`;
  }
  if (diagnostics.warnings.includes("low_text_signal")) {
    return `${document.fileName || "Document"} has low-signal extracted text. Review OCR before agent analysis.`;
  }
  if (diagnostics.qualityScore < ANALYSIS_READY_MIN_QUALITY_SCORE) {
    return `${document.fileName || "Document"} has low extraction quality. Review extracted text before analysis.`;
  }
  return null;
}
