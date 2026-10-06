import { z } from 'zod';
import type { Rarity } from './characters.ts';

/** Durata maximă a unei fatalități (s): animația nu blochează jocul (GAME_DESIGN.md). */
export const FATALITY_MAX_S = 1.2;

const FatalitySchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/),
  name: z.string().min(1),
  /** Ce se vede, într-o propoziție (galerie, magazin). */
  blurb: z.string().min(1),
  rarity: z.enum(['common', 'rare', 'epic'] as const satisfies readonly Rarity[]),
  /** Durata animației în secunde, după care victima dispare. */
  dur: z.number().positive().max(FATALITY_MAX_S),
  /** Sunetul de la început (sintetizat, `audio/sfx.ts`). */
  sfx: z.enum(['whoosh', 'thud', 'pop', 'harp', 'blow', 'ding', 'stamp']),
});
export type Fatality = z.infer<typeof FatalitySchema>;

/** Cele 7 fatalități (toate originale, cartoon, fără sânge). */
export const FATALITIES: Fatality[] = z.array(FatalitySchema).parse([
  {
    id: 'rocket',
    name: 'Rocket',
    blurb: 'Launched into the sky, vanishes like a twinkling star.',
    rarity: 'rare',
    dur: 1.2,
    sfx: 'whoosh',
  },
  {
    id: 'pancake',
    name: 'Pancake',
    blurb: 'An anvil drops. Flat as a sticker, peeled off the screen.',
    rarity: 'common',
    dur: 1.1,
    sfx: 'thud',
  },
  {
    id: 'popcorn',
    name: 'Popcorn',
    blurb: 'Pops into popcorn that rains down.',
    rarity: 'common',
    dur: 1.1,
    sfx: 'pop',
  },
  {
    id: 'ghost',
    name: 'Ghostie',
    blurb: 'A tiny ghost plays the harp and floats up.',
    rarity: 'rare',
    dur: 1.2,
    sfx: 'harp',
  },
  {
    id: 'balloon',
    name: 'Balloon',
    blurb: 'Inflates, then zips away with a rude noise.',
    rarity: 'common',
    dur: 1.2,
    sfx: 'blow',
  },
  {
    id: 'chicken',
    name: 'Rotisserie',
    blurb: 'Turns golden brown on a spit. Ding!',
    rarity: 'epic',
    dur: 1.2,
    sfx: 'ding',
  },
  {
    id: 'filed',
    name: 'Filed',
    blurb: 'Slipped into a folder and stamped REJECTED.',
    rarity: 'epic',
    dur: 1.2,
    sfx: 'stamp',
  },
]);

export const fatalityById = (id: string | null | undefined): Fatality | undefined =>
  id ? FATALITIES.find((f) => f.id === id) : undefined;

/** Prețul în Fitile după raritate (fără cutii aleatoare, BUSINESS.md). */
export const FATALITY_PRICE: Record<'common' | 'rare' | 'epic', number> = {
  common: 120,
  rare: 180,
  epic: 260,
};

const EmoteSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/),
  name: z.string().min(1),
  /** Ce apare deasupra capului (un emoji sau un cuvânt scurt). */
  icon: z.string().min(1).max(8),
  /** Replica scurtă (balon). */
  line: z.string().min(1).max(24),
  /** Cât rămâne pe ecran (s). */
  dur: z.number().positive().max(3),
  sfx: z.enum(['pop', 'harp', 'ding', 'blow', 'whoosh']),
});
export type Emote = z.infer<typeof EmoteSchema>;

export const EMOTES: Emote[] = z.array(EmoteSchema).parse([
  { id: 'gg', name: 'GG', icon: 'GG', line: 'Good game!', dur: 1.6, sfx: 'ding' },
  { id: 'laugh', name: 'Laugh', icon: '😂', line: 'Ha-ha-ha!', dur: 1.6, sfx: 'pop' },
  { id: 'cool', name: 'Cool', icon: '😎', line: 'Too easy.', dur: 1.6, sfx: 'whoosh' },
  { id: 'oops', name: 'Oops', icon: '😅', line: 'Oops!', dur: 1.6, sfx: 'blow' },
  { id: 'love', name: 'Love', icon: '💖', line: 'Love you all!', dur: 1.8, sfx: 'harp' },
  { id: 'boom', name: 'Boom', icon: '💥', line: 'Boom!', dur: 1.4, sfx: 'pop' },
]);

export const emoteById = (id: string | null | undefined): Emote | undefined =>
  id ? EMOTES.find((e) => e.id === id) : undefined;
