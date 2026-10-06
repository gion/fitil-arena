import { idx, mobX, mobY, tileX, tileY } from './grid.ts';
import { deriveRng, nextFloat } from './rng.ts';
import { EMPTY, HARD, SOFT } from './types.ts';
import type { GameState } from './types.ts';

/** Latura stocării circulare (putere a lui 2). */
export const INF_S = 64;
/** Raza ferestrei generate în jurul jucătorului. */
export const INF_R = 26;
/** Bombele și păianjenii mai departe de atât de cameră dispar. */
const KEEP_BOMB = 28;
const KEEP_MOB = 30;

/** Zgomot determinist din (seed, x, y): aceeași coordonată → mereu aceeași valoare. */
export const cellHash = (seed: number, x: number, y: number, salt: number): number =>
  nextFloat(deriveRng(seed, x, y, salt));

/** Celula generată la (x, y), fără modificările jocului: stâlpi pe pozițiile pare, start liber, lăzi din hash. */
export function genCell(s: GameState, x: number, y: number): { g: number; gold: boolean; cursed: boolean } {
  if ((x & 1) === 0 && (y & 1) === 0) return { g: HARD, gold: false, cursed: false };
  if (Math.abs(x - 1) <= 1 && Math.abs(y - 1) <= 1) return { g: EMPTY, gold: false, cursed: false };
  if (cellHash(s.seed, x, y, 11) >= s.rules.softDensity) return { g: EMPTY, gold: false, cursed: false };
  const r = cellHash(s.seed, x, y, 12);
  const gold = r < s.rules.goldRate;
  return { g: SOFT, gold, cursed: !gold && r < s.rules.goldRate + s.rules.curseRate };
}

/**
 * Asigură că celula (x, y) e în stocare. Dacă locul din stocare era ocupat de altă coordonată,
 * celula e regenerată din hash; țintele misiunii își păstrează starea (spartă, luată, distrusă).
 */
export function ensureCell(s: GameState, x: number, y: number): void {
  const w = s.inf!;
  const k = idx(s, x, y);
  if (w.ownX[k] === x && w.ownY[k] === y) return;
  w.ownX[k] = x;
  w.ownY[k] = y;
  const c = genCell(s, x, y);
  s.grid[k] = c.g;
  s.gold[k] = c.gold ? 1 : 0;
  s.cursed[k] = c.cursed ? 1 : 0;
  s.flame[k] = 0;
  s.flameOwner[k] = -1;
  s.flameVia[k] = 0;
  s.items[k] = null;
  s.drops[k] = null;
  const m = s.mission;
  const ti = m?.tmap[`${x},${y}`];
  if (m && ti !== undefined) {
    const t = m.targets[ti]!;
    s.gold[k] = 0;
    s.cursed[k] = 0;
    s.grid[k] = t.type !== 'flag' && !t.done && !t.open ? SOFT : EMPTY;
    if (t.type === 'crystal' && t.open && !t.done) s.items[k] = 'crystal';
  }
}

export function ensureWindow(s: GameState, cx: number, cy: number, R = INF_R): void {
  for (let y = cy - R; y <= cy + R; y++) for (let x = cx - R; x <= cx + R; x++) ensureCell(s, x, y);
  s.inf!.cx = cx;
  s.inf!.cy = cy;
}

/** Regenerează toată fereastra (ex. după ce s-au pus țintele misiunii). */
export function resetWindow(s: GameState): void {
  const w = s.inf!;
  w.ownX.fill(0x7fffffff);
  w.ownY.fill(0x7fffffff);
  ensureWindow(s, w.cx, w.cy);
}

/** Camera urmărește jucătorul: fereastra se regenerează în jur, iar ce rămâne departe dispare. */
export function updateWorld(s: GameState): void {
  const w = s.inf;
  if (!w) return;
  const p = s.players[0];
  if (p?.alive) {
    const cx = tileX(p);
    const cy = tileY(p);
    if (cx !== w.cx || cy !== w.cy) ensureWindow(s, cx, cy);
  }
  const far = (x: number, y: number, r: number) => (x - w.cx) ** 2 + (y - w.cy) ** 2 > r * r;
  if (s.bombs.length)
    s.bombs = s.bombs.filter((b) => {
      if (b.held !== null || b.fly || !far(b.x, b.y, KEEP_BOMB)) return true;
      const o = s.players[b.owner];
      if (o && !b.free) o.active = Math.max(0, o.active - 1);
      return false;
    });
  if (s.spiders.length) s.spiders = s.spiders.filter((c) => !far(mobX(c), mobY(c), KEEP_MOB));
  if (s.clouds.length) s.clouds = s.clouds.filter((c) => !far(mobX(c), mobY(c), KEEP_MOB));
}
