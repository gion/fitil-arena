import { describe, expect, it } from 'vitest';
import {
  COIN_PACKS,
  DAILY_OFFERS,
  PRODUCTS,
  buyCoins,
  buyOffer,
  dailyOffers,
  defaultProfile,
  grantProduct,
  shopItem,
} from '../src/index.ts';

describe('produsele plătite', () => {
  it('fiecare produs dă ceva concret; obiectele există', () => {
    for (const pr of PRODUCTS) {
      expect(pr.gems || pr.coins || pr.items?.length).toBeTruthy();
      for (const i of pr.items ?? []) expect(shopItem(i)).toBeDefined();
    }
  });

  it('Gemurile se adaugă de fiecare dată; starter pack-ul o singură dată', () => {
    const p = defaultProfile();
    const a = grantProduct(p, 'gems_100');
    if (!a.ok) throw new Error('gems');
    const b = grantProduct(a.profile, 'gems_100');
    expect(b.ok && b.profile.gems).toBe(200);
    const s = grantProduct(p, 'starter_pack');
    if (!s.ok) throw new Error('starter');
    expect(s.profile).toMatchObject({ gems: 300, coins: p.coins + 1000, purchases: ['starter_pack'] });
    expect(s.profile.owned).toContain('x_rocket');
    expect(grantProduct(s.profile, 'starter_pack')).toEqual({ ok: false, why: 'owned' });
    expect(grantProduct(p, 'nope')).toEqual({ ok: false, why: 'unknown' });
  });
});

describe('Gemuri → Fitile', () => {
  it('schimbă la cursul pachetului; fără Gemuri destule, refuz', () => {
    const pack = COIN_PACKS[0]!;
    const p = { ...defaultProfile(), gems: pack.gems };
    const r = buyCoins(p, pack.id);
    expect(r.ok && r.profile).toMatchObject({ gems: 0, coins: p.coins + pack.coins });
    expect(buyCoins({ ...p, gems: 0 }, pack.id)).toEqual({ ok: false, why: 'funds' });
  });
});

describe('magazinul zilnic', () => {
  it('aceeași zi = aceleași oferte; 6 obiecte diferite, cumpărabile, reduse', () => {
    const a = dailyOffers('2026-11-10');
    expect(dailyOffers('2026-11-10')).toEqual(a);
    expect(a).toHaveLength(DAILY_OFFERS);
    expect(new Set(a.map((o) => o.item)).size).toBe(DAILY_OFFERS);
    for (const o of a) {
      const it = shopItem(o.item)!;
      expect(it.unlock).toBeUndefined();
      expect(it.exclusive).toBeUndefined();
      expect(o.price).toBeLessThan(o.was);
    }
    expect(a[0]!.off).toBe(40);
  });

  it('se schimbă de la o zi la alta', () => {
    const days = ['2026-11-10', '2026-11-11', '2026-11-12'].map((d) =>
      dailyOffers(d)
        .map((o) => o.item)
        .join(),
    );
    expect(new Set(days).size).toBe(3);
  });

  it('se cumpără doar ce e în oferta zilei, la prețul redus', () => {
    const [o] = dailyOffers('2026-11-10');
    const p = { ...defaultProfile(), coins: 1000 };
    const r = buyOffer(p, o!.item, '2026-11-10');
    expect(r.ok && r.profile.coins).toBe(1000 - o!.price);
    if (r.ok) expect(buyOffer(r.profile, o!.item, '2026-11-10')).toEqual({ ok: false, why: 'owned' });
    const other = dailyOffers('2026-11-10').map((x) => x.item);
    const notToday = ['c_red', 'h_cap', 'b_candy', 't_stars'].find((i) => !other.includes(i))!;
    expect(buyOffer(p, notToday, '2026-11-10')).toEqual({ ok: false, why: 'unknown' });
    expect(buyOffer({ ...p, coins: 0 }, o!.item, '2026-11-10')).toEqual({ ok: false, why: 'funds' });
  });
});
