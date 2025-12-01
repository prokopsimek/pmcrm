/**
 * Email sync interfaces
 * US-030: Email communication sync
 */

export interface EmailMessage {
  id: string;
  threadId: string;
  from: EmailAddress;
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  subject: string;
  body: string;
  snippet: string;
  receivedAt: Date;
  labels?: string[];
  attachments?: EmailAttachment[];
}

export interface EmailAddress {
  email: string;
  name?: string;
}

export interface EmailAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
}

export interface SyncResult {
  provider: 'gmail' | 'outlook';
  emailsProcessed: number;
  interactionsCreated: number;
  contactsMatched: number;
  errors: SyncError[];
  newHistoryId?: string;
  newDeltaToken?: string;
}

export interface SyncError {
  emailId?: string;
  error: string;
  timestamp: Date;
}

export interface SentimentResult {
  score: number; // -1 to 1
  label: 'positive' | 'neutral' | 'negative';
  comparative: number;
}
