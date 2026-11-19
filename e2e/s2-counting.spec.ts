import { expect, test, type Page } from '@playwright/test';
import { signIn } from './helpers';

const CC = process.env.E2E_CC_EMAIL ?? 'cc@e2e.test';
const SHOTS = process.env.E2E_SCREENSHOT_DIR;

/** The big number on a counting screen, once it has loaded from the server. */
async function total(page: Page): Promise<number> {
  const el = page.getByTestId('station-total');
  await expect(el).toHaveText(/^\d+$/);
  return Number(await el.textContent());
}

async function pickStation(page: Page, name: string) {
  const change = page.getByRole('button', { name: 'Change station' });
  if (await change.isVisible().catch(() => false)) await change.click();
  await page.getByRole('button', { name: new RegExp(name) }).click();
  await expect(page.getByRole('heading', { name })).toBeVisible();
}

test('S2: Sign-Up Booth, Welcome Lounge and Counselling Room counting', async ({ page }, info) => {
  const shot = (name: string) =>
    SHOTS
      ? page.screenshot({ path: `${SHOTS}/${info.project.name}-s2-${name}.png`, fullPage: true })
      : undefined;

  await signIn(page, CC);
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto('/count');
  await expect(page.getByRole('heading', { name: 'Where are you counting?' })).toBeVisible();
  await shot('01-station-picker');

  // Journey 2 (test plan §3): 10 single taps + 1 family of 4 + 1 undo → booth total +13.
  await pickStation(page, 'Sign-Up Booth');
  const boothBefore = await total(page);
  await page.getByRole('button', { name: 'A family arriving together' }).click();
  await page.getByRole('button', { name: 'One more Sec 4' }).click();
  await page.getByRole('button', { name: 'One more Parent / Guardian' }).click();
  await page.getByRole('button', { name: 'One more Parent / Guardian' }).click();
  await page.getByRole('button', { name: 'One more Sec 2' }).click();
  await shot('02-family-stepper');
  await page.getByRole('button', { name: 'Confirm (4 people)' }).click();
  await expect(page.getByText('✓ Saved: family of 4')).toBeVisible();

  const categories = ['Sec 1', 'Sec 2', 'Sec 3', 'Sec 4', 'Sec 5', 'Other'];
  for (let i = 0; i < 10; i += 1) {
    await page
      .getByRole('button', { name: categories[i % categories.length]!, exact: true })
      .click();
  }
  await expect(page.getByText('✓ Saved: Sec 4')).toBeVisible();
  await expect(page.getByTestId('station-total')).toHaveText(String(boothBefore + 14));
  await shot('03-registration-saved');
  await page.getByRole('button', { name: /^Undo/ }).click();
  await expect(page.getByTestId('station-total')).toHaveText(String(boothBefore + 13));

  // The server agrees after a full reload (and the station choice is remembered).
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Sign-Up Booth' })).toBeVisible();
  expect(await total(page)).toBe(boothBefore + 13);

  // Journey 3: Welcome Lounge +1 x5 and +3 → +8.
  await pickStation(page, 'Welcome Lounge');
  const loungeBefore = await total(page);
  for (let i = 0; i < 5; i += 1) await page.getByRole('button', { name: 'Add one person' }).click();
  await page.getByRole('button', { name: 'Add 3 people' }).click();
  await expect(page.getByText('✓ Saved: +3')).toBeVisible();
  await expect(page.getByTestId('station-total')).toHaveText(String(loungeBefore + 8));
  await shot('04-footfall-saved');
  await page.reload();
  expect(await total(page)).toBe(loungeBefore + 8);

  // Counselling Room: guided vs walk-in, with an optional course tag.
  await pickStation(page, 'Counselling Room');
  const guided = page.getByTestId('guided-total');
  await expect(guided).toHaveText(/^\d+$/);
  const guidedBefore = Number(await guided.textContent());
  await page.getByRole('button', { name: '+ Guided group member' }).click();
  await page.getByRole('button', { name: 'DCS' }).click();
  await page.getByRole('button', { name: '+ Walk-in (counselling only)' }).click();
  await expect(page.getByText('✓ Saved: Walk-in · DCS')).toBeVisible();
  await expect(guided).toHaveText(String(guidedBefore + 1));
  await shot('05-counselling');
});
