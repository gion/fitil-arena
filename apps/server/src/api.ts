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
  buyThemeFor,
  buyCoinsFor,
  buyOfferFor,
  buyPremiumFor,
  claimAllFor,
  claimTierFor,
  claimOffline,
  deleteAccount,
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
import { fakePurchase, handleWebhook, syncPurchases } from './purchases.ts';
import type { PaymentsOpts } from './purchases.ts';

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
export function registerApi(app: FastifyInstance, db: Db, payments: PaymentsOpts = {}): void {
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

  app.post('/themes/buy', async (req, reply) => {
    const id = await auth(req);
    if (!id) return reply.code(401).send({ error: 'auth' });
    const t = (req.body as { id?: unknown } | null)?.id;
    if (typeof t !== 'string') return reply.code(400).send({ error: 'id' });
    return answer(reply, await buyThemeFor(db, id, t));
  });

  /* ---------- Faza 9: battle pass, magazinul zilnic, Gemuri, plăți ---------- */

  const idBody = (req: FastifyRequest): string | null => {
    const v = (req.body as { id?: unknown } | null)?.id;
    return typeof v === 'string' ? v : null;
  };

  app.post('/pass/claim', async (req, reply) => {
    const id = await auth(req);
    if (!id) return reply.code(401).send({ error: 'auth' });
    const b = (req.body ?? {}) as { track?: unknown; tier?: unknown };
    if ((b.track !== 'free' && b.track !== 'premium') || typeof b.tier !== 'number')
      return reply.code(400).send({ error: 'body' });
    return answer(reply, await claimTierFor(db, id, b.track, b.tier));
  });

  app.post('/pass/claim-all', async (req, reply) => {
    const id = await auth(req);
    if (!id) return reply.code(401).send({ error: 'auth' });
    return answer(reply, await claimAllFor(db, id));
  });

  app.post('/pass/premium', async (req, reply) => {
    const id = await auth(req);
    if (!id) return reply.code(401).send({ error: 'auth' });
    return answer(reply, await buyPremiumFor(db, id));
  });

  app.post('/offers/buy', async (req, reply) => {
    const id = await auth(req);
    if (!id) return reply.code(401).send({ error: 'auth' });
    const item = idBody(req);
    if (!item) return reply.code(400).send({ error: 'id' });
    return answer(reply, await buyOfferFor(db, id, item));
  });

  app.post('/gems/coins', async (req, reply) => {
    const id = await auth(req);
    if (!id) return reply.code(401).send({ error: 'auth' });
    const pack = idBody(req);
    if (!pack) return reply.code(400).send({ error: 'id' });
    return answer(reply, await buyCoinsFor(db, id, pack));
  });

  /** Ce poate face clientul cu plățile pe serverul ăsta. */
  app.get('/purchases/config', async () => ({ fake: !!payments.fake, sync: !!payments.rcSecret }));

  /** După o cumpărare sau la „Restore purchases”: acordă ce a validat RevenueCat și încă lipsește. */
  app.post('/purchases/sync', async (req, reply) => {
    const id = await auth(req);
    if (!id) return reply.code(401).send({ error: 'auth' });
    if (!payments.rcSecret) return reply.code(503).send({ error: 'payments' });
    const granted = await syncPurchases(db, payments, id).catch(() => null);
    if (granted === null) return reply.code(502).send({ error: 'store' });
    return { ok: true, granted, profile: await getProfile(db, id) };
  });

  app.post('/webhooks/revenuecat', async (req, reply) => {
    const r = await handleWebhook(db, payments, req.headers.authorization, req.body);
    return reply.code(r.code).send({ result: r.result });
  });

  if (payments.fake)
    app.post('/purchases/fake', async (req, reply) => {
      const id = await auth(req);
      if (!id) return reply.code(401).send({ error: 'auth' });
      const product = idBody(req);
      if (!product) return reply.code(400).send({ error: 'id' });
      const r = await fakePurchase(db, id, product);
      return r.status === 'granted'
        ? { ok: true, profile: r.profile }
        : reply.code(409).send({ ok: false, why: r.status });
    });

  /** Recompensa unui meci offline (cu boți), cu plafon zilnic; meciurile online le scrie camera. */
  app.post('/rewards/offline', async (req, reply) => {
    const id = await auth(req);
    if (!id) return reply.code(401).send({ error: 'auth' });
    const r = await claimOffline(db, id, req.body);
    if (!r.ok) return reply.code(429).send({ ok: false, why: r.why });
    return { ok: true, coins: r.rewards.coins, xp: r.rewards.xp, profile: r.rewards.profile };
  });

  /** Ștergerea contului și a tuturor datelor lui (GDPR). */
  app.delete('/me', async (req, reply) => {
    const id = await auth(req);
    if (!id) return reply.code(401).send({ error: 'auth' });
    await deleteAccount(db, id);
    return reply.code(204).send();
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
