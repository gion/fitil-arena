import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const API = 'http://localhost:3099';
const HAS_DB = !!process.env.TEST_DATABASE_URL;

type Win = {
  __fitil: { app: { start(k: unknown): void; match: { log: unknown[] | null } | null } };
};

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

test('pagini legale provizorii în Setări', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await page.locator('[data-test=settings]').click();
  await page.locator('[data-test=privacy]').click();
  await expect(page.getByText('PLACEHOLDER')).toBeVisible();
  await expect(page.getByText('Privacy Policy', { exact: false }).first()).toBeVisible();
  await page.goto('/terms.html');
  await expect(page.getByText('PLACEHOLDER')).toBeVisible();
  expect(errors).toEqual([]);
});

test.describe('cont pe server (Postgres)', () => {
  test.skip(!HAS_DB, 'fără TEST_DATABASE_URL');

  const token = (page: Page) =>
    page.evaluate(
      () => (JSON.parse(localStorage.getItem('fitil-account') ?? 'null') as { token: string } | null)?.token,
    );
  const me = (page: Page, t: string) =>
    page.evaluate(
      async ([api, tok]) => {
        const r = await fetch(`${api}/me`, { headers: { authorization: `Bearer ${tok}` } });
        return { status: r.status, body: r.ok ? await r.json() : null };
      },
      [API, t] as const,
    );

  test('serverul e sursa de adevăr: cumpărătura trece prin API, ștergerea contului șterge tot', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('fitil-profile', JSON.stringify({ coins: 300 }));
    });
    await page.reload();
    await expect.poll(() => token(page), { timeout: 10_000 }).toBeTruthy();
    const t = (await token(page))!;
    // profilul local a fost preluat o dată
    await expect.poll(async () => (await me(page, t)).body?.profile.coins).toBe(300);

    await page.locator('[data-test=shop]').click();
    await page.locator('[data-cat=hat]').click();
    await page.locator('[data-item=h_cap]').click();
    await page.locator('[data-test=shop-cta]').click();
    await expect.poll(async () => (await me(page, t)).body?.profile.owned).toContain('h_cap');
    expect((await me(page, t)).body.profile.coins).toBe(250);
    await expect(page.locator('[data-test=coins]')).toHaveText('250');

    // provocarea zilei: rularea înregistrează input-urile
    await page.evaluate(() =>
      (window as unknown as Win).__fitil.app.start({ type: 'challenge', id: 'fast', seed: 7, daily: true }),
    );
    await page.waitForTimeout(1200);
    const n = await page.evaluate(() => (window as unknown as Win).__fitil.app.match!.log!.length);
    expect(n).toBeGreaterThan(5);

    // ștergerea contului
    await page.reload();
    await page.locator('[data-test=settings]').click();
    await page.locator('[data-test=delete-account]').click();
    await page.locator('[data-test=delete-confirm]').click();
    await expect.poll(async () => (await me(page, t)).status).toBe(401);
    expect(errors.filter((e) => !/401/.test(e))).toEqual([]);
  });
});
