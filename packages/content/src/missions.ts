import { z } from 'zod';
import type { MissionDef } from '@fitil/sim';

/** Schema unei misiuni (aceeași formă ca `MissionDef` din sim) + textele ei. */
export const MissionSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['collect', 'demolish', 'rescue', 'race']),
  name: z.string().min(1),
  desc: z.string().min(1),
  count: z.number().int().min(1),
  dmin: z.number().int().min(3),
  dmax: z.number().int().max(24),
  armored: z.number().int().min(0).default(0),
  timeLimit: z.number().min(0).default(0),
  softDensity: z.number().min(0).max(0.9).default(0.5),
  stars: z.object({
    two: z.number().positive(),
    three: z.number().positive(),
    hp: z.number().min(0).max(100),
  }),
  spiders: z
    .object({ max: z.number().int().min(0), every: z.number().positive() })
    .default({ max: 3, every: 9 }),
});
export type Mission = z.infer<typeof MissionSchema> & MissionDef;

export const ChapterSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** Stele necesare în capitolul anterior ca să se deblocheze. */
  unlockStars: z.number().int().min(0),
  missions: z.array(z.string()).min(1),
});
export type Chapter = z.infer<typeof ChapterSchema>;

/** Misiunile din prototip (capitolul 1) și variante mai grele (capitolul 2). Distanțele sunt în pătrățele. */
export const MISSIONS: Mission[] = z.array(MissionSchema).parse([
  {
    id: 'collect-1',
    kind: 'collect',
    name: 'Collector',
    desc: 'Find 10 crystals hidden in crates. The arrow points to the nearest one.',
    count: 10,
    dmin: 5,
    dmax: 20,
    stars: { two: 150, three: 100, hp: 50 },
  },
  {
    id: 'demolish-1',
    kind: 'demolish',
    name: 'Demolition',
    desc: 'Destroy 5 red towers. Armored ones take 2 blasts.',
    count: 5,
    armored: 2,
    dmin: 6,
    dmax: 18,
    stars: { two: 150, three: 100, hp: 50 },
  },
  {
    id: 'rescue-1',
    kind: 'rescue',
    name: 'Rescue',
    desc: 'Free 3 friends from their cages and bring them home to the green flag.',
    count: 3,
    dmin: 8,
    dmax: 16,
    stars: { two: 180, three: 130, hp: 50 },
  },
  {
    id: 'race-1',
    kind: 'race',
    name: 'Race',
    desc: 'Reach the checkered flag in 60 seconds. Crates block your way.',
    count: 1,
    dmin: 19,
    dmax: 22,
    timeLimit: 60,
    softDensity: 0.3,
    stars: { two: 15, three: 25, hp: 0 },
    spiders: { max: 1, every: 14 },
  },
  {
    id: 'collect-2',
    kind: 'collect',
    name: 'Collector II',
    desc: '14 crystals, farther from home. More spiders, too.',
    count: 14,
    dmin: 8,
    dmax: 22,
    stars: { two: 200, three: 140, hp: 50 },
    spiders: { max: 4, every: 7 },
  },
  {
    id: 'demolish-2',
    kind: 'demolish',
    name: 'Demolition II',
    desc: '7 towers, 4 of them armored.',
    count: 7,
    armored: 4,
    dmin: 8,
    dmax: 21,
    stars: { two: 200, three: 140, hp: 50 },
  },
  {
    id: 'rescue-2',
    kind: 'rescue',
    name: 'Rescue II',
    desc: '4 caged friends, far from home. Don’t catch them in your blasts!',
    count: 4,
    dmin: 10,
    dmax: 19,
    stars: { two: 240, three: 170, hp: 50 },
  },
  {
    id: 'race-2',
    kind: 'race',
    name: 'Race II',
    desc: 'The flag is farther away. Still 60 seconds.',
    count: 1,
    dmin: 22,
    dmax: 24,
    timeLimit: 60,
    softDensity: 0.35,
    stars: { two: 10, three: 20, hp: 0 },
    spiders: { max: 2, every: 12 },
  },
]) as Mission[];

export const CHAPTERS: Chapter[] = z.array(ChapterSchema).parse([
  {
    id: 'c1',
    name: 'Chapter 1 — The Neighborhood',
    unlockStars: 0,
    missions: ['collect-1', 'demolish-1', 'rescue-1', 'race-1'],
  },
  {
    id: 'c2',
    name: 'Chapter 2 — Farther Out',
    unlockStars: 8,
    missions: ['collect-2', 'demolish-2', 'rescue-2', 'race-2'],
  },
]);

export const missionById = (id: string): Mission | undefined => MISSIONS.find((m) => m.id === id);

export type StarMap = Record<string, number>;

const chapterStars = (c: Chapter, stars: StarMap) => c.missions.reduce((n, id) => n + (stars[id] ?? 0), 0);

/** Capitolul e deblocat dacă ai destule stele în capitolul anterior. */
export function chapterUnlocked(i: number, stars: StarMap): boolean {
  if (i === 0) return true;
  const prev = CHAPTERS[i - 1];
  const c = CHAPTERS[i];
  return !!prev && !!c && chapterUnlocked(i - 1, stars) && chapterStars(prev, stars) >= c.unlockStars;
}

/** Misiunea e deblocată dacă e prima din capitolul deblocat sau dacă ai măcar o stea la cea dinainte. */
export function missionUnlocked(id: string, stars: StarMap): boolean {
  const ci = CHAPTERS.findIndex((c) => c.missions.includes(id));
  if (ci < 0 || !chapterUnlocked(ci, stars)) return false;
  const list = CHAPTERS[ci]!.missions;
  const i = list.indexOf(id);
  return i === 0 || (stars[list[i - 1]!] ?? 0) > 0;
}
