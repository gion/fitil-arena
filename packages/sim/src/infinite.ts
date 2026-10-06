import { SPEED_START, TICK_HZ, sec } from './constants.ts';
import { bombAt, idx, inBounds, tileAt, tileX, tileY } from './grid.ts';
import { isNegative } from './items.ts';
import { nextFloat, nextInt, shuffle } from './rng.ts';
import { applyHero, applyKit, createGame, makePlayer } from './setup.ts';
import type { PlayerSetup } from './setup.ts';
import { DIRS, DX, DY, EMPTY, HARD, SOFT, U } from './types.ts';
import type { GameState, ItemType, Player, Rules } from './types.ts';
import { CHUNK_CELLS, cellXY, ensureWindow, genCell, slotCount } from './world.ts';

/** Boții apar la 9–15 pătrățele de un om și dispar când rămân la peste 24 de toți. */
export const BOT_NEAR = 9;
export const BOT_FAR = 15;
export const BOT_GONE = 24;
/** La câte tick-uri se verifică dacă trebuie un bot nou (1.1s). */
const BOT_EVERY = 22;
/** Un bot mort dispare după 1.5s (animația morții). */
const BOT_FADE = sec(1.5);
/** Lăzile cresc la loc (spre lumea generată) din 10 în 10 tick-uri. */
const REGROW_EVERY = 10;

/**
 * Regulile modului Infinit. Offline (varianta din prototip): boți în jur, revii după 2.2s.
 * Online: fără boți, revii după 3s, la moarte cade jumătate din bonusuri.
 */
export function infiniteRules(online: boolean): Partial<Rules> {
  return {
    infinite: true,
    softDensity: 0.5,
    goldRate: 0.035,
    curseRate: 0.03,
    boxRespawn: false,
    hurryUpTick: 0,
    respawnTicks: online ? sec(3) : sec(2.2),
    respawnShield: sec(3),
    infBots: online ? 0 : 7,
    infDrop: online ? 50 : 0,
  };
}

/** Scorul: eliminări ×100 + lăzi ×10 + distanța maximă de centru ×5 + secundele trăite. */
export const infScore = (p: Player): number =>
  p.kills * 100 + p.boxes * 10 + p.far * 5 + Math.floor(p.lived / TICK_HZ);

/** Distanța (în pătrățele, rotunjită) de la centrul lumii (1, 1). */
export const farFrom = (x: number, y: number): number => Math.round(Math.hypot(x - 1, y - 1));

/** Modul Infinit offline: tu la (1, 1), cu 3s de scut; boții vin singuri. */
export function createInfinite(seed: number, you: PlayerSetup, online = false): GameState {
  const s = createGame({ seed, rules: infiniteRules(online), players: [you] });
  s.players[0]!.shieldT = sec(3);
  return s;
}

/** Pătrățelul e periculos acum: flacără sau în raza unei bombe de pe jos (fără perete între ele). */
export function cellDanger(s: GameState, x: number, y: number): boolean {
  if (s.flame[idx(s, x, y)]! > 0) return true;
  for (const b of s.bombs) {
    if (b.held !== null || b.fly !== null) continue;
    if (b.x !== x && b.y !== y) continue;
    const d = Math.abs(b.x - x) + Math.abs(b.y - y);
    if (d > b.range) continue;
    const sx = Math.sign(x - b.x);
    const sy = Math.sign(y - b.y);
    let open = true;
    for (let i = 1; i < d && open; i++) {
      const g = tileAt(s, b.x + sx * i, b.y + sy * i);
      if (g === HARD || g === SOFT) open = false;
    }
    if (open) return true;
  }
  return false;
}

/** Un loc bun de apariție: liber, fără pericol și fără alt jucător viu la mai puțin de `gap` pătrățele. */
function safeSpot(s: GameState, x: number, y: number, self: number, gap: number): boolean {
  if (!inBounds(s, x, y)) return false;
  const g = tileAt(s, x, y);
  if (g === HARD || bombAt(s, x, y) || cellDanger(s, x, y)) return false;
  return !s.players.some(
    (p) => p.id !== self && p.alive && Math.abs(tileX(p) - x) + Math.abs(tileY(p) - y) < gap,
  );
}

/** Curăță crucea din jurul locului de apariție (lăzi și flăcări), ca să ai pe unde ieși. */
function clearCross(s: GameState, x: number, y: number): void {
  for (const [ox, oy] of [[0, 0], ...DIRS.map((d) => [DX[d]!, DY[d]!] as const)] as const) {
    if (!inBounds(s, x + ox, y + oy)) continue;
    const k = idx(s, x + ox, y + oy);
    if (s.grid[k] === SOFT) {
      s.grid[k] = EMPTY;
      s.gold[k] = 0;
      s.cursed[k] = 0;
    }
    s.flame[k] = 0;
  }
}

/** Caută un loc sigur pe un inel [dmin, dmax] în jurul lui (cx, cy); null dacă nu găsește. */
function spotNear(
  s: GameState,
  cx: number,
  cy: number,
  dmin: number,
  dmax: number,
  self: number,
  gap: number,
): [number, number] | null {
  for (let t = 0; t < 120; t++) {
    const a = nextFloat(s.rng) * Math.PI * 2;
    const d = dmin + nextFloat(s.rng) * (dmax - dmin);
    const x = Math.round(cx + Math.cos(a) * d);
    const y = Math.round(cy + Math.sin(a) * d);
    if (safeSpot(s, x, y, self, gap)) return [x, y];
  }
  return null;
}

/** Revenirea în lumea infinită: la 3–9 pătrățele de locul morții, pe un loc sigur (crucea se curăță). */
export function infRespawnPos(s: GameState, p: Player): [number, number] {
  const dx = tileX(p);
  const dy = tileY(p);
  ensureWindow(s, dx, dy);
  const pos = spotNear(s, dx, dy, 3, 9, p.id, 3) ?? [dx | 1, dy | 1];
  clearCross(s, pos[0], pos[1]);
  return pos;
}

/** Un loc refolosibil: plecat și fără bombe încă pe hartă (altfel eliminările s-ar atribui greșit). */
function freeSlot(s: GameState): Player | undefined {
  return s.players.find((p) => p.out && !s.bombs.some((b) => b.owner === p.id));
}

function place(s: GameState, ps: PlayerSetup, x: number, y: number): Player {
  const reuse = freeSlot(s);
  const id = reuse ? reuse.id : s.players.length;
  const p = makePlayer(id, id, ps.bot, x, y);
  applyHero(p, ps.hero ?? null, s.rules);
  if (ps.kit) applyKit(p, ps.kit, ps.ch ?? null);
  const open = DIRS.find((d) => tileAt(s, x + DX[d]!, y + DY[d]!) === EMPTY);
  if (open !== undefined) p.face = open;
  if (reuse) Object.assign(reuse, p);
  else s.players.push(p);
  return s.players[id]!;
}

/**
 * Un om intră în lume (online, drop-in): apare la întâmplare lângă centru (raza crește cu numărul de oameni),
 * departe de ceilalți, cu scut. Întoarce id-ul lui (locurile plecate se refolosesc).
 */
export function joinWorld(s: GameState, ps: PlayerSetup): number {
  const people = s.players.filter((p) => p.bot === null && !p.out).length;
  const R = 6 + people * 3;
  let pos: [number, number] | null = null;
  for (let t = 0; t < 40 && !pos; t++) {
    const a = nextFloat(s.rng) * Math.PI * 2;
    const d = nextFloat(s.rng) * R;
    const x = Math.round(1 + Math.cos(a) * d) | 1;
    const y = Math.round(1 + Math.sin(a) * d);
    ensureWindow(s, x, y, 2);
    if (safeSpot(s, x, y, -1, t < 30 ? 6 : 2)) pos = [x, y];
  }
  const [x, y] = pos ?? [1, 1];
  ensureWindow(s, x, y);
  clearCross(s, x, y);
  const p = place(s, ps, x, y);
  p.shieldT = Math.max(p.shieldT, s.rules.respawnShield);
  s.events.push({ type: 'respawn', player: p.id });
  return p.id;
}

/** Jucătorul iese din lume: locul rămâne liber (se refolosește după ce îi explodează bombele). */
export function leaveWorld(s: GameState, id: number): void {
  const p = s.players[id];
  if (!p || p.out) return;
  if (p.alive) {
    p.alive = false;
    p.deathTick = s.tick;
    p.moving = false;
  }
  p.out = true;
  p.carry = null;
  for (const b of s.bombs) if (b.held === id) b.held = null;
}

/** Bonusurile pe care le scapi la moarte: `infDrop`% din cele culese, pe pătrățelele libere din jur. */
export function dropLoot(s: GameState, p: Player): void {
  const pct = s.rules.infDrop;
  if (!s.inf || pct <= 0 || !p.got.length) return;
  const n = Math.floor((p.got.length * pct) / 100);
  const loot = shuffle(s.rng, p.got.slice()).slice(0, n);
  p.got = [];
  const cx = tileX(p);
  const cy = tileY(p);
  let i = 0;
  for (let r = 0; r <= 3 && i < loot.length; r++)
    for (let y = cy - r; y <= cy + r && i < loot.length; y++)
      for (let x = cx - r; x <= cx + r && i < loot.length; x++) {
        if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) !== r || !inBounds(s, x, y)) continue;
        const k = idx(s, x, y);
        if (s.grid[k] !== EMPTY || s.items[k] || s.drops[k] || bombAt(s, x, y)) continue;
        // pe flacără bonusul apare după ce se stinge
        if (s.flame[k]! > 0) s.drops[k] = loot[i++]!;
        else s.items[k] = loot[i++]!;
      }
  if (i) s.events.push({ type: 'lootDrop', player: p.id, x: cx, y: cy, n: i });
}

/** Ține minte bonusurile pozitive culese (pentru `dropLoot`). */
export function noteGot(s: GameState, p: Player, it: ItemType): void {
  if (!s.inf || s.rules.infDrop <= 0) return;
  if (isNegative(it) || it === 'crystal' || it === 'heart' || p.got.length >= 40) return;
  p.got.push(it);
}

/** Un bot nou lângă omul `h`: cu cât e mai departe de centru, cu atât e mai puternic. */
function spawnBot(s: GameState, h: Player): void {
  const pos = spotNear(s, tileX(h), tileY(h), BOT_NEAR, BOT_FAR, -1, 3);
  if (!pos) return;
  const [x, y] = pos;
  clearCross(s, x, y);
  const b = place(s, { bot: 'normal' }, x, y);
  const far = farFrom(x, y);
  b.range = 1 + Math.min(3, Math.floor(far / 22));
  b.bombs = 1 + Math.min(2, Math.floor(far / 30));
  b.speed = SPEED_START + Math.min(65, Math.floor(far));
  b.kick = far > 40;
  s.events.push({ type: 'botSpawn', player: b.id, x, y });
}

const dist2 = (a: Player, b: Player): number => {
  const dx = (a.px - b.px) / U;
  const dy = (a.py - b.py) / U;
  return dx * dx + dy * dy;
};

/** Lăzile cresc la loc, încet, spre forma generată a lumii (doar unde nu e nimeni aproape). */
function regrow(s: GameState): void {
  const n = slotCount(s) - 1;
  if (n <= 0) return;
  const tries = 2 + (n >> 1);
  for (let t = 0; t < tries; t++) {
    const k = CHUNK_CELLS * (1 + nextInt(s.rng, n)) + nextInt(s.rng, CHUNK_CELLS);
    const xy = cellXY(s, k);
    if (!xy || s.grid[k] !== EMPTY || s.items[k] || s.drops[k] || s.flame[k]! > 0) continue;
    const [x, y] = xy;
    const g = genCell(s, x, y);
    if (g.g !== SOFT || bombAt(s, x, y)) continue;
    if (s.players.some((p) => p.alive && Math.abs(tileX(p) - x) + Math.abs(tileY(p) - y) < 5)) continue;
    s.grid[k] = SOFT;
    s.gold[k] = g.gold ? 1 : 0;
    s.cursed[k] = g.cursed ? 1 : 0;
    s.events.push({ type: 'boxSpawn', x, y, gold: g.gold, cursed: g.cursed });
  }
}

/**
 * Un tick al modului Infinit: statisticile (distanța, timpul trăit), boții care apar / dispar
 * în jurul oamenilor și lăzile care cresc la loc. Revenirea în joc e în `updateRespawn`.
 */
export function updateInfinite(s: GameState): void {
  if (!s.inf || !s.rules.respawnTicks) return; // misiunile au lumea infinită, dar nu și modul
  for (const p of s.players) {
    if (!p.alive || p.out) continue;
    p.lived++;
    if (p.bot === null) p.far = Math.max(p.far, farFrom(tileX(p), tileY(p)));
  }
  const people = s.players.filter((p) => p.bot === null && !p.out);
  for (const b of s.players) {
    if (b.bot === null || b.out) continue;
    if (!b.alive) {
      if (s.tick - b.deathTick >= BOT_FADE) b.out = true;
      continue;
    }
    if (!people.some((h) => dist2(b, h) <= BOT_GONE * BOT_GONE)) {
      b.alive = false;
      b.out = true;
      b.deathTick = s.tick;
      s.events.push({ type: 'botGone', player: b.id });
    }
  }
  if (s.rules.infBots > 0 && s.tick % BOT_EVERY === 0)
    for (const h of people) {
      if (!h.alive) continue;
      const around = s.players.filter(
        (b) => b.bot !== null && b.alive && !b.out && dist2(b, h) <= BOT_GONE * BOT_GONE,
      ).length;
      if (around < s.rules.infBots) spawnBot(s, h);
    }
  if (s.tick % REGROW_EVERY === 0) regrow(s);
}

/** Clasamentul: id-urile jucătorilor (oameni, în lume) după scor. */
export function infRanking(s: GameState): Player[] {
  return s.players
    .filter((p) => p.bot === null && !p.out)
    .sort((a, b) => infScore(b) - infScore(a) || a.id - b.id);
}
