import { now } from './clock.ts';
import { seasonalTheme, themeById } from '@fitil/content';
import type { ModeId } from '@fitil/content';
import type { BotLevel } from '@fitil/sim';

export type View = '2d' | 'fps' | 'chase';
export type Quality = 'low' | 'medium' | 'high';

export interface Settings {
  sound: boolean;
  music: boolean;
  vibration: boolean;
  /** Efecte de mișcare (tremurat, valuri, zoom). Implicit oprite la `prefers-reduced-motion`. */
  motion: boolean;
  quality: Quality;
  view: View;
  /** Tema aleasă explicit (null = tema de sezon sau Clasic). */
  theme: string | null;
  mode: ModeId;
  bots: BotLevel;
  tutorialDone: boolean;
  /** Provocări terminate. */
  challenges: string[];
  /** Stelele misiunilor (id → 0–3), salvate local; sincronizare cu contul în Faza 6. */
  stars: Record<string, number>;
  /** Numele din camerele online. */
  name: string;
  /** Jocul clasic: fără personaje și fără încărcări (Q-005). */
  classic: boolean;
  /** Arena se înregistrează în meci, pentru „Save clip” (ultimele 10–20s). */
  clips: boolean;
  /** Statistici anonime (PostHog) și rapoarte de erori (Sentry); doar dacă build-ul are chei. */
  stats: boolean;
}

const KEY = 'fitil-settings';

const reduce = (): boolean => {
  try {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

function load(): Settings {
  const def: Settings = {
    sound: true,
    music: true,
    vibration: true,
    motion: !reduce(),
    quality: 'medium',
    view: '2d',
    theme: null,
    mode: 'ffa',
    bots: 'normal',
    tutorialDone: false,
    challenges: [],
    stars: {},
    name: '',
    classic: false,
    clips: true,
    stats: true,
  };
  try {
    const raw = localStorage.getItem(KEY);
    const st = raw ? { ...def, ...(JSON.parse(raw) as Partial<Settings>) } : def;
    return st;
  } catch {
    return def;
  }
}

export const settings: Settings = load();

export function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* stocare indisponibilă: setările rămân doar în memorie */
  }
}

/** Tema curentă: cea aleasă, altfel cea de sezon, altfel Clasic. */
export const currentTheme = () => themeById(settings.theme ?? seasonalTheme(now())?.id ?? 'clasic');
