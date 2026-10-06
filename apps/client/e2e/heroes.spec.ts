import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { CHARACTERS, charById } from '@fitil/content';

const zuzu = charById('zuzu');

type P = {
  hero: { id: string; super: string } | null;
  maxBombs: number;
  charge: number;
  alive: boolean;
  specials: string[];
};
type Win = {
  __fitil: {
    app: {
      start(k: unknown): void;
      setView(v: string, p: boolean): Promise<void>;
      match: {
        meId: number;
        s: {
          tick: number;
          rules: { mode: string; event: string | null };
          players: P[];
          crown: { holder: number | null } | null;
          potato: { holder: number | null } | null;
          events: { type: string }[];
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

test('personajul ales din Play intră în meci cu semnătura și Ultimate-ul lui', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('[data-test=play]').click();
  await page.locator('[data-test=hero]').click();
  await expect(page.locator('.ccard')).toHaveCount(CHARACTERS.length);
  await page.locator('[data-char=zuzu]').click();
  await page.locator('[data-test=open-char]').click();
  await page.locator('[data-test=select-char]').click();
  // după alegere te întoarce singur în grilă
  await expect(page.locator('.ccard')).toHaveCount(CHARACTERS.length);
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.locator('[data-test=hero]')).toContainText(`${zuzu.name} — ${zuzu.ultimate.name}`);
  await page.locator('[data-mode=ffa]').click();
  await page.locator('[data-test=start]').click();
  await page.waitForTimeout(800);
  const me = await page.evaluate(() => {
    const m = (window as unknown as Win).__fitil.app.match!;
    const p = m.s.players[m.meId]!;
    return { hero: p.hero, maxBombs: p.maxBombs };
  });
  expect(me.hero).toMatchObject({ id: 'zuzu', super: 'dash' });
  expect(me.maxBombs).toBe(zuzu.kit.maxBombs);
  // fitilul de start ține meciul pe pauză 2,1s (D-057)
  await page.waitForFunction(
    () =>
      !(window as unknown as { __fitil: { app: { match: { paused: boolean } } } }).__fitil.app.match.paused,
  );
  // bara plină → butonul Ultimate apare „gata” și pornește la apăsare
  await page.evaluate(() => {
    const m = (window as unknown as Win).__fitil.app.match!;
    m.s.players[m.meId]!.charge = 100;
  });
  await expect(page.locator('[data-test=super]')).toHaveClass(/ready/);
  await expect(page.locator('[data-test=super]')).toHaveText(zuzu.ultimate.name);
  await page.locator('[data-test=super]').dispatchEvent('pointerdown');
  await page.waitForFunction(() => {
    const m = (window as unknown as Win).__fitil.app.match!;
    return m.s.players[m.meId]!.charge < 100;
  });
  expect(await page.evaluate(() => localStorage.getItem('fitil-profile'))).toContain('"ch":"zuzu"');
  expect(errors).toEqual([]);
});

for (const mode of ['crown', 'potato'] as const)
  for (const view of ['2d', 'chase'] as const)
    test(`modul ${mode} în vederea ${view}: pornește, obiectivul apare, fără erori`, async ({ page }) => {
      const errors = watchErrors(page);
      await page.goto('/');
      await page.waitForFunction(() => (window as unknown as Win).__fitil);
      await page.evaluate(
        async ([m, v]) => {
          const { app } = (window as unknown as Win).__fitil;
          await app.setView(v!, false);
          app.start({ type: 'mode', mode: m });
        },
        [mode, view],
      );
      await page.waitForFunction(
        (m) => {
          const s = (window as unknown as Win).__fitil.app.match!.s;
          return m === 'crown'
            ? s.crown !== null
            : s.potato?.holder !== null && s.potato?.holder !== undefined;
        },
        mode,
        { timeout: 20_000 },
      );
      const st = await page.evaluate(() => {
        const s = (window as unknown as Win).__fitil.app.match!.s;
        return { mode: s.rules.mode, event: s.rules.event, heroes: s.players.map((p) => p.hero?.id) };
      });
      expect(st.mode).toBe(mode);
      expect(st.event).not.toBeNull();
      expect(st.heroes.every((h) => typeof h === 'string')).toBe(true);
      await page.waitForTimeout(3000);
      expect(errors).toEqual([]);
    });
