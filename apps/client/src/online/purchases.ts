import type * as RcModule from '@revenuecat/purchases-capacitor';
import { PRODUCTS } from '@fitil/content';
import type { Profile } from '@fitil/content';
import { isNative, platform } from '../native.ts';
import { account } from './account.ts';

/**
 * Cumpărăturile cu bani reali (Faza 9, D-083). În aplicație: RevenueCat (pluginul nativ, încărcat doar
 * acolo), cu `appUserID` = contul; serverul acordă produsul după validare (webhook / sincronizare).
 * În dezvoltare, cu `FAKE_PURCHASES=1` pe server: plăți simulate. Pe web: nimic de cumpărat.
 */

export type PayMode = 'native' | 'fake' | 'none';
export type BuyResult =
  { ok: true; profile: Profile } | { ok: false; why: 'cancelled' | 'error' | 'pending' };

const env = import.meta.env;
const RC_KEY = (platform === 'ios' ? env.VITE_REVENUECAT_IOS : env.VITE_REVENUECAT_ANDROID) as
  string | undefined;

type Rc = typeof RcModule;
let rc: Rc | null = null;
type StoreProduct = Awaited<ReturnType<Rc['Purchases']['getProducts']>>['products'][number];
const storeProducts = new Map<string, StoreProduct>();

export const payments = {
  mode: 'none' as PayMode,
  /** De ce nu se poate cumpăra (pentru mesajul din ecran). */
  why: 'Purchases are available in the app.',

  /** Pornește o dată, după ce contul e legat de server. */
  async init(): Promise<void> {
    if (!account.linked || !account.stored) {
      this.why = 'Connect to the internet to buy Gems.';
      return;
    }
    if (isNative && RC_KEY) {
      try {
        rc = await import('@revenuecat/purchases-capacitor');
        await rc.Purchases.configure({ apiKey: RC_KEY, appUserID: account.stored.id });
        const { products } = await rc.Purchases.getProducts({
          productIdentifiers: PRODUCTS.map((p) => p.id),
          type: rc.PRODUCT_CATEGORY.NON_SUBSCRIPTION,
        });
        for (const p of products) storeProducts.set(p.identifier, p);
        this.mode = 'native';
        return;
      } catch {
        this.why = 'The store is not available right now.';
        return;
      }
    }
    const cfg = await account.api<{ fake?: boolean }>('/purchases/config');
    if (cfg?.fake) this.mode = 'fake';
    else if (isNative) this.why = 'The store is not available right now.';
  },

  /** Prețul localizat din store (sau cel provizoriu din conținut). */
  price(id: string): string {
    return storeProducts.get(id)?.priceString ?? PRODUCTS.find((p) => p.id === id)?.priceHint ?? '';
  },

  async buy(id: string): Promise<BuyResult> {
    if (this.mode === 'fake') {
      const r = await account.post('/purchases/fake', { id });
      const p = (r.data as { profile?: Profile } | null)?.profile;
      return r.status === 200 && p ? { ok: true, profile: p } : { ok: false, why: 'error' };
    }
    const product = storeProducts.get(id);
    if (this.mode !== 'native' || !rc || !product) return { ok: false, why: 'error' };
    const before = JSON.stringify(await account.refresh());
    try {
      await rc.Purchases.purchaseStoreProduct({ product });
    } catch (e) {
      const err = e as { code?: string; userCancelled?: boolean | null };
      const cancelled = err.userCancelled || err.code === rc.PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR;
      return { ok: false, why: cancelled ? 'cancelled' : 'error' };
    }
    return this.sync(before);
  },

  /**
   * Cere serverului să acorde ce a validat store-ul. Plata poate ajunge întâi prin webhook (atunci
   * sincronizarea nu mai acordă nimic, dar profilul s-a schimbat față de `before`).
   */
  async sync(before: string | null, tries = 4): Promise<BuyResult> {
    for (let i = 0; i < tries; i++) {
      const r = await account.post('/purchases/sync', {});
      const d = r.data as { granted?: number; profile?: Profile } | null;
      if (r.status === 200 && d?.profile && ((d.granted ?? 0) > 0 || JSON.stringify(d.profile) !== before))
        return { ok: true, profile: d.profile };
      if (i < tries - 1) await new Promise((res) => setTimeout(res, 1500 * (i + 1)));
    }
    return { ok: false, why: 'pending' };
  },

  /** „Restore purchases” (cerut de App Store): produsele unice revin pe contul curent. */
  async restore(): Promise<BuyResult> {
    if (this.mode === 'native' && rc) {
      try {
        await rc.Purchases.restorePurchases();
      } catch {
        return { ok: false, why: 'error' };
      }
      const r = await this.sync(null, 1);
      if (r.ok) return r;
    }
    const p = await account.refresh();
    return p ? { ok: true, profile: p } : { ok: false, why: 'error' };
  },
};
