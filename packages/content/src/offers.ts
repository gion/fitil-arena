import { deriveRng, nextInt, shuffle } from '@fitil/sim';
import type { Profile, Result } from './economy.ts';
import { grantReward } from './pass.ts';
import { SHOP } from './shop.ts';

/**
 * Magazinul cu bani reali și magazinul zilnic (Faza 9, D-082). Fără cutii cu recompense aleatoare:
 * fiecare produs spune exact ce dă. Gemurile vin doar din plăți validate de server (sau din battle pass).
 */

/* ---------- produsele din store (App Store / Google Play, prin RevenueCat) ---------- */

export interface Product {
  /** Identificatorul produsului în store-uri și în RevenueCat. */
  id: string;
  name: string;
  /** `once` = se cumpără o singură dată (starter pack); `consumable` = oricât. */
  kind: 'consumable' | 'once';
  gems?: number;
  coins?: number;
  items?: string[];
  /** Prețul afișat doar când store-ul nu dă unul localizat (web, teste). Provizoriu (Q-017). */
  priceHint: string;
}

export const PRODUCTS: Product[] = [
  { id: 'gems_100', name: '100 Gems', kind: 'consumable', gems: 100, priceHint: '€0.99' },
  { id: 'gems_550', name: '550 Gems', kind: 'consumable', gems: 550, priceHint: '€4.99' },
  { id: 'gems_1200', name: '1200 Gems', kind: 'consumable', gems: 1200, priceHint: '€9.99' },
  {
    id: 'starter_pack',
    name: 'Starter pack',
    kind: 'once',
    gems: 300,
    coins: 1000,
    items: ['x_rocket'],
    priceHint: '€2.99',
  },
];

export const productById = (id: string): Product | undefined => PRODUCTS.find((p) => p.id === id);

/** Ce primește jucătorul pentru un produs plătit (după validarea pe server). */
export function grantProduct(p: Profile, id: string): Result {
  const pr = productById(id);
  if (!pr) return { ok: false, why: 'unknown' };
  if (pr.kind === 'once' && p.purchases.includes(id)) return { ok: false, why: 'owned' };
  let out = grantReward(p, { coins: pr.coins, gems: pr.gems });
  for (const item of pr.items ?? []) out = grantReward(out, { item });
  if (pr.kind === 'once') out = { ...out, purchases: [...out.purchases, id] };
  return { ok: true, profile: out };
}

/* ---------- Gemuri → Fitile ---------- */

export interface CoinPack {
  id: string;
  gems: number;
  coins: number;
}

export const COIN_PACKS: CoinPack[] = [
  { id: 'coins_s', gems: 50, coins: 400 },
  { id: 'coins_m', gems: 150, coins: 1400 },
  { id: 'coins_l', gems: 400, coins: 4000 },
];

export function buyCoins(p: Profile, id: string): Result {
  const pack = COIN_PACKS.find((c) => c.id === id);
  if (!pack) return { ok: false, why: 'unknown' };
  if (p.gems < pack.gems) return { ok: false, why: 'funds' };
  return { ok: true, profile: { ...p, gems: p.gems - pack.gems, coins: p.coins + pack.coins } };
}

/* ---------- magazinul zilnic (rotativ, cu reduceri, în Fitile) ---------- */

export const DAILY_OFFERS = 6;
/** Reducerile, în ordinea ofertelor (prima e „oferta zilei”). */
const DISCOUNTS = [40, 25, 15, 15, 10, 10];

export interface Offer {
  item: string;
  price: number;
  /** Prețul normal. */
  was: number;
  off: number;
}

const DAY_MS = 86_400_000;

/** Ofertele zilei `date` (AAAA-LL-ZZ, UTC): aceleași pentru toți, din cosmeticele care se cumpără normal. */
export function dailyOffers(date: string): Offer[] {
  const day = Math.floor(Date.parse(`${date}T00:00:00Z`) / DAY_MS);
  const pool = SHOP.filter((i) => i.price > 0 && !i.unlock && !i.exclusive);
  const rng = deriveRng(day, 0x5409);
  const picks = shuffle(rng, [...pool]).slice(0, DAILY_OFFERS);
  // o variație mică a ordinii reducerilor, ca oferta zilei să nu fie mereu primul obiect amestecat
  const lead = nextInt(rng, picks.length);
  [picks[0], picks[lead]] = [picks[lead]!, picks[0]!];
  return picks.map((it, i) => {
    const off = DISCOUNTS[i] ?? 10;
    return {
      item: it.id,
      was: it.price,
      off,
      price: Math.max(1, Math.round((it.price * (100 - off)) / 100)),
    };
  });
}

/** Cumpără un obiect din oferta zilei, la prețul redus. */
export function buyOffer(p: Profile, item: string, date: string): Result {
  const o = dailyOffers(date).find((x) => x.item === item);
  if (!o) return { ok: false, why: 'unknown' };
  if (p.owned.includes(item)) return { ok: false, why: 'owned' };
  if (p.coins < o.price) return { ok: false, why: 'funds' };
  return { ok: true, profile: { ...p, coins: p.coins - o.price, owned: [...p.owned, item] } };
}
