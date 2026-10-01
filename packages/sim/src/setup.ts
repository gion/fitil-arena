import {
  CROWN_NEED,
  CROWN_TIME,
  CTF_NEED,
  CTF_TIME,
  FUSE,
  MAX_BOMBS,
  MAX_LIVES,
  MAX_RANGE,
  POTATO_FIRST,
  RESPAWN,
  RESPAWN_SHIELD,
  SHIFT_FIRST,
  SPEED_MAX,
  SPEED_MIN,
  SPEED_START,
  SPEED_STEP,
  sec,
} from './constants.ts';
import { countSoft, idx, inBounds } from './grid.ts';
import { applyItem } from './items.ts';
import { INF_S, ensureWindow } from './world.ts';
import { createRng, nextFloat, shuffle } from './rng.ts';
import type { RngState } from './rng.ts';
import { DIRS, DX, DY, EMPTY, HARD, SOFT, U } from './types.ts';
import type { BotKind, Dir, Flag, GameState, HeroSpec, ItemType, Player, Rules } from './types.ts';

export const DEFAULT_RULES: Rules = {
  width: 15,
  height: 11,
  mode: 'ffa',
  softDensity: 0.7,
  goldRate: 0.045,
  curseRate: 0.025,
  boxRespawn: true,
  friendlyFire: false,
  respawnTicks: 0,
  respawnShield: 0,
  timeLimit: 0,
  shift: false,
  rotate: false,
  infinite: false,
  health: false,
  hearts: false,
  hurryUpTick: sec(90),
  hurryEvery: 6,
  startItems: [],
  lives: 1,
  extras: false,
  bushRate: 0,
  dropPct: 100,
  kickPct: 100,
  throwExtra: 0,
  fuse: FUSE,
  event: null,
};

export const isTeamMode = (r: Rules): boolean => r.mode === 'teams' || r.mode === 'ctf';

export interface PlayerSetup {
  bot: BotKind | null;
  team?: number;
  /** Personajul (cu afinitățile aplicate); lipsă = jucător fără personaj. */
  hero?: HeroSpec;
}

export interface GameSetup {
  seed: number;
  rules?: Partial<Rules>;
  players: PlayerSetup[];
}

/** Grila adaptată la proporția ecranului (regula din GAME_DESIGN): 11 pe latura scurtă, impar 13–27 pe cea lungă. */
export function gridForAspect(aspect: number): { width: number; height: number } {
  const odd = (v: number) => {
    const r = Math.round(v);
    return r % 2 ? r : r + 1;
  };
  if (aspect >= 1) return { width: Math.min(27, Math.max(13, odd(11 * aspect))), height: 11 };
  return { width: 11, height: Math.min(25, Math.max(13, odd(11 / aspect))) };
}

/** Preset 1 vs 1: arenă 11×11, lăzi aurii mai dese, 3 bonusuri de start identice alese din seed. */
export function duelRules(seed: number): Partial<Rules> {
  const pool: ItemType[] = ['bomb', 'fire', 'speed', 'kick', 'glove', 'remote', 'line'];
  return {
    width: 11,
    height: 11,
    goldRate: 0.07,
    curseRate: 0.02,
    startItems: shuffle(createRng(seed ^ 0x5eed), pool).slice(0, 3),
  };
}

/** Arena rotativă: pătrată 11×11, toți contra toți. */
export const rotateRules = (): Partial<Rules> => ({ width: 11, height: 11, rotate: true });

/** Rânduri mobile: toți contra toți pe grila adaptată la ecran. */
export const shiftRules = (aspect: number): Partial<Rules> => ({ ...gridForAspect(aspect), shift: true });

/** Coroana: toți contra toți, revii după 3s; câștigă cine ține coroana 60s (sau cel mai mult în 2.5 min). */
export const crownRules = (aspect: number): Partial<Rules> => ({
  ...gridForAspect(aspect),
  mode: 'crown',
  respawnTicks: RESPAWN,
  respawnShield: RESPAWN_SHIELD,
  timeLimit: CROWN_TIME,
  hurryUpTick: 0,
});

/** Cartoful fierbinte: toți contra toți, eliminare; cartoful explodează în mâna cui îl ține. */
export const potatoRules = (aspect: number): Partial<Rules> => ({
  ...gridForAspect(aspect),
  mode: 'potato',
  softDensity: 0.5,
});

/** Capturează steagul 3v3: fără eliminare (revii după 3s cu 2s de scut), 3 capturi sau 3 minute. */
export const ctfRules = (aspect: number): Partial<Rules> => ({
  ...gridForAspect(aspect),
  mode: 'ctf',
  respawnTicks: RESPAWN,
  respawnShield: RESPAWN_SHIELD,
  timeLimit: CTF_TIME,
  hurryUpTick: 0,
});

function spawnPoints(W: number, H: number, setup: PlayerSetup[], mode: Rules['mode']): [number, number][] {
  if (mode !== 'ffa') {
    const my = (H - 1) / 2;
    const mx = (W - 1) / 2;
    const midA = my % 2 ? my : my + 1;
    const midB = my % 2 ? my : my - 1;
    const colA = mx % 2 ? mx : mx + 1;
    const colB = mx % 2 ? mx : mx - 1;
    const A: [number, number][] =
      W >= H
        ? [
            [1, 1],
            [1, H - 2],
            [1, midA],
          ]
        : [
            [1, 1],
            [W - 2, 1],
            [colA, 1],
          ];
    const B: [number, number][] =
      W >= H
        ? [
            [W - 2, H - 2],
            [W - 2, 1],
            [W - 2, midB],
          ]
        : [
            [W - 2, H - 2],
            [1, H - 2],
            [colB, H - 2],
          ];
    const counters = [0, 0];
    return setup.map((ps, i) => {
      const t = (ps.team ?? i % 2) === 1 ? 1 : 0;
      const list = t ? B : A;
      const pt = list[counters[t]! % list.length]!;
      counters[t]!++;
      return pt;
    });
  }
  const corners: [number, number][] =
    setup.length === 2
      ? [
          [1, 1],
          [W - 2, H - 2],
        ]
      : [
          [1, 1],
          [W - 2, H - 2],
          [W - 2, 1],
          [1, H - 2],
        ];
  return setup.map((_, i) => corners[i % corners.length]!);
}

export function makePlayer(id: number, team: number, bot: BotKind | null, x: number, y: number): Player {
  return {
    id,
    team,
    bot,
    sx: x,
    sy: y,
    px: x * U,
    py: y * U,
    fx: x,
    fy: y,
    tx: x,
    ty: y,
    moving: false,
    dir: 1,
    face: 1,
    speed: SPEED_START,
    bombs: 1,
    range: 1,
    active: 0,
    kick: false,
    glove: false,
    remote: false,
    line: false,
    carry: null,
    tpLock: -1,
    revT: 0,
    hicT: 0,
    hicCd: 0,
    dizzyT: 0,
    shieldT: 0,
    graceT: 0,
    hp: 100,
    alive: true,
    deathTick: -1,
    killerId: null,
    lastTapPlaced: false,
    botCd: 12,
    hero: null,
    charge: 0,
    lives: 1,
    guard: 0,
    specials: [],
    frozenT: 0,
    blindT: 0,
    toxT: 0,
    hexT: 0,
    crownT: 0,
  };
}

/** Statisticile de start ale personajului (după afinități) și inimile meciului. */
export function applyHero(p: Player, hero: HeroSpec | null, rules: Rules): void {
  p.hero = hero;
  p.lives = Math.min(MAX_LIVES, Math.max(1, rules.lives + (hero?.lives ?? 0)));
  if (!hero) return;
  const base = SPEED_START + hero.speedSteps * SPEED_STEP;
  p.speed = Math.min(SPEED_MAX, Math.max(SPEED_MIN, Math.floor((base * hero.speedPct) / 100)));
  p.bombs = Math.min(MAX_BOMBS, Math.max(1, 1 + hero.bombs));
  p.range = Math.min(MAX_RANGE, Math.max(1, 1 + hero.range));
  p.kick = hero.kick;
  p.guard = hero.passive === 'guard' ? 1 : 0;
}

/** Ordinea în spirală (din margine spre centru) în care cad blocurile la „hurry up”. */
function spiralOrder(W: number, H: number): number[] {
  const out: number[] = [];
  let x0 = 1;
  let y0 = 1;
  let x1 = W - 2;
  let y1 = H - 2;
  while (x0 <= x1 && y0 <= y1) {
    for (let x = x0; x <= x1; x++) out.push(y0 * W + x);
    for (let y = y0 + 1; y <= y1; y++) out.push(y * W + x1);
    if (y1 > y0) for (let x = x1 - 1; x >= x0; x--) out.push(y1 * W + x);
    if (x1 > x0) for (let y = y1 - 1; y > y0; y--) out.push(y * W + x0);
    x0++;
    y0++;
    x1--;
    y1--;
  }
  return out;
}

export function createGame(setup: GameSetup): GameState {
  const rules: Rules = { ...DEFAULT_RULES, ...setup.rules };
  const inf = rules.infinite;
  // lumea infinită: stocare circulară INF_S×INF_S (nu o hartă cu margini)
  const W = inf ? INF_S : rules.width;
  const H = inf ? INF_S : rules.height;
  if (!inf && (W % 2 === 0 || H % 2 === 0 || W < 7 || H < 7))
    throw new Error(`dimensiuni invalide ${W}×${H} (impare, ≥ 7)`);
  const rng = createRng(setup.seed);
  const N = W * H;
  const s: GameState = {
    seed: setup.seed,
    tick: 0,
    rng,
    rules,
    W,
    H,
    grid: new Array<number>(N).fill(EMPTY),
    flame: new Array<number>(N).fill(0),
    flameOwner: new Array<number>(N).fill(-1),
    items: new Array<ItemType | null>(N).fill(null),
    drops: new Array<ItemType | null>(N).fill(null),
    gold: new Array<number>(N).fill(0),
    cursed: new Array<number>(N).fill(0),
    flameVia: new Array<number>(N).fill(0),
    flameKind: new Array<number>(N).fill(0),
    toxic: new Array<number>(N).fill(0),
    toxicOwner: new Array<number>(N).fill(-1),
    bush: new Array<number>(N).fill(0),
    traps: [],
    timeStop: null,
    crown: null,
    potato: null,
    players: [],
    bombs: [],
    nextBombId: 1,
    softStart: 0,
    boxTimer: sec(4),
    pads: [],
    portalT: 0,
    chainSeq: 0,
    chainCount: {},
    hurryIdx: 0,
    hurryOrder: inf ? [] : spiralOrder(W, H),
    curses: [],
    spiders: [],
    clouds: [],
    nextMobId: 1,
    shift: null,
    shiftNext: SHIFT_FIRST,
    rot: rules.rotate ? { a: 0, v: 0 } : null,
    ctf: null,
    inf: inf
      ? {
          S: INF_S,
          ownX: new Array<number>(N).fill(0x7fffffff),
          ownY: new Array<number>(N).fill(0x7fffffff),
          cx: 1,
          cy: 1,
        }
      : null,
    mission: null,
    result: null,
    events: [],
  };

  const spawns: [number, number][] = inf
    ? setup.players.map(() => [1, 1])
    : spawnPoints(W, H, setup.players, rules.mode);
  const safe = new Set<number>();
  for (const [x, y] of spawns) {
    safe.add(idx(s, x, y));
    for (const d of DIRS) if (inBounds(s, x + DX[d]!, y + DY[d]!)) safe.add(idx(s, x + DX[d]!, y + DY[d]!));
  }
  if (inf) ensureWindow(s, 1, 1);
  else
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const k = idx(s, x, y);
        if (x === 0 || y === 0 || x === W - 1 || y === H - 1 || (x % 2 === 0 && y % 2 === 0))
          s.grid[k] = HARD;
        else if (!safe.has(k) && nextFloat(rng) < rules.softDensity) {
          s.grid[k] = SOFT;
          const r = nextFloat(rng);
          if (r < rules.goldRate) s.gold[k] = 1;
          else if (r < rules.goldRate + rules.curseRate) s.cursed[k] = 1;
        }
      }
  if (rules.mode === 'ctf') setupCtf(s, spawns, setup.players, rng);
  if (rules.mode === 'crown') setupCrown(s);
  if (rules.mode === 'potato') s.potato = { holder: null, fuse: 0, cd: POTATO_FIRST };
  if (rules.bushRate > 0 && !inf)
    for (let k = 0; k < N; k++)
      if (s.grid[k] === EMPTY && !safe.has(k) && nextFloat(rng) < rules.bushRate) s.bush[k] = 1;
  s.softStart = countSoft(s);

  s.players = setup.players.map((ps, i) => {
    const [x, y] = spawns[i]!;
    const team = isTeamMode(rules) ? (ps.team ?? i % 2) : i;
    const p = makePlayer(i, team, ps.bot, x, y);
    applyHero(p, ps.hero ?? null, rules);
    const open = DIRS.find((d: Dir) => s.grid[idx(s, x + DX[d]!, y + DY[d]!)] === EMPTY);
    if (open !== undefined) p.face = open;
    for (const it of rules.startItems) applyItem(p, it);
    return p;
  });
  return s;
}

/** Coroana pornește din centrul arenei; se curăță 3×3 în jur. */
function setupCrown(s: GameState): void {
  let cx = (s.W - 1) >> 1;
  let cy = (s.H - 1) >> 1;
  if (s.grid[idx(s, cx, cy)] === HARD) cx += cx + 1 < s.W - 1 ? 1 : -1;
  if (s.grid[idx(s, cx, cy)] === HARD) cy += 1;
  for (let y = cy - 1; y <= cy + 1; y++)
    for (let x = cx - 1; x <= cx + 1; x++)
      if (inBounds(s, x, y) && s.grid[idx(s, x, y)] === SOFT) clearBox(s, idx(s, x, y));
  s.crown = { x: cx, y: cy, holder: null, need: CROWN_NEED };
}

const clearBox = (s: GameState, k: number): void => {
  s.grid[k] = EMPTY;
  s.gold[k] = 0;
  s.cursed[k] = 0;
};

/**
 * Capturează steagul: bazele sunt la mijlocul laturii fiecărei echipe (al treilea punct de start).
 * Se curăță 5×5 în jurul bazelor, 45% din lăzile obișnuite și 75% din culoarul dintre baze.
 */
function setupCtf(s: GameState, spawns: [number, number][], setup: PlayerSetup[], rng: RngState): void {
  const homeOf = (team: number): [number, number] => {
    const own = spawns.filter((_, i) => (setup[i]!.team ?? i % 2) === team);
    return own[2] ?? own[own.length - 1] ?? spawns[team]!;
  };
  const homes = [homeOf(0), homeOf(1)] as const;
  for (const [hx, hy] of homes)
    for (let y = hy - 2; y <= hy + 2; y++)
      for (let x = hx - 2; x <= hx + 2; x++)
        if (inBounds(s, x, y) && s.grid[idx(s, x, y)] === SOFT) clearBox(s, idx(s, x, y));
  for (let k = 0; k < s.grid.length; k++)
    if (s.grid[k] === SOFT && !s.gold[k] && !s.cursed[k] && nextFloat(rng) < 0.45) clearBox(s, k);
  const [[ax, ay], [bx, by]] = homes;
  if (ay === by) {
    for (let x = 1; x < s.W - 1; x++) {
      const k = idx(s, x, ay);
      if (s.grid[k] === SOFT && nextFloat(rng) < 0.75) clearBox(s, k);
    }
  } else if (ax === bx) {
    for (let y = 1; y < s.H - 1; y++) {
      const k = idx(s, ax, y);
      if (s.grid[k] === SOFT && nextFloat(rng) < 0.75) clearBox(s, k);
    }
  }
  const flag = (team: number): Flag => {
    const [hx, hy] = homes[team]!;
    return { team, hx, hy, x: hx, y: hy, carrier: null, dropT: 0, atHome: true };
  };
  s.ctf = { flags: [flag(0), flag(1)], caps: [0, 0], need: CTF_NEED };
}
