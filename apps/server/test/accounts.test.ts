import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@colyseus/sdk';
import type { Room } from '@colyseus/sdk';
import type { Server } from '@colyseus/core';
import { count, eq } from 'drizzle-orm';
import { botInput } from '@fitil/sim';
import { NetClient } from '@fitil/net';
import type { EndMsg, Link } from '@fitil/net';
import { trophyDelta } from '@fitil/content';
import { buildApp } from '../src/app.ts';
import type { Database } from '../src/db/index.ts';
import { matchPlayers, trophies } from '../src/db/schema.ts';
import { buildGameServer } from '../src/game.ts';
import type { MatchOutcome } from '../src/results.ts';
import { TEST_DB_URL, openTestDb } from './db.ts';

const PORT = 30_000 + Math.floor(Math.random() * 5000);

describe.skipIf(!TEST_DB_URL)('conturi + meci online (Postgres)', () => {
  let d: Database;
  let server: Server;
  let app: ReturnType<typeof buildApp>;
  beforeAll(async () => {
    d = await openTestDb();
    app = buildApp(d.db);
    server = buildGameServer(d.db);
    await server.listen(PORT);
  });
  afterAll(async () => {
    await server.gracefullyShutdown(false);
    await d.close();
  });

  const signup = async () =>
    (await app.inject({ method: 'POST', url: '/auth/anon' })).json() as { id: string; token: string };
  const me = async (t: string) =>
    (await app.inject({ method: 'GET', url: '/me', headers: { authorization: `Bearer ${t}` } })).json() as {
      profile: { coins: number; xp: Record<string, number> };
      trophies: Record<string, number>;
    };

  const link = (room: Room): Link => ({
    send: (type, msg) => room.send(type, msg),
    on: (type, fn) => room.onMessage(type, fn as (m: unknown) => void),
  });
  function play(room: Room) {
    const net = new NetClient(link(room));
    const done = {
      end: new Promise<EndMsg>((r) => (net.onEnd = r)),
      outcome: new Promise<MatchOutcome>((r) => room.onMessage('outcome', r)),
    };
    room.onMessage('f', () => {
      const s = net.predict();
      if (!s || net.me < 0) return;
      s.players[net.me]!.bot = 'normal';
      net.send(botInput(s, net.me));
      net.stepView();
    });
    room.send('hello');
    return done;
  }

  it(
    'un meci online între două conturi scrie trofeele, recompensele și istoricul (doar serverul)',
    { timeout: 60_000 },
    async () => {
      const a = await signup();
      const b = await signup();
      // pornesc de la 100 de trofee cu Bubu, ca pierderea să se vadă (altfel plafonul de 0)
      for (const x of [a, b])
        await d.db.insert(trophies).values({ accountId: x.id, ch: 'bubu', trophies: 100 });
      const url = `ws://localhost:${PORT}`;
      const opts = { mode: 'ffa', tickMs: 4, waitMs: 400, ch: 'bubu', bracket: 0 };
      const ra = await new Client(url).joinOrCreate('quick', { ...opts, token: a.token, name: 'Ana' });
      const rb = await new Client(url).joinOrCreate('quick', { ...opts, token: b.token, name: 'Bob' });
      expect(rb.roomId).toBe(ra.roomId);
      const pa = play(ra);
      const pb = play(rb);
      const [oa, ob] = await Promise.all([pa.outcome, pb.outcome]);
      await Promise.all([pa.end, pb.end]);
      for (const [o, x] of [
        [oa, a],
        [ob, b],
      ] as const) {
        expect(o.trophyDelta).toBe(trophyDelta('ffa', { place: o.place, won: o.won }, 100));
        expect(o.trophies).toBe(100 + o.trophyDelta);
        expect(o.coins).toBeGreaterThanOrEqual(5);
        const m = await me(x.token);
        expect(m.trophies.bubu).toBe(o.trophies);
        expect(m.profile.coins).toBe(100 + o.coins);
        expect(m.profile.xp.bubu).toBe(o.xp);
      }
      expect([oa.place, ob.place].every((p) => p >= 1 && p <= 4)).toBe(true);
      expect(oa.place).not.toBe(ob.place);
      const [n] = await d.db.select({ n: count() }).from(matchPlayers);
      expect(n!.n).toBe(2);
      const rows = await d.db.select().from(matchPlayers).where(eq(matchPlayers.accountId, a.id));
      expect(rows[0]).toMatchObject({ place: oa.place, trophyDelta: oa.trophyDelta });
      await Promise.all([ra.leave(), rb.leave()]);
    },
  );

  it('token greșit sau treaptă greșită → refuz; vizitatorii pot intra, dar nu primesc nimic', async () => {
    const url = `ws://localhost:${PORT}`;
    const base = { mode: 'vs', tickMs: 4, waitMs: 60_000, bracket: 0 };
    await expect(new Client(url).joinOrCreate('quick', { ...base, token: 'x'.repeat(64) })).rejects.toThrow();
    const a = await signup();
    await d.db.insert(trophies).values({ accountId: a.id, ch: 'bubu', trophies: 700 });
    // treapta reală a contului e 2: cine cere treapta 0 e refuzat, cine o cere corect intră
    await expect(
      new Client(url).joinOrCreate('quick', { ...base, token: a.token, ch: 'bubu', name: 'Ana' }),
    ).rejects.toThrow(/bracket/i);
    const room = await new Client(url).joinOrCreate('quick', {
      ...base,
      bracket: 2,
      token: a.token,
      ch: 'bubu',
      name: 'Ana',
    });
    await room.leave();
    const guest = await new Client(url).joinOrCreate('quick', { ...base, name: 'Vizitator' });
    await guest.leave();
  });
});
