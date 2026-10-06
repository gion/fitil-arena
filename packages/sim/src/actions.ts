import { BIG_BOMB_EXTRA, FUSE, LINE_MAX_EXTRA, REMOTE_FUSE } from './constants.ts';
import { bombAt, getBomb, idx, padIndex, playerAt, tileAt, tileX, tileY, walkable } from './grid.ts';
import { useCharge } from './items.ts';
import { DX, DY, EMPTY } from './types.ts';
import type { Bomb, Dir, GameState, Player } from './types.ts';

export function placeBomb(s: GameState, p: Player, x = tileX(p), y = tileY(p)): boolean {
  if (!p.alive || p.carry !== null || p.active >= p.bombs || bombAt(s, x, y) || s.flame[idx(s, x, y)]! > 0)
    return false;
  const remote = p.remote && p.bot === null;
  const big = p.bigBomb;
  p.bigBomb = false;
  const b: Bomb = {
    id: s.nextBombId++,
    x,
    y,
    fuse: remote ? REMOTE_FUSE : FUSE + (p.kit?.fuseAdd ?? 0),
    range: big ? p.range + BIG_BOMB_EXTRA : p.range,
    owner: p.id,
    remote,
    slide: null,
    prog: 0,
    held: null,
    fly: null,
    chain: 0,
    tpLock: padIndex(s, x, y) >= 0 ? idx(s, x, y) : -1,
    via: 0,
  };
  if (big) b.big = true;
  s.bombs.push(b);
  p.active++;
  s.events.push({ type: 'bombPlaced', bomb: b.id, x, y, owner: p.id });
  return true;
}

/** Linie: restul bombelor disponibile (max 4 în plus) în direcția privirii, până la primul obstacol. */
export function placeLine(s: GameState, p: Player): boolean {
  const dx = DX[p.face]!;
  const dy = DY[p.face]!;
  let x = tileX(p);
  let y = tileY(p);
  let n = 0;
  while (p.active < p.bombs && n < LINE_MAX_EXTRA) {
    x += dx;
    y += dy;
    if (!walkable(s, x, y) || playerAt(s, x, y) || s.flame[idx(s, x, y)]! > 0) break;
    placeBomb(s, p, x, y);
    n++;
  }
  if (n > 0) useCharge(s, p, 'line');
  return n > 0;
}

export function detonate(s: GameState, p: Player): boolean {
  let n = 0;
  for (const b of s.bombs)
    if (b.owner === p.id && b.remote && b.held === null && b.fly === null) {
      b.fuse = 0;
      n++;
    }
  if (n > 0) useCharge(s, p, 'remote');
  return n > 0;
}

/** Mănușa: ridică bomba de sub tine sau pe cea din fața ta. */
export function tryLift(s: GameState, p: Player): boolean {
  const x = tileX(p);
  const y = tileY(p);
  const b = bombAt(s, x, y) ?? bombAt(s, x + DX[p.face]!, y + DY[p.face]!);
  if (!b || b.slide !== null) return false;
  b.held = p.id;
  p.carry = b.id;
  s.events.push({ type: 'lift', player: p.id, bomb: b.id });
  return true;
}

/** Aruncă bomba ținută 3 pătrățele în direcția privirii, peste ziduri; continuă până la un loc liber. Iese pe o parte, intră pe cealaltă. */
export function throwBomb(s: GameState, p: Player): void {
  const b = p.carry === null ? undefined : getBomb(s, p.carry);
  p.carry = null;
  if (!b) return;
  b.held = null;
  const dir = p.face;
  const dx = DX[dir]!;
  const dy = DY[dir]!;
  const sx = tileX(p);
  const sy = tileY(p);
  let tx = sx;
  let ty = sy;
  let steps = 0;
  const wrap = () => {
    if (s.inf) return; // fără margini: fără wrap
    if (tx < 1) tx = s.W - 2;
    if (tx > s.W - 2) tx = 1;
    if (ty < 1) ty = s.H - 2;
    if (ty > s.H - 2) ty = 1;
  };
  for (let i = 0; i < 3; i++) {
    tx += dx;
    ty += dy;
    steps++;
    wrap();
  }
  let guard = 40;
  while (guard-- > 0 && !(tileAt(s, tx, ty) === EMPTY && !bombAt(s, tx, ty))) {
    tx += dx;
    ty += dy;
    steps++;
    wrap();
  }
  // durata zborului: 0.18s + 0.06s pe pătrățel
  b.fly = { sx, sy, dir, steps, t: 0, dur: Math.round((36 + 12 * steps) / 10) };
  b.via = 2;
  b.x = tx;
  b.y = ty;
  b.slide = null;
  s.events.push({ type: 'throw', player: p.id, bomb: b.id });
  useCharge(s, p, 'glove');
}

export function tryKick(s: GameState, p: Player, dir: Dir): boolean {
  const x = tileX(p) + DX[dir]!;
  const y = tileY(p) + DY[dir]!;
  const b = bombAt(s, x, y);
  if (!b || b.slide !== null) return false;
  const nx = x + DX[dir]!;
  const ny = y + DY[dir]!;
  if (!walkable(s, nx, ny) || playerAt(s, nx, ny)) return false;
  b.slide = dir;
  b.via = 1;
  b.prog = 0;
  if (p.kit?.ricochet) b.bounce = 1;
  s.events.push({ type: 'kick', player: p.id, bomb: b.id });
  useCharge(s, p, 'kick');
  return true;
}

/**
 * Tap-ul jucătorului uman (prioritățile din prototip).
 * `double` = al doilea tap dintr-un dublu tap; contează doar dacă primul tap a pus o bombă.
 */
export function action(s: GameState, p: Player, double: boolean): boolean {
  if (!p.alive) return false;
  if (p.carry !== null) {
    throwBomb(s, p);
    return true;
  }
  const dbl = double && p.lastTapPlaced;
  if (dbl && p.line && placeLine(s, p)) return true;
  if (dbl && p.glove && tryLift(s, p)) return true;
  const x = tileX(p);
  const y = tileY(p);
  const onBomb = bombAt(s, x, y);
  if (p.glove && (onBomb || (!p.line && p.active >= p.bombs)) && tryLift(s, p)) return true;
  if (p.glove && !onBomb && p.active < p.bombs) {
    const f = bombAt(s, x + DX[p.face]!, y + DY[p.face]!);
    if (f && f.owner !== p.id && tryLift(s, p)) return true;
  }
  return placeBomb(s, p);
}
