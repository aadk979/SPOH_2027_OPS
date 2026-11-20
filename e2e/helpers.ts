import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
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

/** Where reusable sessions are kept between tests (git-ignored test-results folder). */
const sessionFile = (email: string) =>
  path.resolve('test-results', `session-${email.replace(/\W/g, '_')}.txt`);

/**
 * Signs in once and reuses the session for later tests, so a run stays under the
 * intentional login rate limit (5 codes per 15 min per person). S1 still tests the real
 * sign-in flow; this is for tests that only need to *be* signed in.
 */
export async function signInReusing(page: Page, email: string) {
  const file = sessionFile(email);
  if (existsSync(file)) {
    const token = readFileSync(file, 'utf8').trim();
    await page.goto('/login');
    const ok = await page.evaluate(async (t) => {
      const res = await fetch('/api/me', { headers: { Authorization: `Bearer ${t}` } });
      if (res.ok) localStorage.setItem('spoh.token', t);
      return res.ok;
    }, token);
    if (ok) {
      await page.goto('/');
      return;
    }
  }
  await signIn(page, email);
  await expect(page).not.toHaveURL(/\/login/);
  const token = await page.evaluate(() => localStorage.getItem('spoh.token'));
  if (token) {
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, token);
  }
}

/** Full text of every email sent to `email` so far (console adapter log), oldest first. */
export const emailsSentTo = (email: string) => emailsTo(email);
