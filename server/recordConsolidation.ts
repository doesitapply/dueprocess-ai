import { createHash } from "node:crypto";
import type { Document } from "../drizzle/schema";
import {
  extractedTextBody,
  inferExtractionDiagnostics,
  isDocumentReadyForAnalysis,
  sourceHashFromText,
} from "./extractionReadiness";

export type MasterRecordMatchType = "exact_hash" | "exact_text" | "name_size_candidate" | "single";

export type MasterRecordDocument = {
  id: number;
  fileName: string;
  status: string;
  mimeType: string | null;
  fileSize: number | null;
  createdAt: Date | string;
  documentHash: string | null;
  extractionMethod: string | null;
  extractionTextLength: number;
  extractionQualityScore: number;
  analysisReady: boolean;
  role: "canonical" | "duplicate" | "candidate";
  reason: string;
};

export type MasterRecord = {
  id: string;
  matchKey: string;
  matchType: MasterRecordMatchType;
  label: string;
  canonicalDocumentId: number;
  canonicalFileName: string;
  documentHash: string | null;
  textFingerprint: string | null;
  duplicateSafe: boolean;
  documentCount: number;
  duplicateCount: number;
  readyCount: number;
  blockedCount: number;
  bestQualityScore: number;
  totalTextLength: number;
  recommendation: string;
  documents: MasterRecordDocument[];
};

export type ConsolidatedAnalysisDocuments = {
  documents: Document[];
  skippedDuplicateIds: number[];
  blockingDocuments: Document[];
  masterRecords: MasterRecord[];
};

function normalizedFileName(value: string): string {
  return value
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function textFingerprint(document: Pick<Document, "extractedText">): string | null {
  const body = extractedTextBody(document.extractedText)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  if (body.length < 100) return null;
  return createHash("sha256").update(body).digest("hex");
}

function resolvedHash(document: Pick<Document, "documentHash" | "extractedText">): string | null {
  return (document.documentHash || sourceHashFromText(document.extractedText))?.toLowerCase() ?? null;
}

function groupKey(document: Document): { key: string; matchType: MasterRecordMatchType; textFingerprint: string | null; documentHash: string | null } {
  const documentHash = resolvedHash(document);
  if (documentHash) {
    return { key: `hash:${documentHash}`, matchType: "exact_hash", textFingerprint: textFingerprint(document), documentHash };
  }

  const fingerprint = textFingerprint(document);
  if (fingerprint) {
    return { key: `text:${fingerprint}`, matchType: "exact_text", textFingerprint: fingerprint, documentHash: null };
  }

  if (document.fileSize && document.fileSize > 0) {
    return {
      key: `name-size:${normalizedFileName(document.fileName)}:${document.fileSize}`,
      matchType: "name_size_candidate",
      textFingerprint: null,
      documentHash: null,
    };
  }

  return { key: `single:${document.id}`, matchType: "single", textFingerprint: null, documentHash: null };
}

function documentScore(document: Document): number {
  const diagnostics = inferExtractionDiagnostics(document);
  const readyScore = isDocumentReadyForAnalysis(document) ? 1_000_000 : 0;
  const completedScore = document.status === "completed" ? 100_000 : 0;
  const hashScore = diagnostics.documentHash ? 10_000 : 0;
  const qualityScore = diagnostics.qualityScore * 100;
  return readyScore + completedScore + hashScore + qualityScore + diagnostics.textLength;
}

function pickCanonical(documents: Document[]): Document {
  return documents
    .slice()
    .sort((a, b) => {
      const scoreDiff = documentScore(b) - documentScore(a);
      if (scoreDiff !== 0) return scoreDiff;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    })[0];
}

function matchLabel(matchType: MasterRecordMatchType): string {
  if (matchType === "exact_hash") return "Exact source duplicate";
  if (matchType === "exact_text") return "Exact text duplicate";
  if (matchType === "name_size_candidate") return "Possible duplicate";
  return "Single record";
}

function recommendationFor(matchType: MasterRecordMatchType, documentCount: number, canonicalReady: boolean): string {
  if (documentCount === 1) return canonicalReady ? "Keep as one master record." : "Fix extraction before analysis.";
  if (matchType === "exact_hash") return "Use the canonical file for analysis; keep duplicates only as aliases.";
  if (matchType === "exact_text") return "Text matches exactly. Use the best anchored copy as canonical.";
  if (matchType === "name_size_candidate") return "Review before merging. Filename and size match, but source/text proof is not strong enough to auto-collapse.";
  return "Review record group.";
}

function toMasterDocument(document: Document, canonicalId: number, matchType: MasterRecordMatchType): MasterRecordDocument {
  const diagnostics = inferExtractionDiagnostics(document);
  const analysisReady = isDocumentReadyForAnalysis(document);
  const isCanonical = document.id === canonicalId;
  const role = isCanonical ? "canonical" : matchType === "name_size_candidate" ? "candidate" : "duplicate";
  const reason = isCanonical
    ? "Best available copy for this master record."
    : matchType === "exact_hash"
      ? "Same source SHA-256 as the canonical record."
      : matchType === "exact_text"
        ? "Same extracted text fingerprint as the canonical record."
        : "Same normalized filename and file size; needs human review before merge.";

  return {
    id: document.id,
    fileName: document.fileName,
    status: document.status,
    mimeType: document.mimeType,
    fileSize: document.fileSize,
    createdAt: document.createdAt,
    documentHash: diagnostics.documentHash,
    extractionMethod: diagnostics.extractionMethod,
    extractionTextLength: diagnostics.textLength,
    extractionQualityScore: diagnostics.qualityScore,
    analysisReady,
    role,
    reason,
  };
}

export function buildMasterRecords(documents: Document[]): MasterRecord[] {
  const grouped = new Map<string, { matchType: MasterRecordMatchType; textFingerprint: string | null; documentHash: string | null; documents: Document[] }>();

  for (const document of documents) {
    const key = groupKey(document);
    const existing = grouped.get(key.key);
    if (existing) {
      existing.documents.push(document);
    } else {
      grouped.set(key.key, { matchType: key.matchType, textFingerprint: key.textFingerprint, documentHash: key.documentHash, documents: [document] });
    }
  }

  return Array.from(grouped.entries())
    .map(([matchKey, group]) => {
      const matchType = group.documents.length === 1 ? "single" : group.matchType;
      const canonical = pickCanonical(group.documents);
      const mappedDocuments = group.documents
        .map((document) => toMasterDocument(document, canonical.id, matchType))
        .sort((a, b) => (a.role === "canonical" ? -1 : b.role === "canonical" ? 1 : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      const readyCount = mappedDocuments.filter((document) => document.analysisReady).length;
      const totalTextLength = mappedDocuments.reduce((sum, document) => sum + document.extractionTextLength, 0);
      const bestQualityScore = Math.max(0, ...mappedDocuments.map((document) => document.extractionQualityScore));
      const duplicateSafe = matchType === "exact_hash" || matchType === "exact_text";

      return {
        id: matchKey,
        matchKey,
        matchType,
        label: matchLabel(matchType),
        canonicalDocumentId: canonical.id,
        canonicalFileName: canonical.fileName,
        documentHash: group.documentHash,
        textFingerprint: group.textFingerprint,
        duplicateSafe,
        documentCount: mappedDocuments.length,
        duplicateCount: Math.max(0, mappedDocuments.length - 1),
        readyCount,
        blockedCount: mappedDocuments.length - readyCount,
        bestQualityScore,
        totalTextLength,
        recommendation: recommendationFor(matchType, mappedDocuments.length, isDocumentReadyForAnalysis(canonical)),
        documents: mappedDocuments,
      };
    })
    .sort((a, b) => {
      const duplicateDiff = b.duplicateCount - a.duplicateCount;
      if (duplicateDiff !== 0) return duplicateDiff;
      return new Date(b.documents[0]?.createdAt ?? 0).getTime() - new Date(a.documents[0]?.createdAt ?? 0).getTime();
    });
}

export function consolidateDocumentsForAnalysis(documents: Document[]): ConsolidatedAnalysisDocuments {
  const masterRecords = buildMasterRecords(documents);
  const byId = new Map(documents.map((document) => [document.id, document]));
  const analysisDocuments: Document[] = [];
  const skippedDuplicateIds: number[] = [];
  const blockingDocuments: Document[] = [];

  for (const record of masterRecords) {
    const canonical = byId.get(record.canonicalDocumentId);
    if (!canonical) continue;

    if (record.duplicateSafe) {
      if (isDocumentReadyForAnalysis(canonical)) {
        analysisDocuments.push(canonical);
        record.documents
          .filter((document) => document.id !== canonical.id)
          .forEach((document) => skippedDuplicateIds.push(document.id));
      } else {
        record.documents.forEach((document) => {
          const original = byId.get(document.id);
          if (original) blockingDocuments.push(original);
        });
      }
      continue;
    }

    for (const document of record.documents) {
      const original = byId.get(document.id);
      if (!original) continue;
      if (isDocumentReadyForAnalysis(original)) {
        analysisDocuments.push(original);
      } else {
        blockingDocuments.push(original);
      }
    }
  }

  return {
    documents: analysisDocuments,
    skippedDuplicateIds: Array.from(new Set(skippedDuplicateIds)),
    blockingDocuments,
    masterRecords,
  };
}
