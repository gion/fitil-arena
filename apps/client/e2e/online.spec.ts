import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

type Win = {
  __fitil: {
    app: {
      phase: string;
      match: {
        meId: number;
        s: { tick: number; rules: { mode: string } };
        net: { desyncs: number; auth: { tick: number } | null };
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

const state = (page: Page) =>
  page.evaluate(() => {
    const m = (window as unknown as Win).__fitil.app.match;
    return m && { me: m.meId, tick: m.s.tick, mode: m.s.rules.mode, desyncs: m.net.desyncs };
  });

test('online: gazda creează camera, al doilea jucător intră cu codul, meciul pornește la amândoi', async ({
  browser,
}) => {
  const host = await (await browser.newContext()).newPage();
  const guest = await (await browser.newContext()).newPage();
  const errors = [...watchErrors(host), ...watchErrors(guest)];

  await host.goto('/');
  await host.locator('[data-test=online]').click();
  await host.locator('[data-test=name]').fill('Host');
  await host.locator('[data-test=create]').click();
  const code = (await host.locator('[data-test=room-code]').textContent())!.trim();
  expect(code).toMatch(/^[A-Z]{4}$/);

  await guest.goto('/');
  await guest.locator('[data-test=online]').click();
  await guest.locator('[data-test=name]').fill('Guest');
  await guest.locator('[data-test=code]').fill(code.toLowerCase());
  await guest.locator('[data-test=join]').click();
  await expect(guest.locator('.seats li')).toHaveCount(2);
  await expect(host.locator('.seats li')).toHaveCount(2);
  // doar gazda are butonul Start și poate schimba modul
  await expect(guest.locator('[data-test=start]')).toHaveCount(0);
  await host.locator('[data-mode=team2]').click();
  await expect(guest.locator('[data-mode=team2]')).toHaveAttribute('aria-pressed', 'true');

  await host.locator('[data-test=start]').click();
  await expect.poll(async () => (await state(guest))?.tick ?? 0, { timeout: 10_000 }).toBeGreaterThan(40);
  const [a, b] = [await state(host), await state(guest)];
  expect(a!.mode).toBe('teams');
  expect(b!.mode).toBe('teams');
  // pe echipe oamenii se împart: gazda la albaștri (0), al doilea la roșii (2)
  expect([a!.me, b!.me]).toEqual([0, 2]);

  // gazda se mișcă: poziția ei se schimbă și la oaspete
  const pos = (page: Page) =>
    page.evaluate(() => {
      const m = (window as unknown as Win).__fitil.app.match as unknown as {
        s: { players: { px: number; py: number }[] };
      };
      const p = m.s.players[0]!;
      return p.px + p.py * 1000;
    });
  const before = await pos(guest);
  await host.keyboard.down('ArrowDown');
  await host.waitForTimeout(700);
  await host.keyboard.up('ArrowDown');
  await host.keyboard.down('ArrowRight');
  await host.waitForTimeout(700);
  await host.keyboard.up('ArrowRight');
  await expect.poll(() => pos(guest), { timeout: 5000 }).not.toBe(before);

  expect((await state(host))!.desyncs).toBe(0);
  expect((await state(guest))!.desyncs).toBe(0);
  expect(errors).toEqual([]);
});
