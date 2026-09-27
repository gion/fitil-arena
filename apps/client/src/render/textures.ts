import type Phaser from 'phaser';
import { withCtx } from './paint.ts';

interface Entry {
  key: string;
  /** Originea (0–1) — punctul care se așază pe poziția obiectului. */
  ox: number;
  oy: number;
}

/**
 * Texturi generate procedural, câte una pe (temă, dimensiune de pătrățel, desen).
 * Se generează la prima cerere și se șterg când se schimbă tema sau dimensiunea.
 * Aici se poate înlocui ulterior cu un atlas de sprite-uri reale, cu aceleași chei.
 */
export class TexBank {
  private map = new Map<string, Entry>();
  private prefix = '';
  T = 32;

  constructor(private scene: Phaser.Scene) {}

  /** Schimbă tema/dimensiunea; șterge texturile vechi. */
  reset(themeId: string, T: number): void {
    const prefix = `${themeId}@${T}:`;
    if (prefix === this.prefix) return;
    for (const e of this.map.values()) this.scene.textures.remove(e.key);
    this.map.clear();
    this.prefix = prefix;
    this.T = T;
  }

  /**
   * Textura `name`, de `w×h` pătrățele, cu originea în (`ox`,`oy`) pătrățele de la colțul stânga-sus.
   * `draw` desenează cu originea contextului mutată în punctul de origine.
   */
  get(name: string, w: number, h: number, ox: number, oy: number, draw: () => void): Entry {
    const hit = this.map.get(name);
    if (hit) return hit;
    const T = this.T;
    const key = this.prefix + name;
    const W = Math.max(1, Math.ceil(w * T));
    const H = Math.max(1, Math.ceil(h * T));
    const tex = this.scene.textures.createCanvas(key, W, H);
    if (!tex) throw new Error(`nu pot crea textura ${key}`);
    const c = tex.getContext();
    c.save();
    c.translate(ox * T, oy * T);
    withCtx(c, T, draw);
    c.restore();
    tex.refresh();
    const e = { key, ox: (ox * T) / W, oy: (oy * T) / H };
    this.map.set(name, e);
    return e;
  }
}
