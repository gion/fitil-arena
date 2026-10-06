import { describe, expect, it } from 'vitest';
import { ArenaHost, END_TICKS } from '../src/index.ts';

function play(mode: 'ffa' | 'team2', humans: number, leaveAt = -1) {
  const h = new ArenaHost('TEST', { mode, theme: 'clasic' });
  for (let i = 0; i < humans; i++) h.join(`s${i}`, { name: `P${i}`, ch: 'bubu' });
  h.setCfg(h.seats[0]!.sid, {});
  expect(h.startAuto(7, 1.6)).toBe(true);
  for (let t = 0; t < 20_000; t++) {
    // oamenii nu fac nimic: boții îi elimină sau câștigă
    h.tick();
    if (t === leaveAt) h.leave('s1');
    if (h.finish()) return h.result!;
  }
  throw new Error('meciul nu s-a terminat');
}

describe('rezultatul meciului', () => {
  it('FFA: locuri unice 1..n, un singur câștigător, câte un rezultat pe om', () => {
    const r = play('ffa', 2);
    expect(r.mode).toBe('ffa');
    expect(r.players.map((p) => p.name)).toEqual(['P0', 'P1']);
    for (const p of r.players) {
      expect(p.place).toBeGreaterThanOrEqual(1);
      expect(p.won).toBe(p.place === 1);
    }
    expect(new Set(r.players.map((p) => p.place)).size).toBe(2);
    expect(END_TICKS).toBeGreaterThan(0);
  });

  it('echipe: locurile sunt 1 (echipa câștigătoare) sau 2; cine pleacă e marcat', () => {
    const r = play('team2', 2, 5);
    for (const p of r.players) expect([1, 2]).toContain(p.place);
    expect(r.players.find((p) => p.name === 'P1')!.left).toBe(true);
    expect(r.players.find((p) => p.name === 'P0')!.left).toBe(false);
  });
});
