import { describe, expect, it } from 'vitest';
import {
  PASS_PRICE_GEMS,
  PASS_TIERS,
  TIER_XP,
  addPassXp,
  buyItem,
  buyPremium,
  claimAll,
  claimTier,
  defaultProfile,
  loadProfile,
  passOf,
  passTier,
  reward,
  seasonAt,
  seasonDaysLeft,
  shopItem,
  tierState,
} from '../src/index.ts';

const D = '2026-11-10';

describe('sezoanele', () => {
  it('8 săptămâni de la epocă; înainte de epocă e sezonul 1', () => {
    expect(seasonAt('2026-10-19')).toMatchObject({ id: 's1', start: '2026-11-02', end: '2026-12-27' });
    expect(seasonAt('2026-12-27').id).toBe('s1');
    expect(seasonAt('2026-12-28')).toMatchObject({ id: 's2', n: 2, start: '2026-12-28' });
    expect(seasonDaysLeft(seasonAt(D), D)).toBe(48);
  });

  it('30 de trepte pe fiecare pistă; obiectele sezonului 1 apar o dată, toate exclusive', () => {
    const s = seasonAt(D);
    expect(s.free).toHaveLength(PASS_TIERS);
    expect(s.premium).toHaveLength(PASS_TIERS);
    const items = [...s.free, ...s.premium].flatMap((r) => (r.item ? [r.item] : []));
    expect(items).toHaveLength(9);
    expect(new Set(items).size).toBe(9);
    for (const id of items) expect(shopItem(id)?.exclusive).toBe('s1');
    // fiecare treaptă dă ceva
    for (const r of [...s.free, ...s.premium]) expect(r.coins || r.gems || r.item).toBeTruthy();
  });

  it('obiectele de pass nu se cumpără din magazin', () => {
    const p = { ...defaultProfile(), coins: 10_000 };
    expect(buyItem(p, 's1_ember')).toEqual({ ok: false, why: 'locked' });
  });
});

describe('progresul', () => {
  it('XP-ul dă trepte; alt sezon pornește de la zero', () => {
    const r = addPassXp(defaultProfile(), TIER_XP * 3 + 40, D);
    expect(r.tiersUp).toBe(3);
    expect(passTier(passOf(r.profile, D))).toBe(3);
    expect(passOf(r.profile, '2027-01-10')).toEqual({ season: 's2', xp: 0, premium: false, claimed: [] });
  });

  it('nu trece de ultima treaptă', () => {
    const r = addPassXp(defaultProfile(), TIER_XP * 100, D);
    expect(passTier(passOf(r.profile, D))).toBe(PASS_TIERS);
  });

  it('meciul dă XP de pass (fără dublarea zilnică)', () => {
    const m = { boxes: 4, kills: 1, won: true, team: false, caps: 0, stars: 0 };
    const r = reward(defaultProfile(), m, D);
    expect(r.pass.xp).toBe(10 + 5 + 4 + 20);
    expect(r.xp).toBe(2 * r.pass.xp);
    expect(r.profile.pass).toMatchObject({ season: 's1', xp: r.pass.xp });
  });
});

describe('recompensele', () => {
  const at = (tiers: number) => addPassXp(defaultProfile(), TIER_XP * tiers, D).profile;

  it('treapta gratuită se ia o dată; cea neatinsă e blocată', () => {
    const p = at(2);
    const r = claimTier(p, 'free', 1, D);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.profile.coins).toBe(p.coins + seasonAt(D).free[0]!.coins!);
    expect(claimTier(r.profile, 'free', 1, D)).toEqual({ ok: false, why: 'owned' });
    expect(claimTier(p, 'free', 3, D)).toEqual({ ok: false, why: 'locked' });
    expect(claimTier(p, 'free', 0, D)).toEqual({ ok: false, why: 'unknown' });
  });

  it('pista premium cere premium; premium se cumpără cu Gemuri o dată pe sezon', () => {
    const p = at(5);
    expect(tierState(p, 'premium', 5, D)).toBe('premium');
    expect(buyPremium(p, D)).toEqual({ ok: false, why: 'funds' });
    const b = buyPremium({ ...p, gems: PASS_PRICE_GEMS + 7 }, D);
    expect(b.ok).toBe(true);
    if (!b.ok) return;
    expect(b.profile.gems).toBe(7);
    expect(buyPremium(b.profile, D)).toEqual({ ok: false, why: 'owned' });
    const c = claimTier(b.profile, 'premium', 5, D);
    expect(c.ok && c.profile.owned).toContain(seasonAt(D).premium[4]!.item);
    // în sezonul următor premium nu se păstrează
    expect(passOf(b.profile, '2027-01-10').premium).toBe(false);
  });

  it('„Claim all” ia tot ce e gata, o singură dată', () => {
    const p = { ...at(PASS_TIERS), gems: PASS_PRICE_GEMS };
    const b = buyPremium(p, D);
    if (!b.ok) throw new Error('premium');
    const all = claimAll(b.profile, D);
    expect(passOf(all, D).claimed).toHaveLength(PASS_TIERS * 2);
    for (const r of [...seasonAt(D).free, ...seasonAt(D).premium])
      if (r.item) expect(all.owned).toContain(r.item);
    expect(claimAll(all, D)).toEqual(all);
  });

  it('profilul vechi (fără câmpurile noi) se încarcă cu valori implicite', () => {
    const { gems, pass, purchases, ...old } = defaultProfile();
    void gems;
    void pass;
    void purchases;
    const p = loadProfile(old);
    expect(p.gems).toBe(0);
    expect(p.purchases).toEqual([]);
    expect(p.pass.claimed).toEqual([]);
  });
});
