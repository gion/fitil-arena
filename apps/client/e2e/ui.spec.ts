import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

/**
 * Faza 4b — interfața „Comic”: fiecare ecran refăcut se deschide fără erori în consolă,
 * niciun element interactiv vizibil nu e sub 44px, iar captura lui ajunge în docs/screens/
 * (de comparat manual cu machetele din reference/ui/). La final: tema arenei nu schimbă interfața.
 */

type App = {
  start(k: unknown): void;
  setTheme(id: string): void;
  setView(v: string, p: boolean): Promise<void>;
  roundOver(e: unknown): void;
  connLost(): void;
  match: { s: { tick: number } } | null;
};
type W = { __fitil: { app: App } };

const OUT = '../../docs/screens/ui';
mkdirSync(OUT, { recursive: true });
// la dimensiunea machetelor (844×390), cu densitatea unui telefon
test.use({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 });

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

/** Elementele interactive vizibile mai mici de 44px (lățime sau înălțime). */
async function small(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>(
      '#ui button, #ui a[href], #ui input, #ui [role=switch]',
    )) {
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      if (!r.width || !r.height || st.visibility === 'hidden' || el.closest('.hidden')) continue;
      // în afara ecranului (pagini derulabile): contează doar ce se vede
      if (r.bottom <= 0 || r.top >= innerHeight) continue;
      if (r.width < 43.5 || r.height < 43.5)
        out.push(
          `${el.tagName.toLowerCase()}.${el.className} "${(el.textContent ?? '').trim().slice(0, 20)}" ${Math.round(r.width)}×${Math.round(r.height)}`,
        );
    }
    return out;
  });
}

async function fresh(page: Page, profile: object = { coins: 900, xp: { bubu: 400 } }): Promise<void> {
  await page.goto('/');
  await page.evaluate((p) => {
    localStorage.clear();
    // mișcare oprită: tranzițiile devin instantanee, capturile sunt stabile
    localStorage.setItem('fitil-settings', JSON.stringify({ motion: false, name: 'Gion' }));
    localStorage.removeItem('fitil-account');
    localStorage.setItem('fitil-profile', JSON.stringify(p));
  }, profile);
  await page.reload();
  await page.waitForFunction(() => (window as unknown as W).__fitil);
}

async function check(page: Page, name: string, errors: string[]): Promise<void> {
  await page.waitForTimeout(350);
  expect(await small(page), `ținte sub 44px pe ${name}`).toEqual([]);
  await page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 75 });
  expect(errors, `erori pe ${name}`).toEqual([]);
}

test('meniurile: principal, Play, personaje, pagina personajului, magazin, setări, misiuni, practice, teme', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await fresh(page);
  await expect(page.locator('[data-test=play]')).toBeVisible();
  await check(page, 'home', errors);

  await page.locator('[data-test=play]').click();
  await expect(page.locator('[data-test=start]')).toBeVisible();
  await check(page, 'play', errors);
  await page.locator('[data-test=back]').click();

  await page.locator('[data-test=characters]').click();
  await expect(page.locator('.ccard').first()).toBeVisible();
  await check(page, 'characters', errors);
  await page.locator('[data-char=zuzu]').click();
  await page.locator('[data-test=open-char]').click();
  await expect(page.locator('[data-test=listen]')).toBeVisible();
  await check(page, 'character', errors);
  await page.locator('[data-test=back]').click();
  await page.locator('[data-test=back]').click();

  await page.locator('[data-test=shop]').click();
  await page.locator('[data-cat=hat]').click();
  await expect(page.locator('[data-test=shop-cta]')).toBeVisible();
  await check(page, 'shop', errors);
  await page.locator('[data-test=back]').click();

  await page.locator('[data-test=settings]').click();
  await expect(page.locator('[data-toggle=sound]')).toBeVisible();
  await page.locator('[data-toggle=motion]').click();
  await page.locator('[data-toggle=motion]').click();
  await check(page, 'settings', errors);
  await page.locator('[data-test=back]').click();

  for (const s of ['missions', 'practice', 'themes'] as const) {
    await page.locator(`[data-test=${s}]`).click();
    await expect(page.locator('.ptitle')).toHaveText(s.toUpperCase());
    await check(page, s, errors);
    await page.locator('[data-test=back]').click();
  }
  await expect(page.locator('[data-test=play]')).toBeVisible();
});

test('blocat: se scutură, nu se deschide, personajul se întristează', async ({ page }) => {
  const errors = watchErrors(page);
  await fresh(page, {});
  await page.locator('[data-test=play]').click();
  const ctf = page.locator('[data-mode=ctf]');
  await expect(ctf).toHaveAttribute('aria-disabled', 'true');
  await ctf.click({ force: true });
  await expect(page.locator('[data-mode=ctf]')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('[data-mode=ffa]')).toHaveAttribute('aria-pressed', 'true');
  expect(errors).toEqual([]);
});

test('online: meniul, camera privată, jocul rapid', async ({ browser }) => {
  const page = await (await browser.newContext()).newPage();
  const errors = watchErrors(page);
  await fresh(page);
  await page.locator('[data-test=online]').click();
  await expect(page.locator('[data-test=create]')).toBeVisible();
  await check(page, 'online', errors);
  await page.locator('[data-test=create]').click();
  await expect(page.locator('[data-test=room-code]')).toHaveText(/^[A-Z]{4}$/);
  await check(page, 'lobby', errors);
  await page.locator('[data-rule=bots]').click();
  await expect(page.locator('.sheet [data-level=hard]')).toBeVisible();
  await check(page, 'lobby-sheet', errors);
  await page.locator('.sheet [data-level=hard]').click();
  await expect(page.locator('[data-rule=bots]')).toContainText('Hard');
  await page.locator('[data-test=back]').click();
  await expect(page.locator('[data-test=quick]')).toBeVisible();
  await page.locator('[data-test=quick]').click();
  await expect(page.locator('[data-test=lobby-status]')).toContainText(/Starting in|Waiting/);
  await check(page, 'quick', errors);
  await page.context().close();
});

test('în joc: HUD FFA / echipe / steag, 3D, pauză, conexiune, final', async ({ page }) => {
  const errors = watchErrors(page);
  await fresh(page);
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
    // hint-urile de început dispar la prima atingere
    await page.waitForTimeout(300);
  };
  await play('ffa');
  await expect(page.locator('.hudbar .chip').first()).toBeVisible();
  const bar = await page.locator('.hudbar').boundingBox();
  expect(bar!.height).toBe(44);
  await check(page, 'game-ffa', errors);
  await page.locator('[data-test=pause]').click();
  await expect(page.locator('[data-test=resume]')).toBeVisible();
  await check(page, 'pause', errors);
  await page.locator('[data-test=pause-mode]').click();
  await expect(page.locator('.sheet [data-mode=ffa]')).toBeVisible();
  await page.locator('.sheet [data-test=back], .sheet .sq').first().click();
  await page.locator('[data-test=resume]').click();
  await expect(page.locator('[data-test=resume]')).toHaveCount(0);

  await page.evaluate(() => (window as unknown as W).__fitil.app.connLost());
  await expect(page.locator('[data-test=conn] .ptitle')).toHaveText('CONNECTION LOST');
  await check(page, 'reconnect', errors);
  await page.evaluate(() =>
    ((window as unknown as W).__fitil.app as unknown as { connBack(): void }).connBack(),
  );

  await page.evaluate(() =>
    (window as unknown as W).__fitil.app.roundOver({ type: 'over', winner: 0, team: null }),
  );
  await expect(page.locator('[data-test=again]')).toBeVisible();
  await check(page, 'final', errors);

  await play('team2');
  await expect(page.locator('.hudbar .chip.team')).toHaveCount(2);
  await check(page, 'game-teams', errors);
  await play('ctf');
  await expect(page.locator('.hudbar .chip.team')).toHaveCount(2);
  await check(page, 'game-ctf', errors);
  await play('ffa', 'chase');
  await expect(page.locator('.bomb3')).toBeVisible();
  await page.waitForTimeout(1200);
  await check(page, 'game-3d', errors);
});

test('tema arenei nu schimbă interfața (D-052)', async ({ page }) => {
  await fresh(page);
  const look = (sel: string[]) =>
    page.evaluate((sel) => {
      return sel.map((s) => {
        const el = document.querySelector<HTMLElement>(s);
        if (!el) return `${s}: —`;
        const c = getComputedStyle(el);
        return `${s}: ${c.backgroundColor} ${c.color} ${c.fontFamily} ${c.borderTopColor} ${c.borderTopWidth}`;
      });
    }, sel);
  const views: string[][] = [];
  for (const th of ['clasic', 'neon']) {
    await page.evaluate((t) => (window as unknown as W).__fitil.app.setTheme(t), th);
    const menu = await look(['.page', '.ptitle', '.playbox', '.tile', '.coins', '.say']);
    await page.evaluate(() => (window as unknown as W).__fitil.app.start({ type: 'dummies' }));
    await expect(page.locator('.hudbar .chip').first()).toBeVisible();
    views.push([...menu, ...(await look(['.hudbar', '.chip', '.clock', '.pausebtn', '.viewbtn', '.frame']))]);
    await page.screenshot({ path: `${OUT}/theme-${th}.jpg`, type: 'jpeg', quality: 75 });
    await page.evaluate(() =>
      ((window as unknown as W).__fitil.app as unknown as { toMenu(): void }).toMenu(),
    );
  }
  expect(views[1]).toEqual(views[0]);
});

test('telefon în portrait: ecranul „Rotate your phone” în locul jocului', async ({ browser }) => {
  const ctx = await browser.newContext({
    viewport: { width: 412, height: 915 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await ctx.newPage();
  await page.goto('/');
  await expect(page.locator('#rotate')).toBeVisible();
  await expect(page.locator('#ui')).toBeHidden();
  await page.screenshot({ path: `${OUT}/rotate.jpg`, type: 'jpeg', quality: 75 });
  await ctx.close();
});
