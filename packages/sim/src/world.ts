import { mobX, mobY, tileX, tileY } from './grid.ts';
import { deriveRng, nextFloat } from './rng.ts';
import { EMPTY, HARD, SOFT } from './types.ts';
import type { GameState, InfWorld } from './types.ts';

/** Latura unui chunk (pătrățele) și biții ei. */
export const CHUNK = 32;
export const CHUNK_BITS = 5;
export const CHUNK_CELLS = CHUNK * CHUNK;
/** Raza generată în jurul fiecărui om (lumea există pe chunk-urile atinse de pătratul ±R). */
export const INF_R = 26;
/** Un chunk rămâne încărcat (cu modificările lui) cât e la cel mult `INF_R + KEEP_EXTRA` de un om. */
export const KEEP_EXTRA = 8;
/** Slotul 0 din stocare e „vidul”: orice coordonată neîncărcată cade aici și se comportă ca perete. */
export const VOID_SLOT = 0;

/** Cheia unui chunk din coordonatele lui (întregi în ±32767). */
export const chunkKey = (cx: number, cy: number): number => (cx + 0x8000) * 0x10000 + (cy + 0x8000);
export const keyCx = (key: number): number => Math.floor(key / 0x10000) - 0x8000;
export const keyCy = (key: number): number => (key % 0x10000) - 0x8000;
/** Chunk-ul care conține pătrățelul (funcționează și pe negative). */
export const chunkOf = (v: number): number => v >> CHUNK_BITS;

/** Zgomot determinist din (seed, x, y): aceeași coordonată → mereu aceeași valoare. */
export const cellHash = (seed: number, x: number, y: number, salt: number): number =>
  nextFloat(deriveRng(seed, x, y, salt));

/** Celula generată la (x, y), fără modificările jocului: stâlpi pe pozițiile pare, start liber, lăzi din hash. */
export function genCell(s: GameState, x: number, y: number): { g: number; gold: boolean; cursed: boolean } {
  if ((x & 1) === 0 && (y & 1) === 0) return { g: HARD, gold: false, cursed: false };
  if (Math.abs(x - 1) <= 1 && Math.abs(y - 1) <= 1) return { g: EMPTY, gold: false, cursed: false };
  if (cellHash(s.seed, x, y, 11) >= s.rules.softDensity) return { g: EMPTY, gold: false, cursed: false };
  const r = cellHash(s.seed, x, y, 12);
  const gold = r < s.rules.goldRate;
  return { g: SOFT, gold, cursed: !gold && r < s.rules.goldRate + s.rules.curseRate };
}

/** Lumea infinită goală: doar slotul de vid (pereți). */
export function newInfWorld(): InfWorld {
  return { keys: [-1], slots: {}, free: [] };
}

/** Câte sloturi are stocarea (inclusiv vidul). */
export const slotCount = (s: GameState): number => s.inf!.keys.length;

/** Coordonatele de lume ale celulei `k` din stocare (null pentru vid / slot liber). */
export function cellXY(s: GameState, k: number): [number, number] | null {
  const key = s.inf!.keys[k >> (2 * CHUNK_BITS)]!;
  if (key < 0) return null;
  return [keyCx(key) * CHUNK + (k & (CHUNK - 1)), keyCy(key) * CHUNK + ((k >> CHUNK_BITS) & (CHUNK - 1))];
}

/** Valorile implicite ale tuturor câmpurilor pe celulă (folosite la creștere și la regenerare). */
const CELL_FIELDS = [
  ['grid', EMPTY],
  ['flame', 0],
  ['flameOwner', -1],
  ['items', null],
  ['drops', null],
  ['gold', 0],
  ['cursed', 0],
  ['flameVia', 0],
  ['oil', 0],
  ['oilOwner', -1],
  ['flameKind', 0],
  ['toxic', 0],
  ['toxicOwner', -1],
  ['bush', 0],
] as const;

/** Adaugă un slot nou la stocare (toate tablourile pe celulă cresc cu un chunk). */
function grow(s: GameState): number {
  const slot = s.inf!.keys.length;
  s.inf!.keys.push(-1);
  for (const [f, v] of CELL_FIELDS) {
    const arr = s[f] as unknown[];
    for (let i = 0; i < CHUNK_CELLS; i++) arr.push(v);
  }
  s.H = s.inf!.keys.length * CHUNK;
  return slot;
}

/** Celula de stocare k primește valorile generate pentru (x, y) (cu țintele misiunii în starea lor). */
function genInto(s: GameState, k: number, x: number, y: number): void {
  const c = genCell(s, x, y);
  for (const [f, v] of CELL_FIELDS) (s[f] as unknown[])[k] = v;
  s.grid[k] = c.g;
  s.gold[k] = c.gold ? 1 : 0;
  s.cursed[k] = c.cursed ? 1 : 0;
  const m = s.mission;
  const ti = m?.tmap[`${x},${y}`];
  if (m && ti !== undefined) {
    const t = m.targets[ti]!;
    s.gold[k] = 0;
    s.cursed[k] = 0;
    s.grid[k] = t.type !== 'flag' && !t.done && !t.open ? SOFT : EMPTY;
    if (t.type === 'crystal' && t.open && !t.done) s.items[k] = 'crystal';
  }
}

function fillSlot(s: GameState, slot: number, cx: number, cy: number): void {
  const base = slot * CHUNK_CELLS;
  for (let ly = 0; ly < CHUNK; ly++)
    for (let lx = 0; lx < CHUNK; lx++) genInto(s, base + ly * CHUNK + lx, cx * CHUNK + lx, cy * CHUNK + ly);
}

export const chunkLoaded = (s: GameState, cx: number, cy: number): boolean =>
  s.inf!.slots[chunkKey(cx, cy)] !== undefined;

/**
 * Încarcă chunk-ul (cx, cy) generat din hash, dacă nu e deja în stocare.
 * Slotul vine din lista liberă (cel mai mic întâi, determinist) sau stocarea crește.
 */
export function loadChunk(s: GameState, cx: number, cy: number): number {
  const w = s.inf!;
  const key = chunkKey(cx, cy);
  const have = w.slots[key];
  if (have !== undefined) return have;
  const slot = w.free.length ? w.free.pop()! : grow(s);
  w.keys[slot] = key;
  w.slots[key] = slot;
  fillSlot(s, slot, cx, cy);
  return slot;
}

/** Scoate chunk-ul din stocare: modificările se pierd, la întoarcere se regenerează din hash. */
export function unloadChunk(s: GameState, cx: number, cy: number): void {
  const w = s.inf!;
  const key = chunkKey(cx, cy);
  const slot = w.slots[key];
  if (slot === undefined) return;
  delete w.slots[key];
  w.keys[slot] = -1;
  w.free.push(slot);
  // cel mai mic slot liber e refolosit primul (ordinea nu depinde de istoric)
  w.free.sort((a, b) => b - a);
}

/** Asigură că celula (x, y) există în stocare (îi încarcă chunk-ul). */
export function ensureCell(s: GameState, x: number, y: number): void {
  loadChunk(s, chunkOf(x), chunkOf(y));
}

/** Încarcă toate chunk-urile atinse de pătratul ±R din jurul lui (x, y). */
export function ensureWindow(s: GameState, x: number, y: number, R = INF_R): void {
  for (let cy = chunkOf(y - R); cy <= chunkOf(y + R); cy++)
    for (let cx = chunkOf(x - R); cx <= chunkOf(x + R); cx++) loadChunk(s, cx, cy);
}

/** Regenerează din hash tot ce e încărcat (ex. după ce s-au pus țintele misiunii). */
export function resetWindow(s: GameState): void {
  const w = s.inf!;
  for (let slot = 1; slot < w.keys.length; slot++) {
    const key = w.keys[slot]!;
    if (key >= 0) fillSlot(s, slot, keyCx(key), keyCy(key));
  }
}

/** Oamenii (nu boții) din lume: în jurul lor există harta. */
export const anchors = (s: GameState) => s.players.filter((p) => p.bot === null && !p.out);

// pătrățelul unui om, chiar dacă e mort (rămâne locul morții)
const ax = tileX;
const ay = tileY;

/**
 * Lumea urmărește oamenii: chunk-urile din jurul fiecăruia se încarcă, cele rămase departe de toți
 * se descarcă (și se regenerează când revine cineva). Bombele și creaturile de pe chunk-uri descărcate dispar.
 */
export function updateWorld(s: GameState): void {
  const w = s.inf;
  if (!w) return;
  const people = anchors(s);
  for (const p of people) ensureWindow(s, ax(p), ay(p));
  const K = INF_R + KEEP_EXTRA;
  let dropped = false;
  for (let slot = 1; slot < w.keys.length; slot++) {
    const key = w.keys[slot]!;
    if (key < 0) continue;
    const x0 = keyCx(key) * CHUNK;
    const y0 = keyCy(key) * CHUNK;
    const near = people.some((p) => {
      const x = ax(p);
      const y = ay(p);
      return x + K >= x0 && x - K < x0 + CHUNK && y + K >= y0 && y - K < y0 + CHUNK;
    });
    if (near) continue;
    unloadChunk(s, keyCx(key), keyCy(key));
    dropped = true;
  }
  // vidul rămâne perete orice s-ar fi scris în el
  for (let k = 0; k < CHUNK_CELLS; k++) {
    s.grid[k] = HARD;
    s.flame[k] = 0;
    s.items[k] = null;
    s.drops[k] = null;
  }
  if (!dropped) return;
  const gone = (x: number, y: number) => w.slots[chunkKey(chunkOf(x), chunkOf(y))] === undefined;
  if (s.bombs.length)
    s.bombs = s.bombs.filter((b) => {
      if (b.held !== null || b.fly || !gone(b.x, b.y)) return true;
      const o = s.players[b.owner];
      if (o && !b.free) o.active = Math.max(0, o.active - 1);
      return false;
    });
  if (s.spiders.length) s.spiders = s.spiders.filter((c) => !gone(mobX(c), mobY(c)));
  if (s.clouds.length) s.clouds = s.clouds.filter((c) => !gone(mobX(c), mobY(c)));
}
