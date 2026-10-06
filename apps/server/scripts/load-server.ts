/**
 * Serverul de joc pentru testul de încărcare, într-un proces separat (ca boții-client să nu-i fure CPU).
 * Răspunde pe IPC la `stats` (statisticile instanțelor Infinit) și `reset` (golește măsurătorile).
 */
import { buildGameServer } from '../src/game.ts';
import { infStats } from '../src/infinite.ts';

const port = Number(process.argv[2] ?? 2599);
const server = buildGameServer();
await server.listen(port);
process.send?.({ type: 'ready' });

const pct = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))]! : 0;
};

process.on('message', (m: { type: string }) => {
  if (m.type === 'reset') {
    for (const st of infStats.values()) {
      st.tickMs = [];
      st.ticks = 0;
    }
    process.send?.({ type: 'reset' });
  }
  if (m.type === 'stats')
    process.send?.({
      type: 'stats',
      rooms: [...infStats.entries()].map(([id, st]) => ({
        id,
        ticks: st.ticks,
        avg: st.tickMs.reduce((a, b) => a + b, 0) / Math.max(1, st.tickMs.length),
        p95: pct(st.tickMs, 0.95),
        p99: pct(st.tickMs, 0.99),
        max: Math.max(0, ...st.tickMs),
      })),
      rss: process.memoryUsage().rss,
    });
  if (m.type === 'stop') void server.gracefullyShutdown(false).then(() => process.exit(0));
});
