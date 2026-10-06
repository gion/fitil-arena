import { FLAME, HURT_GRACE, LIFE_GRACE } from './constants.ts';
import { idx, tileX, tileY } from './grid.ts';
import type { DeathCause, GameState, Player } from './types.ts';

/** Aprinde un pătrățel. `via`: 0 bombă pusă, 1 șutată, 2 aruncată, 3 fulger. */
export function addFlame(s: GameState, x: number, y: number, owner: number, via = 0): void {
  const k = idx(s, x, y);
  s.flame[k] = FLAME;
  s.flameOwner[k] = owner;
  s.flameVia[k] = via;
  if (s.items[k] !== 'crystal') s.items[k] = null; // cristalul misiunii nu arde
}

/**
 * O lovitură: cu bară de viață (misiuni) scade viața și dă invulnerabilitate; altfel moarte.
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
  }
  kill(s, p, killerId, cause, via);
}

export function kill(s: GameState, p: Player, killerId: number | null, cause: DeathCause, via = 0): void {
  if (!p.alive) return;
  // o viață în plus (Gugu): supraviețuiește loviturii, clipește invulnerabil (nu și când e strivit)
  if (p.lives > 1 && cause !== 'hurry' && cause !== 'crush') {
    p.lives--;
    p.graceT = LIFE_GRACE;
    s.events.push({ type: 'lifeLost', player: p.id, lives: p.lives });
    return;
  }
  p.alive = false;
  p.deathTick = s.tick;
  p.killerId = killerId;
  p.moving = false;
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
  s.events.push({ type: 'death', player: p.id, killerId, cause, via });
}

/** Scutul absoarbe o lovitură: se consumă și dă 0.8s de invulnerabilitate. Întoarce true dacă a salvat. */
export function shieldSave(s: GameState, p: Player, grace: number): boolean {
  if (p.shieldT <= 0) return false;
  p.shieldT = 0;
  p.graceT = grace;
  s.events.push({ type: 'shieldSaved', player: p.id });
  return true;
}
