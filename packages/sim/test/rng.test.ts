import { describe, expect, it } from 'vitest';
import { createRng, nextFloat, nextInt, hashState } from '../src/index.ts';

describe('rng', () => {
  it('același seed dă aceeași secvență', () => {
    const a = createRng(42);
    const b = createRng(42);
    const sa = Array.from({ length: 1000 }, () => nextFloat(a));
    const sb = Array.from({ length: 1000 }, () => nextFloat(b));
    expect(sa).toEqual(sb);
    expect(hashState(a)).toBe(hashState(b));
  });

  it('seed-uri diferite dau secvențe diferite', () => {
    expect(nextFloat(createRng(1))).not.toBe(nextFloat(createRng(2)));
  });

  it('nextInt rămâne în interval', () => {
    const r = createRng(7);
    for (let i = 0; i < 10_000; i++) {
      const v = nextInt(r, 13);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(13);
    }
  });
});
