import { sec } from './constants.ts';
import { idx, tileX, tileY } from './grid.ts';
import { createGame, gridForAspect } from './setup.ts';
import type { GameSetup } from './setup.ts';
import { SOFT } from './types.ts';
import type { BotLevel, GameState, ItemType } from './types.ts';

/* ---------- Tutorial interactiv (6 pași) ---------- */

export const TUTORIAL_STEPS = ['move', 'bomb', 'pickup', 'kick', 'glove', 'dummy'] as const;
export type TutorialStep = (typeof TUTORIAL_STEPS)[number];

export interface Tutorial {
  step: TutorialStep;
  /** Pătrățelul-țintă marcat pe hartă (pasul „mergi”). */
  target: [number, number] | null;
}

/**
 * Harta unui pas de tutorial: arenă mică 11×7, fără hurry up și fără lăzi care reapar.
 * Jucătorul (id 0) pornește din stânga-sus; pasul „manechin” adaugă un manechin (id 1).
 */
export function createTutorial(step: TutorialStep, seed = 1): { s: GameState; t: Tutorial } {
  const s = createGame({
    seed,
    rules: { width: 11, height: 7, softDensity: 0, curseRate: 0, boxRespawn: false, hurryUpTick: 0 },
    players: step === 'dummy' ? [{ bot: null }, { bot: 'dummy' }] : [{ bot: null }],
  });
  const p = s.players[0]!;
  const soft = (x: number, y: number) => (s.grid[idx(s, x, y)] = SOFT);
  const item = (x: number, y: number, it: ItemType) => (s.items[idx(s, x, y)] = it);
  let target: [number, number] | null = null;
  switch (step) {
    case 'move':
      target = [9, 5];
      break;
    case 'bomb':
      soft(4, 1);
      soft(3, 2);
      break;
    case 'pickup':
      item(5, 1, 'fire');
      item(1, 5, 'bomb');
      break;
    case 'kick':
      p.kick = true;
      break;
    case 'glove':
      p.glove = true;
      soft(3, 1);
      soft(1, 3);
      break;
    case 'dummy': {
      const d = s.players[1]!;
      d.px = 7000;
      d.py = 3000;
      d.fx = d.tx = 7;
      d.fy = d.ty = 3;
      soft(5, 3);
      p.bombs = 2;
      break;
    }
  }
  return { s, t: { step, target } };
}

/** Pasul e terminat? Se verifică după fiecare tick (folosește evenimentele tick-ului). */
export function tutorialDone(s: GameState, t: Tutorial): boolean {
  const p = s.players[0]!;
  if (!p.alive) return false;
  const has = (type: string) => s.events.some((e) => e.type === type && ('player' in e ? e.player === 0 : true));
  switch (t.step) {
    case 'move':
      return t.target !== null && tileX(p) === t.target[0] && tileY(p) === t.target[1] && !p.moving;
    case 'bomb':
      // lada spartă și ai scăpat: flăcările s-au stins
      return s.grid.every((g) => g !== SOFT) && s.flame.every((f) => f === 0) && s.bombs.length === 0;
    case 'pickup':
      return has('pickup');
    case 'kick':
      return has('kick');
    case 'glove':
      return has('throw');
    case 'dummy':
      return s.events.some((e) => e.type === 'death' && e.player === 1);
  }
}

/** Jucătorul a murit în tutorial: pasul se reia. */
export const tutorialFailed = (s: GameState): boolean => !s.players[0]!.alive;

/* ---------- Manechine de antrenament ---------- */

/** Tu contra 3 manechine care stau pe loc și revin în joc după 2s. Fără final. */
export function dummiesSetup(seed: number, aspect: number): GameSetup {
  return {
    seed,
    rules: { ...gridForAspect(aspect), respawnTicks: sec(2), hurryUpTick: 0 },
    players: [{ bot: null }, { bot: 'dummy' }, { bot: 'dummy' }, { bot: 'dummy' }],
  };
}

/* ---------- Provocări ---------- */

export const CHALLENGES = ['kicker', 'chains', 'minimal', 'fast', 'thrower'] as const;
export type ChallengeId = (typeof CHALLENGES)[number];

interface ChallengeDef {
  bots: BotLevel;
  startItems: ItemType[];
  need: number;
}

const DEFS: Record<ChallengeId, ChallengeDef> = {
  /** Câștigă, iar toate eliminările tale sunt cu bombe șutate (cel puțin una). */
  kicker: { bots: 'normal', startItems: ['kick'], need: 1 },
  /** 5 lanțuri de cel puțin 3 bombe, pornite de tine, într-un meci. */
  chains: { bots: 'easy', startItems: ['bomb', 'bomb'], need: 5 },
  /** Câștigă fără să culegi niciun bonus. */
  minimal: { bots: 'normal', startItems: [], need: 1 },
  /** Câștigă în mai puțin de 60 de secunde. */
  fast: { bots: 'normal', startItems: [], need: 1 },
  /** Elimină 2 adversari cu bombe aruncate cu mănușa. */
  thrower: { bots: 'normal', startItems: ['glove'], need: 2 },
};

export const FAST_LIMIT = sec(60);
export const CHAIN_MIN = 3;

export function challengeSetup(id: ChallengeId, seed: number, aspect: number): GameSetup {
  const d = DEFS[id];
  return {
    seed,
    rules: { ...gridForAspect(aspect), startItems: d.startItems },
    players: [{ bot: null }, { bot: d.bots }, { bot: d.bots }, { bot: d.bots }],
  };
}

export interface ChallengeProgress {
  id: ChallengeId;
  count: number;
  need: number;
  status: 'playing' | 'done' | 'failed';
  /** Mărimea fiecărui lanț pornit de tine (chain → câte explozii). */
  chains: Record<number, number>;
  /** Eliminări care nu respectă regula provocării. */
  bad: number;
}

export const startChallenge = (id: ChallengeId): ChallengeProgress => ({
  id,
  count: 0,
  need: DEFS[id].need,
  status: 'playing',
  chains: {},
  bad: 0,
});

/** Actualizează progresul după un tick (jucătorul are id 0). */
export function trackChallenge(c: ChallengeProgress, s: GameState): ChallengeProgress {
  if (c.status !== 'playing') return c;
  const me = 0;
  for (const e of s.events) {
    if (e.type === 'pickup' && e.player === me && c.id === 'minimal') c.status = 'failed';
    if (e.type === 'explode' && c.id === 'chains') {
      if (e.owner === me && c.chains[e.chain] === undefined) c.chains[e.chain] = 0;
      if (c.chains[e.chain] !== undefined && ++c.chains[e.chain]! === CHAIN_MIN) c.count++;
    }
    if (e.type === 'death' && e.killerId === me && e.player !== me) {
      if (c.id === 'kicker') {
        if (e.via === 1) c.count = Math.max(c.count, 1);
        else c.bad++;
      }
      if (c.id === 'thrower' && e.via === 2) c.count++;
    }
  }
  const won = s.result?.winner === me;
  if (c.id === 'chains' || c.id === 'thrower') {
    if (c.count >= c.need) c.status = 'done';
  } else if (c.id === 'kicker') {
    if (c.bad) c.status = 'failed';
    else if (won && c.count >= 1) c.status = 'done';
  } else if (c.id === 'fast') {
    if (s.tick >= FAST_LIMIT && !s.result) c.status = 'failed';
    else if (won) c.count = 1;
  } else if (won) c.count = 1;
  if (c.status === 'playing' && c.count >= c.need && (c.id === 'minimal' || c.id === 'fast')) c.status = 'done';
  if (c.status === 'playing' && (s.result || !s.players[me]!.alive)) c.status = 'failed';
  return c;
}
