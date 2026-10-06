import { bracketOf, isRanked } from '@fitil/content';
import type { MatchSummary, ModeId, Profile } from '@fitil/content';

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

/** O schimbare de profil cerută serverului (cumpărare, echipare, alegere de personaj…). */
export interface Op {
  path: string;
  body: Record<string, unknown>;
}

const CLAIMS = 'fitil-claims';
const claims = (): MatchSummary[] => {
  try {
    const v = JSON.parse(localStorage.getItem(CLAIMS) ?? '[]') as unknown;
    return Array.isArray(v) ? (v as MatchSummary[]).slice(0, 30) : [];
  } catch {
    return [];
  }
};
const saveClaims = (c: MatchSummary[]): void => {
  try {
    localStorage.setItem(CLAIMS, JSON.stringify(c.slice(0, 30)));
  } catch {
    /* fără stocare: recompensele offline fără conexiune se pierd */
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

  /** Contul există și serverul a răspuns: de acum serverul e sursa de adevăr pentru profil (D-067). */
  linked: false,
  /** Cererile de schimbare a profilului merg pe rând, ca ordinea să fie păstrată. */
  chain: Promise.resolve() as Promise<void>,

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

  /** Creează contul (dacă lipsește) și preia profilul local; întoarce profilul de pe server (null dacă nu e disponibil). */
  async bootstrap(local: Profile): Promise<Profile | null> {
    // serverul fără bază de date (sau fără răspuns) nu are conturi: rămânem vizitator, fără cereri în plus
    const health = await this.api<{ accounts?: boolean }>('/health');
    if (!health?.accounts) return null;
    this.linked = false;
    if (!this.stored) {
      const a = await this.api<{ id: string; token: string }>('/auth/anon', { method: 'POST', body: '{}' });
      if (!a) return null;
      this.stored = { id: a.id, token: a.token };
      write(this.stored);
      await this.api('/me/import', { method: 'POST', body: JSON.stringify({ profile: local }) });
    }
    const p = await this.refresh();
    this.linked = p !== null;
    return p;
  },

  /** Reîmprospătează trofeele și întoarce profilul de pe server (sau null fără conexiune). */
  async refresh(): Promise<Profile | null> {
    const me = await this.api<{ trophies: Record<string, number>; profile: Profile }>('/me');
    if (!me) return null;
    this.trophies = me.trophies;
    return me.profile;
  },

  async post(path: string, body: unknown): Promise<{ status: number; data: unknown }> {
    try {
      const r = await fetch(apiUrl() + path, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${this.token}` },
        body: JSON.stringify(body),
      });
      return { status: r.status, data: await r.json().catch(() => null) };
    } catch {
      return { status: 0, data: null };
    }
  },

  /**
   * Trimite schimbările pe rând. Profilul primit de la server îl înlocuiește pe cel local; la refuz sau
   * eroare se aduce profilul de pe server (rollback) și se anunță `reject`.
   */
  enqueue(ops: Op[], adopt: (p: Profile) => void, reject: (why: string) => void): void {
    this.chain = this.chain.then(async () => {
      for (const op of ops) {
        const r = await this.post(op.path, op.body);
        const p = (r.data as { profile?: Profile } | null)?.profile;
        if (r.status >= 200 && r.status < 300 && p) {
          adopt(p);
          continue;
        }
        const srv = await this.refresh();
        if (srv) adopt(srv);
        reject(
          r.status === 0
            ? 'No connection to the server. Your change was not saved.'
            : 'The server refused that change.',
        );
        return;
      }
    });
  },

  /** Recompensa unui meci offline: serverul o calculează (cu plafoane); fără conexiune se ține minte și se reîncearcă. */
  claim(summary: MatchSummary, adopt: (p: Profile) => void): void {
    this.chain = this.chain.then(async () => {
      const r = await this.post('/rewards/offline', summary);
      const p = (r.data as { profile?: Profile } | null)?.profile;
      if (r.status === 200 && p) adopt(p);
      else if (r.status === 0) saveClaims([...claims(), summary]);
    });
  },

  /** Șterge contul și datele de pe server (GDPR); local se uită tokenul. */
  async remove(): Promise<boolean> {
    try {
      const r = await fetch(apiUrl() + '/me', {
        method: 'DELETE',
        headers: { authorization: `Bearer ${this.token}` },
      });
      if (!r.ok) return false;
    } catch {
      return false;
    }
    this.stored = null;
    this.linked = false;
    this.trophies = {};
    try {
      localStorage.removeItem(KEY);
      localStorage.removeItem(CLAIMS);
    } catch {
      /* fără stocare */
    }
    return true;
  },

  /** La pornire: trimite recompensele offline rămase de la ultima sesiune fără conexiune. */
  async flushClaims(adopt: (p: Profile) => void): Promise<void> {
    const list = claims();
    if (!list.length) return;
    saveClaims([]);
    for (const c of list) this.claim(c, adopt);
  },

  /** Treapta de matchmaking pentru personajul și modul ales (0 pentru modurile neclasate). */
  bracket(ch: string, mode: ModeId): number {
    return isRanked(mode) ? bracketOf(this.trophies[ch] ?? 0) : 0;
  },
};
