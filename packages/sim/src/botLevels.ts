import { TICK_HZ } from './constants.ts';
import type { BotLevel } from './types.ts';

export interface BotParams {
  /** Pauza minimă între bombe (s) și partea aleatoare adăugată. */
  cdMin: number;
  cdVar: number;
  /** Șansa de a pune bomba când un adversar e în linie. */
  foeChance: number;
  /** Șansa de a rătăci când nu are țintă. */
  wander: number;
  /** Decide doar o dată la N tick-uri când e în siguranță (reacție mai lentă). */
  thinkEvery: number;
  /** Șansa de a ocoli bonusurile negative. */
  avoidNegative: number;
  /** Vânează activ adversarii (pătrățele aproape de ei devin ținte). */
  chase: number;
  /** Folosește harta de pericol cu timp (fitile + lanțuri) la fugă și la decizia de a pune bombe. */
  timed: boolean;
}

export const BOT_LEVELS: Record<BotLevel, BotParams> = {
  easy: {
    cdMin: 1.0,
    cdVar: 0.8,
    foeChance: 0.35,
    wander: 0.06,
    thinkEvery: 4,
    avoidNegative: 0.5,
    chase: 0,
    timed: false,
  },
  normal: {
    cdMin: 0.45,
    cdVar: 0.5,
    foeChance: 0.8,
    wander: 0.04,
    thinkEvery: 1,
    avoidNegative: 1,
    chase: 0,
    timed: true,
  },
  hard: {
    cdMin: 0.3,
    cdVar: 0.3,
    foeChance: 0.95,
    wander: 0.02,
    thinkEvery: 1,
    avoidNegative: 1,
    chase: 2,
    timed: true,
  },
  insane: {
    cdMin: 0.15,
    cdVar: 0.2,
    foeChance: 1,
    wander: 0.01,
    thinkEvery: 1,
    avoidNegative: 1,
    chase: 3,
    timed: true,
  },
};

export const botCooldown = (l: BotParams, r: number): number => Math.round((l.cdMin + r * l.cdVar) * TICK_HZ);
