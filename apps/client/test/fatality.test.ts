import { describe, expect, it } from 'vitest';
import { FATALITIES, FATALITY_MAX_S } from '@fitil/content';
import { fatalityPose } from '../src/render/fatality.ts';

describe('fatalități (poze)', () => {
  for (const f of FATALITIES) {
    it(`${f.id}: ≤ ${FATALITY_MAX_S}s, valori finite, la final nu mai rămâne nimic vizibil`, () => {
      expect(f.dur).toBeLessThanOrEqual(FATALITY_MAX_S);
      for (let i = 0; i <= 60; i++) {
        const t = (i / 60) * f.dur;
        const p = fatalityPose(f.id, t)!;
        expect(p, f.id).not.toBeNull();
        for (const v of [p.dx, p.dy, p.rot, p.sx, p.sy, p.alpha, p.roast])
          expect(Number.isFinite(v)).toBe(true);
        for (const pr of p.props)
          for (const v of [pr.x, pr.y, pr.rot, pr.s, pr.a]) expect(Number.isFinite(v)).toBe(true);
        expect(fatalityPose(f.id, t)).toEqual(p); // pură
      }
      const end = fatalityPose(f.id, f.dur)!;
      expect(end.alpha).toBeLessThanOrEqual(0.01);
      for (const pr of end.props) expect(pr.a, `${f.id} ${pr.kind}`).toBeLessThanOrEqual(0.5);
    });

    it(`${f.id}: începe cu victima întreagă`, () => {
      const p = fatalityPose(f.id, 0)!;
      if (f.id !== 'popcorn') expect(p.alpha).toBeGreaterThan(0.9);
      expect(p.sx).toBeGreaterThan(0.5);
    });
  }

  it('id necunoscut', () => expect(fatalityPose('nope', 0)).toBeNull());
});
