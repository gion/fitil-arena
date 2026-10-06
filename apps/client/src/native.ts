import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar } from '@capacitor/status-bar';
import { KeepAwake } from '@capacitor-community/keep-awake';

/** Rulează ca aplicație (iOS/Android), nu în browser. */
export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform() as 'ios' | 'android' | 'web';

/** Schema deep link-urilor (`fusearena://join/ABCD`); legată de numele aplicației (Q-010). */
export const SCHEME = 'fusearena';

export interface NativeHooks {
  /** Butonul „înapoi” (Android). */
  back(): void;
  /** Aplicația trece în fundal / revine. */
  background(): void;
  foreground(): void;
  /** Codul unei camere dintr-un link de invitație. */
  join(code: string): void;
}

const CODE = /^[A-Za-z]{4}$/;

/** Codul camerei dintr-un link: `fusearena://join/ABCD`, `https://…/join/ABCD` sau `…?join=ABCD`. */
export function joinCodeFrom(url: string): string | null {
  try {
    const u = new URL(url);
    const q = u.searchParams.get('join');
    if (q && CODE.test(q)) return q.toUpperCase();
    // la schema proprie „join” e host-ul, la https e primul segment din cale
    const parts = [u.host, ...u.pathname.split('/')].filter(Boolean);
    const i = parts.indexOf('join');
    const c = i >= 0 ? parts[i + 1] : undefined;
    return c && CODE.test(c) ? c.toUpperCase() : null;
  } catch {
    return null;
  }
}

/**
 * Linkul de invitație: pagina web a jocului (`VITE_WEB_URL`, sau pagina curentă în browser) cu `?join=`,
 * deschisă în aplicație dacă e instalată, altfel jucabilă direct în browser. În aplicație fără adresă web
 * configurată rămâne schema proprie.
 */
export function inviteUrl(code: string): string {
  const web = (import.meta.env.VITE_WEB_URL as string | undefined)?.replace(/\/$/, '');
  if (web) return `${web}/?join=${code}`;
  if (!isNative) return `${location.origin}${location.pathname}?join=${code}`;
  return `${SCHEME}://join/${code}`;
}

/** Legăturile cu sistemul: înapoi, fundal, deep links, ecranul de pornire, bara de stare. */
export function initNative(h: NativeHooks): void {
  const fromPage = joinCodeFrom(location.href);
  if (fromPage) {
    // linkul web: intră o dată, apoi scoate parametrul ca o reîncărcare să nu reintre
    history.replaceState(null, '', location.pathname);
    setTimeout(() => h.join(fromPage), 0);
  }
  document.addEventListener('visibilitychange', () => (document.hidden ? h.background() : h.foreground()));
  if (!isNative) return;
  void StatusBar.hide().catch(() => {});
  void CapApp.addListener('backButton', () => h.back());
  void CapApp.addListener('appStateChange', ({ isActive }) => (isActive ? h.foreground() : h.background()));
  void CapApp.addListener('appUrlOpen', ({ url }) => {
    const c = joinCodeFrom(url);
    if (c) h.join(c);
  });
  void CapApp.getLaunchUrl()
    .then((l) => {
      const c = l?.url ? joinCodeFrom(l.url) : null;
      if (c) h.join(c);
    })
    .catch(() => {});
}

/** Ascunde ecranul de pornire (după ce jocul e gata de afișat). */
export function hideSplash(): void {
  if (isNative) void SplashScreen.hide({ fadeOutDuration: 250 }).catch(() => {});
}

/** Pe Android, „înapoi” din meniul principal trimite aplicația în fundal (nu o închide). */
export function minimize(): void {
  if (platform === 'android') void CapApp.minimizeApp().catch(() => {});
}

let lock: { release(): Promise<void> } | null = null;

/** Ecranul rămâne aprins cât ești în meci (nativ: plugin; browser: Screen Wake Lock, unde există). */
export function keepAwake(on: boolean): void {
  if (isNative) {
    void (on ? KeepAwake.keepAwake() : KeepAwake.allowSleep()).catch(() => {});
    return;
  }
  const wl = (navigator as Navigator & { wakeLock?: { request(t: 'screen'): Promise<typeof lock> } })
    .wakeLock;
  if (on && !lock && wl)
    void wl
      .request('screen')
      .then((l) => (lock = l))
      .catch(() => {});
  if (!on && lock) {
    void lock.release().catch(() => {});
    lock = null;
  }
}

/** Linkurile de store (`VITE_STORE_IOS`, `VITE_STORE_ANDROID`); goale până există paginile din store. */
export function storeLinks(): { ios: string | null; android: string | null } {
  const v = (s: unknown) => (typeof s === 'string' && s ? s : null);
  return { ios: v(import.meta.env.VITE_STORE_IOS), android: v(import.meta.env.VITE_STORE_ANDROID) };
}

/** Pe ce fel de dispozitiv rulează pagina web (pentru îndemnul la instalare). */
export function deviceOf(ua: string): 'ios' | 'android' | 'desktop' {
  if (/android/i.test(ua)) return 'android';
  if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && /mobile/i.test(ua))) return 'ios';
  return 'desktop';
}

/**
 * Îndemnul la instalare (doar pe web): linkul potrivit telefonului, ambele pe desktop, nimic
 * dacă nu există încă pagini de store.
 */
export function installLinks(ua: string): { label: string; url: string }[] {
  if (isNative) return [];
  const s = storeLinks();
  const d = deviceOf(ua);
  const out: { label: string; url: string }[] = [];
  if (s.ios && d !== 'android') out.push({ label: 'App Store', url: s.ios });
  if (s.android && d !== 'ios') out.push({ label: 'Google Play', url: s.android });
  return out;
}
