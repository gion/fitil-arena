/**
 * Densitatea de pixeli a ecranului. Canvasul are rezoluția fizică (CSS × DPR), iar coordonatele
 * din scene sunt în pixeli fizici, deci totul e desenat nativ, fără scalare de browser.
 * Plafonat la 3 ca să nu omorâm GPU-ul pe telefoanele cu DPR mare.
 */
export const DPR = Math.min(window.devicePixelRatio || 1, 3);

export const viewportSize = (): { width: number; height: number } => ({
  width: Math.round(window.innerWidth * DPR),
  height: Math.round(window.innerHeight * DPR),
});

export interface Insets {
  l: number;
  r: number;
  t: number;
  b: number;
}

/**
 * Zonele sigure ale ecranului (notch, colțuri rotunjite, bara „home”), în pixeli CSS, citite din
 * `env(safe-area-inset-*)` printr-un element-sondă. Re-măsurate cel mult o dată la 250ms
 * (iOS actualizează valorile cu o mică întârziere după rotire).
 */
let probe: HTMLElement | null = null;
let cached: Insets = { l: 0, r: 0, t: 0, b: 0 };
let measuredAt = -Infinity;
export const safeInsets = (): Insets => {
  const now = performance.now();
  if (now - measuredAt < 250) return cached;
  measuredAt = now;
  if (!probe) {
    probe = document.createElement('div');
    probe.style.cssText =
      'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;' +
      'padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
    document.body.appendChild(probe);
  }
  const cs = getComputedStyle(probe);
  cached = {
    l: parseFloat(cs.paddingLeft) || 0,
    r: parseFloat(cs.paddingRight) || 0,
    t: parseFloat(cs.paddingTop) || 0,
    b: parseFloat(cs.paddingBottom) || 0,
  };
  return cached;
};
