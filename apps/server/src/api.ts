import type { FastifyInstance, FastifyRequest } from 'fastify';
import { desc, eq, sql } from 'drizzle-orm';
import { SHOP_CATS } from '@fitil/content';
import type { ShopCat } from '@fitil/content';
import { DAILY_MAX_TICKS, dailyChallenge, DAILY_ASPECT, replayDaily } from '@fitil/net';
import type { WireInput } from '@fitil/net';
import {
  accountNames,
  authenticate,
  buyCharFor,
  buyItemFor,
  createAccount,
  equipFor,
  getProfile,
  getTrophies,
  importProfile,
  selectCharFor,
  setName,
  today,
} from './accounts.ts';
import type { Outcome } from './accounts.ts';
import type { Db } from './db/index.ts';
import { accounts, dailyScores } from './db/schema.ts';

const bearer = (req: FastifyRequest): string | undefined => {
  const h = req.headers.authorization;
  return h?.startsWith('Bearer ') ? h.slice(7).trim() : undefined;
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Numele afișat: litere, cifre, spațiu, `_-.`, 2–16 caractere. */
export function cleanAccountName(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const n = v.trim().replace(/\s+/g, ' ');
  return /^[\p{L}\p{N} _.-]{2,16}$/u.test(n) ? n : null;
}

/** Rutele conturilor, profilului, magazinului și provocării zilei. Rezultatele meciurilor NU trec pe aici (le scrie camera). */
export function registerApi(app: FastifyInstance, db: Db): void {
  const auth = async (req: FastifyRequest): Promise<string | null> => authenticate(db, bearer(req));
  const refuse = (r: Extract<Outcome, { ok: false }>) => ({ ok: false, why: r.why });

  app.post('/auth/anon', async (_req, reply) => {
    const a = await createAccount(db);
    return reply.code(201).send({ id: a.id, token: a.token, profile: a.profile });
  });

  app.get('/me', async (req, reply) => {
    const id = await auth(req);
    if (!id) return reply.code(401).send({ error: 'auth' });
    const [acc] = await db.select({ name: accounts.name }).from(accounts).where(eq(accounts.id, id));
    const [profile, tr] = await Promise.all([getProfile(db, id), getTrophies(db, id)]);
    return { id, name: acc?.name ?? 'Player', profile, trophies: tr };
  });

  app.put('/me/name', async (req, reply) => {
    const id = await auth(req);
    if (!id) return reply.code(401).send({ error: 'auth' });
    const name = cleanAccountName((req.body as { name?: unknown } | null)?.name);
    if (!name) return reply.code(400).send({ error: 'name' });
    await setName(db, id, name);
    return { name };
  });

  /** Profilul local, o singură dată, la prima conectare. */
  app.post('/me/import', async (req, reply) => {
    const id = await auth(req);
    if (!id) return reply.code(401).send({ error: 'auth' });
    const r = await importProfile(db, id, (req.body as { profile?: unknown } | null)?.profile);
    return r.ok ? { ok: true, profile: r.profile } : reply.code(409).send(refuse(r));
  });

  const answer = async (reply: { code(n: number): { send(b: unknown): unknown } }, r: Outcome) =>
    r.ok ? { ok: true, profile: r.profile } : reply.code(409).send(refuse(r));

  app.post('/shop/buy', async (req, reply) => {
    const id = await auth(req);
    if (!id) return reply.code(401).send({ error: 'auth' });
    const item = (req.body as { id?: unknown } | null)?.id;
    if (typeof item !== 'string') return reply.code(400).send({ error: 'id' });
    return answer(reply, await buyItemFor(db, id, item));
  });

  app.post('/shop/equip', async (req, reply) => {
    const id = await auth(req);
    if (!id) return reply.code(401).send({ error: 'auth' });
    const b = (req.body ?? {}) as { cat?: unknown; id?: unknown };
    if (!SHOP_CATS.includes(b.cat as ShopCat) || (b.id !== null && typeof b.id !== 'string'))
      return reply.code(400).send({ error: 'body' });
    return answer(reply, await equipFor(db, id, b.cat as ShopCat, b.id as string | null));
  });

  app.post('/chars/buy', async (req, reply) => {
    const id = await auth(req);
    if (!id) return reply.code(401).send({ error: 'auth' });
    const ch = (req.body as { id?: unknown } | null)?.id;
    if (typeof ch !== 'string') return reply.code(400).send({ error: 'id' });
    return answer(reply, await buyCharFor(db, id, ch));
  });

  app.post('/chars/select', async (req, reply) => {
    const id = await auth(req);
    if (!id) return reply.code(401).send({ error: 'auth' });
    const ch = (req.body as { id?: unknown } | null)?.id;
    if (typeof ch !== 'string') return reply.code(400).send({ error: 'id' });
    return answer(reply, await selectCharFor(db, id, ch));
  });

  /* ---------- provocarea zilei ---------- */

  app.get('/daily', async () => ({
    ...dailyChallenge(today()),
    aspect: DAILY_ASPECT,
    maxTicks: DAILY_MAX_TICKS,
  }));

  /** Scorul se verifică: serverul reia rularea din input-uri (simularea e deterministă). */
  app.post('/daily/score', { bodyLimit: 512 * 1024 }, async (req, reply) => {
    const id = await auth(req);
    if (!id) return reply.code(401).send({ error: 'auth' });
    const inputs = (req.body as { inputs?: unknown } | null)?.inputs;
    if (!Array.isArray(inputs) || inputs.length > DAILY_MAX_TICKS || inputs.some((w) => !Array.isArray(w)))
      return reply.code(400).send({ error: 'inputs' });
    const day = today();
    const r = replayDaily(dailyChallenge(day), inputs as WireInput[]);
    if (!r.done) return reply.code(422).send({ ok: false, why: 'not-completed' });
    // păstrează cel mai bun rezultat al zilei
    await db
      .insert(dailyScores)
      .values({ day, accountId: id, ticks: r.ticks })
      .onConflictDoUpdate({
        target: [dailyScores.day, dailyScores.accountId],
        set: { ticks: sql`least(${dailyScores.ticks}, ${r.ticks})` },
      });
    const [mine] = await db
      .select({ ticks: dailyScores.ticks })
      .from(dailyScores)
      .where(sql`${dailyScores.day} = ${day} and ${dailyScores.accountId} = ${id}`);
    return { ok: true, ticks: mine?.ticks ?? r.ticks };
  });

  app.get('/daily/leaderboard', async (req, reply) => {
    const q = (req.query as { day?: string }).day ?? today();
    if (!DAY.test(q)) return reply.code(400).send({ error: 'day' });
    const rows = await db
      .select({ accountId: dailyScores.accountId, ticks: dailyScores.ticks })
      .from(dailyScores)
      .where(eq(dailyScores.day, q))
      .orderBy(dailyScores.ticks, desc(dailyScores.createdAt))
      .limit(20);
    const names = await accountNames(
      db,
      rows.map((r) => r.accountId),
    );
    return {
      day: q,
      top: rows.map((r, i) => ({ rank: i + 1, name: names.get(r.accountId) ?? 'Player', ticks: r.ticks })),
    };
  });
}
