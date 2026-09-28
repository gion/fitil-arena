import { describe, expect, it } from 'vitest';
import {
  EMPTY,
  FUSE,
  HARD,
  HEART_HP,
  HOME,
  HURT_FLAME,
  HURT_GRACE,
  INF_R,
  SOFT,
  TICK_HZ,
  U,
  createGame,
  createMission,
  genCell,
  hitTarget,
  idx,
  inBounds,
  missionGoal,
  missionStars,
  placeBomb,
  step,
  tileX,
} from '../src/index.ts';
import type { Dir, GameState, MissionDef, MissionTarget } from '../src/index.ts';
import { events, put, run } from './kit.ts';

const base = { armored: 0, timeLimit: 0, softDensity: 0.5, spiders: { max: 0, every: 9 } };
const DEFS: Record<string, MissionDef> = {
  collect: {
    ...base,
    id: 'c',
    kind: 'collect',
    count: 10,
    dmin: 5,
    dmax: 20,
    stars: { two: 150, three: 100, hp: 50 },
  },
  demolish: {
    ...base,
    id: 'd',
    kind: 'demolish',
    count: 5,
    armored: 2,
    dmin: 6,
    dmax: 18,
    stars: { two: 150, three: 100, hp: 50 },
  },
  rescue: {
    ...base,
    id: 'r',
    kind: 'rescue',
    count: 3,
    dmin: 8,
    dmax: 16,
    stars: { two: 180, three: 130, hp: 50 },
  },
  race: {
    ...base,
    id: 'x',
    kind: 'race',
    count: 1,
    dmin: 19,
    dmax: 22,
    timeLimit: 60,
    softDensity: 0.3,
    stars: { two: 15, three: 25, hp: 0 },
  },
};

const cell = (s: GameState, x: number, y: number) => s.grid[idx(s, x, y)];

/** Mută jucătorul și avansează un tick (fereastra lumii se regenerează în jurul lui). */
function teleport(s: GameState, x: number, y: number): void {
  put(s.players[0]!, x, y);
  step(s, []);
}

describe('lumea infinită', () => {
  it('aceeași coordonată generează mereu aceeași celulă (și alt seed, altă lume)', () => {
    const a = createGame({ seed: 5, rules: { infinite: true, softDensity: 0.5 }, players: [{ bot: null }] });
    const b = createGame({ seed: 5, rules: { infinite: true, softDensity: 0.5 }, players: [{ bot: null }] });
    const c = createGame({ seed: 6, rules: { infinite: true, softDensity: 0.5 }, players: [{ bot: null }] });
    let diff = 0;
    for (let y = -20; y <= 20; y++)
      for (let x = -20; x <= 20; x++) {
        expect(cell(a, x, y)).toBe(cell(b, x, y));
        expect(genCell(a, x, y).g).toBe(cell(a, x, y));
        if (cell(a, x, y) !== cell(c, x, y)) diff++;
      }
    expect(diff).toBeGreaterThan(100);
    expect(cell(a, 0, 0)).toBe(HARD); // stâlpi pe pozițiile pare
    expect(cell(a, 1, 1)).toBe(EMPTY); // start liber
  });

  it('fără margini: mergi oricât; zonele modificate rămân modificate cât sunt în rază', () => {
    const s = createGame({
      seed: 5,
      rules: { infinite: true, softDensity: 0, hurryUpTick: 0, boxRespawn: false },
      players: [{ bot: null }],
    });
    s.grid[idx(s, 3, 3)] = SOFT; // modificare
    run(s, 200, [{ dir: 2 }]); // spre stânga, prin x negativ
    expect(tileX(s.players[0]!)).toBeLessThan(-5);
    expect(cell(s, 3, 3)).toBe(SOFT); // încă în rază → păstrată
    teleport(s, 60, 1);
    expect(inBounds(s, 3, 3)).toBe(false); // ieșită din fereastră
    teleport(s, 1, 1);
    expect(cell(s, 3, 3)).toBe(EMPTY); // regenerată din hash
    expect(inBounds(s, 1 + INF_R, 1)).toBe(true);
  });
});

describe('misiuni: ținte', () => {
  for (const [name, def] of Object.entries(DEFS))
    it(`${name}: ținte deterministe din seed, la distanța cerută, nu pe stâlpi`, () => {
      const a = createMission(def, 42).mission!.targets;
      const b = createMission(def, 42).mission!.targets;
      const c = createMission(def, 43).mission!.targets;
      expect(a).toEqual(b);
      expect(a).not.toEqual(c);
      expect(a).toHaveLength(name === 'race' ? 1 : def.count);
      for (const t of a) {
        const d2 = (t.x - HOME[0]) ** 2 + (t.y - HOME[1]) ** 2;
        expect(d2).toBeGreaterThanOrEqual((def.dmin - 1) ** 2);
        expect(d2).toBeLessThanOrEqual((def.dmax + 1) ** 2);
        expect((t.x & 1) === 0 && (t.y & 1) === 0).toBe(false);
        for (const o of a)
          if (o !== t) expect(Math.abs(o.x - t.x) + Math.abs(o.y - t.y)).toBeGreaterThanOrEqual(4);
      }
    });

  it('țintele sunt în lăzi (steagul cursei pe loc liber); cuștile sunt înconjurate de lăzi', () => {
    const s = createMission(DEFS.rescue!, 7);
    for (const t of s.mission!.targets) {
      expect(cell(s, t.x, t.y)).toBe(SOFT);
      const around = [
        [0, 1],
        [0, -1],
        [1, 0],
        [-1, 0],
      ].filter(([dx, dy]) => cell(s, t.x + dx!, t.y + dy!) !== EMPTY).length;
      expect(around).toBeGreaterThanOrEqual(2);
    }
    const r = createMission(DEFS.race!, 7);
    const f = r.mission!.targets[0]!;
    expect(cell(r, f.x, f.y)).toBe(EMPTY);
  });

  it('țintele își păstrează starea la regenerarea lumii', () => {
    const s = createMission(DEFS.collect!, 9);
    const [open, closed] = s.mission!.targets as [MissionTarget, MissionTarget];
    hitTarget(s, open!.x, open!.y, 0, 0); // cristalul iese din ladă
    expect(s.items[idx(s, open!.x, open!.y)]).toBe('crystal');
    s.grid[idx(s, closed!.x, closed!.y)] = EMPTY; // o modificare fără să atingă ținta (ex. altă cale)
    // pleacă departe (celulele țintelor sunt suprascrise în stocare), apoi revine
    teleport(s, open!.x + 45, open!.y + 45);
    expect(inBounds(s, open!.x, open!.y)).toBe(false);
    teleport(s, open!.x - 1, open!.y);
    expect(cell(s, open!.x, open!.y)).toBe(EMPTY);
    expect(s.items[idx(s, open!.x, open!.y)]).toBe('crystal'); // cristalul e tot pe jos
    teleport(s, closed!.x, closed!.y + 1);
    expect(cell(s, closed!.x, closed!.y)).toBe(SOFT); // ținta neatinsă e din nou în ladă
  });
});

describe('misiuni: victorie, înfrângere, stele', () => {
  it('Colecționar: bomba sparge lada, cristalul rămâne în flacără, îl culegi → progres; toate → victorie', () => {
    const s = createMission(DEFS.collect!, 3);
    const p = s.players[0]!;
    const t = s.mission!.targets[0]!;
    // bombă lângă ladă (loc liber forțat), jucătorul departe
    const bx = t.x + ((t.x & 1) === 0 ? 0 : 1);
    const by = (t.x & 1) === 0 ? t.y + 1 : t.y;
    teleport(s, bx, by + 6);
    s.grid[idx(s, bx, by)] = EMPTY;
    placeBomb(s, p, bx, by);
    run(s, FUSE);
    expect(t.open).toBe(true);
    expect(s.items[idx(s, t.x, t.y)]).toBe('crystal');
    run(s, 12);
    expect(s.items[idx(s, t.x, t.y)]).toBe('crystal'); // flacăra nu-l distruge
    teleport(s, t.x, t.y);
    expect(s.mission!.count).toBe(1);
    expect(events(s, 'missionProgress')).toHaveLength(1);
    for (const o of s.mission!.targets.slice(1)) {
      hitTarget(s, o.x, o.y, 0, 0);
      s.flame.fill(0);
      teleport(s, o.x, o.y);
    }
    expect(s.mission!.over).toMatchObject({ won: true, reason: 'done' });
    expect(s.result).toMatchObject({ winner: 0 });
  });

  it('Demolare: turnul blindat cere 2 explozii; prima oprește flacăra', () => {
    const s = createMission(DEFS.demolish!, 4);
    const armored = s.mission!.targets.find((t) => t.maxHp === 2)!;
    const plain = s.mission!.targets.find((t) => t.maxHp === 1)!;
    expect(s.mission!.targets.filter((t) => t.maxHp === 2)).toHaveLength(2);
    expect(hitTarget(s, armored.x, armored.y, 0, 0)).toBe(true);
    expect(armored.done).toBe(false);
    expect(cell(s, armored.x, armored.y)).toBe(SOFT);
    hitTarget(s, armored.x, armored.y, 0, 0);
    expect(armored.done).toBe(true);
    expect(cell(s, armored.x, armored.y)).toBe(EMPTY);
    hitTarget(s, plain.x, plain.y, 0, 0);
    expect(s.mission!.count).toBe(2);
  });

  it('Salvare: prietenul eliberat te urmează, leșină în flacără și ajunge acasă', () => {
    const s = createMission(DEFS.rescue!, 5);
    const c = s.mission!.targets[0]!;
    hitTarget(s, c.x, c.y, -1, 0);
    expect(events(s, 'friendFree')).toHaveLength(1);
    const f = s.mission!.friends[0]!;
    // leșin: flacără pe prieten
    s.flame[idx(s, c.x, c.y)] = 3;
    step(s, []);
    expect(f.faint).toBeGreaterThan(0);
    s.flame.fill(0);
    run(s, 70);
    // jucătorul acasă, prietenul la 2 pătrățele, pe un drum liber: vine lângă tine și e acasă
    teleport(s, 1, 1);
    f.px = 3 * U;
    f.py = 1 * U;
    f.moving = false;
    s.grid[idx(s, 3, 1)] = EMPTY;
    run(s, 30);
    expect(f.home).toBe(true);
    expect(s.mission!.count).toBe(1);
    expect(missionGoal(s)).toMatchObject({ home: false });
  });

  it('Cursă: ajungi la steag → victorie; după 60s → înfrângere', () => {
    const s = createMission(DEFS.race!, 6);
    const f = s.mission!.targets[0]!;
    teleport(s, f.x, f.y);
    expect(s.mission!.over).toMatchObject({ won: true });
    const late = createMission(DEFS.race!, 6);
    run(late, 60 * TICK_HZ);
    expect(late.mission!.over).toMatchObject({ won: false, reason: 'time' });
  });

  it('bară de viață: explozia −35% cu invulnerabilitate, inima +25%, la 0% misiunea e pierdută', () => {
    const s = createMission(DEFS.collect!, 8);
    const p = s.players[0]!;
    p.shieldT = 0;
    s.flame[idx(s, 1, 1)] = 5;
    step(s, []);
    expect(p.hp).toBe(100 - HURT_FLAME);
    expect(p.graceT).toBeGreaterThan(HURT_GRACE - 3);
    step(s, []);
    expect(p.hp).toBe(100 - HURT_FLAME); // invulnerabil
    s.flame.fill(0);
    s.items[idx(s, 1, 2)] = 'heart';
    teleport(s, 1, 2);
    expect(p.hp).toBe(100 - HURT_FLAME + HEART_HP);
    p.hp = 20;
    p.graceT = 0;
    s.flame[idx(s, 1, 2)] = 5;
    step(s, []);
    expect(p.alive).toBe(false);
    expect(s.mission!.over).toMatchObject({ won: false, reason: 'dead' });
  });

  it('păianjenii rătăcitori apar în jur și rănesc (−20%) fără să moară', () => {
    const s = createMission({ ...DEFS.collect!, spiders: { max: 3, every: 1 } }, 11);
    s.players[0]!.shieldT = 0;
    run(s, 200);
    expect(s.spiders.length).toBeGreaterThan(0);
    expect(s.spiders.length).toBeLessThanOrEqual(3);
    // un păianjen chiar lângă jucător
    const c = s.spiders[0]!;
    const p = s.players[0]!;
    c.px = p.px + U;
    c.py = p.py;
    c.moving = false;
    c.wait = 0;
    const hurt = [] as number[];
    for (let t = 0; t < 60 && !hurt.length; t++) {
      step(s, []);
      for (const e of s.events) if (e.type === 'hurt') hurt.push(e.amount);
    }
    expect(hurt[0]).toBe(20);
    expect(p.alive).toBe(true);
    expect(s.spiders).toContain(c); // în misiuni păianjenul nu dispare după atac
  });

  it('stele: timp și viață (cursă: secunde rămase)', () => {
    const s = createMission(DEFS.collect!, 1);
    const m = s.mission!;
    const p = s.players[0]!;
    m.over = { won: true, reason: 'done', tick: 90 * TICK_HZ };
    expect(missionStars(s)).toBe(3);
    p.hp = 40;
    expect(missionStars(s)).toBe(2);
    m.over.tick = 160 * TICK_HZ;
    expect(missionStars(s)).toBe(1);
    m.over.won = false;
    expect(missionStars(s)).toBe(0);
    const r = createMission(DEFS.race!, 1);
    r.mission!.over = { won: true, reason: 'done', tick: 30 * TICK_HZ };
    expect(missionStars(r)).toBe(3);
    r.mission!.over.tick = 40 * TICK_HZ;
    expect(missionStars(r)).toBe(2);
    r.mission!.over.tick = 50 * TICK_HZ;
    expect(missionStars(r)).toBe(1);
  });

  it('determinism: aceeași misiune + aceleași input-uri → aceeași stare', () => {
    const play = () => {
      const s = createMission({ ...DEFS.rescue!, spiders: { max: 3, every: 2 } }, 21);
      for (let t = 0; t < 800; t++)
        step(s, [{ dir: ([3, 1, 2, 0] as Dir[])[Math.floor(t / 40) % 4]!, bomb: t % 50 === 0 ? 1 : 0 }]);
      return JSON.stringify(s);
    };
    expect(play()).toBe(play());
  });
});
