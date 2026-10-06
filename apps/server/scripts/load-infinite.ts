/**
 * Test de încărcare pentru modul Infinit (Faza 7): N boți-client conectați la camera `infinite`,
 * fiecare cu `InfView` (decodează tot, ca un client real) și input la 20 Hz. Raportează tick-ul
 * serverului și traficul primit de fiecare client.
 *
 *   pnpm --filter @fitil/server load:inf [--bots 80] [--secs 60] [--crowd] [--url ws://host:port]
 */
import { fork } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Client } from '@colyseus/sdk';
import type { Room } from '@colyseus/sdk';
import { InfView } from '@fitil/net';
import type { Link } from '@fitil/net';
import type { Dir, Input } from '@fitil/sim';

const arg = (name: string, def: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1]! : def;
};
const BOTS = Number(arg('bots', '80'));
const SECS = Number(arg('secs', '60'));
const WARMUP = 5;
/** Toți rămân în grămadă lângă centru (cel mai greu caz pentru trafic). */
const CROWD = process.argv.includes('--crowd');
let url = arg('url', '');

interface StatsMsg {
  type: 'stats';
  rooms: { id: string; ticks: number; avg: number; p95: number; p99: number; max: number }[];
  rss: number;
}

let child: ChildProcess | null = null;
const ask = (type: string) =>
  new Promise<StatsMsg | null>((res) => {
    if (!child) return res(null);
    const on = (m: { type: string }) => {
      if (m.type !== type) return;
      child!.off('message', on);
      res(m as StatsMsg);
    };
    child.on('message', on);
    child.send({ type });
  });

if (!url) {
  const port = 26_000 + Math.floor(Math.random() * 3000);
  child = fork(fileURLToPath(new URL('./load-server.ts', import.meta.url)), [String(port)], {
    execArgv: ['--import', 'tsx'],
    env: { ...process.env, NODE_ENV: 'production' },
  });
  await new Promise<void>((res) =>
    child!.on('message', (m: { type: string }) => m.type === 'ready' && res()),
  );
  url = `ws://localhost:${port}`;
}

interface Bot {
  room: Room;
  view: InfView;
  bytes: number;
  frames: number;
  dir: Dir | null;
  out: Dir;
  t: number;
}

/** Un bot: merge în rafale (cu tendința să se îndepărteze de centru, ca lumea să se întindă) și pune bombe. */
function decide(b: Bot): Input {
  b.t++;
  if (b.t % (10 + ((b.t * 7) % 30)) === 0) {
    const r = Math.random();
    b.dir = r < 0.45 && !CROWD ? b.out : r < 0.85 ? (Math.floor(Math.random() * 4) as Dir) : null;
  }
  return { dir: b.dir, bomb: Math.random() < 1 / 60 ? 1 : 0 };
}

async function connect(i: number): Promise<Bot> {
  const room = await new Client(url).joinOrCreate('infinite', { name: `Bot${i}` });
  const link: Link = {
    send: (type, msg) => room.send(type, msg),
    on: (type, fn) => room.onMessage(type, fn as (m: unknown) => void),
  };
  const view = new InfView(link);
  const b: Bot = { room, view, bytes: 0, frames: 0, dir: null, out: (i % 4) as Dir, t: i };
  // octeții de pe fir (msgpack), înainte de decodare
  const ev = (room as unknown as { connection: { events: { onmessage?: (e: MessageEvent) => void } } })
    .connection.events;
  const orig = ev.onmessage;
  ev.onmessage = (e: MessageEvent) => {
    const d = e.data as ArrayBuffer | string;
    b.bytes += typeof d === 'string' ? d.length : d.byteLength;
    orig?.(e);
  };
  room.onMessage('f', () => {
    b.frames++;
    view.stepView();
  });
  room.send('hello');
  return b;
}

const t0 = Date.now();
const bots: Bot[] = [];
for (let i = 0; i < BOTS; i++) {
  bots.push(await connect(i));
  await new Promise((r) => setTimeout(r, 25));
}
console.log(`${BOTS} boți conectați în ${((Date.now() - t0) / 1000).toFixed(1)}s`);
const timer = setInterval(() => {
  for (const b of bots) b.view.send(decide(b));
}, 50);

await new Promise((r) => setTimeout(r, WARMUP * 1000));
await ask('reset');
for (const b of bots) {
  b.bytes = 0;
  b.frames = 0;
}
const m0 = Date.now();
await new Promise((r) => setTimeout(r, SECS * 1000));
const secs = (Date.now() - m0) / 1000;
const st = await ask('stats');
clearInterval(timer);

const kb = bots.map((b) => b.bytes / secs / 1024).sort((a, b) => a - b);
const fps = bots.map((b) => b.frames / secs);
const rooms = new Map<string, number>();
for (const b of bots) rooms.set(b.room.roomId, (rooms.get(b.room.roomId) ?? 0) + 1);
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const spread = bots.map((b) => {
  const p = b.view.view!.players[b.view.me]!;
  return Math.hypot(p.px / 1000, p.py / 1000);
});

console.log(
  `\n## Infinit — test de încărcare (${BOTS} boți-client${CROWD ? ', înghesuiți' : ''}, ${secs.toFixed(0)}s măsurate după ${WARMUP}s)\n`,
);
console.log(`- instanțe: ${rooms.size} (${[...rooms.values()].join(' + ')} clienți)`);
for (const r of st?.rooms ?? [])
  console.log(
    `- server ${r.id}: ${(r.ticks / secs).toFixed(1)} tick/s · tick mediu ${r.avg.toFixed(2)} ms · p95 ${r.p95.toFixed(2)} ms · p99 ${r.p99.toFixed(2)} ms · max ${r.max.toFixed(1)} ms`,
  );
if (st) console.log(`- memorie server (RSS): ${(st.rss / 1024 / 1024).toFixed(0)} MB`);
console.log(
  `- trafic per client: mediu ${avg(kb).toFixed(2)} KB/s · median ${kb[kb.length >> 1]!.toFixed(2)} KB/s · max ${kb[kb.length - 1]!.toFixed(2)} KB/s`,
);
console.log(`- cadre primite per client: ${avg(fps).toFixed(1)}/s (min ${Math.min(...fps).toFixed(1)})`);
console.log(
  `- distanța de centru la final: medie ${avg(spread).toFixed(0)} · max ${Math.max(...spread).toFixed(0)} pătrățele`,
);

for (const b of bots) await b.room.leave().catch(() => {});
child?.send({ type: 'stop' });
process.exit(0);
