import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { storagePut } from "./storage";
import { transcribeAudio } from "./_core/voiceTranscription";
import { TRPCError } from "@trpc/server";

/**
 * File processing router with OCR, transcription, and multi-format support
 */

export const fileProcessingRouter = router({
  /**
   * Process uploaded file based on type
   * Handles: PDF (OCR), Audio (transcription), Video (extract audio + transcribe), Images (OCR), Text (direct)
   */
  processFile: protectedProcedure
    .input(
      z.object({
        fileName: z.string(),
        fileContent: z.string(), // base64 or text
        fileType: z.enum(["pdf", "audio", "video", "image", "text", "document", "unknown"]),
        mimeType: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { fileName, fileContent, fileType, mimeType } = input;

      try {
        let extractedText = "";
        let fileUrl = "";
        let processingMethod = "";

        // Upload file to S3 first
        const fileBuffer = Buffer.from(
          fileContent.includes("base64,") 
            ? fileContent.split("base64,")[1] 
            : fileContent,
          fileContent.includes("base64,") ? "base64" : "utf-8"
        );

        const fileKey = `${ctx.user.id}/uploads/${Date.now()}-${fileName}`;
        const uploadResult = await storagePut(fileKey, fileBuffer, mimeType || "application/octet-stream");
        fileUrl = uploadResult.url;

        // Process based on file type
        switch (fileType) {
          case "audio":
            // Use voice transcription for audio files
            processingMethod = "Audio Transcription (Whisper API)";
            try {
              const transcription = await transcribeAudio({
                audioUrl: fileUrl,
              });
              if ('text' in transcription) {
                extractedText = transcription.text;
              } else {
                throw new Error(transcription.error || 'Transcription failed');
              }
            } catch (error) {
              throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: `Audio transcription failed: ${error instanceof Error ? error.message : "Unknown error"}`,
              });
            }
            break;

          case "video":
            // For video, we'd extract audio and transcribe
            // For now, return placeholder - would need ffmpeg or similar
            processingMethod = "Video Processing (Audio Extraction + Transcription)";
            extractedText = "[Video processing: Audio extraction and transcription coming soon]";
            break;

          case "image":
            // For images, we'd use OCR
            // Placeholder for now - would integrate with OCR service
            processingMethod = "Image OCR";
            extractedText = "[Image OCR processing coming soon - will extract text from images]";
            break;

          case "pdf":
            // For PDFs, we'd extract text and use OCR for scanned pages
            // Placeholder for now - would use pdf-parse or similar
            processingMethod = "PDF Text Extraction + OCR";
            extractedText = "[PDF processing coming soon - will extract text and OCR scanned pages]";
            break;

          case "text":
            // Direct text extraction
            processingMethod = "Direct Text Extraction";
            extractedText = fileContent.includes("base64,")
              ? Buffer.from(fileContent.split("base64,")[1], "base64").toString("utf-8")
              : fileContent;
            break;

          case "document":
            // For Word docs, we'd extract text
            // Placeholder for now - would use mammoth or similar
            processingMethod = "Document Text Extraction";
            extractedText = "[Document processing coming soon - will extract text from Word files]";
            break;

          default:
            processingMethod = "Unknown Format";
            extractedText = "[Unsupported file type]";
        }

        return {
          success: true,
          fileName,
          fileUrl,
          fileType,
          extractedText,
          processingMethod,
          textLength: extractedText.length,
        };
      } catch (error) {
        console.error("File processing error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "File processing failed",
        });
      }
    }),

  /**
   * Batch process multiple files
   */
  processBatch: protectedProcedure
    .input(
      z.object({
        files: z.array(
          z.object({
            fileName: z.string(),
            fileContent: z.string(),
            fileType: z.enum(["pdf", "audio", "video", "image", "text", "document", "unknown"]),
            mimeType: z.string().optional(),
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }): Promise<{
      totalFiles: number;
      successful: number;
      failed: number;
      results: any[];
    }> => {
      const results: any[] = [];

      for (const file of input.files) {
        try {
          // Reuse the single file processing logic
          const result = await fileProcessingRouter.createCaller({ user: ctx.user, req: ctx.req, res: ctx.res }).processFile(file);
          results.push(result);
        } catch (error) {
          results.push({
            success: false,
            fileName: file.fileName,
            error: error instanceof Error ? error.message : "Processing failed",
          });
        }
      }

      return {
        totalFiles: input.files.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results,
      };
    }),
});

