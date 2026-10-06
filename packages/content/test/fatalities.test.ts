import { describe, expect, it } from 'vitest';
import {
  EMOTES,
  FATALITIES,
  FATALITY_MAX_S,
  SHOP,
  fatalityById,
  emoteById,
  cleanOutfit,
} from '../src/index.ts';

describe('fatalități și emote-uri', () => {
  it('sunt cele 7 din design, fiecare ≤ 1.2s, cu id unic', () => {
    expect(FATALITIES.map((f) => f.id).sort()).toEqual(
      ['balloon', 'chicken', 'filed', 'ghost', 'pancake', 'popcorn', 'rocket'].sort(),
    );
    for (const f of FATALITIES) expect(f.dur, f.id).toBeLessThanOrEqual(FATALITY_MAX_S);
    expect(new Set(FATALITIES.map((f) => f.id)).size).toBe(FATALITIES.length);
    expect(new Set(EMOTES.map((e) => e.id)).size).toBe(EMOTES.length);
  });

  it('fiecare are un obiect în magazin, cu trimitere validă', () => {
    for (const f of FATALITIES) {
      const it = SHOP.find((i) => i.cat === 'fatality' && i.fatality === f.id);
      expect(it, f.id).toBeDefined();
      expect(it!.price).toBeGreaterThan(0);
    }
    for (const e of EMOTES)
      expect(
        SHOP.some((i) => i.cat === 'emote' && i.emote === e.id),
        e.id,
      ).toBe(true);
    expect(fatalityById('nope')).toBeUndefined();
    expect(emoteById('gg')?.name).toBe('GG');
  });

  it('ținuta din rețea păstrează doar fatalitatea / emote-ul valide', () => {
    expect(cleanOutfit({ fatality: 'f_rocket', emote: 'e_gg' })).toMatchObject({
      fatality: 'f_rocket',
      emote: 'e_gg',
    });
    expect(cleanOutfit({ fatality: 'f_nope', emote: 'f_rocket' })).toMatchObject({
      fatality: null,
      emote: null,
    });
  });
});
