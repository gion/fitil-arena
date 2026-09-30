import { loadProfile } from '@fitil/content';
import type { Profile } from '@fitil/content';

/** Cheia din prototip, ca profilul de acolo (monede, personaje) să fie preluat. */
const KEY = 'fitil-profile';

function load(): Profile {
  try {
    return loadProfile(JSON.parse(localStorage.getItem(KEY) ?? 'null'));
  } catch {
    return loadProfile(null);
  }
}

/**
 * Profilul local (monede, personaje, XP, cosmetice). Regulile sunt în `@fitil/content` (economy.ts);
 * aici doar se ține și se salvează. În Faza 6 serverul devine sursa de adevăr.
 */
export const store = {
  profile: load(),
  set(p: Profile): void {
    this.profile = p;
    try {
      localStorage.setItem(KEY, JSON.stringify(p));
    } catch {
      /* stocare indisponibilă: profilul rămâne în memorie */
    }
  },
};

/** Ziua curentă (AAAA-LL-ZZ, ora locală) pentru bonusul zilnic și XP-ul dublu. */
export function today(d = new Date()): string {
  const z = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}
