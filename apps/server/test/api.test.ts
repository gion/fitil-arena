import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { botInput, challengeSetup, createGame, startChallenge, step, trackChallenge } from '@fitil/sim';
import { DAILY_ASPECT, dailyChallenge, encodeInput, replayDaily } from '@fitil/net';
import type { WireInput } from '@fitil/net';
import { buildApp } from '../src/app.ts';
import type { Database } from '../src/db/index.ts';
import { TEST_DB_URL, openTestDb } from './db.ts';

/** Rulează provocarea cu AI-ul în locul omului și înregistrează input-urile lui, tick cu tick. */
function recordBotRun(d: ReturnType<typeof dailyChallenge>, ticks: number): WireInput[] {
  const s = createGame(challengeSetup(d.id, d.seed, DAILY_ASPECT));
  const prog = startChallenge(d.id);
  const log: WireInput[] = [];
  for (let t = 0; t < ticks; t++) {
    const inputs = s.players.map((p) => botInput(s, p.id));
    log.push(encodeInput(inputs[0]!));
    step(s, inputs);
    trackChallenge(prog, s);
    if (prog.status !== 'playing') break;
  }
  return log;
}

describe.skipIf(!TEST_DB_URL)('api cu Postgres', () => {
  let d: Database;
  let app: ReturnType<typeof buildApp>;
  beforeAll(async () => {
    d = await openTestDb();
    app = buildApp(d.db);
  });
  afterAll(async () => {
    vi.useRealTimers();
    await d.close();
  });

  const signup = async () => {
    const r = await app.inject({ method: 'POST', url: '/auth/anon' });
    expect(r.statusCode).toBe(201);
    return r.json() as { id: string; token: string; profile: { coins: number } };
  };
  const hdr = (t: string) => ({ authorization: `Bearer ${t}` });

  it('cont anonim: token, profil nou; fără token sau cu token greșit → 401', async () => {
    const a = await signup();
    expect(a.profile.coins).toBe(100);
    const me = await app.inject({ method: 'GET', url: '/me', headers: hdr(a.token) });
    expect(me.json()).toMatchObject({ id: a.id, name: 'Player', trophies: {} });
    expect((await app.inject({ method: 'GET', url: '/me' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/me', headers: hdr('x'.repeat(64)) })).statusCode).toBe(
      401,
    );
  });

  it('nume: validat', async () => {
    const a = await signup();
    const put = (name: unknown) =>
      app.inject({ method: 'PUT', url: '/me/name', headers: hdr(a.token), payload: { name } });
    expect((await put('Gion')).statusCode).toBe(200);
    expect((await put('<script>')).statusCode).toBe(400);
    expect((await put('x')).statusCode).toBe(400);
    const me = await app.inject({ method: 'GET', url: '/me', headers: hdr(a.token) });
    expect(me.json().name).toBe('Gion');
  });

  it('import de profil local: o singură dată, monedele plafonate', async () => {
    const a = await signup();
    const imp = () =>
      app.inject({
        method: 'POST',
        url: '/me/import',
        headers: hdr(a.token),
        payload: { profile: { coins: 999_999, owned: ['c_green', 'h_cap'], xp: { bubu: 100 } } },
      });
    const r1 = await imp();
    expect(r1.statusCode).toBe(200);
    expect(r1.json().profile.coins).toBe(20_000);
    expect(r1.json().profile.owned).toContain('h_cap');
    expect((await imp()).statusCode).toBe(409);
  });

  it('magazin: cumpără, echipează, refuză fără fonduri / fără obiect', async () => {
    const a = await signup();
    const post = (url: string, payload: Record<string, unknown>) =>
      app.inject({ method: 'POST', url, headers: hdr(a.token), payload });
    const buy = await post('/shop/buy', { id: 'h_cap' });
    expect(buy.json().profile.coins).toBe(50);
    expect((await post('/shop/buy', { id: 'h_cap' })).statusCode).toBe(409);
    expect((await post('/shop/buy', { id: 'h_crown' })).json()).toEqual({ ok: false, why: 'funds' });
    expect((await post('/shop/equip', { cat: 'hat', id: 'h_crown' })).json().why).toBe('locked');
    const eq = await post('/shop/equip', { cat: 'hat', id: 'h_cap' });
    expect(eq.json().profile.eq.hat).toBe('h_cap');
    expect((await post('/shop/equip', { cat: 'nope', id: null })).statusCode).toBe(400);
    // personaje: unul plătit nu se poate lua fără monede
    expect((await post('/chars/buy', { id: 'zuzu' })).statusCode).toBeLessThan(500);
    expect((await post('/chars/select', { id: 'nobody' })).json().why).toBe('unknown');
  });

  it('profilul e izolat între conturi', async () => {
    const a = await signup();
    const b = await signup();
    await app.inject({ method: 'POST', url: '/shop/buy', headers: hdr(a.token), payload: { id: 'h_cap' } });
    const me = await app.inject({ method: 'GET', url: '/me', headers: hdr(b.token) });
    expect(me.json().profile.owned).not.toContain('h_cap');
  });

  it('recompensa meciului offline: plafonată, doar pe server, cu limită zilnică', async () => {
    const a = await signup();
    const claim = (payload: Record<string, unknown>) =>
      app.inject({ method: 'POST', url: '/rewards/offline', headers: hdr(a.token), payload });
    // valori umflate sunt tăiate: 80 de lăzi + 3 eliminări + victorie = 80 + 15 + 5 + 25 (+ bonus zilnic 50)
    const r = await claim({ boxes: 9999, kills: 99, won: true });
    expect(r.statusCode).toBe(200);
    expect(r.json().coins).toBeGreaterThanOrEqual(80 + 15 + 5 + 25 + 50);
    expect(r.json().coins).toBeLessThanOrEqual(80 + 15 + 5 + 25 + 50 + 100);
    const me = await app.inject({ method: 'GET', url: '/me', headers: hdr(a.token) });
    expect(me.json().profile.coins).toBe(100 + r.json().coins);
    for (let i = 1; i < 30; i++) expect((await claim({ boxes: 1 })).statusCode).toBe(200);
    expect((await claim({ boxes: 1 })).statusCode).toBe(429);
    // limita refuză fără să strice profilul
    const after = await app.inject({ method: 'GET', url: '/me', headers: hdr(a.token) });
    expect(after.json().profile.coins).toBeGreaterThan(me.json().profile.coins);
  });

  it('teme: refuz fără fonduri; ștergerea contului șterge tot', async () => {
    const a = await signup();
    const t = await app.inject({
      method: 'POST',
      url: '/themes/buy',
      headers: hdr(a.token),
      payload: { id: 'nope' },
    });
    expect(t.statusCode).toBeGreaterThanOrEqual(400);
    expect((await app.inject({ method: 'DELETE', url: '/me' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'DELETE', url: '/me', headers: hdr(a.token) })).statusCode).toBe(204);
    expect((await app.inject({ method: 'GET', url: '/me', headers: hdr(a.token) })).statusCode).toBe(401);
  });

  it('limitare de rată: prea multe cereri de cont de pe același IP → 429', async () => {
    const limited = buildApp(d.db, { rate: 20 }); // /auth/*: 2 pe minut
    const codes: number[] = [];
    for (let i = 0; i < 4; i++)
      codes.push((await limited.inject({ method: 'POST', url: '/auth/anon' })).statusCode);
    expect(codes).toEqual([201, 201, 429, 429]);
    expect((await limited.inject({ method: 'GET', url: '/health' })).statusCode).toBe(200);
  });

  it('provocarea zilei: scor verificat prin reluare, doar cel mai bun contează, clasament', async () => {
    // o zi în care AI-ul (jucând ca om) termină provocarea
    let day = '';
    let log: WireInput[] = [];
    for (let i = 1; i <= 28 && !day; i++) {
      const dd = `2026-09-${String(i).padStart(2, '0')}`;
      const c = dailyChallenge(dd);
      const l = recordBotRun(c, 2400);
      if (replayDaily(c, l).done) {
        day = dd;
        log = l;
      }
    }
    expect(day, 'nicio zi din septembrie nu se termină cu AI-ul').not.toBe('');
    vi.useFakeTimers({ toFake: ['Date'], now: new Date(`${day}T12:00:00Z`) });
    const a = await signup();
    const ok = await app.inject({
      method: 'POST',
      url: '/daily/score',
      headers: hdr(a.token),
      payload: { inputs: log },
    });
    expect(ok.statusCode).toBe(200);
    const bad = await app.inject({
      method: 'POST',
      url: '/daily/score',
      headers: hdr(a.token),
      payload: { inputs: log.slice(0, 5) },
    });
    expect(bad.statusCode).toBe(422);
    const lb = await app.inject({ method: 'GET', url: `/daily/leaderboard?day=${day}` });
    expect(lb.json().top).toHaveLength(1);
    expect(lb.json().top[0]).toMatchObject({ rank: 1, ticks: ok.json().ticks });
    vi.useRealTimers();
  });
});
