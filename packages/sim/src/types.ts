import type { RngState } from './rng.ts';

/** Tipuri de pătrățele. */
export const EMPTY = 0;
export const HARD = 1;
export const SOFT = 2;
export type Tile = typeof EMPTY | typeof HARD | typeof SOFT;

/** Direcții: 0 sus, 1 jos, 2 stânga, 3 dreapta (aceeași ordine ca în prototip). */
export type Dir = 0 | 1 | 2 | 3;
export const DIRS: readonly Dir[] = [0, 1, 2, 3];
export const DX: readonly number[] = [0, 0, -1, 1];
export const DY: readonly number[] = [-1, 1, 0, 0];
export const opposite = (d: Dir): Dir => (d ^ 1) as Dir;

/** Unități de poziție pe pătrățel. Pozițiile sunt întregi ca simularea să fie identică pe orice platformă. */
export const U = 1000;

export type PositiveItem = 'bomb' | 'fire' | 'speed' | 'kick' | 'glove' | 'remote' | 'line' | 'shield';
export type NegativeItem = 'slow' | 'shrink' | 'fewer' | 'reverse' | 'hiccup' | 'dizzy';
export type GoldItem = 'maxspeed' | 'maxfire' | 'maxbomb';
export type ItemType = PositiveItem | NegativeItem | GoldItem;

export type BotLevel = 'easy' | 'normal' | 'hard' | 'insane';

/** Input-ul unui jucător pentru un tick. `bomb`: 0 nimic, 1 tap, 2 al doilea tap dintr-un dublu tap. */
export interface Input {
  dir: Dir | null;
  bomb?: 0 | 1 | 2;
  detonate?: boolean;
}

export interface Player {
  id: number;
  team: number;
  bot: BotLevel | null;
  /** Poziție în unități (pătrățel × U). */
  px: number;
  py: number;
  fx: number;
  fy: number;
  tx: number;
  ty: number;
  moving: boolean;
  dir: Dir;
  face: Dir;
  /** Viteză în unități pe tick. */
  speed: number;
  bombs: number;
  range: number;
  active: number;
  kick: boolean;
  glove: boolean;
  remote: boolean;
  line: boolean;
  carry: number | null;
  tpLock: number;
  revT: number;
  hicT: number;
  hicCd: number;
  dizzyT: number;
  shieldT: number;
  graceT: number;
  alive: boolean;
  deathTick: number;
  killerId: number | null;
  lastTapPlaced: boolean;
  botCd: number;
}

export interface Fly {
  sx: number;
  sy: number;
  dir: Dir;
  steps: number;
  t: number;
  dur: number;
}

export interface Bomb {
  id: number;
  x: number;
  y: number;
  fuse: number;
  range: number;
  owner: number;
  remote: boolean;
  slide: Dir | null;
  prog: number;
  held: number | null;
  fly: Fly | null;
  chain: number;
  tpLock: number;
}

export type DeathCause = 'flame' | 'hurry';

export type GameEvent =
  | { type: 'bombPlaced'; bomb: number; x: number; y: number; owner: number }
  | { type: 'explode'; bomb: number; x: number; y: number; range: number; owner: number; chain: number }
  | { type: 'boxDestroyed'; x: number; y: number; gold: boolean }
  | { type: 'death'; player: number; killerId: number | null; cause: DeathCause }
  | { type: 'pickup'; player: number; item: ItemType; x: number; y: number }
  | { type: 'shieldSaved'; player: number }
  | { type: 'kick'; player: number; bomb: number }
  | { type: 'lift'; player: number; bomb: number }
  | { type: 'throw'; player: number; bomb: number }
  | { type: 'land'; bomb: number; x: number; y: number }
  | { type: 'teleport'; kind: 'player' | 'bomb'; id: number; x: number; y: number }
  | { type: 'portalOpen'; pads: [number, number][] }
  | { type: 'portalClose' }
  | { type: 'boxSpawn'; x: number; y: number; gold: boolean }
  | { type: 'hurryUp' }
  | { type: 'blockFall'; x: number; y: number }
  | { type: 'roundEnd'; winner: number | null; team: number | null };

export type Mode = 'ffa' | 'teams';

export interface Rules {
  width: number;
  height: number;
  mode: Mode;
  /** Probabilitatea unei lăzi pe un pătrățel liber (0.7 în prototip). */
  softDensity: number;
  /** Proporția de lăzi aurii (0.045; 0.07 în 1 vs 1). */
  goldRate: number;
  boxRespawn: boolean;
  /** Tick-ul la care începe „hurry up” (0 = dezactivat). */
  hurryUpTick: number;
  /** Tick-uri între două blocuri căzute în hurry up. */
  hurryEvery: number;
  /** Bonusuri primite de toți la start (1 vs 1). */
  startItems: ItemType[];
}

export interface GameResult {
  winner: number | null;
  team: number | null;
  tick: number;
}

export interface GameState {
  seed: number;
  tick: number;
  rng: RngState;
  rules: Rules;
  W: number;
  H: number;
  grid: number[];
  flame: number[];
  flameOwner: number[];
  items: (ItemType | null)[];
  drops: (ItemType | null)[];
  gold: number[];
  players: Player[];
  bombs: Bomb[];
  nextBombId: number;
  softStart: number;
  boxTimer: number;
  pads: [number, number][];
  portalT: number;
  chainSeq: number;
  chainCount: Record<number, number>;
  hurryIdx: number;
  hurryOrder: number[];
  result: GameResult | null;
  events: GameEvent[];
}
