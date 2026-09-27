import { SPEED_START, sec } from './constants.ts';
import { countSoft, idx, inBounds } from './grid.ts';
import { applyItem } from './items.ts';
import { createRng, nextFloat, shuffle } from './rng.ts';
import { DIRS, DX, DY, EMPTY, HARD, SOFT, U } from './types.ts';
import type { BotLevel, Dir, GameState, ItemType, Player, Rules } from './types.ts';

export const DEFAULT_RULES: Rules = {
  width: 15,
  height: 11,
  mode: 'ffa',
  softDensity: 0.7,
  goldRate: 0.045,
  boxRespawn: true,
  hurryUpTick: sec(90),
  hurryEvery: 6,
  startItems: [],
};

export interface PlayerSetup {
  bot: BotLevel | null;
  team?: number;
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
    startItems: shuffle(createRng(seed ^ 0x5eed), pool).slice(0, 3),
  };
}

function spawnPoints(W: number, H: number, setup: PlayerSetup[], mode: Rules['mode']): [number, number][] {
  if (mode === 'teams') {
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
    return setup.map((ps) => {
      const t = ps.team === 1 ? 1 : 0;
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

export function makePlayer(id: number, team: number, bot: BotLevel | null, x: number, y: number): Player {
  return {
    id,
    team,
    bot,
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
    alive: true,
    deathTick: -1,
    killerId: null,
    lastTapPlaced: false,
    botCd: 12,
  };
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
  const W = rules.width;
  const H = rules.height;
  if (W % 2 === 0 || H % 2 === 0 || W < 7 || H < 7)
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
    hurryOrder: spiralOrder(W, H),
    result: null,
    events: [],
  };

  const spawns = spawnPoints(W, H, setup.players, rules.mode);
  const safe = new Set<number>();
  for (const [x, y] of spawns) {
    safe.add(idx(s, x, y));
    for (const d of DIRS) if (inBounds(s, x + DX[d]!, y + DY[d]!)) safe.add(idx(s, x + DX[d]!, y + DY[d]!));
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const k = idx(s, x, y);
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1 || (x % 2 === 0 && y % 2 === 0)) s.grid[k] = HARD;
      else if (!safe.has(k) && nextFloat(rng) < rules.softDensity) {
        s.grid[k] = SOFT;
        if (nextFloat(rng) < rules.goldRate) s.gold[k] = 1;
      }
    }
  s.softStart = countSoft(s);

  s.players = setup.players.map((ps, i) => {
    const [x, y] = spawns[i]!;
    const team = rules.mode === 'teams' ? (ps.team ?? i % 2) : i;
    const p = makePlayer(i, team, ps.bot, x, y);
    const open = DIRS.find((d: Dir) => s.grid[idx(s, x + DX[d]!, y + DY[d]!)] === EMPTY);
    if (open !== undefined) p.face = open;
    for (const it of rules.startItems) applyItem(p, it);
    return p;
  });
  return s;
}
