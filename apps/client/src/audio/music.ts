import type { Theme } from '@fitil/content';
import type { Sfx } from './sfx.ts';

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

/** RNG simplu cu seed (doar pentru a genera tiparele melodiei, identic cu prototipul). */
function lcg(seed: number): () => number {
  let s = seed * 9301 + 49297;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

interface Patterns {
  lead: (number | null)[];
  bass: (number | null)[];
}

const cache = new Map<string, Patterns>();
function patterns(t: Theme): Patterns {
  const hit = cache.get(t.id);
  if (hit) return hit;
  const m = t.music;
  const r = lcg(m.seed);
  const lead: (number | null)[] = [];
  for (let i = 0; i < 32; i++) lead.push(r() < m.density ? Math.floor(r() * 7) : null);
  const bass = [0, null, null, 0, null, null, 4, null, 0, null, null, 0, null, 2, null, 4].map((v) =>
    v === null || r() < 0.15 ? null : v,
  );
  const p = { lead, bass };
  cache.set(t.id, p);
  return p;
}

/** Muzică generată per temă (secvențiator cu 64 de pași: bas, melodie, tobe). */
export class Music {
  private timer: ReturnType<typeof setInterval> | null = null;
  private stepN = 0;
  private next = 0;
  on = true;
  playing = false;

  constructor(private sfx: Sfx) {}

  start(): void {
    const c = this.sfx.ctx;
    if (!c || this.timer) return;
    this.next = c.currentTime + 0.1;
    this.stepN = 0;
    this.timer = setInterval(() => this.tick(), 25);
  }

  private tick(): void {
    const c = this.sfx.ctx!;
    const m = this.sfx.theme.music;
    const spb = 60 / m.bpm / 4;
    if (this.next < c.currentTime - 0.5) this.next = c.currentTime + 0.05;
    while (this.next < c.currentTime + 0.12) {
      if (this.on && this.playing) this.play(this.stepN, this.next);
      this.next += spb;
      this.stepN = (this.stepN + 1) % 64;
    }
  }

  private note(freq: number, t: number, dur: number, type: OscillatorType, vol: number): void {
    const sfx = this.sfx;
    const c = sfx.ctx!;
    const m = sfx.theme.music;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = freq;
    sfx.env(g, t, 0.01, dur, vol);
    let node: AudioNode = o.connect(g);
    if (m.filter) {
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = m.filter;
      node = g.connect(f);
    }
    node.connect(sfx.mus);
    if (m.echo) {
      const d = c.createDelay();
      d.delayTime.value = 0.33;
      const dg = c.createGain();
      dg.gain.value = 0.35;
      g.connect(d).connect(dg).connect(sfx.mus);
    }
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private play(s: number, t: number): void {
    const sfx = this.sfx;
    const th = sfx.theme;
    const m = th.music;
    const P = patterns(th);
    const i = s % 16;
    const bar = (s >> 4) % 4;
    const root = m.prog[bar]!;
    const spb = 60 / m.bpm / 4;
    const now = sfx.ctx!.currentTime;
    const b = P.bass[i];
    if (b !== null && b !== undefined)
      this.note(midi(m.base - 12 + root + m.scale[b]!), t, spb * 1.8, m.bass, 0.55);
    const l = P.lead[(bar % 2) * 16 + i];
    if (l !== null && l !== undefined)
      this.note(
        midi(m.base + 12 + root + m.scale[l]!),
        t,
        spb * (m.drums ? 1.2 : 3),
        m.lead,
        m.lead === 'sine' || m.lead === 'triangle' ? 0.45 : 0.22,
      );
    if (m.drums === 1 || m.drums === 2) {
      if (i % 8 === 0) sfx.tone(140, 45, 0.12, 'sine', 0.7, t - now, sfx.mus);
      if (i % 8 === 4) sfx.noiseHit(t, 0.1, m.drums === 2 ? 3000 : 1500, 0.35, 'highpass', sfx.mus);
      if (i % 2 === 0) sfx.noiseHit(t, 0.03, 7000, 0.12, 'highpass', sfx.mus);
    }
    if (m.drums === 3) {
      if (i % 4 === 0 || i === 6 || i === 14)
        sfx.tone(i % 8 === 0 ? 220 : 330, i % 8 === 0 ? 120 : 200, 0.12, 'sine', 0.5, t - now, sfx.mus);
      if (i % 4 === 2) sfx.noiseHit(t, 0.04, 5000, 0.15, 'highpass', sfx.mus);
    }
  }
}
