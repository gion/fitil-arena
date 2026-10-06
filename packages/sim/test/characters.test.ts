import { describe, expect, it } from 'vitest';
import {
  CHARGES,
  FLAME,
  FUSE,
  GHOST_CD,
  HARD,
  MAX_BOMBS,
  SHIELD,
  SOFT,
  U,
  applyItem,
  createGame,
  detonate,
  hashState,
  collectInputs,
  idx,
  placeBomb,
  sec,
  step,
  tileX,
} from '../src/index.ts';
import type { CharKit, GameState, Input, Rules } from '../src/index.ts';
import { events, put, run, setTile, tap } from './kit.ts';

const BASE: CharKit = { speed: 165, range: 1, bombs: 1, maxBombs: 8, lives: 1 };
const kit = (k: Partial<CharKit>): CharKit => ({ ...BASE, ...k });

/** Arenă goală cu personaje. */
function arena(kits: (CharKit | undefined)[], rules: Partial<Rules> = {}): GameState {
  return createGame({
    seed: 1,
    rules: { softDensity: 0, boxRespawn: false, hurryUpTick: 0, ...rules },
    players: kits.map((k, i) => (k ? { bot: null, kit: k, ch: `c${i}` } : { bot: null })),
  });
}

const walk = (dir: 0 | 1 | 2 | 3, id = 0): Input[] => {
  const a: Input[] = [];
  a[id] = { dir };
  return a;
};

describe('personaje: statistici de start', () => {
  it('kitul se aplică la start și la revenirea în joc', () => {
    const k = kit({ speed: 200, range: 2, maxBombs: 5, lives: 2, glove: true, shield: sec(8) });
    const s = arena([k, undefined], { respawnTicks: 10 });
    const p = s.players[0]!;
    expect([p.speed, p.range, p.maxBombs, p.lives, p.glove, p.shieldT, p.ch]).toEqual([
      200,
      2,
      5,
      2,
      true,
      sec(8),
      'c0',
    ]);
    // fără kit: jucătorul clasic
    expect([s.players[1]!.speed, s.players[1]!.maxBombs, s.players[1]!.lives]).toEqual([165, MAX_BOMBS, 1]);
  });
});

describe('personaje: pasive', () => {
  it('Bubu: doar prima bombă din rundă e uriașă (+2 rază)', () => {
    const s = arena([kit({ bigFirst: true, bombs: 2 })]);
    const p = put(s.players[0]!, 1, 1);
    tap(s);
    expect(s.bombs[0]!.range).toBe(3);
    expect(s.bombs[0]!.big).toBe(true);
    put(p, 3, 1);
    tap(s);
    expect(s.bombs[1]!.range).toBe(1);
  });

  it('Gugu: a doua viață — supraviețuiește primei flăcări, clipește, a doua oară moare', () => {
    const s = arena([kit({ lives: 2 })]);
    const p = put(s.players[0]!, 1, 1);
    tap(s);
    run(s, FUSE);
    expect(p.alive).toBe(true);
    expect(p.lives).toBe(1);
    expect(p.graceT).toBeGreaterThan(0);
    run(s, sec(2));
    tap(s);
    run(s, FUSE);
    expect(p.alive).toBe(false);
  });

  it('Zuzu: bombele nu trec de maximul personajului, nici cu bonusul auriu', () => {
    const s = arena([kit({ maxBombs: 5 })]);
    const p = s.players[0]!;
    for (let i = 0; i < 9; i++) applyItem(p, 'bomb');
    expect(p.bombs).toBe(5);
    applyItem(p, 'maxbomb');
    expect(p.bombs).toBe(5);
  });

  it('Fifi: magnetul culege bonusurile pozitive din pătrățelele vecine, nu și pe cele negative', () => {
    const s = arena([kit({ magnet: true }), undefined]);
    put(s.players[0]!, 3, 3);
    put(s.players[1]!, 9, 9);
    s.items[idx(s, 3, 2)] = 'fire';
    s.items[idx(s, 3, 4)] = 'slow';
    step(s, []);
    expect(s.players[0]!.range).toBe(2);
    expect(s.items[idx(s, 3, 2)]).toBeNull();
    expect(s.items[idx(s, 3, 4)]).toBe('slow');
    // fără magnet, un vecin nu se culege
    put(s.players[1]!, 5, 5);
    s.items[idx(s, 5, 4)] = 'fire';
    step(s, []);
    expect(s.items[idx(s, 5, 4)]).toBe('fire');
  });

  it('Tanti Veta: mănușa de start e nelimitată chiar și cu încărcări în arenă', () => {
    const s = arena([kit({ glove: true })], { charges: true });
    const p = s.players[0]!;
    applyItem(p, 'glove', { charged: true });
    expect(p.charges.glove).toBe(0);
    expect(p.glove).toBe(true);
  });

  it('Robo-Mici: imun la boli (încetinire, inversare, amețeală, sughiț), nu și la „mai puține bombe”', () => {
    const s = arena([kit({ immune: true, noShield: true })]);
    const p = put(s.players[0]!, 1, 1);
    for (const it of ['slow', 'reverse', 'dizzy', 'hiccup'] as const) expect(applyItem(p, it)).toBe(false);
    expect([p.speed, p.revT, p.dizzyT, p.hicT]).toEqual([165, 0, 0, 0]);
    expect(applyItem(p, 'shield')).toBe(false);
    p.bombs = 3;
    applyItem(p, 'fewer');
    expect(p.bombs).toBe(2);
    // ridicat din arenă: rămâne pe jos? nu — se consumă și apare evenimentul `immune`
    s.items[idx(s, 2, 1)] = 'dizzy';
    run(s, 12, walk(3));
    expect(s.items[idx(s, 2, 1)]).toBeNull();
    expect(p.dizzyT).toBe(0);
  });

  it('Fotbalistul: bomba șutată ricoșează o dată din obstacol; Mănușa din arenă nu se ia', () => {
    const s = arena([kit({ kick: true, ricochet: true, noGlove: true })]);
    const p = put(s.players[0]!, 1, 1);
    expect(applyItem(p, 'glove')).toBe(false);
    placeBomb(s, p, 2, 1);
    s.bombs[0]!.fuse = 500;
    setTile(s, 6, 1, HARD);
    run(s, 3, walk(3));
    expect(s.bombs[0]!.slide).toBe(3);
    const xs: number[] = [];
    for (let t = 0; t < 40; t++) {
      step(s, []);
      xs.push(s.bombs[0]!.x);
    }
    // merge până lângă zid (5), apoi se întoarce și se oprește lângă jucător
    expect(Math.max(...xs)).toBe(5);
    expect(s.bombs[0]!.slide).toBeNull();
    expect(s.bombs[0]!.x).toBe(tileX(p) + 1);
  });

  it('Bucătarul: flăcările lasă ulei 2s care îi încetinește pe ceilalți, nu și pe el; fitil +0.3s', () => {
    const s = arena([kit({ oil: true, fuseAdd: 6 }), undefined]);
    const chef = put(s.players[0]!, 1, 1);
    put(s.players[1]!, 9, 9);
    tap(s);
    expect(s.bombs[0]!.fuse).toBe(FUSE + 6 - 1); // un tick a trecut deja
    put(chef, 5, 5);
    run(s, FUSE + 6);
    expect(s.oil[idx(s, 2, 1)]).toBeGreaterThan(0);
    run(s, FLAME);
    // celălalt jucător pe ulei merge cu 60%
    const other = put(s.players[1]!, 1, 1);
    const x0 = other.px;
    step(s, walk(3, 1));
    expect(other.px - x0).toBe(Math.floor((165 * 60) / 100));
    // Bucătarul pe propriul ulei: viteză întreagă
    put(other, 9, 9);
    put(chef, 1, 1);
    const c0 = chef.px;
    step(s, walk(3, 0));
    expect(chef.px - c0).toBe(165);
    run(s, sec(2));
    expect(s.oil[idx(s, 2, 1)]).toBe(0);
  });

  it('Fantoma: trece printr-o ladă, apoi abia după 20s prin următoarea', () => {
    const s = arena([kit({ ghost: true, noShield: true })]);
    const p = put(s.players[0]!, 1, 1);
    setTile(s, 2, 1, SOFT);
    setTile(s, 4, 1, SOFT);
    run(s, 20, walk(3));
    expect(events(s, 'ghostIn').length + (p.ghostT > 0 ? 1 : 0)).toBeGreaterThan(0);
    // a trecut de prima ladă și s-a oprit la a doua
    expect(tileX(p)).toBe(3);
    expect(p.ghostT).toBeGreaterThan(0);
    run(s, GHOST_CD, walk(3));
    expect(tileX(p)).toBeGreaterThanOrEqual(4);
  });

  it('Magicianul: o bombă a adversarului care l-ar prinde devine porumbel, o singură dată pe rundă', () => {
    const s = arena([kit({ pigeon: true, shieldPct: 50 }), undefined]);
    const mag = put(s.players[0]!, 3, 1);
    const foe = put(s.players[1]!, 1, 1);
    tap(s, 1);
    put(foe, 9, 9);
    put(mag, 2, 1);
    let pigeons = 0;
    for (let t = 0; t < FUSE; t++) {
      step(s, []);
      pigeons += events(s, 'pigeon').length;
    }
    expect(pigeons).toBe(1);
    expect(mag.alive).toBe(true);
    expect(foe.active).toBe(0);
    expect(s.flame[idx(s, 1, 1)]).toBe(0);
    // a doua bombă îl prinde
    put(foe, 1, 1);
    tap(s, 1);
    put(foe, 9, 9);
    run(s, FUSE);
    expect(mag.alive).toBe(false);
    // scutul îi durează la jumătate
    const s2 = arena([kit({ shieldPct: 50 })]);
    applyItem(s2.players[0]!, 'shield');
    expect(s2.players[0]!.shieldT).toBe(SHIELD / 2);
  });
});

describe('încărcări (bonusurile din arenă expiră)', () => {
  it('Piciorul din arenă: 3 șuturi, apoi dispare; cel de semnătură rămâne', () => {
    const s = arena([undefined], { charges: true });
    const p = put(s.players[0]!, 1, 1);
    applyItem(p, 'kick', { charged: true });
    expect([p.kick, p.charges.kick]).toEqual([true, CHARGES.kick]);
    let out = 0;
    for (let i = 0; i < 3; i++) {
      put(p, 1, 1);
      placeBomb(s, p, 2, 1);
      s.bombs.at(-1)!.fuse = 500;
      for (let t = 0; t < 2; t++) {
        step(s, walk(3));
        out += events(s, 'chargeOut').length;
      }
      s.bombs = [];
      p.active = 0;
    }
    expect(p.kick).toBe(false);
    expect(p.charges.kick).toBe(0);
    expect(out).toBe(1);
  });

  it('încărcările se adună (maxim 9); fără `charges` bonusul e permanent', () => {
    const s = arena([undefined], { charges: true });
    const p = s.players[0]!;
    for (let i = 0; i < 5; i++) applyItem(p, 'remote', { charged: true });
    expect(p.charges.remote).toBe(9);
    const c = arena([undefined]);
    applyItem(c.players[0]!, 'remote', { charged: c.rules.charges });
    expect(c.players[0]!.charges.remote).toBe(0);
    expect(c.players[0]!.remote).toBe(true);
  });

  it('Detonatorul din arenă: 2 detonări', () => {
    const s = arena([undefined], { charges: true });
    const p = put(s.players[0]!, 1, 1);
    applyItem(p, 'remote', { charged: true });
    p.bombs = 3;
    for (let i = 0; i < 2; i++) {
      placeBomb(s, p, 3 + i * 4, 5);
      expect(detonate(s, p)).toBe(true);
      run(s, 2);
    }
    expect(p.remote).toBe(false);
  });
});

describe('personaje: determinism', () => {
  it('un meci cu toate pasivele, între boți, e identic la același seed', () => {
    const kits = [
      kit({ bigFirst: true }),
      kit({ lives: 2, speed: 138, range: 2 }),
      kit({ oil: true, fuseAdd: 6 }),
      kit({ pigeon: true, maxBombs: 6 }),
    ];
    const play = () => {
      const s = createGame({
        seed: 42,
        rules: { charges: true },
        players: kits.map((k, i) => ({ bot: 'hard' as const, kit: k, ch: `c${i}` })),
      });
      for (let t = 0; t < 2400 && !s.result; t++) step(s, collectInputs(s));
      return s;
    };
    const a = play();
    expect(hashState(a)).toBe(hashState(play()));
    expect(a.players[0]!.px % 1).toBe(0);
    expect(U).toBe(1000);
  });
});
