import { z } from 'zod';
import { CHARACTERS, VOICE_IDS } from './characters.ts';
import { EMOTES, FATALITIES, FATALITY_PRICE } from './fatalities.ts';

/** Categoriile magazinului (totul e cosmetic, Q-004). */
export const SHOP_CATS = ['color', 'hat', 'acc', 'bomb', 'trail', 'voice', 'fatality', 'emote'] as const;
export type ShopCat = (typeof SHOP_CATS)[number];

export const CAT_NAMES: Record<ShopCat, string> = {
  color: 'Colors',
  hat: 'Hats',
  acc: 'Accessories',
  bomb: 'Bombs',
  trail: 'Trails',
  voice: 'Voices',
  fatality: 'Fatalities',
  emote: 'Emotes',
};

const ItemSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/),
  cat: z.enum(SHOP_CATS),
  name: z.string().min(1),
  price: z.number().int().min(0),
  /** Culoare: a corpului (color), a bombei (bomb), a urmei (trail); `rainbow` = animată. */
  col: z.string().optional(),
  /** Forma urmei. */
  shape: z.enum(['star', 'ring', 'heart', 'dot']).optional(),
  voice: z.enum(VOICE_IDS).optional(),
  /** Fatalitatea (id din `fatalities.ts`) sau emote-ul. */
  fatality: z.string().optional(),
  emote: z.string().optional(),
  quips: z.array(z.string()).optional(),
  win: z.array(z.string()).optional(),
  /** Obiect exclusiv: nu se cumpără, se deblochează la nivelul personajului. */
  unlock: z.object({ char: z.string(), level: z.number().int().min(2).max(10) }).optional(),
});
export type ShopItem = z.infer<typeof ItemSchema>;

export const SHOP: ShopItem[] = z.array(ItemSchema).parse([
  { id: 'c_green', cat: 'color', name: 'Green', price: 0, col: '#5ad15a' },
  { id: 'c_red', cat: 'color', name: 'Hot red', price: 40, col: '#ff4a3d' },
  { id: 'c_purple', cat: 'color', name: 'Purple', price: 40, col: '#a45cff' },
  { id: 'c_black', cat: 'color', name: 'Black', price: 80, col: '#2c2c38' },
  { id: 'c_gold', cat: 'color', name: 'Gold', price: 120, col: '#ffc933' },
  { id: 'c_rainbow', cat: 'color', name: 'Rainbow', price: 200, col: 'rainbow' },
  // culorile exclusive de la nivelul 5 al fiecărui personaj
  ...CHARACTERS.map((c) => ({
    id: `sig_${c.id}`,
    cat: 'color',
    name: `${c.name} signature`,
    price: 0,
    col: c.signatureColor,
    unlock: { char: c.id, level: 5 },
  })),
  { id: 'h_cap', cat: 'hat', name: 'Cap', price: 50 },
  { id: 'h_party', cat: 'hat', name: 'Party hat', price: 60 },
  { id: 'h_top', cat: 'hat', name: 'Top hat', price: 80 },
  { id: 'h_cowboy', cat: 'hat', name: 'Cowboy hat', price: 90 },
  { id: 'h_crown', cat: 'hat', name: 'Crown', price: 200 },
  { id: 'a_mustache', cat: 'acc', name: 'Mustache', price: 40 },
  { id: 'a_scarf', cat: 'acc', name: 'Scarf', price: 50 },
  { id: 'a_shades', cat: 'acc', name: 'Sunglasses', price: 60 },
  { id: 'b_candy', cat: 'bomb', name: 'Candy', price: 70, col: '#ff8ac8' },
  { id: 'b_melon', cat: 'bomb', name: 'Watermelon', price: 80, col: '#2f9a3a' },
  { id: 'b_skull', cat: 'bomb', name: 'Skull', price: 100, col: '#f0ece0' },
  { id: 'b_disco', cat: 'bomb', name: 'Disco', price: 150, col: '#d8dde8' },
  { id: 't_stars', cat: 'trail', name: 'Stars', price: 60, col: '#ffe14a', shape: 'star' },
  { id: 't_bubbles', cat: 'trail', name: 'Bubbles', price: 60, col: '#9fe3ff', shape: 'ring' },
  { id: 't_hearts', cat: 'trail', name: 'Hearts', price: 60, col: '#ff4d8a', shape: 'heart' },
  { id: 't_fire', cat: 'trail', name: 'Flames', price: 90, col: '#ff7a1a', shape: 'dot' },
  {
    id: 'v_cat',
    cat: 'voice',
    name: 'Cat',
    price: 80,
    voice: 'cat',
    quips: ['Meow!', 'Mrrr… ouch!'],
    win: ['Meow-meow!'],
  },
  {
    id: 'v_pirate',
    cat: 'voice',
    name: 'Pirate',
    price: 100,
    voice: 'pirate',
    quips: ['Arrr!', 'Shiver me timbers!'],
    win: ['Arrr, the treasure is mine!'],
  },
  {
    id: 'v_opera',
    cat: 'voice',
    name: 'Opera',
    price: 120,
    voice: 'opera',
    quips: ['La-la… ouch!', 'Such drama!'],
    win: ['La-la-laaa!'],
  },
  ...FATALITIES.map((f) => ({
    id: `f_${f.id}`,
    cat: 'fatality',
    name: f.name,
    price: FATALITY_PRICE[f.rarity],
    fatality: f.id,
  })),
  ...EMOTES.map((e) => ({ id: `e_${e.id}`, cat: 'emote', name: e.name, price: 40, emote: e.id })),
]);

export const shopItem = (id: string | null | undefined): ShopItem | undefined =>
  id ? SHOP.find((i) => i.id === id) : undefined;

/** Ce poartă un jucător (id-uri din magazin; null = implicit). */
export interface Outfit {
  color: string | null;
  hat: string | null;
  acc: string | null;
  bomb: string | null;
  trail: string | null;
  voice: string | null;
  /** Fatalitatea jucată pe cei pe care îi elimini. */
  fatality: string | null;
  /** Emote-ul de pe butonul din joc. */
  emote: string | null;
}

export const NO_OUTFIT: Outfit = {
  color: null,
  hat: null,
  acc: null,
  bomb: null,
  trail: null,
  voice: null,
  fatality: null,
  emote: null,
};

/** Păstrează doar id-urile valide, fiecare în categoria lui (outfit venit din rețea sau din stocare). */
export function cleanOutfit(v: unknown): Outfit {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const out: Outfit = { ...NO_OUTFIT };
  for (const cat of SHOP_CATS) {
    const it = shopItem(typeof o[cat] === 'string' ? (o[cat] as string) : null);
    if (it && it.cat === cat) out[cat] = it.id;
  }
  return out;
}
