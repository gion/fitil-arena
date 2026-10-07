import { now } from './clock.ts';
import { seasonalTheme, themeById } from '@fitil/content';
import type { ModeId } from '@fitil/content';
import type { BotLevel } from '@fitil/sim';

export type View = '2d' | 'fps' | 'chase';
export type Quality = 'low' | 'medium' | 'high';
/** Aspectul interfeței: „Comic” (implicit) sau „Toy” (`ui/toy.css`). Doar aspect, același DOM. */
export type Skin = 'comic' | 'toy';
const SKINS: readonly Skin[] = ['comic', 'toy'];

export interface Settings {
  sound: boolean;
  music: boolean;
  vibration: boolean;
  /** Efecte de mișcare (tremurat, valuri, zoom). Implicit oprite la `prefers-reduced-motion`. */
  motion: boolean;
  quality: Quality;
  skin: Skin;
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
    skin: 'comic',
    view: '2d',
    theme: null,
    mode: 'ffa',
    bots: 'normal',
    tutorialDone: false,
    challenges: [],
    stars: {},
    name: '',
    classic: false,
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

/** Skin-ul din URL (`?skin=toy`), dacă e valid: doar pentru sesiunea curentă, nu se salvează. */
function urlSkin(): Skin | null {
  try {
    const v = new URLSearchParams(location.search).get('skin');
    return SKINS.includes(v as Skin) ? (v as Skin) : null;
  } catch {
    return null;
  }
}

/**
 * Skin-ul afișat acum: cel din URL, altfel cel din setări. Setarea salvată contează doar în
 * build-urile de dezvoltare (acolo apare rândul „Look”); în rest, fără `?skin=`, e mereu „Comic” (D-073).
 */
export const currentSkin = (): Skin =>
  urlSkin() ?? (__DEV_TOOLS__ && SKINS.includes(settings.skin) ? settings.skin : 'comic');

/** Pune skin-ul pe `<html data-skin>`; CSS-ul face restul. */
export function applySkin(): void {
  document.documentElement.dataset.skin = currentSkin();
}

/** Tema curentă: cea aleasă, altfel cea de sezon, altfel Clasic. */
export const currentTheme = () => themeById(settings.theme ?? seasonalTheme(now())?.id ?? 'clasic');
