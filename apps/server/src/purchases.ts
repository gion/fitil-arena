import { randomUUID, timingSafeEqual } from 'node:crypto';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { grantProduct, loadProfile, productById } from '@fitil/content';
import type { Profile } from '@fitil/content';
import type { Db } from './db/index.ts';
import { accounts, profiles, purchases } from './db/schema.ts';

/**
 * Plățile reale (Faza 9, D-083). Clientul cumpără prin RevenueCat (SDK-ul nativ) cu `appUserID` = id-ul
 * contului; RevenueCat validează chitanța la Apple/Google și anunță serverul prin webhook. Pentru
 * webhook-uri pierdute sau întârziate (și pentru restaurare), `/purchases/sync` cere lista direct de la
 * API-ul RevenueCat. Tranzacția din store e cheia: aceeași plată nu se acordă de două ori.
 */

export interface PaymentsOpts {
  /** Valoarea antetului `Authorization` setată în RevenueCat pentru webhook (`REVENUECAT_WEBHOOK_AUTH`). */
  webhookAuth?: string;
  /** Cheia secretă REST (`REVENUECAT_SECRET_KEY`), pentru sincronizare. */
  rcSecret?: string;
  /** Plăți simulate (`FAKE_PURCHASES=1`): doar în dezvoltare și teste, niciodată în producție. */
  fake?: boolean;
  fetch?: typeof fetch;
}

export type GrantResult =
  | { status: 'granted'; profile: Profile }
  | { status: 'duplicate' | 'owned' | 'unknown-product' | 'unknown-account' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Acordă un produs o singură dată pe tranzacție (în aceeași tranzacție de bază de date cu profilul). */
export async function grantPurchase(
  db: Db,
  g: { txId: string; accountId: string; product: string; store: string; sandbox: boolean },
): Promise<GrantResult> {
  const pr = productById(g.product);
  if (!pr) return { status: 'unknown-product' };
  if (!UUID.test(g.accountId)) return { status: 'unknown-account' };
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ data: profiles.data })
      .from(profiles)
      .where(eq(profiles.accountId, g.accountId))
      .for('update');
    if (!row) return { status: 'unknown-account' } as const;
    const ins = await tx
      .insert(purchases)
      .values({
        txId: g.txId,
        accountId: g.accountId,
        product: g.product,
        store: g.store,
        sandbox: g.sandbox,
      })
      .onConflictDoNothing()
      .returning({ txId: purchases.txId });
    if (!ins.length) {
      // o tranzacție deja văzută: la un produs unic restaurat pe alt cont (dispozitiv nou), se mută pe contul nou
      const [old] = await tx.select().from(purchases).where(eq(purchases.txId, g.txId));
      if (!old || pr.kind !== 'once' || old.accountId === g.accountId || old.refundedAt)
        return { status: 'duplicate' } as const;
      await tx.update(purchases).set({ accountId: g.accountId }).where(eq(purchases.txId, g.txId));
    }
    const r = grantProduct(loadProfile(row.data), g.product);
    if (!r.ok) return { status: r.why === 'owned' ? 'owned' : 'unknown-product' } as const;
    await tx
      .update(profiles)
      .set({ data: r.profile, updatedAt: sql`now()` })
      .where(eq(profiles.accountId, g.accountId));
    return { status: 'granted', profile: r.profile } as const;
  });
}

/** Rambursare: marchează plata și scoate Gemurile date (fără să coboare sub zero). Obiectele rămân. */
export async function refundPurchase(db: Db, txId: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [p] = await tx
      .update(purchases)
      .set({ refundedAt: sql`now()` })
      .where(and(eq(purchases.txId, txId), isNull(purchases.refundedAt)))
      .returning();
    if (!p) return false;
    const gems = productById(p.product)?.gems ?? 0;
    const [row] = await tx
      .select({ data: profiles.data })
      .from(profiles)
      .where(eq(profiles.accountId, p.accountId))
      .for('update');
    if (row && gems > 0) {
      const prof = loadProfile(row.data);
      await tx
        .update(profiles)
        .set({ data: { ...prof, gems: Math.max(0, prof.gems - gems) }, updatedAt: sql`now()` })
        .where(eq(profiles.accountId, p.accountId));
    }
    return true;
  });
}

const sameSecret = (a: string, b: string): boolean => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

interface RcEvent {
  type?: string;
  app_user_id?: string;
  original_app_user_id?: string;
  aliases?: string[];
  product_id?: string;
  transaction_id?: string;
  store?: string;
  environment?: string;
  cancel_reason?: string;
}

/** Contul din eveniment: primul id care e un cont de-al nostru (RevenueCat poate trimite și alias-uri anonime). */
async function accountOf(db: Db, e: RcEvent): Promise<string | null> {
  const ids = [e.app_user_id, e.original_app_user_id, ...(e.aliases ?? [])].filter(
    (x): x is string => typeof x === 'string' && UUID.test(x),
  );
  for (const id of ids) {
    const [a] = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.id, id));
    if (a) return a.id;
  }
  return null;
}

/**
 * Webhook-ul RevenueCat. Răspunsul 200 înseamnă „primit” (RevenueCat reîncearcă la alt cod), deci și
 * evenimentele ignorate (abonamente, conturi șterse) primesc 200.
 */
export async function handleWebhook(
  db: Db,
  opts: PaymentsOpts,
  auth: string | undefined,
  body: unknown,
): Promise<{ code: number; result: string }> {
  if (!opts.webhookAuth || !auth || !sameSecret(auth, opts.webhookAuth)) return { code: 401, result: 'auth' };
  const e = ((body ?? {}) as { event?: RcEvent }).event;
  if (!e?.type) return { code: 400, result: 'body' };
  if (e.type === 'TEST') return { code: 200, result: 'test' };
  if (e.type === 'CANCELLATION' && e.cancel_reason === 'CUSTOMER_SUPPORT' && e.transaction_id)
    return { code: 200, result: (await refundPurchase(db, e.transaction_id)) ? 'refunded' : 'ignored' };
  if (e.type !== 'NON_RENEWING_PURCHASE' && e.type !== 'INITIAL_PURCHASE')
    return { code: 200, result: 'ignored' };
  if (!e.product_id || !e.transaction_id) return { code: 400, result: 'body' };
  const accountId = await accountOf(db, e);
  if (!accountId) return { code: 200, result: 'unknown-account' };
  const r = await grantPurchase(db, {
    txId: e.transaction_id,
    accountId,
    product: e.product_id,
    store: (e.store ?? 'unknown').toLowerCase(),
    sandbox: e.environment === 'SANDBOX',
  });
  return { code: 200, result: r.status };
}

interface RcNonSub {
  id?: string;
  store_transaction_id?: string;
  store?: string;
  is_sandbox?: boolean;
}

/** Cere de la RevenueCat toate cumpărăturile contului și acordă ce lipsește (webhook pierdut, restaurare). */
export async function syncPurchases(db: Db, opts: PaymentsOpts, accountId: string): Promise<number> {
  if (!opts.rcSecret) return 0;
  const f = opts.fetch ?? fetch;
  const res = await f(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(accountId)}`, {
    headers: { authorization: `Bearer ${opts.rcSecret}` },
  });
  if (!res.ok) throw new Error(`revenuecat ${res.status}`);
  const j = (await res.json()) as { subscriber?: { non_subscriptions?: Record<string, RcNonSub[]> } };
  let n = 0;
  for (const [product, list] of Object.entries(j.subscriber?.non_subscriptions ?? {}))
    for (const t of list) {
      const txId = t.store_transaction_id ?? t.id;
      if (!txId) continue;
      const r = await grantPurchase(db, {
        txId,
        accountId,
        product,
        store: (t.store ?? 'unknown').toLowerCase(),
        sandbox: !!t.is_sandbox,
      });
      if (r.status === 'granted') n++;
    }
  return n;
}

/** Plată simulată (dezvoltare, teste e2e). */
export const fakePurchase = (db: Db, accountId: string, product: string) =>
  grantPurchase(db, { txId: `fake-${randomUUID()}`, accountId, product, store: 'fake', sandbox: true });
