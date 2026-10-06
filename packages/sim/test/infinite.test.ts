import { describe, expect, it } from 'vitest';
import {
  BOT_FAR,
  BOT_GONE,
  BOT_NEAR,
  CHUNK,
  EMPTY,
  FUSE,
  HARD,
  INF_R,
  KEEP_EXTRA,
  SOFT,
  TICK_HZ,
  cellDanger,
  chunkLoaded,
  collectInputs,
  createInfinite,
  farFrom,
  genCell,
  hashState,
  idx,
  inBounds,
  infRanking,
  infScore,
  infiniteRules,
  joinWorld,
  kill,
  leaveWorld,
  placeBomb,
  slotCount,
  step,
  tileX,
  tileY,
} from '../src/index.ts';
import type { Dir, GameState, Input, Player } from '../src/index.ts';
import { put, run } from './kit.ts';

const cell = (s: GameState, x: number, y: number) => s.grid[idx(s, x, y)];
const botsRun = (s: GameState, n: number) => {
  for (let t = 0; t < n; t++) step(s, collectInputs(s));
};
const teleport = (s: GameState, p: Player, x: number, y: number) => {
  put(p, x, y);
  step(s, []);
};
/** Lume online (fără boți) cu `n` oameni intrați pe rând. */
function online(n: number, seed = 3): GameState {
  const s = createInfinite(seed, { bot: null }, true);
  for (let i = 1; i < n; i++) joinWorld(s, { bot: null });
  return s;
}
const bots = (s: GameState) => s.players.filter((p) => p.bot !== null && p.alive && !p.out);
const d = (p: Player, x: number, y: number) => Math.hypot(tileX(p) - x, tileY(p) - y);

describe('Infinit: lumea pe chunk-uri', () => {
  it('aceeași coordonată generează mereu aceeași celulă, oricare ar fi ordinea încărcării', () => {
    const a = createInfinite(7, { bot: null });
    const b = createInfinite(7, { bot: null });
    // b ajunge în aceeași zonă pe alt drum (alte sloturi în stocare)
    teleport(b, b.players[0]!, 400, -300);
    teleport(b, b.players[0]!, 90, 40);
    teleport(a, a.players[0]!, 90, 40);
    expect(idx(a, 90, 40)).not.toBe(idx(b, 90, 40));
    for (let y = 40 - INF_R; y <= 40 + INF_R; y++)
      for (let x = 90 - INF_R; x <= 90 + INF_R; x++) {
        expect(cell(a, x, y)).toBe(cell(b, x, y));
        expect(cell(a, x, y)).toBe(genCell(a, x, y).g);
      }
  });

  it('zonele modificate rămân modificate cât sunt în rază; departe se regenerează', () => {
    const s = createInfinite(7, { bot: null });
    const p = s.players[0]!;
    s.grid[idx(s, 5, 5)] = EMPTY;
    s.grid[idx(s, 3, 5)] = SOFT;
    // la marginea razei de păstrare: încă încărcat, cu modificările
    teleport(s, p, 5 + INF_R + KEEP_EXTRA - 2, 5);
    expect(inBounds(s, 5, 5)).toBe(true);
    expect(cell(s, 3, 5)).toBe(SOFT);
    // departe: chunk-ul se descarcă
    teleport(s, p, 5 + 4 * CHUNK, 5);
    expect(chunkLoaded(s, 0, 0)).toBe(false);
    expect(inBounds(s, 5, 5)).toBe(false);
    expect(cell(s, 5, 5)).toBe(HARD); // ce nu e încărcat se comportă ca perete
    teleport(s, p, 1, 1);
    expect(cell(s, 3, 5)).toBe(genCell(s, 3, 5).g);
    expect(cell(s, 5, 5)).toBe(genCell(s, 5, 5).g);
  });

  it('memorie constantă: mersul departe refolosește sloturile', () => {
    const s = createInfinite(7, { bot: null });
    const p = s.players[0]!;
    for (let x = 0; x <= 2000; x += 20) teleport(s, p, x | 1, (x >> 1) | 1);
    expect(slotCount(s)).toBeLessThanOrEqual(1 + 4 * 4);
    expect(s.grid.length).toBe(slotCount(s) * CHUNK * CHUNK);
  });

  it('mai mulți oameni: lumea există în jurul fiecăruia, departe unul de altul', () => {
    const s = online(2);
    const [a, b] = s.players as [Player, Player];
    teleport(s, a, -301, 201);
    teleport(s, b, 501, -401);
    for (const p of [a, b])
      for (const [ox, oy] of [
        [-INF_R, -INF_R],
        [INF_R, INF_R],
        [0, 0],
      ] as const)
        expect(inBounds(s, tileX(p) + ox, tileY(p) + oy)).toBe(true);
    expect(inBounds(s, 100, -100)).toBe(false);
  });
});

describe('Infinit: boți (varianta offline)', () => {
  it('apar la 9–15 pătrățele de tine, cel mult 7 în jur, și dispar când rămân departe', () => {
    const s = createInfinite(11, { bot: null });
    const h = s.players[0]!;
    h.shieldT = 1e6; // să nu moară în test
    const seen = new Set<number>();
    for (let t = 0; t < 22 * 10; t++) {
      step(s, collectInputs(s));
      for (const e of s.events)
        if (e.type === 'botSpawn') {
          seen.add(e.player);
          const dist = Math.hypot(e.x - tileX(h), e.y - tileY(h));
          expect(dist).toBeGreaterThanOrEqual(BOT_NEAR - 1);
          expect(dist).toBeLessThanOrEqual(BOT_FAR + 1);
        }
    }
    expect(seen.size).toBeGreaterThanOrEqual(5);
    expect(bots(s).length).toBeLessThanOrEqual(7);
    teleport(s, h, 301, 301);
    step(s, collectInputs(s));
    for (const b of s.players.filter((q) => q.bot !== null))
      if (!b.out) expect(d(b, tileX(h), tileY(h))).toBeLessThanOrEqual(BOT_GONE);
  });

  it('departe de centru boții sunt mai puternici', () => {
    const near = createInfinite(5, { bot: null });
    near.players[0]!.shieldT = 1e6;
    botsRun(near, 200);
    const far = createInfinite(5, { bot: null });
    far.players[0]!.shieldT = 1e6;
    teleport(far, far.players[0]!, 151, 151);
    botsRun(far, 200);
    const avg = (s: GameState, f: (p: Player) => number) => {
      const b = s.players.filter((p) => p.bot !== null);
      return b.reduce((n, p) => n + f(p), 0) / b.length;
    };
    expect(avg(near, (p) => p.range)).toBeLessThan(avg(far, (p) => p.range));
    expect(avg(far, (p) => p.range)).toBeGreaterThanOrEqual(3);
    expect(avg(far, (p) => p.bombs)).toBeGreaterThan(avg(near, (p) => p.bombs));
    expect(far.players.filter((p) => p.bot !== null).every((p) => p.kick)).toBe(true);
  });

  it('determinist: același seed → aceeași lume, aceiași boți', () => {
    const a = createInfinite(21, { bot: null });
    const b = createInfinite(21, { bot: null });
    const walk = (t: number): Input => ({ dir: ((t >> 5) % 4) as Dir, bomb: t % 40 === 0 ? 1 : 0 });
    for (let t = 0; t < 600; t++) {
      const ia = collectInputs(a, { 0: walk(t) });
      const ib = collectInputs(b, { 0: walk(t) });
      step(a, ia);
      step(b, ib);
    }
    expect(hashState(a)).toBe(hashState(b));
  });
});

describe('Infinit: moarte, revenire, scor', () => {
  it('revii după 2.2s la 3–9 pătrățele de locul morții, pe un loc sigur, cu 3s de scut', () => {
    const s = createInfinite(4, { bot: null });
    s.rules.infBots = 0;
    const p = s.players[0]!;
    teleport(s, p, 41, 21);
    p.kills = 2;
    kill(s, p, null, 'flame');
    run(s, infiniteRules(false).respawnTicks! - 1);
    expect(p.alive).toBe(false);
    run(s, 1);
    expect(p.alive).toBe(true);
    const dist = d(p, 41, 21);
    expect(dist).toBeGreaterThanOrEqual(2.5);
    expect(dist).toBeLessThanOrEqual(9.5);
    expect(p.shieldT).toBeGreaterThan(TICK_HZ * 2.5);
    expect(cell(s, tileX(p), tileY(p))).toBe(EMPTY);
    expect(cellDanger(s, tileX(p), tileY(p))).toBe(false);
    expect(p.kills).toBe(2); // statisticile rămân
    expect(p.range).toBe(1); // bonusurile nu
  });

  it('nu revii în raza unei bombe', () => {
    const s = createInfinite(4, { bot: null });
    s.rules.infBots = 0;
    const p = s.players[0]!;
    teleport(s, p, 21, 21);
    // bombe cu rază mare în jur: multe locuri devin periculoase
    for (const [x, y] of [
      [21, 25],
      [25, 21],
      [17, 21],
      [21, 17],
    ] as const) {
      s.grid[idx(s, x, y)] = EMPTY;
      placeBomb(s, p, x, y);
      s.bombs[s.bombs.length - 1]!.range = 8;
    }
    kill(s, p, null, 'flame');
    for (const b of s.bombs) b.fuse = 1e6;
    run(s, infiniteRules(false).respawnTicks!);
    expect(p.alive).toBe(true);
    expect(cellDanger(s, tileX(p), tileY(p))).toBe(false);
  });

  it('scorul: eliminări ×100 + lăzi ×10 + distanță ×5 + secunde trăite', () => {
    const s = online(2);
    const [a, b] = s.players as [Player, Player];
    a.shieldT = 0;
    teleport(s, a, 21, 1);
    expect(a.far).toBe(farFrom(21, 1));
    kill(s, b, a.id, 'flame');
    expect(a.kills).toBe(1);
    // o ladă spartă de bomba lui a
    put(a, 31, 31);
    s.grid[idx(s, 32, 31)] = HARD;
    s.grid[idx(s, 30, 31)] = EMPTY;
    s.grid[idx(s, 31, 30)] = EMPTY;
    s.grid[idx(s, 31, 32)] = SOFT;
    placeBomb(s, a, 31, 31);
    a.shieldT = 1e6;
    run(s, FUSE + 1);
    expect(a.boxes).toBe(1);
    expect(infScore(a)).toBe(100 + 10 + a.far * 5 + Math.floor(a.lived / TICK_HZ));
    expect(infRanking(s)[0]).toBe(a);
  });

  it('online: la moarte cade jumătate din bonusurile culese', () => {
    const s = online(1);
    const p = s.players[0]!;
    teleport(s, p, 41, 41);
    for (let x = 38; x <= 44; x++) for (let y = 38; y <= 44; y++) s.grid[idx(s, x, y)] = EMPTY;
    p.got = ['bomb', 'fire', 'speed', 'fire', 'kick', 'bomb'];
    kill(s, p, null, 'flame');
    const ev = s.events.find((e) => e.type === 'lootDrop');
    expect(ev).toMatchObject({ n: 3 });
    let n = 0;
    for (let x = 38; x <= 44; x++) for (let y = 38; y <= 44; y++) if (s.items[idx(s, x, y)]) n++;
    expect(n).toBe(3);
    expect(p.got).toEqual([]);
  });

  it('bonusurile culese se țin minte (doar cele pozitive)', () => {
    const s = online(1);
    const p = s.players[0]!;
    teleport(s, p, 41, 41);
    s.grid[idx(s, 42, 41)] = EMPTY;
    s.items[idx(s, 42, 41)] = 'fire';
    s.grid[idx(s, 43, 41)] = EMPTY;
    s.items[idx(s, 43, 41)] = 'slow';
    s.grid[idx(s, 44, 41)] = EMPTY;
    run(s, 30, [{ dir: 3 }]);
    expect(p.got).toEqual(['fire']);
  });
});

describe('Infinit: intrare și ieșire (online)', () => {
  it('fiecare om nou apare departe de ceilalți, pe un loc sigur, cu scut', () => {
    const s = online(12);
    const people = s.players.filter((p) => p.bot === null);
    expect(people).toHaveLength(12);
    for (const p of people) {
      expect(cell(s, tileX(p), tileY(p))).toBe(EMPTY);
      expect(p.shieldT).toBeGreaterThan(0);
      for (const o of people)
        if (o !== p)
          expect(Math.abs(tileX(o) - tileX(p)) + Math.abs(tileY(o) - tileY(p))).toBeGreaterThanOrEqual(2);
    }
  });

  it('locurile plecate se refolosesc, dar nu cât timp mai au bombe pe hartă', () => {
    const s = online(3);
    const b = s.players[1]!;
    placeBomb(s, b, tileX(b), tileY(b));
    leaveWorld(s, b.id);
    expect(b.out).toBe(true);
    expect(joinWorld(s, { bot: null })).toBe(3);
    run(s, FUSE + 2);
    expect(joinWorld(s, { bot: null })).toBe(1);
    expect(s.players[1]!.out).toBe(false);
    expect(s.players[1]!.kills).toBe(0);
  });

  it('cine pleacă nu mai revine și nu mai ține lumea încărcată', () => {
    const s = online(2);
    const b = s.players[1]!;
    teleport(s, b, 401, 401);
    expect(inBounds(s, 401, 401)).toBe(true);
    leaveWorld(s, b.id);
    run(s, 100);
    expect(b.alive).toBe(false);
    expect(inBounds(s, 401, 401)).toBe(false);
  });
});

describe('Infinit: lăzile cresc la loc', () => {
  it('spre forma generată, doar departe de jucători', () => {
    const s = online(1);
    const p = s.players[0]!;
    const cleared: [number, number][] = [];
    for (let y = -20; y <= 20; y++)
      for (let x = -20; x <= 20; x++)
        if (cell(s, x, y) === SOFT) {
          s.grid[idx(s, x, y)] = EMPTY;
          cleared.push([x, y]);
        }
    p.shieldT = 1e6;
    run(s, 600);
    const back = cleared.filter(([x, y]) => cell(s, x, y) === SOFT);
    expect(back.length).toBeGreaterThan(0);
    for (const [x, y] of back) {
      expect(genCell(s, x, y).g).toBe(SOFT);
      expect(Math.abs(x - tileX(p)) + Math.abs(y - tileY(p))).toBeGreaterThanOrEqual(5);
    }
  });
});
