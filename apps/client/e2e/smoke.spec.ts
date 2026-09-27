import { expect, test } from '@playwright/test';
import type { CDPSession, Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

type Fitil = {
  app: {
    setView(v: string, persist: boolean): Promise<void>;
    setTheme(id: string): void;
    start(k: unknown): void;
    match: { s: { tick: number; players: { alive: boolean }[] }; me: { alive: boolean } } | null;
    view: string;
  };
  scene: { fps: number };
};
declare global {
  interface Window {
    __fitil: Fitil;
  }
}

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

/** Touch real prin CDP: `points` = degetele apăsate în acest moment. */
async function touch(
  cdp: CDPSession,
  type: 'touchStart' | 'touchMove' | 'touchEnd',
  points: { x: number; y: number; id: number }[],
) {
  await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
}

test('pornește în meniul principal fără erori', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await expect(page.locator('[data-test=play]')).toBeVisible();
  await expect(page.locator('#game canvas')).toBeVisible();
  expect(errors).toEqual([]);
});

for (const view of ['2d', 'fps', 'chase'] as const) {
  test(`Practice 30s în vederea ${view}, cu joystick + tap prin touch`, async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/');
    await page.waitForFunction(() => window.__fitil);
    await page.evaluate((v) => window.__fitil.app.setView(v, false), view);
    // intră în Practice din interfață
    await page.locator('[data-test=practice]').tap();
    await page.locator('[data-test=dummies]').tap();
    await expect.poll(() => page.evaluate(() => window.__fitil.app.match !== null)).toBe(true);
    const cdp = await page.context().newCDPSession(page);
    const { width, height } = page.viewportSize()!;
    const joy = { x: width * 0.2, y: height * 0.6, id: 1 };
    const tapAt = view === '2d' ? { x: width * 0.8, y: height * 0.5 } : { x: width * 0.75, y: height * 0.6 };
    const start = await page.evaluate(() => {
      const me = (window.__fitil.app.match as unknown as { me: { px: number; py: number } }).me;
      return [me.px, me.py];
    });
    let moved = false;
    let bombs = false;
    const t0 = Date.now();
    let i = 0;
    while (Date.now() - t0 < 30_000) {
      // joystick: apare sub deget și merge într-o direcție care se schimbă
      const a = (i % 8) * (Math.PI / 4);
      await touch(cdp, 'touchStart', [joy]);
      await touch(cdp, 'touchMove', [{ ...joy, x: joy.x + Math.cos(a) * 40, y: joy.y + Math.sin(a) * 40 }]);
      await page.waitForTimeout(400);
      // al doilea deget: tap = bombă (în 3D, butonul BOMBĂ), cât joystick-ul e ținut
      const held = { ...joy, x: joy.x + Math.cos(a) * 40, y: joy.y + Math.sin(a) * 40 };
      await touch(cdp, 'touchStart', [held, { ...tapAt, id: 2 }]);
      await touch(cdp, 'touchEnd', [held]);
      await page.waitForTimeout(300);
      await touch(cdp, 'touchEnd', []);
      const st = await page.evaluate(() => {
        const m = window.__fitil.app.match as unknown as {
          me: { px: number; py: number };
          s: { bombs: { owner: number }[] };
        };
        return { p: [m.me.px, m.me.py], b: m.s.bombs.some((b) => b.owner === 0) };
      });
      moved ||= st.p[0] !== start[0] || st.p[1] !== start[1];
      bombs ||= st.b;
      i++;
    }
    const st = await page.evaluate(() => ({
      tick: window.__fitil.app.match!.s.tick,
      view: window.__fitil.app.view,
    }));
    expect(st.view).toBe(view);
    expect(moved).toBe(true);
    expect(bombs).toBe(true);
    expect(st.tick).toBeGreaterThan(20 * 25); // simularea a mers ~30s
    expect(errors).toEqual([]);
  });
}

test('FPS cu CPU throttling 4x (2D ≥ 55, 3D ≥ 45)', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await page.waitForFunction(() => window.__fitil);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const res: Record<string, number> = {};
  for (const view of ['2d', 'fps', 'chase']) {
    await page.evaluate(async (v) => {
      await window.__fitil.app.setView(v, false);
      window.__fitil.app.start({ type: 'mode', mode: 'ffa' });
    }, view);
    await page.waitForTimeout(2500);
    const samples: number[] = [];
    for (let k = 0; k < 8; k++) {
      await page.waitForTimeout(600);
      samples.push(await page.evaluate(() => window.__fitil.scene.fps));
    }
    samples.sort((a, b) => a - b);
    res[view] = Math.round(samples[Math.floor(samples.length / 2)]!);
  }
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  mkdirSync('test-results', { recursive: true });
  writeFileSync('test-results/fps.json', JSON.stringify(res, null, 2));
  console.log('FPS (CPU 4x):', res);
  expect(res['2d']).toBeGreaterThanOrEqual(55);
  expect(res.fps).toBeGreaterThanOrEqual(45);
  expect(res.chase).toBeGreaterThanOrEqual(45);
  expect(errors).toEqual([]);
});
