import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { MISSIONS } from '@fitil/content';

type Win = {
  __fitil: {
    app: {
      start(k: unknown): void;
      setView(v: string, p: boolean): Promise<void>;
      match: {
        s: {
          mission: { count: number; need: number };
          players: { hp: number; graceT: number; shieldT: number; px: number; py: number }[];
          flame: number[];
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

test('harta misiunilor: prima e deblocată, capitolul 2 e blocat; pornește din interfață', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('[data-test=missions]').click();
  await expect(page.locator('[data-mission=collect-1]')).toBeEnabled();
  await expect(page.locator('[data-mission=demolish-1]')).toBeDisabled();
  await expect(page.locator('[data-mission=collect-2]')).toHaveCount(0);
  await page.locator('[data-mission=collect-1]').click();
  await expect(page.locator('.life')).toBeVisible();
  await page.waitForTimeout(1500);
  expect(errors).toEqual([]);
});

for (const def of MISSIONS)
  test(`misiunea ${def.id} pornește și se termină forțat (reușită, apoi eșuată)`, async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/');
    await page.waitForFunction(() => (window as unknown as Win).__fitil);
    const view = def.kind === 'demolish' ? 'chase' : def.kind === 'rescue' ? 'fps' : '2d';
    await page.evaluate(
      async ([id, v]) => {
        const { app } = (window as unknown as Win).__fitil;
        await app.setView(v!, false);
        app.start({ type: 'mission', id });
      },
      [def.id, view],
    );
    await page.waitForTimeout(1500);
    // terminare forțată: obiectivul atins
    await page.evaluate(() => {
      const mi = (window as unknown as Win).__fitil.app.match!.s.mission;
      mi.count = mi.need;
    });
    await expect(page.locator('.bigstars')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('.mpanel .ptitle')).toHaveText('MISSION COMPLETE!');
    const stars = await page.evaluate(
      (id) =>
        (JSON.parse(localStorage.getItem('fitil-settings') ?? '{}') as { stars?: Record<string, number> })
          .stars?.[id] ?? 0,
      def.id,
    );
    expect(stars).toBeGreaterThanOrEqual(1);
    // reîncearcă și pierde: viața ajunge la 0
    await page.locator('[data-test=again]').click();
    await page.waitForTimeout(800);
    await page.evaluate(() => {
      const s = (window as unknown as Win).__fitil.app.match!.s;
      const p = s.players[0]!;
      p.hp = 1;
      p.graceT = 0;
      p.shieldT = 0;
      // o flacără sub jucător
      // stocarea lumii infinite: chunk-uri 32×32 (slot × 1024 + poziția în chunk), ca `idx` din sim
      const w = (s as unknown as { inf: { slots: Record<number, number> } }).inf;
      const x = Math.round(p.px / 1000);
      const y = Math.round(p.py / 1000);
      const slot = w.slots[((x >> 5) + 0x8000) * 0x10000 + ((y >> 5) + 0x8000)]!;
      s.flame[(slot << 10) | ((y & 31) << 5) | (x & 31)] = 5;
    });
    await expect(page.locator('.mpanel .ptitle')).toHaveText('MISSION FAILED', { timeout: 8000 });
    expect(errors).toEqual([]);
  });
