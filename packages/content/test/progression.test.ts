import { describe, expect, it } from 'vitest';
import {
  CHARACTERS,
  CHAR_RELEASE,
  EVENT_THEME_PRICE,
  MODE_LEVEL,
  accessOf,
  buyChar,
  buyTheme,
  charState,
  defaultProfile,
  modeLock,
  openKeys,
  playerLevel,
  reward,
  selectChar,
  themeState,
  unlocksAt,
  weeklyRotation,
} from '../src/index.ts';
import type { Access, Profile } from '../src/index.ts';

const at = (level: number, date = '2026-10-01', admin = false): Access => ({ level, date, admin });
const rich = (): Profile => ({ ...defaultProfile(), coins: 99999 });

describe('nivelul de jucător', () => {
  it('curba: 100, 150, 200…; vine din XP-ul tuturor personajelor', () => {
    expect(playerLevel(0).level).toBe(1);
    expect(playerLevel(100).level).toBe(2);
    expect(playerLevel(249).level).toBe(2);
    expect(playerLevel(250).level).toBe(3);
    expect(accessOf({ ...defaultProfile(), xp: { bubu: 60, zuzu: 50 } }, '2026-10-01').level).toBe(2);
  });

  it('modurile se deschid pe niveluri; FFA de la început; adminul le are pe toate', () => {
    expect(modeLock('ffa', at(1))).toBeNull();
    expect(modeLock('ctf', at(4))).toEqual({ kind: 'level', level: MODE_LEVEL.ctf });
    expect(modeLock('ctf', at(5))).toBeNull();
    expect(modeLock('ctf', at(1, '2026-10-01', true))).toBeNull();
    expect(unlocksAt(2)).toContain('1 vs 1');
  });
});

describe('personaje: nivel + Fitile, calendar, rotație', () => {
  it('un Epic cere nivelul 6 chiar dacă ai Fitile; apoi se cumpără', () => {
    const date = '2026-10-05'; // săptămână în care fifi nu e gratuită? verificăm explicit
    const rot = weeklyRotation(date);
    const epic = CHARACTERS.find((c) => c.rarity === 'epic' && !CHAR_RELEASE[c.id] && !rot.includes(c.id))!;
    expect(charState(rich(), epic.id, at(5, date))).toMatchObject({ kind: 'level', level: 6 });
    expect(buyChar(rich(), epic.id, at(5, date))).toEqual({ ok: false, why: 'locked' });
    expect(buyChar(rich(), epic.id, at(6, date)).ok).toBe(true);
  });

  it('personajele din calendar sunt „coming soon” până la lansare, apoi normale', () => {
    const [id, date] = Object.entries(CHAR_RELEASE)[0]!;
    const before = charState(rich(), id, at(30, '2026-10-01'));
    expect(before.kind).toBe('soon');
    expect(before.kind === 'soon' && before.days).toBeGreaterThan(0);
    expect(buyChar(rich(), id, at(30, '2026-10-01'))).toEqual({ ok: false, why: 'locked' });
    expect(charState(rich(), id, at(30, date)).kind).not.toBe('soon');
    // adminul vede tot
    expect(charState(rich(), id, at(1, '2026-10-01', true)).kind).toBe('buy');
  });

  it('rotația săptămânală: 2 personaje lansate, necomune, aceleași toată săptămâna; se pot juca fără să le ai', () => {
    const mon = weeklyRotation('2026-10-05');
    expect(mon).toHaveLength(2);
    expect(weeklyRotation('2026-10-11')).toEqual(mon); // duminică, aceeași săptămână
    for (const id of mon) {
      expect(CHARACTERS.find((c) => c.id === id)!.rarity).not.toBe('common');
      expect(charState(defaultProfile(), id, at(1, '2026-10-05')).kind).toBe('rotation');
      expect(selectChar(defaultProfile(), id, at(1, '2026-10-05')).ok).toBe(true);
    }
    // în câteva săptămâni rotația se schimbă
    const weeks = new Set(['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26'].map((d) => weeklyRotation(d).join()));
    expect(weeks.size).toBeGreaterThan(1);
  });
});

describe('teme', () => {
  it('temele de bază pe niveluri; cele de eveniment gratuite în perioada lor, apoi cu Fitile', () => {
    const p = rich();
    expect(themeState(p, 'clasic', at(1)).kind).toBe('open');
    expect(themeState(p, 'jungla', at(1))).toEqual({ kind: 'level', level: 8 });
    expect(themeState(p, 'halloween', at(1, '2026-10-20')).kind).toBe('event');
    expect(themeState(p, 'halloween', at(1, '2026-12-20'))).toEqual({ kind: 'buy', price: EVENT_THEME_PRICE });
    const b = buyTheme(p, 'halloween', at(1, '2026-12-20'));
    expect(b.ok && b.profile.themes).toContain('halloween');
  });

  it('un meci jucat în timpul evenimentului păstrează tema pentru totdeauna', () => {
    const idle = { boxes: 0, kills: 0, won: false, team: false, caps: 0, stars: 0 };
    const r = reward(defaultProfile(), idle, '2026-10-20');
    expect(r.keptThemes).toEqual(['halloween']);
    expect(themeState(r.profile, 'halloween', at(1, '2027-03-01')).kind).toBe('open');
  });

  it('recompensa anunță nivelurile de jucător noi și ce deschid', () => {
    const r = reward(
      { ...defaultProfile(), xp: { bubu: 90 } },
      { boxes: 3, kills: 1, won: true, team: false, caps: 0, stars: 0 },
      '2026-10-02',
    );
    expect(r.playerUps.map((u) => u.level)).toContain(2);
    expect(r.playerUps.find((u) => u.level === 2)!.unlocks).toContain('1 vs 1');
  });

  it('un jucător nou vede puțin: FFA, 3 personaje, 2 teme (+ tema de eveniment activă)', () => {
    const keys = openKeys(defaultProfile(), at(1, '2026-10-05'));
    expect(keys.filter((k) => k.startsWith('mode:'))).toEqual(['mode:ffa']);
    expect(keys.filter((k) => k.startsWith('theme:')).sort()).toEqual(['theme:clasic', 'theme:halloween', 'theme:neon']);
    // 3 comuni + 2 din rotație
    expect(keys.filter((k) => k.startsWith('char:'))).toHaveLength(5);
  });
});
