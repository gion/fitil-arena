import { charById, shopItem } from '@fitil/content';
import type { Outfit, ThemeStyle } from '@fitil/content';
import { DPR } from '../display.ts';
import * as paint from '../render/paint.ts';

export interface PortraitSpec {
  ch: string;
  outfit: Outfit | null;
  /** Culoarea corpului (implicit culoarea personajului sau cea din ținută). */
  color?: string;
  /** Se rotește (pagina personajului) sau stă cu fața spre tine. */
  turn?: boolean;
  /** Bucurie (după „Listen”) până la acest moment (ms). */
  happyUntil?: number;
  /** Bombă ținută în față (previzualizarea skin-ului de bombă). */
  bomb?: boolean;
}

const FACES: [number, number][] = [
  [0, 1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

/** Culoarea unui personaj într-o previzualizare: cea cumpărată, altfel a personajului. */
export function lookColor(ch: string, outfit: Outfit | null): string {
  const c = shopItem(outfit?.color)?.col;
  if (c === 'rainbow') return `hsl(${Math.floor(performance.now() / 8) % 360},85%,60%)`;
  return c ?? charById(ch).color;
}

/**
 * Portrete animate (cartea personajului, pagina lui, magazinul): desenele din joc (`paint.ts`)
 * pe câte un canvas, redesenate într-o singură buclă cât timp sunt în pagină.
 */
export class Portraits {
  private list = new Map<HTMLCanvasElement, PortraitSpec>();
  private raf = 0;
  style: ThemeStyle = 'classic';

  add(spec: PortraitSpec, cls = 'portrait'): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.className = cls;
    this.list.set(c, spec);
    if (!this.raf) this.raf = requestAnimationFrame(this.loop);
    return c;
  }

  get(c: HTMLCanvasElement): PortraitSpec | undefined {
    return this.list.get(c);
  }

  private loop = (now: number) => {
    this.raf = 0;
    for (const [c, spec] of this.list) {
      if (!c.isConnected) {
        this.list.delete(c);
        continue;
      }
      this.draw(c, spec, now / 1000);
    }
    if (this.list.size) this.raf = requestAnimationFrame(this.loop);
  };

  private draw(c: HTMLCanvasElement, spec: PortraitSpec, t: number): void {
    const w = Math.max(1, Math.round(c.clientWidth * DPR));
    const h = Math.max(1, Math.round(c.clientHeight * DPR));
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
    const g = c.getContext('2d');
    if (!g) return;
    g.clearRect(0, 0, w, h);
    const C = charById(spec.ch);
    const T = Math.min(w / 1.4, h / 1.35) * C.size;
    const col = spec.color ?? lookColor(spec.ch, spec.outfit);
    const face = spec.turn ? FACES[Math.floor(t / 1.2) % FACES.length]! : ([0, 1] as [number, number]);
    const happy = (spec.happyUntil ?? 0) > performance.now();
    const walk = Math.sin(t * 8);
    const hop =
      C.walk === 'hop' || C.walk === 'dribble' ? Math.abs(walk) * T * 0.08 : Math.abs(walk) * T * 0.03;
    const look: paint.Look = { ch: spec.ch, hat: spec.outfit?.hat ?? null, acc: spec.outfit?.acc ?? null };
    g.save();
    g.translate(w / 2, h * 0.58);
    paint.withCtx(g, T, () => {
      g.save();
      g.translate(0, T * 0.36);
      g.scale(0.62, 0.17);
      paint.disc('rgba(0,0,0,.35)', 0.42);
      g.restore();
      for (const sd of [-1, 1]) {
        g.save();
        g.translate(sd * T * 0.15, T * 0.28 - sd * walk * T * 0.03);
        paint.foot(this.style, col);
        g.restore();
      }
      g.save();
      g.translate(0, -hop);
      if (C.walk === 'twirl' || C.walk === 'waddle') g.rotate(Math.sin(t * 4) * 0.08);
      paint.character(this.style, col, face, happy ? 'happy' : 'normal', look);
      g.restore();
      if (spec.bomb) {
        g.save();
        g.translate(T * 0.62, T * 0.1);
        g.scale(0.55, 0.55);
        paint.bomb(this.style, 0, 0, Math.sin(t * 10) > 0.6, shopItem(spec.outfit?.bomb)?.col ?? null);
        g.restore();
      }
    });
    g.restore();
  }
}
