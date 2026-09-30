import type { Theme } from '@fitil/content';

type Wave = OscillatorType;

/**
 * Sunete sintetizate cu WebAudio (portate din prototip). Nu folosesc fișiere,
 * deci nu există probleme de licență; sunetele depind de temă (unda, filtrele).
 */
export class Sfx {
  ctx: AudioContext | null = null;
  master!: GainNode;
  mus!: GainNode;
  noise!: AudioBuffer;
  sfxOn = true;
  theme!: Theme;

  init(): void {
    if (this.ctx) {
      void this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const c = new AC();
      this.ctx = c;
      this.master = c.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(c.destination);
      this.mus = c.createGain();
      this.mus.gain.value = 0.13;
      this.mus.connect(c.destination);
      const len = c.sampleRate;
      this.noise = c.createBuffer(1, len, c.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch {
      this.ctx = null;
    }
  }

  private on(): AudioContext | null {
    return this.sfxOn ? this.ctx : null;
  }

  env(g: GainNode, t: number, a: number, dur: number, vol: number): void {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }

  tone(f1: number, f2: number, dur: number, type: Wave, vol: number, delay = 0, dest?: AudioNode): void {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime + Math.max(0, delay);
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f1, t);
    o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    this.env(g, t, 0.005, dur, vol);
    o.connect(g).connect(dest ?? this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  noiseHit(
    t: number,
    dur: number,
    freq: number,
    vol: number,
    type: BiquadFilterType = 'highpass',
    dest?: AudioNode,
  ): void {
    const c = this.ctx;
    if (!c) return;
    const n = c.createBufferSource();
    n.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = c.createGain();
    this.env(g, t, 0.002, dur, vol);
    n.connect(f)
      .connect(g)
      .connect(dest ?? this.master);
    n.start(t);
    n.stop(t + dur + 0.02);
  }

  place(): void {
    if (this.on()) this.tone(560, 240, 0.09, this.theme.wave, 0.18);
  }
  pick(): void {
    if (this.on())
      [660, 880, 1320].forEach((f, i) => this.tone(f, f * 1.01, 0.08, this.theme.wave, 0.13, i * 0.06));
  }
  kick(): void {
    const c = this.on();
    if (!c) return;
    this.tone(200, 70, 0.09, 'square', 0.3);
    this.noiseHit(c.currentTime, 0.05, 1500, 0.3);
  }
  lift(): void {
    if (this.on()) this.tone(300, 700, 0.12, 'triangle', 0.25);
  }
  throw(): void {
    if (this.on()) this.tone(700, 250, 0.3, 'triangle', 0.2);
  }
  tp(): void {
    if (!this.on()) return;
    this.tone(250, 1600, 0.28, 'sine', 0.3);
    this.tone(500, 2400, 0.28, 'sine', 0.12, 0.05);
  }
  line(): void {
    if (this.on())
      [0, 1, 2].forEach((i) => this.tone(520 + i * 90, 260, 0.07, this.theme.wave, 0.15, i * 0.05));
  }
  shield(): void {
    if (this.on()) this.tone(900, 200, 0.25, 'triangle', 0.25);
  }
  hiccup(): void {
    if (this.on()) this.tone(300, 500, 0.08, 'square', 0.12);
  }
  spiderDie(): void {
    if (this.on()) this.tone(1200, 300, 0.12, 'square', 0.08);
  }
  shiftWarn(): void {
    if (this.on()) this.tone(180, 120, 0.4, 'sawtooth', 0.12);
  }
  shiftStep(): void {
    const c = this.on();
    if (c) this.noiseHit(c.currentTime, 0.12, 300, 0.25, 'lowpass');
  }
  boom(): void {
    const c = this.on();
    if (!c) return;
    const t = c.currentTime;
    const st = this.theme.style;
    const n = c.createBufferSource();
    n.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(st === 'cosmos' ? 1200 : st === 'neon' ? 3200 : 2200, t);
    f.frequency.exponentialRampToValueAtTime(90, t + 0.7);
    const g = c.createGain();
    this.env(g, t, 0.005, 0.75, 0.9);
    n.connect(f).connect(g).connect(this.master);
    n.start(t);
    n.stop(t + 0.8);
    this.tone(110, 32, 0.45, 'sine', 0.8);
    if (st === 'neon') this.tone(900, 60, 0.5, 'sawtooth', 0.12);
    if (st === 'pixel' || st === 'cube') this.tone(160, 40, 0.35, 'square', 0.2);
  }
  thunder(v: number): void {
    const c = this.on();
    if (!c) return;
    const t = c.currentTime;
    this.noiseHit(t, 0.08, 2500, 0.5 * v);
    const n = c.createBufferSource();
    n.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(900, t);
    f.frequency.exponentialRampToValueAtTime(60, t + 1.4);
    const g = c.createGain();
    this.env(g, t + 0.03, 0.05, 1.5, 0.8 * v);
    n.connect(f).connect(g).connect(this.master);
    n.start(t);
    n.stop(t + 1.6);
  }
  bad(): void {
    if (this.on()) [440, 330, 220].forEach((f, i) => this.tone(f, f * 0.8, 0.14, 'sawtooth', 0.12, i * 0.1));
  }
  win(): void {
    if (this.on())
      [523, 659, 784, 1047].forEach((f, i) => this.tone(f, f, 0.14, this.theme.wave, 0.14, i * 0.11));
  }

  /** Țipăt comic sintetizat (vocea 0–3); uneori „trombonul trist”. */
  scream(v: number): void {
    const c = this.on();
    if (!c) return;
    const t = c.currentTime;
    if (Math.random() < 0.35) {
      [392, 370, 349, 294].forEach((f, i) => {
        const d = i === 3 ? 0.7 : 0.22;
        this.voiced(f, f * (i === 3 ? 0.92 : 1), d, t + i * 0.24, 0.28);
      });
      return;
    }
    const base =
      [330, 470, 260, 560][v % 4]! * (0.9 + Math.random() * 0.25) * (this.theme.style === 'cosmos' ? 1.3 : 1);
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(base, t);
    o.frequency.linearRampToValueAtTime(base * 2.3, t + 0.14);
    o.frequency.exponentialRampToValueAtTime(base * 0.55, t + 0.95);
    const lfo = c.createOscillator();
    const lg = c.createGain();
    lfo.frequency.value = 11 + Math.random() * 5;
    lg.gain.value = base * 0.09;
    lfo.connect(lg).connect(o.frequency);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1100, t);
    bp.frequency.linearRampToValueAtTime(700, t + 0.9);
    bp.Q.value = 3;
    const g = c.createGain();
    this.env(g, t, 0.02, 1, 0.7);
    o.connect(bp).connect(g).connect(this.master);
    o.start(t);
    lfo.start(t);
    o.stop(t + 1.05);
    lfo.stop(t + 1.05);
  }

  private voiced(f1: number, f2: number, dur: number, t: number, vol: number): void {
    const c = this.ctx!;
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f1, t);
    o.frequency.linearRampToValueAtTime(f2, t + dur);
    const lfo = c.createOscillator();
    const lg = c.createGain();
    lfo.frequency.value = 6;
    lg.gain.value = dur > 0.5 ? 9 : 0;
    lfo.connect(lg).connect(o.frequency);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1400;
    const g = c.createGain();
    this.env(g, t, 0.03, dur, vol);
    o.connect(lp).connect(g).connect(this.master);
    o.start(t);
    lfo.start(t);
    o.stop(t + dur + 0.05);
    lfo.stop(t + dur + 0.05);
  }
}
