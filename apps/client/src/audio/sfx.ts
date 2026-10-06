import type { Theme } from '@fitil/content';

type Wave = OscillatorType;

/** Sunetele de interfață (`docs/design/ui.md`, „Interacțiune”). */
export type UiSound = 'pop' | 'tick' | 'stamp' | 'stampOff' | 'pick' | 'nope' | 'tada' | 'whoosh' | 'down';

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
  /* ---------- interfața (fixe, nu depind de temă; mai încete decât meciul, cel mult unul la 60 ms) ---------- */

  private uiAt = 0;

  ui(kind: UiSound): void {
    const c = this.on();
    if (!c) return;
    const now = c.currentTime;
    if (now - this.uiAt < 0.06) return;
    this.uiAt = now;
    switch (kind) {
      case 'pop':
        this.tone(320, 120, 0.09, 'sine', 0.22);
        this.noiseHit(now, 0.03, 900, 0.05, 'lowpass');
        break;
      case 'tick':
        this.tone(1800, 1400, 0.025, 'square', 0.035);
        break;
      case 'stamp':
      case 'stampOff':
        this.noiseHit(now, 0.07, kind === 'stamp' ? 700 : 380, 0.22, 'lowpass');
        this.tone(kind === 'stamp' ? 220 : 140, 70, 0.08, 'sine', 0.2);
        break;
      case 'pick':
        this.tone(660, 660, 0.06, 'triangle', 0.09);
        this.tone(990, 990, 0.08, 'triangle', 0.09, 0.06);
        break;
      case 'nope':
        this.tone(150, 140, 0.07, 'sawtooth', 0.06);
        this.tone(150, 130, 0.07, 'sawtooth', 0.06, 0.1);
        break;
      case 'tada':
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, f, 0.12, 'triangle', 0.1, i * 0.08));
        break;
      case 'whoosh': {
        const n = c.createBufferSource();
        n.buffer = this.noise;
        const f = c.createBiquadFilter();
        f.type = 'bandpass';
        f.Q.value = 1.2;
        f.frequency.setValueAtTime(300, now);
        f.frequency.exponentialRampToValueAtTime(2400, now + 0.22);
        f.frequency.exponentialRampToValueAtTime(500, now + 0.45);
        const g = c.createGain();
        this.env(g, now, 0.12, 0.5, 0.12);
        n.connect(f).connect(g).connect(this.master);
        n.start(now);
        n.stop(now + 0.55);
        break;
      }
      case 'down':
        [520, 390, 260].forEach((f, i) => this.tone(f, f * 0.85, 0.16, 'triangle', 0.12, i * 0.13));
        break;
    }
  }

  /** Fitilul care arde (start de meci): sfârâit cât durează, oprit de `stop()`. */
  sizzle(dur: number): { stop(): void } {
    const c = this.on();
    if (!c) return { stop() {} };
    const t = c.currentTime;
    const n = c.createBufferSource();
    n.buffer = this.noise;
    n.loop = true;
    const f = c.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 3500;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.07, t + 0.1);
    g.gain.setValueAtTime(0.07, t + Math.max(0.1, dur - 0.05));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(f).connect(g).connect(this.master);
    n.start(t);
    n.stop(t + dur + 0.05);
    return {
      stop: () => {
        try {
          n.stop();
        } catch {
          /* deja oprit */
        }
      },
    };
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

  /** Vocea unui personaj (sau a unui pachet din magazin): câteva silabe sintetizate (portate din prototip). */
  voiceLine(v: string): void {
    const c = this.on();
    if (!c) return;
    const t = c.currentTime;
    const blip = (
      f0: number,
      f1: number,
      st: number,
      dur: number,
      type: Wave = 'sawtooth',
      vol = 0.3,
      q = 2,
      fc = 1200,
      vib = 0,
    ) => {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f0, t + st);
      o.frequency.exponentialRampToValueAtTime(f1, t + st + dur);
      if (vib) {
        const l = c.createOscillator();
        const lg = c.createGain();
        l.frequency.value = vib;
        lg.gain.value = f0 * 0.05;
        l.connect(lg).connect(o.frequency);
        l.start(t + st);
        l.stop(t + st + dur + 0.05);
      }
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = fc;
      bp.Q.value = q;
      const g = c.createGain();
      this.env(g, t + st, 0.012, dur, vol);
      o.connect(bp).connect(g).connect(this.master);
      o.start(t + st);
      o.stop(t + st + dur + 0.05);
    };
    switch (v) {
      case 'hihi':
        [0, 0.14, 0.28].forEach((st, i) =>
          blip(820 + i * 50, 1080 + i * 50, st, 0.1, 'sawtooth', 0.4, 3, 1900),
        );
        break;
      case 'hoho':
        [0, 0.24, 0.48].forEach((st) => blip(155, 118, st, 0.19, 'sawtooth', 0.6, 2, 480));
        break;
      case 'yeehaw':
        blip(380, 980, 0, 0.22, 'sawtooth', 0.4, 2, 1400);
        blip(980, 420, 0.24, 0.32, 'sawtooth', 0.4, 2, 1100);
        break;
      case 'whistle':
        blip(1300, 1950, 0, 0.18, 'sine', 0.3, 1, 1600);
        blip(1950, 1250, 0.22, 0.24, 'sine', 0.3, 1, 1600);
        break;
      case 'vai':
        blip(460, 300, 0, 0.6, 'sawtooth', 0.4, 2, 1000, 6);
        break;
      case 'muahaha':
        [0, 0.16, 0.32, 0.48].forEach((st, i) =>
          blip(310 - i * 25, 265 - i * 25, st, 0.13, 'sawtooth', 0.45, 2, 800),
        );
        blip(700, 1150, 0.68, 0.26, 'sawtooth', 0.3, 3, 1500);
        break;
      case 'robot':
        for (const [f, st] of [
          [600, 0],
          [400, 0.12],
          [820, 0.24],
          [520, 0.36],
        ] as const)
          blip(f, f, st, 0.09, 'square', 0.18, 1, f);
        break;
      case 'whoosh':
        // fluierul arbitrului: trei țignale scurte
        [0, 0.16, 0.32].forEach((st, i) =>
          blip(2600, 2500, st, i === 2 ? 0.3 : 0.1, 'sine', 0.25, 1, 2600, 30),
        );
        break;
      case 'sizzle':
        if (this.noise) this.noiseHit(t, 0.5, 3500, 0.2, 'highpass');
        blip(520, 700, 0.1, 0.25, 'sawtooth', 0.3, 2, 1100);
        break;
      case 'boo':
        blip(220, 180, 0, 0.8, 'sine', 0.45, 1, 400, 5);
        break;
      case 'tada':
        blip(523, 523, 0, 0.14, 'triangle', 0.35, 1, 1000);
        blip(784, 790, 0.16, 0.4, 'triangle', 0.35, 1, 1400);
        break;
      case 'pirate':
        blip(185, 110, 0, 0.5, 'sawtooth', 0.6, 3, 600, 16);
        break;
      case 'opera':
        blip(660, 700, 0, 0.75, 'sine', 0.4, 1, 660, 6);
        blip(880, 930, 0.38, 0.6, 'triangle', 0.22, 1, 880, 6);
        break;
      case 'cat':
        blip(700, 1050, 0, 0.16, 'sawtooth', 0.35, 4, 1500);
        blip(1050, 600, 0.16, 0.32, 'sawtooth', 0.35, 4, 1300);
        break;
    }
  }
}
