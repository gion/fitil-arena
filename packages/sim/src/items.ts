import {
  DIZZY,
  HICCUP,
  HICCUP_FIRST,
  MAX_BOMBS,
  MAX_RANGE,
  REVERSE,
  SHIELD,
  SPEED_MAX,
  SPEED_MIN,
  SPEED_SLOW,
  SPEED_STEP,
} from './constants.ts';
import { nextFloat, nextInt } from './rng.ts';
import type { RngState } from './rng.ts';
import type { GoldItem, ItemType, NegativeItem, Player } from './types.ts';

export const NEGATIVE: readonly NegativeItem[] = ['slow', 'shrink', 'fewer', 'reverse', 'hiccup', 'dizzy'];
export const GOLD: readonly GoldItem[] = ['maxspeed', 'maxfire', 'maxbomb'];
export const isNegative = (it: ItemType): it is NegativeItem => (NEGATIVE as readonly string[]).includes(it);
export const isGold = (it: ItemType): it is GoldItem => (GOLD as readonly string[]).includes(it);

export function applyItem(p: Player, it: ItemType): void {
  switch (it) {
    case 'bomb':
      p.bombs = Math.min(MAX_BOMBS, p.bombs + 1);
      break;
    case 'fire':
      p.range = Math.min(MAX_RANGE, p.range + 1);
      break;
    case 'speed':
      p.speed = Math.min(SPEED_MAX, p.speed + SPEED_STEP);
      break;
    case 'kick':
      p.kick = true;
      break;
    case 'glove':
      p.glove = true;
      break;
    case 'remote':
      p.remote = true;
      break;
    case 'line':
      p.line = true;
      break;
    case 'shield':
      p.shieldT = SHIELD;
      break;
    case 'slow':
      p.speed = Math.max(SPEED_MIN, p.speed - SPEED_SLOW);
      break;
    case 'shrink':
      p.range = Math.max(1, p.range - 1);
      break;
    case 'fewer':
      p.bombs = Math.max(1, p.bombs - 1);
      break;
    case 'reverse':
      p.revT = REVERSE;
      break;
    case 'dizzy':
      p.dizzyT = DIZZY;
      break;
    case 'hiccup':
      p.hicT = HICCUP;
      p.hicCd = HICCUP_FIRST;
      break;
    case 'maxspeed':
      p.speed = SPEED_MAX;
      break;
    case 'maxfire':
      p.range = MAX_RANGE;
      break;
    case 'maxbomb':
      p.bombs = MAX_BOMBS;
      break;
  }
}

/** Ce cade dintr-o ladă obișnuită (tabelul din prototip): 42% șansă de drop, din care 17% negative. */
export function rollDrop(rng: RngState): ItemType | null {
  if (nextFloat(rng) >= 0.42) return null;
  if (nextFloat(rng) < 0.17) return NEGATIVE[nextInt(rng, NEGATIVE.length)]!;
  const r = nextFloat(rng);
  if (r < 0.2) return 'bomb';
  if (r < 0.47) return 'fire';
  if (r < 0.6) return 'speed';
  if (r < 0.7) return 'kick';
  if (r < 0.79) return 'glove';
  if (r < 0.86) return 'remote';
  if (r < 0.92) return 'line';
  return 'shield';
}

export const rollGold = (rng: RngState): GoldItem => GOLD[nextInt(rng, GOLD.length)]!;
