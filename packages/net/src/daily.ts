import {
  CHALLENGES,
  TICK_HZ,
  botInput,
  challengeSetup,
  createGame,
  startChallenge,
  step,
  trackChallenge,
} from '@fitil/sim';
import type { ChallengeId, Input } from '@fitil/sim';
import { decodeInput } from './protocol.ts';
import type { WireInput } from './protocol.ts';

/** Provocarea zilei: aceeași pentru toți într-o zi, pe o arenă cu proporție fixă (grila depinde de ea). */
export const DAILY_ASPECT = 16 / 9;
/** Cât ține cel mult o rulare (secunde): peste, e respinsă. */
export const DAILY_MAX_S = 120;
export const DAILY_MAX_TICKS = DAILY_MAX_S * TICK_HZ;

const hashDay = (day: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < day.length; i++) h = Math.imul(h ^ day.charCodeAt(i), 0x01000193);
  return h >>> 0;
};

export interface Daily {
  day: string;
  id: ChallengeId;
  seed: number;
}

/** Provocarea zilei `day` (AAAA-LL-ZZ): tipul și seed-ul vin din hash-ul datei. */
export function dailyChallenge(day: string): Daily {
  const h = hashDay(day);
  return { day, id: CHALLENGES[h % CHALLENGES.length]!, seed: (h >>> 3) % 0x7fffffff };
}

export interface Replay {
  done: boolean;
  /** Tick-ul în care s-a îndeplinit provocarea (mai mic = mai bine). */
  ticks: number;
}

/**
 * Reia o rulare a provocării zilei din input-urile jucătorului (un input pe tick), pe aceeași simulare
 * deterministă ca în joc. Așa serverul verifică scorul fără să ia cuvântul clientului.
 */
export function replayDaily(d: Daily, inputs: WireInput[]): Replay {
  const s = createGame(challengeSetup(d.id, d.seed, DAILY_ASPECT));
  const prog = startChallenge(d.id);
  const n = Math.min(inputs.length, DAILY_MAX_TICKS);
  for (let t = 0; t < n; t++) {
    const bots: (Input | undefined)[] = s.players.map((p) =>
      p.bot !== null ? botInput(s, p.id) : undefined,
    );
    bots[0] = decodeInput(inputs[t]);
    step(s, bots);
    trackChallenge(prog, s);
    if (prog.status === 'done') return { done: true, ticks: s.tick };
    if (prog.status === 'failed') break;
  }
  return { done: false, ticks: s.tick };
}
