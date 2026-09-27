import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

/** Vibrație scurtă: nativ pe iOS/Android, navigator.vibrate în browser. */
export function tapHaptic(): void {
  if (Capacitor.isNativePlatform()) {
    void Haptics.impact({ style: ImpactStyle.Light });
  } else {
    navigator.vibrate?.(10);
  }
}
