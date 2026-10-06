import { accessOf, defaultProfile, loadProfile } from '@fitil/content';
import type { Access, Profile } from '@fitil/content';
import { DEV_TOOLS, now } from './clock.ts';

/** Cheia din prototip, ca profilul de acolo (monede, personaje) să fie preluat. */
const KEY = 'fitil-profile';
/** Profilurile de test din panoul DEV (doar în build-urile interne). */
const DEV_KEY = 'fitil-dev-profiles';

export interface DevProfile {
  id: string;
  name: string;
  /** Adminul vede și poate folosi tot, fără deblocări. */
  admin: boolean;
  profile: Profile;
}

interface DevStore {
  active: string | null;
  list: DevProfile[];
}

const read = (k: string): unknown => {
  try {
    return JSON.parse(localStorage.getItem(k) ?? 'null');
  } catch {
    return null;
  }
};
const write = (k: string, v: unknown): void => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* stocare indisponibilă: rămâne în memorie */
  }
};

function loadDev(): DevStore {
  const raw = DEV_TOOLS ? (read(DEV_KEY) as DevStore | null) : null;
  if (!raw || !Array.isArray(raw.list)) return { active: null, list: [] };
  return {
    active: raw.active ?? null,
    list: raw.list.map((d) => ({ ...d, admin: !!d.admin, profile: loadProfile(d.profile) })),
  };
}

/**
 * Profilul local (monede, personaje, XP, cosmetice, deblocări). Regulile sunt în `@fitil/content`;
 * aici doar se ține și se salvează. În panoul DEV se poate trece pe un profil de test (jucător nou,
 * admin…) fără să atingi profilul real. În Faza 6 serverul devine sursa de adevăr.
 */
export const store = {
  real: loadProfile(read(KEY)),
  dev: loadDev(),
  get active(): DevProfile | null {
    return this.dev.list.find((d) => d.id === this.dev.active) ?? null;
  },
  get profile(): Profile {
    return this.active?.profile ?? this.real;
  },
  get admin(): boolean {
    return this.active?.admin ?? false;
  },
  get label(): string {
    return this.active?.name ?? 'Player';
  },
  set(p: Profile): void {
    const a = this.active;
    if (a) {
      a.profile = p;
      write(DEV_KEY, this.dev);
    } else {
      this.real = p;
      write(KEY, p);
    }
  },
  /** Nivelul, ziua și rolul — contextul deblocărilor. */
  access(): Access {
    return accessOf(this.profile, today(), this.admin);
  },
  /* ---------- profiluri de test ---------- */
  use(id: string | null): void {
    this.dev.active = id;
    write(DEV_KEY, this.dev);
  },
  addDev(name: string, admin: boolean, profile: Profile = defaultProfile()): DevProfile {
    const d = { id: `${Date.now().toString(36)}${this.dev.list.length}`, name, admin, profile };
    this.dev.list.push(d);
    this.use(d.id);
    return d;
  },
  removeDev(id: string): void {
    this.dev.list = this.dev.list.filter((d) => d.id !== id);
    if (this.dev.active === id) this.dev.active = null;
    write(DEV_KEY, this.dev);
  },
};

/** Ziua curentă (AAAA-LL-ZZ, ora locală) pentru bonusul zilnic, calendar și XP-ul dublu. */
export function today(d = now()): string {
  const z = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}
