import { charById, shopItem } from '@fitil/content';
import type { Outfit } from '@fitil/content';
import { DPR } from '../display.ts';
import * as paint from '../render/paint.ts';

export interface PortraitSpec {
  ch: string;
  outfit: Outfit | null;
  /** Culoarea corpului (implicit culoarea personajului sau cea din ținută). */
  color?: string;
  /** Personajul mare al ecranului: se leagănă, privește spre ultimul element atins și reacționează. */
  lead?: boolean;
  /** Reacția curentă (expresie) până la acest moment (ms, `performance.now()`). */
  react?: { expr: paint.Expr; until: number };
  /** Bombă ținută în față (previzualizarea skin-ului de bombă). */
  bomb?: boolean;
}

/** Culoarea unui personaj într-o previzualizare: cea cumpărată, altfel a personajului. */
export function lookColor(ch: string, outfit: Outfit | null): string {
  const c = shopItem(outfit?.color)?.col;
  if (c === 'rainbow') return `hsl(${Math.floor(performance.now() / 8) % 360},85%,60%)`;
  return c ?? charById(ch).color;
}

const AROUND: [number, number][] = [
  [-1, 0],
  [0, 1],
  [1, 0],
  [0, 1],
];

/**
 * Personajele din meniuri: desenele din joc (`paint.ts`, mereu stilul clasic — interfața nu depinde
 * de temă, D-052), câte un canvas, redesenate într-o singură buclă cât timp sunt în pagină.
 * În repaus se leagănă (4px, 1,6s) și clipesc la 3–5s; cel mare („lead”) privește spre ultimul
 * element atins, iar după 20s fără nimic se uită în jur. Cu `motion` oprit stau pe loc,
 * dar își schimbă în continuare expresia.
 */
export class Portraits {
  private list = new Map<HTMLCanvasElement, PortraitSpec>();
  private blinkAt = new WeakMap<HTMLCanvasElement, number>();
  private raf = 0;
  motion = true;
  /** Ultima atingere (pixeli CSS) și momentul ei. */
  private touch = { x: 0, y: 0, t: performance.now() };

  add(spec: PortraitSpec, cls = 'portrait'): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.className = cls;
    c.setAttribute('aria-hidden', 'true');
    this.list.set(c, spec);
    if (!this.raf) this.raf = requestAnimationFrame(this.loop);
    return c;
  }

  get(c: HTMLCanvasElement): PortraitSpec | undefined {
    return this.list.get(c);
  }

  /** Personajul mare din pagina curentă (cel care reacționează). */
  lead(): PortraitSpec | undefined {
    for (const [c, s] of this.list) if (s.lead && c.isConnected) return s;
    return undefined;
  }

  /** Reacție a personajului mare: expresie pentru `ms`. */
  react(expr: paint.Expr, ms = 1100): void {
    const s = this.lead();
    if (s) s.react = { expr, until: performance.now() + ms };
  }

  touched(x: number, y: number): void {
    this.touch = { x, y, t: performance.now() };
  }

  private loop = (now: number) => {
    this.raf = 0;
    for (const [c, spec] of this.list) {
      if (!c.isConnected) {
        this.list.delete(c);
        continue;
      }
      this.draw(c, spec, now);
    }
    if (this.list.size) this.raf = requestAnimationFrame(this.loop);
  };

  private face(c: HTMLCanvasElement, spec: PortraitSpec, now: number): [number, number] {
    if (!spec.lead) return [0, 1];
    if (now - this.touch.t > 20000)
      return this.motion ? AROUND[Math.floor(now / 1500) % AROUND.length]! : [0, 1];
    const r = c.getBoundingClientRect();
    const dx = this.touch.x - (r.left + r.width / 2);
    const dy = this.touch.y - (r.top + r.height / 2);
    if (Math.hypot(dx, dy) < 40) return [0, 1];
    return Math.abs(dx) > Math.abs(dy) * 1.2 ? [Math.sign(dx), 0] : [0, dy < 0 ? 0 : 1];
  }

  private draw(c: HTMLCanvasElement, spec: PortraitSpec, now: number): void {
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
    let blink = this.blinkAt.get(c);
    if (blink === undefined || now > blink + 140) {
      if (blink !== undefined && now > blink + 140) blink = now + 3000 + Math.random() * 2000;
      blink ??= now + Math.random() * 4000;
      this.blinkAt.set(c, blink);
    }
    const react = spec.react && spec.react.until > now ? spec.react.expr : null;
    const expr: paint.Expr = react ?? (now >= blink && now < blink + 140 ? 'blink' : 'normal');
    const bob = this.motion ? ((Math.sin((now / 1600) * Math.PI * 2) + 1) / 2) * 4 * DPR : 0;
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
        g.translate(sd * T * 0.15, T * 0.28);
        paint.foot('classic', col);
        g.restore();
      }
      g.save();
      g.translate(0, -bob);
      paint.character('classic', col, this.face(c, spec, now), expr, look);
      g.restore();
      if (spec.bomb) {
        g.save();
        g.translate(T * 0.62, T * 0.1);
        g.scale(0.55, 0.55);
        paint.bomb('classic', 0, 0, Math.sin(now / 100) > 0.6, shopItem(spec.outfit?.bomb)?.col ?? null);
        g.restore();
      }
    });
    g.restore();
  }
}
