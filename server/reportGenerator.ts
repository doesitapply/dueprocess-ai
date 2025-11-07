import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { documents, agentOutputs } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";

export const reportRouter = router({
  generate: protectedProcedure
    .input(
      z.object({
        documentId: z.number(),
        template: z.enum(["legal_brief", "investigation_report", "media_packet", "executive_summary"]),
        format: z.enum(["pdf", "docx", "html", "json"]),
        includeSources: z.boolean().default(true),
        branding: z
          .object({
            logo: z.string().optional(),
            color: z.string().optional(),
            title: z.string().optional(),
          })
          .optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not available",
        });
      }

      // Get document
      const [document] = await db
        .select()
        .from(documents)
        .where(eq(documents.id, input.documentId))
        .limit(1);

      if (!document || document.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Document not found",
        });
      }

      // Get all agent outputs for this document
      const outputs = await db
        .select()
        .from(agentOutputs)
        .where(eq(agentOutputs.documentId, input.documentId));

      const output = outputs[0];

      // Format agent outputs into readable sections
      const formattedOutputs = [];
      
      if (output) {
        if (output.jesterMemeCaption || output.jesterTiktokScript || output.jesterQuote) {
          formattedOutputs.push({
            agent: "Justice Jester",
            sections: [
              { title: "Meme Caption", content: output.jesterMemeCaption },
              { title: "TikTok Script", content: output.jesterTiktokScript },
              { title: "Viral Quote", content: output.jesterQuote },
            ].filter(s => s.content),
          });
        }

        if (output.clerkViolations || output.clerkCaseLaw || output.clerkMotionDraft) {
          formattedOutputs.push({
            agent: "Law Clerk",
            sections: [
              { title: "Legal Violations", content: output.clerkViolations },
              { title: "Case Law Analysis", content: output.clerkCaseLaw },
              { title: "Motion Draft", content: output.clerkMotionDraft },
            ].filter(s => s.content),
          });
        }

        if (output.hobotProductName || output.hobotDescription || output.hobotLink) {
          formattedOutputs.push({
            agent: "Hobot",
            sections: [
              { title: "Product Name", content: output.hobotProductName },
              { title: "Description", content: output.hobotDescription },
              { title: "Product Link", content: output.hobotLink },
            ].filter(s => s.content),
          });
        }
      }

      // Generate executive summary using LLM
      const summaryContent = formattedOutputs
        .map(o => `${o.agent}:\n${o.sections.map(s => `${s.title}: ${s.content}`).join("\n")}`)
        .join("\n\n");

      const summaryResponse = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are a legal analyst creating executive summaries. Generate a concise, professional summary of the evidence analysis in 2-3 paragraphs.`,
          },
          {
            role: "user",
            content: `Create an executive summary for this legal document analysis:\n\nDocument: ${document.fileName}\n\nAgent Analysis:\n${summaryContent || "No analysis available yet."}`,
          },
        ],
      });

      const executiveSummary =
        summaryResponse.choices[0]?.message?.content || "Analysis in progress. Summary will be generated once all agents complete processing.";

      // Build report data structure
      const reportData = {
        metadata: {
          title: input.branding?.title || `Evidence Analysis Report: ${document.fileName}`,
          generatedAt: new Date().toISOString(),
          generatedBy: ctx.user.name || ctx.user.email || "DueProcess AI User",
          documentId: document.id,
          documentName: document.fileName,
          template: input.template,
        },
        branding: input.branding || {
          logo: "https://dueprocess.ai/logo.png",
          color: "#3b82f6",
        },
        executiveSummary,
        document: {
          id: document.id,
          fileName: document.fileName,
          mimeType: document.mimeType,
          fileSize: document.fileSize,
          uploadedAt: document.createdAt.toISOString(),
          status: document.status,
          fileUrl: input.includeSources ? document.fileUrl : undefined,
        },
        analysis: formattedOutputs,
        statistics: {
          totalAgents: formattedOutputs.length,
          totalSections: formattedOutputs.reduce((sum, o) => sum + o.sections.length, 0),
          processingStatus: document.status,
          uploadDate: document.createdAt.toISOString(),
        },
      };

      // For now, return JSON format
      // In production, you'd use libraries like pdfkit, docx, etc. to generate actual files
      if (input.format === "json") {
        return {
          format: "json",
          data: reportData,
          downloadUrl: null,
        };
      }

      // Placeholder for PDF/DOCX generation
      // You would use libraries like pdfkit, puppeteer, or docx here
      return {
        format: input.format,
        data: reportData,
        downloadUrl: `/api/reports/download/${document.id}`, // Placeholder
        message: `${input.format.toUpperCase()} generation ready. Report data included.`,
      };
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Database not available",
      });
    }

    // Get all documents for this user (reports are generated from documents)
    const userDocuments = await db
      .select()
      .from(documents)
      .where(eq(documents.userId, ctx.user.id));

    return userDocuments.map((doc) => ({
      id: doc.id,
      name: doc.fileName,
      status: doc.status,
      createdAt: doc.createdAt,
      availableFormats: ["pdf", "docx", "html", "json"],
    }));
  }),

  preview: protectedProcedure
    .input(z.object({ documentId: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not available",
        });
      }

      // Get document
      const [document] = await db
        .select()
        .from(documents)
        .where(eq(documents.id, input.documentId))
        .limit(1);

      if (!document || document.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Document not found",
        });
      }

      // Get outputs
      const outputs = await db
        .select()
        .from(agentOutputs)
        .where(eq(agentOutputs.documentId, input.documentId));

      const output = outputs[0];

      const formattedOutputs = [];
      
      if (output) {
        if (output.jesterMemeCaption || output.jesterTiktokScript || output.jesterQuote) {
          formattedOutputs.push({
            agent: "Justice Jester",
            sections: [
              { title: "Meme Caption", content: output.jesterMemeCaption },
              { title: "TikTok Script", content: output.jesterTiktokScript },
              { title: "Viral Quote", content: output.jesterQuote },
            ].filter(s => s.content),
          });
        }

        if (output.clerkViolations || output.clerkCaseLaw || output.clerkMotionDraft) {
          formattedOutputs.push({
            agent: "Law Clerk",
            sections: [
              { title: "Legal Violations", content: output.clerkViolations },
              { title: "Case Law Analysis", content: output.clerkCaseLaw },
              { title: "Motion Draft", content: output.clerkMotionDraft },
            ].filter(s => s.content),
          });
        }

        if (output.hobotProductName || output.hobotDescription || output.hobotLink) {
          formattedOutputs.push({
            agent: "Hobot",
            sections: [
              { title: "Product Name", content: output.hobotProductName },
              { title: "Description", content: output.hobotDescription },
              { title: "Product Link", content: output.hobotLink },
            ].filter(s => s.content),
          });
        }
      }

      return {
        document: {
          id: document.id,
          fileName: document.fileName,
          mimeType: document.mimeType,
          status: document.status,
          createdAt: document.createdAt,
        },
        outputs: formattedOutputs,
        statistics: {
          totalAgents: formattedOutputs.length,
          totalSections: formattedOutputs.reduce((sum, o) => sum + o.sections.length, 0),
          processingStatus: document.status,
        },
      };
    }),
});

