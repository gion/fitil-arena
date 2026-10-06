import { bfs } from './danger.ts';
import { blast, bombAt, idx, tileX, tileY, walkable } from './grid.ts';
import { createRng } from './rng.ts';
import { isTeamMode } from './setup.ts';
import { DIRS, DX, DY } from './types.ts';
import type { GameState, Player } from './types.ts';

/** Bombele cu detonator care nu sunt pe cale să explodeze (mai mult de 2.5s) nu contează. */
const REMOTE_SAFE = 50;

function doomDanger(s: GameState, p: Player): Uint8Array {
  const d = new Uint8Array(s.W * s.H);
  const team = isTeamMode(s.rules) && !s.rules.friendlyFire;
  for (const b of s.bombs) {
    if (b.held !== null || b.fly !== null || (b.remote && b.fuse > REMOTE_SAFE)) continue;
    const owner = s.players[b.owner];
    if (team && owner && owner.team === p.team) continue;
    blast(s, b.x, b.y, b.range, d);
  }
  return d;
}

/**
 * Momentul „bye bye”: jucătorul e în raza unei bombe și nu are nicio cale spre un loc sigur
 * (nici șut, nici mănușă, nici scut). Întoarce id-ul celei mai apropiate bombe (la care se uită trist)
 * sau null dacă mai are scăpare. Funcție pură (nu consumă RNG-ul stării).
 */
export function doomBomb(s: GameState, p: Player): number | null {
  if (!p.alive || p.shieldT > 0 || p.guard > 0 || p.lives > 1 || p.graceT > 0 || p.moving) return null;
  const cx = tileX(p);
  const cy = tileY(p);
  const d = doomDanger(s, p);
  if (!d[idx(s, cx, cy)]) return null;
  const open = (x: number, y: number) => walkable(s, x, y) && s.flame[idx(s, x, y)]! <= 0;
  if (bfs(s, createRng(0), cx, cy, open, (x, y) => !d[idx(s, x, y)]) !== null) return null;
  if (
    p.kick &&
    DIRS.some(
      (dir) => bombAt(s, cx + DX[dir]!, cy + DY[dir]!) && walkable(s, cx + DX[dir]! * 2, cy + DY[dir]! * 2),
    )
  )
    return null;
  if (p.glove && (bombAt(s, cx, cy) || p.carry !== null)) return null;
  let best: number | null = null;
  let bd = Infinity;
  for (const b of s.bombs) {
    if (b.held !== null || b.fly !== null) continue;
    const dd = Math.abs(b.x - cx) + Math.abs(b.y - cy);
    if (dd < bd) {
      bd = dd;
      best = b.id;
    }
  }
  return best;
}

/** Mai e jucătorul în pericol? (pentru anularea momentului dacă scapă totuși, ex. bomba e șutată) */
export function inDoomDanger(s: GameState, p: Player): boolean {
  return p.alive && doomDanger(s, p)[idx(s, tileX(p), tileY(p))] === 1;
}
