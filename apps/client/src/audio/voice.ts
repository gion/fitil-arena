import type { Sfx } from './sfx.ts';

/**
 * Pachet de voce: țipete la moarte și replici (bye bye, momente de glorie, tachinări).
 * Implicit sintetizat; un pachet cu fișiere audio înlocuiește ce are și cade pe sinteză în rest.
 */
export interface VoicePack {
  id: string;
  name: string;
  scream(voice: number): void;
  say(line: string, pitch: number): void;
}

/** Țipete sintetizate + replici prin speechSynthesis (ca în prototip). */
export class SynthVoice implements VoicePack {
  id = 'synth';
  name = 'Sintetizat';
  on = true;
  constructor(private sfx: Sfx) {}

  scream(voice: number): void {
    this.sfx.scream(voice);
  }

  say(line: string, pitch: number): void {
    if (!this.on || !('speechSynthesis' in window)) return;
    try {
      const u = new SpeechSynthesisUtterance(line);
      u.lang = 'ro-RO';
      u.pitch = Math.min(2, pitch);
      u.rate = 1.25;
      u.volume = 0.9;
      setTimeout(() => {
        try {
          speechSynthesis.speak(u);
        } catch {
          /* fără voce pe platforma asta */
        }
      }, 350);
    } catch {
      /* ignorat */
    }
  }
}

/** Manifestul unui pachet cu fișiere: țipete per voce și replici după text. */
export interface VoiceManifest {
  id: string;
  name: string;
  screams?: Record<number, string[]>;
  lines?: Record<string, string>;
}

/** Pachet de voce din fișiere audio (URL-uri relative la aplicație). */
export class FileVoice implements VoicePack {
  readonly id: string;
  readonly name: string;
  private buffers = new Map<string, AudioBuffer>();

  constructor(
    private m: VoiceManifest,
    private sfx: Sfx,
    private fallback: VoicePack,
  ) {
    this.id = m.id;
    this.name = m.name;
  }

  /** Încarcă toate fișierele (erorile lasă replica pe sinteză). */
  async load(): Promise<void> {
    const c = this.sfx.ctx;
    if (!c) return;
    const urls = [...Object.values(this.m.screams ?? {}).flat(), ...Object.values(this.m.lines ?? {})];
    await Promise.all(
      urls.map(async (u) => {
        try {
          const r = await fetch(u);
          this.buffers.set(u, await c.decodeAudioData(await r.arrayBuffer()));
        } catch {
          /* rămâne pe sinteză */
        }
      }),
    );
  }

  private play(url: string | undefined): boolean {
    const c = this.sfx.ctx;
    const b = url ? this.buffers.get(url) : undefined;
    if (!c || !b || !this.sfx.sfxOn) return false;
    const n = c.createBufferSource();
    n.buffer = b;
    n.connect(this.sfx.master);
    n.start();
    return true;
  }

  scream(voice: number): void {
    const list = this.m.screams?.[voice];
    if (!this.play(list?.[Math.floor(Math.random() * list.length)])) this.fallback.scream(voice);
  }

  say(line: string, pitch: number): void {
    if (!this.play(this.m.lines?.[line])) this.fallback.say(line, pitch);
  }
}
