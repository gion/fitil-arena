import Fastify from 'fastify';
import { TICK_HZ } from '@fitil/sim';
import { registerApi } from './api.ts';
import type { Db } from './db/index.ts';

/** API-ul HTTP. Fără bază de date (`db` lipsă) răspunde doar la `/health`. */
export interface AppOpts {
  /** Cereri pe minut pe IP (0 = fără limită); `/auth/anon` primește a zecea parte. */
  rate?: number;
}

/** Limitare simplă în memorie (fereastră fixă de un minut). Cu mai multe procese s-ar muta în Redis. */
function rateLimiter(perMin: number) {
  const hits = new Map<string, { n: number; at: number }>();
  return (key: string): boolean => {
    const now = Date.now();
    const h = hits.get(key);
    if (!h || now - h.at > 60_000) {
      hits.set(key, { n: 1, at: now });
      if (hits.size > 10_000) for (const [k, v] of hits) if (now - v.at > 60_000) hits.delete(k);
      return true;
    }
    return ++h.n <= perMin;
  };
}

export function buildApp(db?: Db, opts: AppOpts = {}) {
  const app = Fastify({ logger: false });
  // fără cookie-uri (tokenul vine în antet), deci orice origine poate apela API-ul în siguranță
  app.addHook('onRequest', async (req, reply) => {
    void reply
      .header('access-control-allow-origin', '*')
      .header('access-control-allow-headers', 'authorization, content-type')
      .header('access-control-allow-methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') return reply.code(204).send();
  });
  const rate = opts.rate ?? 240;
  if (rate > 0) {
    const any = rateLimiter(rate);
    const signup = rateLimiter(Math.max(1, Math.floor(rate / 10)));
    app.addHook('onRequest', async (req, reply) => {
      if (req.method === 'OPTIONS') return;
      const ok = req.url.startsWith('/auth/') ? signup(`a${req.ip}`) : any(req.ip);
      if (!ok) return reply.code(429).send({ error: 'rate' });
    });
  }
  app.get('/health', async () => ({ ok: true, tickHz: TICK_HZ, accounts: !!db }));
  if (db) registerApi(app, db);
  return app;
}
