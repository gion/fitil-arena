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
/** Ce controlează un jucător fără om: un nivel de bot sau un manechin (stă pe loc, nu pune bombe). */
export type BotKind = BotLevel | 'dummy';

/** Input-ul unui jucător pentru un tick. `bomb`: 0 nimic, 1 tap, 2 al doilea tap dintr-un dublu tap. */
export interface Input {
  dir: Dir | null;
  bomb?: 0 | 1 | 2;
  detonate?: boolean;
}

export interface Player {
  id: number;
  team: number;
  bot: BotKind | null;
  /** Punctul de start (pentru revenirea în joc). */
  sx: number;
  sy: number;
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
  /** Cum a ajuns bomba unde e: 0 pusă, 1 șutată, 2 aruncată (pentru provocări și statistici). */
  via: BombVia;
}

export type BombVia = 0 | 1 | 2;
/** `flameVia`: 0–2 ca la bombă, 3 = fulger. */
export const VIA_LIGHTNING = 3;

/** Păianjen dintr-o ladă blestemată: aleargă spre cel mai apropiat jucător, atingerea omoară. */
export interface Spider {
  id: number;
  px: number;
  py: number;
  fx: number;
  fy: number;
  tx: number;
  ty: number;
  moving: boolean;
  dir: Dir;
  speed: number;
  life: number;
  wait: number;
}

/** Nor de furtună: plutește, se oprește, se încarcă (zonă anunțată) și trăsnește în cruce. */
export interface Cloud {
  id: number;
  px: number;
  py: number;
  fx: number;
  fy: number;
  tx: number;
  ty: number;
  moving: boolean;
  dir: Dir;
  speed: number;
  life: number;
  /** Tick-uri până la următoarea încărcare. */
  next: number;
  /** Tick-uri până la fulger (-1 = nu se încarcă). */
  charge: number;
  sx: number;
  sy: number;
}

/** Rânduri mobile: un rând (axis 0) sau o coloană (axis 1) anunțată, apoi alunecă pas cu pas. */
export interface Shift {
  axis: 0 | 1;
  idx: number;
  dir: 1 | -1;
  /** Tick-uri de avertizare rămase (dungă roșie). */
  warn: number;
  steps: number;
  /** Tick-uri de la ultimul pas (pentru animație). */
  stepT: number;
}

/** Arena rotativă: unghi și viteză în micro-grade (întregi, deterministe). */
export interface Rotation {
  a: number;
  v: number;
}

export interface Flag {
  team: number;
  hx: number;
  hy: number;
  x: number;
  y: number;
  carrier: number | null;
  /** Tick-uri până revine singur acasă (când e căzut). */
  dropT: number;
  atHome: boolean;
}

export interface Ctf {
  flags: [Flag, Flag];
  caps: [number, number];
  need: number;
}
export type DeathCause = 'flame' | 'hurry' | 'spider' | 'lightning' | 'crush';
export type MaxStat = 'speed' | 'bombs' | 'fire';

export type GameEvent =
  | { type: 'bombPlaced'; bomb: number; x: number; y: number; owner: number }
  | { type: 'explode'; bomb: number; x: number; y: number; range: number; owner: number; chain: number }
  | { type: 'boxDestroyed'; x: number; y: number; gold: boolean; cursed: boolean }
  | { type: 'death'; player: number; killerId: number | null; cause: DeathCause; via: number }
  | { type: 'pickup'; player: number; item: ItemType; x: number; y: number }
  | { type: 'maxed'; player: number; stat: MaxStat }
  | { type: 'curse'; x: number; y: number; kind: 'spiders' | 'storm' }
  | { type: 'spiderDie'; id: number; x: number; y: number }
  | { type: 'cloudCharge'; id: number; x: number; y: number }
  | { type: 'strike'; x: number; y: number }
  | { type: 'cloudGone'; id: number }
  | { type: 'shiftWarn'; axis: 0 | 1; idx: number; dir: 1 | -1 }
  | { type: 'shiftStep'; axis: 0 | 1; idx: number; dir: 1 | -1 }
  | { type: 'pushed'; player: number; x: number; y: number }
  | { type: 'rotFlip' }
  | { type: 'flagTake'; team: number; player: number }
  | { type: 'flagDrop'; team: number; x: number; y: number }
  | { type: 'flagReturn'; team: number; player: number | null }
  | { type: 'capture'; team: number; player: number; caps: [number, number] }
  | { type: 'respawn'; player: number }
  | { type: 'shieldSaved'; player: number }
  | { type: 'kick'; player: number; bomb: number }
  | { type: 'lift'; player: number; bomb: number }
  | { type: 'throw'; player: number; bomb: number }
  | { type: 'land'; bomb: number; x: number; y: number }
  | { type: 'teleport'; kind: 'player' | 'bomb'; id: number; x: number; y: number }
  | { type: 'portalOpen'; pads: [number, number][] }
  | { type: 'portalClose' }
  | { type: 'boxSpawn'; x: number; y: number; gold: boolean; cursed: boolean }
  | { type: 'hurryUp' }
  | { type: 'blockFall'; x: number; y: number }
  | { type: 'roundEnd'; winner: number | null; team: number | null };

/** `teams` și `ctf` sunt moduri pe echipe (foc prieten oprit implicit). */
export type Mode = 'ffa' | 'teams' | 'ctf';

export interface Rules {
  width: number;
  height: number;
  mode: Mode;
  /** Probabilitatea unei lăzi pe un pătrățel liber (0.7 în prototip). */
  softDensity: number;
  /** Proporția de lăzi aurii (0.045; 0.07 în 1 vs 1). */
  goldRate: number;
  /** Proporția de lăzi blestemate (0.025; 0.02 în 1 vs 1). */
  curseRate: number;
  boxRespawn: boolean;
  /** În modurile pe echipe: bombele coechipierilor (și ale tale) te rănesc. */
  friendlyFire: boolean;
  /** Revenire în joc după N tick-uri (0 = eliminare definitivă). */
  respawnTicks: number;
  /** Scut primit la revenire (tick-uri). */
  respawnShield: number;
  /** Limita de timp a rundei (0 = fără). */
  timeLimit: number;
  /** Rânduri mobile. */
  shift: boolean;
  /** Arena rotativă. */
  rotate: boolean;
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
  cursed: number[];
  flameVia: number[];
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
  /** Lăzi blestemate sparte, care se declanșează după `t` tick-uri. */
  curses: { x: number; y: number; t: number }[];
  spiders: Spider[];
  clouds: Cloud[];
  nextMobId: number;
  shift: Shift | null;
  shiftNext: number;
  rot: Rotation | null;
  ctf: Ctf | null;
  result: GameResult | null;
  events: GameEvent[];
}
