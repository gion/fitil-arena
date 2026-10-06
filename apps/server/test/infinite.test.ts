import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@colyseus/sdk';
import type { Room } from '@colyseus/sdk';
import type { Server } from '@colyseus/core';
import { InfView } from '@fitil/net';
import type { Link } from '@fitil/net';
import { buildGameServer } from '../src/game.ts';
import { infStats } from '../src/infinite.ts';

const PORT = 25_000 + Math.floor(Math.random() * 5000);
let server: Server;

beforeAll(async () => {
  server = buildGameServer();
  await server.listen(PORT);
});
afterAll(async () => {
  await server.gracefullyShutdown(false);
});

async function waitFor(cond: () => boolean, ms = 5000): Promise<void> {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > ms) throw new Error('timeout');
    await new Promise((r) => setTimeout(r, 10));
  }
}

/** Un client headless: InfView pe cameră, aplică fiecare cadru primit. */
async function join(opts: Record<string, unknown> = {}): Promise<{ room: Room; view: InfView }> {
  const room = await new Client(`ws://localhost:${PORT}`).joinOrCreate('infinite', opts);
  const link: Link = {
    send: (type, msg) => room.send(type, msg),
    on: (type, fn) => room.onMessage(type, fn as (m: unknown) => void),
  };
  const view = new InfView(link);
  room.onMessage('f', () => view.stepView());
  room.send('hello');
  await waitFor(() => view.view !== null && view.view.inf!.keys.length > 1);
  return { room, view };
}

describe('camera infinite', () => {
  it('doi oameni în aceeași lume se văd și văd lumea din jur', async () => {
    const a = await join({ name: 'Ana', seed: 42 });
    const b = await join({ name: 'Bob' });
    expect(a.room.roomId).toBe(b.room.roomId);
    await waitFor(() => !!a.view.view!.players[b.view.me] && !a.view.view!.players[b.view.me]!.out);
    expect(a.view.slots[b.view.me]!.name).toBe('Bob');
    expect(b.view.slots[a.view.me]!.name).toBe('Ana');
    // mers: poziția ajunge la celălalt
    const before = a.view.view!.players[a.view.me]!.px + a.view.view!.players[a.view.me]!.py;
    const iv = setInterval(() => a.view.send({ dir: 3 }), 50);
    await waitFor(() => {
      const p = b.view.view!.players[a.view.me]!;
      return p.px + p.py !== before;
    });
    clearInterval(iv);
    await waitFor(() => a.view.board !== null, 3000);
    expect(a.view.board!.n).toBe(2);
    expect(infStats.get(a.room.roomId)!.ticks).toBeGreaterThan(10);
    await a.room.leave();
    await waitFor(() => b.view.view!.players[a.view.me]!.out);
    await b.room.leave();
  });

  it('o instanță plină deschide alta (shard)', async () => {
    const first = await join({ max: 2 });
    const second = await join();
    expect(second.room.roomId).toBe(first.room.roomId);
    const third = await join();
    expect(third.room.roomId).not.toBe(first.room.roomId);
    for (const c of [first, second, third]) await c.room.leave();
  });
});
