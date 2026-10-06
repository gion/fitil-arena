import { createGame } from '@fitil/sim';
import type { GameSetup, GameState } from '@fitil/sim';
import {
  CHAR_IDS,
  ROSTER,
  botChars,
  charById,
  charSetup,
  cleanOutfit,
  matchRules,
  shopItem,
} from '@fitil/content';
import type { ModeId, Outfit } from '@fitil/content';
import type { RoomCfg, SlotInfo } from './protocol.ts';

/** Câți oameni încap într-un mod online (restul sloturilor sunt boți). */
export function maxHumans(mode: ModeId): number {
  return mode === 'vs' ? 2 : 4;
}

/** Câte personaje sunt în meci: 2 în 1 vs 1, 4 sau 6 pe echipe, 4 altfel. */
function teamSize(mode: ModeId): number {
  return mode === 'team2' ? 2 : 3;
}

const isTeam = (mode: ModeId): boolean => mode === 'team2' || mode === 'team3' || mode === 'ctf';

/**
 * Id-ul din simulare al omului cu numărul `k` (ordinea din lobby). Pe echipe oamenii se împart
 * alternativ: 0 → albaștri, 1 → roșii, 2 → albaștri, …
 */
export function humanId(mode: ModeId, k: number): number {
  if (!isTeam(mode)) return k;
  return (k % 2) * teamSize(mode) + Math.floor(k / 2);
}

export interface OnlineBuild {
  state: GameState;
  slots: SlotInfo[];
  /** `humans[k]` = id-ul din simulare al omului k. */
  humans: number[];
}

/** Un om din meci: numele, personajul și ce poartă. */
export interface HumanSeat {
  name: string;
  ch?: string | null;
  outfit?: Outfit | null;
}

/** Ce trebuie pentru a construi un meci; lipsurile au valorile jocului offline clasic. */
export type BuildCfg = Pick<RoomCfg, 'mode' | 'bots'> & {
  theme?: string;
  /** Fără personaje, Ultimate și încărcări (jocul original). */
  classic?: boolean;
  /** Evenimente de arenă și bonusurile din Faza 4 (implicit pornite când nu e clasic). */
  extras?: boolean;
  /** Tufișuri: doar offline — online, sincronizarea prin input-uri dă fiecărui client toată starea (Q-009). */
  bushes?: boolean;
};

/**
 * Construiește un meci (online sau offline): aceleași reguli (mod, temă, eveniment de arenă), cu oamenii
 * dați pe personajele alese și boți cu personaje trase din seed. Cu personaje, fiecare jucător primește
 * kitul (semnătura) și eroul (Ultimate + afinitatea temei), iar abilitățile din arenă au încărcări.
 */
export function buildOnline(
  cfg: BuildCfg,
  seed: number,
  aspect: number,
  seats: (HumanSeat | string)[],
): OnlineBuild {
  const people = seats.slice(0, maxHumans(cfg.mode)).map((h) => (typeof h === 'string' ? { name: h } : h));
  const chars = !cfg.classic;
  const theme = cfg.theme ?? 'clasic';
  const humans = people.map((_, k) => humanId(cfg.mode, k));
  const count = isTeam(cfg.mode) ? teamSize(cfg.mode) * 2 : cfg.mode === 'vs' ? 2 : 4;
  const humanCh = people.map((h) => (h.ch && CHAR_IDS.includes(h.ch) ? h.ch : 'bubu'));
  const bots = chars ? botChars(seed, humanCh, count) : [];
  let nb = 0;
  const players: GameSetup['players'] = [];
  const slots: SlotInfo[] = [];
  const add = (
    id: number,
    base: { name: string; color: string },
    team: number | undefined,
    voice: number,
  ) => {
    const k = humans.indexOf(id);
    const ch = chars ? (k >= 0 ? humanCh[k]! : bots[nb++]!) : null;
    const outfit = k >= 0 && chars ? cleanOutfit(people[k]!.outfit) : null;
    const own = outfit?.color ? shopItem(outfit.color)?.col : undefined;
    const ps: GameSetup['players'][number] = {
      bot: k < 0 ? cfg.bots : null,
      ...(ch ? charSetup(ch, theme) : {}),
    };
    if (team !== undefined) ps.team = team;
    players.push(ps);
    slots.push({
      name: k >= 0 ? people[k]!.name : ch ? charById(ch).name : base.name,
      // pe echipe culoarea rămâne a echipei; în FFA: culoarea din magazin, altfel a personajului
      color: team !== undefined ? base.color : (own ?? (ch ? charById(ch).color : base.color)),
      bot: k < 0,
      voice,
      ch,
      outfit,
    });
  };
  if (isTeam(cfg.mode)) {
    const size = teamSize(cfg.mode);
    for (const team of [0, 1])
      for (let i = 0; i < size; i++) add(team * size + i, ROSTER.teams[team]![i]!, team, (i + team) % 4);
  } else for (let i = 0; i < count; i++) add(i, ROSTER.ffa[i]!, undefined, i % 4);
  const extras = chars && (cfg.extras ?? true);
  const rules = {
    ...matchRules(cfg.mode, theme, seed, aspect, { extras }),
    ...(cfg.bushes ? {} : { bushRate: 0 }),
    ...(chars ? { charges: true } : {}),
  };
  return { state: createGame({ seed, rules, players }), slots, humans };
}

/** Curăță un nume ales de jucător (fără caractere de control, maxim 12 caractere). */
export function cleanName(v: unknown, fallback: string): string {
  const s =
    typeof v === 'string'
      ? v
          .replace(/[^\p{L}\p{N} _.-]/gu, '')
          .trim()
          .slice(0, 12)
      : '';
  return s || fallback;
}
