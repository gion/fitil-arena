/** Valori portate din reference/prototype.html, convertite în tick-uri (20 Hz) și unități întregi. */
export const TICK_HZ = 20;
export const TICK_MS = 1000 / TICK_HZ;
export const BOMB_FUSE_S = 2.4;
export const FLAME_S = 0.55;

/** Secunde → tick-uri (rotunjit). */
export const sec = (s: number): number => Math.round(s * TICK_HZ);

export const FUSE = sec(BOMB_FUSE_S); // 48
export const REMOTE_FUSE = sec(15);
export const FLAME = sec(FLAME_S); // 11
export const CHAIN_DELAY = 1;
export const SHIELD = sec(10);
export const GRACE = sec(0.8);
export const REVERSE = sec(8);
export const DIZZY = sec(10);
export const HICCUP = sec(6);
export const HICCUP_FIRST = sec(0.3);
export const HICCUP_EVERY = 17; // 0.85s
export const PORTAL = sec(15);

/** Viteze în unități (1/1000 pătrățel) pe tick. 3.3 pătrățele/s = 165. */
export const SPEED_START = 165;
export const SPEED_STEP = 25;
export const SPEED_MAX = 315;
export const SPEED_MIN = 115;
export const SPEED_SLOW = 30;
export const SLIDE_SPEED = 400; // 8 pătrățele/s

export const MAX_BOMBS = 8;
export const MAX_RANGE = 8;
export const LINE_MAX_EXTRA = 4;
