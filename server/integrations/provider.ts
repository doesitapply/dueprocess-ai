/**
 * Provider SDK - Base interface for all integrations
 */

export interface AuthResult {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
  error?: string;
}

export interface Item {
  id: string;
  name: string;
  type: 'file' | 'folder';
  url?: string;
  mimeType?: string;
  size?: number;
  modifiedAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface Provider {
  id: 'google-drive' | 'onedrive' | 'slack' | 'sendgrid' | 'courtlistener' | 'stripe' | 'zapier';
  name: string;
  category: 'storage' | 'communication' | 'automation' | 'legal' | 'payment';
  
  /**
   * Authenticate with the provider
   */
  authenticate(credentials: Record<string, string>): Promise<AuthResult>;
  
  /**
   * List items (files, folders, etc.)
   */
  list(type: 'files' | 'folders', opts?: Record<string, unknown>): Promise<Item[]>;
  
  /**
   * Get a specific item
   */
  get(id: string): Promise<Item>;
  
  /**
   * Upload/create an item
   */
  put(path: string, blob: Buffer, meta?: Record<string, unknown>): Promise<Item>;
  
  /**
   * Verify webhook signature
   */
  webhookVerify(headers: Record<string, string>, rawBody: string): boolean;
  
  /**
   * Handle incoming webhook
   */
  onWebhook(event: Record<string, unknown>): Promise<void>;
}

/**
 * Event types for the event bus
 */
export type EventType =
  | 'export.ready'
  | 'citation.inserted'
  | 'deadline.added'
  | 'hearing.upcoming'
  | 'document.created'
  | 'rule11.checklist_opened';

export interface Event {
  type: EventType;
  userId: number;
  payload: Record<string, unknown>;
}

