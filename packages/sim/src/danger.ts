import { FLAME, SHIFT_STEP } from './constants.ts';
import { blast, idx, inBounds, mobX, mobY } from './grid.ts';
import { shuffle } from './rng.ts';
import type { RngState } from './rng.ts';
import { DIRS, DX, DY } from './types.ts';
import type { Dir, GameState } from './types.ts';

/**
 * Pericolele de mediu: zona de fulger a norilor care se încarcă, rândul mobil anunțat,
 * păianjenii și vecinii lor. `fn(k, start, end)` — de când și până când e periculos pătrățelul.
 */
export function forHazards(s: GameState, fn: (k: number, start: number, end: number) => void): void {
  for (const c of s.clouds) {
    if (c.charge < 0) continue;
    for (const [dx, dy] of CROSS) {
      const x = c.sx + dx;
      const y = c.sy + dy;
      if (inBounds(s, x, y) && s.grid[idx(s, x, y)] !== 1) fn(idx(s, x, y), c.charge, c.charge + FLAME);
    }
  }
  const sh = s.shift;
  if (sh) {
    const end = sh.warn + (sh.steps + 1) * SHIFT_STEP;
    if (sh.axis === 0) for (let x = 1; x < s.W - 1; x++) fn(idx(s, x, sh.idx), sh.warn, end);
    else for (let y = 1; y < s.H - 1; y++) fn(idx(s, sh.idx, y), sh.warn, end);
  }
  for (const c of s.spiders)
    for (const [dx, dy] of CROSS) {
      const x = mobX(c) + dx;
      const y = mobY(c) + dy;
      if (inBounds(s, x, y)) fn(idx(s, x, y), 0, 30);
    }
}

const CROSS: readonly [number, number][] = [
  [0, 0],
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
];

/** Pătrățelele care vor fi (sau sunt) în flăcări: raza bombelor de pe jos, flăcările active și pericolele de mediu. */
export function computeDanger(s: GameState): Uint8Array {
  const d = new Uint8Array(s.W * s.H);
  for (const b of s.bombs) if (b.held === null && b.fly === null) blast(s, b.x, b.y, b.range, d);
  for (let i = 0; i < d.length; i++) if (s.flame[i]! > 0) d[i] = 1;
  forHazards(s, (k) => (d[k] = 1));
  return d;
}

/** Căutare în lățime; întoarce prima direcție spre cel mai apropiat pătrățel care satisface `goal`. */
export function bfs(
  s: GameState,
  rng: RngState,
  sx: number,
  sy: number,
  pass: (x: number, y: number) => boolean,
  goal: (x: number, y: number) => boolean,
  limit = 1600,
): Dir | null {
  const seen = new Uint8Array(s.W * s.H);
  seen[idx(s, sx, sy)] = 1;
  const order = shuffle(rng, DIRS.slice());
  const qx: number[] = [];
  const qy: number[] = [];
  const qd: Dir[] = [];
  for (const d of order) {
    const nx = sx + DX[d]!;
    const ny = sy + DY[d]!;
    if (inBounds(s, nx, ny) && pass(nx, ny) && !seen[idx(s, nx, ny)]) {
      seen[idx(s, nx, ny)] = 1;
      qx.push(nx);
      qy.push(ny);
      qd.push(d);
    }
  }
  for (let h = 0; h < qx.length && h < limit; h++) {
    const x = qx[h]!;
    const y = qy[h]!;
    if (goal(x, y)) return qd[h]!;
    for (const e of order) {
      const nx = x + DX[e]!;
      const ny = y + DY[e]!;
      if (inBounds(s, nx, ny) && pass(nx, ny) && !seen[idx(s, nx, ny)]) {
        seen[idx(s, nx, ny)] = 1;
        qx.push(nx);
        qy.push(ny);
        qd.push(qd[h]!);
      }
    }
  }
  return null;
}

export const NEVER = 1 << 30;

export interface DangerTimes {
  /** Peste câte tick-uri ajunge flacăra pe pătrățel (0 = arde acum, NEVER = niciodată). */
  start: Int32Array;
  /** Tick-ul (relativ) la care pătrățelul redevine sigur. */
  end: Int32Array;
}

interface PendingBomb {
  x: number;
  y: number;
  range: number;
  t: number;
}

function forBlast(s: GameState, b: PendingBomb, fn: (k: number) => void): void {
  fn(idx(s, b.x, b.y));
  for (const d of DIRS)
    for (let i = 1; i <= b.range; i++) {
      const nx = b.x + DX[d]! * i;
      const ny = b.y + DY[d]! * i;
      if (!inBounds(s, nx, ny)) break;
      const g = s.grid[idx(s, nx, ny)];
      if (g === 1) break;
      fn(idx(s, nx, ny));
      if (g === 2) break;
    }
}

/**
 * Hartă de pericol cu timp: ține cont de fitilul fiecărei bombe și de lanțuri
 * (o bombă prinsă în raza alteia explodează la 1 tick după ea). `extra` = o bombă ipotetică.
 */
export function dangerTimes(
  s: GameState,
  extra?: { x: number; y: number; range: number; fuse: number },
): DangerTimes {
  const N = s.W * s.H;
  const start = new Int32Array(N).fill(NEVER);
  const end = new Int32Array(N).fill(0);
  const list: PendingBomb[] = [];
  for (const b of s.bombs)
    if (b.held === null && b.fly === null) list.push({ x: b.x, y: b.y, range: b.range, t: b.fuse });
  if (extra) list.push({ x: extra.x, y: extra.y, range: extra.range, t: extra.fuse });
  // relaxare: lanțurile pot doar grăbi exploziile
  const at = new Map<number, PendingBomb>();
  for (const b of list) at.set(idx(s, b.x, b.y), b);
  for (let changed = true, guard = 0; changed && guard < 64; guard++) {
    changed = false;
    for (const b of list)
      forBlast(s, b, (k) => {
        const o = at.get(k);
        if (o && o !== b && o.t > b.t + 1) {
          o.t = b.t + 1;
          changed = true;
        }
      });
  }
  for (const b of list)
    forBlast(s, b, (k) => {
      if (b.t < start[k]!) start[k] = b.t;
      end[k] = Math.max(end[k]!, b.t + 11);
    });
  for (let k = 0; k < N; k++)
    if (s.flame[k]! > 0) {
      start[k] = 0;
      end[k] = Math.max(end[k]!, s.flame[k]!);
    }
  forHazards(s, (k, a, b) => {
    start[k] = Math.min(start[k]!, a);
    end[k] = Math.max(end[k]!, b);
  });
  return { start, end };
}

/**
 * Drum de scăpare cu timp: un pătrățel poate fi traversat doar dacă nu arde cât timp ești pe el.
 * `tpt` = tick-uri pe pătrățel. Țintă: un pătrățel care nu va arde deloc.
 */
export function escapeRoute(
  s: GameState,
  rng: RngState,
  sx: number,
  sy: number,
  tpt: number,
  dz: DangerTimes,
  pass: (x: number, y: number) => boolean,
): Dir | null {
  const N = s.W * s.H;
  const best = new Int32Array(N).fill(NEVER);
  best[idx(s, sx, sy)] = 0;
  const order = shuffle(rng, DIRS.slice());
  const qx = [sx];
  const qy = [sy];
  const qt = [0];
  const qd: (Dir | null)[] = [null];
  for (let h = 0; h < qx.length && h < 1600; h++) {
    const x = qx[h]!;
    const y = qy[h]!;
    const t = qt[h]!;
    const k = idx(s, x, y);
    if (h > 0 && dz.start[k] === NEVER) return qd[h]!;
    for (const d of order) {
      const nx = x + DX[d]!;
      const ny = y + DY[d]!;
      if (!inBounds(s, nx, ny) || !pass(nx, ny)) continue;
      const nk = idx(s, nx, ny);
      const arrive = t + tpt;
      // ocupi pătrățelul aproximativ între [arrive - tpt/2, arrive + tpt/2 + 1]
      const enter = arrive - (tpt >> 1);
      const leave = arrive + (tpt >> 1) + 1;
      const burns = dz.start[nk]! <= leave && enter < dz.end[nk]!;
      if (burns || arrive >= best[nk]!) continue;
      best[nk] = arrive;
      qx.push(nx);
      qy.push(ny);
      qt.push(arrive);
      qd.push(h === 0 ? d : qd[h]!);
    }
  }
  return null;
}
