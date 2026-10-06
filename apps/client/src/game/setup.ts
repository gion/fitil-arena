import { challengeSetup, createGame, createMission, createTutorial, dummiesSetup } from '@fitil/sim';
import type { BotLevel, ChallengeId, GameState, Tutorial, TutorialStep } from '@fitil/sim';
import { ROSTER, charById, missionById } from '@fitil/content';
import type { ModeId, Outfit } from '@fitil/content';
import { buildOnline } from '@fitil/net';
import type { SlotInfo } from '@fitil/net';

export type PlayKind =
  | { type: 'mode'; mode: ModeId }
  | { type: 'tutorial'; step: TutorialStep }
  /** Practice cu manechine; `ch` = încearcă un personaj (pagina personajului). */
  | { type: 'dummies'; ch?: string }
  | { type: 'challenge'; id: ChallengeId }
  | { type: 'mission'; id: string };

/** Numele, culoarea, vocea (0–3, pentru țipete), personajul și ținuta unui jucător din meci. */
export type Slot = SlotInfo;

/** Jucătorul local: personajul ales, ce poartă, tema arenei și dacă joacă varianta clasică (fără personaje). */
export interface Me {
  ch: string;
  outfit: Outfit;
  classic: boolean;
  /** Tema arenei: afinitățile personajelor și efectele de arenă depind de ea. */
  theme: string;
}

export interface Built {
  s: GameState;
  slots: Slot[];
  tutorial: Tutorial | null;
}

const ffaSlots = (): Slot[] =>
  ROSTER.ffa.map((r, i) => ({ ...r, bot: i > 0, voice: i % 4, ch: null, outfit: null }));

/** Construiește starea de joc pentru un mod / pas de Practice. `aspect` = proporția zonei de joc. */
export function build(kind: PlayKind, bots: BotLevel, seed: number, aspect: number, me?: Me): Built {
  if (kind.type === 'tutorial') {
    const { s, t } = createTutorial(kind.step, seed);
    const slots = ffaSlots().slice(0, s.players.length);
    if (slots[1]) slots[1] = { ...ROSTER.dummy, bot: true, voice: 1, ch: null, outfit: null };
    return { s, slots, tutorial: t };
  }
  if (kind.type === 'mission') {
    const def = missionById(kind.id);
    if (!def) throw new Error(`misiune necunoscută: ${kind.id}`);
    return { s: createMission(def, seed), slots: ffaSlots().slice(0, 1), tutorial: null };
  }
  if (kind.type === 'dummies') {
    const setup = dummiesSetup(seed, aspect);
    const ch = kind.ch ?? (me && !me.classic ? me.ch : undefined);
    if (ch) setup.players[0] = { bot: null, ch, kit: charById(ch).kit };
    const s = createGame(setup);
    const you: Slot = { ...ffaSlots()[0]!, ch: ch ?? null, outfit: ch && me ? me.outfit : null };
    return {
      s,
      slots: s.players.map((_, i) =>
        i ? { ...ROSTER.dummy, bot: true, voice: i % 4, ch: null, outfit: null } : you,
      ),
      tutorial: null,
    };
  }
  if (kind.type === 'challenge')
    return { s: createGame(challengeSetup(kind.id, seed, aspect)), slots: ffaSlots(), tutorial: null };
  // modurile de joc: aceeași construcție ca online (un om, restul boți; personaje dacă nu e clasic);
  // offline există și tufișuri
  const b = buildOnline(
    { mode: kind.mode, bots, classic: me?.classic ?? true, theme: me?.theme ?? 'clasic', bushes: true },
    seed,
    aspect,
    [{ name: 'You', ch: me?.ch ?? null, outfit: me?.outfit ?? null }],
  );
  return { s: b.state, slots: b.slots, tutorial: null };
}

export const isTeamKind = (k: PlayKind): boolean =>
  k.type === 'mode' && (k.mode === 'team2' || k.mode === 'team3' || k.mode === 'ctf');
