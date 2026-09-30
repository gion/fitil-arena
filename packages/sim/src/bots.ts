import { BOT_LEVELS } from './botLevels.ts';
import type { BotParams } from './botLevels.ts';
import { bfs, computeDanger, dangerTimes, escapeRoute } from './danger.ts';
import { FUSE } from './constants.ts';
import { bombAt, idx, inBounds, tileAt, tileX, tileY, walkable } from './grid.ts';
import { isNegative } from './items.ts';
import { carriedFlag } from './modes.ts';
import { deriveRng, nextFloat, nextInt } from './rng.ts';
import type { RngState } from './rng.ts';
import { isTeamMode } from './setup.ts';
import { DIRS, DX, DY, EMPTY, SOFT, U } from './types.ts';
import type { Dir, GameState, Input, Player } from './types.ts';

const adjSoft = (s: GameState, x: number, y: number): boolean =>
  DIRS.some((d) => tileAt(s, x + DX[d]!, y + DY[d]!) === SOFT);

const isFoe = (s: GameState, p: Player, q: Player): boolean =>
  q !== p && q.alive && !(isTeamMode(s.rules) && q.team === p.team);

/** Există un adversar în linie dreaptă, în raza bombei, fără obstacole între? */
function enemyInLine(s: GameState, p: Player, x: number, y: number): boolean {
  for (const q of s.players) {
    if (!isFoe(s, p, q)) continue;
    const qx = tileX(q);
    const qy = tileY(q);
    if (qx === x && Math.abs(qy - y) <= p.range) {
      let ok = true;
      for (let yy = Math.min(y, qy) + 1; yy < Math.max(y, qy); yy++)
        if (tileAt(s, x, yy) !== EMPTY) ok = false;
      if (ok) return true;
    }
    if (qy === y && Math.abs(qx - x) <= p.range) {
      let ok = true;
      for (let xx = Math.min(x, qx) + 1; xx < Math.max(x, qx); xx++)
        if (tileAt(s, xx, y) !== EMPTY) ok = false;
      if (ok) return true;
    }
  }
  return false;
}

/** Capturează steagul: unde vrea botul să ajungă (roluri de atac/apărare, portat din prototip). */
export function ctfGoal(s: GameState, p: Player): [number, number] | null {
  const c = s.ctf;
  if (!c) return null;
  const mine = c.flags[p.team]!;
  const theirs = c.flags[1 - p.team]!;
  const at = (id: number): [number, number] => [tileX(s.players[id]!), tileY(s.players[id]!)];
  if (carriedFlag(s, p)) return [mine.hx, mine.hy]; // purtătorul fuge acasă
  if (!mine.atHome && mine.carrier === null) return [mine.x, mine.y]; // salvează steagul căzut
  if (mine.carrier !== null) return at(mine.carrier); // vânează purtătorul
  const team = s.players.filter((q) => q.team === p.team);
  if (team[team.length - 1] === p && p.bot !== null) {
    // ultimul bot din echipă apără baza
    const d = Math.abs(tileX(p) - mine.hx) + Math.abs(tileY(p) - mine.hy);
    return d > 2 ? [mine.hx, mine.hy] : null;
  }
  if (theirs.carrier !== null) return at(theirs.carrier); // escortează purtătorul
  return [theirs.x, theirs.y];
}

interface Ctx {
  s: GameState;
  p: Player;
  L: BotParams;
  rng: RngState;
  cx: number;
  cy: number;
  danger: Uint8Array;
  open: (x: number, y: number) => boolean;
  tpt: number;
}

/** Dacă botul pune acum o bombă aici, pe unde fuge? null = n-are scăpare, nu pune. */
function bombEscape(c: Ctx): Dir | null {
  const { s, p, L, rng, cx, cy, danger, open, tpt } = c;
  if (L.timed) {
    const dz = dangerTimes(s, { x: cx, y: cy, range: p.range, fuse: FUSE });
    return escapeRoute(s, rng, cx, cy, tpt, dz, open);
  }
  const hyp = danger.slice();
  hyp[idx(s, cx, cy)] = 1;
  for (const d of DIRS)
    for (let i = 1; i <= p.range; i++) {
      const nx = cx + DX[d]! * i;
      const ny = cy + DY[d]! * i;
      const g = tileAt(s, nx, ny);
      if (g !== EMPTY && g !== SOFT) break;
      hyp[idx(s, nx, ny)] = 1;
      if (g === SOFT) break;
    }
  return bfs(s, rng, cx, cy, open, (x, y) => !hyp[idx(s, x, y)]);
}

const canBomb = (c: Ctx): boolean => c.p.botCd <= 0 && c.p.active < c.p.bombs && !bombAt(c.s, c.cx, c.cy);

/** Drum spre obiectivul CTF; își sapă drum prin lăzi dacă altfel nu se poate. */
function ctfMove(c: Ctx, g: [number, number], safe: (x: number, y: number) => boolean): Input | null {
  const { s, rng, cx, cy } = c;
  const goal = (x: number, y: number) => x === g[0] && y === g[1];
  const dd = bfs(s, rng, cx, cy, safe, goal);
  if (dd !== null) return { dir: dd };
  const thru = (x: number, y: number) => inBounds(s, x, y) && (tileAt(s, x, y) === SOFT || safe(x, y));
  const d2 = bfs(s, rng, cx, cy, thru, goal);
  if (d2 === null) return null;
  const nx = cx + DX[d2]!;
  const ny = cy + DY[d2]!;
  if (tileAt(s, nx, ny) === SOFT) {
    if (!canBomb(c)) return { dir: null };
    const esc = bombEscape(c);
    return esc !== null ? { dir: esc, bomb: 1 } : { dir: null };
  }
  return safe(nx, ny) ? { dir: d2 } : null;
}

/**
 * Decizia unui bot pentru tick-ul curent. Funcție pură: aleatoriul vine din (seed, tick, id),
 * deci serverul și clientul obțin același rezultat.
 */
export function botInput(s: GameState, playerId: number): Input {
  const p = s.players[playerId];
  if (!p || !p.alive || p.bot === null || p.bot === 'dummy') return { dir: null };
  if (p.moving) return { dir: p.dir };
  const L = BOT_LEVELS[p.bot];
  const rng = deriveRng(s.seed, s.tick, playerId);
  const cx = tileX(p);
  const cy = tileY(p);
  const danger = computeDanger(s);
  const open = (x: number, y: number) => walkable(s, x, y) && s.flame[idx(s, x, y)]! <= 0;
  const noDanger = (x: number, y: number) => !danger[idx(s, x, y)];
  const c: Ctx = { s, p, L, rng, cx, cy, danger, open, tpt: Math.ceil(U / p.speed) };

  // 1. fugi din pericol (nivelurile peste „easy” țin cont de momentul fiecărei explozii)
  if (danger[idx(s, cx, cy)]) {
    if (L.timed) {
      const route = escapeRoute(s, rng, cx, cy, c.tpt, dangerTimes(s), open);
      if (route !== null) return { dir: route };
    }
    return { dir: bfs(s, rng, cx, cy, open, noDanger) };
  }

  // amețit: se mai împiedică
  if (p.dizzyT > 0 && nextFloat(rng) < 0.25) return { dir: DIRS[nextInt(rng, 4)]! };

  // reacție mai lentă la nivelurile ușoare
  if (L.thinkEvery > 1 && (s.tick + playerId) % L.thinkEvery !== 0) return { dir: null };

  const safe = (x: number, y: number) => open(x, y) && noDanger(x, y);
  const goal = ctfGoal(s, p);

  // 2. pune bombă lângă o ladă sau un adversar, dacă are pe unde să fugă
  if (canBomb(c)) {
    const soft = adjSoft(s, cx, cy) && !goal;
    const foe = enemyInLine(s, p, cx, cy);
    if (soft || (foe && nextFloat(rng) < L.foeChance)) {
      const esc = bombEscape(c);
      if (esc !== null) return { dir: esc, bomb: 1 };
      if (L.timed) return { dir: null };
    }
  }

  // 2b. capturează steagul: obiectivul are prioritate
  if (goal) {
    const r = ctfMove(c, goal, safe);
    if (r) return r;
  }

  // 3. caută o țintă: bonus, ladă, adversar în linie (sau aproape de un adversar, la nivelurile grele)
  const careNeg = nextFloat(rng) < L.avoidNegative;
  const foes = L.chase ? s.players.filter((q) => isFoe(s, p, q)) : [];
  let d: Dir | null = bfs(s, rng, cx, cy, safe, (x, y) => {
    const it = s.items[idx(s, x, y)];
    if (it && !(careNeg && isNegative(it))) return true;
    if (adjSoft(s, x, y) || enemyInLine(s, p, x, y)) return true;
    for (const q of foes) if (Math.abs(tileX(q) - x) + Math.abs(tileY(q) - y) <= L.chase) return true;
    return false;
  });
  if (d === null && nextFloat(rng) < L.wander) {
    const opts = DIRS.filter((dd) => safe(cx + DX[dd]!, cy + DY[dd]!));
    if (opts.length) d = opts[nextInt(rng, opts.length)]!;
  }
  return { dir: d };
}

/** Input-uri pentru toți jucătorii: boții își calculează singuri, oamenii vin din `human`. */
export function collectInputs(s: GameState, human: Readonly<Record<number, Input>> = {}): Input[] {
  return s.players.map((p) => (p.bot !== null ? botInput(s, p.id) : (human[p.id] ?? { dir: null })));
}
