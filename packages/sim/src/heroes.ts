import { newBomb, effectiveRange } from './actions.ts';
import {
  BIG_EXTRA,
  DASH_TILES,
  MAX_RANGE,
  PURSE_MAX,
  PURSE_MIN,
  STICKY_FUSE,
  SUPER_FULL,
  TIME_STOP,
  WARP_MIN,
} from './constants.ts';
import { computeDanger } from './danger.ts';
import { bombAt, idx, inBounds, padIndex, playerAt, tileAt, tileX, tileY, walkable } from './grid.ts';
import { nextInt } from './rng.ts';
import { DIRS, DX, DY, EMPTY, U } from './types.ts';
import type { GameState, Player } from './types.ts';

/** Mută jucătorul direct pe un pătrățel (dash, teleport). */
function placeAt(p: Player, x: number, y: number): void {
  p.px = x * U;
  p.py = y * U;
  p.fx = p.tx = x;
  p.fy = p.ty = y;
  p.moving = false;
}

const freeTile = (s: GameState, x: number, y: number): boolean =>
  inBounds(s, x, y) && tileAt(s, x, y) === EMPTY && !bombAt(s, x, y) && s.flame[idx(s, x, y)]! <= 0;

/** Bubu: o bombă mare (rază +2) la picioare, în plus față de bombele lui. */
function bigBomb(s: GameState, p: Player): boolean {
  const x = tileX(p);
  const y = tileY(p);
  if (bombAt(s, x, y) || s.flame[idx(s, x, y)]! > 0) return false;
  newBomb(s, p.id, x, y, Math.min(MAX_RANGE + BIG_EXTRA, effectiveRange(s, p) + BIG_EXTRA), { free: true });
  return true;
}

/** Zuzu: țâșnește până la 3 pătrățele în direcția privirii (se oprește la obstacole și jucători). */
function dash(s: GameState, p: Player): boolean {
  let x = tileX(p);
  let y = tileY(p);
  let n = 0;
  for (let i = 0; i < DASH_TILES; i++) {
    const nx = x + DX[p.face]!;
    const ny = y + DY[p.face]!;
    if (!walkable(s, nx, ny) || playerAt(s, nx, ny)) break;
    x = nx;
    y = ny;
    n++;
  }
  if (!n) return false;
  placeAt(p, x, y);
  p.dir = p.face;
  s.events.push({ type: 'dash', player: p.id, x, y });
  return true;
}

/** Gogu: șutează o bombă lipicioasă; se lipește de primul jucător pe care îl atinge (fitil 1.5s). */
function sticky(s: GameState, p: Player): boolean {
  const x = tileX(p) + DX[p.face]!;
  const y = tileY(p) + DY[p.face]!;
  const victim = playerAt(s, x, y);
  if (!victim && !walkable(s, x, y)) return false;
  if (victim && bombAt(s, x, y)) return false;
  const b = newBomb(s, p.id, x, y, effectiveRange(s, p), { free: true, sticky: true });
  b.via = 1;
  if (victim) {
    b.stuck = victim.id;
    b.sticky = false;
    b.fuse = Math.min(b.fuse, STICKY_FUSE);
    s.events.push({ type: 'stick', bomb: b.id, player: victim.id });
  } else {
    b.slide = p.face;
    b.prog = 0;
  }
  return true;
}

/** Fifi: până la 4 mini-bombe (rază 1) în cruce, la 2 pătrățele (doar pe direcțiile libere). */
function cluster(s: GameState, p: Player): boolean {
  const cx = tileX(p);
  const cy = tileY(p);
  let n = 0;
  for (const d of DIRS) {
    // doar la exact 2 pătrățele: o mini-bombă mai aproape ar ajunge cu flacăra la Fifi
    if (!freeTile(s, cx + DX[d]!, cy + DY[d]!) || !freeTile(s, cx + DX[d]! * 2, cy + DY[d]! * 2)) continue;
    newBomb(s, p.id, cx + DX[d]! * 2, cy + DY[d]! * 2, 1, { free: true });
    n++;
  }
  return n > 0;
}

/** Tanti Veta: poșeta aruncă o bombă departe (4–9 pătrățele), peste ziduri, fără să iasă din arenă. */
function purse(s: GameState, p: Player): boolean {
  const sx = tileX(p);
  const sy = tileY(p);
  const dir = p.face;
  for (let steps = PURSE_MAX; steps >= PURSE_MIN; steps--) {
    const x = sx + DX[dir]! * steps;
    const y = sy + DY[dir]! * steps;
    if (!freeTile(s, x, y)) continue;
    const b = newBomb(s, p.id, x, y, effectiveRange(s, p), { free: true });
    b.via = 2;
    b.fly = { sx, sy, dir, steps, t: 0, dur: Math.round((36 + 12 * steps) / 10) };
    s.events.push({ type: 'throw', player: p.id, bomb: b.id });
    return true;
  }
  return false;
}

/** Maestrul Fitil: 1.5s în care bombele celorlalți stau pe loc (fitil și alunecare). */
function timeStop(s: GameState, p: Player): boolean {
  s.timeStop = { owner: p.id, t: TIME_STOP };
  s.events.push({ type: 'timeStop', owner: p.id });
  return true;
}

/** Robo-Mici: teleport pe portalul mai îndepărtat sau, fără portaluri, pe un loc sigur departe. */
function warp(s: GameState, p: Player): boolean {
  const cx = tileX(p);
  const cy = tileY(p);
  const dist = (x: number, y: number) => Math.abs(x - cx) + Math.abs(y - cy);
  if (s.pads.length) {
    const [a, b] = s.pads as [[number, number], [number, number]];
    const [x, y] = dist(...a) >= dist(...b) ? a : b;
    if (!bombAt(s, x, y) && !playerAt(s, x, y)) {
      placeAt(p, x, y);
      p.tpLock = idx(s, x, y);
      s.events.push({ type: 'teleport', kind: 'player', id: p.id, x, y });
      return true;
    }
  }
  if (s.inf) return false;
  const danger = computeDanger(s);
  for (let t = 0; t < 200; t++) {
    const x = 1 + nextInt(s.rng, s.W - 2);
    const y = 1 + nextInt(s.rng, s.H - 2);
    if (!freeTile(s, x, y) || danger[idx(s, x, y)] || dist(x, y) < WARP_MIN || playerAt(s, x, y)) continue;
    placeAt(p, x, y);
    p.tpLock = padIndex(s, x, y) >= 0 ? idx(s, x, y) : -1;
    s.events.push({ type: 'teleport', kind: 'player', id: p.id, x, y });
    return true;
  }
  return false;
}

/** Folosește Super-ul dacă bara e plină. Întoarce true dacă s-a declanșat (și golește bara). */
export function useSuper(s: GameState, p: Player): boolean {
  const h = p.hero;
  if (!h || !p.alive || p.charge < SUPER_FULL || p.frozenT > 0 || p.carry !== null) return false;
  const ok =
    h.super === 'bigbomb'
      ? bigBomb(s, p)
      : h.super === 'dash'
        ? dash(s, p)
        : h.super === 'sticky'
          ? sticky(s, p)
          : h.super === 'cluster'
            ? cluster(s, p)
            : h.super === 'purse'
              ? purse(s, p)
              : h.super === 'timestop'
                ? timeStop(s, p)
                : warp(s, p);
  if (!ok) return false;
  p.charge = 0;
  s.events.push({ type: 'super', player: p.id, kind: h.super });
  return true;
}
