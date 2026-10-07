import { describe, expect, it } from 'vitest';
import {
  CHARACTERS,
  FREE_CHARS,
  MAX_LEVEL,
  RARITY,
  SHOP,
  SHOP_CATS,
  buyChar,
  buyItem,
  charById,
  defaultProfile,
  equip,
  levelOf,
  levelRewards,
  loadProfile,
  reward,
  selectChar,
} from '../src/index.ts';
import type { MatchSummary } from '../src/index.ts';

const idle: MatchSummary = { boxes: 0, kills: 0, won: false, team: false, caps: 0, stars: 0 };

describe('personaje', () => {
  it('15 personaje valide, cu id-uri unice, pe toate raritățile', () => {
    expect(CHARACTERS).toHaveLength(15);
    expect(new Set(CHARACTERS.map((c) => c.id)).size).toBe(15);
    expect(new Set(CHARACTERS.map((c) => c.rarity))).toEqual(new Set(Object.keys(RARITY)));
    expect(FREE_CHARS).toEqual(['bubu', 'gugu', 'zuzu', 'nova', 'shade', 'portia', 'slick']); // Nova și Shade: gratuite provizoriu, pentru testare
  });

  it('fiecare personaj are plusuri, minusuri, semnătură și Ultimate', () => {
    for (const c of CHARACTERS) {
      expect(c.pros.length, c.id).toBeGreaterThan(0);
      expect(c.cons.length, c.id).toBeGreaterThan(0);
      expect(c.ultimate.name, c.id).toBeTruthy();
    }
  });

  it('fiecare personaj are câte o culoare exclusivă de nivel 5 în magazin', () => {
    for (const c of CHARACTERS) expect(SHOP.find((i) => i.id === `sig_${c.id}`)?.unlock?.level).toBe(5);
  });
});

describe('economie', () => {
  it('cumpărare fără fonduri refuzată; cu fonduri scade monedele', () => {
    const p = defaultProfile();
    expect(buyChar(p, 'ghost')).toEqual({ ok: false, why: 'funds' });
    expect(buyChar(p, 'bubu')).toEqual({ ok: false, why: 'owned' });
    const r = buyChar({ ...p, coins: 700 }, 'fifi');
    expect(r.ok && r.profile.coins).toBe(100);
    expect(r.ok && r.profile.chars).toContain('fifi');
    expect(selectChar(p, 'fifi')).toEqual({ ok: false, why: 'locked' });
  });

  it('obiectele exclusive nu se cumpără; echipare doar pentru ce deții, scoaterea merge oricând', () => {
    const p = { ...defaultProfile(), coins: 1000 };
    expect(buyItem(p, 'sig_bubu')).toEqual({ ok: false, why: 'locked' });
    expect(equip(p, 'hat', 'h_top')).toEqual({ ok: false, why: 'locked' });
    const b = buyItem(p, 'h_top');
    expect(b.ok).toBe(true);
    if (!b.ok) return;
    const e = equip(b.profile, 'hat', 'h_top');
    expect(e.ok && e.profile.eq.hat).toBe('h_top');
    expect(equip(b.profile, 'bomb', 'h_top')).toEqual({ ok: false, why: 'unknown' });
    const off = e.ok ? equip(e.profile, 'hat', null) : null;
    expect(off?.ok && off.profile.eq.hat).toBeNull();
  });

  it('câte un obiect din fiecare categorie se cumpără și se echipează', () => {
    let p = { ...defaultProfile(), coins: 5000 };
    for (const cat of SHOP_CATS) {
      const it = SHOP.find((i) => i.cat === cat && i.price > 0 && !i.unlock)!;
      const b = buyItem(p, it.id);
      expect(b.ok, it.id).toBe(true);
      if (!b.ok) return;
      const e = equip(b.profile, cat, it.id);
      expect(e.ok).toBe(true);
      if (e.ok) p = e.profile;
    }
    expect(Object.values(p.eq).every((v) => v !== null)).toBe(true);
  });

  it('persistență: profilul trece prin JSON neschimbat; gunoiul și prototipul vechi se repară', () => {
    const p = { ...defaultProfile(), coins: 321, xp: { zuzu: 90 } };
    expect(loadProfile(JSON.parse(JSON.stringify(p)))).toEqual(p);
    expect(loadProfile('nonsense')).toEqual(defaultProfile());
    const old = loadProfile({
      coins: 50,
      chars: ['bubu', 'gogu', 'nobody'],
      ch: 'gogu',
      owned: ['h_cap', 'x'],
    });
    expect(old.ch).toBe('gugu');
    expect(old.chars).not.toContain('nobody');
    expect(old.owned).toEqual(['c_green', 'h_cap']);
    // un obiect echipat dar nedeținut se scoate
    expect(loadProfile({ eq: { hat: 'h_crown' } }).eq.hat).toBeNull();
  });
});

describe('XP și niveluri', () => {
  it('curba de niveluri', () => {
    expect(levelOf(0)).toEqual({ level: 1, into: 0, need: 60 });
    expect(levelOf(60).level).toBe(2);
    expect(levelOf(1259).level).toBe(9);
    expect(levelOf(1260)).toEqual({ level: MAX_LEVEL, into: 0, need: 0 });
    expect(levelOf(99999).level).toBe(MAX_LEVEL);
  });

  it('recompense: monede din tabel, XP dublu la primul meci din zi, bonus zilnic o dată', () => {
    const p = defaultProfile();
    const m = { ...idle, boxes: 4, kills: 2, won: true };
    const a = reward(p, m, '2026-10-01');
    // 4 + 10 + 5 + 25 = 44, + 50 bonus zilnic, + 20 pentru nivelul 2 (88 XP)
    expect(a.levelUps.map((l) => l.level)).toEqual([2]);
    expect(a.coins).toBe(44 + 50 + 20);
    expect(a.firstToday).toBe(true);
    expect(a.xp).toBe((10 + 10 + 4 + 20) * 2);
    const b = reward(a.profile, m, '2026-10-01');
    expect(b.daily).toBe(0);
    expect(b.xp).toBe(44);
  });

  it('la nivelul 5 se deblochează culoarea exclusivă, la 10 titlul', () => {
    const p = { ...defaultProfile(), xp: { bubu: 355 } }; // chiar sub nivelul 5 (360)
    expect(levelOf(355).level).toBe(4);
    const r = reward(p, idle, '2026-10-01');
    expect(r.levelUps.map((l) => l.level)).toEqual([5]);
    expect(r.profile.owned).toContain('sig_bubu');
    expect(levelRewards('bubu').at(-1)!.title).toBe(`${charById('bubu').name} Master`);
  });
});
