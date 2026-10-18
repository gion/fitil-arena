import { describe, expect, it } from 'vitest';
import { NetStats } from '../src/online/netstats.ts';

describe('NetStats', () => {
  it('fără măsurători: zero', () => {
    expect(new NetStats().summary()).toEqual({ ping_avg: 0, ping_p95: 0, ping_max: 0, ping_n: 0 });
  });

  it('media, p95 și maximul; reset golește', () => {
    const st = new NetStats();
    for (let i = 1; i <= 100; i++) st.add(i);
    expect(st.rtt).toBe(100);
    expect(st.summary()).toEqual({ ping_avg: 51, ping_p95: 96, ping_max: 100, ping_n: 100 });
    st.drops = 2;
    st.reset();
    expect(st.drops).toBe(0);
    expect(st.summary().ping_n).toBe(0);
  });

  it('păstrează doar ultimele 600 de măsurători', () => {
    const st = new NetStats();
    for (let i = 0; i < 700; i++) st.add(i < 100 ? 1000 : 10);
    expect(st.summary()).toMatchObject({ ping_max: 10, ping_n: 600 });
  });
});
