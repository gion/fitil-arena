import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { CHARACTERS, CHAR_RELEASE, SHOP, SHOP_CATS, weeklyRotation } from '@fitil/content';

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

/** Data fixă a testelor: calendarul și rotația săptămânală nu depind de ziua rulării. */
const DATE = '2026-10-07';
const fixDate = (page: Page) => page.clock.setFixedTime(new Date(`${DATE}T12:00:00`));
// un Epic lansat care nu e gratuit săptămâna asta (altfel nu s-ar cumpăra)
const EPIC = CHARACTERS.find(
  (c) => c.rarity === 'epic' && !CHAR_RELEASE[c.id] && !weeklyRotation(DATE).includes(c.id),
)!;

test('personaje: pagina personajului, cumpărare, meci cu personajul ales și recompense', async ({ page }) => {
  const errors = watchErrors(page);
  await fixDate(page);
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    // nivel de jucător mare: Epicele cer nivelul 6
    localStorage.setItem('fitil-profile', JSON.stringify({ coins: 700, xp: { bubu: 3000 } }));
  });
  await page.reload();
  await page.locator('[data-test=characters]').click();
  await expect(page.locator('.ccard')).toHaveCount(11);
  await page.locator(`[data-char=${EPIC.id}]`).click();
  await expect(page.locator('.proscons .pros li').first()).toBeVisible();
  await page.locator('[data-test=listen]').click();
  await page.locator('[data-test=buy-char]').click();
  await expect(page.locator('[data-test=coins]')).toHaveText('100');
  // Magicianul nu e lansat încă: doar teaser
  await page.getByRole('button', { name: 'Back' }).click();
  await page.locator('[data-char=magician]').click();
  await expect(page.locator('[data-test=soon]')).toBeDisabled();
  await expect(page.locator('[data-test=buy-char]')).toHaveCount(0);

  await page.evaluate(() => (window as unknown as Win).__fitil.app.start({ type: 'mode', mode: 'ffa' }));
  await page.waitForTimeout(800);
  const me = await page.evaluate(() => {
    const m = (window as unknown as Win).__fitil.app.match!;
    return m.slots[m.meId]!.ch;
  });
  expect(me).toBe(EPIC.id);
  // meciul se termină: adversarii „cad” (în simulare) și apare cardul cu recompensele
  await page.evaluate(() => {
    const m = (window as unknown as Win).__fitil.app.match!;
    for (const p of m.s.players.slice(1)) {
      p.alive = false;
      p.deathTick = m.s.tick;
    }
  });
  await expect(page.locator('[data-test=rewards]')).toBeVisible({ timeout: 8000 });
  await expect(page.locator('[data-test=rewards]')).toContainText(`XP ${EPIC.name}`);
  expect(errors).toEqual([]);
});

test('jucător nou: puține lucruri deschise, restul cu lacăt; nivelul deschide moduri', async ({ page }) => {
  const errors = watchErrors(page);
  await fixDate(page);
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('[data-test=player-level]')).toContainText('Player Lv 1');
  // panoul DEV nu există în build-ul public
  await expect(page.locator('[data-test=dev]')).toHaveCount(0);
  await page.locator('[data-test=play]').click();
  await expect(page.locator('[data-mode=ffa]')).toBeEnabled();
  for (const m of ['vs', 'team2', 'ctf']) await expect(page.locator(`[data-mode=${m}]`)).toBeDisabled();
  await expect(page.locator('[data-mode=ctf]')).toContainText('Player Lv 5');
  await page.getByRole('button', { name: 'Back' }).click();

  // personaje: cele din rotație sunt gratuite săptămâna asta, Epicele cer nivel, cele nelansate sunt teaser
  await page.locator('[data-test=characters]').click();
  for (const id of weeklyRotation(DATE))
    await expect(page.locator(`[data-char=${id}]`)).toContainText('Free this week');
  await expect(page.locator(`[data-char=${EPIC.id}]`)).toContainText('Player Lv 6');
  await expect(page.locator('[data-char=ghost]')).toContainText('Coming in 17 days');
  await expect(page.locator('[data-char=ghost]')).toContainText('???');
  await page.getByRole('button', { name: 'Back' }).click();

  // teme: Clasic și Neon deschise, Junglă cu nivel, Halloween gratuită acum (e în perioadă), Crăciun de cumpărat
  await page.locator('[data-test=themes]').click();
  await expect(page.locator('[data-theme=neon]')).toBeEnabled();
  await expect(page.locator('[data-theme=jungla]')).toBeDisabled();
  await expect(page.locator('[data-theme=halloween]')).toContainText('free now');
  await expect(page.locator('[data-theme=craciun]')).toContainText('300 Fitile');

  // la nivelul 2 se deschide 1 vs 1
  await page.evaluate(() => localStorage.setItem('fitil-profile', JSON.stringify({ xp: { bubu: 120 } })));
  await page.reload();
  await page.locator('[data-test=play]').click();
  await expect(page.locator('[data-mode=vs]')).toBeEnabled();
  await expect(page.locator('[data-mode=team2]')).toBeDisabled();
  expect(errors).toEqual([]);
});
