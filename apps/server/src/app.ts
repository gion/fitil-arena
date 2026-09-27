import Fastify from 'fastify';
import { TICK_HZ } from '@fitil/sim';

export function buildApp() {
  const app = Fastify({ logger: false });
  app.get('/health', async () => ({ ok: true, tickHz: TICK_HZ }));
  return app;
}
