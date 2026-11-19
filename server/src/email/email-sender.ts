/**
 * Email is behind one small interface so the provider can be swapped by configuration
 * (SRS C-4 / FR-NOTIF-4). Adapters live next to this file; add a provider = add one adapter.
 */
export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface EmailSender {
  readonly name: string;
  send(message: EmailMessage): Promise<void>;
}
