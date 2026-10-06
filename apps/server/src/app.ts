import Fastify from 'fastify';
import { TICK_HZ } from '@fitil/sim';
import { registerApi } from './api.ts';
import type { Db } from './db/index.ts';

/** API-ul HTTP. Fără bază de date (`db` lipsă) răspunde doar la `/health`. */
export function buildApp(db?: Db) {
  const app = Fastify({ logger: false });
  // fără cookie-uri (tokenul vine în antet), deci orice origine poate apela API-ul în siguranță
  app.addHook('onRequest', async (req, reply) => {
    void reply
      .header('access-control-allow-origin', '*')
      .header('access-control-allow-headers', 'authorization, content-type')
      .header('access-control-allow-methods', 'GET, POST, PUT, OPTIONS');
    if (req.method === 'OPTIONS') return reply.code(204).send();
  });
  app.get('/health', async () => ({ ok: true, tickHz: TICK_HZ }));
  if (db) registerApi(app, db);
  return app;
}
