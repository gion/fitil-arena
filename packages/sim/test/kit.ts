import { createGame, idx, step, U } from '../src/index.ts';
import type { Dir, GameState, Input, Player, Rules } from '../src/index.ts';

/** Arenă goală (doar stâlpi și margini), fără lăzi care reapar și fără hurry up. */
export function arena(nPlayers = 1, rules: Partial<Rules> = {}): GameState {
  return createGame({
    seed: 1,
    rules: { softDensity: 0, boxRespawn: false, hurryUpTick: 0, ...rules },
    players: Array.from({ length: nPlayers }, () => ({ bot: null })),
  });
}

export function put(p: Player, x: number, y: number, face: Dir = 3): Player {
  p.px = x * U;
  p.py = y * U;
  p.fx = p.tx = x;
  p.fy = p.ty = y;
  p.moving = false;
  p.face = face;
  return p;
}

export const setTile = (s: GameState, x: number, y: number, t: number): void => {
  s.grid[idx(s, x, y)] = t;
};

/** Rulează n tick-uri cu același input (sau o funcție de tick). */
export function run(
  s: GameState,
  n: number,
  inputs: (Input | undefined)[] | ((t: number) => (Input | undefined)[]) = [],
): GameState {
  for (let t = 0; t < n; t++) step(s, typeof inputs === 'function' ? inputs(t) : inputs);
  return s;
}

/** Un singur tick în care jucătorul `id` apasă bomba. */
export function tap(s: GameState, id = 0, kind: 1 | 2 = 1): GameState {
  const inp: (Input | undefined)[] = [];
  inp[id] = { dir: null, bomb: kind };
  return step(s, inp);
}

export const events = (s: GameState, type: string) => s.events.filter((e) => e.type === type);
