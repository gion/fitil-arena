import { newBomb, effectiveRange } from './actions.ts';
import {
  BIG_EXTRA,
  BOO,
  BURST_CAP,
  DASH_TILES,
  MAX_RANGE,
  PURSE_MAX,
  PURSE_MIN,
  QUAKE_REACH,
  SMOKE_RADIUS,
  SMOKE_T,
  SMOKE_THROW,
  STICKY_FUSE,
  SUPER_FULL,
  TIME_STOP,
  WARP_MIN,
} from './constants.ts';
import { computeDanger } from './danger.ts';
import {
  areaTiles,
  bombAt,
  idx,
  inBounds,
  padIndex,
  playerAt,
  tileAt,
  tileX,
  tileY,
  walkable,
} from './grid.ts';
import { nextInt } from './rng.ts';
import { isTeamMode } from './setup.ts';
import { DIRS, DX, DY, EMPTY, U } from './types.ts';
import type { Bomb, Dir, GameState, Player } from './types.ts';

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

/**
 * Bubu: o bombă mare (rază +2) la picioare, în plus față de bombele lui.
 * Nova (`nova`): aceeași bombă, dar explodează în arie, cu o treaptă peste plafonul bombelor ei.
 */
function bigBomb(s: GameState, p: Player, nova = false): boolean {
  const x = tileX(p);
  const y = tileY(p);
  if (bombAt(s, x, y) || s.flame[idx(s, x, y)]! > 0) return false;
  const b = newBomb(s, p.id, x, y, Math.min(MAX_RANGE + BIG_EXTRA, effectiveRange(s, p) + BIG_EXTRA), {
    free: true,
  });
  if (nova) b.area = BURST_CAP + 1;
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

/** Pornește alunecarea unei bombe într-o direcție, dacă are loc. */
function shove(s: GameState, b: Bomb, d: Dir): boolean {
  if (b.held !== null || b.fly !== null || b.stuck !== null) return false;
  const nx = b.x + DX[d]!;
  const ny = b.y + DY[d]!;
  if (!walkable(s, nx, ny) || playerAt(s, nx, ny)) return false;
  b.slide = d;
  b.prog = 0;
  b.via = 1;
  return true;
}

/** Gugu: cutremur — bombele de pe cele 4 direcții, până la 2 pătrățele, pleacă de lângă el. */
function quake(s: GameState, p: Player): boolean {
  const cx = tileX(p);
  const cy = tileY(p);
  let n = 0;
  for (const d of DIRS)
    // de la cea mai îndepărtată, ca bombele să nu se blocheze între ele
    for (let i = QUAKE_REACH; i >= 1; i--) {
      const x = cx + DX[d]! * i;
      const y = cy + DY[d]! * i;
      if (i === 2 && tileAt(s, cx + DX[d]!, cy + DY[d]!) !== EMPTY) continue;
      const b = bombAt(s, x, y);
      if (b && shove(s, b, d)) n++;
    }
  return n > 0;
}

/** Fotbalistul: penalty — toate bombele din linia privirii (până la primul zid) pleacă înainte. */
function penalty(s: GameState, p: Player): boolean {
  const line: Bomb[] = [];
  let x = tileX(p) + DX[p.face]!;
  let y = tileY(p) + DY[p.face]!;
  while (inBounds(s, x, y) && tileAt(s, x, y) === EMPTY) {
    const b = bombAt(s, x, y);
    if (b) line.push(b);
    x += DX[p.face]!;
    y += DY[p.face]!;
  }
  let n = 0;
  // de la cea mai îndepărtată; cele din spate pornesc cu o întârziere (progres negativ),
  // ca să nu se oprească în bomba din față care încă n-a plecat
  for (const b of line.reverse())
    if (shove(s, b, p.face) || n > 0) {
      b.slide = p.face;
      b.via = 1;
      b.prog = -Math.floor((3 * U) / 2) * n;
      n++;
    }
  return n > 0;
}

/** Fantoma: 2s invizibilă pentru adversari. */
function boo(p: Player): boolean {
  p.hiddenT = BOO;
  return true;
}

/**
 * Umbra: bomba fumigenă zboară până la 3 pătrățele în direcția privirii (se oprește la obstacole)
 * și lasă un nor de fum de rază 2 pentru 6s. Fumul nu rănește; ascunde ce e în el.
 */
function smokeBomb(s: GameState, p: Player): boolean {
  let x = tileX(p);
  let y = tileY(p);
  for (let i = 0; i < SMOKE_THROW; i++) {
    const nx = x + DX[p.face]!;
    const ny = y + DY[p.face]!;
    if (!walkable(s, nx, ny)) break;
    x = nx;
    y = ny;
  }
  for (const [tx, ty] of areaTiles(s, x, y, SMOKE_RADIUS)) {
    // lada oprește fumul și nu intră în el
    if (tileAt(s, tx, ty) === EMPTY) s.smoke[idx(s, tx, ty)] = SMOKE_T;
  }
  s.events.push({ type: 'smokeBomb', player: p.id, x, y });
  return true;
}

/** Magicianul: schimbă locul cu cel mai apropiat adversar. */
function swap(s: GameState, p: Player): boolean {
  const cx = tileX(p);
  const cy = tileY(p);
  const team = isTeamMode(s.rules);
  let best: Player | null = null;
  let bd = 1e9;
  for (const q of s.players) {
    if (q === p || !q.alive || (team && q.team === p.team)) continue;
    const d = Math.abs(tileX(q) - cx) + Math.abs(tileY(q) - cy);
    if (d < bd) {
      bd = d;
      best = q;
    }
  }
  if (!best) return false;
  const qx = tileX(best);
  const qy = tileY(best);
  placeAt(best, cx, cy);
  placeAt(p, qx, qy);
  s.events.push({ type: 'teleport', kind: 'player', id: p.id, x: qx, y: qy });
  s.events.push({ type: 'teleport', kind: 'player', id: best.id, x: cx, y: cy });
  return true;
}

/** Folosește Super-ul dacă bara e plină. Întoarce true dacă s-a declanșat (și golește bara). */
export function useSuper(s: GameState, p: Player): boolean {
  const h = p.hero;
  if (!h || !p.alive || p.charge < SUPER_FULL || p.frozenT > 0 || p.carry !== null) return false;
  const ok =
    h.super === 'bigbomb' || h.super === 'nova'
      ? bigBomb(s, p, h.super === 'nova')
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
                : h.super === 'quake'
                  ? quake(s, p)
                  : h.super === 'penalty'
                    ? penalty(s, p)
                    : h.super === 'boo'
                      ? boo(p)
                      : h.super === 'swap'
                        ? swap(s, p)
                        : h.super === 'smoke'
                          ? smokeBomb(s, p)
                          : warp(s, p);
  if (!ok) return false;
  p.charge = 0;
  s.events.push({ type: 'super', player: p.id, kind: h.super });
  return true;
}
