import { challengeSetup, createGame, createMission, createTutorial, dummiesSetup } from '@fitil/sim';
import type { BotLevel, ChallengeId, GameSetup, GameState, Tutorial, TutorialStep } from '@fitil/sim';
import { HEROES, ROSTER, botHeroes, heroSpec, matchRules, missionById } from '@fitil/content';
import type { HeroId, ModeId } from '@fitil/content';

export type PlayKind =
  | { type: 'mode'; mode: ModeId }
  | { type: 'tutorial'; step: TutorialStep }
  | { type: 'dummies' }
  | { type: 'challenge'; id: ChallengeId }
  | { type: 'mission'; id: string };

export interface Slot {
  name: string;
  color: string;
  bot: boolean;
  /** Vocea (0–3) pentru țipete. */
  voice: number;
  /** Personajul (Faza 4); lipsă în Practice, tutorial și misiuni. */
  hero?: HeroId;
}

/** Tema și personajul jucătorului pentru un meci de arenă. */
export interface ArenaChoice {
  theme: string;
  hero: HeroId;
}

export interface Built {
  s: GameState;
  slots: Slot[];
  tutorial: Tutorial | null;
}

const ffaSlots = (): Slot[] => ROSTER.ffa.map((r, i) => ({ ...r, bot: i > 0, voice: i % 4 }));

/** Locurile unui meci de arenă: omul pe locul 0 (cu personajul ales), boții cu personaje trase din seed. */
function arenaSetup(
  mode: ModeId,
  bots: BotLevel,
  seed: number,
  pick: ArenaChoice,
): { players: GameSetup['players']; slots: Slot[] } {
  const team = mode === 'team2' || mode === 'team3' || mode === 'ctf';
  const n = mode === 'vs' ? 2 : team ? (mode === 'team2' ? 4 : 6) : 4;
  const size = n / 2;
  const others = botHeroes(seed, n - 1, [pick.hero]);
  const players: GameSetup['players'] = [];
  const slots: Slot[] = [];
  for (let i = 0; i < n; i++) {
    const hero = i === 0 ? pick.hero : others[i - 1]!;
    const human = i === 0;
    const t = team ? Math.floor(i / size) : undefined;
    const base = team ? ROSTER.teams[t!]![i % size]! : null;
    players.push({
      bot: human ? null : bots,
      hero: heroSpec(hero, pick.theme),
      ...(t === undefined ? {} : { team: t }),
    });
    slots.push({
      name: human ? 'You' : HEROES[hero].name,
      color: base ? base.color : human ? ROSTER.ffa[0].color : HEROES[hero].color,
      bot: !human,
      voice: (i + (t ?? 0)) % 4,
      hero,
    });
  }
  return { players, slots };
}

/** Construiește starea de joc pentru un mod / pas de Practice. `aspect` = proporția zonei de joc. */
export function build(
  kind: PlayKind,
  bots: BotLevel,
  seed: number,
  aspect: number,
  pick: ArenaChoice = { theme: 'clasic', hero: 'bubu' },
): Built {
  if (kind.type === 'tutorial') {
    const { s, t } = createTutorial(kind.step, seed);
    const slots = ffaSlots().slice(0, s.players.length);
    if (slots[1]) slots[1] = { ...ROSTER.dummy, bot: true, voice: 1 };
    return { s, slots, tutorial: t };
  }
  if (kind.type === 'mission') {
    const def = missionById(kind.id);
    if (!def) throw new Error(`misiune necunoscută: ${kind.id}`);
    return { s: createMission(def, seed), slots: ffaSlots().slice(0, 1), tutorial: null };
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
  const t = arenaSetup(kind.mode, bots, seed, pick);
  return {
    s: createGame({ seed, rules: matchRules(kind.mode, pick.theme, seed, aspect), players: t.players }),
    slots: t.slots,
    tutorial: null,
  };
}

export const isTeamKind = (k: PlayKind): boolean =>
  k.type === 'mode' && (k.mode === 'team2' || k.mode === 'team3' || k.mode === 'ctf');
