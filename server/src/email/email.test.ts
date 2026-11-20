import nodemailer from 'nodemailer';
import { describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../config.js';
import { createEmailSender } from './index.js';
import { ResendEmailSender } from './resend-sender.js';
import { SmtpEmailSender } from './smtp-sender.js';

const message = { to: 'riya@example.test', subject: 'Hi', text: 'Body' };

describe('email adapters (FR-NOTIF-4)', () => {
  it('picks the adapter from EMAIL_PROVIDER', () => {
    const base = { DATABASE_URL: 'postgres://x' };
    expect(createEmailSender(loadConfig(base)).name).toBe('console');
    const smtp = loadConfig({
      ...base,
      EMAIL_PROVIDER: 'smtp',
      SMTP_HOST: 'smtp.gmail.com',
      SMTP_USER: 'u',
      SMTP_PASS: 'p',
    });
    expect(createEmailSender(smtp).name).toBe('smtp');
    expect(
      createEmailSender(loadConfig({ ...base, EMAIL_PROVIDER: 'resend', RESEND_API_KEY: 'k' }))
        .name,
    ).toBe('resend');
  });

  it('SMTP sends through Nodemailer with the configured sender', async () => {
    const transport = nodemailer.createTransport({ jsonTransport: true });
    const spy = vi.spyOn(transport, 'sendMail');
    const sender = new SmtpEmailSender(
      { host: 'h', port: 465, secure: true, user: 'u', pass: 'p', from: 'Ops <ops@x.test>' },
      transport,
    );
    await sender.send(message);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'Ops <ops@x.test>', to: message.to, subject: 'Hi' }),
    );
  });

  it('Resend posts to the API and throws on an error status', async () => {
    const fetchMock = vi.fn(async () => new Response('bad key', { status: 401 }));
    const sender = new ResendEmailSender('key', 'Ops <ops@x.test>', fetchMock);
    await expect(sender.send(message)).rejects.toThrow('Resend 401: bad key');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
