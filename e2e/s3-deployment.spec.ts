import { expect, test, type Page } from '@playwright/test';
import { signIn, signInReusing } from './helpers';

const CC = process.env.E2E_CC_EMAIL ?? 'cc@e2e.test';
const SHOTS = process.env.E2E_SCREENSHOT_DIR;

/** Calls the API as whoever is signed in on `page` (token from localStorage). */
async function apiAs<T>(page: Page, path: string, body?: unknown): Promise<T> {
  return page.evaluate(
    async ([p, b]) => {
      const res = await fetch(`/api${p}`, {
        method: b === undefined ? 'GET' : 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('spoh.token')}`,
          ...(b === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        body: b === undefined ? undefined : JSON.stringify(b),
      });
      if (!res.ok) throw new Error(`${p}: ${res.status} ${await res.text()}`);
      return res.json();
    },
    [path, body] as const,
  ) as Promise<T>;
}

// Journey 1 (test plan §3): volunteer sees My Duty → Admin reassigns → banner within 15 s →
// Got it → the Admin's unacknowledged list clears.
test('S3: reassignment reaches My Duty and Got it clears it', async ({ page, browser }, info) => {
  test.setTimeout(120_000);
  const shot = (p: Page, name: string) =>
    SHOTS
      ? p.screenshot({ path: `${SHOTS}/${info.project.name}-s3-${name}.png`, fullPage: true })
      : undefined;

  // Admin on a laptop.
  const adminContext = await browser.newContext({
    baseURL: info.project.use.baseURL,
    viewport: { width: 1366, height: 860 },
  });
  const admin = await adminContext.newPage();
  await signInReusing(admin, CC);
  await expect(admin).toHaveURL(/\/dashboard$/);

  const run = `${info.project.name}-${Date.now()}`;
  const email = `riya-${run}@e2e.test`;
  const name = `Riya ${run}`;
  const { days } = await apiAs<{ days: { id: string }[] }>(admin, '/days');
  const created = await apiAs<{ id: string }>(admin, '/people', {
    name,
    email,
    rank: 'volunteer',
    team: 'Room Ushers',
    availableDayIds: days.map((d) => d.id),
  });
  const { stations } = await apiAs<{ stations: { id: string; name: string }[] }>(
    admin,
    '/stations',
  );
  await apiAs(admin, '/deployment/assign', {
    personIds: [created.id],
    stationId: stations.find((s) => s.name === 'Welcome Lounge')!.id,
    dayIds: days.map((d) => d.id),
    from: 'now',
  });

  await admin.goto('/setup');
  await expect(admin.getByRole('heading', { name: 'Event days' })).toBeVisible();
  await shot(admin, '01-setup-days');

  // Volunteer on their phone: first post, acknowledged.
  await signIn(page, email);
  await expect(page).toHaveURL(/\/duty$/);
  await expect(page.getByTestId('duty-station')).toHaveText('Welcome Lounge');
  await page.getByRole('button', { name: 'Got it' }).click();
  await expect(page.getByRole('region', { name: 'Your duty changed' })).toBeHidden();
  await shot(page, '02-my-duty');

  // Admin moves them on the Deployment board.
  await admin.goto('/deployment');
  await admin.getByLabel('Search people').fill(name);
  await admin.getByRole('checkbox', { name: new RegExp(name) }).check();
  const panel = admin.getByRole('group', { name: 'Move people' });
  await panel.getByLabel('To station').selectOption({ label: 'Counselling Room' });
  await shot(admin, '03-deployment-move');
  await panel.getByRole('button', { name: 'Confirm move' }).click();
  await expect(admin.getByText(/Saved: 1 post/)).toBeVisible();

  // Volunteer sees the change within 15 s without reloading (FR-DUTY-5 AC).
  const banner = page.getByRole('region', { name: 'Your duty changed' });
  await expect(banner).toBeVisible({ timeout: 15_000 });
  await expect(banner).toContainText('Welcome Lounge → Counselling Room');
  await shot(page, '04-duty-changed');

  await admin.getByRole('tab', { name: /^Changes/ }).click();
  await expect(admin.getByText(name)).toBeVisible();
  await shot(admin, '05-unacked');

  await banner.getByRole('button', { name: 'Got it' }).click();
  await expect(banner).toBeHidden();
  await expect(page.getByTestId('duty-station')).toHaveText('Counselling Room');

  // The Admin's list clears (it refreshes every 15 s).
  await expect(admin.getByText(name)).toBeHidden({ timeout: 20_000 });
  await adminContext.close();
});
