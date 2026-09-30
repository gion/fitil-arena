import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { SHOP, SHOP_CATS } from '@fitil/content';

type Win = {
  __fitil: {
    app: {
      start(k: unknown): void;
      match: {
        meId: number;
        slots: { ch: string | null; outfit: Record<string, string | null> | null }[];
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

test('magazin: câte un obiect din fiecare categorie se cumpără și se echipează', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('fitil-profile', JSON.stringify({ coins: 5000 }));
  });
  await page.reload();
  await expect(page.locator('[data-test=coins]')).toHaveText('5000');
  await page.locator('[data-test=shop]').click();
  let coins = 5000;
  for (const cat of SHOP_CATS) {
    const it = SHOP.find((i) => i.cat === cat && i.price > 0 && !i.unlock)!;
    await page.locator(`[data-cat=${cat}]`).click();
    await page.locator(`[data-item=${it.id}]`).click();
    coins -= it.price;
    await expect(page.locator(`[data-item=${it.id}]`)).toHaveClass(/\beq\b/);
    await expect(page.locator('[data-test=coins]')).toHaveText(String(coins));
  }
  // scoaterea: al doilea tap pe un obiect purtat îl scoate
  await page.locator('[data-cat=hat]').click();
  const hat = SHOP.find((i) => i.cat === 'hat' && i.price > 0)!.id;
  await page.locator(`[data-item=${hat}]`).click();
  await expect(page.locator(`[data-item=${hat}]`)).not.toHaveClass(/\beq\b/);
  // persistență după reîncărcare
  await page.reload();
  await expect(page.locator('[data-test=coins]')).toHaveText(String(coins));
  expect(errors).toEqual([]);
});

test('personaje: pagina personajului, cumpărare, meci cu personajul ales și recompense', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('fitil-profile', JSON.stringify({ coins: 700 }));
  });
  await page.reload();
  await page.locator('[data-test=characters]').click();
  await expect(page.locator('.ccard')).toHaveCount(11);
  await page.locator('[data-char=fifi]').click();
  await expect(page.locator('.proscons .pros li').first()).toBeVisible();
  await page.locator('[data-test=listen]').click();
  await page.locator('[data-test=buy-char]').click();
  await expect(page.locator('[data-test=coins]')).toHaveText('100');
  // Magicianul e prea scump
  await page.getByRole('button', { name: 'Back' }).click();
  await page.locator('[data-char=magician]').click();
  await expect(page.locator('[data-test=buy-char]')).toBeDisabled();

  await page.evaluate(() => (window as unknown as Win).__fitil.app.start({ type: 'mode', mode: 'ffa' }));
  await page.waitForTimeout(800);
  const me = await page.evaluate(() => {
    const m = (window as unknown as Win).__fitil.app.match!;
    return m.slots[m.meId]!.ch;
  });
  expect(me).toBe('fifi');
  // meciul se termină: adversarii „cad” (în simulare) și apare cardul cu recompensele
  await page.evaluate(() => {
    const m = (window as unknown as Win).__fitil.app.match!;
    for (const p of m.s.players.slice(1)) {
      p.alive = false;
      p.deathTick = m.s.tick;
    }
  });
  await expect(page.locator('[data-test=rewards]')).toBeVisible({ timeout: 8000 });
  await expect(page.locator('[data-test=rewards]')).toContainText('XP Fifi');
  expect(errors).toEqual([]);
});
