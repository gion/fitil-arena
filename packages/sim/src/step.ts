import { action, detonate, placeBomb, tryKick } from './actions.ts';
import { BOT_LEVELS, botCooldown } from './botLevels.ts';
import {
  CARRIER_SPEED_PCT,
  CHAIN_DELAY,
  HURT_FLAME,
  CURSE_DELAY,
  GRACE,
  HICCUP_EVERY,
  MAX_BOMBS,
  MAX_RANGE,
  PORTAL,
  SLIDE_SPEED,
  SPEED_MAX,
} from './constants.ts';
import { addFlame, damage, kill, shieldSave } from './effects.ts';
import { collectCrystal, hitTarget, updateMission } from './missions.ts';
import { updateWorld } from './world.ts';
import {
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
import { applyItem, rollDrop, rollGold } from './items.ts';
import { updateMobs } from './mobs.ts';
import { carriedFlag, updateCtf, updateRespawn, updateRotation, updateShift } from './modes.ts';
import { nextFloat, nextInt } from './rng.ts';
import { isTeamMode } from './setup.ts';
import { DIRS, DX, DY, EMPTY, HARD, SOFT, U, VIA_LIGHTNING, opposite } from './types.ts';
import type { Bomb, Dir, GameState, Input, Player } from './types.ts';

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
  updateMobs(s);
  updatePlayers(s, inputs);
  updateShift(s);
  updateRotation(s);
  updateCtf(s);
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
    if (inp.face !== undefined && inp.bomb) p.face = inp.face;
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

function teleportBomb(s: GameState, b: Bomb): void {
  const k = idx(s, b.x, b.y);
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

function updateBombs(s: GameState): void {
  for (const b of s.bombs) {
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
    b.prog += SLIDE_SPEED;
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
      const nx = b.x + DX[b.slide]!;
      const ny = b.y + DY[b.slide]!;
      const blocked =
        !inBounds(s, nx, ny) ||
        tileAt(s, nx, ny) !== EMPTY ||
        s.bombs.some((o) => o !== b && o.x === nx && o.y === ny && o.held === null && o.fly === null) ||
        playerAt(s, nx, ny) !== undefined;
      if (blocked) {
        b.slide = null;
        b.prog = 0;
      }
    }
  }
}

function openPortals(s: GameState): void {
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
  // în lumea infinită portalurile apar în jurul jucătorului
  const rnd = (): [number, number] =>
    w
      ? [w.cx - 10 + nextInt(s.rng, 21), w.cy - 7 + nextInt(s.rng, 15)]
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

function explode(s: GameState, b: Bomb, dead: Set<number>): void {
  dead.add(b.id);
  if (!b.chain) b.chain = ++s.chainSeq;
  const cc = (s.chainCount[b.chain] ?? 0) + 1;
  s.chainCount[b.chain] = cc;
  if (cc === 4) openPortals(s);
  const owner = s.players[b.owner];
  if (owner) owner.active = Math.max(0, owner.active - 1);
  s.events.push({
    type: 'explode',
    bomb: b.id,
    x: b.x,
    y: b.y,
    range: b.range,
    owner: b.owner,
    chain: b.chain,
  });
  addFlame(s, b.x, b.y, b.owner, b.via);
  for (const d of DIRS) {
    for (let i = 1; i <= b.range; i++) {
      const nx = b.x + DX[d]! * i;
      const ny = b.y + DY[d]! * i;
      const g = tileAt(s, nx, ny);
      if (g === HARD) break;
      const k = idx(s, nx, ny);
      if (g === SOFT && s.mission && hitTarget(s, nx, ny, b.owner, b.via)) break;
      if (g === SOFT) {
        s.grid[k] = EMPTY;
        addFlame(s, nx, ny, b.owner, b.via);
        const gold = s.gold[k] === 1;
        const cursed = s.cursed[k] === 1;
        s.gold[k] = 0;
        s.cursed[k] = 0;
        if (cursed) s.curses.push({ x: nx, y: ny, t: CURSE_DELAY });
        else s.drops[k] = gold ? rollGold(s.rng) : rollDrop(s.rng, s.rules.hearts);
        s.events.push({ type: 'boxDestroyed', x: nx, y: ny, gold, cursed });
        break;
      }
      for (const o of s.bombs) {
        if (o.x !== nx || o.y !== ny || o.held !== null || o.fly !== null || dead.has(o.id)) continue;
        o.fuse = Math.min(o.fuse, CHAIN_DELAY);
        if (!o.chain) o.chain = b.chain;
      }
      addFlame(s, nx, ny, b.owner, b.via);
    }
  }
}

function explodeBombs(s: GameState): void {
  const dead = new Set<number>();
  let again = true;
  while (again) {
    again = false;
    for (const b of s.bombs) {
      if (dead.has(b.id) || b.held !== null || b.fly !== null || b.fuse > 0) continue;
      explode(s, b, dead);
      again = true;
    }
  }
  if (dead.size) s.bombs = s.bombs.filter((b) => !dead.has(b.id));
  if (!s.bombs.length) s.chainCount = {};
}

function updateFlames(s: GameState): void {
  for (let k = 0; k < s.flame.length; k++) {
    if (s.flame[k]! <= 0) continue;
    s.flame[k]!--;
    if (s.flame[k] === 0) {
      s.flameOwner[k] = -1;
      s.flameVia[k] = 0;
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

/** Mișcare pe grilă, pătrățel cu pătrățel (portat din `move()` din prototip). */
function move(s: GameState, p: Player, want: Dir | null): void {
  let rem = carriedFlag(s, p) ? Math.floor((p.speed * CARRIER_SPEED_PCT) / 100) : p.speed;
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
      const cx = p.tx;
      const cy = p.ty;
      const nx = cx + DX[want]!;
      const ny = cy + DY[want]!;
      if (!walkable(s, nx, ny)) {
        if (p.kick && bombAt(s, nx, ny)) tryKick(s, p, want);
        break;
      }
      p.fx = cx;
      p.fy = cy;
      p.tx = nx;
      p.ty = ny;
      p.dir = want;
      p.moving = true;
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
    move(s, p, want);

    const k = idx(s, tileX(p), tileY(p));
    if (p.graceT > 0) p.graceT--;
    if (s.flame[k]! > 0 && p.graceT === 0) {
      const ownerId = s.flameOwner[k]!;
      const owner = ownerId >= 0 ? s.players[ownerId] : undefined;
      const friendly =
        isTeamMode(s.rules) && !s.rules.friendlyFire && owner !== undefined && owner.team === p.team;
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
    if (p.shieldT > 0) p.shieldT--;
    const it = s.items[k];
    if (it) {
      s.items[k] = null;
      const pre = { speed: p.speed, bombs: p.bombs, range: p.range };
      applyItem(p, it);
      if (it === 'crystal') collectCrystal(s, tileX(p), tileY(p));
      s.events.push({ type: 'pickup', player: p.id, item: it, x: tileX(p), y: tileY(p) });
      if (p.speed >= SPEED_MAX && pre.speed < SPEED_MAX)
        s.events.push({ type: 'maxed', player: p.id, stat: 'speed' });
      if (p.bombs >= MAX_BOMBS && pre.bombs < MAX_BOMBS)
        s.events.push({ type: 'maxed', player: p.id, stat: 'bombs' });
      if (p.range >= MAX_RANGE && pre.range < MAX_RANGE)
        s.events.push({ type: 'maxed', player: p.id, stat: 'fire' });
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
      s.items[k] ||
      s.drops[k] ||
      bombAt(s, x, y) ||
      padIndex(s, x, y) >= 0
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
    if (owner) owner.active = Math.max(0, owner.active - 1);
    return false;
  });
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
  if (s.result || s.players.length < 2 || s.rules.mode === 'ctf') return;
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
