import { z } from 'zod';
import type { CharKit, HeroSpec } from '@fitil/sim';
import { CHAR_IDS, charById } from './characters.ts';
import { THEMES } from './themes.ts';

/**
 * Afinități de arenă și `heroSpec`: partea de „erou” a unui personaj pentru simulare — Ultimate-ul
 * (tipul și viteza de încărcare) plus modificatorii temei. Statisticile de bază și semnăturile vin din
 * kitul personajului (`characters.ts`); pasivele de erou din sim nu se folosesc (D-048).
 */

/** Modificatorii unei afinități (mici: ±10–15%, maxim +1 inimă). */
const ModSchema = z.object({
  speedPct: z.number().int().min(85).max(115).optional(),
  superPct: z.number().int().min(85).max(115).optional(),
  range: z.number().int().min(-1).max(1).optional(),
  lives: z.number().int().min(0).max(1).optional(),
  text: z.string().min(1),
});
export type HeroMod = z.infer<typeof ModSchema>;

const ThemeAffSchema = z.object({
  /** Efecte pentru toată arena (ex. gravitație mică în Cosmos). */
  arena: z
    .object({
      throwExtra: z.number().int().min(0).max(1).optional(),
      bushRate: z.number().min(0).max(0.15).optional(),
      text: z.string().min(1),
    })
    .optional(),
  heroes: z.record(z.string(), ModSchema),
});

/** Afinități de arenă: fiecare temă favorizează sau încurcă puțin câteva personaje. */
export const AFFINITIES: Record<string, z.infer<typeof ThemeAffSchema>> = z
  .record(z.string(), ThemeAffSchema)
  .parse({
    clasic: { heroes: { bubu: { superPct: 110, text: 'Home turf: Ultimate charges 10% faster.' } } },
    neon: {
      heroes: {
        maestru: { superPct: 115, text: 'Neon glow shows fuses early: Ultimate +15%.' },
        robo: { speedPct: 110, text: 'Fully charged: +10% speed.' },
      },
    },
    pixel: {
      heroes: {
        robo: { superPct: 110, text: 'Feels at home: Ultimate +10%.' },
        fifi: { speedPct: 90, text: 'Blocky floor: −10% speed.' },
      },
    },
    cosmos: {
      arena: { throwExtra: 1, text: 'Low gravity: thrown bombs fly one tile farther.' },
      heroes: { veta: { speedPct: 90, text: 'Floats around: −10% speed.' } },
    },
    cuburi: {
      heroes: {
        gugu: { speedPct: 110, text: 'Knows the blocks: +10% speed.' },
        zuzu: { superPct: 90, text: 'Too many corners: Ultimate −10%.' },
        maestru: { superPct: 115, text: 'Loves a good puzzle: Ultimate +15%.' },
      },
    },
    jungla: {
      arena: { bushRate: 0.1, text: 'Thick jungle: more bushes.' },
      heroes: {
        zuzu: { speedPct: 110, text: 'A local: +10% speed.' },
        robo: { speedPct: 90, text: 'Rusts in the damp: −10% speed.' },
      },
    },
    halloween: {
      heroes: {
        maestru: { lives: 1, superPct: 85, text: 'Has seen worse nights: +1 heart, but Ultimate −15%.' },
        robo: { speedPct: 110, text: 'Spooky circuits: +10% speed.' },
        ghost: { superPct: 115, text: 'Her favourite night: Ultimate +15%.' },
        bubu: { speedPct: 90, text: 'Scared of ghosts: −10% speed.' },
      },
    },
    craciun: {
      heroes: {
        fifi: { speedPct: 110, text: 'Skates on ice: +10% speed.' },
        magician: { superPct: 110, text: 'Holiday show: Ultimate +10%.' },
        chef: { speedPct: 110, text: 'Christmas dinner rush: +10% speed.' },
        maestru: { superPct: 90, text: 'Cold fingers: Ultimate −10%.' },
      },
    },
    valentin: {
      heroes: {
        fifi: { superPct: 110, text: 'Full of love: Ultimate +10%.' },
        robo: { speedPct: 90, text: 'Love does not compute: −10% speed.' },
        veta: { superPct: 110, text: 'Gifts in the handbag: Ultimate +10%.' },
        gugu: { superPct: 90, text: 'Distracted: Ultimate −10%.' },
      },
    },
    scoala: {
      heroes: {
        maestru: { superPct: 115, text: 'Teacher’s pet: Ultimate +15%.' },
        zuzu: { speedPct: 90, text: 'No running in the halls: −10% speed.' },
        striker: { superPct: 110, text: 'Schoolyard champion: Ultimate +10%.' },
      },
    },
  });

export const affinity = (ch: string, theme: string): HeroMod | undefined => AFFINITIES[theme]?.heroes[ch];

/** Partea de erou a personajului, cu afinitatea temei aplicată, gata pentru simulare (lângă kit). */
export function heroSpec(ch: string, theme: string): HeroSpec {
  const c = charById(ch);
  const m = affinity(c.id, theme);
  return {
    id: c.id,
    super: c.ultimate.kind,
    passive: 'none',
    speedSteps: 0,
    speedPct: m?.speedPct ?? 100,
    bombs: 0,
    range: m?.range ?? 0,
    kick: false,
    lives: m?.lives ?? 0,
    superPct: Math.round((c.ultimate.pct * (m?.superPct ?? 100)) / 100),
  };
}

/** Tot ce are nevoie simularea pentru un jucător cu personaj: id, kit (semnături) și erou (Ultimate + afinități). */
export const charSetup = (ch: string, theme: string): { ch: string; kit: CharKit; hero: HeroSpec } => {
  const c = charById(ch);
  return { ch: c.id, kit: c.kit, hero: heroSpec(c.id, theme) };
};

// fiecare afinitate trebuie să fie pentru o temă și un personaj care există
for (const [t, a] of Object.entries(AFFINITIES)) {
  if (!THEMES.some((th) => th.id === t)) throw new Error(`afinitate pentru o temă inexistentă: ${t}`);
  for (const ch of Object.keys(a.heroes))
    if (!CHAR_IDS.includes(ch)) throw new Error(`afinitate pentru un personaj inexistent: ${ch}`);
}
