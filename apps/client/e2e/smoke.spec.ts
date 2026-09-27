import { expect, test } from '@playwright/test';

test('pornește fără erori în consolă', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('canvas')).toBeVisible();
  await page.mouse.click(200, 300);
  await page.waitForTimeout(1000);
  expect(errors).toEqual([]);
});
