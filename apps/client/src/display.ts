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
