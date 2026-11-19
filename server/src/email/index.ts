import type { Config } from '../config.js';
import { ConsoleEmailSender } from './console-sender.js';
import type { EmailSender } from './email-sender.js';

export type { EmailMessage, EmailSender } from './email-sender.js';
export { CapturingEmailSender, ConsoleEmailSender } from './console-sender.js';

/** Picks the adapter named by EMAIL_PROVIDER. SMTP and Resend adapters arrive in slice S4. */
export function createEmailSender(config: Config): EmailSender {
  switch (config.EMAIL_PROVIDER) {
    case 'console':
      return new ConsoleEmailSender();
    default:
      throw new Error(
        `EMAIL_PROVIDER=${config.EMAIL_PROVIDER} is not available yet; use "console" for now.`,
      );
  }
}
