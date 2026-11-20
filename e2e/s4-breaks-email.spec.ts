import { expect, test, type Page } from '@playwright/test';
import { emailsSentTo, signIn, signInReusing } from './helpers';

const CC = process.env.E2E_CC_EMAIL ?? 'cc@e2e.test';
const SHOTS = process.env.E2E_SCREENSHOT_DIR;

async function apiAs<T>(page: Page, method: string, path: string, body?: unknown): Promise<T> {
  return page.evaluate(
    async ([m, p, b]) => {
      const res = await fetch(`/api${p}`, {
        method: m,
        headers: {
          Authorization: `Bearer ${localStorage.getItem('spoh.token')}`,
          ...(b === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        body: b === undefined ? undefined : JSON.stringify(b),
      });
      if (!res.ok) throw new Error(`${p}: ${res.status} ${await res.text()}`);
      return res.json();
    },
    [method, path, body] as const,
  ) as Promise<T>;
}

// Journey: Admin adds a break (coverage warning) → volunteer sees it on My Duty → the duty
// email leaves within 3 minutes (FR-NOTIF-1/2) → its link signs them in on My Duty → Got it.
test('S4: break reaches My Duty and the duty email link signs in', async ({
  page,
  browser,
}, info) => {
  test.skip(info.project.name !== 'phone', 'One run is enough: it waits for the email batch.');
  test.setTimeout(300_000);
  const shot = (p: Page, name: string) =>
    SHOTS ? p.screenshot({ path: `${SHOTS}/s4-${name}.png`, fullPage: true }) : undefined;

  const adminContext = await browser.newContext({
    baseURL: info.project.use.baseURL,
    viewport: { width: 1366, height: 860 },
  });
  const admin = await adminContext.newPage();
  await signInReusing(admin, CC);
  await expect(admin).toHaveURL(/\/dashboard$/);

  const run = `${Date.now()}`;
  const email = `noor-${run}@e2e.test`;
  const name = `Noor ${run}`;
  const { days } = await apiAs<{ days: { id: string }[] }>(admin, 'GET', '/days');
  const person = await apiAs<{ id: string }>(admin, 'POST', '/people', {
    name,
    email,
    rank: 'volunteer',
    team: 'Room Ushers',
    availableDayIds: days.map((d) => d.id),
  });
  // A station of their own, so a break leaves it empty and the warning shows.
  const desk = await apiAs<{ id: string }>(admin, 'POST', '/setup/stations', {
    name: `Info Desk ${run}`,
    location: 'Atrium',
    room: 'Atrium',
    kind: 'staffed',
  });
  await apiAs(admin, 'POST', '/deployment/assign', {
    personIds: [person.id],
    stationId: desk.id,
    dayIds: days.map((d) => d.id),
    from: 'now',
  });

  // Volunteer on their phone acknowledges the first post.
  await signIn(page, email);
  await expect(page).toHaveURL(/\/duty$/);
  await page.getByRole('button', { name: 'Got it' }).click();
  const banner = page.getByRole('region', { name: 'Your duty changed' });
  await expect(banner).toBeHidden();

  // Admin plans lunch for them.
  await admin.goto('/breaks');
  await admin.getByRole('button', { name: 'Add break' }).click();
  const form = admin.getByRole('form', { name: 'Add break' });
  await form.getByLabel('Search people').fill(name);
  await form.getByRole('checkbox', { name: new RegExp(name) }).check();
  await form.getByRole('button', { name: 'Add break for 1' }).click();
  await expect(form.getByText(`Nobody would be left at Info Desk ${run}`)).toBeVisible();
  await shot(admin, '01-coverage-warning');
  await form.getByRole('button', { name: 'Yes, go ahead' }).click();
  await expect(admin.getByText(/Break added for 1 person/)).toBeVisible();
  await shot(admin, '02-breaks-page');

  // Volunteer sees it within 15 s (FR-BRK-3 → FR-DUTY-6) but doesn't tap Got it yet.
  await expect(banner).toBeVisible({ timeout: 15_000 });
  await expect(banner).toContainText('Break 12:00–12:45 (Lunch) added');
  await shot(page, '03-duty-break-banner');

  // The outbox batches for 2 minutes and runs every 30 s: the email leaves within 3 minutes.
  const sentAt = Date.now();
  let dutyEmail: string | undefined;
  await expect
    .poll(
      () => {
        dutyEmail = emailsSentTo(email).find((e) => e.includes('Your SPOH 2027 duty has changed'));
        return Boolean(dutyEmail);
      },
      { timeout: 200_000, intervals: [5_000] },
    )
    .toBe(true);
  expect(Date.now() - sentAt).toBeLessThan(180_000);
  expect(dutyEmail).toContain('Break 12:00–12:45 (Lunch) added');

  // The link signs them in on a fresh phone and opens My Duty.
  const link = dutyEmail!.match(/https?:\/\/\S+\/login#\S+/)![0];
  const fresh = await browser.newContext({ ...info.project.use });
  const phone = await fresh.newPage();
  await phone.goto(link);
  await expect(phone).toHaveURL(/\/duty$/);
  const freshBanner = phone.getByRole('region', { name: 'Your duty changed' });
  await expect(freshBanner).toContainText('Break 12:00–12:45 (Lunch) added');
  await freshBanner.getByRole('button', { name: 'Got it' }).click();
  await expect(freshBanner).toBeHidden();
  await expect(phone.getByText('12:00–12:45')).toBeVisible();
  await shot(phone, '04-duty-after-email-link');

  await fresh.close();
  await adminContext.close();
});
