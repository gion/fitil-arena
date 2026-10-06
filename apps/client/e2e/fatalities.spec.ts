import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { FATALITIES } from '@fitil/content';

type Win = {
  __fitil: {
    app: {
      start(k: unknown): void;
      match: {
        meId: number;
        fats: Map<number, string>;
        finale: { t: number; player: number } | null;
        emotes: Map<number, { id: string; t: number }>;
        emote(): void;
        handle(e: unknown): void;
        s: { tick: number; players: { alive: boolean; deathTick: number }[] };
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

test('fatalități: fiecare rulează în arenă fără erori; ultima eliminare declanșează slow-motion + zoom', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem(
      'fitil-profile',
      JSON.stringify({
        coins: 0,
        owned: [
          'c_green',
          'e_gg',
          ...['rocket', 'pancake', 'popcorn', 'ghost', 'balloon', 'chicken', 'filed'].map((f) => `f_${f}`),
        ],
        eq: { fatality: 'f_rocket', emote: 'e_gg' },
      }),
    );
  });
  await page.reload();
  await page.waitForFunction(() => (window as unknown as Win).__fitil);
  await page.evaluate(() => (window as unknown as Win).__fitil.app.start({ type: 'mode', mode: 'ffa' }));
  await page.waitForTimeout(600);
  const seen: string[] = [];
  for (const f of FATALITIES) {
    // fatalitatea ucigașului (eu, slotul 0) pe un bot, apoi 1.4s de randare
    const id = await page.evaluate((fid) => {
      const m = (window as unknown as Win).__fitil.app.match!;
      const slots = (m as unknown as { slots: { outfit: Record<string, string | null> | null }[] }).slots;
      slots[0]!.outfit!.fatality = `f_${fid}`;
      const p = m.s.players[1]!;
      p.alive = false;
      p.deathTick = m.s.tick;
      m.handle({ type: 'death', player: 1, killerId: m.meId, cause: 'flame', via: 0 });
      return m.fats.get(1);
    }, f.id);
    seen.push(id!);
    if (process.env.FAT_SHOTS) {
      await page.waitForTimeout(450);
      await page.screenshot({ path: `${process.env.FAT_SHOTS}/${f.id}.png` });
      await page.waitForTimeout(950);
    } else await page.waitForTimeout(1400);
    await page.evaluate(() => {
      const m = (window as unknown as Win).__fitil.app.match!;
      m.s.players[1]!.alive = true;
      m.fats.delete(1);
    });
  }
  expect(seen).toEqual(FATALITIES.map((f) => f.id));

  // emote: butonul din HUD apare cu emote-ul echipat și bula se vede
  await expect(page.locator('[data-test=emote]')).toBeVisible();
  await page.locator('[data-test=emote]').click();
  expect(await page.evaluate(() => (window as unknown as Win).__fitil.app.match!.emotes.get(0)?.id)).toBe(
    'gg',
  );
  await page.waitForTimeout(300);

  // ultima eliminare din rundă: slow-motion + zoom
  const fin = await page.evaluate(() => {
    const m = (window as unknown as Win).__fitil.app.match!;
    const n = m.s.players.length;
    for (let i = 2; i < n; i++) m.s.players[i]!.alive = false;
    m.s.players[1]!.alive = false;
    m.handle({ type: 'death', player: 1, killerId: m.meId, cause: 'flame', via: 0 });
    return m.finale;
  });
  expect(fin?.player).toBe(1);
  await page.waitForTimeout(1200);
  expect(errors).toEqual([]);
});
