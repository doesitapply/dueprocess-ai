import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { courtListener } from "./integrations/courtlistener";
import { getDb } from "./db";
import { integrationConnections, integrationProviders } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

/**
 * Integrations Router
 * Handles all third-party integrations
 */
export const integrationsRouter = router({
  /**
   * List available integration providers
   */
  listProviders: protectedProcedure.query(async () => {
    return [
      {
        id: 'courtlistener',
        name: 'CourtListener',
        description: 'Free case law search and RECAP docket access',
        category: 'legal',
        authType: 'api_key',
        active: true,
      },
      {
        id: 'google-drive',
        name: 'Google Drive',
        description: 'Two-way file sync for exhibits and exports',
        category: 'storage',
        authType: 'oauth2',
        active: false, // Coming soon
      },
      {
        id: 'onedrive',
        name: 'OneDrive',
        description: 'Microsoft file storage integration',
        category: 'storage',
        authType: 'oauth2',
        active: false, // Coming soon
      },
      {
        id: 'sendgrid',
        name: 'SendGrid',
        description: 'Email delivery for exports and notifications',
        category: 'communication',
        authType: 'api_key',
        active: false, // Coming soon
      },
      {
        id: 'slack',
        name: 'Slack',
        description: 'Team notifications and alerts',
        category: 'communication',
        authType: 'oauth2',
        active: false, // Coming soon
      },
      {
        id: 'zapier',
        name: 'Zapier',
        description: 'Connect to 5,000+ apps via webhooks',
        category: 'automation',
        authType: 'webhook',
        active: false, // Coming soon
      },
    ];
  }),

  /**
   * Connect to CourtListener
   */
  connectCourtListener: protectedProcedure
    .input(z.object({
      apiKey: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      // Authenticate with CourtListener
      const authResult = await courtListener.authenticate({ apiKey: input.apiKey });
      
      if (!authResult.success) {
        throw new Error(authResult.error || 'Authentication failed');
      }

      // Save connection to database
      await db.insert(integrationConnections).values({
        userId: ctx.user.id,
        providerId: 'courtlistener',
        apiKey: input.apiKey,
        status: 'connected',
        lastSync: new Date(),
      }).onDuplicateKeyUpdate({
        set: {
          apiKey: input.apiKey,
          status: 'connected',
          lastSync: new Date(),
        },
      });

      return {
        success: true,
        message: 'Connected to CourtListener successfully',
      };
    }),

  /**
   * Search case law via CourtListener
   */
  searchCaseLaw: protectedProcedure
    .input(z.object({
      query: z.string(),
      court: z.string().optional(),
      dateAfter: z.string().optional(),
      dateBefore: z.string().optional(),
      limit: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      // Get user's CourtListener connection
      const connection = await db
        .select()
        .from(integrationConnections)
        .where(
          and(
            eq(integrationConnections.userId, ctx.user.id),
            eq(integrationConnections.providerId, 'courtlistener')
          )
        )
        .limit(1);

      if (!connection.length || !connection[0].apiKey) {
        throw new Error('CourtListener not connected. Please connect first.');
      }

      // Authenticate
      await courtListener.authenticate({ apiKey: connection[0].apiKey });

      // Search
      const results = await courtListener.searchCases(input.query, {
        court: input.court,
        dateAfter: input.dateAfter,
        dateBefore: input.dateBefore,
        limit: input.limit,
      });

      return results;
    }),

  /**
   * Get RECAP docket
   */
  getRECAPDocket: protectedProcedure
    .input(z.object({
      docketId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      // Get user's CourtListener connection
      const connection = await db
        .select()
        .from(integrationConnections)
        .where(
          and(
            eq(integrationConnections.userId, ctx.user.id),
            eq(integrationConnections.providerId, 'courtlistener')
          )
        )
        .limit(1);

      if (!connection.length || !connection[0].apiKey) {
        throw new Error('CourtListener not connected');
      }

      // Authenticate
      await courtListener.authenticate({ apiKey: connection[0].apiKey });

      // Get docket
      const docket = await courtListener.getRECAPDocket(input.docketId);

      return docket;
    }),

  /**
   * Get opinion by ID
   */
  getOpinion: protectedProcedure
    .input(z.object({
      opinionId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      // Get user's CourtListener connection
      const connection = await db
        .select()
        .from(integrationConnections)
        .where(
          and(
            eq(integrationConnections.userId, ctx.user.id),
            eq(integrationConnections.providerId, 'courtlistener')
          )
        )
        .limit(1);

      if (!connection.length || !connection[0].apiKey) {
        throw new Error('CourtListener not connected');
      }

      // Authenticate
      await courtListener.authenticate({ apiKey: connection[0].apiKey });

      // Get opinion
      const opinion = await courtListener.getOpinion(input.opinionId);

      return opinion;
    }),

  /**
   * Get user's connections
   */
  getConnections: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];

    const connections = await db
      .select()
      .from(integrationConnections)
      .where(eq(integrationConnections.userId, ctx.user.id));

    return connections.map(conn => ({
      id: conn.id,
      providerId: conn.providerId,
      status: conn.status,
      lastSync: conn.lastSync,
      createdAt: conn.createdAt,
    }));
  }),

  /**
   * Disconnect from a provider
   */
  disconnect: protectedProcedure
    .input(z.object({
      providerId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      await db
        .delete(integrationConnections)
        .where(
          and(
            eq(integrationConnections.userId, ctx.user.id),
            eq(integrationConnections.providerId, input.providerId)
          )
        );

      return {
        success: true,
        message: 'Disconnected successfully',
      };
    }),
});

