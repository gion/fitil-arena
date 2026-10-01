import { createGame } from '@fitil/sim';
import type { GameSetup, GameState } from '@fitil/sim';
import { HEROES, ROSTER, botHeroes, heroSpec, matchRules } from '@fitil/content';
import type { HeroId, ModeId } from '@fitil/content';
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

export interface OnlineHuman {
  name: string;
  hero: HeroId;
}

/**
 * Construiește meciul online: aceleași reguli ca offline (mod, temă, eveniment de arenă), cu oamenii
 * din lobby pe personajele alese și boți cu personaje trase din seed.
 * Tufișurile sunt oprite online: sincronizarea prin input-uri dă fiecărui client toată starea (Q-004).
 */
export function buildOnline(cfg: RoomCfg, seed: number, aspect: number, people: OnlineHuman[]): OnlineBuild {
  const n = Math.min(people.length, maxHumans(cfg.mode));
  const humans = Array.from({ length: n }, (_, k) => humanId(cfg.mode, k));
  const team = isTeam(cfg.mode);
  const count = team ? teamSize(cfg.mode) * 2 : cfg.mode === 'vs' ? 2 : 4;
  const botPool = botHeroes(
    seed,
    count - n,
    people.slice(0, n).map((p) => p.hero),
  );
  let nextBot = 0;
  const players: GameSetup['players'] = [];
  const slots: SlotInfo[] = [];
  for (let id = 0; id < count; id++) {
    const k = humans.indexOf(id);
    const hero = k >= 0 ? people[k]!.hero : botPool[nextBot++]!;
    const t = team ? Math.floor(id / teamSize(cfg.mode)) : undefined;
    const base = t === undefined ? null : ROSTER.teams[t]![id % teamSize(cfg.mode)]!;
    players.push({
      bot: k < 0 ? cfg.bots : null,
      hero: heroSpec(hero, cfg.theme),
      ...(t === undefined ? {} : { team: t }),
    });
    slots.push({
      name: k < 0 ? HEROES[hero].name : people[k]!.name,
      color: base ? base.color : k === 0 ? ROSTER.ffa[0].color : HEROES[hero].color,
      bot: k < 0,
      voice: (id + (t ?? 0)) % 4,
      hero,
    });
  }
  const rules = { ...matchRules(cfg.mode, cfg.theme, seed, aspect, { extras: cfg.extras }), bushRate: 0 };
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
