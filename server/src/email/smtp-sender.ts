import nodemailer, { type Transporter } from 'nodemailer';
import type { EmailMessage, EmailSender } from './email-sender.js';

export interface SmtpSettings {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

/**
 * Any SMTP server via Nodemailer: Gmail (smtp.gmail.com, 465, secure, app password),
 * Outlook, a school relay, SendGrid/Brevo SMTP... Switching = change env vars (FR-NOTIF-4).
 */
export class SmtpEmailSender implements EmailSender {
  readonly name = 'smtp';
  private readonly transport: Transporter;

  constructor(
    private readonly settings: SmtpSettings,
    transport?: Transporter,
  ) {
    this.transport =
      transport ??
      nodemailer.createTransport({
        host: settings.host,
        port: settings.port,
        secure: settings.secure,
        auth: { user: settings.user, pass: settings.pass },
        // Fail a send in seconds rather than hang the outbox job.
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
      });
  }

  async send(message: EmailMessage): Promise<void> {
    await this.transport.sendMail({
      from: this.settings.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  }
}
