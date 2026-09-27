import { z } from 'zod';

const hex = z.string().regex(/^#[0-9a-f]{6}$/i);
const WAVES = ['sine', 'square', 'sawtooth', 'triangle'] as const;

/** Stilul de desen procedural (fiecare are desene proprii pentru podea, pereți, lăzi, bombe, personaje). */
export const STYLES = [
  'classic',
  'neon',
  'pixel',
  'cosmos',
  'cube',
  'jungle',
  'halloween',
  'xmas',
  'valentine',
  'school',
] as const;
export type ThemeStyle = (typeof STYLES)[number];

export const MusicSchema = z.object({
  bpm: z.number().min(40).max(220),
  /** Nota MIDI de bază. */
  base: z.number().int(),
  scale: z.array(z.number().int()).min(5),
  /** Progresia de acorduri (semitonuri față de bază), câte una pe măsură. */
  prog: z.array(z.number().int()).length(4),
  lead: z.enum(WAVES),
  bass: z.enum(WAVES),
  /** 0 fără tobe, 1 rock, 2 rapid, 3 percuție de junglă. */
  drums: z.number().int().min(0).max(3),
  density: z.number().min(0).max(1),
  seed: z.number().int(),
  echo: z.boolean().default(false),
  /** Filtru trece-jos pe muzică (Hz). */
  filter: z.number().optional(),
});

export const ThemeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  style: z.enum(STYLES),
  ink: hex,
  accent: hex,
  accentDark: hex,
  flame: z.tuple([hex, hex, hex]),
  /** Colțuri rotunjite la flăcări, bonusuri, chenare. */
  round: z.boolean(),
  portal: hex,
  /** Înlocuiri de culori de personaj pe temele unde s-ar pierde pe fundal. */
  tint: z.record(z.string(), hex).default({}),
  /** Temă de eveniment: perioada în care e aleasă automat (lună 1–12, zi). */
  season: z
    .object({ from: z.tuple([z.number(), z.number()]), to: z.tuple([z.number(), z.number()]) })
    .nullable()
    .default(null),
  /** Unda sunetelor sintetizate (pus bomba, bonus, victorie). */
  wave: z.enum(WAVES),
  music: MusicSchema,
  /** Culori pentru vederea 3D: podea, perete, ladă, cer, bombă. */
  c3: z.object({ ground: hex, hard: hex, soft: hex, sky: hex, bomb: hex }),
  /** Culorile așchiilor de ladă. */
  debris: z.tuple([hex, hex]),
  /** Câte elemente ambientale plutesc (fulgi, inimioare, lilieci, avioane). */
  ambient: z.number().int().min(0).default(0),
});
export type Theme = z.infer<typeof ThemeSchema>;
export type ThemeInput = z.input<typeof ThemeSchema>;

const MAJ = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16];
const MIN = [0, 2, 3, 5, 7, 8, 10, 12, 14, 15];
const PEN = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];

/** Cele 10 teme din prototip: 6 de bază + 4 de eveniment (sezon automat). */
export const THEMES: Theme[] = z.array(ThemeSchema).parse([
  {
    id: 'clasic',
    name: 'Clasic',
    style: 'classic',
    ink: '#141726',
    accent: '#ff5a36',
    accentDark: '#c63a1c',
    flame: ['#ff7a1a', '#ffc93a', '#fff6c4'],
    round: true,
    portal: '#b18cff',
    wave: 'square',
    music: {
      bpm: 132,
      base: 48,
      scale: MAJ,
      prog: [0, 5, 7, 5],
      lead: 'square',
      bass: 'triangle',
      drums: 1,
      density: 0.55,
      seed: 3,
    },
    c3: { ground: '#679d48', hard: '#646c85', soft: '#c8834a', sky: '#9fd3ff', bomb: '#1b1c26' },
    debris: ['#c8834a', '#8a5228'],
  },
  {
    id: 'neon',
    name: 'Neon',
    style: 'neon',
    ink: '#07050f',
    accent: '#ff2fd6',
    accentDark: '#9a1080',
    flame: ['#ff2fd6', '#29f0ff', '#ffffff'],
    round: true,
    portal: '#29f0ff',
    tint: { '#9a6436': '#ff9a4a' },
    wave: 'sawtooth',
    music: {
      bpm: 108,
      base: 45,
      scale: MIN,
      prog: [0, 8, 10, 7],
      lead: 'sawtooth',
      bass: 'sawtooth',
      drums: 1,
      density: 0.5,
      seed: 11,
      filter: 1800,
    },
    c3: { ground: '#0b0718', hard: '#ff3df0', soft: '#29f0ff', sky: '#07050f', bomb: '#16102a' },
    debris: ['#29f0ff', '#0d1f2b'],
  },
  {
    id: 'pixel',
    name: '8-Bit',
    style: 'pixel',
    ink: '#1b1430',
    accent: '#e0401a',
    accentDark: '#8a2410',
    flame: ['#e0401a', '#ffb400', '#fff7a8'],
    round: false,
    portal: '#3ad0ff',
    wave: 'square',
    music: {
      bpm: 152,
      base: 52,
      scale: MAJ,
      prog: [0, 5, 7, 0],
      lead: 'square',
      bass: 'square',
      drums: 2,
      density: 0.7,
      seed: 7,
    },
    c3: { ground: '#e3b978', hard: '#8a8a99', soft: '#b5532e', sky: '#6fb6ff', bomb: '#1a1a24' },
    debris: ['#b5532e', '#6e2f18'],
  },
  {
    id: 'cosmos',
    name: 'Cosmos',
    style: 'cosmos',
    ink: '#05071a',
    accent: '#6a5cff',
    accentDark: '#3a2fa0',
    flame: ['#6a5cff', '#b58cff', '#ffffff'],
    round: true,
    portal: '#7dffcf',
    wave: 'sine',
    music: {
      bpm: 84,
      base: 43,
      scale: PEN,
      prog: [0, 3, 5, -2],
      lead: 'sine',
      bass: 'triangle',
      drums: 0,
      density: 0.3,
      seed: 21,
      echo: true,
    },
    c3: { ground: '#0a0e2a', hard: '#4a5470', soft: '#7a6a5e', sky: '#05071a', bomb: '#2f3552' },
    debris: ['#7a6a5e', '#5e5148'],
  },
  {
    id: 'cuburi',
    name: 'Cuburi',
    style: 'cube',
    ink: '#1a2118',
    accent: '#6bb043',
    accentDark: '#3f6e26',
    flame: ['#d9531e', '#ffb72b', '#fff0a0'],
    round: false,
    portal: '#b04fff',
    wave: 'triangle',
    music: {
      bpm: 92,
      base: 50,
      scale: PEN,
      prog: [0, -3, 5, 0],
      lead: 'triangle',
      bass: 'triangle',
      drums: 0,
      density: 0.35,
      seed: 5,
    },
    c3: { ground: '#5fa33a', hard: '#8b8b8b', soft: '#b3834f', sky: '#8ec5ff', bomb: '#2b2b2b' },
    debris: ['#b3834f', '#8a6238'],
  },
  {
    id: 'jungla',
    name: 'Junglă',
    style: 'jungle',
    ink: '#0f1f14',
    accent: '#ff8a1a',
    accentDark: '#a4520a',
    flame: ['#ff6a1a', '#ffc93a', '#fff6c4'],
    round: true,
    portal: '#ffe14a',
    wave: 'triangle',
    music: {
      bpm: 118,
      base: 48,
      scale: PEN,
      prog: [0, 5, 0, 7],
      lead: 'triangle',
      bass: 'sine',
      drums: 3,
      density: 0.5,
      seed: 9,
    },
    c3: { ground: '#326f3c', hard: '#6b6b5c', soft: '#3f9a45', sky: '#8fcf9c', bomb: '#6b4226' },
    debris: ['#4fb055', '#2f7a36'],
  },
  {
    id: 'halloween',
    name: 'Halloween',
    style: 'halloween',
    ink: '#140a1c',
    accent: '#ff7a1a',
    accentDark: '#a4480a',
    flame: ['#7a2bff', '#7dff6a', '#eaffd0'],
    round: true,
    portal: '#7dff6a',
    season: { from: [10, 1], to: [11, 5] },
    wave: 'square',
    music: {
      bpm: 96,
      base: 45,
      scale: MIN,
      prog: [0, 1, 0, -2],
      lead: 'square',
      bass: 'triangle',
      drums: 1,
      density: 0.45,
      seed: 13,
      echo: true,
      filter: 1600,
    },
    c3: { ground: '#2f263f', hard: '#6b6d7c', soft: '#ff8a1a', sky: '#1a0f2a', bomb: '#1b1523' },
    debris: ['#ff8a1a', '#3a1a05'],
    ambient: 6,
  },
  {
    id: 'craciun',
    name: 'Crăciun',
    style: 'xmas',
    ink: '#0e1a2a',
    accent: '#e0302f',
    accentDark: '#8a1a1a',
    flame: ['#e0302f', '#ffd23f', '#ffffff'],
    round: true,
    portal: '#4fd8ff',
    tint: { '#f3f1ea': '#ffb870' },
    season: { from: [12, 1], to: [1, 6] },
    wave: 'triangle',
    music: {
      bpm: 138,
      base: 52,
      scale: MAJ,
      prog: [0, 5, 7, 0],
      lead: 'triangle',
      bass: 'sine',
      drums: 1,
      density: 0.6,
      seed: 25,
    },
    c3: { ground: '#eef4fb', hard: '#a9d4f0', soft: '#e0302f', sky: '#cfe3f5', bomb: '#c8202a' },
    debris: ['#e0302f', '#ffd23f'],
    ambient: 70,
  },
  {
    id: 'valentin',
    name: 'Valentine',
    style: 'valentine',
    ink: '#2a0f1c',
    accent: '#ff4d8a',
    accentDark: '#a01f4f',
    flame: ['#ff3d7f', '#ff9ac0', '#fff0f6'],
    round: true,
    portal: '#ff4d8a',
    season: { from: [2, 1], to: [2, 15] },
    wave: 'sine',
    music: {
      bpm: 96,
      base: 50,
      scale: MAJ,
      prog: [0, 9, 5, 7],
      lead: 'sine',
      bass: 'triangle',
      drums: 0,
      density: 0.4,
      seed: 17,
      echo: true,
    },
    c3: { ground: '#ffd9e6', hard: '#d8406e', soft: '#c8305a', sky: '#ffd6e6', bomb: '#e0306a' },
    debris: ['#c8305a', '#ff9ac0'],
    ambient: 16,
  },
  {
    id: 'scoala',
    name: 'Școala',
    style: 'school',
    ink: '#15202a',
    accent: '#2f7de0',
    accentDark: '#1a4c8a',
    flame: ['#ff7a1a', '#ffc93a', '#fff6c4'],
    round: true,
    portal: '#2f7de0',
    tint: { '#f3f1ea': '#9ad7ff' },
    season: { from: [9, 1], to: [9, 30] },
    wave: 'square',
    music: {
      bpm: 124,
      base: 48,
      scale: MAJ,
      prog: [0, 7, 9, 5],
      lead: 'square',
      bass: 'triangle',
      drums: 2,
      density: 0.55,
      seed: 31,
    },
    c3: { ground: '#fbf8ee', hard: '#e9e2cf', soft: '#b88a52', sky: '#a8d8ff', bomb: '#d83a2a' },
    debris: ['#c9a06a', '#ffd23f'],
    ambient: 4,
  },
] satisfies ThemeInput[]);

export const themeById = (id: string): Theme => THEMES.find((t) => t.id === id) ?? THEMES[0]!;

const inWindow = (m: number, d: number, [fm, fd]: [number, number], [tm, td]: [number, number]): boolean => {
  const v = m * 100 + d;
  const a = fm * 100 + fd;
  const b = tm * 100 + td;
  return a <= b ? v >= a && v <= b : v >= a || v <= b; // fereastră peste Anul Nou (Crăciun)
};

/** Tema de sezon pentru o dată (sau null în afara evenimentelor). */
export function seasonalTheme(date: Date): Theme | null {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return THEMES.find((t) => t.season && inWindow(m, d, t.season.from, t.season.to)) ?? null;
}
