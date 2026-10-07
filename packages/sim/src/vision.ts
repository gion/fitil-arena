import { idx, tileX, tileY } from './grid.ts';
import { isTeamMode } from './setup.ts';
import type { GameState, Player } from './types.ts';

/**
 * Tufișuri: jucătorul dintr-un tufiș e ascuns pentru adversarii aflați la mai mult de 1 pătrățel.
 * Fumul (bomba fumigenă) ascunde ce e în el și orbește de departe pe cine e în el. Coechipierii se văd mereu. Un jucător orbit (flashbang) nu vede pe nimeni mai departe de 1 pătrățel.
 * `viewer` null = spectator (vede tot).
 */
export function canSee(s: GameState, viewer: Player | null, target: Player): boolean {
  if (!viewer || viewer === target) return true;
  if (isTeamMode(s.rules) && viewer.team === target.team) return true;
  // Super-ul Fantomei: invizibil pentru adversari, chiar și de aproape
  if (target.hiddenT > 0) return false;
  const near = Math.abs(tileX(viewer) - tileX(target)) + Math.abs(tileY(viewer) - tileY(target)) <= 1;
  if (near) return true;
  if (viewer.blindT > 0) return false;
  // fumul (Umbra): cine e în fum nu vede nimic de departe, iar ce e în fum nu se vede de departe
  if (
    s.smoke[idx(s, tileX(viewer), tileY(viewer))]! > 0 ||
    s.smoke[idx(s, tileX(target), tileY(target))]! > 0
  )
    return false;
  return !s.bush[idx(s, tileX(target), tileY(target))];
}
