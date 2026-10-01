import { idx, tileX, tileY } from './grid.ts';
import { isTeamMode } from './setup.ts';
import type { GameState, Player } from './types.ts';

/**
 * Tufișuri: jucătorul dintr-un tufiș e ascuns pentru adversarii aflați la mai mult de 1 pătrățel.
 * Coechipierii se văd mereu. Un jucător orbit (flashbang) nu vede pe nimeni mai departe de 1 pătrățel.
 * `viewer` null = spectator (vede tot).
 */
export function canSee(s: GameState, viewer: Player | null, target: Player): boolean {
  if (!viewer || viewer === target) return true;
  if (isTeamMode(s.rules) && viewer.team === target.team) return true;
  const near = Math.abs(tileX(viewer) - tileX(target)) + Math.abs(tileY(viewer) - tileY(target)) <= 1;
  if (near) return true;
  if (viewer.blindT > 0) return false;
  return !s.bush[idx(s, tileX(target), tileY(target))];
}
