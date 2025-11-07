import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { storagePut } from "./storage";
import { getDb } from "./db";
import { documents } from "../drizzle/schema";
import { transcribeAudio } from "./_core/voiceTranscription";
import { invokeLLM } from "./_core/llm";

// Helper to generate random suffix for file keys
function randomSuffix() {
  return Math.random().toString(36).substring(2, 10);
}

// Helper to extract text from different file types
async function extractTextContent(fileBuffer: Buffer, mimeType: string): Promise<string> {
  try {
    // Plain text files
    if (mimeType.includes("text/plain") || mimeType.includes("text/markdown")) {
      return fileBuffer.toString("utf-8");
    }

    // JSON files
    if (mimeType.includes("application/json")) {
      return JSON.stringify(JSON.parse(fileBuffer.toString("utf-8")), null, 2);
    }

    // DOCX files
    if (mimeType.includes("wordprocessingml") || mimeType.includes("msword")) {
      // For now, return placeholder - would need mammoth or similar library
      return "[DOCX content - text extraction pending]";
    }

    // PDF files
    if (mimeType.includes("pdf")) {
      // For now, return placeholder - would need pdf-parse or similar
      return "[PDF content - OCR extraction pending]";
    }

    // Images
    if (mimeType.includes("image/")) {
      return "[Image file - OCR extraction pending]";
    }

    return "";
  } catch (error) {
    console.error("Error extracting text:", error);
    return "";
  }
}

// Helper to generate embeddings using LLM
async function generateEmbedding(text: string): Promise<number[]> {
  try {
    // Use LLM to generate embeddings
    // For now, we'll use a simple approach - in production, use OpenAI embeddings API
    // This is a placeholder that returns a mock embedding
    // TODO: Implement actual embedding generation
    const mockEmbedding = Array.from({ length: 1536 }, () => Math.random());
    return mockEmbedding;
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

      // Generate unique file key
      const fileKey = `${userId}-uploads/${fileName}-${randomSuffix()}`;

      // Upload to S3
      const { url: fileUrl } = await storagePut(fileKey, fileBuffer, mimeType);

      // Extract text content
      let extractedText = await extractTextContent(fileBuffer, mimeType);

      // If audio/video, transcribe it
      if (mimeType.includes("audio/") || mimeType.includes("video/")) {
        try {
          const transcription = await transcribeAudio({
            audioUrl: fileUrl,
          });
          if ('text' in transcription) {
            extractedText = transcription.text;
          }
        } catch (error) {
          console.error("Transcription failed:", error);
          extractedText = "[Transcription failed]";
        }
      }

      // Generate embedding for semantic search
      const embedding = extractedText ? await generateEmbedding(extractedText) : [];
      const embeddingJson = JSON.stringify(embedding);

      // Generate summary using LLM
      let summary = "";
      if (extractedText && extractedText.length > 100) {
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
          summary = typeof content === 'string' ? content : "";
        } catch (error) {
          console.error("Summary generation failed:", error);
        }
      }

      // Save to database
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      await db.insert(documents).values({
        userId,
        fileName,
        fileUrl,
        fileKey,
        mimeType,
        fileSize,
        extractedText,
        embedding: embeddingJson,
        summary,
        status: "completed",
      });

      return {
        success: true,
        fileUrl,
        summary,
      };
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

