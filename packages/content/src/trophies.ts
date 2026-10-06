import type { ModeId } from './texts.ts';

/**
 * Trofeele per personaj (Faza 6). Doar modurile clasate dau și iau trofee: FFA, 1v1 și 2v2.
 * Restul modurilor sunt de plăcere. Funcții pure: serverul le aplică, clientul doar le afișează.
 */
export const RANKED_MODES: readonly ModeId[] = ['ffa', 'vs', 'team2'];
export const isRanked = (mode: ModeId): boolean => RANKED_MODES.includes(mode);

/** Schimbarea de trofee: FFA după loc (1–4), celelalte moduri după victorie / înfrângere. */
const FFA = [30, 12, -8, -20] as const;
const DUEL = { win: 25, lose: -15 } as const;

export function trophyDelta(mode: ModeId, o: { place: number; won: boolean }, trophies: number): number {
  if (!isRanked(mode)) return 0;
  const raw =
    mode === 'ffa' ? (FFA[Math.min(3, Math.max(0, o.place - 1))] ?? -20) : o.won ? DUEL.win : DUEL.lose;
  // nu se coboară sub 0
  return Math.max(raw, -trophies);
}

/** Dimensiunea unei trepte de matchmaking (trofee). */
export const BRACKET_SIZE = 300;
export const bracketOf = (trophies: number): number => Math.floor(Math.max(0, trophies) / BRACKET_SIZE);
