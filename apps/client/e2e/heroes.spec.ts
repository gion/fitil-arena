import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { HEROES, HERO_IDS } from '@fitil/content';

type P = {
  hero: { id: string; super: string } | null;
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

test('selecția personajului: toate cele 7, alegerea se păstrează și intră în meci cu Super-ul lui', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('[data-test=play]').click();
  await page.locator('[data-test=hero]').click();
  await expect(page.locator('.hero-card')).toHaveCount(HERO_IDS.length);
  await page.locator('[data-hero=fifi]').click();
  await expect(page.locator('[data-test=hero]')).toContainText(HEROES.fifi.name);
  await page.locator('[data-mode=ffa]').click();
  await page.locator('[data-test=start]').click();
  await page.waitForTimeout(800);
  const hero = await page.evaluate(() => {
    const m = (window as unknown as Win).__fitil.app.match!;
    return m.s.players[m.meId]!.hero;
  });
  expect(hero).toMatchObject({ id: 'fifi', super: 'cluster' });
  // bara plină → butonul Super apare „gata” și Super-ul pornește la apăsare
  await page.evaluate(() => {
    const m = (window as unknown as Win).__fitil.app.match!;
    m.s.players[m.meId]!.charge = 100;
  });
  await expect(page.locator('[data-test=super]')).toHaveClass(/ready/);
  await page.locator('[data-test=super]').dispatchEvent('pointerdown');
  await page.waitForFunction(() => {
    const m = (window as unknown as Win).__fitil.app.match!;
    return m.s.players[m.meId]!.charge < 100;
  });
  expect(await page.evaluate(() => localStorage.getItem('fitil-settings'))).toContain('"hero":"fifi"');
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
