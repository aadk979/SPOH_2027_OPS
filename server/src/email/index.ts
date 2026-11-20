import type { Config } from '../config.js';
import { ConsoleEmailSender } from './console-sender.js';
import type { EmailSender } from './email-sender.js';
import { ResendEmailSender } from './resend-sender.js';
import { SmtpEmailSender } from './smtp-sender.js';

export type { EmailMessage, EmailSender } from './email-sender.js';
export { CapturingEmailSender, ConsoleEmailSender } from './console-sender.js';

/** Picks the adapter named by EMAIL_PROVIDER (config has already checked its settings). */
export function createEmailSender(config: Config): EmailSender {
  switch (config.EMAIL_PROVIDER) {
    case 'console':
      return new ConsoleEmailSender();
    case 'smtp':
      return new SmtpEmailSender({
        host: config.SMTP_HOST!,
        port: config.SMTP_PORT ?? (config.SMTP_SECURE ? 465 : 587),
        secure: config.SMTP_SECURE,
        user: config.SMTP_USER!,
        pass: config.SMTP_PASS!,
        from: config.EMAIL_FROM,
      });
    case 'resend':
      return new ResendEmailSender(config.RESEND_API_KEY!, config.EMAIL_FROM);
  }
}
