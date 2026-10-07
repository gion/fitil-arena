import { BURST_CAP } from './constants.ts';
import { DIRS, DX, DY, EMPTY, HARD, SOFT, U } from './types.ts';
import type { Bomb, GameState, Player } from './types.ts';

/**
 * Indexul unui pătrățel în stocare. În lumea infinită stocarea e un șir de chunk-uri 32×32
 * (`world.ts`): slotul chunk-ului × 1024 + poziția în chunk; ce nu e încărcat cade în slotul 0 (vid, perete).
 */
export function idx(s: GameState, x: number, y: number): number {
  const w = s.inf;
  if (!w) return y * s.W + x;
  const slot = w.slots[((x >> 5) + 0x8000) * 0x10000 + ((y >> 5) + 0x8000)] ?? 0;
  return (slot << 10) | ((y & 31) << 5) | (x & 31);
}

/** Pătrățelul există (în lumea infinită: chunk-ul lui e încărcat). */
export function inBounds(s: GameState, x: number, y: number): boolean {
  const w = s.inf;
  if (!w) return x >= 0 && y >= 0 && x < s.W && y < s.H;
  return w.slots[((x >> 5) + 0x8000) * 0x10000 + ((y >> 5) + 0x8000)] !== undefined;
}
export const tileAt = (s: GameState, x: number, y: number): number =>
  inBounds(s, x, y) ? s.grid[idx(s, x, y)]! : HARD;

/** Pătrățelul pe care stă jucătorul (poziția rotunjită). */
export const tileX = (p: Player): number => Math.floor((p.px + U / 2) / U);
export const tileY = (p: Player): number => Math.floor((p.py + U / 2) / U);

/** Pătrățelul unei entități cu poziție în unități (păianjeni, nori). */
export const mobX = (m: { px: number }): number => Math.floor((m.px + U / 2) / U);
export const mobY = (m: { py: number }): number => Math.floor((m.py + U / 2) / U);

/** Bomba „de pe jos” de pe un pătrățel (nu cea ținută în mână sau în zbor). */
export function bombAt(s: GameState, x: number, y: number): Bomb | undefined {
  for (const b of s.bombs) if (b.x === x && b.y === y && b.held === null && b.fly === null) return b;
  return undefined;
}

export const walkable = (s: GameState, x: number, y: number): boolean =>
  tileAt(s, x, y) === EMPTY && !bombAt(s, x, y);

export function playerAt(s: GameState, x: number, y: number): Player | undefined {
  for (const p of s.players) if (p.alive && tileX(p) === x && tileY(p) === y) return p;
  return undefined;
}

export const padIndex = (s: GameState, x: number, y: number): number =>
  s.pads.findIndex(([px, py]) => px === x && py === y);

/** Raza ariei unei bombe în arie, din raza ei de cruce. */
export const burstRadius = (range: number): number => Math.min(range + 1, BURST_CAP);

/**
 * Pătrățelele unei arii de rază `r`: cele de la cel mult `r` pe orizontală și pe verticală, la care
 * flăcara ajunge mergând cel mult `2r` pași printre pătrățele libere. Stâlpii și zidurile o opresc
 * (ocolește colțurile), lăzile sunt lovite dar o opresc. Ordinea e deterministă (lățime).
 */
export function areaTiles(s: GameState, x: number, y: number, r: number): [number, number][] {
  const out: [number, number][] = [[x, y]];
  const seen = new Set<number>([idx(s, x, y)]);
  const qx = [x];
  const qy = [y];
  const qd = [0];
  for (let h = 0; h < qx.length; h++) {
    if (qd[h]! >= 2 * r) continue;
    const cx = qx[h]!;
    const cy = qy[h]!;
    // un pătrățel cu ladă primește flacăra, dar n-o mai trece mai departe
    if (h > 0 && tileAt(s, cx, cy) === SOFT) continue;
    for (const d of DIRS) {
      const nx = cx + DX[d]!;
      const ny = cy + DY[d]!;
      if (Math.abs(nx - x) > r || Math.abs(ny - y) > r || tileAt(s, nx, ny) === HARD) continue;
      const k = idx(s, nx, ny);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push([nx, ny]);
      qx.push(nx);
      qy.push(ny);
      qd.push(qd[h]! + 1);
    }
  }
  return out;
}

/** Marchează în `out` pătrățelele atinse de o explozie (cruce oprită de ziduri; lăzile opresc flacăra). `area` > 0: explozie în arie. */
export function blast(s: GameState, x: number, y: number, range: number, out: Uint8Array, area = 0): void {
  if (area > 0) {
    for (const [ax, ay] of areaTiles(s, x, y, area)) out[idx(s, ax, ay)] = 1;
    return;
  }
  out[idx(s, x, y)] = 1;
  for (const d of DIRS) {
    for (let i = 1; i <= range; i++) {
      const nx = x + DX[d]! * i;
      const ny = y + DY[d]! * i;
      const g = tileAt(s, nx, ny);
      if (g === HARD) break;
      out[idx(s, nx, ny)] = 1;
      if (g === SOFT) break;
    }
  }
}

export const countSoft = (s: GameState): number => s.grid.reduce((n, g) => n + (g === SOFT ? 1 : 0), 0);

export const getPlayer = (s: GameState, id: number): Player => {
  const p = s.players[id];
  if (!p) throw new Error(`jucător inexistent: ${id}`);
  return p;
};

export const getBomb = (s: GameState, id: number): Bomb | undefined => s.bombs.find((b) => b.id === id);
