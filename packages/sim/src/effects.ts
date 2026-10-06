import {
  CHARGE_HIT,
  FLAME,
  GUARD_GRACE,
  HURT_GRACE,
  LIFE_GRACE,
  SUPER_FULL,
  TRAP_LIFE,
} from './constants.ts';
import { idx, tileX, tileY } from './grid.ts';
import type { DeathCause, GameState, Player } from './types.ts';

/**
 * Aprinde un pătrățel. `via`: 0 bombă pusă, 1 șutată, 2 aruncată, 3 fulger.
 * `kind` (`FLAME_KIND`): o flacără care omoară nu e înlocuită de una care nu omoară (gheață, flashbang).
 */
export function addFlame(s: GameState, x: number, y: number, owner: number, via = 0, kind = 0): void {
  const k = idx(s, x, y);
  const lethal = (v: number) => v === 0 || v === 3;
  if (s.flame[k]! > 0 && lethal(s.flameKind[k]!) && !lethal(kind)) return;
  s.flame[k] = FLAME;
  s.flameOwner[k] = owner;
  s.flameVia[k] = via;
  s.flameKind[k] = kind;
  if (s.items[k] !== 'crystal' && lethal(kind)) s.items[k] = null; // cristalul misiunii nu arde
  if (s.bush[k]) {
    s.bush[k] = 0;
    s.events.push({ type: 'bushBurn', x, y });
  }
}

/** Încarcă Super-ul (procentul personajului). */
export function addCharge(p: Player | undefined, amount: number): void {
  if (!p?.hero || !p.alive) return;
  p.charge = Math.min(SUPER_FULL, p.charge + Math.floor((amount * p.hero.superPct) / 100));
}

/**
 * O lovitură: cu bară de viață (misiuni) scade viața și dă invulnerabilitate; cu mai multe inimi
 * pierzi o inimă (1.5s invulnerabil); altfel moarte.
 */
export function damage(
  s: GameState,
  p: Player,
  amount: number,
  killerId: number | null,
  cause: DeathCause,
  via = 0,
): void {
  if (s.rules.health && p.bot === null) {
    p.hp = Math.max(0, p.hp - amount);
    p.graceT = HURT_GRACE;
    s.events.push({ type: 'hurt', player: p.id, amount, hp: p.hp });
    if (p.hp > 0) return;
  } else if (p.lives > 1) {
    p.lives--;
    p.graceT = LIFE_GRACE;
    p.frozenT = 0;
    s.events.push({ type: 'lifeLost', player: p.id, lives: p.lives });
    if (killerId !== null && killerId !== p.id) addCharge(s.players[killerId], CHARGE_HIT);
    return;
  }
  kill(s, p, killerId, cause, via);
}

export function kill(s: GameState, p: Player, killerId: number | null, cause: DeathCause, via = 0): void {
  if (!p.alive) return;
  p.alive = false;
  p.deathTick = s.tick;
  p.killerId = killerId;
  p.moving = false;
  p.frozenT = 0;
  p.blindT = 0;
  p.toxT = 0;
  if (p.carry !== null) {
    const b = s.bombs.find((o) => o.id === p.carry);
    if (b) {
      b.held = null;
      b.x = tileX(p);
      b.y = tileY(p);
      b.fuse = Math.min(b.fuse, 2);
    }
    p.carry = null;
  }
  if (killerId !== null && killerId !== p.id) addCharge(s.players[killerId], CHARGE_HIT);
  if (p.hero?.passive === 'trap') {
    const x = tileX(p);
    const y = tileY(p);
    s.traps.push({ x, y, owner: p.id, t: TRAP_LIFE });
    s.events.push({ type: 'trapSet', x, y, owner: p.id });
  }
  s.events.push({ type: 'death', player: p.id, killerId, cause, via });
}

/**
 * Scutul absoarbe o lovitură: se consumă și dă 0.8s de invulnerabilitate. Scutul pasiv (o lovitură pe meci)
 * se folosește după cel temporar. Întoarce true dacă a salvat.
 */
export function shieldSave(s: GameState, p: Player, grace: number): boolean {
  if (p.shieldT > 0) {
    p.shieldT = 0;
    p.graceT = grace;
  } else if (p.guard > 0) {
    // șalul dă doar o clipă de fugă (mai scurtă decât flacăra)
    p.guard--;
    p.graceT = Math.min(grace, GUARD_GRACE);
  } else return false;
  s.events.push({ type: 'shieldSaved', player: p.id });
  return true;
}
