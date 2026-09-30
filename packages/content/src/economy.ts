import { z } from 'zod';
import { CHAR_IDS, FREE_CHARS, charById, charPrice } from './characters.ts';
import { NO_OUTFIT, SHOP, SHOP_CATS, cleanOutfit, shopItem } from './shop.ts';
import { THEMES } from './themes.ts';
import { charState, eventThemes, playerLevel, themeState, totalXp, unlocksAt } from './progression.ts';
import type { Access } from './progression.ts';
import type { Outfit, ShopCat } from './shop.ts';

/**
 * Economia locală (Faza 2c): Fitile câștigate jucând, personaje și cosmetice cumpărate direct,
 * XP și niveluri per personaj. Funcții pure; clientul le salvează în `localStorage`, iar în Faza 6
 * serverul devine sursa de adevăr. Fără cutii cu recompense aleatoare și fără putere cumpărată (Q-004).
 */

export const START_COINS = 100;
export const DAILY_BONUS = 50;
export const MAX_LEVEL = 10;

export interface Profile {
  coins: number;
  /** Personajele deținute și cel ales. */
  chars: string[];
  ch: string;
  /** XP per personaj. */
  xp: Record<string, number>;
  /** Ziua (AAAA-LL-ZZ) ultimului meci cu fiecare personaj: primul meci din zi dă XP dublu. */
  xpDay: Record<string, string>;
  /** Cosmeticele deținute și cele purtate. */
  owned: string[];
  eq: Outfit;
  /** Ziua ultimului bonus zilnic. */
  daily: string;
  /** Temele de eveniment păstrate (jucate în timpul evenimentului sau cumpărate). */
  themes: string[];
  /** Deblocările deja văzute (pentru insignele „NEW”). */
  seen: string[];
}

export function defaultProfile(): Profile {
  return {
    coins: START_COINS,
    chars: [...FREE_CHARS],
    ch: FREE_CHARS[0]!,
    xp: {},
    xpDay: {},
    owned: ['c_green'],
    eq: { ...NO_OUTFIT },
    daily: '',
    themes: [],
    seen: [],
  };
}

const Raw = z
  .object({
    coins: z.number().int().min(0),
    chars: z.array(z.string()),
    ch: z.string(),
    xp: z.record(z.string(), z.number().int().min(0)),
    xpDay: z.record(z.string(), z.string()),
    owned: z.array(z.string()),
    eq: z.unknown(),
    daily: z.string(),
    themes: z.array(z.string()),
    seen: z.array(z.string()),
  })
  .partial();

/** Profil valid din orice (stocare veche, profilul din prototip, gunoi): ce nu e valid revine la implicit. */
export function loadProfile(raw: unknown): Profile {
  const def = defaultProfile();
  const r = Raw.safeParse(raw);
  if (!r.success) return def;
  const v = r.data;
  const fix = (id: string) => (id === 'gogu' ? 'gugu' : id); // numele din prototipul vechi
  const chars = [...new Set([...FREE_CHARS, ...(v.chars ?? []).map(fix)])].filter((c) =>
    CHAR_IDS.includes(c),
  );
  const owned = [...new Set(['c_green', ...(v.owned ?? [])])].filter((i) => shopItem(i));
  const eq = cleanOutfit(v.eq);
  for (const cat of SHOP_CATS) if (eq[cat] && !owned.includes(eq[cat]!)) eq[cat] = null;
  const ch = fix(v.ch ?? def.ch);
  return {
    coins: v.coins ?? def.coins,
    chars,
    ch: chars.includes(ch) ? ch : def.ch,
    xp: Object.fromEntries(Object.entries(v.xp ?? {}).map(([k, n]) => [fix(k), n])),
    xpDay: v.xpDay ?? {},
    owned,
    eq,
    daily: v.daily ?? '',
    themes: (v.themes ?? []).filter((t) => THEMES.some((x) => x.id === t)),
    seen: v.seen ?? [],
  };
}

export type Refusal = 'owned' | 'funds' | 'locked' | 'unknown';
export type Result = { ok: true; profile: Profile } | { ok: false; why: Refusal };

/** Cumpără un personaj; cu `a`, doar dacă e lansat și ai nivelul cerut (D-040). */
export function buyChar(p: Profile, id: string, a?: Access): Result {
  if (!CHAR_IDS.includes(id)) return { ok: false, why: 'unknown' };
  if (p.chars.includes(id)) return { ok: false, why: 'owned' };
  if (a) {
    const st = charState(p, id, a);
    if (st.kind === 'soon' || st.kind === 'level') return { ok: false, why: 'locked' };
  }
  const price = charPrice(charById(id));
  if (p.coins < price) return { ok: false, why: 'funds' };
  return { ok: true, profile: { ...p, coins: p.coins - price, chars: [...p.chars, id] } };
}

/** Alege un personaj deținut (sau, cu `a`, unul din rotația gratuită a săptămânii). */
export function selectChar(p: Profile, id: string, a?: Access): Result {
  const free = a ? charState(p, id, a).kind === 'rotation' || a.admin : false;
  if (!p.chars.includes(id) && !free) return { ok: false, why: CHAR_IDS.includes(id) ? 'locked' : 'unknown' };
  return { ok: true, profile: { ...p, ch: id } };
}

export function buyItem(p: Profile, id: string): Result {
  const it = shopItem(id);
  if (!it) return { ok: false, why: 'unknown' };
  if (p.owned.includes(id)) return { ok: false, why: 'owned' };
  if (it.unlock) return { ok: false, why: 'locked' };
  if (p.coins < it.price) return { ok: false, why: 'funds' };
  return { ok: true, profile: { ...p, coins: p.coins - it.price, owned: [...p.owned, id] } };
}

/** Cumpără o temă de eveniment în afara perioadei ei. */
export function buyTheme(p: Profile, id: string, a: Access): Result {
  const st = themeState(p, id, a);
  if (st.kind === 'open' || st.kind === 'event') return { ok: false, why: 'owned' };
  if (st.kind === 'level') return { ok: false, why: 'locked' };
  if (p.coins < st.price) return { ok: false, why: 'funds' };
  return { ok: true, profile: { ...p, coins: p.coins - st.price, themes: [...p.themes, id] } };
}

/** Marchează deblocări ca văzute. */
export const markSeen = (p: Profile, keys: string[]): Profile =>
  keys.every((k) => p.seen.includes(k)) ? p : { ...p, seen: [...new Set([...p.seen, ...keys])] };

/** Echipează un obiect deținut (sau scoate categoria cu `id = null`). */
export function equip(p: Profile, cat: ShopCat, id: string | null): Result {
  if (id !== null) {
    const it = shopItem(id);
    if (!it || it.cat !== cat) return { ok: false, why: 'unknown' };
    if (!p.owned.includes(id)) return { ok: false, why: 'locked' };
  }
  return { ok: true, profile: { ...p, eq: { ...p.eq, [cat]: id } } };
}

/* ---------- XP și niveluri ---------- */

/** XP necesar de la nivelul n la n+1: 60, 80, 100… (nivelul 10 ≈ 1260 XP, ~40 de meciuri). */
export const levelCost = (n: number): number => 60 + 20 * (n - 1);

export function levelOf(xp: number): { level: number; into: number; need: number } {
  let level = 1;
  let rest = xp;
  while (level < MAX_LEVEL && rest >= levelCost(level)) {
    rest -= levelCost(level);
    level++;
  }
  return { level, into: level < MAX_LEVEL ? rest : 0, need: level < MAX_LEVEL ? levelCost(level) : 0 };
}

export interface LevelReward {
  level: number;
  coins: number;
  /** Obiect exclusiv deblocat (culoarea semnătură la nivelul 5). */
  item?: string;
  /** Titlu (nivelul 10: „Master”). */
  title?: string;
}

/** Ce primești la fiecare nivel al unui personaj (doar cosmetice și Fitile — varianta B, Q-004). */
export function levelRewards(ch: string): LevelReward[] {
  const out: LevelReward[] = [];
  for (let level = 2; level <= MAX_LEVEL; level++) {
    const r: LevelReward = { level, coins: level * 10 };
    const it = SHOP.find((i) => i.unlock?.char === ch && i.unlock.level === level);
    if (it) r.item = it.id;
    if (level === MAX_LEVEL) r.title = `${charById(ch).name} Master`;
    out.push(r);
  }
  return out;
}

/** Ce s-a întâmplat într-un meci, din perspectiva jucătorului local. */
export interface MatchSummary {
  /** Lăzi sparte de tine. */
  boxes: number;
  /** Adversari eliminați. */
  kills: number;
  /** Ai câștigat (singur sau cu echipa). */
  won: boolean;
  team: boolean;
  /** Steaguri capturate. */
  caps: number;
  /** Stele (misiuni). */
  stars: number;
}

export interface Rewards {
  coins: number;
  xp: number;
  /** Primul meci din zi cu acest personaj (XP dublu). */
  firstToday: boolean;
  daily: number;
  levelUps: LevelReward[];
  /** Niveluri de jucător noi și ce deschid. */
  playerUps: { level: number; unlocks: string[] }[];
  /** Temele de eveniment câștigate pentru totdeauna cu meciul ăsta. */
  keptThemes: string[];
  profile: Profile;
}

/** Monedele meciului (tabelul din `GAME_DESIGN.md` §Magazin și monede). */
export function matchCoins(m: MatchSummary): number {
  return m.boxes + m.kills * 5 + 5 + (m.won ? (m.team ? 20 : 25) : 0) + m.caps * 10 + m.stars * 15;
}

export function matchXp(m: MatchSummary): number {
  return 10 + m.kills * 5 + Math.min(20, m.boxes) + (m.won ? 20 : 0) + m.caps * 5 + m.stars * 5;
}

/** Aplică recompensele unui meci pe profil (monede, XP pe personajul ales, niveluri, bonusul zilnic). */
export function reward(p: Profile, m: MatchSummary, today: string): Rewards {
  const ch = p.ch;
  const firstToday = p.xpDay[ch] !== today;
  const xp = matchXp(m) * (firstToday ? 2 : 1);
  const before = levelOf(p.xp[ch] ?? 0).level;
  const total = (p.xp[ch] ?? 0) + xp;
  const after = levelOf(total).level;
  const levelUps = levelRewards(ch).filter((r) => r.level > before && r.level <= after);
  const daily = p.daily !== today ? DAILY_BONUS : 0;
  const coins = matchCoins(m) + levelUps.reduce((n, r) => n + r.coins, 0) + daily;
  const items = levelUps.flatMap((r) => (r.item ? [r.item] : []));
  const pBefore = playerLevel(totalXp(p)).level;
  const pAfter = playerLevel(totalXp(p) + xp).level;
  const playerUps = [];
  for (let l = pBefore + 1; l <= pAfter; l++) playerUps.push({ level: l, unlocks: unlocksAt(l) });
  const keptThemes = eventThemes(today).filter((t) => !p.themes.includes(t));
  return {
    coins,
    xp,
    firstToday,
    daily,
    levelUps,
    playerUps,
    keptThemes,
    profile: {
      ...p,
      coins: p.coins + coins,
      xp: { ...p.xp, [ch]: total },
      xpDay: { ...p.xpDay, [ch]: today },
      owned: [...new Set([...p.owned, ...items])],
      daily: today,
      themes: [...p.themes, ...keptThemes],
    },
  };
}
