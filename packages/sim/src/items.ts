import {
  CHARGES,
  CHARGE_MAX,
  DIZZY,
  HEART_HP,
  HICCUP,
  HICCUP_FIRST,
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
import type { ChargeAbility, GameState, GoldItem, ItemType, NegativeItem, Player } from './types.ts';

export const NEGATIVE: readonly NegativeItem[] = ['slow', 'shrink', 'fewer', 'reverse', 'hiccup', 'dizzy'];
export const GOLD: readonly GoldItem[] = ['maxspeed', 'maxfire', 'maxbomb'];
export const isNegative = (it: ItemType): it is NegativeItem => (NEGATIVE as readonly string[]).includes(it);
export const isGold = (it: ItemType): it is GoldItem => (GOLD as readonly string[]).includes(it);

/** Boli la care e imun Robo-Mici. */
const DISEASES: readonly ItemType[] = ['slow', 'reverse', 'dizzy', 'hiccup'];

/**
 * Dă unui jucător o abilitate: semnătura personajului rămâne nelimitată; cu `charged`,
 * abilitatea din arenă vine cu încărcări (se adună, până la `CHARGE_MAX`).
 */
function grant(p: Player, ab: ChargeAbility, charged: boolean): void {
  const sig = ab === 'kick' ? p.kit?.kick : ab === 'glove' ? p.kit?.glove : false;
  if (sig) return;
  if (!charged) {
    p[ab] = true;
    p.charges[ab] = 0;
    return;
  }
  if (p[ab] && p.charges[ab] === 0) return; // deja nelimitată
  p[ab] = true;
  p.charges[ab] = Math.min(CHARGE_MAX, p.charges[ab] + CHARGES[ab]);
}

/** Folosește o încărcare (dacă abilitatea are încărcări); la zero abilitatea dispare. */
export function useCharge(s: GameState, p: Player, ab: ChargeAbility): void {
  if (p.charges[ab] <= 0) return;
  if (--p.charges[ab] > 0) return;
  p[ab] = false;
  s.events.push({ type: 'chargeOut', player: p.id, ability: ab });
}

/**
 * Aplică un bonus. Întoarce false dacă personajul nu-l poate lua (imunitate, fără Mănușă/Scut).
 * `charged`: abilitățile vin cu încărcări (`Rules.charges`).
 */
export function applyItem(p: Player, it: ItemType, charged = false): boolean {
  const kit = p.kit;
  if (kit?.immune && DISEASES.includes(it)) return false;
  switch (it) {
    case 'bomb':
      p.bombs = Math.min(p.maxBombs, p.bombs + 1);
      break;
    case 'fire':
      p.range = Math.min(MAX_RANGE, p.range + 1);
      break;
    case 'speed':
      p.speed = Math.min(SPEED_MAX, p.speed + SPEED_STEP);
      break;
    case 'kick':
    case 'remote':
    case 'line':
      grant(p, it, charged);
      break;
    case 'glove':
      if (kit?.noGlove) return false;
      grant(p, 'glove', charged);
      break;
    case 'shield':
      if (kit?.noShield) return false;
      p.shieldT = kit?.shieldPct ? Math.round((SHIELD * kit.shieldPct) / 100) : SHIELD;
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
      p.bombs = p.maxBombs;
      break;
    case 'heart':
      p.hp = Math.min(100, p.hp + HEART_HP);
      break;
    case 'crystal':
      break;
  }
  return true;
}

/** Ce cade dintr-o ladă obișnuită (tabelul din prototip): 42% șansă de drop, din care 17% negative. */
export function rollDrop(rng: RngState, hearts = false): ItemType | null {
  if (nextFloat(rng) >= 0.42) return null;
  if (hearts && nextFloat(rng) < 0.14) return 'heart';
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
