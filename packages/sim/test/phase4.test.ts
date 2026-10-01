import { describe, expect, it } from 'vitest';
import {
  BLIND,
  CHARGE_BOX,
  CHARGE_HIT,
  CROWN_NEED,
  FLAME,
  FREEZE,
  HEX,
  LIFE_GRACE,
  POTATO_FIRST,
  POTATO_PASS,
  RESPAWN,
  SOFT,
  SPEED_START,
  SPEED_STEP,
  SUPER_FULL,
  TIME_STOP,
  TOXIC_HURT,
  applyItem,
  canSee,
  collectInputs,
  createGame,
  crownRules,
  hashState,
  idx,
  placeBomb,
  potatoRules,
  rollDrop,
  createRng,
  step,
  swapSpecial,
  tileX,
  tileY,
  tryKick,
  useSuper,
} from '../src/index.ts';
import type { GameState, HeroSpec, Input, SuperKind, PassiveKind } from '../src/index.ts';
import { arena, events, put, run, setTile, tap } from './kit.ts';

function hero(sup: SuperKind, passive: PassiveKind = 'none', o: Partial<HeroSpec> = {}): HeroSpec {
  return {
    id: sup,
    super: sup,
    passive,
    speedSteps: 0,
    speedPct: 100,
    bombs: 0,
    range: 0,
    kick: false,
    lives: 0,
    superPct: 100,
    ...o,
  };
}

/** Arenă goală cu personaje. */
function heroArena(heroes: HeroSpec[], rules = {}): GameState {
  return createGame({
    seed: 3,
    rules: { softDensity: 0, boxRespawn: false, hurryUpTick: 0, ...rules },
    players: heroes.map((h) => ({ bot: null, hero: h })),
  });
}

const press = (s: GameState, id: number, inp: Input): GameState => {
  const a: (Input | undefined)[] = [];
  a[id] = inp;
  return step(s, a);
};

/** Bombă care explodează la tick-ul următor. */
function boom(s: GameState, owner: number, x: number, y: number): void {
  placeBomb(s, s.players[owner]!, x, y);
  s.bombs[s.bombs.length - 1]!.fuse = 1;
}

describe('personaje: statistici și inimi', () => {
  it('statisticile de start vin din personaj și afinități', () => {
    const s = heroArena([
      hero('dash', 'none', { speedSteps: 1, speedPct: 110, bombs: 1, range: 1, kick: true, lives: 1 }),
    ]);
    const p = s.players[0]!;
    expect(p.speed).toBe(Math.floor(((SPEED_START + SPEED_STEP) * 110) / 100));
    expect([p.bombs, p.range, p.kick, p.lives]).toEqual([2, 2, true, 2]);
  });

  it('cu 2 inimi, flacăra ia o inimă și dă 1.5s de invulnerabilitate', () => {
    const s = arena(2, { lives: 2 });
    const p = put(s.players[0]!, 3, 1);
    put(s.players[1]!, 9, 9);
    boom(s, 1, 3, 1);
    step(s, []);
    expect(p.alive).toBe(true);
    expect(p.lives).toBe(1);
    expect(events(s, 'lifeLost')).toHaveLength(1);
    run(s, LIFE_GRACE + 1);
    boom(s, 1, 3, 1);
    step(s, []);
    expect(p.alive).toBe(false);
  });

  it('Inima în arenă: +1 inimă, maxim 3', () => {
    const s = arena();
    const p = s.players[0]!;
    for (let i = 0; i < 4; i++) applyItem(p, 'heart', false);
    expect(p.lives).toBe(3);
  });

  it('scutul pasiv (Tanti Veta) salvează o singură dată pe meci, și după revenire', () => {
    const s = heroArena([hero('purse', 'guard'), hero('dash')], { respawnTicks: RESPAWN });
    const p = put(s.players[0]!, 3, 1);
    put(s.players[1]!, 9, 9);
    expect(p.guard).toBe(1);
    boom(s, 1, 3, 1);
    step(s, []);
    expect(p.alive).toBe(true);
    expect(p.guard).toBe(0);
    run(s, FLAME + 20);
    boom(s, 1, 3, 1);
    step(s, []);
    expect(p.alive).toBe(false);
    run(s, RESPAWN + 1);
    expect(p.alive).toBe(true);
    expect(p.guard).toBe(0);
  });
});

describe('Super: încărcare', () => {
  it('se încarcă din lăzi sparte și adversari eliminați (cu procentul personajului)', () => {
    const s = heroArena([hero('bigbomb', 'none', { superPct: 200 }), hero('dash')]);
    const a = put(s.players[0]!, 9, 9);
    const b = put(s.players[1]!, 5, 1);
    setTile(s, 3, 3, SOFT);
    boom(s, 0, 3, 2);
    step(s, []);
    expect(a.charge).toBe(CHARGE_BOX * 2);
    boom(s, 0, 5, 2);
    step(s, []);
    expect(b.alive).toBe(false);
    expect(a.charge).toBe(Math.min(SUPER_FULL, CHARGE_BOX * 2 + CHARGE_HIT * 2));
  });

  it('se încarcă și cu timpul: 1 pe secundă', () => {
    const s = heroArena([hero('dash')]);
    run(s, 20 * 10);
    expect(s.players[0]!.charge).toBe(10);
  });

  it('Super-ul nu pornește cu bara goală și golește bara când pornește', () => {
    const s = heroArena([hero('bigbomb')]);
    const p = put(s.players[0]!, 3, 3);
    expect(useSuper(s, p)).toBe(false);
    p.charge = SUPER_FULL;
    press(s, 0, { dir: null, super: true });
    expect(p.charge).toBe(0);
    expect(events(s, 'super')).toHaveLength(1);
  });
});

describe('Super: fiecare personaj', () => {
  const ready = (s: GameState, id = 0) => {
    s.players[id]!.charge = SUPER_FULL;
    return s.players[id]!;
  };

  it('Bubu: bombă mare (rază +2) care nu ocupă din bombele lui', () => {
    const s = heroArena([hero('bigbomb')]);
    const p = put(ready(s), 3, 3);
    useSuper(s, p);
    expect(s.bombs[0]).toMatchObject({ range: 3, free: true });
    expect(p.active).toBe(0);
    expect(placeBomb(s, p, 5, 3)).toBe(true);
  });

  it('Zuzu: dash 3 pătrățele, se oprește la obstacol', () => {
    const s = heroArena([hero('dash')]);
    const p = put(ready(s), 1, 1, 3);
    useSuper(s, p);
    expect([tileX(p), tileY(p)]).toEqual([4, 1]);
    p.charge = SUPER_FULL;
    setTile(s, 6, 1, SOFT);
    useSuper(s, p);
    expect([tileX(p), tileY(p)]).toEqual([5, 1]);
  });

  it('Gogu: bomba lipicioasă se lipește de primul jucător atins și îl urmează', () => {
    const s = heroArena([hero('sticky', 'none', { kick: true }), hero('dash')]);
    const p = put(ready(s), 1, 1, 3);
    const q = put(s.players[1]!, 7, 1);
    useSuper(s, p);
    let stuck = false;
    for (let t = 0; t < 30 && !stuck; t++) {
      step(s, []);
      stuck = events(s, 'stick').length > 0;
    }
    expect(stuck).toBe(true);
    const b = s.bombs[0]!;
    expect(b.stuck).toBe(1);
    put(q, 9, 1);
    step(s, []);
    expect([b.x, b.y]).toEqual([9, 1]);
    run(s, 40);
    expect(q.alive).toBe(false);
  });

  it('Fifi: bomba șutată ricoșează din perete', () => {
    const s = heroArena([hero('cluster', 'bounce')]);
    const p = put(s.players[0]!, 1, 1, 3);
    placeBomb(s, p, 2, 1);
    s.bombs[0]!.fuse = 200;
    tryKick(s, p, 3);
    let bounced = 0;
    for (let t = 0; t < 30; t++) {
      step(s, []);
      bounced += events(s, 'bounce').length;
    }
    expect(bounced).toBeGreaterThanOrEqual(1);
  });

  it('Fifi: cluster — 4 mini-bombe (rază 1) la 2 pătrățele', () => {
    const s = heroArena([hero('cluster')]);
    const p = put(ready(s), 5, 5);
    useSuper(s, p);
    const at = s.bombs.map((b) => [b.x, b.y, b.range]).sort();
    expect(at).toEqual(
      [
        [3, 5, 1],
        [5, 3, 1],
        [5, 7, 1],
        [7, 5, 1],
      ].sort(),
    );
  });

  it('Tanti Veta: poșeta aruncă bomba departe, peste ziduri', () => {
    const s = heroArena([hero('purse')]);
    const p = put(ready(s), 1, 1, 3);
    useSuper(s, p);
    const b = s.bombs[0]!;
    expect(b.y).toBe(1);
    expect(b.x - 1).toBeGreaterThanOrEqual(4);
    expect(b.fly).not.toBeNull();
  });

  it('Maestrul Fitil: bombele celorlalți stau pe loc 1.5s, ale lui merg', () => {
    const s = heroArena([hero('timestop'), hero('dash')]);
    const p = put(ready(s), 1, 1);
    put(s.players[1]!, 9, 9);
    placeBomb(s, p, 3, 3);
    placeBomb(s, s.players[1]!, 7, 7);
    const [mine, theirs] = s.bombs;
    useSuper(s, p);
    const f0 = [mine!.fuse, theirs!.fuse];
    run(s, TIME_STOP - 1);
    expect(theirs!.fuse).toBe(f0[1]);
    expect(mine!.fuse).toBeLessThan(f0[0]!);
    run(s, 3);
    expect(theirs!.fuse).toBeLessThan(f0[1]!);
  });

  it('Robo-Mici: teleport departe pe un loc sigur, sau pe portalul mai îndepărtat', () => {
    const s = heroArena([hero('warp')]);
    const p = put(ready(s), 1, 1);
    useSuper(s, p);
    expect(Math.abs(tileX(p) - 1) + Math.abs(tileY(p) - 1)).toBeGreaterThanOrEqual(5);
    s.pads = [
      [3, 1],
      [11, 9],
    ];
    put(p, 1, 1);
    p.charge = SUPER_FULL;
    useSuper(s, p);
    expect([tileX(p), tileY(p)]).toEqual([11, 9]);
  });

  it('Robo-Mici: lasă o capcană la moarte care explodează sub un adversar', () => {
    const s = heroArena([hero('warp', 'trap'), hero('dash'), hero('dash')]);
    const r = put(s.players[0]!, 3, 1);
    put(s.players[1]!, 9, 9);
    const q = put(s.players[2]!, 5, 1);
    boom(s, 1, 3, 1);
    step(s, []);
    expect(r.alive).toBe(false);
    expect(s.traps).toHaveLength(1);
    run(s, FLAME + 1);
    put(q, 3, 1);
    step(s, []);
    expect(events(s, 'trapFire')).toHaveLength(1);
    run(s, 2);
    expect(q.alive).toBe(false);
  });
});

describe('bombe speciale și Blestem', () => {
  it('bonusul dă 3 încărcături; se folosesc înaintea bombelor normale; glisarea schimbă tipul', () => {
    const s = arena();
    const p = s.players[0]!;
    applyItem(p, 'ice', false);
    applyItem(p, 'flash', false);
    expect(p.specials).toEqual(['ice', 'ice', 'ice', 'flash', 'flash', 'flash']);
    expect(swapSpecial(p)).toBe(true);
    expect(p.specials[0]).toBe('flash');
    p.bombs = 2;
    placeBomb(s, p, 3, 3);
    expect(s.bombs[0]!.kind).toBe('flash');
  });

  it('gheața nu omoară: îngheață 2s; apăsările scurtează; o flacără normală omoară înghețatul', () => {
    const s = arena(2);
    const p = put(s.players[0]!, 3, 1);
    put(s.players[1]!, 9, 9);
    s.players[1]!.specials = ['ice'];
    boom(s, 1, 3, 1);
    step(s, []);
    expect(p.alive).toBe(true);
    expect(p.frozenT).toBe(FREEZE);
    run(s, 2, [{ dir: 3 }]);
    expect(tileX(p)).toBe(3);
    tap(s);
    expect(p.frozenT).toBeLessThan(FREEZE - 3);
    run(s, FLAME);
    boom(s, 1, 3, 1);
    step(s, []);
    expect(p.alive).toBe(false);
  });

  it('gheața nu sparge lăzi', () => {
    const s = arena(2);
    put(s.players[1]!, 9, 9);
    setTile(s, 4, 1, SOFT);
    s.players[1]!.specials = ['ice'];
    boom(s, 1, 3, 1);
    step(s, []);
    expect(s.grid[idx(s, 4, 1)]).toBe(SOFT);
  });

  it('flashbang: orbește 2.5s, nu omoară; orbul nu vede adversarii de departe', () => {
    const s = arena(2);
    const p = put(s.players[0]!, 3, 1);
    const q = put(s.players[1]!, 9, 9);
    q.specials = ['flash'];
    boom(s, 1, 3, 1);
    step(s, []);
    expect(p.alive).toBe(true);
    expect(p.blindT).toBeGreaterThanOrEqual(BLIND - 1);
    expect(canSee(s, p, q)).toBe(false);
    run(s, BLIND);
    expect(canSee(s, p, q)).toBe(true);
  });

  it('otrava: explozie normală + nor 3s; 1s în nor ia o inimă', () => {
    const s = arena(2, { lives: 2 });
    const p = put(s.players[0]!, 9, 9);
    const q = put(s.players[1]!, 1, 9);
    q.specials = ['poison'];
    boom(s, 1, 3, 1);
    step(s, []);
    run(s, FLAME + 1);
    expect(s.toxic[idx(s, 3, 1)]).toBeGreaterThan(0);
    put(p, 3, 1);
    run(s, TOXIC_HURT);
    expect(p.lives).toBe(1);
  });

  it('Blestemul: adversarii pun bombe cu rază −1 (minim 1) timp de 8s', () => {
    const s = arena(2);
    const [p, q] = s.players as [(typeof s.players)[0], (typeof s.players)[0]];
    put(p, 1, 1);
    put(q, 9, 9);
    q.range = 3;
    applyItem(p, 'hex', false);
    expect(p.hexT).toBe(HEX);
    placeBomb(s, q, 9, 9);
    expect(s.bombs[0]!.range).toBe(2);
    placeBomb(s, p, 1, 1);
    expect(s.bombs[1]!.range).toBe(1);
  });

  it('drop-urile noi apar doar cu `extras`', () => {
    const seen = new Set<string>();
    const rng = createRng(9);
    for (let i = 0; i < 5000; i++) seen.add(String(rollDrop(rng, false, true)));
    for (const it of ['ice', 'flash', 'poison', 'hex', 'heart']) expect(seen.has(it)).toBe(true);
    const plain = new Set<string>();
    const r2 = createRng(9);
    for (let i = 0; i < 5000; i++) plain.add(String(rollDrop(r2)));
    expect(plain.has('ice') || plain.has('heart')).toBe(false);
  });
});

describe('tufișuri', () => {
  it('cine stă în tufiș e ascuns la peste 1 pătrățel; coechipierii îl văd', () => {
    const s = arena(3, { mode: 'teams' });
    const [a, b, c] = s.players as [
      GameState['players'][0],
      GameState['players'][0],
      GameState['players'][0],
    ];
    a.team = 0;
    b.team = 1;
    c.team = 0;
    put(a, 1, 1);
    put(b, 5, 1);
    put(c, 9, 9);
    s.bush[idx(s, 5, 1)] = 1;
    expect(canSee(s, a, b)).toBe(false);
    put(a, 4, 1);
    expect(canSee(s, a, b)).toBe(true);
    s.bush[idx(s, 9, 9)] = 1;
    expect(canSee(s, a, c)).toBe(true);
  });

  it('flacăra arde tufișul', () => {
    const s = arena();
    put(s.players[0]!, 9, 9);
    s.bush[idx(s, 4, 1)] = 1;
    boom(s, 0, 3, 1);
    step(s, []);
    expect(s.bush[idx(s, 4, 1)]).toBe(0);
    expect(events(s, 'bushBurn')).toHaveLength(1);
  });

  it('se generează din seed cu `bushRate`', () => {
    const a = createGame({ seed: 5, rules: { bushRate: 0.2 }, players: [{ bot: null }, { bot: null }] });
    const b = createGame({ seed: 5, rules: { bushRate: 0.2 }, players: [{ bot: null }, { bot: null }] });
    expect(a.bush.some((v) => v)).toBe(true);
    expect(a.bush).toEqual(b.bush);
  });
});

describe('moduri: Coroana și Cartoful fierbinte', () => {
  it('Coroana: o iei călcând pe ea, acumulezi timp, cade la moarte; câștigi la 60s', () => {
    const s = createGame({
      seed: 2,
      rules: { ...crownRules(16 / 9), softDensity: 0 },
      players: [{ bot: null }, { bot: null }],
    });
    const c = s.crown!;
    const p = put(s.players[0]!, c.x, c.y);
    const q = put(s.players[1]!, 1, 1);
    step(s, []);
    expect(c.holder).toBe(0);
    run(s, 20);
    expect(p.crownT).toBeGreaterThanOrEqual(20);
    boom(s, 1, c.x, c.y);
    step(s, []);
    expect(c.holder).toBeNull();
    expect(events(s, 'crownDrop')).toHaveLength(1);
    run(s, FLAME + 1);
    put(q, c.x, c.y);
    q.crownT = CROWN_NEED - 2;
    run(s, 4);
    expect(s.result?.winner).toBe(1);
  });

  it('Cartoful: apare la 3s, trece la atingere, explodează în mâna celui care îl ține', () => {
    const s = createGame({
      seed: 4,
      rules: { ...potatoRules(16 / 9), softDensity: 0, boxRespawn: false },
      players: [{ bot: null }, { bot: null }, { bot: null }],
    });
    const [a, b, c] = s.players;
    put(a!, 1, 1);
    put(b!, 9, 9);
    put(c!, 13, 1);
    run(s, POTATO_FIRST);
    const t = s.potato!;
    expect(t.holder).not.toBeNull();
    const h = s.players[t.holder!]!;
    const other = s.players.find((p) => p !== h)!;
    put(other, tileX(h) + (tileX(h) > 1 ? -1 : 1), tileY(h));
    run(s, POTATO_PASS + 1);
    expect(t.holder).toBe(other.id);
    const holder = other;
    for (const p of s.players) if (p !== holder) put(p, p === h ? 1 : 13, p === h ? 9 : 9);
    run(s, t.fuse + 1);
    expect(holder.alive).toBe(false);
    expect(s.players.filter((p) => p.alive)).toHaveLength(2);
  });
});

describe('determinism și boți cu personaje', () => {
  const ALL: SuperKind[] = ['bigbomb', 'dash', 'sticky', 'cluster', 'purse', 'timestop', 'warp'];
  const P: PassiveKind[] = ['none', 'none', 'none', 'bounce', 'guard', 'timers', 'trap'];

  function match(seed: number, mode: 'ffa' | 'crown' | 'potato' = 'ffa') {
    const rules =
      mode === 'crown'
        ? crownRules(16 / 9)
        : mode === 'potato'
          ? potatoRules(16 / 9)
          : { width: 15, height: 11 };
    const s = createGame({
      seed,
      rules: { ...rules, extras: true, bushRate: 0.1 },
      players: [0, 1, 2, 3].map((i) => ({
        bot: 'hard' as const,
        hero: hero(ALL[(seed + i) % 7]!, P[(seed + i) % 7]!, { superPct: 300 }),
      })),
    });
    const supers = new Set<string>();
    while (!s.result && s.tick < 20 * 300) {
      step(s, collectInputs(s));
      for (const e of s.events) if (e.type === 'super') supers.add(e.kind);
    }
    return { s, supers };
  }

  it('același seed → aceeași stare (personaje, bombe speciale, tufișuri)', () => {
    for (const seed of [1, 2, 3]) expect(hashState(match(seed).s)).toBe(hashState(match(seed).s));
  });

  it('boții își folosesc Super-urile și termină meciurile în toate modurile noi', () => {
    const used = new Set<string>();
    for (let seed = 1; seed <= 14; seed++) {
      const mode = (['ffa', 'crown', 'potato'] as const)[seed % 3];
      const { s, supers } = match(seed, mode);
      expect(s.result).not.toBeNull();
      for (const k of supers) used.add(k);
    }
    expect(used.size).toBeGreaterThanOrEqual(6);
  });
});
