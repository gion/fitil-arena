import { createGame, ctfRules, duelRules, gridForAspect, rotateRules, shiftRules } from '@fitil/sim';
import type { GameSetup, GameState, Rules } from '@fitil/sim';
import { CHAR_IDS, ROSTER, botChars, charById, cleanOutfit, shopItem } from '@fitil/content';
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

/**
 * Construiește un meci (online sau offline): aceleași reguli, cu oamenii dați și boți în rest.
 * Cu personaje (implicit), boții primesc personaje din seed și abilitățile din arenă au încărcări.
 */
export function buildOnline(
  cfg: Pick<RoomCfg, 'mode' | 'bots'> & { classic?: boolean },
  seed: number,
  aspect: number,
  seats: (HumanSeat | string)[],
): OnlineBuild {
  const people = seats.slice(0, maxHumans(cfg.mode)).map((h) => (typeof h === 'string' ? { name: h } : h));
  const chars = !cfg.classic;
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
    const ps: GameSetup['players'][number] = { bot: k < 0 ? cfg.bots : null };
    if (team !== undefined) ps.team = team;
    if (ch) {
      ps.ch = ch;
      ps.kit = charById(ch).kit;
    }
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
  let rules: Partial<Rules>;
  if (isTeam(cfg.mode)) {
    const size = teamSize(cfg.mode);
    for (const team of [0, 1])
      for (let i = 0; i < size; i++) add(team * size + i, ROSTER.teams[team]![i]!, team, (i + team) % 4);
    rules = cfg.mode === 'ctf' ? ctfRules(aspect) : { ...gridForAspect(aspect), mode: 'teams' };
  } else {
    for (let i = 0; i < count; i++) add(i, ROSTER.ffa[i]!, undefined, i % 4);
    rules =
      cfg.mode === 'vs'
        ? duelRules(seed)
        : cfg.mode === 'rot'
          ? rotateRules()
          : cfg.mode === 'shift'
            ? shiftRules(aspect)
            : gridForAspect(aspect);
  }
  if (chars) rules = { ...rules, charges: true };
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
