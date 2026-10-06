import { describe, expect, it } from 'vitest';
import { BOO, HARD, SUPER_FULL, canSee, createGame, placeBomb, step, tileX, tileY } from '../src/index.ts';
import type { CharKit, GameState, HeroSpec, Input, SuperKind } from '../src/index.ts';
import { events, put, setTile } from './kit.ts';

const hero = (sup: SuperKind, o: Partial<HeroSpec> = {}): HeroSpec => ({
  id: sup,
  super: sup,
  passive: 'none',
  speedSteps: 0,
  speedPct: 100,
  bombs: 0,
  range: 0,
  kick: false,
  lives: 0,
  superPct: 100,
  ...o,
});

function arena(heroes: HeroSpec[], rules = {}): GameState {
  const s = createGame({
    seed: 3,
    rules: { softDensity: 0, boxRespawn: false, hurryUpTick: 0, ...rules },
    players: heroes.map((h) => ({ bot: null, hero: h })),
  });
  for (const p of s.players) p.charge = SUPER_FULL;
  return s;
}

const fire = (s: GameState, id = 0): GameState => {
  const a: (Input | undefined)[] = [];
  a[id] = { dir: null, super: true };
  return step(s, a);
};

describe('Super-urile noi', () => {
  it('Cutremur (Gugu): bombele de pe cele 4 direcții, până la 2 pătrățele, pleacă de lângă el', () => {
    const s = arena([hero('quake'), hero('dash')]);
    const p = put(s.players[0]!, 5, 5);
    put(s.players[1]!, 1, 1);
    p.bombs = 4;
    placeBomb(s, p, 5, 4); // sus, la 1
    placeBomb(s, p, 7, 5); // dreapta, la 2
    placeBomb(s, p, 5, 9); // jos, la 4: prea departe
    for (const b of s.bombs) b.fuse = 500;
    fire(s);
    expect(events(s, 'super')).toHaveLength(1);
    expect(s.bombs.map((b) => b.slide)).toEqual([0, 3, null]);
    expect(p.charge).toBe(0);
    for (let t = 0; t < 30; t++) step(s, []);
    expect(s.bombs[0]!.y).toBeLessThan(4);
    expect(s.bombs[1]!.x).toBeGreaterThan(7);
  });

  it('Cutremur: fără bombe în jur nu se consumă', () => {
    const s = arena([hero('quake')]);
    put(s.players[0]!, 5, 5);
    fire(s);
    expect(s.players[0]!.charge).toBe(SUPER_FULL);
  });

  it('Penalty (Fotbalistul): toate bombele din linia privirii pleacă înainte, până la zid', () => {
    const s = arena([hero('penalty'), hero('dash')]);
    const p = put(s.players[0]!, 1, 1, 3);
    put(s.players[1]!, 9, 9);
    p.bombs = 3;
    placeBomb(s, p, 2, 1);
    placeBomb(s, p, 4, 1);
    placeBomb(s, p, 1, 3); // nu e pe linie
    for (const b of s.bombs) b.fuse = 500;
    setTile(s, 8, 1, HARD);
    fire(s);
    expect(s.bombs.map((b) => b.slide)).toEqual([3, 3, null]);
    for (let t = 0; t < 60; t++) step(s, []);
    // se opresc una după alta lângă zid
    expect(s.bombs.slice(0, 2).map((b) => b.x)).toEqual([6, 7]);
  });

  it('Boo! (Fantoma): 2s invizibilă pentru adversari, coechipierii o văd', () => {
    const s = arena([hero('boo'), hero('dash'), hero('dash'), hero('dash')], { mode: 'teams' });
    const [ghost, foe, mate] = s.players as [
      (typeof s.players)[0],
      (typeof s.players)[0],
      (typeof s.players)[0],
    ];
    put(ghost!, 3, 3);
    put(foe!, 3, 4); // chiar lângă ea
    expect(canSee(s, foe!, ghost!)).toBe(true);
    fire(s);
    expect(ghost!.hiddenT).toBe(BOO - 1);
    expect(canSee(s, foe!, ghost!)).toBe(false);
    expect(canSee(s, mate!, ghost!)).toBe(mate!.team === ghost!.team);
    expect(canSee(s, null, ghost!)).toBe(true);
    for (let t = 0; t < BOO; t++) step(s, []);
    expect(canSee(s, foe!, ghost!)).toBe(true);
  });

  it('Switcheroo (Magicianul): schimbă locul cu cel mai apropiat adversar', () => {
    const s = arena([hero('swap'), hero('dash'), hero('dash')]);
    const [mag, near, far] = s.players;
    put(mag!, 1, 1);
    put(near!, 5, 1);
    put(far!, 9, 9);
    fire(s);
    expect([tileX(mag!), tileY(mag!)]).toEqual([5, 1]);
    expect([tileX(near!), tileY(near!)]).toEqual([1, 1]);
    expect([tileX(far!), tileY(far!)]).toEqual([9, 9]);
    expect(events(s, 'teleport')).toHaveLength(2);
  });

  it('semnătura și Super-ul merg împreună: kitul peste erou, cu afinitățile păstrate', () => {
    const kit: CharKit = { speed: 138, range: 2, bombs: 1, maxBombs: 8, lives: 2 };
    const s = createGame({
      seed: 1,
      players: [
        { bot: null, ch: 'gugu', kit, hero: hero('quake', { speedPct: 110, lives: 1, range: 1 }) },
        { bot: 'easy' },
      ],
    });
    const p = s.players[0]!;
    // 138 × 110% = 151; rază 2 + 1; inimi: 1 (regulă) + 1 (afinitate) + 1 (a doua viață)
    expect([p.speed, p.range, p.lives, p.hero?.super, p.ch]).toEqual([151, 3, 3, 'quake', 'gugu']);
  });
});
