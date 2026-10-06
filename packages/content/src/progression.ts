import { deriveRng, shuffle } from '@fitil/sim';
import { CHARACTERS, RARITY, charById } from './characters.ts';
import type { Rarity } from './characters.ts';
import type { Profile } from './economy.ts';
import { MODE_IDS, MODES } from './texts.ts';
import type { ModeId } from './texts.ts';
import { THEMES, themeById } from './themes.ts';

/**
 * Deblocări (D-039 – D-041): jucătorul primește puțin câte puțin. Nivelul de jucător vine din XP-ul
 * total (toate personajele) și deschide moduri, teme și rarități; personajele cer nivel ȘI Fitile;
 * personajele noi apar după un calendar (teaser „coming soon” până atunci); 2 personaje gratuite
 * pe săptămână. Funcții pure: data vine din afară (clientul o poate schimba din panoul de dezvoltare).
 */

/** Contextul unei verificări: nivelul jucătorului, ziua (AAAA-LL-ZZ) și dacă profilul e de admin. */
export interface Access {
  level: number;
  date: string;
  admin: boolean;
}

export const MAX_PLAYER_LEVEL = 30;

/** XP de la nivelul de jucător n la n+1: 100, 150, 200… (nivelul 10 ≈ 2700 XP, ~50 de meciuri). */
export const playerLevelCost = (n: number): number => 100 + 50 * (n - 1);

export function playerLevel(xp: number): { level: number; into: number; need: number } {
  let level = 1;
  let rest = xp;
  while (level < MAX_PLAYER_LEVEL && rest >= playerLevelCost(level)) {
    rest -= playerLevelCost(level);
    level++;
  }
  return {
    level,
    into: level < MAX_PLAYER_LEVEL ? rest : 0,
    need: level < MAX_PLAYER_LEVEL ? playerLevelCost(level) : 0,
  };
}

export const totalXp = (p: Profile): number => Object.values(p.xp).reduce((n, v) => n + v, 0);

export const accessOf = (p: Profile, date: string, admin = false): Access => ({
  level: playerLevel(totalXp(p)).level,
  date,
  admin,
});

/** Nivelul de jucător la care se deschide fiecare mod (Practice, Misiunile și Online sunt de la început). */
export const MODE_LEVEL: Record<ModeId, number> = {
  ffa: 1,
  vs: 2,
  team2: 3,
  team3: 3,
  rot: 4,
  potato: 3,
  crown: 4,
  shift: 4,
  ctf: 5,
};

/** Nivelul de jucător cerut pentru a cumpăra un personaj de fiecare raritate. */
export const RARITY_LEVEL: Record<Rarity, number> = {
  common: 1,
  rare: 3,
  epic: 6,
  legendary: 10,
  mythic: 15,
};

/**
 * Calendarul personajelor noi (provizoriu, editabil aici; din Faza 6 vine de pe server).
 * Fără dată = disponibil de la lansare. Fantoma vine de Halloween, Magicianul de Crăciun.
 */
export const CHAR_RELEASE: Record<string, string> = {
  ghost: '2026-10-24',
  striker: '2026-11-14',
  chef: '2026-12-05',
  magician: '2026-12-20',
};

/** Temele de bază și nivelul la care se deschid; cele de eveniment sunt gratuite în perioada lor. */
export const THEME_LEVEL: Record<string, number> = {
  clasic: 1,
  neon: 1,
  pixel: 2,
  cosmos: 4,
  cuburi: 6,
  jungla: 8,
};
/** O temă de eveniment în afara perioadei: o păstrezi dacă ai jucat în timpul evenimentului, altfel o cumperi. */
export const EVENT_THEME_PRICE = 300;

const day = (d: string): number => {
  const [y, m, dd] = d.split('-').map(Number);
  return Math.floor(Date.UTC(y!, (m ?? 1) - 1, dd ?? 1) / 86_400_000);
};

export const released = (id: string, date: string): boolean => {
  const r = CHAR_RELEASE[id];
  return !r || day(date) >= day(r);
};

export const daysUntil = (from: string, to: string): number => day(to) - day(from);

/** Cele 2 personaje gratuite ale săptămânii (luni–duminică), dintre cele lansate și necomune. */
export function weeklyRotation(date: string): string[] {
  const week = Math.floor((day(date) - day('2026-01-05')) / 7); // 5 ian. 2026 e luni
  const pool = CHARACTERS.filter((c) => c.rarity !== 'common' && released(c.id, date)).map((c) => c.id);
  return shuffle(deriveRng(week, 0x707a), pool).slice(0, 2);
}

export type Lock =
  | { kind: 'level'; level: number }
  | { kind: 'soon'; date: string; days: number }
  | { kind: 'buy'; price: number };

export function modeLock(mode: ModeId, a: Access): Lock | null {
  if (a.admin || a.level >= MODE_LEVEL[mode]) return null;
  return { kind: 'level', level: MODE_LEVEL[mode] };
}

export type CharState =
  | { kind: 'owned' }
  | { kind: 'rotation' }
  | { kind: 'buy'; price: number }
  | { kind: 'level'; level: number; price: number }
  | { kind: 'soon'; date: string; days: number };

/** Ce poate face jucătorul cu un personaj acum. */
export function charState(p: Profile, id: string, a: Access): CharState {
  if (p.chars.includes(id)) return { kind: 'owned' };
  const c = charById(id);
  const price = RARITY[c.rarity].price;
  if (a.admin) return { kind: 'buy', price };
  const r = CHAR_RELEASE[id];
  if (r && !released(id, a.date)) return { kind: 'soon', date: r, days: daysUntil(a.date, r) };
  if (weeklyRotation(a.date).includes(id)) return { kind: 'rotation' };
  if (a.level < RARITY_LEVEL[c.rarity]) return { kind: 'level', level: RARITY_LEVEL[c.rarity], price };
  return { kind: 'buy', price };
}

/** Se poate juca acum cu personajul (deținut sau în rotația gratuită). */
export const canPlay = (p: Profile, id: string, a: Access): boolean =>
  a.admin || ['owned', 'rotation'].includes(charState(p, id, a).kind);

const inSeason = (id: string, date: string): boolean => {
  const s = themeById(id).season;
  if (!s) return false;
  const [, m, d] = date.split('-').map(Number);
  const v = m! * 100 + d!;
  const a = s.from[0] * 100 + s.from[1];
  const b = s.to[0] * 100 + s.to[1];
  return a <= b ? v >= a && v <= b : v >= a || v <= b;
};

export type ThemeState =
  { kind: 'open' } | { kind: 'event' } | { kind: 'level'; level: number } | { kind: 'buy'; price: number };

export function themeState(p: Profile, id: string, a: Access): ThemeState {
  if (a.admin || p.themes.includes(id)) return { kind: 'open' };
  const t = themeById(id);
  if (t.season) return inSeason(id, a.date) ? { kind: 'event' } : { kind: 'buy', price: EVENT_THEME_PRICE };
  const lv = THEME_LEVEL[id] ?? 1;
  return a.level >= lv ? { kind: 'open' } : { kind: 'level', level: lv };
}

export const themeOpen = (p: Profile, id: string, a: Access): boolean =>
  ['open', 'event'].includes(themeState(p, id, a).kind);

/** Temele de eveniment active la o dată (le păstrezi dacă joci un meci atunci). */
export const eventThemes = (date: string): string[] =>
  THEMES.filter((t) => inSeason(t.id, date)).map((t) => t.id);

/** Ce se deschide exact la un nivel de jucător (pentru banner și insignele „NEW”). */
export function unlocksAt(level: number): string[] {
  const out: string[] = [];
  for (const m of MODE_IDS) if (MODE_LEVEL[m] === level && level > 1) out.push(MODES[m].name);
  for (const [id, lv] of Object.entries(THEME_LEVEL))
    if (lv === level && level > 1) out.push(`${themeById(id).name} theme`);
  for (const [r, lv] of Object.entries(RARITY_LEVEL) as [Rarity, number][])
    if (lv === level && level > 1) out.push(`${RARITY[r].name} characters`);
  return out;
}

/** Cheile deblocărilor (pentru „NEW!”): ce e deschis acum și n-a fost încă văzut. */
export function openKeys(p: Profile, a: Access): string[] {
  const keys: string[] = [];
  for (const m of MODE_IDS) if (!modeLock(m, { ...a, admin: false })) keys.push(`mode:${m}`);
  for (const t of THEMES) if (themeOpen(p, t.id, { ...a, admin: false })) keys.push(`theme:${t.id}`);
  for (const c of CHARACTERS) {
    const k = charState(p, c.id, { ...a, admin: false }).kind;
    if (k !== 'soon' && k !== 'level') keys.push(`char:${c.id}`);
  }
  return keys;
}
