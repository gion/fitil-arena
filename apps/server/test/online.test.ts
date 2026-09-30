import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@colyseus/sdk';
import type { Room } from '@colyseus/sdk';
import type { Server } from '@colyseus/core';
import { botInput, hashState } from '@fitil/sim';
import { NetClient, lagLink } from '@fitil/net';
import type { EndMsg, LobbyMsg, Link, RoomCfg } from '@fitil/net';
import { buildGameServer } from '../src/game.ts';

const PORT = 25_000 + Math.floor(Math.random() * 5000);
let server: Server;

beforeAll(async () => {
  server = buildGameServer();
  await server.listen(PORT);
});
afterAll(async () => {
  await server.gracefullyShutdown(false);
});

const roomLink = (room: Room): Link => ({
  send: (type, msg) => room.send(type, msg),
  on: (type, fn) => room.onMessage(type, fn as (m: unknown) => void),
});

interface Bot {
  room: Room;
  net: NetClient;
  frames: number;
  end: Promise<EndMsg>;
}

/** Un client headless: NetClient + un input la fiecare cadru primit. */
function headless(room: Room, lag = false): Bot {
  room.reconnection.minUptime = 0;
  // latența e scalată la tick-ul de test (4 ms): 12 ms ≈ 3 tick-uri ≈ 150 ms în timp real
  const net = new NetClient(
    lag ? lagLink(roomLink(room), { rtt: 12, jitter: 4, loss: 0.02 }) : roomLink(room),
  );
  const bot: Bot = { room, net, frames: 0, end: new Promise((res) => (net.onEnd = res)) };
  room.onMessage('f', () => {
    bot.frames++;
    // „omul” joacă cu AI-ul unui bot, pe starea prezisă (ce ar vedea pe ecran)
    const s = net.predict();
    if (!s || net.me < 0) return;
    s.players[net.me]!.bot = 'normal';
    net.send(botInput(s, net.me));
    net.stepView();
  });
  return bot;
}

async function waitFor(cond: () => boolean, ms = 5000): Promise<void> {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > ms) throw new Error('timeout');
    await new Promise((r) => setTimeout(r, 10));
  }
}

async function match(cfg: Partial<RoomCfg>, opts: { lag?: boolean; drop?: boolean } = {}) {
  const url = `ws://localhost:${PORT}`;
  const first = await new Client(url).create('arena', { name: 'Ana', tickMs: 4 });
  const code = first.roomId;
  expect(code).toMatch(/^[A-HJ-NP-Z]{4}$/);
  const bots = [headless(first)];
  for (const [i, name] of ['Bob', 'Cip', 'Dan'].entries())
    bots.push(headless(await new Client(url).joinById(code, { name }), opts.lag && i === 1));
  await waitFor(() => bots[0]!.net.lobby?.seats.length === 4);
  const lobby = bots[0]!.net.lobby as LobbyMsg;
  expect(lobby.seats.map((s) => s.name)).toEqual(['Ana', 'Bob', 'Cip', 'Dan']);
  expect(lobby.host).toBe(first.sessionId);

  first.send('cfg', cfg);
  await waitFor(() => bots[0]!.net.lobby?.cfg.mode === (cfg.mode ?? 'ffa'));
  first.send('start', { aspect: 1.6 });
  await waitFor(() => bots.every((b) => b.frames > 0));

  if (opts.drop) {
    // conexiunea clientului 3 cade la mijlocul meciului și revine singură (reconectare automată)
    await waitFor(() => bots[3]!.frames > 200, 20_000);
    bots[3]!.room.connection.close(4010, 'test drop');
    await waitFor(() => bots[3]!.net.snaps >= 2, 10_000);
  }

  const ends = await Promise.all(bots.map((b) => b.end));
  await new Promise((r) => setTimeout(r, 300)); // clientul cu latență mai primește ultimele cadre
  return { bots, ends };
}

describe('online: 4 clienți headless pe serverul local', () => {
  it('meci complet FFA, fără desync: hash-urile coincid la final', { timeout: 60_000 }, async () => {
    const { bots, ends } = await match({ mode: 'ffa', bots: 'hard' }, { lag: true });
    const h = ends[0]!.h;
    console.log(`meci: ${ends[0]!.t} tick-uri`);
    for (const b of bots) {
      expect(b.net.desyncs).toBe(0);
      expect(hashState(b.net.auth)).toBe(h);
    }
    expect(new Set(ends.map((e) => e.h)).size).toBe(1);
    await Promise.all(bots.map((b) => b.room.leave()));
  });

  it('pe echipe, cu o reconectare la mijlocul meciului', { timeout: 60_000 }, async () => {
    const { bots, ends } = await match({ mode: 'team3', bots: 'normal' }, { drop: true });
    const h = ends[0]!.h;
    console.log(`meci: ${ends[0]!.t} tick-uri`);
    for (const b of bots) {
      expect(b.net.desyncs).toBe(0);
      expect(hashState(b.net.auth)).toBe(h);
    }
    expect(bots[3]!.net.snaps).toBeGreaterThanOrEqual(2);
    await Promise.all(bots.map((b) => b.room.leave()));
  });

  it('cod greșit → refuz', async () => {
    await expect(new Client(`ws://localhost:${PORT}`).joinById('ZZZZ', {})).rejects.toThrow();
  });
});
