import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const HAS_DB = !!process.env.TEST_DATABASE_URL;
const SHOTS = '../../docs/screens/faza9';

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

test('Deals și Pass se văd și fără cont; Gemurile cer conexiune', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await page.locator('[data-test=shop]').click();
  await page.locator('[data-cat=daily]').click();
  await expect(page.locator('.card[data-off]')).toHaveCount(6);
  await expect(page.locator('.card[data-off]').first()).toHaveAttribute('data-off', '-40%');
  await page.screenshot({ path: `${SHOTS}/deals.png` });

  await page.goto('/');
  await page.locator('[data-test=pass]').click();
  await expect(page.locator('[data-test=pass-track] .pcol')).toHaveCount(30);
  await expect(page.locator('[data-test=tier-free-1]')).toHaveAttribute('data-state', 'locked');
  await expect(page.locator('[data-test=tier-premium-5]')).toHaveAttribute('data-state', 'locked');
  await page.screenshot({ path: `${SHOTS}/pass.png` });

  await page.goto('/');
  await page.locator('[data-test=gems]').click();
  await expect(page.locator('[data-test=buy-gems_100]')).toBeVisible();
  if (!HAS_DB) {
    await expect(page.locator('[data-test=buy-gems_100]')).toHaveClass(/locked/);
    await expect(page.getByText('Connect to the internet to buy Gems.')).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test.describe('cu cont și plăți simulate (Postgres)', () => {
  test.skip(!HAS_DB, 'fără TEST_DATABASE_URL');

  test('starter pack o dată, Gemuri, pass premium', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/');
    await page.locator('[data-test=gems]').click();
    const starter = page.locator('[data-test=buy-starter_pack]');
    await expect(starter).not.toHaveClass(/locked/, { timeout: 10_000 });
    await expect(starter).toHaveText('€2.99');
    await page.screenshot({ path: `${SHOTS}/gems.png` });
    await starter.click();
    await expect(page.locator('[data-test=gems] span')).toHaveText('300');
    // produsul unic dispare după cumpărare
    await expect(starter).toHaveCount(0);
    await page.locator('[data-test=buy-gems_550]').click();
    await expect(page.locator('[data-test=gems] span')).toHaveText('850');

    await page.goto('/');
    await page.locator('[data-test=pass]').click();
    await page.locator('[data-test=pass-premium]').click();
    await expect(page.locator('[data-test=pass-premium-on]')).toBeVisible();
    await expect(page.locator('[data-test=gems] span')).toHaveText('350');
    // după reîncărcare, profilul vine de pe server
    await page.reload();
    await page.locator('[data-test=pass]').click();
    await expect(page.locator('[data-test=pass-premium-on]')).toBeVisible();
    await expect(page.locator('[data-test=gems] span')).toHaveText('350');
    await page.screenshot({ path: `${SHOTS}/pass-premium.png` });
    expect(errors).toEqual([]);
  });
});
