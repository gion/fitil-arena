import { describe, expect, it } from 'vitest';
import {
  CURSE_DELAY,
  DEG,
  FLAG_RETURN,
  FUSE,
  RESPAWN,
  RESPAWN_SHIELD,
  ROT_FLIP,
  SOFT,
  SPEED_MAX,
  SPEED_STEP,
  U,
  botInput,
  createGame,
  ctfRules,
  doomBomb,
  idx,
  placeBomb,
  rotateRules,
  step,
  tileX,
  triggerCurse,
} from '../src/index.ts';
import type { Cloud, GameState, Player, Spider } from '../src/index.ts';
import { arena, events, put, run, setTile } from './kit.ts';

function spider(s: GameState, x: number, y: number): Spider {
  const c: Spider = {
    id: s.nextMobId++,
    px: x * U,
    py: y * U,
    fx: x,
    fy: y,
    tx: x,
    ty: y,
    moving: false,
    dir: 1,
    speed: 160,
    life: 280,
    wait: 0,
  };
  s.spiders.push(c);
  return c;
}

function cloud(s: GameState, x: number, y: number, charge: number): Cloud {
  const c: Cloud = {
    id: s.nextMobId++,
    px: x * U,
    py: y * U,
    fx: x,
    fy: y,
    tx: x,
    ty: y,
    moving: false,
    dir: 1,
    speed: 80,
    life: 280,
    next: 1000,
    charge,
    sx: x,
    sy: y,
  };
  s.clouds.push(c);
  return c;
}

describe('lăzi blestemate', () => {
  it('lada blestemată spartă nu lasă bonus și declanșează blestemul după 0.7s', () => {
    const s = arena();
    const p = put(s.players[0]!, 9, 9);
    setTile(s, 4, 1, SOFT);
    s.cursed[idx(s, 4, 1)] = 1;
    placeBomb(s, p, 3, 1);
    let curse: unknown;
    let broke = 0;
    for (let t = 0; t < FUSE + CURSE_DELAY + 2; t++) {
      step(s, []);
      if (events(s, 'boxDestroyed').some((e) => e.type === 'boxDestroyed' && e.cursed)) broke = s.tick;
      curse ??= events(s, 'curse')[0];
    }
    expect(broke).toBe(FUSE);
    expect(curse).toMatchObject({ type: 'curse', x: 4, y: 1 });
    expect(s.drops[idx(s, 4, 1)]).toBeNull();
    expect(s.items[idx(s, 4, 1)]).toBeNull();
    expect(s.spiders.length + s.clouds.length).toBe(2);
  });

  it('blestemul e determinist: același seed → același tip', () => {
    const kinds = [1, 2].map(() => {
      const s = arena();
      triggerCurse(s, 5, 5);
      return events(s, 'curse')[0];
    });
    expect(kinds[0]).toEqual(kinds[1]);
  });

  it('păianjenul aleargă spre jucător, îl omoară la atingere și dispare', () => {
    const s = arena();
    const p = put(s.players[0]!, 3, 1);
    spider(s, 7, 1);
    let death: unknown;
    for (let t = 0; t < 250 && !death; t++) {
      step(s, []);
      death = events(s, 'death')[0];
    }
    expect(death).toMatchObject({ player: 0, killerId: null, cause: 'spider' });
    expect(p.alive).toBe(false);
    expect(s.spiders).toHaveLength(0);
  });

  it('scutul salvează de păianjen și distruge păianjenul', () => {
    const s = arena();
    const p = put(s.players[0]!, 3, 1);
    p.shieldT = 200;
    spider(s, 5, 1);
    run(s, 250);
    expect(p.alive).toBe(true);
    expect(p.shieldT).toBe(0);
    expect(s.spiders).toHaveLength(0);
  });

  it('păianjenul moare în explozie', () => {
    const s = arena();
    const p = put(s.players[0]!, 9, 9);
    placeBomb(s, p, 3, 1);
    s.bombs[0]!.fuse = 1;
    const c = spider(s, 4, 1);
    c.wait = 100;
    step(s, []);
    step(s, []);
    expect(s.spiders).toHaveLength(0);
  });

  it('păianjenul nu trece de bombe', () => {
    const s = arena(1, { width: 7, height: 7 });
    const p = put(s.players[0]!, 1, 1);
    // coridorul de sus e blocat de o bombă la (3,1); coloana x=5 e blocată de o ladă la (5,3)
    placeBomb(s, p, 3, 1);
    s.bombs[0]!.fuse = 10_000;
    setTile(s, 1, 3, SOFT);
    setTile(s, 5, 3, SOFT);
    spider(s, 5, 1);
    run(s, 80);
    expect(p.alive).toBe(true);
    expect(s.spiders.every((c) => Math.floor((c.px + U / 2) / U) >= 4)).toBe(true);
  });

  it('norul se încarcă și fulgerul lovește în cruce: omoară, sparge lăzi, declanșează bombe', () => {
    const s = arena(2);
    const [a, b] = s.players as [Player, Player];
    put(a, 5, 4);
    put(b, 9, 9);
    setTile(s, 6, 5, SOFT);
    placeBomb(s, b, 5, 6);
    cloud(s, 5, 5, 2);
    run(s, 2);
    expect(events(s, 'strike')).toHaveLength(1);
    const death = events(s, 'death')[0];
    expect(death).toMatchObject({ player: 0, killerId: null, cause: 'lightning' });
    expect(s.grid[idx(s, 6, 5)]).toBe(0);
    step(s, []);
    expect(events(s, 'explode')).toHaveLength(1);
  });

  it('norul anunță zona (cloudCharge) înainte să trăsnească', () => {
    const s = arena();
    put(s.players[0]!, 9, 9);
    const c = cloud(s, 5, 5, -1);
    c.next = 1;
    let charged = false;
    for (let t = 0; t < 100 && !charged; t++) {
      step(s, []);
      charged = events(s, 'cloudCharge').length > 0;
      expect(events(s, 'strike')).toHaveLength(0);
    }
    expect(charged).toBe(true);
    expect(c.moving).toBe(false);
    const n = c.charge;
    run(s, n - 1);
    expect(c.charge).toBe(1);
    step(s, []);
    expect(events(s, 'strike')[0]).toMatchObject({ x: c.sx, y: c.sy });
  });
});

describe('rânduri mobile', () => {
  it('rândul alunecă cu tot conținutul; lada care intră peste jucător îl împinge', () => {
    const s = arena(1, { shift: true });
    const p = put(s.players[0]!, 4, 1);
    setTile(s, 3, 1, SOFT);
    s.items[idx(s, 7, 1)] = 'fire';
    s.shift = { axis: 0, idx: 1, dir: 1, warn: 1, steps: 1, stepT: 0 };
    step(s, []);
    expect(events(s, 'shiftStep')).toHaveLength(1);
    expect(s.grid[idx(s, 4, 1)]).toBe(SOFT);
    expect(s.items[idx(s, 8, 1)]).toBe('fire');
    expect(events(s, 'pushed')[0]).toMatchObject({ player: 0, x: 5, y: 1 });
    expect(tileX(p)).toBe(5);
  });

  it('ce iese pe o parte intră pe cealaltă; la capăt jucătorul e strivit', () => {
    const s = arena(1, { shift: true });
    const p = put(s.players[0]!, s.W - 2, 1);
    setTile(s, s.W - 3, 1, SOFT);
    s.shift = { axis: 0, idx: 1, dir: 1, warn: 1, steps: 1, stepT: 0 };
    step(s, []);
    expect(p.alive).toBe(false);
    expect(events(s, 'death')[0]).toMatchObject({ cause: 'crush' });
    // încă un pas: lada iese prin dreapta și intră prin stânga
    s.shift = { axis: 0, idx: 1, dir: 1, warn: 1, steps: 1, stepT: 0 };
    step(s, []);
    expect(s.grid[idx(s, 1, 1)]).toBe(SOFT);
  });

  it('scutul te salvează de strivire (sparge lada)', () => {
    const s = arena(1, { shift: true });
    const p = put(s.players[0]!, s.W - 2, 1);
    p.shieldT = 100;
    setTile(s, s.W - 3, 1, SOFT);
    s.shift = { axis: 0, idx: 1, dir: 1, warn: 1, steps: 1, stepT: 0 };
    step(s, []);
    expect(p.alive).toBe(true);
    expect(s.grid[idx(s, s.W - 2, 1)]).toBe(0);
  });

  it('anunțul vine periodic, doar pe rânduri/coloane fără stâlpi', () => {
    const s = arena(1, { shift: true });
    put(s.players[0]!, 9, 9);
    const warns: number[] = [];
    for (let t = 0; t < 1200; t++) {
      step(s, []);
      for (const e of s.events) if (e.type === 'shiftWarn') warns.push(e.idx);
    }
    expect(warns.length).toBeGreaterThan(3);
    expect(warns.every((i) => i % 2 === 1)).toBe(true);
  });
});

describe('arena rotativă', () => {
  it('se rotește tot mai repede și își inversează sensul la 25s', () => {
    const s = createGame({
      seed: 1,
      rules: { ...rotateRules(), hurryUpTick: 0 },
      players: [{ bot: null }, { bot: null }],
    });
    expect([s.W, s.H]).toEqual([11, 11]);
    let flips = 0;
    const v: number[] = [];
    for (let t = 0; t < ROT_FLIP * 2 + 100; t++) {
      step(s, []);
      flips += events(s, 'rotFlip').length;
      v.push(s.rot!.v);
    }
    expect(flips).toBe(2);
    expect(v[ROT_FLIP - 1]).toBeGreaterThan(0);
    expect(v[ROT_FLIP + 150]).toBeLessThan(0);
    // viteza crește: la 50s e mai mare (în modul) decât la 5s
    expect(Math.abs(v[ROT_FLIP * 2 - 1]!)).toBeGreaterThan(Math.abs(v[100]!));
    expect(s.rot!.a).toBeGreaterThanOrEqual(0);
    expect(s.rot!.a).toBeLessThan(360 * DEG);
  });
});

function ctfGame(): GameState {
  const s = createGame({
    seed: 11,
    rules: { ...ctfRules(16 / 9), softDensity: 0, boxRespawn: false },
    players: [0, 0, 0, 1, 1, 1].map((team) => ({ bot: null, team })),
  });
  return s;
}

describe('capturează steagul', () => {
  it('bazele sunt pe laturi opuse, la mijloc', () => {
    const s = ctfGame();
    const [a, b] = s.ctf!.flags;
    expect(a.hx).toBe(1);
    expect(b.hx).toBe(s.W - 2);
    expect(a.hy).toBe(b.hy);
  });

  it('furt, purtătorul e mai lent, scăpare la moarte, returnare de coechipier', () => {
    const s = ctfGame();
    const [a, , , foe] = s.players as Player[];
    const flag = s.ctf!.flags[1];
    put(a!, flag.hx, flag.hy);
    step(s, []);
    expect(flag.carrier).toBe(0);
    expect(events(s, 'flagTake')).toHaveLength(1);
    // purtătorul merge cu 85% din viteză
    const x0 = a!.px;
    step(s, [{ dir: 2 }]);
    expect(x0 - a!.px).toBe(Math.floor((a!.speed * 85) / 100));
    // moare → steagul cade unde era
    s.flame[idx(s, tileX(a!), flag.hy)] = 5;
    step(s, []);
    expect(a!.alive).toBe(false);
    expect(flag.carrier).toBeNull();
    expect(flag.atHome).toBe(false);
    expect(events(s, 'flagDrop')).toHaveLength(1);
    // un apărător îl atinge → revine acasă instant
    put(foe!, flag.x, flag.y);
    s.flame.fill(0);
    step(s, []);
    expect(flag.atHome).toBe(true);
    expect(events(s, 'flagReturn')[0]).toMatchObject({ team: 1, player: 3 });
  });

  it('steagul căzut revine singur după 10s', () => {
    const s = ctfGame();
    const flag = s.ctf!.flags[1];
    flag.atHome = false;
    flag.x = 5;
    flag.dropT = FLAG_RETURN;
    run(s, FLAG_RETURN);
    expect(flag.atHome).toBe(true);
    expect([flag.x, flag.y]).toEqual([flag.hx, flag.hy]);
  });

  it('captura se face doar cu steagul propriu acasă; 3 capturi câștigă', () => {
    const s = ctfGame();
    const a = s.players[0]!;
    const [mine, theirs] = s.ctf!.flags;
    for (let i = 0; i < 3; i++) {
      put(a, theirs.hx, theirs.hy);
      step(s, []);
      expect(theirs.carrier).toBe(0);
      if (i === 0) {
        // steagul meu e plecat → nu pot captura
        mine.atHome = false;
        mine.dropT = 100;
        mine.x = 5;
        put(a, mine.hx, mine.hy);
        step(s, []);
        expect(s.ctf!.caps[0]).toBe(0);
        mine.atHome = true;
        mine.x = mine.hx;
      }
      put(a, mine.hx, mine.hy);
      step(s, []);
      expect(s.ctf!.caps[0]).toBe(i + 1);
      expect(theirs.atHome).toBe(true);
    }
    expect(s.result).toMatchObject({ team: 0 });
  });

  it('revii în joc după 3s, la start, cu scut de 2s; la final de timp egalitatea e egalitate', () => {
    const s = ctfGame();
    const a = s.players[0]!;
    const [sx, sy] = [a.sx, a.sy];
    put(a, 5, 5);
    a.bombs = 4;
    s.flame[idx(s, 5, 5)] = 5;
    step(s, []);
    expect(a.alive).toBe(false);
    run(s, RESPAWN);
    expect(a.alive).toBe(true);
    expect([tileX(a), a.py / U]).toEqual([sx, sy]);
    expect(a.bombs).toBe(1);
    expect(a.shieldT).toBe(RESPAWN_SHIELD);
    run(s, s.rules.timeLimit);
    expect(s.result).toMatchObject({ team: null });
  });

  it('boții CTF: purtătorul fuge spre casă', () => {
    const s = createGame({
      seed: 3,
      rules: { ...ctfRules(16 / 9), softDensity: 0, boxRespawn: false },
      players: [0, 0, 0, 1, 1, 1].map((team) => ({ bot: 'hard' as const, team })),
    });
    const a = s.players[0]!;
    const theirs = s.ctf!.flags[1];
    put(a, theirs.hx - 2, theirs.hy);
    theirs.carrier = 0;
    theirs.atHome = false;
    const inp = botInput(s, 0);
    expect(inp.dir).toBe(2); // spre stânga, spre baza proprie
  });
});

describe('bye bye, momente de glorie, statistici', () => {
  it('fără scăpare: blocat în colț de propriile bombe', () => {
    const s = arena();
    const p = put(s.players[0]!, 1, 1);
    p.bombs = 3;
    placeBomb(s, p, 1, 1);
    placeBomb(s, p, 2, 1);
    placeBomb(s, p, 1, 2);
    expect(doomBomb(s, p)).toBe(s.bombs[0]!.id);
    p.kick = true; // cu picior poate șuta bomba de alături
    expect(doomBomb(s, p)).toBeNull();
  });

  it('are scăpare → nu e „bye bye”; bombele coechipierilor nu contează', () => {
    const s = arena();
    const p = put(s.players[0]!, 3, 1);
    placeBomb(s, p);
    expect(doomBomb(s, p)).toBeNull();
    const t = arena(2, { mode: 'teams' });
    const [a, mate] = t.players as [Player, Player];
    mate.team = a.team;
    put(a, 1, 1);
    mate.bombs = 3;
    placeBomb(t, mate, 1, 1);
    placeBomb(t, mate, 2, 1);
    placeBomb(t, mate, 1, 2);
    expect(doomBomb(t, a)).toBeNull();
  });

  it('atingerea vitezei maxime emite „maxed”', () => {
    const s = arena();
    const p = put(s.players[0]!, 3, 1);
    p.speed = SPEED_MAX - SPEED_STEP;
    s.items[idx(s, 3, 1)] = 'speed';
    step(s, []);
    expect(events(s, 'maxed')[0]).toMatchObject({ player: 0, stat: 'speed' });
  });

  it('moartea din bombă șutată are via = 1', () => {
    const s = arena(2);
    const [a, b] = s.players as [Player, Player];
    put(a, 1, 1, 3);
    a.kick = true;
    put(b, 6, 1);
    placeBomb(s, a, 2, 1);
    s.bombs[0]!.fuse = 20;
    let death: unknown;
    for (let t = 0; t < 30 && !death; t++) {
      step(s, [{ dir: t < 2 ? 3 : null }]);
      death = events(s, 'death')[0];
    }
    expect(death).toMatchObject({ player: 1, killerId: 0, via: 1 });
  });

  it('echipe cu foc prieten pornit: propria bombă te omoară', () => {
    const s = arena(2, { mode: 'teams', friendlyFire: true });
    const p = put(s.players[0]!, 3, 1);
    put(s.players[1]!, 9, 9);
    placeBomb(s, p);
    run(s, FUSE);
    expect(p.alive).toBe(false);
  });

  it('manechinele stau pe loc, nu pun bombe și revin în joc', () => {
    const s = createGame({
      seed: 2,
      rules: { softDensity: 0, boxRespawn: false, hurryUpTick: 0, respawnTicks: 40 },
      players: [{ bot: null }, { bot: 'dummy' }],
    });
    const d = s.players[1]!;
    expect(botInput(s, 1)).toEqual({ dir: null });
    run(s, 100, () => [undefined, botInput(s, 1)]);
    expect(s.bombs).toHaveLength(0);
    s.flame[idx(s, tileX(d), d.py / U)] = 3;
    step(s, []);
    expect(d.alive).toBe(false);
    expect(s.result).toBeNull(); // cu revenire în joc nu se termină runda
    run(s, 40);
    expect(d.alive).toBe(true);
  });
});
