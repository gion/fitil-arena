import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { settings } from './settings.ts';

/**
 * Vibrație: un număr (ms) sau un tipar [vibrează, pauză, vibrează...].
 * Pe iOS/Android folosește pluginul nativ (impact proporțional cu durata), în browser navigator.vibrate.
 */
export function vibrate(p: number | number[]): void {
  if (!settings.vibration) return;
  if (Capacitor.isNativePlatform()) {
    const pulses = Array.isArray(p) ? p.filter((_, i) => i % 2 === 0) : [p];
    let delay = 0;
    const gaps = Array.isArray(p) ? p : [p];
    pulses.forEach((ms, i) => {
      const style = ms >= 60 ? ImpactStyle.Heavy : ms >= 25 ? ImpactStyle.Medium : ImpactStyle.Light;
      setTimeout(() => void Haptics.impact({ style }), delay);
      delay += ms + (gaps[i * 2 + 1] ?? 0);
    });
    return;
  }
  try {
    navigator.vibrate?.(p);
  } catch {
    /* nesuportat */
  }
}
