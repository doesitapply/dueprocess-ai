import { Provider, AuthResult, Item } from './provider';

export type CourtListenerCitationLookup = {
  citation: string;
  normalizedCitations: string[];
  status: number;
  errorMessage: string;
  matches: Array<{
    caseName: string;
    url: string;
    court: string;
    dateFiled: string;
  }>;
};

/**
 * CourtListener + RECAP Integration
 * Free legal research API with case law and RECAP docket PDFs
 */
export class CourtListenerProvider implements Provider {
  id = 'courtlistener' as const;
  name = 'CourtListener';
  category = 'legal' as const;
  
  private apiKey: string | null = null;
  private baseUrl = 'https://www.courtlistener.com/api/rest/v3';
  private citationLookupBaseUrl = 'https://www.courtlistener.com/api/rest/v4';

  async authenticate(credentials: Record<string, string>): Promise<AuthResult> {
    // CourtListener uses API key authentication
    const apiKey = credentials.apiKey;
    
    if (!apiKey) {
      return {
        success: false,
        error: 'API key required',
      };
    }

    // Test the API key with a simple request
    try {
      const response = await fetch(`${this.baseUrl}/clusters/?page_size=1`, {
        headers: {
          'Authorization': `Token ${apiKey}`,
        },
      });

      if (!response.ok) {
        return {
          success: false,
          error: 'Invalid API key',
        };
      }

      this.apiKey = apiKey;
      return {
        success: true,
        accessToken: apiKey,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed',
      };
    }
  }

  /**
   * Search for case law
   */
  async searchCases(query: string, opts?: {
    court?: string;
    dateAfter?: string;
    dateBefore?: string;
    limit?: number;
  }): Promise<Array<{
    id: string;
    caseName: string;
    citation: string;
    court: string;
    dateFiled: string;
    url: string;
    snippet?: string;
  }>> {
    if (!this.apiKey) {
      throw new Error('Not authenticated');
    }

    const params = new URLSearchParams({
      q: query,
      page_size: String(opts?.limit || 20),
    });

    if (opts?.court) params.append('court', opts.court);
    if (opts?.dateAfter) params.append('filed_after', opts.dateAfter);
    if (opts?.dateBefore) params.append('filed_before', opts.dateBefore);

    const response = await fetch(`${this.baseUrl}/search/?${params}`, {
      headers: {
        'Authorization': `Token ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Search failed: ${response.statusText}`);
    }

    const data = await response.json();
    
    return data.results.map((result: any) => ({
      id: String(result.id),
      caseName: result.caseName || result.case_name,
      citation: result.citation?.[0] || '',
      court: result.court || '',
      dateFiled: result.dateFiled || result.date_filed,
      url: `https://www.courtlistener.com${result.absolute_url}`,
      snippet: result.snippet || '',
    }));
  }

  /**
   * Get RECAP docket entries
   */
  async getRECAPDocket(docketId: string): Promise<{
    caseName: string;
    court: string;
    docketNumber: string;
    entries: Array<{
      entryNumber: number;
      description: string;
      dateFiled: string;
      documents: Array<{
        documentNumber: number;
        description: string;
        pdfUrl?: string;
      }>;
    }>;
  }> {
    if (!this.apiKey) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${this.baseUrl}/dockets/${docketId}/`, {
      headers: {
        'Authorization': `Token ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch docket: ${response.statusText}`);
    }

    const docket = await response.json();
    
    return {
      caseName: docket.case_name,
      court: docket.court,
      docketNumber: docket.docket_number,
      entries: docket.docket_entries?.map((entry: any) => ({
        entryNumber: entry.entry_number,
        description: entry.description,
        dateFiled: entry.date_filed,
        documents: entry.recap_documents?.map((doc: any) => ({
          documentNumber: doc.document_number,
          description: doc.description,
          pdfUrl: doc.filepath_local ? `https://storage.courtlistener.com/${doc.filepath_local}` : undefined,
        })) || [],
      })) || [],
    };
  }

  /**
   * Get opinion by ID
   */
  async getOpinion(opinionId: string): Promise<{
    caseName: string;
    citation: string;
    court: string;
    dateFiled: string;
    text: string;
    htmlUrl: string;
    pdfUrl?: string;
  }> {
    if (!this.apiKey) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${this.baseUrl}/opinions/${opinionId}/`, {
      headers: {
        'Authorization': `Token ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch opinion: ${response.statusText}`);
    }

    const opinion = await response.json();
    
    return {
      caseName: opinion.case_name,
      citation: opinion.cluster?.citations?.[0] || '',
      court: opinion.cluster?.court || '',
      dateFiled: opinion.cluster?.date_filed || '',
      text: opinion.plain_text || opinion.html || '',
      htmlUrl: `https://www.courtlistener.com${opinion.absolute_url}`,
      pdfUrl: opinion.local_path ? `https://storage.courtlistener.com/${opinion.local_path}` : undefined,
    };
  }

  /**
   * Verify/resolve case citations in a block of text using CourtListener v4.
   * This endpoint only verifies court-opinion citations. It does not validate
   * statutes, rules, canons, law review citations, id., or supra references.
   */
  async lookupCitations(text: string): Promise<CourtListenerCitationLookup[]> {
    if (!this.apiKey) {
      throw new Error('Not authenticated');
    }

    const body = new URLSearchParams();
    body.set('text', text.slice(0, 64000));

    const response = await fetch(`${this.citationLookupBaseUrl}/citation-lookup/`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${this.apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(
        `Citation lookup failed: ${response.status} ${response.statusText}${detail ? ` - ${detail.slice(0, 240)}` : ''}`
      );
    }

    const data = await response.json();
    if (!Array.isArray(data)) return [];

    return data.map((result: any) => ({
      citation: String(result.citation || ''),
      normalizedCitations: Array.isArray(result.normalized_citations)
        ? result.normalized_citations.map((value: unknown) => String(value))
        : [],
      status: Number(result.status || 0),
      errorMessage: String(result.error_message || ''),
      matches: Array.isArray(result.clusters)
        ? result.clusters.slice(0, 3).map((cluster: any) => ({
            caseName: String(cluster.case_name || cluster.caseName || ''),
            url: cluster.absolute_url
              ? `https://www.courtlistener.com${cluster.absolute_url}`
              : '',
            court:
              typeof cluster.court === 'string'
                ? cluster.court
                : String(cluster.court?.short_name || cluster.court?.full_name || ''),
            dateFiled: String(cluster.date_filed || cluster.dateFiled || ''),
          }))
        : [],
    }));
  }

  // Provider interface methods
  async list(type: 'files' | 'folders', opts?: Record<string, unknown>): Promise<Item[]> {
    // For CourtListener, "list" means search
    const query = opts?.query as string || '';
    const cases = await this.searchCases(query);
    
    return cases.map(c => ({
      id: c.id,
      name: c.caseName,
      type: 'file' as const,
      url: c.url,
      mimeType: 'application/pdf',
      metadata: {
        citation: c.citation,
        court: c.court,
        dateFiled: c.dateFiled,
      },
    }));
  }

  async get(id: string): Promise<Item> {
    const opinion = await this.getOpinion(id);
    
    return {
      id,
      name: opinion.caseName,
      type: 'file',
      url: opinion.htmlUrl,
      mimeType: 'text/html',
      metadata: {
        citation: opinion.citation,
        court: opinion.court,
        dateFiled: opinion.dateFiled,
        text: opinion.text,
      },
    };
  }

  async put(path: string, blob: Buffer, meta?: Record<string, unknown>): Promise<Item> {
    throw new Error('CourtListener is read-only');
  }

  webhookVerify(headers: Record<string, string>, rawBody: string): boolean {
    // CourtListener doesn't use webhooks
    return false;
  }

  async onWebhook(event: Record<string, unknown>): Promise<void> {
    // Not applicable
  }
}

// Export singleton instance
export const courtListener = new CourtListenerProvider();
