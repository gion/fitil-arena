import { describe, expect, it } from 'vitest';
import {
  BURST_CAP,
  SMOKE_T,
  SUPER_FULL,
  areaTiles,
  burstRadius,
  canSee,
  computeDanger,
  createGame,
  idx,
  placeBomb,
  step,
} from '../src/index.ts';
import type { CharKit, GameState, HeroSpec, Input, SuperKind } from '../src/index.ts';
import { events, put, run, setTile } from './kit.ts';

const BURST_KIT: CharKit = {
  speed: 160,
  range: 1,
  bombs: 1,
  maxBombs: 6,
  lives: 1,
  burst: true,
  fuseAdd: 10,
};
const PLAIN_KIT: CharKit = { speed: 160, range: 1, bombs: 1, maxBombs: 6, lives: 1 };

const hero = (sup: SuperKind): HeroSpec => ({
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
});

function game(kits: { kit?: CharKit; hero?: HeroSpec; team?: number }[], rules = {}): GameState {
  return createGame({
    seed: 5,
    rules: { softDensity: 0, boxRespawn: false, hurryUpTick: 0, ...rules },
    players: kits.map((k) => ({ bot: null, ...k })),
  });
}

/** Rulează 3 tick-uri și strânge evenimentele `explode` (se golesc la fiecare tick). */
function explodes(s: GameState) {
  const out: ReturnType<typeof events> = [];
  for (let t = 0; t < 3; t++) {
    step(s, []);
    out.push(...events(s, 'explode'));
  }
  return out;
}

const has = (tiles: [number, number][], x: number, y: number) => tiles.some(([a, b]) => a === x && b === y);

describe('bombă în arie (Nova)', () => {
  it('raza ariei = raza bombei + 1, cu plafon', () => {
    expect(burstRadius(1)).toBe(2);
    expect(burstRadius(2)).toBe(BURST_CAP);
    expect(burstRadius(8)).toBe(BURST_CAP);
  });

  it('aria ocolește stâlpii și acoperă mai mult decât crucea', () => {
    const s = game([{}]);
    const t = areaTiles(s, 5, 5, 2);
    expect(has(t, 5, 5)).toBe(true);
    expect(has(t, 7, 5)).toBe(true);
    expect(has(t, 7, 6)).toBe(true); // în jurul stâlpului (6,6)
    expect(has(t, 7, 7)).toBe(true);
    expect(has(t, 6, 6)).toBe(false); // stâlpul
    expect(t.length).toBeGreaterThan(9); // crucea de rază 2 are 9
  });

  it('lada oprește aria, iar zidurile nu sunt atinse niciodată', () => {
    const s = game([{}]);
    setTile(s, 6, 5, 2);
    const t = areaTiles(s, 5, 5, 2);
    expect(has(t, 6, 5)).toBe(true); // ladă lovită
    expect(has(t, 7, 5)).toBe(false); // în spatele ei
    for (const [x, y] of areaTiles(s, 1, 1, 3)) expect(s.grid[idx(s, x, y)]).not.toBe(1);
  });

  it('bomba lui Nova are arie, a celorlalți nu', () => {
    const s = game([{ kit: BURST_KIT }, { kit: PLAIN_KIT }]);
    const a = put(s.players[0]!, 5, 5);
    const b = put(s.players[1]!, 9, 9);
    placeBomb(s, a);
    placeBomb(s, b);
    expect(s.bombs.map((x) => x.area)).toEqual([2, 0]);
  });

  it('flacăra ajunge pe diagonală, unde crucea de rază 1 nu ajunge', () => {
    const s = game([{ kit: BURST_KIT }, { kit: PLAIN_KIT }]);
    put(s.players[0]!, 1, 1);
    const victim = put(s.players[1]!, 4, 3);
    s.players[1]!.lives = 1;
    // bombă la (3,2): (4,3) e pe diagonală (crucea ar da doar (3,1),(3,3), între stâlpi)
    const b = placeBomb(s, put(s.players[0]!, 3, 2));
    expect(b).toBe(true);
    put(s.players[0]!, 1, 1);
    s.bombs[0]!.fuse = 1;
    const seen = explodes(s);
    expect(seen[0]).toMatchObject({ area: 2 });
    expect(victim.alive).toBe(false);
  });

  it('o bombă obișnuită de rază 1 nu lovește pe diagonală', () => {
    const s = game([{ kit: PLAIN_KIT }, { kit: PLAIN_KIT }]);
    put(s.players[0]!, 1, 1);
    const other = put(s.players[1]!, 4, 3);
    placeBomb(s, put(s.players[0]!, 3, 2));
    put(s.players[0]!, 1, 1);
    s.bombs[0]!.fuse = 1;
    expect(explodes(s)).toHaveLength(1);
    expect(other.alive).toBe(true);
  });

  it('harta de pericol (boți) include aria', () => {
    const s = game([{ kit: BURST_KIT }]);
    placeBomb(s, put(s.players[0]!, 5, 5));
    const d = computeDanger(s);
    expect(d[idx(s, 7, 6)]).toBe(1);
    expect(d[idx(s, 9, 9)]).toBe(0);
  });

  it('Supernova (Ultimate-ul lui Nova) lărgește aria cu o treaptă peste plafon', () => {
    const s = game([{ kit: BURST_KIT, hero: hero('nova') }]);
    const p = put(s.players[0]!, 5, 5);
    p.charge = SUPER_FULL;
    const inp: (Input | undefined)[] = [{ dir: null, super: true }];
    step(s, inp);
    expect(s.bombs.at(-1)!.area).toBe(BURST_CAP + 1);
  });
});

describe('bomba fumigenă (Shade)', () => {
  const smokeGame = (): GameState => {
    const s = game([{ hero: hero('smoke') }, {}, {}]);
    put(s.players[0]!, 3, 1, 3); // privește spre dreapta (3)
    put(s.players[1]!, 13, 9);
    put(s.players[2]!, 9, 7);
    s.players[0]!.charge = SUPER_FULL;
    return s;
  };

  it('aruncă fumul la 3 pătrățele în față și golește bara', () => {
    const s = smokeGame();
    step(s, [{ dir: null, super: true }]);
    expect(events(s, 'smokeBomb')).toHaveLength(1);
    expect(events(s, 'smokeBomb')[0]).toMatchObject({ x: 6, y: 1 });
    expect(s.smoke[idx(s, 6, 1)]).toBeGreaterThan(0);
    expect(s.smoke[idx(s, 8, 1)]).toBeGreaterThan(0);
    expect(s.smoke[idx(s, 6, 6)]).toBe(0);
    expect(s.players[0]!.charge).toBe(0);
  });

  it('nu pune fum pe stâlpi sau în afara arenei', () => {
    const s = smokeGame();
    step(s, [{ dir: null, super: true }]);
    for (let k = 0; k < s.smoke.length; k++) if (s.smoke[k]! > 0) expect(s.grid[k]).toBe(0);
  });

  it('ce e în fum nu se vede de departe, dar se vede de aproape', () => {
    const s = smokeGame();
    const [, far, near] = s.players as [never, (typeof s.players)[0], (typeof s.players)[0]];
    put(far, 6, 1); // în fum
    put(near, 6, 2); // în fum, lângă
    step(s, [{ dir: null, super: true }]);
    const viewer = put(s.players[2]!, 6, 3); // tot în fum
    put(s.players[1]!, 7, 1);
    expect(canSee(s, viewer, s.players[1]!)).toBe(false); // ambii în fum, la 3 pătrățele
    put(viewer, 7, 2);
    expect(canSee(s, viewer, s.players[1]!)).toBe(true); // la 1 pătrățel
  });

  it('cine e în fum nu vede nici ce e în afara lui', () => {
    const s = smokeGame();
    step(s, [{ dir: null, super: true }]);
    const inside = put(s.players[1]!, 6, 1);
    const outside = put(s.players[2]!, 11, 1);
    expect(canSee(s, inside, outside)).toBe(false);
    expect(canSee(s, outside, inside)).toBe(false);
    const clear = put(s.players[2]!, 11, 5);
    put(inside, 11, 9);
    expect(canSee(s, clear, inside)).toBe(true); // fără fum la niciunul
  });

  it('coechipierii se văd prin fum', () => {
    const s = game([{ hero: hero('smoke'), team: 0 }, { team: 0 }, { team: 1 }], { mode: 'teams' });
    put(s.players[0]!, 3, 1, 3);
    s.players[0]!.charge = SUPER_FULL;
    step(s, [{ dir: null, super: true }]);
    put(s.players[1]!, 6, 1);
    put(s.players[2]!, 8, 1);
    expect(canSee(s, s.players[0]!, s.players[1]!)).toBe(true);
    expect(canSee(s, s.players[2]!, s.players[0]!)).toBe(false);
  });

  it('fumul se risipește după 6 secunde', () => {
    const s = smokeGame();
    step(s, [{ dir: null, super: true }]);
    run(s, SMOKE_T - 2);
    expect(s.smoke[idx(s, 6, 1)]).toBeGreaterThan(0);
    run(s, 3);
    expect(s.smoke.every((v) => v === 0)).toBe(true);
  });

  it('fumul nu rănește pe nimeni', () => {
    const s = smokeGame();
    step(s, [{ dir: null, super: true }]);
    const p = put(s.players[1]!, 6, 1);
    run(s, 40);
    expect(p.alive).toBe(true);
  });
});
