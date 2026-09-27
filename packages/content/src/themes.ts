import { z } from 'zod';

export const ThemeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  ink: z.string().regex(/^#[0-9a-f]{6}$/i),
  accent: z.string().regex(/^#[0-9a-f]{6}$/i),
  flame: z.tuple([z.string(), z.string(), z.string()]),
  seasonal: z.boolean().default(false),
});
export type Theme = z.infer<typeof ThemeSchema>;

/** Primele teme din prototip; restul se portează în Faza 2. */
export const THEMES: Theme[] = z.array(ThemeSchema).parse([
  {
    id: 'clasic',
    name: 'Clasic',
    ink: '#141726',
    accent: '#ff5a36',
    flame: ['#ff7a1a', '#ffc93a', '#fff6c4'],
  },
  { id: 'neon', name: 'Neon', ink: '#07050f', accent: '#ff2fd6', flame: ['#ff2fd6', '#29f0ff', '#ffffff'] },
]);
