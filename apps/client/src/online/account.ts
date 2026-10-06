import { bracketOf, isRanked } from '@fitil/content';
import type { ModeId, Profile } from '@fitil/content';

/** Adresa API-ului HTTP: `VITE_API_URL` sau același host ca pagina, portul 3000. */
export function apiUrl(): string {
  const env = import.meta.env.VITE_API_URL as string | undefined;
  if (env) return env.replace(/\/$/, '');
  return `${location.protocol}//${location.hostname || 'localhost'}:3000`;
}

const KEY = 'fitil-account';

interface Stored {
  token: string;
  id: string;
}

const read = (): Stored | null => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Stored | null;
    return v && typeof v.token === 'string' ? v : null;
  } catch {
    return null;
  }
};
const write = (v: Stored): void => {
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    /* fără stocare: contul rămâne doar pe sesiunea curentă */
  }
};

/**
 * Contul anonim al dispozitivului (Faza 6): la prima pornire cu server se creează un cont și se preia
 * o dată profilul local. Dacă serverul nu răspunde, jocul merge ca vizitator (offline), fără erori.
 */
export const account = {
  stored: read(),
  /** Trofeele per personaj, ultima valoare cunoscută. */
  trophies: {} as Record<string, number>,

  get token(): string | undefined {
    return this.stored?.token;
  },

  async api<T>(path: string, init: RequestInit = {}): Promise<T | null> {
    try {
      const r = await fetch(apiUrl() + path, {
        ...init,
        headers: {
          'content-type': 'application/json',
          ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
          ...init.headers,
        },
      });
      return r.ok ? ((await r.json()) as T) : null;
    } catch {
      return null;
    }
  },

  /** Creează contul (dacă lipsește) și preia profilul local; întoarce false dacă serverul nu e disponibil. */
  async bootstrap(local: Profile): Promise<boolean> {
    // serverul fără bază de date (sau fără răspuns) nu are conturi: rămânem vizitator, fără cereri în plus
    const health = await this.api<{ accounts?: boolean }>('/health');
    if (!health?.accounts) return false;
    if (!this.stored) {
      const a = await this.api<{ id: string; token: string }>('/auth/anon', { method: 'POST' });
      if (!a) return false;
      this.stored = { id: a.id, token: a.token };
      write(this.stored);
      await this.api('/me/import', { method: 'POST', body: JSON.stringify({ profile: local }) });
    }
    return this.refresh();
  },

  async refresh(): Promise<boolean> {
    const me = await this.api<{ trophies: Record<string, number> }>('/me');
    if (!me) return false;
    this.trophies = me.trophies;
    return true;
  },

  /** Treapta de matchmaking pentru personajul și modul ales (0 pentru modurile neclasate). */
  bracket(ch: string, mode: ModeId): number {
    return isRanked(mode) ? bracketOf(this.trophies[ch] ?? 0) : 0;
  },
};
