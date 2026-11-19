import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';

function emailsTo(email: string): string[] {
  const logFile = process.env.E2E_SERVER_LOG;
  if (!logFile) throw new Error('Set E2E_SERVER_LOG to the server stdout log file.');
  return readFileSync(logFile, 'utf8')
    .split('──── EMAIL')
    .filter((b) => b.includes(`To:      ${email}`));
}

/** Number of emails sent to `email` so far; pass to lastCodeFor to require a *new* one. */
export const emailCount = (email: string) => emailsTo(email).length;

/**
 * Most recent sign-in code sent to `email` (console email adapter log). With `after`, waits
 * for an email newer than that count, so a rate-limited request fails loudly instead of
 * silently reusing an old code.
 */
export async function lastCodeFor(email: string, after?: number): Promise<string> {
  for (let i = 0; i < 20; i += 1) {
    const blocks = emailsTo(email);
    if (after === undefined || blocks.length > after) {
      const code = blocks.at(-1)?.match(/sign-in code: (\d{6})/)?.[1];
      if (code) return code;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`No new sign-in email for ${email} (rate limit reached? reset the dev DB).`);
}

export async function signIn(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('iChat email').fill(email);
  const before = emailCount(email);
  await page.getByRole('button', { name: 'Send me a code' }).click();
  await expect(page.getByText(/a code is on its way/)).toBeVisible();
  await page.getByLabel('6-digit code').fill(await lastCodeFor(email, before));
  await page.getByRole('button', { name: 'Sign in' }).click();
}
