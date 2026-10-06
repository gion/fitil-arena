import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultProfile } from '@fitil/content';
import type { Profile } from '@fitil/content';

const srv: Profile = { ...defaultProfile(), coins: 60, owned: ['c_green', 'h_cap'] };

function mockFetch(
  handler: (url: string, init?: RequestInit) => { status: number; body?: unknown } | 'down',
) {
  const calls: string[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    calls.push(`${init?.method ?? 'GET'} ${url.replace('http://api.test', '')}`);
    const r = handler(url, init);
    if (r === 'down') throw new TypeError('fetch failed');
    return { ok: r.status < 300, status: r.status, json: async () => r.body ?? null };
  });
  return calls;
}

describe('cont: schimbările de profil merg prin server', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_API_URL', 'http://api.test');
    const mem = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
    });
    vi.resetModules();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('confirmat: profilul de la server îl înlocuiește pe cel local, în ordine', async () => {
    const { account } = await import('../src/online/account.ts');
    account.stored = { token: 't'.repeat(64), id: 'x' };
    const calls = mockFetch(() => ({ status: 200, body: { ok: true, profile: srv } }));
    const adopted: Profile[] = [];
    account.enqueue(
      [
        { path: '/shop/buy', body: { id: 'h_cap' } },
        { path: '/shop/equip', body: { cat: 'hat', id: 'h_cap' } },
      ],
      (p) => adopted.push(p),
      () => expect.unreachable(),
    );
    await account.chain;
    expect(calls).toEqual(['POST /shop/buy', 'POST /shop/equip']);
    expect(adopted).toHaveLength(2);
    expect(adopted[1]!.coins).toBe(60);
  });

  it('refuzat: se aduce profilul serverului (rollback) și se anunță, restul cererilor se opresc', async () => {
    const { account } = await import('../src/online/account.ts');
    account.stored = { token: 't'.repeat(64), id: 'x' };
    const calls = mockFetch((url) =>
      url.endsWith('/shop/buy')
        ? { status: 409, body: { ok: false, why: 'funds' } }
        : { status: 200, body: { profile: srv, trophies: {} } },
    );
    const adopted: Profile[] = [];
    const rejected: string[] = [];
    account.enqueue(
      [
        { path: '/shop/buy', body: { id: 'h_crown' } },
        { path: '/shop/equip', body: { cat: 'hat', id: 'h_crown' } },
      ],
      (p) => adopted.push(p),
      (w) => rejected.push(w),
    );
    await account.chain;
    expect(calls).toEqual(['POST /shop/buy', 'GET /me']);
    expect(adopted).toEqual([srv]);
    expect(rejected).toEqual(['The server refused that change.']);
  });

  it('fără conexiune: mesaj clar; recompensa offline se ține minte și se trimite la pornire', async () => {
    const { account } = await import('../src/online/account.ts');
    account.stored = { token: 't'.repeat(64), id: 'x' };
    mockFetch(() => 'down');
    const rejected: string[] = [];
    account.enqueue(
      [{ path: '/shop/buy', body: { id: 'h_cap' } }],
      () => {},
      (w) => rejected.push(w),
    );
    account.claim({ boxes: 5, kills: 1, won: true, team: false, caps: 0, stars: 0 }, () => {});
    await account.chain;
    expect(rejected[0]).toMatch(/No connection/);
    const calls = mockFetch(() => ({ status: 200, body: { profile: srv } }));
    const adopted: Profile[] = [];
    await account.flushClaims((p) => adopted.push(p));
    await account.chain;
    expect(calls).toEqual(['POST /rewards/offline']);
    expect(adopted).toEqual([srv]);
  });
});
