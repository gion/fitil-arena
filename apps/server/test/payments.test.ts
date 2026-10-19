import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TIER_XP, dailyOffers, seasonAt } from '@fitil/content';
import { eq } from 'drizzle-orm';
import { buildApp } from '../src/app.ts';
import type { Database } from '../src/db/index.ts';
import { profiles } from '../src/db/schema.ts';
import { today } from '../src/accounts.ts';
import { TEST_DB_URL, openTestDb } from './db.ts';

const SECRET = 'Bearer test-webhook-secret';

describe.skipIf(!TEST_DB_URL)('Faza 9: pass, magazin zilnic, plăți', () => {
  let d: Database;
  let app: ReturnType<typeof buildApp>;
  let rcAnswer: unknown = {};
  beforeAll(async () => {
    d = await openTestDb();
    app = buildApp(d.db, {
      rate: 0,
      payments: {
        fake: true,
        webhookAuth: SECRET,
        rcSecret: 'sk_test',
        fetch: (async () => new Response(JSON.stringify(rcAnswer))) as typeof fetch,
      },
    });
  });
  afterAll(async () => {
    await d.close();
  });

  const signup = async () => {
    const r = await app.inject({ method: 'POST', url: '/auth/anon' });
    return r.json() as { id: string; token: string };
  };
  const post = (t: string, url: string, payload: unknown = {}) =>
    app.inject({
      method: 'POST',
      url,
      headers: { authorization: `Bearer ${t}` },
      payload: payload as object,
    });
  const profile = async (id: string) =>
    (await d.db.select().from(profiles).where(eq(profiles.accountId, id)))[0]!.data;
  const setProfile = async (id: string, patch: object) =>
    d.db
      .update(profiles)
      .set({ data: { ...(await profile(id)), ...patch } })
      .where(eq(profiles.accountId, id));
  const hook = (event: object, auth = SECRET) =>
    app.inject({
      method: 'POST',
      url: '/webhooks/revenuecat',
      headers: { authorization: auth },
      payload: { event },
    });

  it('webhook: fără secretul corect → 401; evenimentul de test → 200', async () => {
    expect((await hook({ type: 'TEST' }, 'Bearer gresit')).statusCode).toBe(401);
    expect((await hook({ type: 'TEST' })).json()).toEqual({ result: 'test' });
  });

  it('webhook: Gemurile se acordă o singură dată pe tranzacție; rambursarea le scoate', async () => {
    const a = await signup();
    const ev = {
      type: 'NON_RENEWING_PURCHASE',
      app_user_id: a.id,
      product_id: 'gems_550',
      transaction_id: 'GPA.1111',
      store: 'PLAY_STORE',
      environment: 'PRODUCTION',
    };
    expect((await hook(ev)).json()).toEqual({ result: 'granted' });
    expect((await hook(ev)).json()).toEqual({ result: 'duplicate' });
    expect((await profile(a.id)).gems).toBe(550);
    await setProfile(a.id, { gems: 100 }); // a cheltuit o parte
    const refund = { type: 'CANCELLATION', cancel_reason: 'CUSTOMER_SUPPORT', transaction_id: 'GPA.1111' };
    expect((await hook(refund)).json()).toEqual({ result: 'refunded' });
    expect((await profile(a.id)).gems).toBe(0);
    expect((await hook(refund)).json()).toEqual({ result: 'ignored' });
  });

  it('webhook: cont necunoscut, produs necunoscut, abonamente → 200 fără efect', async () => {
    const a = await signup();
    const base = { type: 'NON_RENEWING_PURCHASE', transaction_id: 'T2', product_id: 'gems_100' };
    expect((await hook({ ...base, app_user_id: '$RCAnonymousID:abc' })).json()).toEqual({
      result: 'unknown-account',
    });
    expect((await hook({ ...base, app_user_id: a.id, product_id: 'nope' })).json()).toEqual({
      result: 'unknown-product',
    });
    expect((await hook({ type: 'RENEWAL', app_user_id: a.id })).json()).toEqual({ result: 'ignored' });
    // contul vine și din alias-uri
    expect((await hook({ ...base, app_user_id: '$RCAnonymousID:abc', aliases: [a.id] })).json()).toEqual({
      result: 'granted',
    });
  });

  it('sincronizare: acordă ce lipsește; starter pack-ul restaurat pe alt cont se mută acolo', async () => {
    const a = await signup();
    rcAnswer = {
      subscriber: {
        non_subscriptions: {
          starter_pack: [{ id: 'rc1', store_transaction_id: 'ios-77', store: 'app_store', is_sandbox: true }],
          gems_100: [{ id: 'rc2', store_transaction_id: 'ios-78', store: 'app_store' }],
        },
      },
    };
    const s1 = await post(a.token, '/purchases/sync');
    expect(s1.json()).toMatchObject({
      ok: true,
      granted: 2,
      profile: { gems: 400, purchases: ['starter_pack'] },
    });
    expect((await post(a.token, '/purchases/sync')).json()).toMatchObject({ granted: 0 });
    // același cont Apple pe un telefon nou = cont anonim nou
    const b = await signup();
    const s2 = await post(b.token, '/purchases/sync');
    expect(s2.json()).toMatchObject({ granted: 1, profile: { gems: 300, purchases: ['starter_pack'] } });
    expect(s2.json().profile.owned).toContain('x_rocket');
  });

  it('plăți simulate: doar cu FAKE_PURCHASES; starter pack o singură dată', async () => {
    const a = await signup();
    expect((await post(a.token, '/purchases/fake', { id: 'starter_pack' })).statusCode).toBe(200);
    expect((await post(a.token, '/purchases/fake', { id: 'starter_pack' })).json()).toEqual({
      ok: false,
      why: 'owned',
    });
    const real = buildApp(d.db, { rate: 0 });
    const r = await real.inject({
      method: 'POST',
      url: '/purchases/fake',
      headers: { authorization: `Bearer ${a.token}` },
      payload: { id: 'gems_100' },
    });
    expect(r.statusCode).toBe(404);
    expect((await real.inject({ method: 'GET', url: '/purchases/config' })).json()).toEqual({
      fake: false,
      sync: false,
    });
  });

  it('battle pass: premium cu Gemuri, trepte luate o dată, „claim all”', async () => {
    const a = await signup();
    await setProfile(a.id, {
      gems: 520,
      pass: { season: seasonAt(today()).id, xp: TIER_XP * 5, premium: false, claimed: [] },
    });
    expect((await post(a.token, '/pass/claim', { track: 'premium', tier: 1 })).json()).toEqual({
      ok: false,
      why: 'locked',
    });
    const prem = await post(a.token, '/pass/premium');
    expect(prem.json()).toMatchObject({ ok: true, profile: { gems: 20 } });
    expect((await post(a.token, '/pass/claim', { track: 'free', tier: 1 })).statusCode).toBe(200);
    expect((await post(a.token, '/pass/claim', { track: 'free', tier: 1 })).statusCode).toBe(409);
    expect((await post(a.token, '/pass/claim', { track: 'gold', tier: 1 })).statusCode).toBe(400);
    const all = await post(a.token, '/pass/claim-all');
    expect(all.json().profile.pass.claimed).toHaveLength(10);
  });

  it('magazinul zilnic și Gemuri → Fitile', async () => {
    const a = await signup();
    const [o] = dailyOffers(today());
    await setProfile(a.id, { coins: 1000, gems: 60 });
    const buy = await post(a.token, '/offers/buy', { id: o!.item });
    expect(buy.json()).toMatchObject({ ok: true, profile: { coins: 1000 - o!.price } });
    const c = await post(a.token, '/gems/coins', { id: 'coins_s' });
    expect(c.json()).toMatchObject({ ok: true, profile: { gems: 10, coins: 1000 - o!.price + 400 } });
    expect((await post(a.token, '/gems/coins', { id: 'coins_s' })).json()).toEqual({
      ok: false,
      why: 'funds',
    });
  });

  it('importul profilului local nu aduce Gemuri, premium sau exclusive', async () => {
    const a = await signup();
    const local = {
      coins: 50,
      gems: 9999,
      purchases: ['starter_pack'],
      owned: ['c_green', 's1_ember', 'x_rocket'],
      eq: { color: 's1_ember' },
      pass: { season: 's1', xp: 9999, premium: true, claimed: [] },
    };
    const r = await post(a.token, '/me/import', { profile: local });
    expect(r.json().profile).toMatchObject({
      gems: 0,
      purchases: [],
      owned: ['c_green'],
      eq: { color: null },
    });
    expect(r.json().profile.pass.premium).toBe(false);
  });
});
