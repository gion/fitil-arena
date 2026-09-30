import type { BotLevel } from '@fitil/sim';
import { seasonalTheme, themeById } from '@fitil/content';
import type { ModeId } from '@fitil/content';

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
  };
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...def, ...(JSON.parse(raw) as Partial<Settings>) } : def;
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
export const currentTheme = () => themeById(settings.theme ?? seasonalTheme(new Date())?.id ?? 'clasic');
