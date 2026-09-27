import { describe, expect, it } from 'vitest';
import {
  FUSE,
  GOLD,
  HARD,
  SOFT,
  createGame,
  idx,
  isGold,
  placeBomb,
  step,
  tileX,
  tileY,
} from '../src/index.ts';
import type { Input } from '../src/index.ts';
import { arena, events, put, run, setTile, tap } from './kit.ts';

describe('bombe și flăcări', () => {
  it('bomba explodează după 2.4s (48 tick-uri), în cruce, cu raza de start 1', () => {
    const s = arena();
    const p = put(s.players[0]!, 3, 1);
    tap(s);
    put(p, 9, 9);
    run(s, FUSE - 2);
    expect(s.bombs).toHaveLength(1);
    step(s, []);
    expect(events(s, 'explode')).toHaveLength(1);
    expect(s.flame[idx(s, 3, 1)]).toBeGreaterThan(0);
    expect(s.flame[idx(s, 4, 1)]).toBeGreaterThan(0);
    expect(s.flame[idx(s, 5, 1)]).toBe(0);
    expect(p.active).toBe(0);
  });

  it('lanț: o bombă o declanșează pe următoarea, iar un lanț de 4 deschide portaluri', () => {
    const s = arena();
    const p = put(s.players[0]!, 9, 9);
    p.bombs = 4;
    p.range = 2;
    for (const x of [1, 3, 5, 7]) placeBomb(s, p, x, 1);
    for (const b of s.bombs.slice(1)) b.fuse = 500;
    const explosions: { chain: number; tick: number }[] = [];
    let opened = false;
    for (let t = 0; t < FUSE + 5; t++) {
      step(s, []);
      for (const e of s.events) {
        if (e.type === 'explode') explosions.push({ chain: e.chain, tick: s.tick });
        if (e.type === 'portalOpen') opened = true;
      }
    }
    expect(explosions).toHaveLength(4);
    expect(new Set(explosions.map((e) => e.chain)).size).toBe(1);
    expect(explosions.map((e) => e.tick)).toEqual([FUSE, FUSE + 1, FUSE + 2, FUSE + 3]);
    expect(opened).toBe(true);
    expect(s.pads).toHaveLength(2);
  });

  it('flacăra e oprită de stâlpi și de prima ladă', () => {
    const s = arena();
    const p = put(s.players[0]!, 9, 9);
    p.range = 5;
    setTile(s, 3, 3, SOFT);
    setTile(s, 3, 4, SOFT);
    placeBomb(s, p, 3, 1);
    run(s, FUSE);
    expect(s.grid[idx(s, 3, 3)]).toBe(0); // prima ladă spartă
    expect(s.grid[idx(s, 3, 4)]).toBe(SOFT); // a doua rămâne
    expect(s.flame[idx(s, 2, 2)]).toBe(0); // stâlp — nimic în diagonală
  });

  it('moarte pe flacără, cu ucigașul corect și sfârșit de rundă', () => {
    const s = createGame({
      seed: 3,
      rules: { softDensity: 0, boxRespawn: false, hurryUpTick: 0 },
      players: [{ bot: null }, { bot: null }],
    });
    const [a, b] = s.players as [(typeof s.players)[0], (typeof s.players)[0]];
    put(a, 9, 9);
    put(b, 6, 1);
    placeBomb(s, a, 5, 1);
    let death: unknown;
    for (let t = 0; t < FUSE && !death; t++) {
      step(s, []);
      death = events(s, 'death')[0];
    }
    expect(death).toEqual({ type: 'death', player: 1, killerId: 0, cause: 'flame', via: 0 });
    expect(b.alive).toBe(false);
    expect(s.result).toMatchObject({ winner: 0 });
  });

  it('echipe: fără foc prieten (nici propriile bombe), dar adversarii mor', () => {
    const s = createGame({
      seed: 4,
      rules: { mode: 'teams', softDensity: 0, boxRespawn: false, hurryUpTick: 0 },
      players: [
        { bot: null, team: 0 },
        { bot: null, team: 0 },
        { bot: null, team: 1 },
        { bot: null, team: 1 },
      ],
    });
    const [a, mate, foe, foe2] = s.players as [
      (typeof s.players)[0],
      (typeof s.players)[0],
      (typeof s.players)[0],
      (typeof s.players)[0],
    ];
    put(a, 5, 1);
    put(mate, 4, 1);
    put(foe, 6, 1);
    put(foe2, 13, 9);
    tap(s, 0);
    run(s, FUSE);
    expect(a.alive).toBe(true);
    expect(mate.alive).toBe(true);
    expect(foe.alive).toBe(false);
    expect(foe2.alive).toBe(true);
  });

  it('scutul salvează o dată, apoi se consumă', () => {
    const s = arena();
    const p = put(s.players[0]!, 3, 1);
    p.shieldT = 200;
    tap(s);
    run(s, FUSE);
    expect(p.alive).toBe(true);
    expect(p.shieldT).toBe(0);
    run(s, 15); // așteaptă să se stingă flacăra
    tap(s);
    run(s, FUSE);
    expect(p.alive).toBe(false);
  });

  it('lada aurie lasă garantat un bonus maxim', () => {
    const s = arena();
    const p = put(s.players[0]!, 9, 9);
    setTile(s, 4, 1, SOFT);
    s.gold[idx(s, 4, 1)] = 1;
    placeBomb(s, p, 3, 1);
    run(s, FUSE + 12);
    const it = s.items[idx(s, 4, 1)];
    expect(it && isGold(it)).toBe(true);
    expect(GOLD).toContain(it);
  });
});

describe('picior, mănușă, portaluri', () => {
  it('șutul: bomba alunecă și se oprește la perete', () => {
    const s = arena();
    const p = put(s.players[0]!, 1, 1, 3);
    p.kick = true;
    placeBomb(s, p, 3, 1);
    s.bombs[0]!.fuse = 500;
    run(s, 60, (t) => [{ dir: t < 8 ? 3 : null }]);
    const b = s.bombs[0]!;
    expect(b.slide).toBeNull();
    expect(b.x).toBe(s.W - 2); // oprită lângă peretele din dreapta
    expect(tileX(p)).toBeLessThan(b.x);
  });

  it('bomba ținută în mână nu explodează', () => {
    const s = arena();
    const p = put(s.players[0]!, 3, 1);
    p.glove = true;
    tap(s); // pune
    tap(s); // ridică (stă pe ea, are mănușă)
    expect(p.carry).not.toBeNull();
    run(s, FUSE * 4);
    expect(s.bombs).toHaveLength(1);
    expect(s.bombs[0]!.held).toBe(0);
    expect(p.alive).toBe(true);
  });

  it('aruncarea trece peste margine și reintră pe partea opusă (wrap)', () => {
    const s = arena();
    const p = put(s.players[0]!, 2, 1, 2); // privește spre stânga
    p.glove = true;
    tap(s);
    tap(s);
    tap(s); // aruncă
    const b = s.bombs[0]!;
    expect(b.fly).not.toBeNull();
    expect([b.x, b.y]).toEqual([s.W - 3, 1]);
    let landed = false;
    for (let t = 0; t < 20 && !landed; t++) {
      step(s, []);
      landed = events(s, 'land').length > 0;
    }
    expect(landed).toBe(true);
    expect(b.fly).toBeNull();
  });

  it('dublu tap cu mănușă: pune bomba și o ridică imediat', () => {
    const s = arena();
    const p = put(s.players[0]!, 3, 1);
    p.glove = true;
    p.bombs = 2;
    tap(s, 0, 1);
    tap(s, 0, 2);
    expect(p.carry).not.toBeNull();
  });

  it('portalul teleportează o bombă șutată, care își continuă drumul', () => {
    const s = arena();
    const p = put(s.players[0]!, 1, 1, 3);
    p.kick = true;
    s.pads = [
      [5, 1],
      [7, 9],
    ];
    s.portalT = 1000;
    placeBomb(s, p, 3, 1);
    s.bombs[0]!.fuse = 500;
    let tele = false;
    for (let t = 0; t < 80; t++) {
      step(s, [{ dir: t < 10 ? 3 : null }]);
      if (s.events.some((e) => e.type === 'teleport' && e.kind === 'bomb')) tele = true;
    }
    const b = s.bombs[0]!;
    expect(tele).toBe(true);
    expect(b.y).toBe(9);
    expect(b.x).toBe(s.W - 2);
  });

  it('portalul teleportează jucătorul', () => {
    const s = arena();
    const p = put(s.players[0]!, 1, 1, 3);
    s.pads = [
      [3, 1],
      [9, 9],
    ];
    s.portalT = 1000;
    let tele = false;
    for (let t = 0; t < 20; t++) {
      step(s, [{ dir: t < 13 ? 3 : null }]);
      if (events(s, 'teleport').length) tele = true;
    }
    expect(tele).toBe(true);
    expect(tileY(p)).toBe(9);
  });
});

describe('detonator, linie, bonusuri negative', () => {
  it('detonatorul: bombele nu explodează singure, BUM! le detonează', () => {
    const s = arena();
    const p = put(s.players[0]!, 3, 1);
    p.remote = true;
    tap(s);
    put(p, 9, 9);
    run(s, FUSE * 2);
    expect(s.bombs).toHaveLength(1);
    step(s, [{ dir: null, detonate: true }]);
    expect(events(s, 'explode')).toHaveLength(1);
  });

  it('linia: dublu tap pune restul bombelor în direcția privirii', () => {
    const s = arena();
    const p = put(s.players[0]!, 1, 1, 3);
    p.line = true;
    p.bombs = 5;
    tap(s, 0, 1);
    tap(s, 0, 2);
    expect(s.bombs.map((b) => b.x)).toEqual([1, 2, 3, 4, 5]);
  });

  it('comenzi inversate: mersul e oglindit', () => {
    const s = arena();
    const p = put(s.players[0]!, 5, 1);
    p.revT = 100;
    run(s, 10, [{ dir: 3 }]);
    expect(tileX(p)).toBeLessThan(5);
  });

  it('sughițul pune bombe involuntar', () => {
    const s = arena();
    const p = put(s.players[0]!, 5, 1);
    p.bombs = 3;
    p.hicT = 120;
    p.hicCd = 6;
    run(s, 6);
    expect(s.bombs.length).toBe(1);
  });
});

describe('hurry up', () => {
  it('blocurile cad în spirală din margini, omoară și termină runda', () => {
    const s = createGame({
      seed: 9,
      rules: { softDensity: 0, boxRespawn: false, hurryUpTick: 10, hurryEvery: 1 },
      players: [{ bot: null }, { bot: null }],
    });
    const falls: [number, number][] = [];
    let hurry = false;
    for (let t = 0; t < 400; t++) {
      step(s, [] as Input[]);
      for (const e of s.events) {
        if (e.type === 'hurryUp') hurry = true;
        if (e.type === 'blockFall') falls.push([e.x, e.y]);
      }
    }
    expect(hurry).toBe(true);
    expect(falls[0]).toEqual([1, 1]); // începe din colț
    expect(s.result).toMatchObject({ winner: 1, tick: 10 });
    expect(s.players.every((p) => !p.alive)).toBe(true);
    expect(s.grid[idx(s, (s.W - 1) / 2, (s.H - 1) / 2)]).toBe(HARD); // umple tot până în centru
  });
});
