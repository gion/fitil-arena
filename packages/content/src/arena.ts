import { z } from 'zod';
import {
  createRng,
  crownRules,
  ctfRules,
  duelRules,
  gridForAspect,
  nextInt,
  potatoRules,
  rotateRules,
  shiftRules,
} from '@fitil/sim';
import type { Rules } from '@fitil/sim';
import { AFFINITIES } from './heroes.ts';
import type { ModeId } from './texts.ts';

const EventSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  desc: z.string().min(1),
  /** Pondere la tragerea din seed. */
  weight: z.number().int().min(1),
  /** Ce schimbă în reguli (doar câmpurile simple, deterministe). */
  rules: z.object({
    kickPct: z.number().int().min(100).max(200).optional(),
    dropPct: z.number().int().min(100).max(200).optional(),
    throwExtra: z.number().int().min(0).max(2).optional(),
    fuse: z.number().int().min(30).max(60).optional(),
    bushRate: z.number().min(0).max(0.2).optional(),
  }),
  /** Efect doar vizual în client (ceață). */
  fog: z.boolean().optional(),
});
export type ArenaEvent = z.infer<typeof EventSchema>;

/** Evenimente de arenă: unul e tras din seed-ul meciului și anunțat la start. „Calm” = niciunul. */
export const ARENA_EVENTS: ArenaEvent[] = z.array(EventSchema).parse([
  { id: 'calm', name: 'Calm day', desc: 'Nothing unusual today.', weight: 4, rules: {} },
  {
    id: 'wind',
    name: 'East wind',
    desc: 'Kicked bombs slide 50% faster.',
    weight: 2,
    rules: { kickPct: 150 },
  },
  {
    id: 'fat',
    name: 'Fat crates',
    desc: '50% more power-ups in crates.',
    weight: 2,
    rules: { dropPct: 150 },
  },
  { id: 'fog', name: 'Fog', desc: 'You can only see close by.', weight: 1, rules: {}, fog: true },
  {
    id: 'lowgrav',
    name: 'Low gravity',
    desc: 'Thrown bombs fly one tile farther.',
    weight: 1,
    rules: { throwExtra: 1 },
  },
  {
    id: 'short',
    name: 'Short fuses',
    desc: 'Bombs go off after 2 seconds.',
    weight: 1,
    rules: { fuse: 40 },
  },
  {
    id: 'bushy',
    name: 'Overgrown',
    desc: 'Bushes everywhere. Hide and ambush.',
    weight: 2,
    rules: { bushRate: 0.14 },
  },
]);

export const arenaEventById = (id: string | null): ArenaEvent | undefined =>
  ARENA_EVENTS.find((e) => e.id === id);

/** Evenimentul meciului, din seed (identic pe server și client). */
export function pickArenaEvent(seed: number): ArenaEvent {
  const total = ARENA_EVENTS.reduce((n, e) => n + e.weight, 0);
  let r = nextInt(createRng((seed ^ 0xa7e4a) >>> 0), total);
  for (const e of ARENA_EVENTS) {
    if (r < e.weight) return e;
    r -= e.weight;
  }
  return ARENA_EVENTS[0]!;
}

/** Tufișuri pe orice arenă (puține); jungla și evenimentul „Overgrown” au mai multe. */
export const BASE_BUSH_RATE = 0.04;

/** Regulile de bază ale unui mod (fără temă și eveniment). */
export function modeRules(mode: ModeId, seed: number, aspect: number): Partial<Rules> {
  switch (mode) {
    case 'ffa':
      return gridForAspect(aspect);
    case 'vs':
      return duelRules(seed);
    case 'team2':
    case 'team3':
      return { ...gridForAspect(aspect), mode: 'teams' };
    case 'ctf':
      return ctfRules(aspect);
    case 'rot':
      return rotateRules();
    case 'shift':
      return shiftRules(aspect);
    case 'crown':
      return crownRules(aspect);
    case 'potato':
      return potatoRules(aspect);
  }
}

export interface ArenaOpts {
  /** Evenimente de arenă, bonusurile noi și tufișurile (dezactivabile în camere private). */
  extras: boolean;
}

/** Regulile complete ale unui meci de arenă: modul + tema (afinitatea arenei) + evenimentul din seed. */
export function matchRules(
  mode: ModeId,
  theme: string,
  seed: number,
  aspect: number,
  opts: ArenaOpts = { extras: true },
): Partial<Rules> {
  const base = modeRules(mode, seed, aspect);
  if (!opts.extras) return base;
  const arena = AFFINITIES[theme]?.arena;
  const ev = pickArenaEvent(seed);
  return {
    ...base,
    extras: true,
    bushRate: Math.max(BASE_BUSH_RATE, arena?.bushRate ?? 0, ev.rules.bushRate ?? 0),
    throwExtra: (arena?.throwExtra ?? 0) + (ev.rules.throwExtra ?? 0),
    ...(ev.rules.kickPct ? { kickPct: ev.rules.kickPct } : {}),
    ...(ev.rules.dropPct ? { dropPct: ev.rules.dropPct } : {}),
    ...(ev.rules.fuse ? { fuse: ev.rules.fuse } : {}),
    event: ev.id,
  };
}
