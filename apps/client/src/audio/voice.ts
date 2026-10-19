import type { Sfx } from './sfx.ts';

/**
 * Pachet de voce: țipete la moarte și replici (bye bye, momente de glorie, tachinări).
 * Implicit sintetizat; un pachet cu fișiere audio înlocuiește ce are și cade pe sinteză în rest.
 */
export interface VoicePack {
  id: string;
  name: string;
  scream(voice: number): void;
  /** `ch` = personajul care vorbește (id din content); pachetele cu replici per personaj îl folosesc. */
  say(line: string, pitch: number, ch?: string): void;
  /** Încarcă în avans replicile personajelor (fără efect pe sinteză). */
  preload?(chars: readonly string[]): void;
  /** Spune replica doar dacă există fișier pentru `ch` (fără sinteză); se rezolvă la final, `false` dacă n-a sunat nimic. */
  sayOwn?(line: string, ch: string): Promise<boolean>;
}

/** Țipete sintetizate + replici prin speechSynthesis (ca în prototip). */
export class SynthVoice implements VoicePack {
  id = 'synth';
  name = 'Synthesized';
  on = true;
  constructor(private sfx: Sfx) {}

  scream(voice: number): void {
    this.sfx.scream(voice);
  }

  say(line: string, pitch: number): void {
    if (!this.on || !('speechSynthesis' in window)) return;
    try {
      const u = new SpeechSynthesisUtterance(line);
      u.lang = 'en-US';
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

/** Manifestul unui pachet cu fișiere: țipete per voce și replici după text (una sau mai multe variante). */
export interface VoiceManifest {
  id: string;
  name: string;
  screams?: Record<number, string[]>;
  lines?: Record<string, string | string[]>;
  /** Replici per personaj: id personaj -> text -> variante (fișiere). Au prioritate față de `lines`. */
  characters?: Record<string, Record<string, string[]>>;
}

const pick = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[Math.floor(Math.random() * v.length)] : v;

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

  private chars = new Map<string, Promise<void>>();

  /** Încarcă fișierele globale (erorile lasă replica pe sinteză). */
  async load(): Promise<void> {
    await this.fetchAll(
      [...Object.values(this.m.screams ?? {}), ...Object.values(this.m.lines ?? {})].flat(),
    );
  }

  private async fetchAll(urls: string[]): Promise<void> {
    const c = this.sfx.ctx;
    if (!c) return;
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

  /** Replicile unui personaj, o singură dată (sunt ~30 de fișiere mici). */
  private loadChar(ch: string): Promise<void> {
    let p = this.chars.get(ch);
    if (!p) {
      p = this.fetchAll(Object.values(this.m.characters?.[ch] ?? {}).flat());
      this.chars.set(ch, p);
    }
    return p;
  }

  preload(chars: readonly string[]): void {
    for (const ch of chars) void this.loadChar(ch);
  }

  private start(url: string | undefined): AudioBufferSourceNode | null {
    const c = this.sfx.ctx;
    const b = url ? this.buffers.get(url) : undefined;
    if (!c || !b || !this.sfx.sfxOn) return null;
    const n = c.createBufferSource();
    n.buffer = b;
    n.connect(this.sfx.master);
    n.start();
    return n;
  }

  private play(url: string | undefined): boolean {
    return this.start(url) !== null;
  }

  sayOwn(line: string, ch: string): Promise<boolean> {
    const own = this.m.characters?.[ch]?.[line];
    if (!own) return Promise.resolve(false);
    const n = this.start(pick(own));
    if (!n) {
      void this.loadChar(ch);
      return Promise.resolve(false);
    }
    return new Promise((done) => {
      n.onended = () => done(true);
    });
  }

  scream(voice: number): void {
    if (!this.play(pick(this.m.screams?.[voice]))) this.fallback.scream(voice);
  }

  say(line: string, pitch: number, ch?: string): void {
    const own = ch ? this.m.characters?.[ch]?.[line] : undefined;
    if (ch && own) {
      if (this.play(pick(own))) return;
      void this.loadChar(ch); // încă nu e încărcat: data viitoare vorbește cu vocea lui
    }
    if (!this.play(pick(this.m.lines?.[line]))) this.fallback.say(line, pitch);
  }
}

/**
 * Pachetul implicit: replici generate cu Chatterbox (tools/voice), până la înregistrările finale.
 * Cheile sunt exact textele din `@fitil/content` (și „Bye bye!” din app); restul replicilor rămân pe sinteză.
 */
export const DEFAULT_VOICE: VoiceManifest = {
  id: 'chatterbox-temp',
  name: 'Chatterbox (temporar)',
  lines: {
    'Bye bye!': ['voice/bye_bye.mp3', 'voice/bye_bye_drama.mp3'],
    'Ouch!': 'voice/ouch.mp3',
    'Oh no!': 'voice/oh_no.mp3',
    'Not fair!': 'voice/not_fair.mp3',
    'My mustache!': 'voice/my_mustache.mp3',
    'I’m lightning!': 'voice/lightning.mp3',
    'I’m a legend!': 'voice/legend.mp3',
    'Too easy!': 'voice/too_easy.mp3',
    'Hurry up! The arena is shrinking!': 'voice/hurry_up.mp3',
  },
};
