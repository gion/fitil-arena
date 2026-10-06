import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/** Modul Infinit (Faza 7): offline cu boți, online într-o lume comună. */

type Win = {
  __fitil: {
    app: {
      phase: string;
      match: {
        meId: number;
        kind: { type: string };
        s: {
          tick: number;
          players: { id: number; bot: string | null; alive: boolean; out: boolean; px: number }[];
        };
      } | null;
    };
  };
};

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

const info = (page: Page) =>
  page.evaluate(() => {
    const m = (window as unknown as Win).__fitil.app.match;
    if (!m) return null;
    const live = m.s.players.filter((p) => p.alive && !p.out);
    return {
      kind: m.kind.type,
      tick: m.s.tick,
      bots: live.filter((p) => p.bot !== null).length,
      people: live.filter((p) => p.bot === null).length,
      x: m.s.players[m.meId]!.px,
    };
  });

const SHOTS = '../../docs/screens/infinite';

test('Infinit offline: lumea fără margini, boții apar, HUD cu scor și minimapă', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await page.locator('[data-test=play]').click();
  await page.locator('[data-test=infinite]').click();
  await expect.poll(async () => (await info(page))?.kind, { timeout: 10_000 }).toBe('infinite');
  await expect(page.locator('[data-test=score]')).toBeVisible();
  await expect(page.locator('[data-test=minimap]')).toBeVisible();
  await expect(page.locator('.clock')).toHaveText('∞');
  // boții vin singuri în jurul tău
  await expect.poll(async () => (await info(page))?.bots ?? 0, { timeout: 15_000 }).toBeGreaterThanOrEqual(3);
  // mers spre dreapta: lumea se generează în continuare
  const x0 = (await info(page))!.x;
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(1500);
  await page.keyboard.up('ArrowRight');
  await page.screenshot({ path: `${SHOTS}/offline.jpg`, type: 'jpeg', quality: 75 });
  expect((await info(page))!.x).not.toBe(x0);
  expect(errors).toEqual([]);
});

test('Infinit online: doi jucători intră în aceeași lume, clasament și loc în top', async ({ browser }) => {
  const a = await (await browser.newContext()).newPage();
  const b = await (await browser.newContext()).newPage();
  const errors = [...watchErrors(a), ...watchErrors(b)];
  for (const [p, name] of [
    [a, 'Ana'],
    [b, 'Bob'],
  ] as const) {
    await p.goto('/');
    await p.locator('[data-test=online]').click();
    await p.locator('[data-test=name]').fill(name);
    await p.locator('[data-test=inf-online]').click();
    await expect.poll(async () => (await info(p))?.kind, { timeout: 10_000 }).toBe('infinite');
  }
  // clasamentul vine o dată pe secundă: amândoi apar
  await expect(a.locator('[data-test=board] li')).toHaveCount(2, { timeout: 5000 });
  await expect(b.locator('[data-test=rank]')).toContainText('of 2');
  await expect(a.locator('[data-test=board]')).toContainText('Bob');
  // cei doi apar aproape de centru, deci se văd unul pe altul
  await expect.poll(async () => (await info(a))?.people ?? 0, { timeout: 5000 }).toBe(2);
  await a.screenshot({ path: `${SHOTS}/online.jpg`, type: 'jpeg', quality: 75 });
  // Bob pleacă: dispare din clasamentul Anei
  await b.close();
  await expect(a.locator('[data-test=board] li')).toHaveCount(1, { timeout: 15_000 });
  expect(errors).toEqual([]);
});
