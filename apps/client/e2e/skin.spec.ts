import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

/**
 * Skin-ul „Toy” (D-073, doar pentru comparație): rândul Settings › Look apare numai în build-urile
 * de dezvoltare; testele rulează pe build-ul de producție, unde „Comic” e implicit și Toy se
 * deschide cu `?skin=toy`, doar pentru sesiunea curentă.
 */

test.use({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 });

const OUT = '../../docs/screens/ui-toy';
mkdirSync(OUT, { recursive: true });

const INDIGO = 'rgb(43, 26, 120)';
const PAPER = 'rgb(255, 214, 10)';

const skin = (page: Page) => page.evaluate(() => document.documentElement.dataset.skin);
const pageBg = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.querySelector('.page')!).backgroundColor);

test('build de store: fără rândul „Look”, Comic implicit; ?skin=toy doar pentru sesiune', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));

  // o setare salvată dintr-un build de dezvoltare nu contează aici
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('fitil-settings', JSON.stringify({ skin: 'toy' })));
  await page.reload();
  await page.waitForSelector('[data-test="settings"]');
  expect(await skin(page)).toBe('comic');
  expect(await pageBg(page)).toBe(PAPER);
  await page.click('[data-test="settings"]');
  await expect(page.locator('[data-toggle=sound]')).toBeVisible();
  await expect(page.locator('[data-skin-pick]')).toHaveCount(0);

  // parametrul din URL schimbă aspectul, fără să atingă setările
  await page.goto('/?skin=toy');
  await page.waitForSelector('[data-test="settings"]');
  expect(await skin(page)).toBe('toy');
  expect(await pageBg(page)).toBe(INDIGO);
  // fontul de titluri al skin-ului e cel împachetat local
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check("28px 'Lilita One'"))).toBe(true);

  await page.goto('/?skin=comic');
  await page.waitForSelector('[data-test="settings"]');
  expect(await skin(page)).toBe('comic');

  expect(errors).toEqual([]);
});

/** Elementele interactive vizibile mai mici de 44px (aceeași regulă ca în ui.spec.ts). */
async function small(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>(
      '#ui button, #ui a[href], #ui input, #ui [role=switch]',
    )) {
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      if (!r.width || !r.height || st.visibility === 'hidden' || el.closest('.hidden')) continue;
      if (r.bottom <= 0 || r.top >= innerHeight) continue;
      if (r.width < 43.5 || r.height < 43.5)
        out.push(
          `${el.tagName.toLowerCase()}.${el.className} "${(el.textContent ?? '').trim().slice(0, 20)}" ${Math.round(r.width)}×${Math.round(r.height)}`,
        );
    }
    return out;
  });
}

test('Toy: meniurile și HUD-ul se deschid fără erori, cu ținte de minimum 44px', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/?skin=toy');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('fitil-settings', JSON.stringify({ motion: false, name: 'Gion' }));
    localStorage.setItem('fitil-profile', JSON.stringify({ coins: 900, xp: { bubu: 400 } }));
  });
  await page.reload();
  await page.waitForSelector('[data-test=play]');
  expect(await skin(page)).toBe('toy');

  const check = async (name: string) => {
    await page.waitForTimeout(350);
    expect(await small(page), `ținte sub 44px pe ${name}`).toEqual([]);
    await page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 75 });
    expect(errors, `erori pe ${name}`).toEqual([]);
  };
  const back = () => page.locator('[data-test=back]').click();

  await check('home');
  await page.locator('[data-test=play]').click();
  await expect(page.locator('[data-test=start]')).toBeVisible();
  await check('play');
  await back();

  await page.locator('[data-test=characters]').click();
  await expect(page.locator('.ccard').first()).toBeVisible();
  await check('characters');
  await page.locator('[data-test=open-char]').click();
  await expect(page.locator('[data-test=listen]')).toBeVisible();
  await check('character');
  await back();
  await back();

  await page.locator('[data-test=shop]').click();
  await expect(page.locator('[data-test=shop-cta]')).toBeVisible();
  await check('shop');
  await back();

  await page.locator('[data-test=settings]').click();
  await expect(page.locator('[data-toggle=sound]')).toBeVisible();
  await check('settings');
  await back();

  for (const s of ['missions', 'practice', 'themes'] as const) {
    await page.locator(`[data-test=${s}]`).click();
    await expect(page.locator('.ptitle')).toHaveText(s.toUpperCase());
    await check(s);
    await back();
  }

  // în joc: HUD-ul și pauza
  await page.evaluate(() =>
    (window as unknown as { __fitil: { app: { start(k: unknown): void } } }).__fitil.app.start({
      type: 'mode',
      mode: 'ffa',
    }),
  );
  await page.waitForSelector('.hudbar');
  await check('game-ffa');
});
