import { z } from 'zod';
import { createRng, nextInt } from '@fitil/sim';
import type { HeroSpec, PassiveKind, SuperKind } from '@fitil/sim';
import { THEMES } from './themes.ts';

/** Personajele (nume de lucru; numele finale țin de checkpoint-ul de direcție artistică). */
export const HERO_IDS = ['bubu', 'zuzu', 'gogu', 'fifi', 'veta', 'maestro', 'robo'] as const;
export type HeroId = (typeof HERO_IDS)[number];
export const RARITIES = ['common', 'rare', 'epic', 'legendary'] as const;
export type Rarity = (typeof RARITIES)[number];

const SUPERS = ['bigbomb', 'dash', 'sticky', 'cluster', 'purse', 'timestop', 'warp'] as const;
const PASSIVES = ['none', 'bounce', 'guard', 'timers', 'trap'] as const;

const HeroSchema = z.object({
  name: z.string().min(1),
  rarity: z.enum(RARITIES),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  passive: z.enum(PASSIVES),
  super: z.enum(SUPERS),
  /** Statistici de start. Raritatea aduce abilități neobișnuite, nu statistici mai mari. */
  stats: z.object({
    speedSteps: z.number().int().min(0).max(2),
    /** Penalizare de viteză pentru pasivele puternice (85–100%). */
    speedPct: z.number().int().min(85).max(100),
    bombs: z.number().int().min(0).max(1),
    range: z.number().int().min(0).max(1),
    kick: z.boolean(),
  }),
  superPct: z.number().int().min(70).max(150),
  passiveText: z.string().min(1),
  superName: z.string().min(1),
  superText: z.string().min(1),
});
export type HeroDef = z.infer<typeof HeroSchema> & { super: SuperKind; passive: PassiveKind };

export const HEROES: Record<HeroId, HeroDef> = z.record(z.enum(HERO_IDS), HeroSchema).parse({
  bubu: {
    name: 'Bubu',
    rarity: 'common',
    color: '#f3f1ea',
    passive: 'none',
    super: 'bigbomb',
    stats: { speedSteps: 0, speedPct: 100, bombs: 1, range: 0, kick: false },
    superPct: 100,
    passiveText: 'No tricks, just one extra bomb at the start.',
    superName: 'Big bomb',
    superText: 'Drops a big bomb with +2 range, on top of the normal ones.',
  },
  zuzu: {
    name: 'Zuzu',
    rarity: 'rare',
    color: '#9a6436',
    passive: 'none',
    super: 'dash',
    stats: { speedSteps: 1, speedPct: 100, bombs: 0, range: 0, kick: false },
    superPct: 100,
    passiveText: 'Starts one speed level faster.',
    superName: 'Dash',
    superText: 'Dashes up to 3 tiles in the direction you face.',
  },
  gogu: {
    name: 'Gogu',
    rarity: 'rare',
    color: '#2fd3c6',
    passive: 'none',
    super: 'sticky',
    stats: { speedSteps: 0, speedPct: 100, bombs: 0, range: 0, kick: true },
    superPct: 90,
    passiveText: 'Starts with the kick.',
    superName: 'Sticky bomb',
    superText: 'Kicks a sticky bomb that sticks to the first player it hits. 1.5s fuse.',
  },
  fifi: {
    name: 'Fifi',
    rarity: 'epic',
    color: '#ff7ac8',
    passive: 'bounce',
    super: 'cluster',
    stats: { speedSteps: 0, speedPct: 100, bombs: 0, range: 0, kick: false },
    superPct: 115,
    passiveText: 'Bombs she kicks bounce off walls (twice).',
    superName: 'Cluster',
    superText: 'Four mini bombs in a cross, two tiles away.',
  },
  veta: {
    name: 'Auntie Veta',
    rarity: 'epic',
    color: '#b07cff',
    passive: 'guard',
    super: 'purse',
    stats: { speedSteps: 0, speedPct: 85, bombs: 0, range: 0, kick: false },
    superPct: 80,
    passiveText: 'Her shawl blocks one hit per match. Walks a bit slower.',
    superName: 'Handbag',
    superText: 'Swings a bomb across the arena, 4 to 9 tiles away, over walls.',
  },
  maestro: {
    name: 'Master Fitil',
    rarity: 'legendary',
    color: '#ffc83d',
    passive: 'timers',
    super: 'timestop',
    stats: { speedSteps: 0, speedPct: 100, bombs: 0, range: 0, kick: false },
    superPct: 130,
    passiveText: 'Sees every bomb’s timer. His Super charges faster.',
    superName: 'Time stop',
    superText: 'For 1.5s, everyone else’s bombs freeze. His keep ticking.',
  },
  robo: {
    name: 'Robo-Mici',
    rarity: 'legendary',
    color: '#9aa7b8',
    passive: 'trap',
    super: 'warp',
    stats: { speedSteps: 0, speedPct: 100, bombs: 0, range: 0, kick: false },
    superPct: 100,
    passiveText: 'Leaves a trap where he falls. It blows up under the next enemy.',
    superName: 'Warp',
    superText: 'Teleports to the farther portal, or to a safe spot far away.',
  },
});

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
  heroes: z.partialRecord(z.enum(HERO_IDS), ModSchema),
});

/** Afinități de arenă: fiecare temă favorizează sau încurcă puțin câteva personaje. */
export const AFFINITIES: Record<string, z.infer<typeof ThemeAffSchema>> = z
  .record(z.string(), ThemeAffSchema)
  .parse({
    clasic: { heroes: { bubu: { superPct: 110, text: 'Home turf: Super charges 10% faster.' } } },
    neon: {
      heroes: {
        maestro: { superPct: 115, text: 'Neon glow shows fuses early: Super +15%.' },
        robo: { speedPct: 110, text: 'Fully charged: +10% speed.' },
      },
    },
    pixel: {
      heroes: {
        robo: { superPct: 110, text: 'Feels at home: Super +10%.' },
        fifi: { speedPct: 90, text: 'Blocky floor: −10% speed.' },
      },
    },
    cosmos: {
      arena: { throwExtra: 1, text: 'Low gravity: thrown bombs fly one tile farther.' },
      heroes: { veta: { speedPct: 90, text: 'Floats around: −10% speed.' } },
    },
    cuburi: {
      heroes: {
        gogu: { speedPct: 110, text: 'Knows the blocks: +10% speed.' },
        zuzu: { superPct: 90, text: 'Too many corners: Super −10%.' },
        maestro: { superPct: 115, text: 'Loves a good puzzle: Super +15%.' },
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
        maestro: { lives: 1, superPct: 85, text: 'Has seen worse nights: +1 heart, but Super −15%.' },
        robo: { speedPct: 110, text: 'Spooky circuits: +10% speed.' },
        bubu: { speedPct: 90, text: 'Scared of ghosts: −10% speed.' },
      },
    },
    craciun: {
      heroes: {
        fifi: { speedPct: 110, text: 'Skates on ice: +10% speed.' },
        maestro: { superPct: 90, text: 'Cold fingers: Super −10%.' },
      },
    },
    valentin: {
      heroes: {
        fifi: { lives: 1, speedPct: 85, text: 'Full of love: +1 heart, but −15% speed.' },
        veta: { superPct: 110, text: 'Gifts in the handbag: Super +10%.' },
        gogu: { superPct: 90, text: 'Distracted: Super −10%.' },
      },
    },
    scoala: {
      heroes: {
        maestro: { superPct: 115, text: 'Teacher’s pet: Super +15%.' },
        zuzu: { speedPct: 90, text: 'No running in the halls: −10% speed.' },
      },
    },
  });

export const affinity = (hero: HeroId, theme: string): HeroMod | undefined => AFFINITIES[theme]?.heroes[hero];

/** Personajul cu afinitatea temei aplicată, gata pentru simulare. */
export function heroSpec(id: HeroId, theme: string): HeroSpec {
  const h = HEROES[id];
  const m = affinity(id, theme);
  return {
    id,
    super: h.super,
    passive: h.passive,
    speedSteps: h.stats.speedSteps,
    speedPct: Math.round((h.stats.speedPct * (m?.speedPct ?? 100)) / 100),
    bombs: h.stats.bombs,
    range: h.stats.range + (m?.range ?? 0),
    kick: h.stats.kick,
    lives: m?.lives ?? 0,
    superPct: Math.round((h.superPct * (m?.superPct ?? 100)) / 100),
  };
}

/** Personaje pentru boți, trase din seed (fără repetări cât se poate). */
export function botHeroes(seed: number, n: number, exclude: readonly HeroId[] = []): HeroId[] {
  const rng = createRng((seed ^ 0x4e705) >>> 0);
  const pool = HERO_IDS.filter((h) => !exclude.includes(h));
  const out: HeroId[] = [];
  for (let i = 0; i < n; i++) {
    if (!pool.length) pool.push(...HERO_IDS);
    out.push(pool.splice(nextInt(rng, pool.length), 1)[0]!);
  }
  return out;
}

export const isHeroId = (v: unknown): v is HeroId =>
  typeof v === 'string' && (HERO_IDS as readonly string[]).includes(v);

// fiecare temă cu afinități trebuie să existe
for (const t of Object.keys(AFFINITIES))
  if (!THEMES.some((th) => th.id === t)) throw new Error(`afinitate pentru o temă inexistentă: ${t}`);
