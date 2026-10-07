import { describe, expect, it } from 'vitest';
import { CHUNK, CHUNK_CELLS, U, chunkKey, idx, inBounds, keyCx, keyCy, tileX, tileY } from '@fitil/sim';
import type { Dir, Input } from '@fitil/sim';
import { INF_MAX, InfHost, InfView, cellCode, encodeInput } from '../src/index.ts';
import type { InfBoard, InfFrame, InfRoster, Link } from '../src/index.ts';

/** O instanță în memorie: serverul și câte o vedere de client pe fiecare om. */
function world(n: number, seed = 9) {
  const host = new InfHost(seed, 'clasic', 'test');
  const views = new Map<string, InfView>();
  const bytes = new Map<string, number>();
  const handlers = new Map<string, Map<string, (m: never) => void>>();
  const add = (sid: string) => {
    const hs = new Map<string, (m: never) => void>();
    handlers.set(sid, hs);
    const link: Link = {
      send: (type, msg) => {
        const m = msg as { q: number; i: unknown };
        if (type === 'in') host.input(sid, m.q, m.i);
      },
      on: (type, fn) => hs.set(type, fn),
    };
    const v = new InfView(link);
    views.set(sid, v);
    bytes.set(sid, 0);
    const w = host.join(sid, { name: sid })!;
    hs.get('welcome')!(w as never);
    return v;
  };
  for (let i = 0; i < n; i++) add(`c${i}`);
  const deliver = (sid: string, type: string, m: unknown) => {
    bytes.set(sid, bytes.get(sid)! + JSON.stringify(m).length);
    handlers.get(sid)?.get(type)?.(m as never);
  };
  const tick = (input: (sid: string, t: number) => Input = () => ({ dir: null })) => {
    for (const [sid, v] of views) v.send(input(sid, host.s.tick));
    const frames = host.tick();
    const r: InfRoster | null = host.takeRoster();
    for (const [sid, f] of frames) {
      if (r) deliver(sid, 'roster', r);
      deliver(sid, 'f', f);
      views.get(sid)!.stepView();
    }
    if (host.s.tick % 20 === 0) for (const [sid, b] of host.boards()) deliver(sid, 'board', b);
    return frames;
  };
  const drop = (sid: string) => {
    host.leave(sid);
    views.delete(sid);
    handlers.delete(sid);
  };
  return { host, views, bytes, add, tick, drop };
}

/** Plimbare pseudo-aleatoare cu bombe (aceeași pentru același sid și tick). */
const wander = (sid: string, t: number): Input => {
  const h = (sid.charCodeAt(1) * 31 + (t >> 4) * 17) % 7;
  return { dir: h < 4 ? (h as Dir) : null, bomb: (t + sid.length * 7) % 45 === 0 ? 1 : 0 };
};

/** Oglinda clientului coincide cu serverul pe toată zona lui (celule, jucători, bombe). */
function expectMirror(host: InfHost, v: InfView): void {
  const s = host.s;
  const m = v.view!;
  const w = m.inf!;
  let cells = 0;
  for (let slot = 1; slot < w.keys.length; slot++) {
    const key = w.keys[slot]!;
    if (key < 0) continue;
    const x0 = keyCx(key) * CHUNK;
    const y0 = keyCy(key) * CHUNK;
    for (let i = 0; i < CHUNK_CELLS; i++) {
      const x = x0 + (i & 31);
      const y = y0 + (i >> 5);
      expect(inBounds(s, x, y)).toBe(true);
      if (cellCode(m, slot * CHUNK_CELLS + i) !== cellCode(s, idx(s, x, y)))
        throw new Error(
          `celula ${x},${y} diferă: ${cellCode(m, slot * CHUNK_CELLS + i)} ≠ ${cellCode(s, idx(s, x, y))}`,
        );
      cells++;
    }
  }
  expect(cells).toBeGreaterThanOrEqual(4 * CHUNK_CELLS);
  for (const p of m.players) {
    if (p.out) continue;
    const q = s.players[p.id]!;
    expect([p.px, p.py, p.alive]).toEqual([q.px, q.py, q.alive]);
  }
  const me = s.players[v.me]!;
  expect(m.players[v.me]!.bombs).toBe(me.bombs);
  const ground = (bs: typeof s.bombs) =>
    bs
      .filter((b) => b.held === null && !b.fly && m.inf!.slots[chunkKey(b.x >> 5, b.y >> 5)] !== undefined)
      .map((b) => b.id)
      .sort();
  expect(ground(m.bombs)).toEqual(ground(s.bombs));
}

describe('Infinit online: stare filtrată pe chunk-uri', () => {
  it('oglinda fiecărui client coincide cu serverul în zona lui, după lupte și plimbări', () => {
    const { host, views, tick } = world(6);
    for (let t = 0; t < 600; t++) tick(wander);
    for (const v of views.values()) expectMirror(host, v);
    expect(host.s.events).toBeDefined();
    // s-a întâmplat ceva: lăzi sparte, bombe
    expect(host.s.players.some((p) => p.boxes > 0)).toBe(true);
  });

  it('un jucător departe nu ajunge la ceilalți (nici el, nici bombele lui)', () => {
    const { host, tick, views } = world(3);
    const far = host.s.players[2]!;
    far.px = far.fx = far.tx = 501;
    far.px = 501 * U;
    far.py = 401 * U;
    far.fy = far.ty = 401;
    let leaked = false;
    for (let t = 0; t < 100; t++) {
      const frames = tick((sid, tt) =>
        sid === 'c2' ? { dir: null, bomb: tt % 50 === 0 ? 1 : 0 } : { dir: null },
      );
      for (const sid of ['c0', 'c1'])
        if (frames.get(sid)!.p.some((w) => w[0] === 2) || frames.get(sid)!.b.some((w) => w[4] === 2))
          leaked = true;
    }
    expect(leaked).toBe(false);
    expect(views.get('c0')!.view!.players[2]?.out ?? true).toBe(true);
    // el își vede lumea lui
    expect(tileX(views.get('c2')!.view!.players[2]!)).toBe(tileX(far));
    expect(tileY(views.get('c2')!.view!.players[2]!)).toBe(tileY(far));
  });

  it('trafic: 30 de oameni unii lângă alții rămân sub 15 KB/s fiecare', () => {
    const { tick, bytes, host } = world(30);
    for (let t = 0; t < 400; t++) tick(wander);
    const secs = host.s.tick / 20;
    const worst = Math.max(...bytes.values()) / secs;
    // JSON e mai mare decât msgpack-ul de pe fir: dacă JSON încape, încape și pe fir
    expect(worst).toBeLessThan(15_000);
  });

  it('clasamentul și minimapa vin o dată pe secundă; plecații ies din roster, locul se refolosește', () => {
    const { views, tick, drop, add } = world(4);
    let board: InfBoard | null = null;
    views.get('c0')!.onBoard = (b) => (board = b);
    for (let t = 0; t < 40; t++) tick(wander);
    expect(board).not.toBeNull();
    const b = board! as InfBoard;
    expect(b.n).toBe(4);
    expect(b.top).toHaveLength(4);
    expect(b.map.some(([id]) => id === views.get('c0')!.me)).toBe(true);
    const gone = views.get('c3')!.me;
    drop('c3');
    tick();
    expect(views.get('c0')!.view!.players[gone]!.out).toBe(true);
    for (let t = 0; t < 60; t++) tick();
    const v = add('c9');
    expect(v.me).toBe(gone);
    expect(v.slots[gone]!.name).toBe('You');
    tick();
    expect(views.get('c0')!.slots[gone]!.name).toBe('c9');
  });

  it(`instanța se umple la ${INF_MAX} de oameni`, () => {
    const host = new InfHost(1);
    for (let i = 0; i < INF_MAX; i++) expect(host.join(`s${i}`, { name: 'x' })).not.toBeNull();
    expect(host.full).toBe(true);
    expect(host.join('extra', { name: 'x' })).toBeNull();
  });

  it('cadrul unui client fără nimic în jur e mic', () => {
    const { tick } = world(1);
    let f: InfFrame | undefined;
    for (let t = 0; t < 30; t++) f = tick().get('c0');
    expect(JSON.stringify(f).length).toBeLessThan(120);
    expect(encodeInput({ dir: null })).toHaveLength(7);
  });
});
