import type { EmailMessage, EmailSender } from './email-sender.js';

/** Development / testing adapter: prints emails to the log instead of sending them. */
export class ConsoleEmailSender implements EmailSender {
  readonly name = 'console';

  constructor(private readonly log: (line: string) => void = console.log) {}

  async send(message: EmailMessage): Promise<void> {
    this.log(
      [
        '──── EMAIL (console adapter, not sent) ────',
        `To:      ${message.to}`,
        `Subject: ${message.subject}`,
        '',
        message.text,
        '───────────────────────────────────────────',
      ].join('\n'),
    );
  }
}

/** Test adapter: keeps every message in memory so tests can assert on them. */
export class CapturingEmailSender implements EmailSender {
  readonly name = 'capture';
  readonly sent: EmailMessage[] = [];

  async send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
  }

  last(): EmailMessage | undefined {
    return this.sent.at(-1);
  }
}
