import {
  HURT_SPIDER,
  CLOUD_CHARGE,
  CLOUD_SPEED,
  CLOUD_SPEED_VAR,
  GRACE,
  MOB_LIFE,
  SPIDER_HIT,
  SPIDER_SPEED,
  SPIDER_SPEED_VAR,
} from './constants.ts';
import { bfs } from './danger.ts';
import { addFlame, damage, shieldSave } from './effects.ts';
import { hitTarget } from './missions.ts';
import { bombAt, idx, inBounds, mobX, mobY, playerAt, tileAt, walkable } from './grid.ts';
import { nextFloat, nextInt } from './rng.ts';
import { DIRS, DX, DY, EMPTY, HARD, SOFT, U, VIA_LIGHTNING, opposite } from './types.ts';
import type { Cloud, Dir, GameState, Spider } from './types.ts';

/** Ceva care merge pe grilă pătrățel cu pătrățel (păianjeni, nori). */
interface Walker {
  px: number;
  py: number;
  fx: number;
  fy: number;
  tx: number;
  ty: number;
  moving: boolean;
  dir: Dir;
  speed: number;
}

function startMove(m: Walker, d: Dir): void {
  const cx = mobX(m);
  const cy = mobY(m);
  m.fx = cx;
  m.fy = cy;
  m.tx = cx + DX[d]!;
  m.ty = cy + DY[d]!;
  m.dir = d;
  m.moving = true;
}

function advance(m: Walker): void {
  if (!m.moving) return;
  const ddx = m.tx * U - m.px;
  const ddy = m.ty * U - m.py;
  if (Math.abs(ddx) + Math.abs(ddy) <= m.speed) {
    m.px = m.tx * U;
    m.py = m.ty * U;
    m.moving = false;
  } else {
    m.px += Math.sign(ddx) * m.speed;
    m.py += Math.sign(ddy) * m.speed;
  }
}

const hasPlayer = (s: GameState) => (x: number, y: number) => playerAt(s, x, y) !== undefined;

/** Declanșează blestemul unei lăzi sparte: 2 păianjeni sau 2 nori de furtună (50/50). */
export function triggerCurse(s: GameState, x: number, y: number): void {
  const spiders = nextFloat(s.rng) < 0.5;
  s.events.push({ type: 'curse', x, y, kind: spiders ? 'spiders' : 'storm' });
  for (let i = 0; i < 2; i++) {
    const base = { px: x * U, py: y * U, fx: x, fy: y, tx: x, ty: y, moving: false, life: MOB_LIFE };
    if (spiders) {
      s.spiders.push({
        ...base,
        id: s.nextMobId++,
        dir: 1,
        speed: SPIDER_SPEED + nextInt(s.rng, SPIDER_SPEED_VAR),
        wait: 20 + i * 8,
      });
    } else {
      s.clouds.push({
        ...base,
        id: s.nextMobId++,
        dir: DIRS[(i * 3) % 4]!,
        speed: CLOUD_SPEED + nextInt(s.rng, CLOUD_SPEED_VAR),
        next: 32 + i * 24,
        charge: -1,
        sx: x,
        sy: y,
      });
    }
  }
}

/** Fulgerul: lovește în cruce (centru + 4 vecini), sparge lăzi, declanșează bombe, omoară. */
export function strike(s: GameState, x: number, y: number): void {
  s.events.push({ type: 'strike', x, y });
  for (const [dx, dy] of [[0, 0], ...DIRS.map((d) => [DX[d]!, DY[d]!])] as [number, number][]) {
    const nx = x + dx;
    const ny = y + dy;
    if (!inBounds(s, nx, ny) || tileAt(s, nx, ny) === HARD) continue;
    const k = idx(s, nx, ny);
    if (s.mission && s.grid[k] === SOFT && hitTarget(s, nx, ny, -1, VIA_LIGHTNING)) continue;
    if (s.grid[k] === SOFT) {
      s.grid[k] = EMPTY;
      s.gold[k] = 0;
      s.cursed[k] = 0;
      s.events.push({ type: 'boxDestroyed', x: nx, y: ny, gold: false, cursed: false, owner: -1 });
    }
    const b = bombAt(s, nx, ny);
    if (b) b.fuse = Math.min(b.fuse, 1);
    addFlame(s, nx, ny, -1, VIA_LIGHTNING);
  }
}

function updateSpider(s: GameState, c: Spider): boolean {
  c.life--;
  const cx = mobX(c);
  const cy = mobY(c);
  if (s.flame[idx(s, cx, cy)]! > 0 || c.life <= 0) return false;
  if (c.wait > 0) c.wait--;
  if (!c.moving && c.wait <= 0) {
    const pass = (x: number, y: number) => walkable(s, x, y) && s.flame[idx(s, x, y)]! <= 0;
    // mici ezitări: 30% din decizii sunt la întâmplare
    let d: Dir | null = nextFloat(s.rng) < 0.3 ? null : bfs(s, s.rng, cx, cy, pass, hasPlayer(s));
    if (d === null) {
      const opts = DIRS.filter((dd) => pass(cx + DX[dd]!, cy + DY[dd]!));
      d = opts.length ? opts[nextInt(s.rng, opts.length)]! : null;
    }
    if (d !== null) startMove(c, d);
  }
  if (c.moving && bombAt(s, c.tx, c.ty)) {
    // nu trece de bombe: se întoarce
    [c.tx, c.fx] = [c.fx, c.tx];
    [c.ty, c.fy] = [c.fy, c.ty];
    c.dir = opposite(c.dir);
  }
  advance(c);
  for (const p of s.players) {
    if (!p.alive || p.graceT > 0) continue;
    if (Math.abs(p.px - c.px) + Math.abs(p.py - c.py) >= SPIDER_HIT) continue;
    if (shieldSave(s, p, GRACE)) return false;
    damage(s, p, HURT_SPIDER, null, 'spider');
    // după ce prinde pe cineva, păianjenul dispare (în misiuni doar te rănește și continuă)
    if (!s.rules.health || !p.alive) return false;
  }
  return true;
}

function updateCloud(s: GameState, c: Cloud): boolean {
  if (--c.life <= 0) return false;
  if (!c.moving && c.charge < 0) {
    const cx = mobX(c);
    const cy = mobY(c);
    const pass = (x: number, y: number) => inBounds(s, x, y) && s.grid[idx(s, x, y)] === EMPTY;
    let d: Dir | null = nextFloat(s.rng) < 0.5 ? bfs(s, s.rng, cx, cy, pass, hasPlayer(s)) : null;
    if (d === null) {
      const opts = DIRS.filter((dd) => pass(cx + DX[dd]!, cy + DY[dd]!));
      const fwd = opts.includes(c.dir);
      d = fwd && nextFloat(s.rng) < 0.6 ? c.dir : opts.length ? opts[nextInt(s.rng, opts.length)]! : null;
    }
    if (d !== null) startMove(c, d);
  }
  advance(c);
  if (c.charge >= 0) {
    if (--c.charge <= 0) {
      c.charge = -1;
      strike(s, c.sx, c.sy);
      c.next = 40 + nextInt(s.rng, 31);
    }
  } else if (--c.next <= 0 && !c.moving) {
    c.charge = CLOUD_CHARGE;
    c.sx = mobX(c);
    c.sy = mobY(c);
    s.events.push({ type: 'cloudCharge', id: c.id, x: c.sx, y: c.sy });
  }
  return true;
}

/** Blestemele în așteptare, păianjenii și norii — un tick. */
export function updateMobs(s: GameState): void {
  if (s.curses.length) {
    for (const q of s.curses) if (--q.t === 0) triggerCurse(s, q.x, q.y);
    s.curses = s.curses.filter((q) => q.t > 0);
  }
  if (s.spiders.length)
    s.spiders = s.spiders.filter((c) => {
      if (updateSpider(s, c)) return true;
      s.events.push({ type: 'spiderDie', id: c.id, x: mobX(c), y: mobY(c) });
      return false;
    });
  if (s.clouds.length)
    s.clouds = s.clouds.filter((c) => {
      if (updateCloud(s, c)) return true;
      s.events.push({ type: 'cloudGone', id: c.id });
      return false;
    });
}
