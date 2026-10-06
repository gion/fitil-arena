import {
  challengeSetup,
  createGame,
  createInfinite,
  createMission,
  createTutorial,
  dummiesSetup,
} from '@fitil/sim';
import type { BotLevel, ChallengeId, GameState, Tutorial, TutorialStep } from '@fitil/sim';
import { CHAR_IDS, ROSTER, charById, charSetup, missionById } from '@fitil/content';
import type { ModeId, Outfit } from '@fitil/content';
import { DAILY_ASPECT, buildOnline } from '@fitil/net';
import type { SlotInfo } from '@fitil/net';

export type PlayKind =
  | { type: 'mode'; mode: ModeId }
  | { type: 'tutorial'; step: TutorialStep }
  /** Practice cu manechine; `ch` = încearcă un personaj (pagina personajului). */
  | { type: 'dummies'; ch?: string }
  /** `daily`: provocarea zilei (seed de la server, arenă 16:9 fixă, input-urile se înregistrează pentru verificare). */
  | { type: 'challenge'; id: ChallengeId; seed?: number; daily?: boolean }
  | { type: 'mission'; id: string }
  /** Modul Infinit offline (varianta din prototip): tu și boții care apar în jur. */
  | { type: 'infinite' };

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
  if (kind.type === 'infinite') {
    const ch = me && !me.classic ? me.ch : null;
    const s = createInfinite(seed, ch ? { bot: null, ...charSetup(ch, me!.theme) } : { bot: null });
    return {
      s,
      slots: infiniteSlots({ ...ffaSlots()[0]!, ch, outfit: ch && me ? me.outfit : null }),
      tutorial: null,
    };
  }
  if (kind.type === 'challenge')
    return {
      s: createGame(challengeSetup(kind.id, kind.seed ?? seed, kind.daily ? DAILY_ASPECT : aspect)),
      slots: ffaSlots(),
      tutorial: null,
    };
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

const BOT_COLORS = ['#f3f1ea', '#9a6436', '#2fd3c6', '#ff7a3d', '#c77dff', '#ffd23f', '#3d8bff', '#ff5d8f'];

/**
 * Locurile din Infinit: tu, apoi boții (în lumea infinită id-urile cresc pe măsură ce apar boți noi;
 * locurile se refolosesc, deci 128 ajung). Boții poartă personaje doar ca înfățișare.
 */
function infiniteSlots(you: Slot): Slot[] {
  const out: Slot[] = [you];
  for (let i = 1; i < 128; i++) {
    const ch = CHAR_IDS[i % CHAR_IDS.length]!;
    out.push({
      name: charById(ch).name,
      color: BOT_COLORS[i % BOT_COLORS.length]!,
      bot: true,
      voice: i % 4,
      ch,
      outfit: null,
    });
  }
  return out;
}

export const isTeamKind = (k: PlayKind): boolean =>
  k.type === 'mode' && (k.mode === 'team2' || k.mode === 'team3' || k.mode === 'ctf');
