import { FLAME } from './constants.ts';
import { idx, tileX, tileY } from './grid.ts';
import type { DeathCause, GameState, Player } from './types.ts';

/** Aprinde un pătrățel. `via`: 0 bombă pusă, 1 șutată, 2 aruncată, 3 fulger. */
export function addFlame(s: GameState, x: number, y: number, owner: number, via = 0): void {
  const k = idx(s, x, y);
  s.flame[k] = FLAME;
  s.flameOwner[k] = owner;
  s.flameVia[k] = via;
  s.items[k] = null;
}

export function kill(s: GameState, p: Player, killerId: number | null, cause: DeathCause, via = 0): void {
  if (!p.alive) return;
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
