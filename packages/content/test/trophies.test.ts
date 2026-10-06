import { describe, expect, it } from 'vitest';
import { bracketOf, isRanked, trophyDelta } from '../src/index.ts';

describe('trofee', () => {
  it('FFA după loc, duelurile după victorie, restul nu dau nimic', () => {
    expect([1, 2, 3, 4].map((place) => trophyDelta('ffa', { place, won: place === 1 }, 100))).toEqual([
      30, 12, -8, -20,
    ]);
    expect(trophyDelta('team2', { place: 1, won: true }, 100)).toBe(25);
    expect(trophyDelta('vs', { place: 2, won: false }, 100)).toBe(-15);
    expect(trophyDelta('ctf', { place: 1, won: true }, 100)).toBe(0);
    expect(isRanked('crown')).toBe(false);
  });

  it('nu coboară sub zero; treptele cresc din 300 în 300', () => {
    expect(trophyDelta('ffa', { place: 4, won: false }, 5)).toBe(-5);
    expect(trophyDelta('ffa', { place: 4, won: false }, 0)).toBeCloseTo(0);
    expect([0, 299, 300, 650].map(bracketOf)).toEqual([0, 0, 1, 2]);
  });
});
