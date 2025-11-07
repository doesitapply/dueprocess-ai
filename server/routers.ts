import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { stripeRouter } from "./stripeRouter";
import { 
  createDocument, 
  getUserDocuments, 
  getDocumentById, 
  updateDocumentStatus,
  createAgentOutput,
  getAgentOutputByDocumentId,
  getDb
} from "./db";
import { documents, agentOutputs, subscriptions, payments, users } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { storagePut } from "./storage";
import { invokeLLM } from "./_core/llm";
import { getAgentById } from "./agentConfig";
import { fileProcessingRouter } from "./fileProcessing";
import { reportRouter } from "./reportGenerator";
import { uploadRouter } from "./uploadRouter";
import { integrationsRouter } from "./integrationsRouter";

export const appRouter = router({
  system: systemRouter,
  stripe: stripeRouter,
  fileProcessing: fileProcessingRouter,
  reports: reportRouter,
  upload: uploadRouter,
  integrations: integrationsRouter,

  agents: router({
    process: protectedProcedure
      .input(z.object({
        agentId: z.string(),
        input: z.string(),
      }))
      .mutation(async ({ input }) => {
        const agent = getAgentById(input.agentId);
        if (!agent) {
          throw new Error("Agent not found");
        }

        const response = await invokeLLM({
          messages: [
            { role: "system", content: agent.systemPrompt },
            { role: "user", content: input.input },
          ],
        });

        const output = response.choices[0]?.message?.content || "No response generated";

        return {
          agentId: agent.id,
          agentName: agent.name,
          output,
        };
      }),
  }),

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
    
    // Delete user account and all associated data
    deleteAccount: protectedProcedure.mutation(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const userId = ctx.user.id;

      // Delete all agent outputs for user's documents
      const userDocs = await getUserDocuments(userId);
      for (const doc of userDocs) {
        await db.delete(agentOutputs).where(eq(agentOutputs.documentId, doc.id));
      }

      // Delete all documents
      await db.delete(documents).where(eq(documents.userId, userId));

      // Delete payments
      await db.delete(payments).where(eq(payments.userId, userId));

      // Delete subscription
      await db.delete(subscriptions).where(eq(subscriptions.userId, userId));

      // Delete user
      await db.delete(users).where(eq(users.id, userId));

      // Clear session cookie
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });

      return { success: true };
    }),
  }),

  documents: router({
    // Upload a document
    upload: protectedProcedure
      .input(z.object({
        fileName: z.string(),
        fileContent: z.string(), // base64 encoded
        mimeType: z.string(),
        fileSize: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Upload to S3
        const buffer = Buffer.from(input.fileContent, 'base64');
        const randomSuffix = Math.random().toString(36).substring(7);
        const fileKey = `${ctx.user.id}-documents/${input.fileName}-${randomSuffix}`;
        
        const { url } = await storagePut(fileKey, buffer, input.mimeType);

        // Create document record
        const document = await createDocument({
          userId: ctx.user.id,
          fileName: input.fileName,
          fileUrl: url,
          fileKey,
          mimeType: input.mimeType,
          fileSize: input.fileSize,
          status: "pending",
        });

        return document;
      }),

    // Get user's documents
    list: protectedProcedure.query(async ({ ctx }) => {
      return getUserDocuments(ctx.user.id);
    }),

    // Get document by ID with outputs
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const document = await getDocumentById(input.id);
        
        if (!document || document.userId !== ctx.user.id) {
          throw new Error("Document not found");
        }

        const outputs = await getAgentOutputByDocumentId(input.id);

        return {
          document,
          outputs,
        };
      }),

    // Process document through AI agents
    process: protectedProcedure
      .input(z.object({ 
        documentId: z.number(),
        documentText: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const document = await getDocumentById(input.documentId);
        
        if (!document || document.userId !== ctx.user.id) {
          throw new Error("Document not found");
        }

        // Update status to processing
        await updateDocumentStatus(input.documentId, "processing");

        try {
          // Call LLM with the system prompt from blueprint
          const response = await invokeLLM({
            messages: [
              {
                role: "system",
                content: `You are DueProcess.AI. When a user uploads a legal document, you route it to three sub-agents:
1. **Justice Jester**: Create a meme caption, a TikTok script, and a satirical soundbite from the content.
2. **Law Clerk**: Extract violations, cite case law, and write a draft motion (especially §1983 or ADA).
3. **Hobot**: Turn the result into a monetizable digital product, merch drop, or legal toolkit.

You respond with a structured JSON containing all outputs.`
              },
              {
                role: "user",
                content: `Process this legal document through all agents. Summarize and display results.\n\nDocument:\n${input.documentText}`
              }
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "agent_outputs",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    summary: {
                      type: "string",
                      description: "Brief one-line overview"
                    },
                    outputs: {
                      type: "object",
                      properties: {
                        jester: {
                          type: "object",
                          properties: {
                            meme_caption: { type: "string" },
                            tiktok_script: { type: "string" },
                            quote: { type: "string" }
                          },
                          required: ["meme_caption", "tiktok_script", "quote"],
                          additionalProperties: false
                        },
                        clerk: {
                          type: "object",
                          properties: {
                            violations: {
                              type: "array",
                              items: { type: "string" }
                            },
                            case_law: {
                              type: "array",
                              items: { type: "string" }
                            },
                            motion_draft: { type: "string" }
                          },
                          required: ["violations", "case_law", "motion_draft"],
                          additionalProperties: false
                        },
                        hobot: {
                          type: "object",
                          properties: {
                            product_name: { type: "string" },
                            description: { type: "string" },
                            link: { type: "string" }
                          },
                          required: ["product_name", "description", "link"],
                          additionalProperties: false
                        }
                      },
                      required: ["jester", "clerk", "hobot"],
                      additionalProperties: false
                    }
                  },
                  required: ["summary", "outputs"],
                  additionalProperties: false
                }
              }
            }
          });

          const messageContent = response.choices[0].message.content;
          const contentString = typeof messageContent === 'string' ? messageContent : JSON.stringify(messageContent);
          const result = JSON.parse(contentString || "{}");

          // Store agent outputs
          await createAgentOutput({
            documentId: input.documentId,
            jesterMemeCaption: result.outputs.jester.meme_caption,
            jesterTiktokScript: result.outputs.jester.tiktok_script,
            jesterQuote: result.outputs.jester.quote,
            clerkViolations: JSON.stringify(result.outputs.clerk.violations),
            clerkCaseLaw: JSON.stringify(result.outputs.clerk.case_law),
            clerkMotionDraft: result.outputs.clerk.motion_draft,
            hobotProductName: result.outputs.hobot.product_name,
            hobotDescription: result.outputs.hobot.description,
            hobotLink: result.outputs.hobot.link,
          });

          // Update document status to completed
          await updateDocumentStatus(input.documentId, "completed", result.summary);

          return {
            success: true,
            summary: result.summary,
          };
        } catch (error) {
          // Update status to failed
          await updateDocumentStatus(input.documentId, "failed");
          throw error;
        }
      }),

    // Delete a document
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const document = await getDocumentById(input.id);
        
        if (!document || document.userId !== ctx.user.id) {
          throw new Error("Document not found");
        }

        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Delete agent outputs first
        await db.delete(agentOutputs).where(eq(agentOutputs.documentId, input.id));
        
        // Delete document
        await db.delete(documents).where(eq(documents.id, input.id));

        return { success: true };
      }),

    // Delete all user documents
    deleteAll: protectedProcedure.mutation(async ({ ctx }) => {
      const userDocs = await getUserDocuments(ctx.user.id);
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Delete all agent outputs for user's documents
      for (const doc of userDocs) {
        await db.delete(agentOutputs).where(eq(agentOutputs.documentId, doc.id));
      }

      // Delete all documents
      await db.delete(documents).where(eq(documents.userId, ctx.user.id));

      return { success: true };
    }),
  }),
});

export type AppRouter = typeof appRouter;

