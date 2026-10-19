import { describe, expect, it, vi } from 'vitest';
import { FileVoice } from '../src/audio/voice.ts';
import type { VoicePack } from '../src/audio/voice.ts';
import type { Sfx } from '../src/audio/sfx.ts';

/** Sfx cu un AudioContext fals: decodeAudioData întoarce un buffer numit după octeți, iar `start` notează ce a sunat. */
function setup() {
  const played: string[] = [];
  const ctx = {
    decodeAudioData: (b: ArrayBuffer) => Promise.resolve({ name: new TextDecoder().decode(b) }),
    createBufferSource: () => {
      const n = {
        buffer: { name: '' },
        onended: null as null | (() => void),
        connect: () => undefined,
        start: () => {
          played.push(n.buffer.name);
          setTimeout(() => n.onended?.(), 0);
        },
      };
      return n;
    },
  };
  const sfx = { ctx, sfxOn: true, master: {} } as unknown as Sfx;
  vi.stubGlobal('fetch', (u: string) =>
    Promise.resolve({ arrayBuffer: () => Promise.resolve(new TextEncoder().encode(u).buffer) }),
  );
  const said: string[] = [];
  const fallback = { say: (l: string) => said.push(l), scream: () => undefined } as unknown as VoicePack;
  const v = new FileVoice(
    {
      id: 't',
      name: 't',
      lines: { 'Too easy!': 'voice/too_easy.mp3' },
      characters: { gugu: { 'Too easy!': ['voice/gugu/win_1.mp3'] } },
    },
    sfx,
    fallback,
  );
  return { v, played, said };
}

describe('FileVoice cu replici per personaj', () => {
  it('folosește fișierul personajului după preload și cel global pentru alții', async () => {
    const { v, played, said } = setup();
    await v.load();
    v.preload(['gugu']);
    await new Promise((r) => setTimeout(r, 0));
    v.say('Too easy!', 1, 'gugu');
    v.say('Too easy!', 1, 'zuzu');
    v.say('Too easy!', 1);
    expect(played).toEqual(['voice/gugu/win_1.mp3', 'voice/too_easy.mp3', 'voice/too_easy.mp3']);
    expect(said).toEqual([]);
  });

  it('prima replică înainte de preload cade pe cea globală, apoi se încarcă', async () => {
    const { v, played } = setup();
    await v.load();
    v.say('Too easy!', 1, 'gugu');
    expect(played).toEqual(['voice/too_easy.mp3']);
    await new Promise((r) => setTimeout(r, 0));
    v.say('Too easy!', 1, 'gugu');
    expect(played[1]).toBe('voice/gugu/win_1.mp3');
  });

  it('o replică fără fișier merge pe sinteză', async () => {
    const { v, said } = setup();
    await v.load();
    v.say('Altceva', 1, 'gugu');
    expect(said).toEqual(['Altceva']);
  });

  it('sayOwn: se rezolvă la finalul replicii; fără fișier întoarce false și nu apelează sinteza', async () => {
    const { v, played, said } = setup();
    await v.load();
    v.preload(['gugu']);
    await new Promise((r) => setTimeout(r, 0));
    expect(await v.sayOwn('Too easy!', 'gugu')).toBe(true);
    expect(await v.sayOwn('Too easy!', 'zuzu')).toBe(false);
    expect(await v.sayOwn('Altceva', 'gugu')).toBe(false);
    expect(played).toEqual(['voice/gugu/win_1.mp3']);
    expect(said).toEqual([]);
  });
});
