/**
 * Test de fum pe un server pornit (local sau de producție): API-ul răspunde, doi clienți intră
 * în aceeași cameră prin cod, joacă ~15s și nu apare niciun desync.
 * `pnpm --filter @fitil/server smoke wss://play.example.com https://api.example.com`
 */
import { Client } from '@colyseus/sdk';
import type { Room } from '@colyseus/sdk';
import { botInput } from '@fitil/sim';
import { NetClient } from '@fitil/net';

const game = process.argv[2] ?? 'ws://localhost:2567';
const api = process.argv[3] ?? 'http://localhost:3000';
const seconds = Number(process.argv[4] ?? 15);

function fail(msg: string): never {
  console.error(`EȘUAT: ${msg}`);
  process.exit(1);
}

async function waitFor(cond: () => boolean, ms: number, what: string): Promise<void> {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > ms) fail(`timeout: ${what}`);
    await new Promise((r) => setTimeout(r, 20));
  }
}

const health = (await fetch(`${api}/health`)
  .then((r) => r.json())
  .catch((e: Error) => fail(`API ${api}: ${e.message}`))) as { ok?: boolean; accounts?: boolean };
if (!health.ok) fail(`API ${api}: răspuns neașteptat ${JSON.stringify(health)}`);
console.log(`API ok (conturi: ${health.accounts ? 'da' : 'nu'})`);

interface Player {
  room: Room;
  net: NetClient;
  frames: number;
}

function play(room: Room): Player {
  const net = new NetClient({
    send: (type, msg) => room.send(type, msg),
    on: (type, fn) => room.onMessage(type, fn as (m: unknown) => void),
  });
  const p: Player = { room, net, frames: 0 };
  room.onMessage('f', () => {
    p.frames++;
    const s = net.predict();
    if (!s || net.me < 0) return;
    s.players[net.me]!.bot = 'normal';
    net.send(botInput(s, net.me));
    net.stepView();
  });
  return p;
}

const t0 = Date.now();
const host = play(
  await new Client(game)
    .create('arena', { name: 'Smoke A' })
    .catch((e: Error) => fail(`${game}: ${e.message}`)),
);
const code = host.room.roomId;
const guest = play(await new Client(game).joinById(code, { name: 'Smoke B' }));
console.log(`camera ${code}: 2 jucători în ${Date.now() - t0} ms`);
await waitFor(() => host.net.lobby?.seats.length === 2, 5000, 'lobby cu 2 locuri');
host.room.send('cfg', { mode: 'ffa', bots: 'normal' });
host.room.send('start', { aspect: 1.6 });
await waitFor(() => host.frames > 0 && guest.frames > 0, 10_000, 'primul cadru');
await new Promise((r) => setTimeout(r, seconds * 1000));

const both = [host, guest];
for (const [i, p] of both.entries())
  console.log(`jucătorul ${i + 1}: ${p.frames} cadre, ${p.net.desyncs} desync`);
await Promise.all(both.map((p) => p.room.leave()));
const minFrames = seconds * 20 * 0.8;
if (both.some((p) => p.frames < minFrames)) fail(`prea puține cadre (minim ${minFrames})`);
if (both.some((p) => p.net.desyncs > 0)) fail('desync');
console.log('OK');
process.exit(0);
