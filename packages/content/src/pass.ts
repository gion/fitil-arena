import { NO_PASS, type PassProgress, type Profile, type Result } from './economy.ts';
import { SHOP, shopItem } from './shop.ts';

/**
 * Battle pass sezonier (Faza 9, D-082): 30 de trepte, o pistă gratuită și una premium, doar cosmetice,
 * Fitile și Gemuri (fără putere, fără recompense aleatoare). Sezoanele au 8 săptămâni și se succed de la
 * `PASS_EPOCH`; progresul unui sezon încheiat nu se mută în următorul. Premium se cumpără cu Gemuri.
 */

export const PASS_EPOCH = '2026-11-02';
export const SEASON_DAYS = 56;
export const PASS_TIERS = 30;
export const TIER_XP = 100;
export const PASS_PRICE_GEMS = 500;

export type Track = 'free' | 'premium';

export interface TierReward {
  coins?: number;
  gems?: number;
  item?: string;
}

export interface Season {
  /** `s1`, `s2`… */
  id: string;
  n: number;
  name: string;
  /** Prima și ultima zi (AAAA-LL-ZZ, incluse). */
  start: string;
  end: string;
  free: TierReward[];
  premium: TierReward[];
}

const DAY_MS = 86_400_000;
const dayNum = (d: string): number => Math.floor(Date.parse(`${d}T00:00:00Z`) / DAY_MS);
const dayStr = (n: number): string => new Date(n * DAY_MS).toISOString().slice(0, 10);

/** Numele sezoanelor; după ultimul, se repetă cu numărul sezonului. */
const NAMES = ['Spark', 'Frostbite', 'Party Popper', 'Heatwave'];

/** Obiectele exclusive ale sezonului: primele 3 pe pista gratuită (treptele 10, 20, 30), restul pe premium (5, 10…). */
const seasonItems = (id: string): string[] => SHOP.filter((i) => i.exclusive === id).map((i) => i.id);

function tracks(id: string): { free: TierReward[]; premium: TierReward[] } {
  const items = seasonItems(id);
  const freeItems = items.slice(0, 3);
  const premItems = items.slice(3);
  const free: TierReward[] = [];
  const premium: TierReward[] = [];
  for (let t = 1; t <= PASS_TIERS; t++) {
    const fi = t % 10 === 0 ? freeItems[t / 10 - 1] : undefined;
    free.push(fi ? { item: fi } : t % 5 === 0 ? { gems: 10 } : { coins: 20 + t * 2 });
    const pi = t % 5 === 0 ? premItems[t / 5 - 1] : undefined;
    premium.push(pi ? { item: pi } : t % 3 === 0 ? { gems: 30 } : { coins: 40 + t * 3 });
  }
  return { free, premium };
}

/** Sezonul în care cade ziua `date` (înainte de `PASS_EPOCH`: sezonul 1). */
export function seasonAt(date: string): Season {
  const n = Math.max(1, Math.floor((dayNum(date) - dayNum(PASS_EPOCH)) / SEASON_DAYS) + 1);
  const start = dayNum(PASS_EPOCH) + (n - 1) * SEASON_DAYS;
  const id = `s${n}`;
  const name = NAMES[n - 1] ?? `Season ${n}`;
  return { id, n, name, start: dayStr(start), end: dayStr(start + SEASON_DAYS - 1), ...tracks(id) };
}

/** Zile rămase din sezon, inclusiv ziua curentă. */
export const seasonDaysLeft = (s: Season, date: string): number =>
  Math.max(0, dayNum(s.end) - dayNum(date) + 1);

/** Progresul pe sezonul curent: alt sezon (sau niciunul) = progres nou. */
export function passOf(p: Profile, date: string): PassProgress {
  const id = seasonAt(date).id;
  return p.pass.season === id ? p.pass : { ...NO_PASS, season: id };
}

/** Treapta atinsă (0 = niciuna). */
export const passTier = (pp: PassProgress): number => Math.min(PASS_TIERS, Math.floor(pp.xp / TIER_XP));

/** XP de pass dintr-un meci (același XP ca personajul, fără dublarea zilnică). */
export function addPassXp(p: Profile, xp: number, date: string): { profile: Profile; tiersUp: number } {
  const pp = passOf(p, date);
  const next = { ...pp, xp: pp.xp + Math.max(0, Math.floor(xp)) };
  return { profile: { ...p, pass: next }, tiersUp: passTier(next) - passTier(pp) };
}

const key = (track: Track, tier: number): string => `${track === 'free' ? 'f' : 'p'}${tier}`;

export type TierState = 'claimed' | 'ready' | 'locked' | 'premium';

export function tierState(p: Profile, track: Track, tier: number, date: string): TierState {
  const pp = passOf(p, date);
  if (pp.claimed.includes(key(track, tier))) return 'claimed';
  if (tier > passTier(pp)) return 'locked';
  if (track === 'premium' && !pp.premium) return 'premium';
  return 'ready';
}

/** Aplică o recompensă pe profil (obiectul deținut deja nu se dublează). */
export function grantReward(p: Profile, r: TierReward): Profile {
  const out = { ...p, coins: p.coins + (r.coins ?? 0), gems: p.gems + (r.gems ?? 0) };
  if (r.item && shopItem(r.item) && !out.owned.includes(r.item)) out.owned = [...out.owned, r.item];
  return out;
}

/** Ia recompensa unei trepte atinse. */
export function claimTier(p: Profile, track: Track, tier: number, date: string): Result {
  if (!Number.isInteger(tier) || tier < 1 || tier > PASS_TIERS) return { ok: false, why: 'unknown' };
  const st = tierState(p, track, tier, date);
  if (st === 'claimed') return { ok: false, why: 'owned' };
  if (st !== 'ready') return { ok: false, why: 'locked' };
  const pp = passOf(p, date);
  const reward = seasonAt(date)[track][tier - 1]!;
  const next = grantReward(p, reward);
  return { ok: true, profile: { ...next, pass: { ...pp, claimed: [...pp.claimed, key(track, tier)] } } };
}

/** Toate recompensele gata de luat (butonul „Claim all”). */
export function claimAll(p: Profile, date: string): Profile {
  let out = p;
  for (const track of ['free', 'premium'] as const)
    for (let t = 1; t <= PASS_TIERS; t++) {
      const r = claimTier(out, track, t, date);
      if (r.ok) out = r.profile;
    }
  return out;
}

/** Cumpără pista premium a sezonului curent cu Gemuri. */
export function buyPremium(p: Profile, date: string): Result {
  const pp = passOf(p, date);
  if (pp.premium) return { ok: false, why: 'owned' };
  if (p.gems < PASS_PRICE_GEMS) return { ok: false, why: 'funds' };
  return { ok: true, profile: { ...p, gems: p.gems - PASS_PRICE_GEMS, pass: { ...pp, premium: true } } };
}
