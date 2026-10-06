import { fatalityById } from '@fitil/content';

/**
 * Fatalitățile: poza victimei și recuzita în funcție de timpul scurs de la eliminare. Funcții pure
 * (fără Phaser, fără DOM), ca să le folosească și arena, și galeria DEV, și testele.
 * Unități: pătrățele, față de centrul victimei; `t` și `dur` în secunde de joc.
 */
export type PropKind =
  'anvil' | 'star' | 'corn' | 'ghost' | 'note' | 'folder' | 'stamp' | 'spit' | 'bell' | 'jet';

export interface Prop {
  kind: PropKind;
  /** Variantă (ex. forma floricelei). */
  v: number;
  x: number;
  y: number;
  rot: number;
  s: number;
  a: number;
}

export interface Pose {
  dx: number;
  dy: number;
  rot: number;
  sx: number;
  sy: number;
  /** 0 = invizibilă. */
  alpha: number;
  /** Cât de rumenită e (0–1), pentru fatalitatea cu puiul. */
  roast: number;
  props: Prop[];
}

const clamp = (v: number, a = 0, b = 1): number => Math.min(b, Math.max(a, v));
const ease = (u: number): number => u * u * (3 - 2 * u);
/** Segmentul [a,b] al lui u, normalizat în 0–1. */
const seg = (u: number, a: number, b: number): number => clamp((u - a) / (b - a));
const prop = (kind: PropKind, x: number, y: number, o: Partial<Prop> = {}): Prop => ({
  kind,
  v: 0,
  x,
  y,
  rot: 0,
  s: 1,
  a: 1,
  ...o,
});

const base = (): Pose => ({ dx: 0, dy: 0, rot: 0, sx: 1, sy: 1, alpha: 1, roast: 0, props: [] });

/** Poza la momentul `t` (s) al fatalității `id`; `null` dacă id-ul nu există. */
export function fatalityPose(id: string, t: number): Pose | null {
  const f = fatalityById(id);
  if (!f) return null;
  const u = clamp(t / f.dur);
  const p = base();
  const end = 1 - seg(u, 0.85, 1);
  switch (id) {
    case 'rocket': {
      const k = seg(u, 0.08, 1);
      p.dy = -(k * k) * 6;
      p.dx = Math.sin(u * 40) * 0.04 * (1 - k);
      p.sx = p.sy = 1 - 0.55 * k;
      p.alpha = 1 - seg(u, 0.7, 0.88);
      if (u > 0.05 && u < 0.8)
        p.props.push(prop('jet', 0, p.dy + 0.55, { s: 0.8 + 0.3 * Math.sin(u * 60), a: 1 }));
      // la capăt rămâne o stea care sclipește
      const sp = seg(u, 0.72, 0.9);
      if (sp > 0) {
        const star = (1 - seg(u, 0.93, 1)) * (0.5 + 0.5 * Math.sin(u * 70));
        p.props.push(prop('star', 0, -3.9 + (1 - sp) * 0.4, { s: 0.5 + sp * 0.8, a: clamp(star + 0.3) }));
      }
      break;
    }
    case 'pancake': {
      const fall = seg(u, 0, 0.22);
      const hit = u >= 0.22;
      const peel = seg(u, 0.55, 1);
      p.props.push(prop('anvil', 0, -3.2 + fall * fall * 2.85 - peel * 0.4, { a: 1 - seg(u, 0.5, 0.7) }));
      if (hit) {
        const bounce = Math.exp(-(u - 0.22) * 14) * Math.sin((u - 0.22) * 40) * 0.12;
        p.sx = 1.7 + bounce;
        p.sy = 0.16 - bounce * 0.2;
        p.dy = 0.28;
      }
      // se dezlipește ca un sticker: se ridică un colț, apoi pleacă
      p.rot = -0.5 * ease(peel);
      p.dy -= ease(peel) * 0.7;
      p.dx = ease(peel) * 0.4;
      p.alpha = end;
      break;
    }
    case 'popcorn': {
      const wind = seg(u, 0, 0.3);
      if (u < 0.3) {
        p.sx = p.sy = 1 + 0.3 * wind;
        p.dx = Math.sin(u * 120) * 0.05 * wind;
        p.dy = -Math.abs(Math.sin(u * 45)) * 0.12 * wind;
      } else p.alpha = 0;
      if (u >= 0.3) {
        const k = (u - 0.3) * f.dur;
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * Math.PI * 2 + i * 0.7;
          const sp = 1.6 + (i % 3) * 0.7;
          const x = Math.cos(a) * sp * k * 0.9;
          const y = -Math.abs(Math.sin(a)) * sp * k * 1.6 + 4.2 * k * k;
          p.props.push(prop('corn', x, y + 0.2, { v: i % 3, rot: k * (3 + i), a: 1 - seg(u, 0.8, 1) }));
        }
      }
      break;
    }
    case 'ghost': {
      p.alpha = 1 - seg(u, 0, 0.3);
      p.sx = 1 - 0.1 * seg(u, 0, 0.3);
      const g = ease(seg(u, 0.1, 1));
      p.props.push(
        prop('ghost', Math.sin(u * 9) * 0.18, -0.2 - g * 2.4, {
          a: seg(u, 0.1, 0.3) * end,
          s: 0.9 + 0.1 * Math.sin(u * 14),
        }),
      );
      for (let i = 0; i < 3; i++) {
        const k = seg(u, 0.25 + i * 0.12, 0.9);
        if (k > 0 && k < 1)
          p.props.push(
            prop('note', 0.4 + i * 0.22 + Math.sin(u * 8 + i) * 0.1, -0.4 - g * 2.4 - k * 0.8, {
              v: i,
              a: 1 - k,
            }),
          );
      }
      break;
    }
    case 'balloon': {
      const inflate = seg(u, 0, 0.42);
      if (u < 0.42) {
        p.sx = 1 + 1.1 * ease(inflate);
        p.sy = 1 + 1.3 * ease(inflate);
        p.dy = -0.35 * inflate;
        p.dx = Math.sin(u * 90) * 0.03 * inflate;
      } else {
        const k = seg(u, 0.42, 1);
        // zboară în zig-zag, dezumflându-se
        p.sx = 2.1 - 1.4 * k;
        p.sy = 2.3 - 1.6 * k;
        p.dx = Math.sin(k * 14) * (0.6 + k * 2.2);
        p.dy = -0.35 - k * 4.2 + Math.sin(k * 11) * 0.7;
        p.rot = Math.sin(k * 16) * 1.4;
        p.alpha = 1 - seg(u, 0.88, 1);
      }
      break;
    }
    case 'chicken': {
      p.roast = seg(u, 0, 0.7);
      p.rot = ease(u) * Math.PI * 6;
      p.dy = -0.1;
      p.sx = p.sy = 0.9;
      p.alpha = 1 - seg(u, 0.93, 1);
      p.props.push(prop('spit', 0, -0.1, { rot: 0, a: p.alpha }));
      if (u > 0.78)
        p.props.push(
          prop('bell', 0.55, -0.75 - (u - 0.78) * 0.8, {
            s: 0.7 + 0.3 * Math.sin((u - 0.78) * 90),
            a: p.alpha,
          }),
        );
      break;
    }
    case 'filed': {
      const slide = ease(seg(u, 0.05, 0.4));
      p.sy = 1 - 0.6 * slide;
      p.dy = 0.25 * slide;
      p.props.push(prop('folder', 0, 0.45 - (1 - slide) * 0.9, { a: seg(u, 0, 0.1) * end, s: 1.1 }));
      const st = seg(u, 0.55, 0.68);
      if (st > 0)
        p.props.push(
          prop('stamp', 0.05, 0.4, { rot: -0.25, s: 1.7 - 0.7 * ease(st), a: Math.min(1, st * 2) * end }),
        );
      p.alpha = slide >= 1 ? 0 : 1;
      break;
    }
  }
  return p;
}
