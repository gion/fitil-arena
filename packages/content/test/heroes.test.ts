import { describe, expect, it } from 'vitest';
import { createGame } from '@fitil/sim';
import {
  AFFINITIES,
  ARENA_EVENTS,
  HEROES,
  HERO_IDS,
  MODE_IDS,
  THEMES,
  botHeroes,
  heroSpec,
  matchRules,
  pickArenaEvent,
} from '../src/index.ts';

describe('content/heroes', () => {
  it('7 personaje, câte unul pe fiecare Super; raritățile din GAME_DESIGN', () => {
    expect(HERO_IDS).toHaveLength(7);
    expect(new Set(HERO_IDS.map((h) => HEROES[h].super)).size).toBe(7);
    expect(HERO_IDS.map((h) => HEROES[h].rarity)).toEqual([
      'common',
      'rare',
      'rare',
      'epic',
      'epic',
      'legendary',
      'legendary',
    ]);
  });

  it('afinitățile sunt mici (±15%, max +1 inimă) și doar pe teme existente', () => {
    for (const [theme, a] of Object.entries(AFFINITIES)) {
      expect(THEMES.some((t) => t.id === theme)).toBe(true);
      for (const m of Object.values(a.heroes)) {
        for (const v of [m.speedPct, m.superPct])
          if (v !== undefined) expect(Math.abs(v - 100)).toBeLessThanOrEqual(15);
        expect(m.lives ?? 0).toBeLessThanOrEqual(1);
      }
    }
  });

  it('heroSpec aplică afinitatea temei', () => {
    expect(heroSpec('zuzu', 'jungla').speedPct).toBe(110);
    expect(heroSpec('zuzu', 'clasic').speedPct).toBe(100);
    expect(heroSpec('veta', 'cosmos').speedPct).toBe(77);
    expect(heroSpec('maestro', 'halloween').lives).toBe(1);
    expect(heroSpec('veta', 'clasic').speedPct).toBe(85);
    expect(heroSpec('maestro', 'neon').superPct).toBe(150);
  });

  it('boții primesc personaje deterministe, fără repetări', () => {
    const a = botHeroes(42, 3, ['bubu']);
    expect(a).toEqual(botHeroes(42, 3, ['bubu']));
    expect(new Set(a).size).toBe(3);
    expect(a).not.toContain('bubu');
  });
});

describe('content/arena', () => {
  it('evenimentul e tras din seed și toate apar', () => {
    expect(pickArenaEvent(7)).toEqual(pickArenaEvent(7));
    const seen = new Set<string>();
    for (let s = 1; s < 400; s++) seen.add(pickArenaEvent(s).id);
    expect(seen.size).toBe(ARENA_EVENTS.length);
  });

  it('fiecare mod × temă produce reguli valide și un meci care pornește', () => {
    for (const mode of MODE_IDS)
      for (const t of THEMES) {
        const rules = matchRules(mode, t.id, 11, 16 / 9);
        const n = mode === 'vs' ? 2 : mode === 'team3' || mode === 'ctf' ? 6 : 4;
        const s = createGame({
          seed: 11,
          rules,
          players: Array.from({ length: n }, () => ({ bot: 'normal' })),
        });
        expect(s.rules.event).not.toBeNull();
        expect(s.rules.extras).toBe(true);
      }
  });

  it('fără extras (camere private): regulile modului, fără eveniment', () => {
    const r = matchRules('ffa', 'jungla', 3, 16 / 9, { extras: false });
    expect(r.event).toBeUndefined();
    expect(r.bushRate).toBeUndefined();
  });
});
