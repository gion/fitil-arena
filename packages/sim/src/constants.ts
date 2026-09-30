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
/** Misiuni: daune (procente de viață), invulnerabilitate după lovitură, inimă. */
export const HURT_FLAME = 35;
export const HURT_SPIDER = 20;
export const HURT_GRACE = sec(1.2);
export const HEART_HP = 25;

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

/** Lăzi blestemate. */
export const CURSE_DELAY = sec(0.7);
export const MOB_LIFE = sec(14);
/** Păianjeni: ≈3–3.4 pătrățele/s, atingerea (distanță Manhattan < 0.6) omoară. */
export const SPIDER_SPEED = 150;
export const SPIDER_SPEED_VAR = 21;
export const SPIDER_HIT = 600;
/** Nori: ≈1.5–1.8 pătrățele/s, încărcare 1.1s, fulger la 2–3.5s. */
export const CLOUD_SPEED = 75;
export const CLOUD_SPEED_VAR = 16;
export const CLOUD_CHARGE = sec(1.1);

/** Rânduri mobile: anunț 1.6s, un pas la 0.34s, 3–6 pași, pauză 3.5–6.5s. */
export const SHIFT_WARN = sec(1.6);
export const SHIFT_STEP = 7;
export const SHIFT_FIRST = sec(4);

/** Arena rotativă (micro-grade): 4°/s → 14°/s în ~90s, sensul se inversează la 25s. */
export const ROT_FLIP = sec(25);

/** Capturează steagul. */
export const CTF_TIME = sec(180);
export const CTF_NEED = 3;
export const FLAG_RETURN = sec(10);
export const RESPAWN = sec(3);
export const RESPAWN_SHIELD = sec(2);
/** Purtătorul steagului e cu 15% mai lent. */
export const CARRIER_SPEED_PCT = 85;

// personaje
/** Încărcările abilităților luate din arenă când `Rules.charges` e activ. */
export const CHARGES = { kick: 3, glove: 3, remote: 2, line: 2 } as const;
export const CHARGE_MAX = 9;
export const LIFE_GRACE = sec(1.8);
export const BIG_BOMB_EXTRA = 2;
export const OIL = sec(2);
export const OIL_SPEED_PCT = 60;
export const GHOST_CD = sec(20);
