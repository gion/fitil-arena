import type { Db } from './db/index.ts';

/** Baza de date a procesului (camerele de joc o citesc de aici, nu din opțiunile clientului). */
let current: Db | null = null;
export const setDatabase = (db: Db | null): void => {
  current = db;
};
export const getDatabase = (): Db | null => current;
