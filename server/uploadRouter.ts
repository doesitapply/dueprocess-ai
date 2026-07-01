import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { storagePut } from "./storage";
import { getDb } from "./db";
import { documents } from "../drizzle/schema";
import { transcribeAudio } from "./_core/voiceTranscription";
import { invokeLLM } from "./_core/llm";
import { createHash } from "node:crypto";
import { enforceDocumentUploadLimit } from "./accessControl";
import {
  analyzeExtractionDiagnostics,
  isDocumentReadyForAnalysis,
  withSourceAnchor,
} from "./extractionReadiness";
import {
  documentHasHash,
  extractTextContent,
  failedExtraction,
  fetchStoredFileBuffer,
  sha256,
  shortHash,
  type ExtractionResult,
} from "./uploadExtraction";

async function summarizeExtractedText(extractedText: string): Promise<string> {
  if (!extractedText || extractedText.length <= 100) return "";
  try {
    const summaryResponse = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "You are a legal document summarizer. Provide a concise 2-3 sentence summary of the document.",
        },
        {
          role: "user",
          content: `Summarize this document:\n\n${extractedText.substring(0, 5000)}`,
        },
      ],
    });
    const content = summaryResponse.choices[0]?.message?.content;
    return typeof content === "string" ? content : "";
  } catch (error) {
    console.error("Summary generation failed:", error);
    return "";
  }
}

function appendExtractionSummary(
  summary: string,
  extraction: ExtractionResult
) {
  const extractionSummary = [
    extraction.note || "",
    extraction.method ? `Extraction method: ${extraction.method}.` : "",
    extraction.status === "failed"
      ? "Document saved, but it is not ready for agent analysis. Retry OCR or upload a cleaner copy."
      : "",
  ]
    .filter(Boolean)
    .join(" ");

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
      const duplicate = existingDocuments.find(document =>
        documentHasHash(document, documentHash)
      );
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
        const duplicateReady = isDocumentReadyForAnalysis({
          status: duplicate.status,
          extractedText: duplicate.extractedText,
          documentHash:
            diagnostics.documentHash || duplicate.documentHash || documentHash,
          extractionMethod: duplicate.extractionMethod || "duplicate",
          extractionQualityScore: diagnostics.qualityScore,
          extractionWarnings: duplicate.extractionWarnings,
        });
        return {
          success: duplicateReady,
          extractionCompleted: duplicate.status === "completed",
          duplicate: true,
          documentId: duplicate.id,
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
      let extraction = await extractTextContent(
        fileBuffer,
        mimeType,
        fileUrl,
        documentHash
      );
      let extractedText = extraction.text;

      // If audio/video, transcribe it
      if (mimeType.includes("audio/") || mimeType.includes("video/")) {
        try {
          const transcription = await transcribeAudio({
            audioUrl: fileUrl,
          });
          if ("text" in transcription) {
            const transcriptionText = withSourceAnchor(
              transcription.text,
              documentHash
            );
            extractedText = transcriptionText;
            extraction = {
              text: transcriptionText,
              method: "audio_transcription",
              status: transcriptionText ? "completed" : "failed",
              note: transcriptionText
                ? undefined
                : "Audio/video transcription returned no usable text.",
            };
          }
        } catch (error) {
          console.error("Transcription failed:", error);
          extractedText = "";
          extraction = failedExtraction(
            "audio_transcription",
            error instanceof Error ? error.message : "Transcription failed."
          );
        }
      }

      // Generate embedding for semantic search
      const embedding = extractedText
        ? await generateEmbedding(extractedText)
        : [];
      const embeddingJson = JSON.stringify(embedding);
      const diagnostics = analyzeExtractionDiagnostics(
        extraction,
        documentHash
      );
      const extractionWarningsJson = JSON.stringify(diagnostics.warnings);

      // Generate summary using LLM
      let summary = await summarizeExtractedText(extractedText);
      const documentStatus = extraction.status;
      summary = appendExtractionSummary(summary, extraction);
      const analysisReady = isDocumentReadyForAnalysis({
        status: documentStatus,
        extractedText,
        documentHash: diagnostics.documentHash || documentHash,
        extractionMethod: diagnostics.extractionMethod,
        extractionQualityScore: diagnostics.qualityScore,
        extractionWarnings: extractionWarningsJson,
      });

      const insertResult = await db.insert(documents).values({
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
        extractionWarnings: extractionWarningsJson,
        extractedText,
        embedding: embeddingJson,
        summary,
        status: documentStatus,
      });
      const insertedDocumentId = Number(insertResult[0].insertId);

      return {
        success: analysisReady,
        extractionCompleted: documentStatus === "completed",
        documentId: insertedDocumentId,
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

      await db
        .update(documents)
        .set({ status: "processing" })
        .where(eq(documents.id, document.id));

      try {
        const fileBuffer = await fetchStoredFileBuffer(
          document.fileKey,
          document.fileUrl
        );
        const documentHash = sha256(fileBuffer);
        const extraction = await extractTextContent(
          fileBuffer,
          document.mimeType || "application/octet-stream",
          document.fileUrl,
          documentHash
        );
        const diagnostics = analyzeExtractionDiagnostics(
          extraction,
          documentHash
        );
        const extractionWarningsJson = JSON.stringify(diagnostics.warnings);
        const embedding = extraction.text
          ? await generateEmbedding(extraction.text)
          : [];
        let summary = await summarizeExtractedText(extraction.text);
        summary = appendExtractionSummary(summary, extraction);
        const analysisReady = isDocumentReadyForAnalysis({
          status: extraction.status,
          extractedText: extraction.text,
          documentHash: diagnostics.documentHash || documentHash,
          extractionMethod: diagnostics.extractionMethod,
          extractionQualityScore: diagnostics.qualityScore,
          extractionWarnings: extractionWarningsJson,
        });

        await db
          .update(documents)
          .set({
            documentHash: diagnostics.documentHash || documentHash,
            extractionMethod: diagnostics.extractionMethod,
            extractionNote: diagnostics.extractionNote,
            extractionTextLength: diagnostics.textLength,
            extractionQualityScore: diagnostics.qualityScore,
            extractionWarnings: extractionWarningsJson,
            extractedText: extraction.text,
            embedding: JSON.stringify(embedding),
            summary,
            status: extraction.status,
          })
          .where(eq(documents.id, document.id));

        return {
          success: analysisReady,
          extractionCompleted: extraction.status === "completed",
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
        const extraction = failedExtraction(
          "retry_error",
          error instanceof Error ? error.message : "OCR retry failed."
        );
        const diagnostics = analyzeExtractionDiagnostics(
          extraction,
          document.documentHash || null
        );
        await db
          .update(documents)
          .set({
            extractionMethod: diagnostics.extractionMethod,
            extractionNote: diagnostics.extractionNote,
            extractionTextLength: diagnostics.textLength,
            extractionQualityScore: diagnostics.qualityScore,
            extractionWarnings: JSON.stringify(diagnostics.warnings),
            status: "failed",
            summary: appendExtractionSummary(
              document.summary || "",
              extraction
            ),
          })
          .where(eq(documents.id, document.id));
        return {
          success: false,
          extractionCompleted: false,
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
      const filtered = results.filter(doc => {
        if (!doc.extractedText) return false;
        return doc.extractedText.toLowerCase().includes(query.toLowerCase());
      });

      return filtered;
    }),
});
