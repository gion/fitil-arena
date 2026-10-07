import { test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Capturi pentru store și un clip de devlog (doar la cerere: `pnpm store:shots`), în `store-shots/`
 * (nu intră în git). Rezoluții landscape: Google Play 1920×1080, App Store iPhone 6.7" 2796×1290.
 */
test.skip(!process.env.STORE, 'doar la cerere');

const SIZES = [
  { id: 'play-1920x1080', viewport: { width: 960, height: 540 }, scale: 2 },
  { id: 'iphone67-2796x1290', viewport: { width: 932, height: 430 }, scale: 3 },
] as const;

type Api = {
  setTheme(i: string): void;
  setView(v: string, p: boolean): Promise<void>;
  start(k: unknown): void;
};
const app = (page: Page, fn: (a: Api) => unknown) => page.evaluate(`(${fn.toString()})(window.__fitil.app)`);

/** Ecranele din store, în ordine: meniul, personajele, meciul 2D, Infinit, 3D. */
async function shots(page: Page, dir: string): Promise<void> {
  const snap = (name: string) => page.screenshot({ path: `store-shots/${dir}/${name}.png` });
  await page.goto('/');
  await page.waitForFunction(() => (window as unknown as { __fitil?: unknown }).__fitil);
  await page.waitForTimeout(800);
  await snap('01-menu');
  await page.locator('[data-test=characters]').click();
  await page.waitForTimeout(900);
  await snap('02-characters');
  await app(page, (a) => {
    a.setTheme('clasic');
    a.start({ type: 'mode', mode: 'ffa' });
  });
  await page.waitForTimeout(9000);
  await snap('03-match');
  await app(page, (a) => a.start({ type: 'infinite' }));
  await page.waitForTimeout(6000);
  await snap('04-infinite');
  await app(page, async (a) => {
    await a.setView('chase', false);
    a.start({ type: 'mode', mode: 'team3' });
  });
  await page.waitForTimeout(9000);
  await snap('05-3d');
}

for (const s of SIZES)
  test.describe(s.id, () => {
    test.use({ viewport: s.viewport, deviceScaleFactor: s.scale });
    test(`capturi ${s.id}`, async ({ page }) => {
      test.setTimeout(120_000);
      await shots(page, s.id);
    });
  });

test('clip devlog: meci de 20s înregistrat', async ({ browser }) => {
  test.setTimeout(90_000);
  const size = { width: 1280, height: 576 };
  const ctx = await browser.newContext({ viewport: size, recordVideo: { dir: 'store-shots/video', size } });
  const page = await ctx.newPage();
  await page.goto('/');
  await page.waitForFunction(() => (window as unknown as { __fitil?: unknown }).__fitil);
  await app(page, (a) => a.start({ type: 'mode', mode: 'ffa' }));
  await page.waitForTimeout(20_000);
  await page.close();
  await page.video()?.saveAs('store-shots/devlog-match.webm');
  await ctx.close();
});
