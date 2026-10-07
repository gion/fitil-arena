import { describe, expect, it } from 'vitest';
import { createGame } from '@fitil/sim';
import {
  AFFINITIES,
  ARENA_EVENTS,
  CHARACTERS,
  MODE_IDS,
  THEMES,
  charSetup,
  heroSpec,
  matchRules,
  pickArenaEvent,
} from '../src/index.ts';

describe('content/heroes', () => {
  it('15 personaje, fiecare cu alt Ultimate', () => {
    expect(CHARACTERS).toHaveLength(15);
    expect(new Set(CHARACTERS.map((c) => c.ultimate.kind)).size).toBe(15);
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

  it('heroSpec aplică afinitatea temei peste Ultimate-ul personajului', () => {
    expect(heroSpec('zuzu', 'jungla').speedPct).toBe(110);
    expect(heroSpec('zuzu', 'clasic').speedPct).toBe(100);
    expect(heroSpec('veta', 'cosmos').speedPct).toBe(90);
    expect(heroSpec('maestru', 'halloween').lives).toBe(1);
    expect(heroSpec('maestru', 'neon')).toMatchObject({ super: 'timestop', superPct: 150, passive: 'none' });
  });

  it('charSetup: kitul (semnătura) și eroul (Ultimate + afinitate) ajung împreună în simulare', () => {
    const s = createGame({
      seed: 4,
      rules: matchRules('ffa', 'jungla', 4, 16 / 9),
      players: [
        { bot: null, ...charSetup('zuzu', 'jungla') },
        { bot: 'easy', ...charSetup('gugu', 'jungla') },
      ],
    });
    const [zuzu, gugu] = s.players;
    // Zuzu: 200 × 110% = 220, maxim 5 bombe (semnătură), Ultimate Dash
    expect([zuzu!.speed, zuzu!.maxBombs, zuzu!.hero?.super]).toEqual([220, 5, 'dash']);
    // Gugu: a doua viață peste inima meciului
    expect([gugu!.lives, gugu!.hero?.super]).toEqual([2, 'quake']);
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
