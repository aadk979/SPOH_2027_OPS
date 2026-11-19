import { expect, test } from '@playwright/test';
import { emailCount, lastCodeFor, signIn } from './helpers';

const CC = process.env.E2E_CC_EMAIL ?? 'cc@e2e.test';
const SHOTS = process.env.E2E_SCREENSHOT_DIR;

test('S1: CC signs in, imports the roster, and a volunteer signs in by magic link', async ({
  page,
}, info) => {
  const shot = (name: string) =>
    SHOTS
      ? page.screenshot({ path: `${SHOTS}/${info.project.name}-${name}.png`, fullPage: true })
      : undefined;

  await page.goto('/login');
  await shot('01-login');
  await signIn(page, CC);
  await expect(page).toHaveURL(/\/dashboard$/);

  // Roster import: one bad row first (nothing saved), then a clean file.
  await page.goto('/people/import');
  const header =
    'name,email,phone,course,rank,team,shadows,day_2027-01-06,day_2027-01-07,day_2027-01-08,day_2027-01-09';
  const run = `${info.project.name}-${Date.now()}`;
  const volunteer = `vol-${run}@e2e.test`;
  const volName = `Vera ${run}`;
  await page.locator('input[type=file]').setInputFiles({
    name: 'roster.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      `${header}\n${volName},${volunteer},91234567,DCS,Volunteer,Sign-Up Booth,,Y,Y,N,Y\nBad Row,bad@e2e.test,,,Vol,Relief,,Y,Y,Y,Y\n`,
    ),
  });
  await expect(page.getByText('is not one of CC, Deputy, IC, Shadow IC, Volunteer')).toBeVisible();
  await shot('02-import-errors');

  await page.locator('input[type=file]').setInputFiles({
    name: 'roster.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      `${header}\n${volName},${volunteer},91234567,DCS,Volunteer,Sign-Up Booth,,Y,Y,N,Y\n`,
    ),
  });
  await page.getByRole('button', { name: /^Import \d+ changes$/ }).click();
  await expect(page.getByText(/Imported: /)).toBeVisible();

  await page.goto('/people');
  await expect(page.getByText(volName)).toBeVisible();
  await shot('03-people');

  // Volunteer: request a code, then open the magic link in a fresh context.
  await page.context().clearCookies();
  await page.evaluate(() => localStorage.clear());
  await page.goto('/login');
  await page.getByLabel('iChat email').fill(volunteer);
  const before = emailCount(volunteer);
  await page.getByRole('button', { name: 'Send me a code' }).click();
  await expect(page.getByText(/a code is on its way/)).toBeVisible();
  await page.goto(
    `/login#email=${encodeURIComponent(volunteer)}&code=${await lastCodeFor(volunteer, before)}`,
  );
  await expect(page).toHaveURL(/\/duty$/);
  await shot('04-volunteer-home');

  // A volunteer cannot reach admin screens.
  await page.goto('/people');
  await expect(page).toHaveURL(/\/duty$/);
});
