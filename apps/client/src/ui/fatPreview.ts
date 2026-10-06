import { charById, fatalityById } from '@fitil/content';
import { DPR } from '../display.ts';
import { fatalityPose } from '../render/fatality.ts';
import * as paint from '../render/paint.ts';
import { lookColor } from './portrait.ts';

export interface FatSpec {
  id: string;
  ch: string;
  /** Pauza (s) între două rulări. */
  gap?: number;
  /** Secunda curentă în buclă; setat de buclă. */
  t?: number;
}

/**
 * Previzualizarea fatalităților în meniuri (magazin, colecție, galeria DEV): aceeași poză ca în arenă
 * (`render/fatality.ts`), desenată pe un canvas 2D în buclă, cu victima personajului ales.
 * `elapsed(c)` arată cât a rulat animația, ca testele să poată verifica durata.
 */
export class FatPreviews {
  private list = new Map<HTMLCanvasElement, FatSpec & { start: number }>();
  private raf = 0;

  add(spec: FatSpec, cls = 'fatprev'): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.className = cls;
    c.setAttribute('aria-hidden', 'true');
    c.dataset.fat = spec.id;
    this.list.set(c, { ...spec, start: performance.now() });
    if (!this.raf) this.raf = requestAnimationFrame(this.loop);
    return c;
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

  private draw(c: HTMLCanvasElement, spec: FatSpec & { start: number }, now: number): void {
    const f = fatalityById(spec.id);
    if (!f) return;
    const w = Math.max(1, Math.round(c.clientWidth * DPR));
    const h = Math.max(1, Math.round(c.clientHeight * DPR));
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
    const g = c.getContext('2d');
    if (!g) return;
    g.clearRect(0, 0, w, h);
    const lead = 0.45;
    const gap = spec.gap ?? 0.6;
    const cycle = lead + f.dur + gap;
    const k = ((now - spec.start) / 1000) % cycle;
    const t = Math.max(0, k - lead);
    spec.t = t;
    c.dataset.t = t.toFixed(2);
    const alive = k < lead;
    const pose = alive ? null : fatalityPose(spec.id, t);
    // sub 1.2s ar trebui să fie gata; după `dur` victima a dispărut
    const done = !alive && t >= f.dur;
    const C = charById(spec.ch);
    const T = Math.min(w / 2.2, h / 2.6) * C.size;
    const col = lookColor(spec.ch, null);
    g.save();
    g.translate(w / 2, h * 0.6);
    paint.withCtx(g, T, () => {
      const p = pose;
      if (!done) {
        g.save();
        if (p) {
          g.translate(p.dx * T, p.dy * T);
          g.rotate(p.rot);
          g.scale(p.sx, p.sy);
          g.globalAlpha = Math.max(0, p.alpha);
          if (p.roast)
            g.filter = `sepia(${p.roast}) saturate(${1 + p.roast}) brightness(${1 - p.roast * 0.25})`;
        }
        paint.character('classic', col, [0, 1], alive ? 'normal' : 'dead');
        g.restore();
      }
      for (const pr of p?.props ?? []) {
        g.save();
        g.translate(pr.x * T, pr.y * T);
        g.rotate(pr.rot);
        g.scale(pr.s, pr.s);
        g.globalAlpha = Math.max(0, Math.min(1, pr.a));
        paint.fatProp(pr.kind, pr.v);
        g.restore();
      }
    });
    g.restore();
  }
}
