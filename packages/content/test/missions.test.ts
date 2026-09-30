import { describe, expect, it } from 'vitest';
import { CHAPTERS, MISSIONS, chapterUnlocked, missionById, missionUnlocked } from '../src/index.ts';

describe('content/misiuni', () => {
  it('toate misiunile din capitole există, cu id-uri unice și toate cele 4 tipuri', () => {
    expect(new Set(MISSIONS.map((m) => m.id)).size).toBe(MISSIONS.length);
    for (const c of CHAPTERS) for (const id of c.missions) expect(missionById(id)).toBeDefined();
    expect(new Set(MISSIONS.map((m) => m.kind))).toEqual(new Set(['collect', 'demolish', 'rescue', 'race']));
    for (const m of MISSIONS) expect(m.dmin).toBeLessThan(m.dmax);
  });

  it('deblocare progresivă: misiune cu misiune, capitol cu capitol', () => {
    expect(missionUnlocked('collect-1', {})).toBe(true);
    expect(missionUnlocked('demolish-1', {})).toBe(false);
    expect(missionUnlocked('demolish-1', { 'collect-1': 1 })).toBe(true);
    expect(chapterUnlocked(1, { 'collect-1': 3, 'demolish-1': 3 })).toBe(false);
    const eight = { 'collect-1': 2, 'demolish-1': 2, 'rescue-1': 2, 'race-1': 2 };
    expect(chapterUnlocked(1, eight)).toBe(true);
    expect(missionUnlocked('collect-2', eight)).toBe(true);
    expect(missionUnlocked('demolish-2', eight)).toBe(false);
  });
});
