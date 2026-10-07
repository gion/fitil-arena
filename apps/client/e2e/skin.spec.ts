import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

/**
 * Skin-ul „Toy” (D-077, în paralel cu „Comic” până la alegere): se alege din Settings › Look,
 * se aplică pe loc și se păstrează; `?skin=` îl schimbă doar pentru sesiunea curentă. Mai jos,
 * toate ecranele sunt parcurse în Toy: fără erori, ținte de minimum 44px, capturi în docs/screens/ui-toy/.
 */

test.use({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 });

const OUT = '../../docs/screens/ui-toy';
mkdirSync(OUT, { recursive: true });

const INDIGO = 'rgb(43, 26, 120)';
const PAPER = 'rgb(255, 214, 10)';

const skin = (page: Page) => page.evaluate(() => document.documentElement.dataset.skin);
const pageBg = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.querySelector('.page')!).backgroundColor);

test('Settings › Look: Comic implicit, Toy se aplică pe loc și se păstrează', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/');
  await page.waitForSelector('[data-test="settings"]');
  expect(await skin(page)).toBe('comic');
  expect(await pageBg(page)).toBe(PAPER);

  await page.click('[data-test="settings"]');
  await page.click('[data-skin-pick="toy"]');
  expect(await skin(page)).toBe('toy');
  expect(await pageBg(page)).toBe(INDIGO);
  await expect(page.locator('[data-skin-pick="toy"]')).toHaveAttribute('aria-pressed', 'true');
  // fontul de titluri al skin-ului e cel împachetat local
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check("28px 'Lilita One'"))).toBe(true);

  await page.reload();
  await page.waitForSelector('[data-test="settings"]');
  expect(await skin(page)).toBe('toy');

  // parametrul din URL bate setarea, fără s-o schimbe
  await page.goto('/?skin=comic');
  await page.waitForSelector('[data-test="settings"]');
  expect(await skin(page)).toBe('comic');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('fitil-settings')!).skin)).toBe('toy');

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

type App = {
  start(k: unknown): void;
  setView(v: string, p: boolean): Promise<void>;
  roundOver(e: unknown): void;
  connLost(): void;
  connBack(): void;
  match: { s: { tick: number } } | null;
};
type W = { __fitil: { app: App } };

function watch(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

/** Profil cu ceva progres, mișcare oprită (capturi stabile), skin-ul Toy salvat. */
async function toy(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('fitil-settings', JSON.stringify({ motion: false, name: 'Gion', skin: 'toy' }));
    localStorage.setItem('fitil-profile', JSON.stringify({ coins: 900, xp: { bubu: 400 } }));
  });
  await page.reload();
  await page.waitForFunction(() => (window as unknown as W).__fitil);
  expect(await skin(page)).toBe('toy');
}

async function shot(page: Page, name: string, errors: string[]): Promise<void> {
  await page.waitForTimeout(350);
  expect(await small(page), `ținte sub 44px pe ${name}`).toEqual([]);
  await page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 75 });
  expect(errors, `erori pe ${name}`).toEqual([]);
}

test('Toy: meniurile se deschid fără erori, cu ținte de minimum 44px', async ({ page }) => {
  const errors = watch(page);

  await toy(page);
  const check = (name: string) => shot(page, name, errors);
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

  // textele legale din Settings
  await page.locator('[data-test=settings]').click();
  await page.locator('[data-test=privacy]').click();
  await expect(page.locator('.ptitle')).toBeVisible();
  await check('legal');
});

test('Toy: Online, camera privată, foaia de opțiuni, jocul rapid', async ({ browser }) => {
  const page = await (await browser.newContext()).newPage();
  const errors = watch(page);
  await toy(page);
  await page.locator('[data-test=online]').click();
  await expect(page.locator('[data-test=create]')).toBeVisible();
  await shot(page, 'online', errors);
  await page.locator('[data-test=create]').click();
  await expect(page.locator('[data-test=room-code]')).toHaveText(/^[A-Z]{4}$/);
  await shot(page, 'lobby', errors);
  await page.locator('[data-rule=bots]').click();
  await expect(page.locator('.sheet [data-level=hard]')).toBeVisible();
  await shot(page, 'lobby-sheet', errors);
  await page.locator('.sheet [data-level=hard]').click();
  await page.locator('[data-test=back]').click();
  await expect(page.locator('[data-test=quick]')).toBeVisible();
  await page.locator('[data-test=quick]').click();
  await expect(page.locator('[data-test=lobby-status]')).toContainText(/Starting in|Waiting/);
  await shot(page, 'quick', errors);
  await page.context().close();
});

test('Toy: în joc — HUD FFA / echipe / steag, 3D, pauză, conexiune, final', async ({ page }) => {
  const errors = watch(page);
  await toy(page);
  const play = async (mode: string, view = '2d') => {
    await page.evaluate(
      async ([m, v]) => {
        const { app } = (window as unknown as W).__fitil;
        await app.setView(v!, false);
        app.start({ type: 'mode', mode: m });
      },
      [mode, view],
    );
    await expect
      .poll(() => page.evaluate(() => (window as unknown as W).__fitil.app.match?.s.tick ?? 0))
      .toBeGreaterThan(20);
    await page.waitForTimeout(300);
  };
  await play('ffa');
  await expect(page.locator('.hudbar .chip').first()).toBeVisible();
  expect((await page.locator('.hudbar').boundingBox())!.height).toBe(44);
  await shot(page, 'game-ffa', errors);
  await page.locator('[data-test=pause]').click();
  await expect(page.locator('[data-test=resume]')).toBeVisible();
  await shot(page, 'pause', errors);
  await page.locator('[data-test=resume]').click();
  await expect(page.locator('[data-test=resume]')).toHaveCount(0);

  await page.evaluate(() => (window as unknown as W).__fitil.app.connLost());
  await expect(page.locator('[data-test=conn] .ptitle')).toHaveText('CONNECTION LOST');
  await shot(page, 'reconnect', errors);
  await page.evaluate(() => (window as unknown as W).__fitil.app.connBack());

  await page.evaluate(() =>
    (window as unknown as W).__fitil.app.roundOver({ type: 'over', winner: 0, team: null }),
  );
  await expect(page.locator('[data-test=again]')).toBeVisible();
  await shot(page, 'final', errors);

  await play('team2');
  await expect(page.locator('.hudbar .chip.team')).toHaveCount(2);
  await shot(page, 'game-teams', errors);
  await play('ctf');
  await shot(page, 'game-ctf', errors);
  await play('ffa', 'chase');
  await expect(page.locator('.bomb3')).toBeVisible();
  await page.waitForTimeout(1200);
  await shot(page, 'game-3d', errors);
});
