import { action, detonate, newBomb, placeBomb, swapSpecial, tryKick } from './actions.ts';
import { BOT_LEVELS, botCooldown } from './botLevels.ts';
import {
  BLIND,
  CARRIER_SPEED_PCT,
  CHAIN_DELAY,
  CHARGE_BOX,
  CHARGE_TICK,
  CURSE_DELAY,
  FLAME,
  FREEZE,
  GHOST_CD,
  GRACE,
  HICCUP_EVERY,
  HURT_FLAME,
  MAX_RANGE,
  OIL,
  OIL_SPEED_PCT,
  PORTAL,
  PLAYER_SLIDE_SPEED,
  SLIDE_CD,
  SLIDE_SPEED,
  SLIDE_TILES,
  SMASH_TILES,
  SPEED_MAX,
  STICKY_FUSE,
  TOXIC,
  TOXIC_HURT,
  TRAP_RANGE,
} from './constants.ts';
import { addCharge, addFlame, damage, kill, shieldSave } from './effects.ts';
import { useSuper } from './heroes.ts';
import { collectCrystal, hitTarget, updateMission } from './missions.ts';
import { updateWorld } from './world.ts';
import { noteGot, updateInfinite } from './infinite.ts';
import {
  areaTiles,
  blast,
  bombAt,
  countSoft,
  idx,
  inBounds,
  mobX,
  mobY,
  padIndex,
  playerAt,
  tileAt,
  tileX,
  tileY,
  walkable,
} from './grid.ts';
import { applyItem, isNegative, rollDrop, rollGold } from './items.ts';
import { updateMobs } from './mobs.ts';
import {
  carriedFlag,
  updateCrown,
  updateCtf,
  updatePotato,
  updateRespawn,
  updateRotation,
  updateShift,
} from './modes.ts';
import { nextFloat, nextInt } from './rng.ts';
import { isTeamMode } from './setup.ts';
import { DIRS, DX, DY, EMPTY, FLAME_KIND, HARD, SOFT, U, VIA_LIGHTNING, opposite } from './types.ts';
import type { Bomb, Dir, GameState, Input, ItemType, Player } from './types.ts';

/**
 * Avansează simularea cu un tick (50 ms). Modifică `s` pe loc și îl întoarce.
 * `inputs[i]` e input-ul jucătorului cu id `i` (pentru boți: rezultatul lui `botInput`).
 * Evenimentele tick-ului curent sunt în `s.events`.
 */
export function step(s: GameState, inputs: readonly (Input | undefined)[]): GameState {
  s.events = [];
  s.tick++;
  handleActions(s, inputs);
  updateBombs(s);
  explodeBombs(s);
  updateFlames(s);
  updatePotato(s);
  updateMobs(s);
  updatePlayers(s, inputs);
  updateShift(s);
  updateRotation(s);
  updateCtf(s);
  updateCrown(s);
  updateTraps(s);
  updateInfinite(s);
  updateRespawn(s);
  updatePortals(s);
  updateBoxRespawn(s);
  updateHurry(s);
  updateWorld(s);
  updateMission(s);
  checkResult(s);
  return s;
}

function handleActions(s: GameState, inputs: readonly (Input | undefined)[]): void {
  for (const p of s.players) {
    const inp = inputs[p.id];
    if (!p.alive || !inp) continue;
    if (inp.face !== undefined && (inp.bomb || inp.super)) p.face = inp.face;
    if (inp.swap) swapSpecial(p);
    if (inp.super) useSuper(s, p);
    if (inp.detonate) detonate(s, p);
    if (!inp.bomb) continue;
    if (p.bot !== null) {
      if (p.bot !== 'dummy' && placeBomb(s, p)) p.botCd = botCooldown(BOT_LEVELS[p.bot], nextFloat(s.rng));
    } else {
      const before = p.active;
      action(s, p, inp.bomb === 2);
      p.lastTapPlaced = inp.bomb === 1 && p.active > before && p.carry === null;
    }
  }
}

/** Capătul de poartă de la (x, y) al jucătorului `owner` și celălalt capăt (null = nu e o poartă a lui). */
export function gateExit(s: GameState, x: number, y: number, owner: number): [number, number] | null {
  for (const g of s.gates) {
    if (g.owner !== owner) continue;
    if (g.a[0] === x && g.a[1] === y) return g.b;
    if (g.b[0] === x && g.b[1] === y) return g.a;
  }
  return null;
}

function teleportBomb(s: GameState, b: Bomb): void {
  const k = idx(s, b.x, b.y);
  const ge = gateExit(s, b.x, b.y, b.owner);
  if (ge && b.tpLock !== k) {
    const [tx, ty] = ge;
    if (!s.bombs.some((o) => o !== b && o.x === tx && o.y === ty && o.held === null && o.fly === null)) {
      b.x = tx;
      b.y = ty;
      b.tpLock = idx(s, tx, ty);
      s.events.push({ type: 'teleport', kind: 'bomb', id: b.id, x: tx, y: ty });
      return;
    }
  }
  const pi = padIndex(s, b.x, b.y);
  if (pi >= 0 && b.tpLock !== k) {
    const [tx, ty] = s.pads[1 - pi]!;
    if (!s.bombs.some((o) => o !== b && o.x === tx && o.y === ty && o.held === null && o.fly === null)) {
      b.x = tx;
      b.y = ty;
      b.tpLock = idx(s, tx, ty);
      s.events.push({ type: 'teleport', kind: 'bomb', id: b.id, x: tx, y: ty });
    }
  } else if (pi < 0) b.tpLock = -1;
}

/** Pasul următor al unei bombe care alunecă e blocat? */
function slideBlocked(s: GameState, b: Bomb, d: Dir): boolean {
  const nx = b.x + DX[d]!;
  const ny = b.y + DY[d]!;
  return (
    !inBounds(s, nx, ny) ||
    tileAt(s, nx, ny) !== EMPTY ||
    s.bombs.some((o) => o !== b && o.x === nx && o.y === ny && o.held === null && o.fly === null) ||
    playerAt(s, nx, ny) !== undefined
  );
}

/** Bomba lipicioasă s-a oprit lângă un jucător: se lipește de el. */
function trySticky(s: GameState, b: Bomb, d: Dir): boolean {
  if (!b.sticky) return false;
  const q = playerAt(s, b.x + DX[d]!, b.y + DY[d]!);
  if (!q) return false;
  b.stuck = q.id;
  b.sticky = false;
  b.slide = null;
  b.prog = 0;
  b.x = tileX(q);
  b.y = tileY(q);
  b.fuse = Math.min(b.fuse, STICKY_FUSE);
  s.events.push({ type: 'stick', bomb: b.id, player: q.id });
  return true;
}

function updateBombs(s: GameState): void {
  const ts = s.timeStop;
  for (const b of s.bombs) {
    if (b.stuck !== null) {
      const q = s.players[b.stuck];
      if (q?.alive) {
        b.x = tileX(q);
        b.y = tileY(q);
      } else b.stuck = null;
    }
    if (ts && b.owner !== ts.owner && b.fly === null) continue; // timpul e oprit pentru bombele celorlalți
    if (b.fly) {
      b.fly.t++;
      if (b.fly.t >= b.fly.dur) {
        b.fly = null;
        s.events.push({ type: 'land', bomb: b.id, x: b.x, y: b.y });
        teleportBomb(s, b);
        if (s.flame[idx(s, b.x, b.y)]! > 0 || tileAt(s, b.x, b.y) !== EMPTY) b.fuse = 0;
      }
      continue;
    }
    if (b.held !== null) continue; // bomba din mână nu arde
    b.fuse--;
    if (b.slide === null) continue;
    b.prog += s.rules.kickPct === 100 ? SLIDE_SPEED : Math.floor((SLIDE_SPEED * s.rules.kickPct) / 100);
    while (b.slide !== null && b.prog >= U) {
      b.prog -= U;
      b.x += DX[b.slide]!;
      b.y += DY[b.slide]!;
      teleportBomb(s, b);
      if (s.flame[idx(s, b.x, b.y)]! > 0) {
        b.fuse = 0;
        b.slide = null;
        break;
      }
      if (!slideBlocked(s, b, b.slide)) continue;
      if (trySticky(s, b, b.slide)) break;
      const back = opposite(b.slide);
      if (b.bounce > 0 && !slideBlocked(s, b, back)) {
        // ricoșeu (pasivul Fifi): bomba se întoarce
        b.bounce--;
        b.slide = back;
        s.events.push({ type: 'bounce', bomb: b.id, x: b.x, y: b.y });
        continue;
      }
      b.slide = null;
      b.prog = 0;
    }
  }
  if (ts && --ts.t <= 0) s.timeStop = null;
}

function openPortals(s: GameState, cx: number, cy: number): void {
  if (s.pads.length) {
    s.portalT = PORTAL;
    return;
  }
  const free = (x: number, y: number) =>
    tileAt(s, x, y) === EMPTY &&
    !bombAt(s, x, y) &&
    !s.items[idx(s, x, y)] &&
    !playerAt(s, x, y) &&
    s.flame[idx(s, x, y)]! <= 0;
  const w = s.inf;
  const minD = w ? 8 : Math.max(5, Math.floor(Math.max(s.W, s.H) / 2));
  // în lumea infinită portalurile apar în jurul lanțului
  const rnd = (): [number, number] =>
    w
      ? [cx - 10 + nextInt(s.rng, 21), cy - 7 + nextInt(s.rng, 15)]
      : [1 + nextInt(s.rng, s.W - 2), 1 + nextInt(s.rng, s.H - 2)];
  for (let t = 0; t < 300; t++) {
    const a = rnd();
    const b = rnd();
    if (!free(...a) || !free(...b) || Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) < minD) continue;
    s.pads = [a, b];
    s.portalT = PORTAL;
    s.events.push({ type: 'portalOpen', pads: [a, b] });
    return;
  }
}

/** Sparge o ladă: o scoate din grilă, dă încărcare pe Ultimate și lasă bonusul (sau blestemul). */
function breakCrate(s: GameState, nx: number, ny: number, ownerId: number): void {
  const k = idx(s, nx, ny);
  const owner = s.players[ownerId];
  s.grid[k] = EMPTY;
  addCharge(owner, CHARGE_BOX);
  if (owner) owner.boxes++;
  const gold = s.gold[k] === 1;
  const cursed = s.cursed[k] === 1;
  s.gold[k] = 0;
  s.cursed[k] = 0;
  if (cursed) s.curses.push({ x: nx, y: ny, t: CURSE_DELAY });
  else s.drops[k] = gold ? rollGold(s.rng) : rollDrop(s.rng, s.rules.hearts, s.rules.extras, s.rules.dropPct);
  s.events.push({ type: 'boxDestroyed', x: nx, y: ny, gold, cursed, owner: ownerId });
}

function explode(s: GameState, b: Bomb, dead: Set<number>): void {
  dead.add(b.id);
  if (!b.chain) b.chain = ++s.chainSeq;
  const cc = (s.chainCount[b.chain] ?? 0) + 1;
  s.chainCount[b.chain] = cc;
  if (cc === 4) openPortals(s, b.x, b.y);
  const owner = s.players[b.owner];
  if (owner && !b.free) owner.active = Math.max(0, owner.active - 1);
  const fk = FLAME_KIND[b.kind];
  const lethal = fk === 0 || fk === 3;
  const fire = (x: number, y: number) => {
    addFlame(s, x, y, b.owner, b.via, fk);
    if (fk === 3) {
      const k = idx(s, x, y);
      s.toxic[k] = TOXIC;
      s.toxicOwner[k] = b.owner;
    }
    // Bucătarul: flăcările bombelor lui normale lasă ulei
    if (fk === 0 && owner?.kit?.oil) {
      const k = idx(s, x, y);
      s.oil[k] = FLAME + OIL;
      s.oilOwner[k] = b.owner;
    }
  };
  s.events.push({
    type: 'explode',
    bomb: b.id,
    x: b.x,
    y: b.y,
    range: b.range,
    area: b.area,
    owner: b.owner,
    chain: b.chain,
  });
  fire(b.x, b.y);
  /** Lovește un pătrățel; întoarce true dacă flacăra se oprește aici (zid, ladă). */
  const hit = (nx: number, ny: number): boolean => {
    const g = tileAt(s, nx, ny);
    if (g === HARD) return true;
    if (g === SOFT && !lethal) return true; // gheața și flashbang-ul nu sparg lăzi
    if (g === SOFT && s.mission && hitTarget(s, nx, ny, b.owner, b.via)) return true;
    if (g === SOFT) {
      fire(nx, ny);
      breakCrate(s, nx, ny, b.owner);
      return true;
    }
    for (const o of s.bombs) {
      if (!lethal || o.x !== nx || o.y !== ny || o.held !== null || o.fly !== null || dead.has(o.id))
        continue;
      o.fuse = Math.min(o.fuse, CHAIN_DELAY);
      if (!o.chain) o.chain = b.chain;
    }
    fire(nx, ny);
    return false;
  };
  if (b.area > 0) {
    // explozie în arie: pătrățelele vin deja oprite de ziduri și de lăzi (`areaTiles`)
    for (const [ax, ay] of areaTiles(s, b.x, b.y, b.area).slice(1)) hit(ax, ay);
    return;
  }
  for (const d of DIRS) {
    for (let i = 1; i <= b.range; i++) {
      if (hit(b.x + DX[d]! * i, b.y + DY[d]! * i)) break;
    }
  }
}

/** Magicianul: o dată pe rundă, bomba unui adversar care l-ar prinde se transformă în porumbel. */
function pigeon(s: GameState, b: Bomb, dead: Set<number>): boolean {
  const mags = s.players.filter((p) => p.alive && p.kit?.pigeon && !p.pigeonUsed && p.id !== b.owner);
  if (!mags.length) return false;
  const owner = s.players[b.owner];
  const hit = new Uint8Array(s.grid.length);
  blast(s, b.x, b.y, b.range, hit, b.area);
  const mag = mags.find(
    (p) =>
      hit[idx(s, tileX(p), tileY(p))] &&
      !(isTeamMode(s.rules) && !s.rules.friendlyFire && owner && owner.team === p.team),
  );
  if (!mag) return false;
  mag.pigeonUsed = true;
  dead.add(b.id);
  if (owner && !b.free) owner.active = Math.max(0, owner.active - 1);
  s.events.push({ type: 'pigeon', player: mag.id, bomb: b.id, x: b.x, y: b.y });
  return true;
}

function explodeBombs(s: GameState): void {
  const dead = new Set<number>();
  let again = true;
  while (again) {
    again = false;
    for (const b of s.bombs) {
      if (dead.has(b.id) || b.held !== null || b.fly !== null || b.fuse > 0) continue;
      if (pigeon(s, b, dead)) continue;
      explode(s, b, dead);
      again = true;
    }
  }
  if (dead.size) s.bombs = s.bombs.filter((b) => !dead.has(b.id));
  if (!s.bombs.length) s.chainCount = {};
}

function updateFlames(s: GameState): void {
  for (let k = 0; k < s.oil.length; k++) if (s.oil[k]! > 0 && --s.oil[k]! === 0) s.oilOwner[k] = -1;
  for (let k = 0; k < s.toxic.length; k++) if (s.toxic[k]! > 0 && --s.toxic[k]! === 0) s.toxicOwner[k] = -1;
  for (let k = 0; k < s.smoke.length; k++) if (s.smoke[k]! > 0) s.smoke[k]!--;
  for (let k = 0; k < s.flame.length; k++) {
    if (s.flame[k]! <= 0) continue;
    s.flame[k]!--;
    if (s.flame[k] === 0) {
      s.flameOwner[k] = -1;
      s.flameVia[k] = 0;
      s.flameKind[k] = 0;
      const d = s.drops[k];
      if (d) {
        s.items[k] = d;
        s.drops[k] = null;
      }
    }
  }
}

function arrive(s: GameState, p: Player): boolean {
  const k = idx(s, p.tx, p.ty);
  const ge = gateExit(s, p.tx, p.ty, p.id);
  if (ge && p.tpLock !== k) {
    const [dx, dy] = ge;
    if (!bombAt(s, dx, dy)) {
      p.px = dx * U;
      p.py = dy * U;
      p.fx = p.tx = dx;
      p.fy = p.ty = dy;
      p.tpLock = idx(s, dx, dy);
      s.events.push({ type: 'teleport', kind: 'player', id: p.id, x: dx, y: dy });
      return true;
    }
  }
  const pi = padIndex(s, p.tx, p.ty);
  if (pi >= 0 && p.tpLock !== k) {
    const [dx, dy] = s.pads[1 - pi]!;
    if (!bombAt(s, dx, dy)) {
      p.px = dx * U;
      p.py = dy * U;
      p.fx = p.tx = dx;
      p.fy = p.ty = dy;
      p.tpLock = idx(s, dx, dy);
      s.events.push({ type: 'teleport', kind: 'player', id: p.id, x: dx, y: dy });
      return true;
    }
  }
  if (pi < 0) p.tpLock = -1;
  return false;
}

/** Uleiul Bucătarului îi încetinește pe ceilalți (nu pe el și nici pe coechipieri). */
function onOil(s: GameState, p: Player): boolean {
  const k = idx(s, tileX(p), tileY(p));
  if (s.oil[k]! <= 0) return false;
  const o = s.players[s.oilOwner[k]!];
  if (!o || o.id === p.id) return false;
  return !(isTeamMode(s.rules) && o.team === p.team);
}

/** Culege bonusul de pe pătrățelul k (și anunță maximele). */
function pickup(s: GameState, p: Player, x: number, y: number): void {
  const k = idx(s, x, y);
  const it = s.items[k];
  if (!it) return;
  s.items[k] = null;
  const pre = { speed: p.speed, bombs: p.bombs, range: p.range };
  if (!applyItem(p, it, { charged: s.rules.charges, health: s.rules.health })) {
    s.events.push({ type: 'immune', player: p.id, item: it });
    return;
  }
  if (it === 'crystal') collectCrystal(s, x, y);
  noteGot(s, p, it);
  s.events.push({ type: 'pickup', player: p.id, item: it, x, y });
  if (p.speed >= SPEED_MAX && pre.speed < SPEED_MAX)
    s.events.push({ type: 'maxed', player: p.id, stat: 'speed' });
  if (p.bombs >= p.maxBombs && pre.bombs < p.maxBombs)
    s.events.push({ type: 'maxed', player: p.id, stat: 'bombs' });
  if (p.range >= MAX_RANGE && pre.range < MAX_RANGE)
    s.events.push({ type: 'maxed', player: p.id, stat: 'fire' });
}

const magnetable = (it: ItemType | null): boolean => !!it && !isNegative(it) && it !== 'crystal';

/** Slick: o mișcare puternică a joystick-ului pornește alunecarea (cu Smash armat, sparge lăzile din cale). */
function startSlide(s: GameState, p: Player, dir: Dir): void {
  if (!p.kit?.slide || p.slideLeft > 0 || p.slideCd > 0 || p.carry !== null) return;
  if (p.moving && dir !== p.dir && dir !== opposite(p.dir)) return;
  p.smashing = p.smashT > 0;
  p.smashT = 0;
  p.slideDir = dir;
  p.slideLeft = p.smashing ? SMASH_TILES : SLIDE_TILES;
  p.slideCd = SLIDE_CD;
  s.events.push({ type: 'slide', player: p.id, dir, smash: p.smashing });
}

/** Mișcare pe grilă, pătrățel cu pătrățel (portat din `move()` din prototip). */
function move(s: GameState, p: Player, input: Dir | null): void {
  // alunecarea (Slick) nu se mai poate îndrepta: merge înainte, mai repede, un număr de pătrățele
  const sliding = p.slideLeft > 0;
  const want = sliding ? p.slideDir : input;
  let rem = sliding
    ? PLAYER_SLIDE_SPEED
    : carriedFlag(s, p)
      ? Math.floor((p.speed * CARRIER_SPEED_PCT) / 100)
      : p.speed;
  if (!sliding && onOil(s, p)) rem = Math.floor((rem * OIL_SPEED_PCT) / 100);
  if (want !== null) p.face = want;
  if (p.moving && want !== null && want === opposite(p.dir)) {
    [p.tx, p.fx] = [p.fx, p.tx];
    [p.ty, p.fy] = [p.fy, p.ty];
    p.dir = want;
  }
  let guard = 4;
  while (rem > 0 && guard-- > 0) {
    if (!p.moving) {
      if (want === null) break;
      if (sliding && p.slideLeft <= 0) break;
      const cx = p.tx;
      const cy = p.ty;
      const nx = cx + DX[want]!;
      const ny = cy + DY[want]!;
      if (!walkable(s, nx, ny)) {
        if (sliding) {
          // Smash: lada din calea alunecării se sparge și drumul continuă
          if (
            p.smashing &&
            tileAt(s, nx, ny) === SOFT &&
            !bombAt(s, nx, ny) &&
            !(s.mission && hitTarget(s, nx, ny, p.id, 0))
          ) {
            breakCrate(s, nx, ny, p.id);
          } else {
            p.slideLeft = 0;
            break;
          }
        } else if (p.kit?.ghost && p.ghostT === 0 && tileAt(s, nx, ny) === SOFT && !bombAt(s, nx, ny)) {
          p.ghostT = GHOST_CD;
          s.events.push({ type: 'ghostIn', player: p.id, x: nx, y: ny });
        } else {
          if (p.kick && bombAt(s, nx, ny)) tryKick(s, p, want);
          break;
        }
      }
      p.fx = cx;
      p.fy = cy;
      p.tx = nx;
      p.ty = ny;
      p.dir = want;
      p.moving = true;
      if (sliding) p.slideLeft--;
    }
    const ddx = p.tx * U - p.px;
    const ddy = p.ty * U - p.py;
    const dist = Math.abs(ddx) + Math.abs(ddy);
    if (dist <= rem) {
      p.px = p.tx * U;
      p.py = p.ty * U;
      p.moving = false;
      rem -= dist;
      if (arrive(s, p) || p.bot !== null) break;
    } else {
      p.px += Math.sign(ddx) * rem;
      p.py += Math.sign(ddy) * rem;
      rem = 0;
      if (p.tpLock >= 0 && idx(s, tileX(p), tileY(p)) !== p.tpLock) p.tpLock = -1;
    }
  }
}

function updatePlayers(s: GameState, inputs: readonly (Input | undefined)[]): void {
  for (const p of s.players) {
    if (!p.alive) continue;
    let want: Dir | null = inputs[p.id]?.dir ?? null;
    if (want !== null && p.revT > 0) want = opposite(want);
    if (p.slideCd > 0) p.slideCd--;
    if (p.smashT > 0) p.smashT--;
    if (p.frozenT > 0) {
      p.frozenT--;
      p.slideLeft = 0;
    } else {
      if (inputs[p.id]?.slide && want !== null) startSlide(s, p, want);
      move(s, p, want);
    }

    const k = idx(s, tileX(p), tileY(p));
    const friendlyTo = (ownerId: number) => {
      const owner = ownerId >= 0 ? s.players[ownerId] : undefined;
      return isTeamMode(s.rules) && !s.rules.friendlyFire && owner !== undefined && owner.team === p.team;
    };
    if (p.graceT > 0) p.graceT--;
    const fk = s.flameKind[k]!;
    if (s.flame[k]! > 0 && p.graceT === 0 && (fk === 1 || fk === 2)) {
      if (!friendlyTo(s.flameOwner[k]!)) {
        if (fk === 1 && p.frozenT === 0) {
          p.frozenT = FREEZE;
          p.moving = false;
          p.px = tileX(p) * U;
          p.py = tileY(p) * U;
          p.fx = p.tx = tileX(p);
          p.fy = p.ty = tileY(p);
          s.events.push({ type: 'frozen', player: p.id });
        } else if (fk === 2 && p.blindT === 0) {
          p.blindT = BLIND;
          s.events.push({ type: 'blinded', player: p.id });
        }
      }
    } else if (s.flame[k]! > 0 && p.graceT === 0) {
      const ownerId = s.flameOwner[k]!;
      // Nova: flăcările bombelor ei nu o rănesc (aria nu-i lasă colțuri de ascuns)
      const friendly = friendlyTo(ownerId) || (ownerId === p.id && !!p.kit?.ownBlastImmune);
      if (!friendly && !shieldSave(s, p, GRACE)) {
        const via = s.flameVia[k]!;
        damage(
          s,
          p,
          HURT_FLAME,
          ownerId >= 0 ? ownerId : null,
          via === VIA_LIGHTNING ? 'lightning' : 'flame',
          via,
        );
        if (!p.alive) continue;
      }
    }
    if (s.toxic[k]! > 0 && p.graceT === 0 && !friendlyTo(s.toxicOwner[k]!)) {
      if (++p.toxT >= TOXIC_HURT) {
        p.toxT = 0;
        if (!shieldSave(s, p, GRACE)) {
          const o = s.toxicOwner[k]!;
          damage(s, p, HURT_FLAME, o >= 0 ? o : null, 'poison');
          if (!p.alive) continue;
        }
      }
    } else p.toxT = 0;
    const trap = s.traps.findIndex((t) => t.x === tileX(p) && t.y === tileY(p));
    if (trap >= 0 && s.traps[trap]!.owner !== p.id && !friendlyTo(s.traps[trap]!.owner)) {
      const t = s.traps.splice(trap, 1)[0]!;
      if (!bombAt(s, t.x, t.y)) newBomb(s, t.owner, t.x, t.y, TRAP_RANGE, { fuse: 0, free: true });
      s.events.push({ type: 'trapFire', x: t.x, y: t.y, owner: t.owner });
    }
    if (p.shieldT > 0) p.shieldT--;
    if (p.blindT > 0) p.blindT--;
    if (p.hexT > 0) p.hexT--;
    if (p.hiddenT > 0) p.hiddenT--;
    if (s.tick % CHARGE_TICK === 0) addCharge(p, 1);
    if (p.ghostT > 0) p.ghostT--;
    pickup(s, p, tileX(p), tileY(p));
    // Fifi: magnet pentru bonusurile pozitive din pătrățelele vecine
    if (p.kit?.magnet && p.alive)
      for (const d of DIRS) {
        const nx = tileX(p) + DX[d]!;
        const ny = tileY(p) + DY[d]!;
        if (tileAt(s, nx, ny) === EMPTY && magnetable(s.items[idx(s, nx, ny)] ?? null)) pickup(s, p, nx, ny);
      }
    if (p.revT > 0) p.revT--;
    if (p.dizzyT > 0) p.dizzyT--;
    if (p.hicT > 0) {
      p.hicT--;
      p.hicCd--;
      if (p.hicCd <= 0) {
        p.hicCd = HICCUP_EVERY;
        placeBomb(s, p);
      }
    }
    if (p.botCd > 0) p.botCd--;
  }
}

function updatePortals(s: GameState): void {
  for (const g of s.gates) g.t--;
  const gone = s.gates.filter((g) => g.t <= 0);
  if (gone.length) {
    s.gates = s.gates.filter((g) => g.t > 0);
    for (const g of gone) {
      for (const p of s.players) if (p.id === g.owner) p.tpLock = -1;
      s.events.push({ type: 'gateClose', owner: g.owner });
    }
  }
  if (!s.pads.length) return;
  if (--s.portalT > 0) return;
  s.pads = [];
  s.portalT = 0;
  for (const p of s.players) p.tpLock = -1;
  s.events.push({ type: 'portalClose' });
}

function updateBoxRespawn(s: GameState): void {
  if (!s.rules.boxRespawn || s.result) return;
  if (--s.boxTimer > 0) return;
  s.boxTimer = 50 + nextInt(s.rng, 61); // 2.5–5.5s
  if (countSoft(s) >= s.softStart * 0.35) return;
  for (let t = 0; t < 60; t++) {
    const x = 1 + nextInt(s.rng, s.W - 2);
    const y = 1 + nextInt(s.rng, s.H - 2);
    const k = idx(s, x, y);
    if (
      s.grid[k] !== EMPTY ||
      s.flame[k]! > 0 ||
      s.bush[k] ||
      (s.crown && s.crown.holder === null && s.crown.x === x && s.crown.y === y) ||
      s.items[k] ||
      s.drops[k] ||
      bombAt(s, x, y) ||
      padIndex(s, x, y) >= 0 ||
      s.gates.some((g) => (g.a[0] === x && g.a[1] === y) || (g.b[0] === x && g.b[1] === y))
    )
      continue;
    if (s.players.some((p) => p.alive && Math.abs(tileX(p) - x) + Math.abs(tileY(p) - y) < 3)) continue;
    s.grid[k] = SOFT;
    const r = nextFloat(s.rng);
    const gold = r < 0.06;
    const cursed = !gold && r < 0.09;
    s.gold[k] = gold ? 1 : 0;
    s.cursed[k] = cursed ? 1 : 0;
    s.events.push({ type: 'boxSpawn', x, y, gold, cursed });
    return;
  }
}

/** „Hurry up”: după `hurryUpTick`, blocuri cad în spirală din margini spre centru. */
function updateHurry(s: GameState): void {
  const start = s.rules.hurryUpTick;
  if (!start || s.tick < start) return;
  if (s.tick === start) s.events.push({ type: 'hurryUp' });
  if ((s.tick - start) % s.rules.hurryEvery !== 0) return;
  while (s.hurryIdx < s.hurryOrder.length && s.grid[s.hurryOrder[s.hurryIdx]!] === HARD) s.hurryIdx++;
  const k = s.hurryOrder[s.hurryIdx++];
  if (k === undefined) return;
  const x = k % s.W;
  const y = Math.floor(k / s.W);
  s.grid[k] = HARD;
  s.items[k] = null;
  s.drops[k] = null;
  s.gold[k] = 0;
  s.cursed[k] = 0;
  s.flame[k] = 0;
  s.flameOwner[k] = -1;
  s.flameVia[k] = 0;
  s.spiders = s.spiders.filter((c) => {
    if (mobX(c) !== x || mobY(c) !== y) return true;
    s.events.push({ type: 'spiderDie', id: c.id, x, y });
    return false;
  });
  s.bombs = s.bombs.filter((b) => {
    if (b.x !== x || b.y !== y || b.held !== null || b.fly !== null) return true;
    const owner = s.players[b.owner];
    if (owner && !b.free) owner.active = Math.max(0, owner.active - 1);
    return false;
  });
  s.bush[k] = 0;
  s.toxic[k] = 0;
  s.traps = s.traps.filter((t) => t.x !== x || t.y !== y);
  for (const p of s.players) {
    if (!p.alive) continue;
    if (tileX(p) === x && tileY(p) === y) kill(s, p, null, 'hurry');
    else if (p.moving && p.tx === x && p.ty === y) {
      // se întoarce de unde a venit
      [p.tx, p.fx] = [p.fx, p.tx];
      [p.ty, p.fy] = [p.fy, p.ty];
      p.dir = opposite(p.dir);
    }
  }
  s.events.push({ type: 'blockFall', x, y });
}

function checkResult(s: GameState): void {
  if (s.result || s.players.length < 2 || s.rules.mode === 'ctf' || s.rules.mode === 'crown') return;
  if (s.rules.timeLimit && s.tick >= s.rules.timeLimit) {
    s.result = { winner: null, team: null, tick: s.tick };
    s.events.push({ type: 'roundEnd', winner: null, team: null });
    return;
  }
  if (s.rules.respawnTicks) return;
  const alive = s.players.filter((p) => p.alive);
  if (isTeamMode(s.rules)) {
    const teams = new Set(alive.map((p) => p.team));
    if (teams.size > 1) return;
    const team = teams.size === 1 ? [...teams][0]! : null;
    s.result = { winner: alive.length === 1 ? alive[0]!.id : null, team, tick: s.tick };
  } else {
    if (alive.length > 1) return;
    s.result = { winner: alive[0]?.id ?? null, team: null, tick: s.tick };
  }
  s.events.push({ type: 'roundEnd', winner: s.result.winner, team: s.result.team });
}

function updateTraps(s: GameState): void {
  if (s.traps.length) s.traps = s.traps.filter((t) => --t.t > 0);
}
