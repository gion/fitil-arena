import { describe, expect, it } from 'vitest';
import { TICK_MS, createRng, hashState, nextFloat, nextInt } from '@fitil/sim';
import type { Dir, Input } from '@fitil/sim';
import {
  ArenaHost,
  NetClient,
  buildOnline,
  decodeInput,
  encodeInput,
  humanId,
  maxHumans,
} from '../src/index.ts';
import type { Link, RoomCfg } from '../src/index.ts';

/** Buclă în memorie cu ceas virtual: mesaje întârziate aleator, ordinea păstrată pe fiecare sens. */
class World {
  t = 0;
  private q: { at: number; n: number; fn: () => void }[] = [];
  private n = 0;
  at(delay: number, fn: () => void): void {
    this.q.push({ at: this.t + delay, n: this.n++, fn });
  }
  run(until: number): void {
    for (;;) {
      this.q.sort((a, b) => a.at - b.at || a.n - b.n);
      const e = this.q[0];
      if (!e || e.at > until) break;
      this.q.shift();
      this.t = e.at;
      e.fn();
    }
    this.t = until;
  }
}

function connect(w: World, host: ArenaHost, sid: string, rtt: number, jitter: number, seed: number) {
  const rng = createRng(seed);
  const handlers = new Map<string, ((m: never) => void)[]>();
  let upAt = 0;
  let downAt = 0;
  const d = () => rtt / 2 + nextFloat(rng) * jitter;
  const deliver = (type: string, msg: unknown) => {
    downAt = Math.max(downAt, w.t + d());
    w.at(downAt - w.t, () => handlers.get(type)?.forEach((fn) => fn(msg as never)));
  };
  const link: Link = {
    send(type, msg) {
      upAt = Math.max(upAt, w.t + d());
      w.at(upAt - w.t, () => {
        const m = msg as { q: number; i: unknown };
        if (type === 'in') host.input(sid, m.q, m.i);
        if (type === 'resync') deliver('snap', host.snapFor(sid));
      });
    },
    on(type, fn) {
      handlers.set(type, [...(handlers.get(type) ?? []), fn]);
    },
  };
  return { client: new NetClient(link), deliver };
}

function playLoop(cfg: RoomCfg, humans: number, seed: number) {
  const w = new World();
  const host = new ArenaHost('TEST');
  const conns = Array.from({ length: humans }, (_, k) => {
    host.join(`s${k}`, `P${k}`);
    return connect(w, host, `s${k}`, 40 + k * 50, 30, seed + k);
  });
  host.cfg = cfg;
  host.start('s0', seed, 1.6);
  conns.forEach((c, k) => c.deliver('snap', host.snapFor(`s${k}`)));
  const rng = createRng(seed ^ 0x5eed);
  let end: string | null = null;
  // clientul „apasă” aleator: merge, pune bombe
  const pick = (): Input => ({
    dir: nextInt(rng, 5) === 4 ? null : (nextInt(rng, 4) as Dir),
    bomb: nextInt(rng, 12) === 0 ? 1 : 0,
  });
  for (let tick = 0; tick < 20 * 60 * 5 && !end; tick++) {
    for (const c of conns) {
      c.client.send(pick());
      c.client.stepView();
    }
    const f = host.tick();
    if (f) for (const c of conns) c.deliver('f', f);
    const e = host.finish();
    if (e) end = e.h;
    w.run(w.t + TICK_MS);
  }
  w.run(w.t + 2000);
  return { host, conns, end };
}

describe('net: construcția meciului online', () => {
  it('oamenii se împart alternativ pe echipe, restul sunt boți', () => {
    expect([0, 1, 2, 3].map((k) => humanId('team3', k))).toEqual([0, 3, 1, 4]);
    const people = (['A', 'B', 'C'] as const).map((name, i) => ({
      name,
      hero: (['zuzu', 'veta', 'robo'] as const)[i]!,
    }));
    const b = buildOnline({ mode: 'ctf', theme: 'clasic', bots: 'hard', extras: true }, 3, 1.6, people);
    expect(b.humans).toEqual([0, 3, 1]);
    expect(b.state.players.map((p) => p.bot)).toEqual([null, null, 'hard', null, 'hard', 'hard']);
    expect(b.slots.map((s) => s.name).slice(0, 2)).toEqual(['A', 'C']);
    expect(b.slots[3]!.name).toBe('B');
    // personajele alese de oameni; boții primesc altele (cu numele personajului)
    expect([0, 3, 1].map((id) => b.state.players[id]!.hero?.id)).toEqual(['zuzu', 'veta', 'robo']);
    for (const id of [2, 4, 5]) expect(['zuzu', 'veta', 'robo']).not.toContain(b.slots[id]!.hero);
    expect(maxHumans('vs')).toBe(2);
  });

  it('online: evenimentul de arenă din seed, fără tufișuri (Q-004); extras se pot opri', () => {
    const one = [{ name: 'A', hero: 'bubu' as const }];
    const b = buildOnline({ mode: 'ffa', theme: 'jungla', bots: 'normal', extras: true }, 9, 1.6, one);
    expect(b.state.rules.event).not.toBeNull();
    expect(b.state.bush.every((v) => v === 0)).toBe(true);
    const off = buildOnline({ mode: 'ffa', theme: 'jungla', bots: 'normal', extras: false }, 9, 1.6, one);
    expect(off.state.rules.extras).toBe(false);
    expect(off.state.rules.event).toBeNull();
  });

  it('input-ul pe fir păstrează Super-ul și schimbarea bombei', () => {
    const w = encodeInput({ dir: 2, bomb: 1, super: true, swap: true, face: 3 });
    expect(decodeInput(w)).toEqual({ dir: 2, bomb: 1, super: true, swap: true, face: 3 });
    // fire vechi (4 câmpuri) încă se decodează
    expect(decodeInput([1, 0, 0, -1])).toEqual({ dir: 1 });
  });
});

describe('net: joc rapid (cameră publică)', () => {
  it('gazda nu configurează; pornește singur; fiecare om își alege personajul', () => {
    const h = new ArenaHost('QUIK', { mode: 'crown', theme: 'neon' });
    expect(h.join('a', 'Ana', 'fifi')).toBeNull();
    expect(h.join('b', 'Bob', 'nope')).toBeNull();
    expect(h.seats[1]!.hero).toBe('bubu');
    expect(h.setHero('b', 'maestro')).toBe(true);
    expect(h.setCfg('a', { mode: 'ffa' })).toBe(false);
    expect(h.start('a', 1, 1.6)).toBe(false);
    expect(h.lobby()).toMatchObject({ quick: true, cfg: { mode: 'crown', theme: 'neon' } });
    expect(h.startAuto(5, 1.6)).toBe(true);
    expect(h.s!.rules.mode).toBe('crown');
    expect([0, 1].map((i) => h.s!.players[i]!.hero?.id)).toEqual(['fifi', 'maestro']);
  });
});

describe('net: host + clienți în memorie, cu latență și jitter', () => {
  for (const mode of ['ffa', 'team2', 'ctf', 'crown', 'potato'] as const)
    it(`${mode}: meci complet, toți clienții ajung la același hash ca serverul`, () => {
      const { conns, end } = playLoop({ mode, theme: 'clasic', bots: 'normal', extras: true }, 4, 11);
      expect(end).not.toBeNull();
      for (const { client } of conns) {
        expect(client.desyncs).toBe(0);
        expect(hashState(client.auth)).toBe(end);
        // starea afișată ajunge și ea la final după ce golește bufferul
        while (client.stepView());
        expect(hashState(client.view)).toBe(end);
      }
    });

  it('predicția pornește din starea confirmată și aplică input-urile neconfirmate', () => {
    const w = new World();
    const host = new ArenaHost('PRED');
    host.join('a', 'A');
    const { client, deliver } = connect(w, host, 'a', 300, 0, 1);
    host.start('a', 5, 1.6);
    deliver('snap', host.snapFor('a'));
    w.run(1000);
    const x0 = client.auth!.players[0]!.px;
    const y0 = client.auth!.players[0]!.py;
    for (let i = 0; i < 4; i++) client.send({ dir: 3 });
    const p = client.predict()!.players[0]!;
    // jucătorul pornește dintr-un colț: spre dreapta sau în jos se poate merge
    expect(client.unacked).toBe(4);
    expect(p.px + p.py).toBeGreaterThanOrEqual(x0 + y0);
    expect(client.auth!.players[0]!.px).toBe(x0);
  });

  it('un om care pleacă în meci devine bot (la fel pe toți clienții)', () => {
    const w = new World();
    const host = new ArenaHost('LEFT');
    const a = connect(w, host, 'a', 60, 20, 1);
    host.join('a', 'A');
    const b = connect(w, host, 'b', 120, 20, 2);
    host.join('b', 'B');
    host.start('a', 9, 1.6);
    a.deliver('snap', host.snapFor('a'));
    b.deliver('snap', host.snapFor('b'));
    for (let t = 0; t < 400; t++) {
      if (t === 100) host.leave('b');
      a.client.send({ dir: ((t >> 3) % 4) as Dir });
      const f = host.tick();
      if (f) [a, b].forEach((c) => c.deliver('f', f));
      w.run(w.t + TICK_MS);
    }
    w.run(w.t + 1000);
    expect(host.s!.players[1]!.bot).toBe('normal');
    expect(hashState(a.client.auth)).toBe(hashState(host.s));
    expect(a.client.desyncs).toBe(0);
  });
});
