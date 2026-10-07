import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { statSync } from 'node:fs';

/** Faza 8: linkul de invitație (web) și „Save clip”. */

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

test('linkul de invitație (?join=COD) te duce direct în camera prietenului', async ({ browser }) => {
  const host = await (await browser.newContext()).newPage();
  const guest = await (await browser.newContext()).newPage();
  const errors = [...watchErrors(host), ...watchErrors(guest)];
  await host.goto('/');
  await host.locator('[data-test=online]').click();
  await host.locator('[data-test=name]').fill('Host');
  await host.locator('[data-test=create]').click();
  const code = (await host.locator('[data-test=room-code]').textContent())!.trim();

  await guest.goto(`/?join=${code.toLowerCase()}`);
  await expect(guest.locator('.seats li:not(.empty)')).toHaveCount(2, { timeout: 10_000 });
  await expect(host.locator('.seats li:not(.empty)')).toHaveCount(2);
  // parametrul dispare din adresă: o reîncărcare nu reintră
  expect(new URL(guest.url()).search).toBe('');
  expect(errors).toEqual([]);
  await host.context().close();
  await guest.context().close();
});

test('Save clip: arena se înregistrează în meci, din pauză iese un fișier video', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await page.locator('[data-test=play]').click();
  await page.locator('[data-test=start]').click();
  // fitilul de start + câteva secunde de joc
  await page.waitForTimeout(6000);
  await page.keyboard.press('Escape');
  const clip = page.locator('[data-test=clip]');
  await expect(clip).toBeVisible();
  const [dl] = await Promise.all([page.waitForEvent('download'), clip.click()]);
  expect(dl.suggestedFilename()).toMatch(/^fuse-arena-.*\.(webm|mp4)$/);
  const path = `test-results/clip-sample.${dl.suggestedFilename().split('.').pop()}`;
  await dl.saveAs(path);
  expect(statSync(path).size).toBeGreaterThan(20_000);
  expect(errors).toEqual([]);
});
