import {
  challengeSetup,
  createGame,
  createTutorial,
  ctfRules,
  duelRules,
  dummiesSetup,
  gridForAspect,
  rotateRules,
  shiftRules,
} from '@fitil/sim';
import type { BotLevel, ChallengeId, GameSetup, GameState, Tutorial, TutorialStep } from '@fitil/sim';
import { ROSTER } from '@fitil/content';
import type { ModeId } from '@fitil/content';

export type PlayKind =
  | { type: 'mode'; mode: ModeId }
  | { type: 'tutorial'; step: TutorialStep }
  | { type: 'dummies' }
  | { type: 'challenge'; id: ChallengeId };

export interface Slot {
  name: string;
  color: string;
  bot: boolean;
  /** Vocea (0–3) pentru țipete. */
  voice: number;
}

export interface Built {
  s: GameState;
  slots: Slot[];
  tutorial: Tutorial | null;
}

const ffaSlots = (): Slot[] => ROSTER.ffa.map((r, i) => ({ ...r, bot: i > 0, voice: i % 4 }));

function teamSetup(n: number, bots: BotLevel): { players: GameSetup['players']; slots: Slot[] } {
  const players: GameSetup['players'] = [];
  const slots: Slot[] = [];
  for (const team of [0, 1])
    for (let i = 0; i < n; i++) {
      const human = team === 0 && i === 0;
      players.push({ bot: human ? null : bots, team });
      slots.push({ ...ROSTER.teams[team]![i]!, bot: !human, voice: (i + team) % 4 });
    }
  return { players, slots };
}

/** Construiește starea de joc pentru un mod / pas de Practice. `aspect` = proporția zonei de joc. */
export function build(kind: PlayKind, bots: BotLevel, seed: number, aspect: number): Built {
  if (kind.type === 'tutorial') {
    const { s, t } = createTutorial(kind.step, seed);
    const slots = ffaSlots().slice(0, s.players.length);
    if (slots[1]) slots[1] = { ...ROSTER.dummy, bot: true, voice: 1 };
    return { s, slots, tutorial: t };
  }
  if (kind.type === 'dummies') {
    const s = createGame(dummiesSetup(seed, aspect));
    return {
      s,
      slots: s.players.map((_, i) => (i ? { ...ROSTER.dummy, bot: true, voice: i % 4 } : ffaSlots()[0]!)),
      tutorial: null,
    };
  }
  if (kind.type === 'challenge')
    return { s: createGame(challengeSetup(kind.id, seed, aspect)), slots: ffaSlots(), tutorial: null };
  const four = (): GameSetup['players'] => [{ bot: null }, { bot: bots }, { bot: bots }, { bot: bots }];
  const make = (rules: GameSetup['rules'], players: GameSetup['players'], slots: Slot[]): Built => ({
    s: createGame({ seed, rules, players }),
    slots,
    tutorial: null,
  });
  switch (kind.mode) {
    case 'ffa':
      return make(gridForAspect(aspect), four(), ffaSlots());
    case 'vs':
      return make(duelRules(seed), [{ bot: null }, { bot: bots }], ffaSlots().slice(0, 2));
    case 'team2':
    case 'team3': {
      const t = teamSetup(kind.mode === 'team2' ? 2 : 3, bots);
      return make({ ...gridForAspect(aspect), mode: 'teams' }, t.players, t.slots);
    }
    case 'ctf': {
      const t = teamSetup(3, bots);
      return make(ctfRules(aspect), t.players, t.slots);
    }
    case 'rot':
      return make(rotateRules(), four(), ffaSlots());
    case 'shift':
      return make(shiftRules(aspect), four(), ffaSlots());
  }
}

export const isTeamKind = (k: PlayKind): boolean =>
  k.type === 'mode' && (k.mode === 'team2' || k.mode === 'team3' || k.mode === 'ctf');
