import { MOB_LIFE, TICK_HZ, sec } from './constants.ts';
import { bfs } from './danger.ts';
import { addFlame } from './effects.ts';
import { bombAt, idx, inBounds, mobX, mobY, tileAt, tileX, tileY, walkable } from './grid.ts';
import { nextFloat, nextInt } from './rng.ts';
import { createGame } from './setup.ts';
import { DIRS, DX, DY, EMPTY, SOFT, U } from './types.ts';
import type { Dir, Friend, GameState, MissionDef, MissionState, MissionTarget, TargetKind } from './types.ts';
import { ensureCell, resetWindow } from './world.ts';

/** Casa / baza (start). */
export const HOME: [number, number] = [1, 1];
const FAINT = sec(3);
const FRIEND_SPEED = 180; // 3.6 pătrățele/s

const key = (x: number, y: number) => `${x},${y}`;

/** Pune o țintă la distanța [dmin, dmax] de start, nu pe stâlp, la cel puțin 4 pătrățele de altele. */
function placeTarget(s: GameState, m: MissionState, type: TargetKind, hp = 1): MissionTarget | null {
  const { dmin, dmax } = m.def;
  for (let t = 0; t < 400; t++) {
    const dx = nextInt(s.rng, dmax * 2 + 1) - dmax;
    const dy = nextInt(s.rng, dmax * 2 + 1) - dmax;
    const d2 = dx * dx + dy * dy;
    if (d2 < dmin * dmin || d2 > dmax * dmax) continue;
    let x = HOME[0] + dx;
    const y = HOME[1] + dy;
    if ((x & 1) === 0 && (y & 1) === 0) x++;
    if (m.tmap[key(x, y)] !== undefined) continue;
    if (m.targets.some((o) => Math.abs(o.x - x) + Math.abs(o.y - y) < 4)) continue;
    if (Math.abs(x - HOME[0]) <= 1 && Math.abs(y - HOME[1]) <= 1) continue;
    const tg: MissionTarget = { type, x, y, done: false, open: false, hp, maxHp: hp };
    m.tmap[key(x, y)] = m.targets.length;
    m.targets.push(tg);
    return tg;
  }
  return null;
}

/**
 * Creează o misiune: jucătorul singur (id 0) în lumea infinită, cu bară de viață.
 * Țintele sunt generate determinist din seed; lumea din jur din hash-ul coordonatelor.
 */
export function createMission(def: MissionDef, seed: number): GameState {
  const s = createGame({
    seed,
    rules: {
      infinite: true,
      health: true,
      hearts: true,
      softDensity: def.softDensity,
      goldRate: 0.035,
      curseRate: 0.03,
      boxRespawn: false,
      hurryUpTick: 0,
    },
    players: [{ bot: null }],
  });
  const m: MissionState = {
    def,
    count: 0,
    need: def.kind === 'race' ? 1 : def.count,
    targets: [],
    tmap: {},
    friends: [],
    spT: sec(6),
    over: null,
  };
  s.mission = m;
  const p = s.players[0]!;
  p.shieldT = sec(2);
  if (def.kind === 'collect') for (let i = 0; i < def.count; i++) placeTarget(s, m, 'crystal');
  if (def.kind === 'demolish')
    for (let i = 0; i < def.count; i++) placeTarget(s, m, 'tower', i < def.armored ? 2 : 1);
  if (def.kind === 'race') placeTarget(s, m, 'flag');
  resetWindow(s);
  if (def.kind === 'rescue')
    for (let i = 0; i < def.count; i++) {
      const c = placeTarget(s, m, 'cage');
      if (!c) continue;
      // cușca e înconjurată de lăzi
      for (const d of DIRS) {
        const x = c.x + DX[d]!;
        const y = c.y + DY[d]!;
        ensureCell(s, x, y);
        const k = idx(s, x, y);
        if (s.grid[k] === EMPTY && nextFloat(s.rng) < 0.8) s.grid[k] = SOFT;
      }
      ensureCell(s, c.x, c.y);
      s.grid[idx(s, c.x, c.y)] = SOFT;
    }
  return s;
}

export const targetAt = (s: GameState, x: number, y: number): MissionTarget | undefined => {
  const m = s.mission;
  const i = m?.tmap[key(x, y)];
  return i === undefined ? undefined : m!.targets[i];
};

function progress(s: GameState): void {
  const m = s.mission!;
  m.count++;
  s.events.push({ type: 'missionProgress', count: m.count, need: m.need });
}

/**
 * O explozie (sau un fulger) atinge o țintă din ladă. Întoarce true dacă a tratat-o
 * (flacăra se oprește acolo, ca la o ladă obișnuită).
 */
export function hitTarget(s: GameState, x: number, y: number, owner: number, via: number): boolean {
  const t = targetAt(s, x, y);
  if (!t || t.done || t.open || t.type === 'flag') return false;
  const k = idx(s, x, y);
  if (t.type === 'tower') {
    t.hp--;
    if (t.hp > 0) {
      s.events.push({ type: 'missionHit', x, y, kind: 'tower', done: false });
      return true;
    }
    t.done = true;
    s.grid[k] = EMPTY;
    addFlame(s, x, y, owner, via);
    s.events.push({ type: 'missionHit', x, y, kind: 'tower', done: true });
    progress(s);
    return true;
  }
  s.grid[k] = EMPTY;
  t.open = true;
  addFlame(s, x, y, t.type === 'cage' ? -1 : owner, via);
  if (t.type === 'crystal') s.items[k] = 'crystal';
  if (t.type === 'cage') spawnFriend(s, s.mission!.targets.indexOf(t));
  s.events.push({ type: 'missionHit', x, y, kind: t.type, done: false });
  return true;
}

function spawnFriend(s: GameState, target: number): void {
  const t = s.mission!.targets[target]!;
  const f: Friend = {
    id: s.nextMobId++,
    target,
    px: t.x * U,
    py: t.y * U,
    fx: t.x,
    fy: t.y,
    tx: t.x,
    ty: t.y,
    moving: false,
    dir: 1,
    speed: FRIEND_SPEED,
    faint: 0,
    home: false,
  };
  s.mission!.friends.push(f);
  s.events.push({ type: 'friendFree', id: f.id });
}

/** Jucătorul a luat un cristal de pe jos. */
export function collectCrystal(s: GameState, x: number, y: number): void {
  const t = targetAt(s, x, y);
  if (t && t.type === 'crystal' && !t.done) {
    t.done = true;
    progress(s);
  }
}

function moveFriend(f: Friend): void {
  const ddx = f.tx * U - f.px;
  const ddy = f.ty * U - f.py;
  if (Math.abs(ddx) + Math.abs(ddy) <= f.speed) {
    f.px = f.tx * U;
    f.py = f.ty * U;
    f.moving = false;
  } else {
    f.px += Math.sign(ddx) * f.speed;
    f.py += Math.sign(ddy) * f.speed;
  }
}

function end(s: GameState, won: boolean, reason: 'done' | 'time' | 'dead'): void {
  const m = s.mission!;
  m.over = { won, reason, tick: s.tick };
  s.result = { winner: won ? 0 : null, team: null, tick: s.tick };
  s.events.push({ type: 'missionEnd', won, reason });
  s.events.push({ type: 'roundEnd', winner: s.result.winner, team: null });
}

/** Un tick de misiune: păianjeni rătăcitori, prieteni, cursa, victorie / înfrângere. */
export function updateMission(s: GameState): void {
  const m = s.mission;
  if (!m || m.over) return;
  const h = s.players[0]!;
  const hx = tileX(h);
  const hy = tileY(h);
  // păianjeni rătăcitori în jurul jucătorului
  if (--m.spT <= 0) {
    m.spT = sec(m.def.spiders.every);
    if (s.spiders.length < m.def.spiders.max)
      for (let t = 0; t < 30; t++) {
        const dx = nextInt(s.rng, 25) - 12;
        const dy = nextInt(s.rng, 25) - 12;
        const d2 = dx * dx + dy * dy;
        if (d2 < 49 || d2 > 144) continue;
        const x = hx + dx;
        const y = hy + dy;
        if (!inBounds(s, x, y) || tileAt(s, x, y) !== EMPTY || bombAt(s, x, y)) continue;
        s.spiders.push({
          id: s.nextMobId++,
          px: x * U,
          py: y * U,
          fx: x,
          fy: y,
          tx: x,
          ty: y,
          moving: false,
          dir: 1,
          speed: 140 + nextInt(s.rng, 21),
          life: MOB_LIFE + sec(6),
          wait: sec(1),
        });
        break;
      }
  }
  // prietenii salvați te urmează până acasă
  for (const f of m.friends) {
    if (f.home) continue;
    const fx = mobX(f);
    const fy = mobY(f);
    if (f.faint <= 0 && s.flame[idx(s, fx, fy)]! > 0) f.faint = FAINT;
    if (f.faint > 0) {
      f.faint--;
      continue;
    }
    if (!f.moving) {
      if (Math.abs(fx - HOME[0]) + Math.abs(fy - HOME[1]) <= 1) {
        f.home = true;
        m.targets[f.target]!.done = true;
        s.events.push({ type: 'friendHome', id: f.id });
        progress(s);
        continue;
      }
      if (h.alive && Math.abs(fx - hx) + Math.abs(fy - hy) > 1) {
        const pass = (x: number, y: number) => walkable(s, x, y) && s.flame[idx(s, x, y)]! <= 0;
        const d: Dir | null = bfs(s, s.rng, fx, fy, pass, (x, y) => Math.abs(x - hx) + Math.abs(y - hy) <= 1);
        if (d !== null) {
          f.fx = fx;
          f.fy = fy;
          f.tx = fx + DX[d]!;
          f.ty = fy + DY[d]!;
          f.dir = d;
          f.moving = true;
        }
      }
    }
    if (f.moving) moveFriend(f);
  }
  // cursa: ai ajuns la steag
  if (m.def.kind === 'race') {
    const fl = m.targets[0];
    if (fl && !fl.done && hx === fl.x && hy === fl.y && h.alive) {
      fl.done = true;
      progress(s);
    }
  }
  if (m.count >= m.need) return end(s, true, 'done');
  if (m.def.timeLimit && s.tick >= m.def.timeLimit * TICK_HZ) return end(s, false, 'time');
  if (!h.alive) return end(s, false, 'dead');
}

/** Ținta spre care arată săgeata: casa (salvare, cu prieteni pe drum) sau cea mai apropiată țintă rămasă. */
export function missionGoal(s: GameState): { x: number; y: number; home: boolean } | null {
  const m = s.mission;
  if (!m) return null;
  const h = s.players[0]!;
  if (m.def.kind === 'rescue' && m.friends.some((f) => !f.home))
    return { x: HOME[0], y: HOME[1], home: true };
  let best: MissionTarget | null = null;
  let bd = Infinity;
  for (const t of m.targets) {
    if (t.done || (t.type === 'cage' && t.open)) continue;
    const d = Math.abs(t.x - h.px / U) + Math.abs(t.y - h.py / U);
    if (d < bd) {
      bd = d;
      best = t;
    }
  }
  return best ? { x: best.x, y: best.y, home: false } : null;
}

/** Stelele (0–3): ★ reușită; ★★ timp (sau secunde rămase la cursă); ★★★ plus viață minimă. */
export function missionStars(s: GameState): number {
  const m = s.mission;
  if (!m?.over?.won) return 0;
  const hp = s.players[0]!.hp;
  const st = m.def.stars;
  if (m.def.kind === 'race') {
    const left = m.def.timeLimit - m.over.tick / TICK_HZ;
    return left >= st.three && hp >= st.hp ? 3 : left >= st.two ? 2 : 1;
  }
  const t = m.over.tick / TICK_HZ;
  return t < st.three && hp >= st.hp ? 3 : t < st.two ? 2 : 1;
}
