import {
  FLAG_RETURN,
  GRACE,
  POTATO_MIN,
  POTATO_NEXT,
  POTATO_PASS,
  POTATO_RANGE,
  POTATO_VAR,
  ROT_FLIP,
  SHIFT_STEP,
  SHIFT_WARN,
  TICK_HZ,
} from './constants.ts';
import { addFlame, kill, shieldSave } from './effects.ts';
import { bombAt, idx, tileAt, tileX, tileY } from './grid.ts';
import { applyItem } from './items.ts';
import { nextFloat, nextInt } from './rng.ts';
import { infRespawnPos } from './infinite.ts';
import { applyHero, applyKit, makePlayer } from './setup.ts';
import { DIRS, DX, DY, EMPTY, HARD, SOFT, U, opposite } from './types.ts';
import type { Dir, Flag, GameState, Player, Shift } from './types.ts';

/* ---------- Rânduri mobile ---------- */

/** Pătrățelele (fără margini) ale rândului/coloanei care alunecă. */
export function shiftCells(s: GameState, sh: Pick<Shift, 'axis' | 'idx'>): [number, number][] {
  const out: [number, number][] = [];
  if (sh.axis === 0) for (let x = 1; x <= s.W - 2; x++) out.push([x, sh.idx]);
  else for (let y = 1; y <= s.H - 2; y++) out.push([sh.idx, y]);
  return out;
}

function rotate<T>(arr: T[], ks: number[], d: number): void {
  const n = ks.length;
  const old = ks.map((k) => arr[k]!);
  for (let i = 0; i < n; i++) arr[ks[i]!] = old[(((i - d) % n) + n) % n]!;
}

function shiftStep(s: GameState, sh: Shift): void {
  sh.steps--;
  sh.stepT = 0;
  const cells = shiftCells(s, sh);
  const n = cells.length;
  const ks = cells.map(([x, y]) => idx(s, x, y));
  const d = sh.dir;
  rotate(s.grid, ks, d);
  rotate(s.items, ks, d);
  rotate(s.drops, ks, d);
  rotate(s.gold, ks, d);
  rotate(s.cursed, ks, d);
  const pos = (i: number) => cells[((i % n) + n) % n]!;
  for (const b of s.bombs) {
    if (b.held !== null || b.fly !== null) continue;
    const i = cells.findIndex(([x, y]) => x === b.x && y === b.y);
    if (i < 0) continue;
    [b.x, b.y] = pos(i + d);
    b.slide = null;
    b.prog = 0;
  }
  s.events.push({ type: 'shiftStep', axis: sh.axis, idx: sh.idx, dir: d });
  const [ax, ay] = sh.axis === 0 ? [d, 0] : [0, d];
  for (const p of s.players) {
    if (!p.alive) continue;
    const px = tileX(p);
    const py = tileY(p);
    if (!cells.some(([x, y]) => x === px && y === py)) {
      // cine intra într-un pătrățel în care tocmai a alunecat o ladă se întoarce
      if (p.moving && s.grid[idx(s, p.tx, p.ty)] !== EMPTY) {
        [p.tx, p.fx] = [p.fx, p.tx];
        [p.ty, p.fy] = [p.fy, p.ty];
        p.dir = opposite(p.dir);
      }
      continue;
    }
    if (s.grid[idx(s, px, py)] !== SOFT) continue;
    // o ladă a intrat peste jucător: e împins un pătrat înainte sau strivit
    const nx = px + ax;
    const ny = py + ay;
    const onLine = cells.some(([x, y]) => x === nx && y === ny);
    if (onLine && s.grid[idx(s, nx, ny)] === EMPTY && !bombAt(s, nx, ny)) {
      p.px = nx * U;
      p.py = ny * U;
      p.fx = p.tx = nx;
      p.fy = p.ty = ny;
      p.moving = false;
      s.events.push({ type: 'pushed', player: p.id, x: nx, y: ny });
    } else if (shieldSave(s, p, GRACE)) {
      const k = idx(s, px, py);
      s.grid[k] = EMPTY;
      s.gold[k] = 0;
      s.cursed[k] = 0;
      s.events.push({ type: 'boxDestroyed', x: px, y: py, gold: false, cursed: false, owner: -1 });
    } else kill(s, p, null, 'crush');
  }
}

export function updateShift(s: GameState): void {
  if (!s.rules.shift || s.result) return;
  const sh = s.shift;
  if (!sh) {
    if (s.rules.hurryUpTick && s.tick >= s.rules.hurryUpTick) return; // arena se strânge: nu mai alunecă nimic
    if (--s.shiftNext > 0) return;
    const axis: 0 | 1 = nextFloat(s.rng) < s.W / (s.W + s.H) ? 1 : 0;
    const list: number[] = [];
    for (let i = 1; i < (axis ? s.W : s.H) - 1; i += 2) list.push(i);
    const next: Shift = {
      axis,
      idx: list[nextInt(s.rng, list.length)]!,
      dir: nextFloat(s.rng) < 0.5 ? 1 : -1,
      warn: SHIFT_WARN,
      steps: 3 + nextInt(s.rng, 4),
      stepT: 0,
    };
    s.shift = next;
    s.events.push({ type: 'shiftWarn', axis: next.axis, idx: next.idx, dir: next.dir });
    return;
  }
  if (sh.warn > 0) {
    if (--sh.warn === 0) shiftStep(s, sh);
    return;
  }
  if (++sh.stepT < SHIFT_STEP) return;
  if (sh.steps > 0) shiftStep(s, sh);
  else {
    s.shift = null;
    s.shiftNext = 70 + nextInt(s.rng, 61); // 3.5–6.5s
  }
}

/* ---------- Arena rotativă ---------- */

export const DEG = 1_000_000;

/** Viteza țintă (µ°/tick): 4°/s → 14°/s în 90s; sensul se inversează la fiecare 25s. */
export function rotTarget(tick: number): number {
  const perSec = 4 * DEG + Math.min(10 * DEG, Math.floor((tick * DEG) / (9 * TICK_HZ)));
  const sign = Math.floor(tick / ROT_FLIP) % 2 ? -1 : 1;
  return Math.trunc((sign * perSec) / TICK_HZ);
}

export function updateRotation(s: GameState): void {
  const r = s.rot;
  if (!r || s.result) return;
  r.v += Math.trunc((rotTarget(s.tick) - r.v) / 25);
  r.a = (((r.a + r.v) % (360 * DEG)) + 360 * DEG) % (360 * DEG);
  if (s.tick % ROT_FLIP === 0) s.events.push({ type: 'rotFlip' });
}

/* ---------- Capturează steagul ---------- */

export const carriedFlag = (s: GameState, p: Player): Flag | undefined =>
  s.ctf?.flags.find((f) => f.carrier === p.id);

function resetFlag(f: Flag): void {
  f.carrier = null;
  f.x = f.hx;
  f.y = f.hy;
  f.atHome = true;
  f.dropT = 0;
}

export function updateCtf(s: GameState): void {
  const c = s.ctf;
  if (!c || s.result) return;
  for (const f of c.flags) {
    if (f.carrier !== null) {
      const p = s.players[f.carrier]!;
      f.x = tileX(p);
      f.y = tileY(p);
      if (!p.alive) {
        f.carrier = null;
        f.dropT = FLAG_RETURN;
        s.events.push({ type: 'flagDrop', team: f.team, x: f.x, y: f.y });
      }
    } else if (!f.atHome && --f.dropT <= 0) {
      resetFlag(f);
      s.events.push({ type: 'flagReturn', team: f.team, player: null });
    }
  }
  for (const p of s.players) {
    if (!p.alive) continue;
    const px = tileX(p);
    const py = tileY(p);
    for (const f of c.flags) {
      if (f.carrier !== null || f.x !== px || f.y !== py) continue;
      if (f.team !== p.team && !carriedFlag(s, p)) {
        f.carrier = p.id;
        f.atHome = false;
        s.events.push({ type: 'flagTake', team: f.team, player: p.id });
      } else if (f.team === p.team && !f.atHome) {
        resetFlag(f);
        s.events.push({ type: 'flagReturn', team: f.team, player: p.id });
      }
    }
    const own = c.flags[p.team]!;
    const held = carriedFlag(s, p);
    if (held && own.atHome && px === own.hx && py === own.hy) {
      resetFlag(held);
      c.caps[p.team]!++;
      s.events.push({ type: 'capture', team: p.team, player: p.id, caps: [c.caps[0], c.caps[1]] });
    }
  }
  const timeUp = s.rules.timeLimit > 0 && s.tick >= s.rules.timeLimit;
  if (c.caps[0] >= c.need || c.caps[1] >= c.need || timeUp) {
    const team = c.caps[0] === c.caps[1] ? null : c.caps[0] > c.caps[1] ? 0 : 1;
    s.result = { winner: null, team, tick: s.tick };
    s.events.push({ type: 'roundEnd', winner: null, team });
  }
}

/* ---------- Revenire în joc ---------- */

export function respawn(s: GameState, p: Player): void {
  // în lumea infinită revii lângă locul morții, nu la start
  if (s.inf) [p.sx, p.sy] = infRespawnPos(s, p);
  const fresh = makePlayer(p.id, p.team, p.bot, p.sx, p.sy);
  applyHero(fresh, p.hero, s.rules);
  // se păstrează pe tot meciul: Super-ul încărcat, scutul pasiv folosit, timpul cu coroana
  fresh.charge = p.charge;
  fresh.guard = p.guard;
  fresh.crownT = p.crownT;
  fresh.kills = p.kills;
  fresh.boxes = p.boxes;
  fresh.far = p.far;
  fresh.lived = p.lived;
  const open = DIRS.find((d: Dir) => s.grid[idx(s, p.sx + DX[d]!, p.sy + DY[d]!)] === EMPTY);
  if (open !== undefined) fresh.face = open;
  if (p.kit) applyKit(fresh, p.kit, p.ch);
  for (const it of s.rules.startItems) applyItem(fresh, it, { health: s.rules.health });
  fresh.shieldT = Math.max(fresh.shieldT, s.rules.respawnShield);
  Object.assign(p, fresh);
  s.events.push({ type: 'respawn', player: p.id });
}

export function updateRespawn(s: GameState): void {
  const R = s.rules.respawnTicks;
  if (!R || s.result) return;
  for (const p of s.players) {
    // în Infinit boții nu revin (apar alții, în jurul oamenilor)
    if (p.alive || p.out || (s.inf && p.bot !== null)) continue;
    if (s.tick - p.deathTick >= R) respawn(s, p);
  }
}

/* ---------- Coroana ---------- */

export function updateCrown(s: GameState): void {
  const c = s.crown;
  if (!c || s.result) return;
  if (c.holder !== null) {
    const h = s.players[c.holder]!;
    c.x = tileX(h);
    c.y = tileY(h);
    if (!h.alive) {
      c.holder = null;
      s.events.push({ type: 'crownDrop', x: c.x, y: c.y });
    } else if (++h.crownT >= c.need) {
      s.result = { winner: h.id, team: null, tick: s.tick };
      s.events.push({ type: 'roundEnd', winner: h.id, team: null });
      return;
    }
  } else {
    const p = s.players.find((q) => q.alive && tileX(q) === c.x && tileY(q) === c.y);
    if (p) {
      c.holder = p.id;
      s.events.push({ type: 'crownTake', player: p.id });
    }
  }
  if (s.rules.timeLimit > 0 && s.tick >= s.rules.timeLimit) {
    const best = Math.max(...s.players.map((p) => p.crownT));
    const top = s.players.filter((p) => p.crownT === best);
    const winner = best > 0 && top.length === 1 ? top[0]!.id : null;
    s.result = { winner, team: null, tick: s.tick };
    s.events.push({ type: 'roundEnd', winner, team: null });
  }
}

/* ---------- Cartoful fierbinte ---------- */

function potatoBoom(s: GameState, h: Player): void {
  const x = tileX(h);
  const y = tileY(h);
  s.events.push({ type: 'potatoBoom', player: h.id, x, y });
  addFlame(s, x, y, -1);
  for (const d of DIRS)
    for (let i = 1; i <= POTATO_RANGE; i++) {
      const g = tileAt(s, x + DX[d]! * i, y + DY[d]! * i);
      if (g === HARD || g === SOFT) break;
      addFlame(s, x + DX[d]! * i, y + DY[d]! * i, -1);
    }
  kill(s, h, null, 'potato');
}

export function updatePotato(s: GameState): void {
  const t = s.potato;
  if (!t || s.result) return;
  if (t.holder === null) {
    if (--t.cd > 0) return;
    const alive = s.players.filter((p) => p.alive);
    if (alive.length < 2) return;
    const p = alive[nextInt(s.rng, alive.length)]!;
    t.holder = p.id;
    t.fuse = POTATO_MIN + nextInt(s.rng, POTATO_VAR + 1);
    t.cd = POTATO_PASS;
    s.events.push({ type: 'potatoGive', player: p.id, from: null });
    return;
  }
  const h = s.players[t.holder]!;
  if (!h.alive) {
    t.holder = null;
    t.cd = POTATO_NEXT;
    return;
  }
  if (t.cd > 0) t.cd--;
  else {
    const hx = tileX(h);
    const hy = tileY(h);
    const q = s.players.find(
      (o) => o !== h && o.alive && Math.abs(tileX(o) - hx) + Math.abs(tileY(o) - hy) <= 1,
    );
    if (q) {
      t.holder = q.id;
      t.cd = POTATO_PASS;
      s.events.push({ type: 'potatoGive', player: q.id, from: h.id });
      return;
    }
  }
  if (--t.fuse <= 0) {
    t.holder = null;
    t.cd = POTATO_NEXT;
    potatoBoom(s, h);
  }
}
