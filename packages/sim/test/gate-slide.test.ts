import { describe, expect, it } from 'vitest';
import { GATE_T, SMASH_T, SUPER_FULL, createGame, idx, step, tileX, tileY } from '../src/index.ts';
import type { CharKit, GameState, HeroSpec, Input, SuperKind } from '../src/index.ts';
import { events, put, run, setTile } from './kit.ts';

const SLICK: CharKit = { speed: 165, range: 1, bombs: 1, maxBombs: 6, lives: 1, slide: true };
const PLAIN: CharKit = { speed: 165, range: 1, bombs: 1, maxBombs: 6, lives: 1 };

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

function game(players: { kit?: CharKit; hero?: HeroSpec }[]): GameState {
  return createGame({
    seed: 9,
    rules: { softDensity: 0, boxRespawn: false, hurryUpTick: 0 },
    players: players.map((p) => ({ bot: null, ...p })),
  });
}

const flick = (dir: 0 | 1 | 2 | 3): Input => ({ dir, slide: true });

describe('alunecarea (Slick)', () => {
  it('un swipe puternic alunecă 3 pătrățele, fără control, mai repede decât mersul', () => {
    const s = game([{ kit: SLICK }]);
    const p = put(s.players[0]!, 1, 1, 3);
    step(s, [flick(3)]);
    expect(events(s, 'slide')).toHaveLength(1);
    run(s, 14, [{ dir: 1 }]); // joystick-ul în altă direcție nu mai contează
    expect([tileX(p), tileY(p)]).toEqual([4, 1]);
    expect(p.slideLeft).toBe(0);
  });

  it('fără swipe, în aceleași tick-uri ajunge mai puțin departe', () => {
    const s = game([{ kit: SLICK }]);
    const p = put(s.players[0]!, 1, 1, 3);
    run(s, 15, [{ dir: 3 }]);
    expect(tileX(p)).toBeLessThan(4);
  });

  it('alunecarea se oprește la un obstacol', () => {
    const s = game([{ kit: SLICK }]);
    const p = put(s.players[0]!, 1, 1, 3);
    setTile(s, 3, 1, 2);
    step(s, [flick(3)]);
    run(s, 30);
    expect(tileX(p)).toBe(2);
    expect(s.grid[idx(s, 3, 1)]).toBe(2); // lada nu s-a spart
  });

  it('are pauză între alunecări; fără kit.slide nu face nimic', () => {
    const s = game([{ kit: SLICK }, { kit: PLAIN }]);
    put(s.players[0]!, 1, 1, 3);
    put(s.players[1]!, 1, 3, 3);
    step(s, [flick(3), flick(3)]);
    expect(events(s, 'slide')).toHaveLength(1);
    run(s, 30);
    step(s, [flick(1)]);
    expect(events(s, 'slide')).toHaveLength(0); // încă în pauză
    expect(s.players[1]!.slideLeft).toBe(0);
  });

  it('Smash armat: alunecarea sparge lăzile din cale (până la 5 pătrățele)', () => {
    const s = game([{ kit: SLICK, hero: hero('smash') }]);
    const p = put(s.players[0]!, 1, 1, 3);
    p.charge = SUPER_FULL;
    setTile(s, 3, 1, 2);
    setTile(s, 5, 1, 2);
    step(s, [{ dir: null, super: true }]);
    expect(p.smashT).toBeGreaterThan(0);
    step(s, [flick(3)]);
    expect(events(s, 'slide')[0]).toMatchObject({ smash: true });
    run(s, 40);
    expect(s.grid[idx(s, 3, 1)]).toBe(0);
    expect(s.grid[idx(s, 5, 1)]).toBe(0);
    expect(tileX(p)).toBe(6);
    expect(p.boxes).toBe(2);
    expect(p.smashT).toBe(0); // consumat
  });

  it('Smash nesolicitat nu rămâne armat la nesfârșit', () => {
    const s = game([{ kit: SLICK, hero: hero('smash') }]);
    const p = put(s.players[0]!, 1, 1, 3);
    p.charge = SUPER_FULL;
    step(s, [{ dir: null, super: true }]);
    run(s, SMASH_T + 2);
    expect(p.smashT).toBe(0);
  });
});

describe('poarta (Portia)', () => {
  const portia = (): GameState => {
    const s = game([{ hero: hero('gate') }, {}]);
    const p = put(s.players[0]!, 1, 1, 3);
    put(s.players[1]!, 13, 9);
    p.charge = SUPER_FULL;
    step(s, [{ dir: null, super: true }]);
    return s;
  };

  it('deschide prima ușă în față și a doua la 7 pătrățele, în direcția privirii', () => {
    const s = portia();
    expect(events(s, 'gateOpen')).toHaveLength(1);
    expect(s.gates).toHaveLength(1);
    expect(s.gates[0]).toMatchObject({ a: [2, 1], b: [8, 1], owner: 0 });
    expect(s.players[0]!.charge).toBe(0);
  });

  it('ea trece prin poartă dintr-o parte în alta', () => {
    const s = portia();
    const p = s.players[0]!;
    run(s, 12, [{ dir: 3 }]);
    expect(tileX(p)).toBeGreaterThanOrEqual(8);
  });

  it('ceilalți nu o pot folosi', () => {
    const s = portia();
    const o = put(s.players[1]!, 3, 1, 2);
    run(s, 12, [undefined, { dir: 2 }]);
    expect(tileX(o)).toBeLessThanOrEqual(2); // a ajuns pe pătrățelul porții, fără teleport
    expect(tileX(o)).not.toBe(8);
  });

  it('bomba ei se teleportează prin poartă, a altora nu', () => {
    const s = portia();
    put(s.players[0]!, 1, 3);
    for (const owner of [0, 1]) {
      s.bombs = [
        {
          id: 100 + owner,
          x: 1,
          y: 1,
          fuse: 500,
          range: 1,
          owner,
          remote: false,
          slide: 3,
          prog: 0,
          held: null,
          fly: null,
          chain: 0,
          tpLock: -1,
          via: 1,
          kind: 'normal',
          free: true,
          stuck: null,
          sticky: false,
          bounce: 0,
          area: 0,
        },
      ];
      let jumps = 0;
      for (let t = 0; t < 40; t++) {
        step(s, []);
        jumps += events(s, 'teleport').filter((e) => (e as { kind: string }).kind === 'bomb').length;
      }
      expect(jumps, `bomba jucătorului ${owner}`).toBe(owner === 0 ? 1 : 0);
    }
  });

  it('poarta se închide după 10s; una nouă o înlocuiește pe cea veche', () => {
    const s = portia();
    let closed = 0;
    for (let i = 0; i < GATE_T + 1; i++) {
      step(s, []);
      closed += events(s, 'gateClose').length;
    }
    expect(s.gates).toHaveLength(0);
    expect(closed).toBe(1);
    const s2 = portia();
    const p = s2.players[0]!;
    put(p, 1, 3, 3);
    p.charge = SUPER_FULL;
    step(s2, [{ dir: null, super: true }]);
    expect(s2.gates).toHaveLength(1);
    expect(s2.gates[0]!.a).toEqual([2, 3]);
  });

  it('nu se deschide fără loc în față (bara nu se consumă)', () => {
    const s = game([{ hero: hero('gate') }]);
    const p = put(s.players[0]!, 1, 1, 3);
    p.charge = SUPER_FULL;
    setTile(s, 2, 1, 2);
    step(s, [{ dir: null, super: true }]);
    expect(s.gates).toHaveLength(0);
    expect(p.charge).toBe(SUPER_FULL);
  });
});
