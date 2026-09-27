/** RNG determinist (mulberry32). Starea e un singur uint32, deci se serializează odată cu GameState. */
export interface RngState {
  s: number;
}

export function createRng(seed: number): RngState {
  return { s: seed >>> 0 };
}

/** Întoarce un float în [0, 1) și avansează starea. */
export function nextFloat(rng: RngState): number {
  rng.s = (rng.s + 0x6d2b79f5) >>> 0;
  let t = rng.s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Întreg în [0, max). */
export function nextInt(rng: RngState, max: number): number {
  return Math.floor(nextFloat(rng) * max);
}
