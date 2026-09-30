import { createGame, ctfRules, duelRules, gridForAspect, rotateRules, shiftRules } from '@fitil/sim';
import type { GameSetup, GameState, Rules } from '@fitil/sim';
import { ROSTER } from '@fitil/content';
import type { ModeId } from '@fitil/content';
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

/** Construiește meciul online: aceleași reguli ca offline, cu `names.length` oameni. */
export function buildOnline(cfg: RoomCfg, seed: number, aspect: number, names: string[]): OnlineBuild {
  const n = Math.min(names.length, maxHumans(cfg.mode));
  const humans = Array.from({ length: n }, (_, k) => humanId(cfg.mode, k));
  const human = (id: number) => humans.indexOf(id);
  const players: GameSetup['players'] = [];
  const slots: SlotInfo[] = [];
  const add = (
    id: number,
    base: { name: string; color: string },
    team: number | undefined,
    voice: number,
  ) => {
    const k = human(id);
    players.push(
      team === undefined ? { bot: k < 0 ? cfg.bots : null } : { bot: k < 0 ? cfg.bots : null, team },
    );
    slots.push({ name: k < 0 ? base.name : names[k]!, color: base.color, bot: k < 0, voice });
  };
  let rules: Partial<Rules>;
  if (isTeam(cfg.mode)) {
    const size = teamSize(cfg.mode);
    for (const team of [0, 1])
      for (let i = 0; i < size; i++) add(team * size + i, ROSTER.teams[team]![i]!, team, (i + team) % 4);
    rules = cfg.mode === 'ctf' ? ctfRules(aspect) : { ...gridForAspect(aspect), mode: 'teams' };
  } else {
    const count = cfg.mode === 'vs' ? 2 : 4;
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
