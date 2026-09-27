import { describe, expect, it } from 'vitest';
import { collectInputs, createGame, duelRules, hashState, step } from '../src/index.ts';
import type { BotLevel } from '../src/index.ts';

function play(seed: number, ticks: number, levels: BotLevel[] = ['easy', 'normal', 'hard', 'insane']) {
  const s = createGame({ seed, players: levels.map((bot) => ({ bot })) });
  for (let t = 0; t < ticks; t++) step(s, collectInputs(s));
  return s;
}

describe('determinism', () => {
  it('același seed + aceleași input-uri → hash identic după 2000 de tick-uri', () => {
    expect(hashState(play(123, 2000))).toBe(hashState(play(123, 2000)));
  });

  it('seed-uri diferite → meciuri diferite', () => {
    expect(hashState(play(1, 400))).not.toBe(hashState(play(2, 400)));
  });

  it('starea e serializabilă: o copie JSON continuă identic', () => {
    const a = play(77, 600);
    const b = JSON.parse(JSON.stringify(a)) as typeof a;
    for (let t = 0; t < 600; t++) {
      step(a, collectInputs(a));
      step(b, collectInputs(b));
    }
    expect(hashState(a)).toBe(hashState(b));
  });

  it('1 vs 1: 11×11 și aceleași 3 bonusuri de start pentru ambii', () => {
    const s = createGame({ seed: 5, rules: duelRules(5), players: [{ bot: 'hard' }, { bot: 'hard' }] });
    expect([s.W, s.H]).toEqual([11, 11]);
    expect(s.rules.startItems).toHaveLength(3);
    const [a, b] = s.players;
    expect({ ...a, id: 0, team: 0, px: 0, py: 0, fx: 0, fy: 0, tx: 0, ty: 0, face: 0 }).toEqual({
      ...b,
      id: 0,
      team: 0,
      px: 0,
      py: 0,
      fx: 0,
      fy: 0,
      tx: 0,
      ty: 0,
      face: 0,
    });
  });
});
