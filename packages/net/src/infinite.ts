import {
  CHUNK,
  CHUNK_CELLS,
  FLAME,
  INF_R,
  TICK_HZ,
  U,
  chunkKey,
  chunkOf,
  createGame,
  genCell,
  idx,
  inBounds,
  infRanking,
  infScore,
  infiniteRules,
  joinWorld,
  keyCx,
  keyCy,
  leaveWorld,
  loadChunk,
  makePlayer,
  step,
  tileX,
  tileY,
  unloadChunk,
} from '@fitil/sim';
import type { Bomb, BombKind, Dir, GameEvent, GameState, Input, ItemType, Player, Rules } from '@fitil/sim';
import { charSetup, cleanOutfit } from '@fitil/content';
import type { Outfit } from '@fitil/content';
import type { Link } from './client.ts';
import { NO_INPUT, decodeInput, encodeInput } from './protocol.ts';
import type { MeMsg, SlotInfo } from './protocol.ts';

/*
 * Modul Infinit online (Faza 7, D-070): stare filtrată per client, nu input-uri (D-030 nu merge pentru
 * 30–80 de oameni într-o lume nemărginită). Serverul rulează simularea; fiecare client primește doar
 * chunk-urile din jurul lui (ca diferențe față de lumea generată, pe care o generează singur din seed),
 * schimbările de celule, jucătorii, bombele și evenimentele din zonă.
 */

/** Câți oameni încap într-o instanță; când se umple, se deschide alta (shard). */
export const INF_MAX = 80;
/** Clasamentul și minimapa se trimit o dată pe secundă. */
export const BOARD_EVERY = TICK_HZ;
/** Cât rămâne „cald” un chunk după ce s-a întâmplat ceva în el (se compară celulele doar pe cele calde). */
const HOT_TICKS = 10 * TICK_HZ;
/** Câte chunk-uri reci se verifică oricum pe tick (plasă de siguranță). */
const COLD_PER_TICK = 4;
/** Coada de input-uri per jucător (ca în `ArenaHost`). */
const MAX_QUEUE = 2;

/** Toate bonusurile, în ordinea codurilor de pe fir (0 = nimic). */
export const ITEM_CODES: readonly ItemType[] = [
  'bomb',
  'fire',
  'speed',
  'kick',
  'glove',
  'remote',
  'line',
  'shield',
  'slow',
  'shrink',
  'fewer',
  'reverse',
  'hiccup',
  'dizzy',
  'maxspeed',
  'maxfire',
  'maxbomb',
  'heart',
  'crystal',
  'ice',
  'flash',
  'poison',
  'hex',
];
const ITEM_INDEX = new Map(ITEM_CODES.map((it, i) => [it, i + 1]));
const BOMB_KINDS: readonly BombKind[] = ['normal', 'ice', 'flash', 'poison'];

/* ---------- mesaje ---------- */

/** Server → client, la intrare: tot ce trebuie ca să generezi lumea și să știi cine ești. */
export interface InfWelcome {
  seed: number;
  rules: Rules;
  me: number;
  tick: number;
  theme: string;
  /** Instanța (shard-ul) în care ai intrat. */
  shard: string;
  roster: InfRosterEntry[];
}

/** Un jucător din instanță: id, nume, personaj, ținută. */
export type InfRosterEntry = [number, string, string | null, Outfit | null];

export interface InfRoster {
  add?: InfRosterEntry[];
  del?: number[];
}

/**
 * Statisticile tale (cele care nu se văd la ceilalți). Cronometrele sunt rotunjite în sus la secunde,
 * ca mesajul să se schimbe rar.
 */
export type InfMe = Pick<
  Player,
  | 'bombs'
  | 'maxBombs'
  | 'range'
  | 'speed'
  | 'active'
  | 'kick'
  | 'glove'
  | 'remote'
  | 'line'
  | 'charges'
  | 'lives'
  | 'charge'
  | 'specials'
  | 'shieldT'
  | 'dizzyT'
  | 'revT'
  | 'hicT'
  | 'hexT'
  | 'frozenT'
  | 'blindT'
  | 'carry'
  | 'kills'
  | 'boxes'
  | 'far'
  | 'alive'
  | 'deathTick'
  | 'killerId'
>;

/** Server → client, la fiecare tick. */
export interface InfFrame {
  t: number;
  /** Ultimul input al tău consumat. */
  a: number;
  /** Chunk-uri intrate în zonă: [cheie, [index în chunk, cod, …]] — doar celulele diferite de lumea generată. */
  in?: [number, number[]][];
  /** Chunk-uri ieșite din zonă. */
  out?: number[];
  /** Celule schimbate în zonă: [x, y, cod, x, y, cod, …]. */
  c?: number[];
  /** Jucătorii din zonă care s-au schimbat față de ce ai primit (`packPlayer`); ceilalți rămân la fel. */
  p: number[][];
  /** Jucătorii ieșiți din zonă. */
  pg?: number[];
  /** Bombele noi sau schimbate (`packBomb`); celelalte își scad singure fitilul. */
  b: number[][];
  /** Bombele dispărute (explodate sau ieșite din zonă). */
  bg?: number[];
  /** Păianjeni [id, px, py, dir, mers, viață] și nori [id, px, py, dir, mers, viață, încărcare, sx, sy] din zonă (rar). */
  m?: { s: number[][]; c: number[][] };
  e?: GameEvent[];
  me?: InfMe;
  pads?: [number, number][];
}

/** Server → client, o dată pe secundă: top 10, locul tău, minimapa. */
export interface InfBoard {
  /** [id, scor, eliminări] */
  top: [number, number, number][];
  /** [loc, scor] */
  you: [number, number];
  /** Oameni în instanță. */
  n: number;
  /** Puncte pe minimapă: [id, x, y] — top 10 și tu. */
  map: [number, number, number][];
}

/* ---------- codificarea celulelor, jucătorilor și bombelor ---------- */

/** Codul vizibil al celulei k (fără `drops`, care sunt ascunse până se stinge flacăra). */
export function cellCode(s: GameState, k: number): number {
  return (
    s.grid[k]! |
    (s.gold[k]! << 2) |
    (s.cursed[k]! << 3) |
    ((s.flame[k]! > 0 ? 1 : 0) << 4) |
    ((s.flameKind[k]! & 3) << 5) |
    ((s.items[k] ? (ITEM_INDEX.get(s.items[k]) ?? 0) : 0) << 7) |
    ((s.bush[k] ? 1 : 0) << 12) |
    ((s.toxic[k]! > 0 ? 1 : 0) << 13) |
    ((s.oil[k]! > 0 ? 1 : 0) << 14) |
    ((s.smoke[k]! > 0 ? 1 : 0) << 15)
  );
}

/** Codul celulei așa cum o generează lumea (ce are clientul fără să i se spună nimic). */
function genCode(s: GameState, x: number, y: number): number {
  const c = genCell(s, x, y);
  return c.g | ((c.gold ? 1 : 0) << 2) | ((c.cursed ? 1 : 0) << 3);
}

/** Scrie un cod de celulă în starea clientului. */
export function applyCell(s: GameState, k: number, code: number): void {
  s.grid[k] = code & 3;
  s.gold[k] = (code >> 2) & 1;
  s.cursed[k] = (code >> 3) & 1;
  const on = (code >> 4) & 1;
  if (!on) s.flame[k] = 0;
  else if (s.flame[k]! <= 0) s.flame[k] = FLAME;
  s.flameKind[k] = (code >> 5) & 3;
  const it = (code >> 7) & 31;
  s.items[k] = it ? (ITEM_CODES[it - 1] ?? null) : null;
  s.bush[k] = (code >> 12) & 1;
  s.toxic[k] = (code >> 13) & 1 ? 20 : 0;
  s.oil[k] = (code >> 14) & 1 ? 10 : 0;
  s.smoke[k] = (code >> 15) & 1 ? 20 : 0;
}

const bit = (v: boolean | number, n: number): number => (v ? 1 << n : 0);

/** [id, px, py, biți, deathTick] — biți: dir, privire, mers, viu, scut, invulnerabil, înghețat, ascuns, amețit, blestem, orbit, ține bombă, inversat. */
export function packPlayer(p: Player): number[] {
  const b =
    p.dir |
    (p.face << 2) |
    bit(p.moving, 4) |
    bit(p.alive, 5) |
    bit(p.shieldT > 0, 6) |
    bit(p.graceT > 0, 7) |
    bit(p.frozenT > 0, 8) |
    bit(p.hiddenT > 0, 9) |
    bit(p.dizzyT > 0, 10) |
    bit(p.hexT > 0, 11) |
    bit(p.blindT > 0, 12) |
    bit(p.carry !== null, 13) |
    bit(p.revT > 0, 14);
  return [p.id, p.px, p.py, b, p.deathTick];
}

/** Aplică un jucător primit peste locul lui din starea clientului. */
export function unpackPlayer(p: Player, w: number[]): void {
  const [, px, py, b, death] = w as [number, number, number, number, number];
  p.px = px;
  p.py = py;
  p.fx = p.tx = Math.floor((px + U / 2) / U);
  p.fy = p.ty = Math.floor((py + U / 2) / U);
  p.dir = (b & 3) as Dir;
  p.face = ((b >> 2) & 3) as Dir;
  p.moving = !!((b >> 4) & 1);
  p.alive = !!((b >> 5) & 1);
  p.out = false;
  p.deathTick = death;
  // cronometrele exacte nu vin pe fir: doar dacă sunt active (pentru randare)
  p.shieldT = (b >> 6) & 1 ? Math.max(p.shieldT, 1) : 0;
  p.graceT = (b >> 7) & 1 ? Math.max(p.graceT, 1) : 0;
  p.frozenT = (b >> 8) & 1 ? Math.max(p.frozenT, 1) : 0;
  p.hiddenT = (b >> 9) & 1 ? Math.max(p.hiddenT, 1) : 0;
  p.dizzyT = (b >> 10) & 1 ? Math.max(p.dizzyT, 1) : 0;
  p.hexT = (b >> 11) & 1 ? Math.max(p.hexT, 1) : 0;
  p.blindT = (b >> 12) & 1 ? Math.max(p.blindT, 1) : 0;
  p.revT = (b >> 14) & 1 ? Math.max(p.revT, 1) : 0;
  if (!((b >> 13) & 1)) p.carry = null;
}

/** [id, x, y, fuse, owner, biți, prog, ținută de, lipită de, rază, (zbor: sx, sy, dir, pași, t, durată)]. */
export function packBomb(b: Bomb): number[] {
  const bits =
    (b.slide === null ? 0 : b.slide + 1) |
    bit(b.remote, 3) |
    bit(!!b.big, 4) |
    (BOMB_KINDS.indexOf(b.kind) << 5) |
    bit(b.free, 7) |
    (b.area << 8);
  const w = [b.id, b.x, b.y, b.fuse, b.owner, bits, b.prog, b.held ?? -1, b.stuck ?? -1, b.range];
  if (b.fly) w.push(b.fly.sx, b.fly.sy, b.fly.dir, b.fly.steps, b.fly.t, b.fly.dur);
  return w;
}

export function unpackBomb(w: number[]): Bomb {
  const [id, x, y, fuse, owner, bits, prog, held, stuck, range, fsx, fsy, fdir, fsteps, ft, fdur] =
    w as number[];
  const slide = bits! & 7;
  return {
    id: id!,
    x: x!,
    y: y!,
    fuse: fuse!,
    range: range ?? 1,
    owner: owner!,
    remote: !!((bits! >> 3) & 1),
    slide: slide ? ((slide - 1) as Dir) : null,
    prog: prog!,
    held: held! >= 0 ? held! : null,
    fly:
      fsx !== undefined ? { sx: fsx, sy: fsy!, dir: fdir as Dir, steps: fsteps!, t: ft!, dur: fdur! } : null,
    chain: 0,
    tpLock: -1,
    via: 0,
    big: !!((bits! >> 4) & 1),
    kind: BOMB_KINDS[(bits! >> 5) & 3] ?? 'normal',
    free: !!((bits! >> 7) & 1),
    stuck: stuck! >= 0 ? stuck! : null,
    sticky: false,
    bounce: 0,
    area: (bits! >> 8) & 7,
  };
}

const upSec = (t: number): number => Math.ceil(t / TICK_HZ) * TICK_HZ;

export function packMe(p: Player): InfMe {
  return {
    bombs: p.bombs,
    maxBombs: p.maxBombs,
    range: p.range,
    speed: p.speed,
    active: p.active,
    kick: p.kick,
    glove: p.glove,
    remote: p.remote,
    line: p.line,
    charges: { ...p.charges },
    lives: p.lives,
    charge: p.charge,
    specials: p.specials.slice(),
    shieldT: upSec(p.shieldT),
    dizzyT: upSec(p.dizzyT),
    revT: upSec(p.revT),
    hicT: upSec(p.hicT),
    hexT: upSec(p.hexT),
    frozenT: upSec(p.frozenT),
    blindT: upSec(p.blindT),
    carry: p.carry,
    kills: p.kills,
    boxes: p.boxes,
    far: p.far,
    alive: p.alive,
    deathTick: p.deathTick,
    killerId: p.killerId,
  };
}

/** Chunk-urile din zona unui jucător: cele atinse de pătratul ±R din jurul lui (aceleași pe care le ține serverul). */
export function zoneOf(x: number, y: number, R = INF_R): number[] {
  const out: number[] = [];
  for (let cy = chunkOf(y - R); cy <= chunkOf(y + R); cy++)
    for (let cx = chunkOf(x - R); cx <= chunkOf(x + R); cx++) out.push(chunkKey(cx, cy));
  return out;
}

const keyOf = (x: number, y: number): number => chunkKey(chunkOf(x), chunkOf(y));

/* ---------- serverul ---------- */

interface Peer {
  sid: string;
  pid: number;
  zone: Set<number>;
  queue: { q: number; inp: Input }[];
  lastQ: number;
  ack: number;
  last: Input;
  meJson: string;
  padsJson: string;
  /** Ce a primit despre fiecare jucător și bombă (pentru delta). */
  sentP: Map<number, string>;
  sentB: Map<number, { w: number[]; t: number }>;
}

/** Cine intră: numele, personajul, ținuta (restrânse deja de cameră la ce deține contul). */
export type InfJoin = MeMsg;

/**
 * Instanța Infinit pe server (logica, fără Colyseus): jucătorii intră și ies oricând, simularea
 * rulează continuu, iar `tick()` întoarce mesajul fiecărui client.
 */
export class InfHost {
  readonly s: GameState;
  private peers = new Map<string, Peer>();
  private roster = new Map<number, InfRosterEntry>();
  /** Ultimul cod trimis al fiecărei celule, pe chunk (doar chunk-urile încărcate). */
  private shadow = new Map<number, Int32Array>();
  private hot = new Map<number, number>();
  private coldAt = 0;
  private rosterAdd: InfRosterEntry[] = [];
  private rosterDel: number[] = [];

  constructor(
    seed: number,
    readonly theme = 'clasic',
    readonly shard = '',
  ) {
    this.s = createGame({ seed, rules: infiniteRules(true), players: [] });
  }

  get size(): number {
    return this.peers.size;
  }

  get full(): boolean {
    return this.peers.size >= INF_MAX;
  }

  /** Un om intră în lume. Întoarce mesajul de bun venit (sau null dacă instanța e plină). */
  join(sid: string, me: InfJoin): InfWelcome | null {
    if (this.peers.has(sid)) this.leave(sid);
    if (this.full) return null;
    const ch = typeof me.ch === 'string' ? me.ch : null;
    const setup = ch ? charSetup(ch, this.theme) : null;
    const pid = joinWorld(this.s, setup ? { bot: null, ...setup } : { bot: null });
    const name = String(me.name ?? 'Player').slice(0, 16) || 'Player';
    const entry: InfRosterEntry = [pid, name, ch, me.outfit ? cleanOutfit(me.outfit) : null];
    this.roster.set(pid, entry);
    this.rosterAdd.push(entry);
    this.peers.set(sid, {
      sid,
      pid,
      zone: new Set(),
      queue: [],
      lastQ: 0,
      ack: 0,
      last: NO_INPUT,
      meJson: '',
      padsJson: '[]',
      sentP: new Map(),
      sentB: new Map(),
    });
    return {
      seed: this.s.seed,
      rules: this.s.rules,
      me: pid,
      tick: this.s.tick,
      theme: this.theme,
      shard: this.shard,
      roster: [...this.roster.values()],
    };
  }

  /** Omul pleacă: dispare din lume (bombele lui explodează normal). */
  leave(sid: string): void {
    const p = this.peers.get(sid);
    if (!p) return;
    this.peers.delete(sid);
    leaveWorld(this.s, p.pid);
    this.roster.delete(p.pid);
    this.rosterDel.push(p.pid);
  }

  /** Clientul își reface oglinda (bun venit nou, reconectare): următorul cadru îi trimite totul de la zero. */
  resync(sid: string): void {
    const p = this.peers.get(sid);
    if (!p) return;
    p.zone = new Set();
    p.sentP.clear();
    p.sentB.clear();
    p.meJson = '';
    p.padsJson = '[]';
  }

  rosterList(): InfRosterEntry[] {
    return [...this.roster.values()];
  }

  pidOf(sid: string): number | undefined {
    return this.peers.get(sid)?.pid;
  }

  input(sid: string, q: unknown, w: unknown): void {
    const p = this.peers.get(sid);
    const n = Number(q);
    if (!p || !Number.isSafeInteger(n) || n <= p.lastQ) return;
    p.lastQ = n;
    p.queue.push({ q: n, inp: decodeInput(w) });
    while (p.queue.length > MAX_QUEUE) {
      const old = p.queue.shift()!;
      const next = p.queue[0]!;
      if (old.inp.bomb && !next.inp.bomb) next.inp.bomb = old.inp.bomb;
      if (old.inp.detonate) next.inp.detonate = true;
      if (old.inp.super) next.inp.super = true;
      if (old.inp.swap) next.inp.swap = true;
    }
  }

  private consume(p: Peer): Input {
    const e = p.queue.shift();
    const prev = p.last;
    const inp = e ? e.inp : prev.face === undefined ? { dir: prev.dir } : { dir: prev.dir, face: prev.face };
    if (e) p.ack = e.q;
    p.last = inp;
    return inp;
  }

  /** Schimbările de roster de trimis tuturor (apoi se golesc). */
  takeRoster(): InfRoster | null {
    if (!this.rosterAdd.length && !this.rosterDel.length) return null;
    const r: InfRoster = {};
    if (this.rosterAdd.length) r.add = this.rosterAdd.splice(0);
    if (this.rosterDel.length) r.del = this.rosterDel.splice(0);
    return r;
  }

  /** Avansează lumea cu un tick și întoarce mesajul fiecărui om (sid → cadru). */
  tick(): Map<string, InfFrame> {
    const s = this.s;
    const inputs: (Input | undefined)[] = [];
    for (const p of this.peers.values()) inputs[p.pid] = decodeInput(encodeInput(this.consume(p)));
    step(s, inputs);
    this.markHot();
    const zones = new Map<Peer, Set<number>>();
    for (const peer of this.peers.values()) {
      const me = s.players[peer.pid]!;
      zones.set(peer, new Set(zoneOf(tileX(me), tileY(me)).filter((k) => s.inf!.slots[k] !== undefined)));
    }
    const changes = this.diffChunks(zones);
    const out = new Map<string, InfFrame>();
    for (const peer of this.peers.values()) out.set(peer.sid, this.frameFor(peer, zones.get(peer)!, changes));
    return out;
  }

  /** Clasamentul și minimapa pentru fiecare om. */
  boards(): Map<string, InfBoard> {
    const rank = infRanking(this.s);
    const top = rank.slice(0, 10);
    const pos = new Map(rank.map((p, i) => [p.id, i]));
    const out = new Map<string, InfBoard>();
    for (const peer of this.peers.values()) {
      const me = this.s.players[peer.pid]!;
      const pts = top.includes(me) ? top : [...top, me];
      out.set(peer.sid, {
        top: top.map((p) => [p.id, infScore(p), p.kills]),
        you: [(pos.get(me.id) ?? rank.length) + 1, infScore(me)],
        n: rank.length,
        map: pts.map((p) => [p.id, tileX(p), tileY(p)]),
      });
    }
    return out;
  }

  /** Chunk-urile unde s-a întâmplat ceva rămân calde `HOT_TICKS` (doar pe ele se compară celulele). */
  private markHot(): void {
    const s = this.s;
    const until = s.tick + HOT_TICKS;
    const area = (x0: number, y0: number, x1: number, y1: number) => {
      for (let cy = chunkOf(y0); cy <= chunkOf(y1); cy++)
        for (let cx = chunkOf(x0); cx <= chunkOf(x1); cx++) this.hot.set(chunkKey(cx, cy), until);
    };
    for (const p of s.players) if (p.alive) area(tileX(p) - 1, tileY(p) - 1, tileX(p) + 1, tileY(p) + 1);
    for (const b of s.bombs) area(b.x - b.range, b.y - b.range, b.x + b.range, b.y + b.range);
    for (const e of s.events) {
      if (!('x' in e) || !('y' in e) || typeof e.x !== 'number' || typeof e.y !== 'number') continue;
      const r = e.type === 'explode' ? e.range : 3;
      area(e.x - r, e.y - r, e.x + r, e.y + r);
    }
    for (const [k, t] of this.hot) if (t < s.tick) this.hot.delete(k);
  }

  /**
   * Compară celulele cu ce s-a trimis, pe chunk-urile urmărite: cele calde, cele care abia intră în
   * zona cuiva (ca să primească starea la zi) și câteva reci pe rând. Întoarce schimbările pe chunk.
   */
  private diffChunks(zones: Map<Peer, Set<number>>): Map<number, number[]> {
    const s = this.s;
    const w = s.inf!;
    const old = new Set<number>();
    for (const p of this.peers.values()) for (const k of p.zone) old.add(k);
    const watched = new Set(old);
    for (const z of zones.values()) for (const k of z) watched.add(k);
    const changes = new Map<number, number[]>();
    for (const key of this.shadow.keys()) if (w.slots[key] === undefined) this.shadow.delete(key);
    const cold: number[] = [];
    for (const key of watched) {
      const slot = w.slots[key];
      if (slot === undefined) continue;
      const sh = this.shadow.get(key);
      if (!sh) {
        this.initShadow(key, slot);
        continue;
      }
      if (!this.hot.has(key) && old.has(key)) {
        cold.push(key);
        continue;
      }
      this.diffOne(key, slot, sh, changes);
    }
    if (cold.length) {
      cold.sort((a, b) => a - b);
      for (let i = 0; i < Math.min(COLD_PER_TICK, cold.length); i++) {
        const key = cold[(this.coldAt + i) % cold.length]!;
        this.diffOne(key, w.slots[key]!, this.shadow.get(key)!, changes);
      }
      this.coldAt = (this.coldAt + COLD_PER_TICK) % cold.length;
    }
    return changes;
  }

  private diffOne(key: number, slot: number, sh: Int32Array, changes: Map<number, number[]>): void {
    const s = this.s;
    const x0 = keyCx(key) * CHUNK;
    const y0 = keyCy(key) * CHUNK;
    let list: number[] | undefined;
    for (let i = 0; i < CHUNK_CELLS; i++) {
      const code = cellCode(s, slot * CHUNK_CELLS + i);
      if (code === sh[i]) continue;
      sh[i] = code;
      (list ??= []).push(x0 + (i & (CHUNK - 1)), y0 + (i >> 5), code);
    }
    if (list) changes.set(key, list);
  }

  private frameFor(peer: Peer, zone: Set<number>, changes: Map<number, number[]>): InfFrame {
    const s = this.s;
    const me = s.players[peer.pid]!;
    const f: InfFrame = { t: s.tick, a: peer.ack, p: [], b: [] };
    const fresh: [number, number[]][] = [];
    const c: number[] = [];
    for (const key of zone) {
      if (!peer.zone.has(key)) {
        fresh.push([key, this.chunkDiff(key, this.shadow.get(key)!)]);
        continue;
      }
      const ch = changes.get(key);
      if (ch) for (const v of ch) c.push(v);
    }
    const gone = [...peer.zone].filter((k) => !zone.has(k));
    peer.zone = zone;
    if (fresh.length) f.in = fresh;
    if (gone.length) f.out = gone;
    if (c.length) f.c = c;
    const seen = (x: number, y: number) => peer.zone.has(keyOf(x, y));
    const vis = new Set<number>();
    for (const p of s.players) {
      if (p.out || (p.id !== me.id && !seen(tileX(p), tileY(p)))) continue;
      vis.add(p.id);
      const w = packPlayer(p);
      const j = w.join();
      if (peer.sentP.get(p.id) === j) continue;
      peer.sentP.set(p.id, j);
      f.p.push(w);
    }
    const pg = [...peer.sentP.keys()].filter((id) => !vis.has(id));
    for (const id of pg) peer.sentP.delete(id);
    if (pg.length) f.pg = pg;
    const bvis = new Set<number>();
    for (const b of s.bombs) {
      const at = b.held !== null ? vis.has(b.held) : b.fly ? seen(b.fly.sx, b.fly.sy) : seen(b.x, b.y);
      if (!at) continue;
      bvis.add(b.id);
      const w = packBomb(b);
      const last = peer.sentB.get(b.id);
      // la fel ca înainte, cu fitilul scăzut cu tick-urile trecute: clientul îl scade singur
      if (
        last &&
        w.length === last.w.length &&
        w.every((v, i) => (i === 3 ? v === last.w[3]! - (s.tick - last.t) : v === last.w[i]))
      )
        continue;
      peer.sentB.set(b.id, { w, t: s.tick });
      f.b.push(w);
    }
    const bg = [...peer.sentB.keys()].filter((id) => !bvis.has(id));
    for (const id of bg) peer.sentB.delete(id);
    if (bg.length) f.bg = bg;
    const near = (m: { px: number; py: number }) => seen(Math.round(m.px / U), Math.round(m.py / U));
    const sp = s.spiders.filter(near).map((m) => [m.id, m.px, m.py, m.dir, m.moving ? 1 : 0, m.life]);
    const cl = s.clouds
      .filter(near)
      .map((m) => [m.id, m.px, m.py, m.dir, m.moving ? 1 : 0, m.life, m.charge, m.sx, m.sy]);
    if (sp.length || cl.length) f.m = { s: sp, c: cl };
    const ev = s.events.filter((e) => {
      if ('x' in e && 'y' in e && typeof e.x === 'number' && typeof e.y === 'number') return seen(e.x, e.y);
      if ('player' in e && typeof e.player === 'number') return vis.has(e.player);
      return false;
    });
    if (ev.length) f.e = ev;
    const mj = packMe(me);
    const json = JSON.stringify(mj);
    if (json !== peer.meJson) {
      peer.meJson = json;
      f.me = mj;
    }
    const pads = JSON.stringify(s.pads.filter(([x, y]) => seen(x, y)));
    if (pads !== peer.padsJson) {
      peer.padsJson = pads;
      f.pads = JSON.parse(pads) as [number, number][];
    }
    return f;
  }

  /** Punctul de plecare al unui chunk: starea lui de acum (cine intră în zonă o primește întreagă). */
  private initShadow(key: number, slot: number): Int32Array {
    const sh = new Int32Array(CHUNK_CELLS);
    for (let i = 0; i < CHUNK_CELLS; i++) sh[i] = cellCode(this.s, slot * CHUNK_CELLS + i);
    this.shadow.set(key, sh);
    return sh;
  }

  /** Celulele unui chunk (cum le-au primit ceilalți) care diferă de lumea generată: [index, cod, …]. */
  private chunkDiff(key: number, sh: Int32Array): number[] {
    const s = this.s;
    const x0 = keyCx(key) * CHUNK;
    const y0 = keyCy(key) * CHUNK;
    const out: number[] = [];
    for (let i = 0; i < CHUNK_CELLS; i++) {
      const code = sh[i]!;
      if (code !== genCode(s, x0 + (i & (CHUNK - 1)), y0 + (i >> 5))) out.push(i, code);
    }
    return out;
  }
}

/* ---------- clientul ---------- */

const mob = (id: number, px: number, py: number, dir: number, mv: number) => ({
  id,
  px,
  py,
  fx: Math.round(px / U),
  fy: Math.round(py / U),
  tx: Math.round(px / U),
  ty: Math.round(py / U),
  moving: mv === 1,
  dir: dir as Dir,
  speed: 0,
});

const PALETTE = [
  '#5ad15a',
  '#f3f1ea',
  '#9a6436',
  '#2fd3c6',
  '#ff7a3d',
  '#c77dff',
  '#ffd23f',
  '#3d8bff',
  '#ff5d8f',
];

/** Peste câte cadre neafișate sărim direct la ultimul (tab în fundal). */
const SKIP_AFTER = 40;

/**
 * Partea de client a modului Infinit: o stare-oglindă (`view`) construită din cadrele serverului,
 * randată cu aceeași scenă ca restul jocului. Lumea se generează local din seed; pe fir vin doar diferențele.
 */
export class InfView {
  view: GameState | null = null;
  me = -1;
  theme = 'clasic';
  shard = '';
  slots: SlotInfo[] = [];
  board: InfBoard | null = null;
  private frames: InfFrame[] = [];
  private seq = 0;
  onWelcome: (w: InfWelcome) => void = () => {};
  onBoard: (b: InfBoard) => void = () => {};

  constructor(readonly link: Link) {
    link.on('welcome', (w: InfWelcome) => this.welcome(w));
    link.on('f', (f: InfFrame) => this.frames.push(f));
    link.on('board', (b: InfBoard) => {
      this.board = b;
      this.onBoard(b);
    });
    link.on('roster', (r: InfRoster) => this.applyRoster(r));
  }

  private welcome(w: InfWelcome): void {
    const s = createGame({ seed: w.seed, rules: { ...w.rules }, players: [] });
    s.tick = w.tick;
    this.view = s;
    this.me = w.me;
    this.theme = w.theme;
    this.shard = w.shard;
    this.frames = [];
    // același tablou (meciul din client îl ține minte), golit la fiecare bun venit
    this.slots.length = 0;
    this.applyRoster({ add: w.roster });
    this.ensure(w.me);
    this.onWelcome(w);
  }

  private applyRoster(r: InfRoster): void {
    for (const [pid, name, ch, outfit] of r.add ?? []) {
      this.slots[pid] = {
        name: pid === this.me ? 'You' : name,
        color: PALETTE[pid % PALETTE.length]!,
        bot: false,
        voice: pid % 4,
        ch,
        outfit,
      };
      const p = this.view?.players[pid];
      if (p) p.ch = ch;
    }
    for (const pid of r.del ?? []) {
      const p = this.view?.players[pid];
      if (p) {
        p.out = true;
        p.alive = false;
      }
    }
  }

  /** Locul jucătorului `pid` în oglindă (creat la nevoie, ascuns până apare în zonă). */
  private ensure(pid: number): Player {
    const s = this.view!;
    while (s.players.length <= pid) {
      const p = makePlayer(s.players.length, s.players.length, null, 0, 0);
      p.alive = false;
      p.out = true;
      p.deathTick = -1e6;
      s.players.push(p);
    }
    for (let i = this.slots.length; i <= pid; i++)
      this.slots[i] ??= {
        name: '?',
        color: PALETTE[i % PALETTE.length]!,
        bot: false,
        voice: i % 4,
        ch: null,
        outfit: null,
      };
    const p = s.players[pid]!;
    if (p.ch === null) p.ch = this.slots[pid]?.ch ?? null;
    return p;
  }

  send(inp: Input): void {
    if (this.me < 0 || !this.view) return;
    this.link.send('in', { q: ++this.seq, i: encodeInput(inp) });
  }

  get buffered(): number {
    return this.frames.length;
  }

  /** Online nu există predicție în Infinit (jucătorul local vine din cadre). */
  predict(): null {
    return null;
  }

  /** Aplică următorul cadru pe oglindă. Întoarce false dacă nu există. */
  stepView(): boolean {
    if (!this.view || !this.frames.length) return false;
    if (this.frames.length > SKIP_AFTER) {
      // după o pauză lungă: aplică tot fără evenimente (celulele și chunk-urile trebuie să treacă toate)
      while (this.frames.length > 1) this.apply(this.frames.shift()!);
      this.view.events = [];
    }
    this.apply(this.frames.shift()!);
    return true;
  }

  apply(f: InfFrame): void {
    const s = this.view!;
    s.tick = f.t;
    for (const key of f.out ?? []) unloadChunk(s, keyCx(key), keyCy(key));
    for (const [key, diff] of f.in ?? []) {
      const slot = loadChunk(s, keyCx(key), keyCy(key));
      for (let i = 0; i < diff.length; i += 2) applyCell(s, slot * CHUNK_CELLS + diff[i]!, diff[i + 1]!);
    }
    // flăcările se sting singure pe client (fără să dispară înainte ca serverul să le stingă)
    for (let k = CHUNK_CELLS; k < s.flame.length; k++) if (s.flame[k]! > 1) s.flame[k]!--;
    const c = f.c ?? [];
    for (let i = 0; i < c.length; i += 3)
      if (inBounds(s, c[i]!, c[i + 1]!)) applyCell(s, idx(s, c[i]!, c[i + 1]!), c[i + 2]!);
    for (const w of f.p) unpackPlayer(this.ensure(w[0]!), w);
    for (const id of f.pg ?? []) {
      // ieșit din zonă: nu se mai desenează
      const p = this.ensure(id);
      p.out = true;
      p.alive = false;
      p.deathTick = -1e6;
    }
    if (f.me) {
      const me = this.ensure(this.me);
      Object.assign(me, f.me);
    }
    const gone = new Set(f.bg ?? []);
    const fresh = new Map(f.b.map((w) => [w[0]!, unpackBomb(w)]));
    const bombs: Bomb[] = [];
    for (const b of s.bombs) {
      if (gone.has(b.id) || fresh.has(b.id)) continue;
      b.fuse--;
      bombs.push(b);
    }
    s.bombs = [...bombs, ...fresh.values()];
    s.spiders = (f.m?.s ?? []).map(([id, px, py, dir, mv, life]) => ({
      ...mob(id!, px!, py!, dir!, mv!),
      life: life!,
      wait: 0,
    }));
    s.clouds = (f.m?.c ?? []).map(([id, px, py, dir, mv, life, charge, sx, sy]) => ({
      ...mob(id!, px!, py!, dir!, mv!),
      life: life!,
      next: 0,
      charge: charge!,
      sx: sx!,
      sy: sy!,
    }));
    if (f.pads) s.pads = f.pads;
    s.events = f.e ?? [];
  }
}
