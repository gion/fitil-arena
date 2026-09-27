import { DIRS, DX, DY, EMPTY, HARD, SOFT, U } from './types.ts';
import type { Bomb, GameState, Player } from './types.ts';

export const idx = (s: GameState, x: number, y: number): number => y * s.W + x;
export const inBounds = (s: GameState, x: number, y: number): boolean =>
  x >= 0 && y >= 0 && x < s.W && y < s.H;
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

/** Marchează în `out` pătrățelele atinse de o explozie (cruce oprită de ziduri; lăzile opresc flacăra). */
export function blast(s: GameState, x: number, y: number, range: number, out: Uint8Array): void {
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
