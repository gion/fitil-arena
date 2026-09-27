import { describe, expect, it } from 'vitest';
import { CHALLENGES, TUTORIAL_STEPS } from '@fitil/sim';
import {
  CHALLENGE_TEXT,
  HERO_LINES,
  MODES,
  MODE_IDS,
  THEMES,
  ThemeSchema,
  TUTORIAL_TEXT,
  seasonalTheme,
} from '../src/index.ts';

describe('content/themes', () => {
  it('toate temele trec validarea și au id-uri unice', () => {
    for (const t of THEMES) expect(() => ThemeSchema.parse(t)).not.toThrow();
    expect(new Set(THEMES.map((t) => t.id)).size).toBe(THEMES.length);
  });

  it('6 teme de bază + 4 de eveniment', () => {
    expect(THEMES.filter((t) => !t.season)).toHaveLength(6);
    expect(THEMES.filter((t) => t.season)).toHaveLength(4);
  });

  it('tema de sezon după dată (inclusiv peste Anul Nou)', () => {
    expect(seasonalTheme(new Date(2026, 9, 31))?.id).toBe('halloween');
    expect(seasonalTheme(new Date(2026, 10, 5))?.id).toBe('halloween');
    expect(seasonalTheme(new Date(2026, 10, 6))).toBeNull();
    expect(seasonalTheme(new Date(2027, 0, 3))?.id).toBe('craciun');
    expect(seasonalTheme(new Date(2026, 11, 24))?.id).toBe('craciun');
    expect(seasonalTheme(new Date(2026, 1, 14))?.id).toBe('valentin');
    expect(seasonalTheme(new Date(2026, 8, 27))?.id).toBe('scoala');
    expect(seasonalTheme(new Date(2026, 5, 1))).toBeNull();
  });
});

describe('content/texte', () => {
  it('fiecare mod, provocare și pas de tutorial are text', () => {
    for (const m of MODE_IDS) expect(MODES[m].name).toBeTruthy();
    for (const c of CHALLENGES) expect(CHALLENGE_TEXT[c].desc).toBeTruthy();
    for (const s of TUTORIAL_STEPS) expect(TUTORIAL_TEXT[s].hint).toBeTruthy();
    for (const l of Object.values(HERO_LINES)) expect(l.length).toBeGreaterThan(1);
  });
});
