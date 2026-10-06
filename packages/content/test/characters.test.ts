import { describe, expect, it } from 'vitest';
import { collectInputs, createGame, hashState, step } from '@fitil/sim';
import { CHARACTERS } from '../src/index.ts';

describe('personajele în simulare', () => {
  it('fiecare personaj pornește cu statisticile și abilitățile din kit', () => {
    for (const c of CHARACTERS) {
      const s = createGame({ seed: 3, players: [{ bot: null, kit: c.kit, ch: c.id }, { bot: 'easy' }] });
      const p = s.players[0]!;
      expect(p.ch, c.id).toBe(c.id);
      expect([p.speed, p.range, p.bombs, p.maxBombs, p.lives], c.id).toEqual([
        c.kit.speed,
        c.kit.range,
        c.kit.bombs,
        c.kit.maxBombs,
        c.kit.lives,
      ]);
      expect(p.kick, c.id).toBe(!!c.kit.kick);
      expect(p.glove, c.id).toBe(!!c.kit.glove);
      expect(p.shieldT, c.id).toBe(c.kit.shield ?? 0);
      expect(p.bigBomb, c.id).toBe(!!c.kit.bigFirst);
    }
  });

  it('meciuri între boți cu toate personajele se termină și sunt deterministe', () => {
    for (let g = 0; g < 3; g++) {
      const play = () => {
        const s = createGame({
          seed: 100 + g,
          rules: { charges: true },
          players: [0, 1, 2, 3].map((i) => {
            const c = CHARACTERS[(g * 4 + i) % CHARACTERS.length]!;
            return { bot: 'hard' as const, kit: c.kit, ch: c.id };
          }),
        });
        for (let t = 0; t < 20 * 240 && !s.result; t++) step(s, collectInputs(s));
        return s;
      };
      const a = play();
      expect(a.result, `meci ${g}`).not.toBeNull();
      expect(hashState(a)).toBe(hashState(play()));
    }
  });
});
