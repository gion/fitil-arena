/** Uneltele de dezvoltare (panoul DEV): doar în `pnpm dev` și în build-urile interne (`VITE_DEV_TOOLS=1`). */
export const DEV_TOOLS: boolean = __DEV_TOOLS__;

const KEY = 'fitil-dev-date';

/** Data suprascrisă din panoul DEV (AAAA-LL-ZZ) sau null. */
export function devDate(): string | null {
  if (!DEV_TOOLS) return null;
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setDevDate(d: string | null): void {
  try {
    if (d) localStorage.setItem(KEY, d);
    else localStorage.removeItem(KEY);
  } catch {
    /* fără stocare */
  }
}

/** „Acum” pentru calendar: teme de sezon, lansări, rotație, bonus zilnic (se poate muta din panoul DEV). */
export function now(): Date {
  const d = devDate();
  return d ? new Date(`${d}T12:00:00`) : new Date();
}
