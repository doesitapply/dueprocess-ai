import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { storageGet, storagePut } from "./storage";
import { getDb } from "./db";
import { documents } from "../drizzle/schema";
import { transcribeAudio } from "./_core/voiceTranscription";
import { invokeLLM } from "./_core/llm";
import { createHash } from "node:crypto";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { enforceDocumentUploadLimit } from "./accessControl";
import {
  analyzeExtractionDiagnostics,
  normalizeExtractedText,
  withSourceAnchor,
  type ExtractionResultForDiagnostics,
} from "./extractionReadiness";

// Helper to generate random suffix for file keys
function shortHash(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

function sha256(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

type ExtractionResult = ExtractionResultForDiagnostics;

function completedExtraction(text: string, method: string, documentHash: string, note?: string): ExtractionResult {
  const anchored = withSourceAnchor(text, documentHash);
  return {
    text: anchored,
    method,
    status: anchored ? "completed" : "failed",
    note: anchored ? note : `No usable text extracted by ${method}.`,
  };
}

function failedExtraction(method: string, note: string): ExtractionResult {
  return {
    text: "",
    method,
    status: "failed",
    note,
  };
}

function documentHasHash(document: typeof documents.$inferSelect, documentHash: string) {
  return (
    document.documentHash === documentHash ||
    document.extractedText?.startsWith(`SOURCE_SHA256: ${documentHash}`) ||
    document.fileKey?.includes(documentHash.slice(0, 16))
  );
}

async function fetchStoredFileBuffer(fileKey: string, fileUrl: string): Promise<Buffer> {
  const signed = fileKey ? await storageGet(fileKey).catch(() => null) : null;
  const url = signed?.url || fileUrl;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not download stored file for OCR retry: ${response.status} ${response.statusText}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function extractPdfText(fileBuffer: Buffer) {
  const parser = new PDFParse({ data: fileBuffer });
  try {
    const result = await parser.getText();
    return normalizeExtractedText(result.text || "");
  } finally {
    await parser.destroy();
  }
}

async function extractImageTextWithVision(fileBuffer: Buffer, mimeType: string) {
  const dataUrl = `data:${mimeType};base64,${fileBuffer.toString("base64")}`;
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content:
          "Extract all visible text from this legal document image. Preserve line breaks, captions, headers, dates, names, case numbers, and exhibit labels. Return only extracted text.",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "OCR this legal document image. Return verbatim text only.",
          },
          {
            type: "image_url",
            image_url: {
              url: dataUrl,
              detail: "high",
            },
          },
        ],
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  return normalizeExtractedText(typeof content === "string" ? content : JSON.stringify(content || ""));
}

async function extractPdfWithVision(fileUrl: string) {
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content:
          "Extract all text from this legal PDF. Preserve document structure, page order, headings, dates, names, case numbers, quotes, and exhibit labels. Return only extracted text.",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Extract verbatim text from this PDF. If it is scanned, perform OCR. Return text only.",
          },
          {
            type: "file_url",
            file_url: {
              url: fileUrl,
              mime_type: "application/pdf",
            },
          },
        ],
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  return normalizeExtractedText(typeof content === "string" ? content : JSON.stringify(content || ""));
}

// Helper to extract text from different file types
async function extractTextContent(
  fileBuffer: Buffer,
  mimeType: string,
  fileUrl: string,
  documentHash: string
): Promise<ExtractionResult> {
  try {
    // Plain text files
    if (mimeType.includes("text/plain") || mimeType.includes("text/markdown")) {
      return completedExtraction(fileBuffer.toString("utf-8"), "plain_text", documentHash);
    }

    // JSON files
    if (mimeType.includes("application/json")) {
      return completedExtraction(JSON.stringify(JSON.parse(fileBuffer.toString("utf-8")), null, 2), "json", documentHash);
    }

    // DOCX files
    if (mimeType.includes("wordprocessingml") || mimeType.includes("msword")) {
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      return completedExtraction(result.value, "docx_mammoth", documentHash);
    }

    // PDF files
    if (mimeType.includes("pdf")) {
      const parsedText = await extractPdfText(fileBuffer);
      if (parsedText.length >= 100) {
        return completedExtraction(parsedText, "pdf_text", documentHash);
      }

      const ocrText = await extractPdfWithVision(fileUrl);
      return completedExtraction(ocrText, "pdf_vision_ocr", documentHash, parsedText ? "Native PDF text was too short; vision OCR fallback used." : "Native PDF text was empty; vision OCR fallback used.");
    }

    // Images
    if (mimeType.includes("image/")) {
      const ocrText = await extractImageTextWithVision(fileBuffer, mimeType);
      return completedExtraction(ocrText, "image_vision_ocr", documentHash);
    }

    return failedExtraction("unsupported", `Unsupported file type: ${mimeType || "unknown"}.`);
  } catch (error) {
    console.error("Error extracting text:", error);
    return failedExtraction("error", error instanceof Error ? error.message : "Unknown extraction error.");
  }
}

async function summarizeExtractedText(extractedText: string): Promise<string> {
  if (!extractedText || extractedText.length <= 100) return "";
  try {
    const summaryResponse = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "You are a legal document summarizer. Provide a concise 2-3 sentence summary of the document.",
        },
        {
          role: "user",
          content: `Summarize this document:\n\n${extractedText.substring(0, 5000)}`,
        },
      ],
    });
    const content = summaryResponse.choices[0]?.message?.content;
    return typeof content === 'string' ? content : "";
  } catch (error) {
    console.error("Summary generation failed:", error);
    return "";
  }
}

function appendExtractionSummary(summary: string, extraction: ExtractionResult) {
  const extractionSummary = [
    extraction.note || "",
    extraction.method ? `Extraction method: ${extraction.method}.` : "",
    extraction.status === "failed" ? "Document saved, but it is not ready for agent analysis. Retry OCR or upload a cleaner copy." : "",
  ].filter(Boolean).join(" ");

  if (!summary && extractionSummary) return extractionSummary;
  if (summary && extractionSummary) return `${summary}\n\n${extractionSummary}`;
  return summary;
}

// Helper to generate embeddings using LLM
async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const digest = createHash("sha256").update(text).digest();
    return Array.from({ length: 384 }, (_, index) => {
      const byte = digest[index % digest.length];
      return Number(((byte - 128) / 128).toFixed(6));
    });
  } catch (error) {
    console.error("Error generating embedding:", error);
    return [];
  }
}

export const uploadRouter = router({
  /**
   * Upload a file to S3 and save metadata to database
   */
  uploadFile: protectedProcedure
    .input(
      z.object({
        fileName: z.string(),
        fileData: z.string(), // Base64 encoded file data
        mimeType: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { fileName, fileData, mimeType } = input;
      const userId = ctx.user.id;

      // Decode base64 file data
      const fileBuffer = Buffer.from(fileData, "base64");
      const fileSize = fileBuffer.length;
      const documentHash = sha256(fileBuffer);

      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      const { eq } = await import("drizzle-orm");
      const existingDocuments = await db
        .select()
        .from(documents)
        .where(eq(documents.userId, userId));
      const duplicate = existingDocuments.find((document) => documentHasHash(document, documentHash));
      if (duplicate) {
        const diagnostics = analyzeExtractionDiagnostics(
          {
            text: duplicate.extractedText || "",
            method: duplicate.extractionMethod || "duplicate",
            status: duplicate.status === "completed" ? "completed" : "failed",
            note: duplicate.extractionNote || undefined,
          },
          duplicate.documentHash || documentHash
        );
        return {
          success: duplicate.status === "completed" && diagnostics.textLength > 0 && Boolean(diagnostics.documentHash),
          duplicate: true,
          existingDocumentId: duplicate.id,
          fileUrl: duplicate.fileUrl,
          documentHash: diagnostics.documentHash || documentHash,
          status: duplicate.status,
          extractionMethod: duplicate.extractionMethod || "duplicate",
          extractionNote: `Duplicate file detected. Existing Corpus document reused: ${duplicate.fileName}`,
          textLength: diagnostics.textLength,
          extractionQualityScore: diagnostics.qualityScore,
          extractionWarnings: diagnostics.warnings,
          summary: duplicate.summary ?? "",
        };
      }

      await enforceDocumentUploadLimit(ctx.user);

      // Generate unique file key
      const fileKey = `${userId}-uploads/${documentHash.slice(0, 16)}-${shortHash(fileName)}-${fileName}`;

      // Upload to S3
      const { url: fileUrl } = await storagePut(fileKey, fileBuffer, mimeType);

      // Extract text content
      let extraction = await extractTextContent(fileBuffer, mimeType, fileUrl, documentHash);
      let extractedText = extraction.text;

      // If audio/video, transcribe it
      if (mimeType.includes("audio/") || mimeType.includes("video/")) {
        try {
          const transcription = await transcribeAudio({
            audioUrl: fileUrl,
          });
          if ('text' in transcription) {
            const transcriptionText = withSourceAnchor(transcription.text, documentHash);
            extractedText = transcriptionText;
            extraction = {
              text: transcriptionText,
              method: "audio_transcription",
              status: transcriptionText ? "completed" : "failed",
              note: transcriptionText ? undefined : "Audio/video transcription returned no usable text.",
            };
          }
        } catch (error) {
          console.error("Transcription failed:", error);
          extractedText = "";
          extraction = failedExtraction("audio_transcription", error instanceof Error ? error.message : "Transcription failed.");
        }
      }

      // Generate embedding for semantic search
      const embedding = extractedText ? await generateEmbedding(extractedText) : [];
      const embeddingJson = JSON.stringify(embedding);
      const diagnostics = analyzeExtractionDiagnostics(extraction, documentHash);

      // Generate summary using LLM
      let summary = await summarizeExtractedText(extractedText);
      const documentStatus = extraction.status;
      summary = appendExtractionSummary(summary, extraction);

      await db.insert(documents).values({
        userId,
        fileName,
        fileUrl,
        fileKey,
        mimeType,
        fileSize,
        documentHash: diagnostics.documentHash || documentHash,
        extractionMethod: diagnostics.extractionMethod,
        extractionNote: diagnostics.extractionNote,
        extractionTextLength: diagnostics.textLength,
        extractionQualityScore: diagnostics.qualityScore,
        extractionWarnings: JSON.stringify(diagnostics.warnings),
        extractedText,
        embedding: embeddingJson,
        summary,
        status: documentStatus,
      });

      return {
        success: documentStatus === "completed",
        fileUrl,
        documentHash,
        status: documentStatus,
        extractionMethod: extraction.method,
        extractionNote: extraction.note,
        textLength: diagnostics.textLength,
        extractionQualityScore: diagnostics.qualityScore,
        extractionWarnings: diagnostics.warnings,
        summary,
      };
    }),

  retryExtraction: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const { eq } = await import("drizzle-orm");
      const [document] = await db
        .select()
        .from(documents)
        .where(eq(documents.id, input.id))
        .limit(1);

      if (!document || document.userId !== ctx.user.id) {
        throw new Error("Document not found");
      }

      await db.update(documents).set({ status: "processing" }).where(eq(documents.id, document.id));

      try {
        const fileBuffer = await fetchStoredFileBuffer(document.fileKey, document.fileUrl);
        const documentHash = sha256(fileBuffer);
        const extraction = await extractTextContent(
          fileBuffer,
          document.mimeType || "application/octet-stream",
          document.fileUrl,
          documentHash
        );
        const diagnostics = analyzeExtractionDiagnostics(extraction, documentHash);
        const embedding = extraction.text ? await generateEmbedding(extraction.text) : [];
        let summary = await summarizeExtractedText(extraction.text);
        summary = appendExtractionSummary(summary, extraction);

        await db
          .update(documents)
          .set({
            documentHash: diagnostics.documentHash || documentHash,
            extractionMethod: diagnostics.extractionMethod,
            extractionNote: diagnostics.extractionNote,
            extractionTextLength: diagnostics.textLength,
            extractionQualityScore: diagnostics.qualityScore,
            extractionWarnings: JSON.stringify(diagnostics.warnings),
            extractedText: extraction.text,
            embedding: JSON.stringify(embedding),
            summary,
            status: extraction.status,
          })
          .where(eq(documents.id, document.id));

        return {
          success: extraction.status === "completed",
          status: extraction.status,
          documentHash,
          extractionMethod: extraction.method,
          extractionNote: extraction.note,
          textLength: diagnostics.textLength,
          extractionQualityScore: diagnostics.qualityScore,
          extractionWarnings: diagnostics.warnings,
          summary,
        };
      } catch (error) {
        const extraction = failedExtraction("retry_error", error instanceof Error ? error.message : "OCR retry failed.");
        const diagnostics = analyzeExtractionDiagnostics(extraction, document.documentHash || null);
        await db
          .update(documents)
          .set({
            extractionMethod: diagnostics.extractionMethod,
            extractionNote: diagnostics.extractionNote,
            extractionTextLength: diagnostics.textLength,
            extractionQualityScore: diagnostics.qualityScore,
            extractionWarnings: JSON.stringify(diagnostics.warnings),
            status: "failed",
            summary: appendExtractionSummary(document.summary || "", extraction),
          })
          .where(eq(documents.id, document.id));
        return {
          success: false,
          status: "failed" as const,
          extractionMethod: extraction.method,
          extractionNote: extraction.note,
          textLength: 0,
          extractionQualityScore: diagnostics.qualityScore,
          extractionWarnings: diagnostics.warnings,
          summary: extraction.note,
        };
      }
    }),

  /**
   * List all documents for the current user
   */
  listDocuments: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    const { eq, desc } = await import("drizzle-orm");
    const results = await db
      .select()
      .from(documents)
      .where(eq(documents.userId, ctx.user.id))
      .orderBy(desc(documents.createdAt));

    return results;
  }),

  /**
   * Search documents by semantic similarity
   */
  searchDocuments: protectedProcedure
    .input(
      z.object({
        query: z.string(),
        limit: z.number().default(10),
      })
    )
    .query(async ({ input, ctx }) => {
      const { query, limit } = input;
      const userId = ctx.user.id;

      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      // Generate embedding for search query
      const queryEmbedding = await generateEmbedding(query);

      // For now, do simple text search
      // TODO: Implement proper vector similarity search
      const { eq } = await import("drizzle-orm");
      const results = await db
        .select()
        .from(documents)
        .where(eq(documents.userId, userId))
        .limit(limit);

      // Filter by text match (simple approach)
      const filtered = results.filter((doc) => {
        if (!doc.extractedText) return false;
        return doc.extractedText.toLowerCase().includes(query.toLowerCase());
      });

      return filtered;
    }),
});
