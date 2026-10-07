/**
 * Desenele procedurale din prototip, portate aproape 1:1 pe Canvas 2D.
 * Fiecare funcție desenează într-un context la dimensiunea de pătrățel `T` (pixeli fizici);
 * `textures.ts` le transformă în texturi Phaser (un „theme pack” procedural, înlocuibil cu sprite-uri).
 */
import type { ItemType } from '@fitil/sim';
import type { ThemeStyle } from '@fitil/content';

let ctx!: CanvasRenderingContext2D;
let T = 32;

/** Rulează `fn` cu contextul și dimensiunea de pătrățel date. */
export function withCtx(c: CanvasRenderingContext2D, t: number, fn: () => void): void {
  const [pc, pt] = [ctx, T];
  ctx = c;
  T = t;
  try {
    fn();
  } finally {
    ctx = pc;
    T = pt;
    c.shadowBlur = 0;
  }
}

/** Zgomot determinist din coordonate (doar vizual). */
export const hash = (x: number, y: number, s = 0): number => {
  const v = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453;
  return v - Math.floor(v);
};

function rr(x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}
function P(px: number, py: number, x: number, y: number, w: number, h: number, c: string): void {
  ctx.fillStyle = c;
  ctx.fillRect(px + (x * T) / 8, py + (y * T) / 8, (w * T) / 8 + 0.6, (h * T) / 8 + 0.6);
}
function glow(c: string, b: number): void {
  ctx.shadowColor = c;
  ctx.shadowBlur = (b * T) / 32;
}
function noGlow(): void {
  ctx.shadowBlur = 0;
}
function circle(x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0, r), 0, 7);
}
function ellipse(x: number, y: number, rx: number, ry: number, rot = 0): void {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0, rx), Math.max(0, ry), rot, 0, 7);
}
export function heartPath(cx: number, cy: number, s: number): void {
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.38);
  ctx.bezierCurveTo(cx - s * 0.62, cy - s * 0.02, cx - s * 0.36, cy - s * 0.56, cx, cy - s * 0.2);
  ctx.bezierCurveTo(cx + s * 0.36, cy - s * 0.56, cx + s * 0.62, cy - s * 0.02, cx, cy + s * 0.38);
  ctx.closePath();
}

const GIFT = [
  ['#e0302f', '#ffd23f'],
  ['#2f9a4a', '#ff4d4d'],
  ['#2f6de0', '#ffffff'],
  ['#ffd23f', '#e0302f'],
  ['#9a4ad0', '#7dffb0'],
] as const;
const BOOK = ['#e0402f', '#2f7de0', '#2fae5a', '#ffb000', '#8a4ad0', '#1f8a8a'];

/* ---------- pătrățele ---------- */

export function ground(s: ThemeStyle, x: number, y: number, px: number, py: number): void {
  const h = hash(x, y);
  const fill = (c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(px, py, T + 0.5, T + 0.5);
  };
  switch (s) {
    case 'halloween':
      fill((x + y) % 2 ? '#2a2238' : '#2f263f');
      if (h < 0.28) {
        ctx.fillStyle = h < 0.14 ? '#b0501a' : '#7a3a14';
        ellipse(px + T * (0.2 + h * 2), py + T * (0.3 + hash(x, y, 4) * 0.5), T * 0.09, T * 0.05, h * 9);
        ctx.fill();
      }
      return;
    case 'xmas':
      fill((x + y) % 2 ? '#eef4fb' : '#e4edf7');
      if (h < 0.5) {
        ctx.fillStyle = '#b9d4ef';
        circle(px + hash(x, y, 1) * T, py + hash(x, y, 2) * T, T * 0.03);
        ctx.fill();
      }
      return;
    case 'valentine':
      fill((x + y) % 2 ? '#ffd9e6' : '#ffcfe0');
      if (h < 0.22) {
        ctx.fillStyle = '#ffb3cc';
        heartPath(px + T * (0.25 + h * 2), py + T * (0.3 + hash(x, y, 4) * 0.4), T * 0.22);
        ctx.fill();
      }
      return;
    case 'school':
      fill('#fbf8ee');
      ctx.fillStyle = '#bcd4ee';
      ctx.fillRect(px, py + T * 0.32, T + 0.5, Math.max(1, T * 0.03));
      ctx.fillRect(px, py + T * 0.68, T + 0.5, Math.max(1, T * 0.03));
      if (((x % 8) + 8) % 8 === 2) {
        ctx.fillStyle = '#f0a0a0';
        ctx.fillRect(px + T * 0.2, py, Math.max(1, T * 0.03), T + 0.5);
      }
      return;
    case 'classic':
      fill((x + y) % 2 ? '#5f9442' : '#679d48');
      return;
    case 'neon':
      fill('#0b0718');
      ctx.strokeStyle = '#24164a';
      ctx.lineWidth = Math.max(1, T / 32);
      ctx.strokeRect(px + 0.5, py + 0.5, T - 1, T - 1);
      return;
    case 'pixel':
      fill((x + y) % 2 ? '#e3b978' : '#d9ad6a');
      if (h < 0.5) P(px, py, ((h * 12) | 0) % 7, ((h * 37) | 0) % 7, 1, 1, '#c49658');
      return;
    case 'cosmos':
      fill('#0a0e2a');
      if (h < 0.45) {
        ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(h * 40));
        ctx.fillStyle = '#cfd6ff';
        const d = Math.max(1.5, T / 20);
        ctx.fillRect(px + hash(x, y, 1) * T, py + hash(x, y, 2) * T, d, d);
        ctx.globalAlpha = 1;
      }
      return;
    case 'cube':
      fill('#5fa33a');
      for (let i = 0; i < 5; i++) {
        const a = hash(x, y, i + 3);
        P(px, py, (a * 8) | 0, (hash(x, y, i + 9) * 8) | 0, 1, 1, a < 0.5 ? '#4f8e2f' : '#77bd4c');
      }
      return;
    case 'jungle':
      fill((x + y) % 2 ? '#2d6a37' : '#326f3c');
      if (h < 0.4) {
        ctx.fillStyle = '#27602f';
        ellipse(px + T * (0.3 + h), py + T * 0.6, T * 0.18, T * 0.08, h * 6);
        ctx.fill();
      }
      return;
  }
}

export function hard(s: ThemeStyle, x: number, y: number, px: number, py: number): void {
  switch (s) {
    case 'halloween':
      ctx.fillStyle = '#262033';
      ctx.fillRect(px, py, T + 0.5, T + 0.5);
      ctx.fillStyle = '#6b6d7c';
      ctx.beginPath();
      ctx.moveTo(px + T * 0.12, py + T * 0.96);
      ctx.lineTo(px + T * 0.12, py + T * 0.44);
      ctx.arc(px + T * 0.5, py + T * 0.44, T * 0.38, Math.PI, 0);
      ctx.lineTo(px + T * 0.88, py + T * 0.96);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#858897';
      ctx.fillRect(px + T * 0.16, py + T * 0.4, T * 0.06, T * 0.5);
      ctx.fillStyle = '#474957';
      ctx.fillRect(px + T * 0.46, py + T * 0.26, T * 0.08, T * 0.36);
      ctx.fillRect(px + T * 0.36, py + T * 0.36, T * 0.28, T * 0.08);
      ctx.fillStyle = '#3f6e3a';
      ctx.fillRect(px + T * 0.1, py + T * 0.86, T * 0.8, T * 0.1);
      return;
    case 'xmas':
      ctx.fillStyle = '#7fb6dc';
      rr(px + T * 0.04, py + T * 0.06, T * 0.92, T * 0.9, T * 0.1);
      ctx.fill();
      ctx.fillStyle = '#a9d4f0';
      rr(px + T * 0.1, py + T * 0.12, T * 0.8, T * 0.72, T * 0.08);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.7)';
      ctx.lineWidth = T * 0.04;
      ctx.beginPath();
      ctx.moveTo(px + T * 0.2, py + T * 0.7);
      ctx.lineTo(px + T * 0.4, py + T * 0.45);
      ctx.moveTo(px + T * 0.55, py + T * 0.75);
      ctx.lineTo(px + T * 0.72, py + T * 0.52);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      rr(px + T * 0.02, py + T * 0.02, T * 0.96, T * 0.24, T * 0.12);
      ctx.fill();
      for (const a of [0.25, 0.5, 0.72]) {
        ctx.beginPath();
        ctx.arc(px + T * a, py + T * 0.26, T * 0.07, 0, Math.PI);
        ctx.fill();
      }
      return;
    case 'valentine':
      ctx.fillStyle = '#b82a58';
      rr(px + T * 0.04, py + T * 0.04, T * 0.92, T * 0.92, T * 0.14);
      ctx.fill();
      ctx.fillStyle = '#d8406e';
      rr(px + T * 0.1, py + T * 0.08, T * 0.8, T * 0.74, T * 0.12);
      ctx.fill();
      ctx.fillStyle = '#ffe3ee';
      heartPath(px + T * 0.5, py + T * 0.47, T * 0.46);
      ctx.fill();
      ctx.fillStyle = '#ff9ac0';
      heartPath(px + T * 0.5, py + T * 0.47, T * 0.3);
      ctx.fill();
      return;
    case 'school':
      ctx.fillStyle = '#e9e2cf';
      ctx.fillRect(px, py, T + 0.5, T + 0.5);
      for (let i = 0; i < 3; i++) {
        const c = BOOK[(hash(x, y, i) * BOOK.length) | 0]!;
        const y0 = py + T * (0.08 + i * 0.29);
        const ins = T * (0.04 + hash(x, y, i + 5) * 0.08);
        ctx.fillStyle = c;
        rr(px + ins, y0, T - ins * 2, T * 0.27, T * 0.04);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.75)';
        ctx.fillRect(px + T * 0.35, y0 + T * 0.09, T * 0.3, T * 0.08);
        ctx.fillStyle = 'rgba(0,0,0,.2)';
        ctx.fillRect(px + ins, y0 + T * 0.22, T - ins * 2, T * 0.05);
      }
      return;
    case 'classic':
      ctx.fillStyle = '#3d4356';
      ctx.fillRect(px, py, T + 0.5, T + 0.5);
      ctx.fillStyle = '#646c85';
      rr(px + T * 0.06, py + T * 0.06, T * 0.88, T * 0.72, T * 0.12);
      ctx.fill();
      ctx.fillStyle = '#7f88a3';
      ctx.fillRect(px + T * 0.16, py + T * 0.14, T * 0.3, T * 0.08);
      return;
    case 'neon':
      ctx.fillStyle = '#150d2b';
      ctx.fillRect(px, py, T + 0.5, T + 0.5);
      glow('#ff3df0', 8);
      ctx.strokeStyle = '#ff3df0';
      ctx.lineWidth = T * 0.06;
      rr(px + T * 0.12, py + T * 0.12, T * 0.76, T * 0.76, T * 0.1);
      ctx.stroke();
      noGlow();
      return;
    case 'pixel':
      P(px, py, 0, 0, 8, 8, '#8a8a99');
      P(px, py, 0, 0, 8, 1, '#b5b5c4');
      P(px, py, 0, 0, 1, 8, '#b5b5c4');
      P(px, py, 0, 7, 8, 1, '#55555f');
      P(px, py, 7, 0, 1, 8, '#55555f');
      P(px, py, 2, 2, 1, 1, '#6e6e7c');
      P(px, py, 5, 4, 1, 1, '#6e6e7c');
      return;
    case 'cosmos':
      ctx.fillStyle = '#2c3346';
      ctx.fillRect(px, py, T + 0.5, T + 0.5);
      ctx.fillStyle = '#4a5470';
      rr(px + T * 0.06, py + T * 0.06, T * 0.88, T * 0.88, T * 0.06);
      ctx.fill();
      ctx.fillStyle = '#8d97b5';
      for (const [a, b] of [
        [0.2, 0.2],
        [0.8, 0.2],
        [0.2, 0.8],
        [0.8, 0.8],
      ] as const) {
        circle(px + a * T, py + b * T, T * 0.04);
        ctx.fill();
      }
      ctx.fillStyle = '#39415a';
      ctx.fillRect(px + T * 0.3, py + T * 0.45, T * 0.4, T * 0.1);
      return;
    case 'cube':
      for (let yy = 0; yy < 8; yy++)
        for (let xx = 0; xx < 8; xx++) {
          const a = hash(x * 8 + xx, y * 8 + yy, 5);
          P(px, py, xx, yy, 1, 1, a < 0.2 ? '#6f6f6f' : a < 0.75 ? '#8b8b8b' : '#a2a2a2');
        }
      return;
    case 'jungle':
      ctx.fillStyle = '#1e3b22';
      ctx.fillRect(px, py, T + 0.5, T + 0.5);
      ctx.fillStyle = '#6b6b5c';
      rr(px + T * 0.06, py + T * 0.1, T * 0.88, T * 0.84, T * 0.28);
      ctx.fill();
      ctx.fillStyle = '#4c8a3b';
      rr(px + T * 0.06, py + T * 0.08, T * 0.88, T * 0.3, T * 0.15);
      ctx.fill();
      ctx.fillStyle = '#55554a';
      circle(px + T * 0.35, py + T * 0.65, T * 0.08);
      ctx.fill();
      return;
  }
}

export function soft(s: ThemeStyle, x: number, y: number, px: number, py: number): void {
  switch (s) {
    case 'halloween': {
      const cx = px + T / 2;
      const cy = py + T * 0.56;
      for (const [ox, rx, c] of [
        [-0.2, 0.2, '#d9600f'],
        [0.2, 0.2, '#d9600f'],
        [0, 0.24, '#ff8a1a'],
      ] as const) {
        ctx.fillStyle = c;
        ellipse(cx + ox * T, cy, rx * T, T * 0.33);
        ctx.fill();
      }
      ctx.fillStyle = '#3f6e1f';
      ctx.fillRect(cx - T * 0.04, cy - T * 0.44, T * 0.08, T * 0.14);
      if (hash(x, y, 7) < 0.6) {
        ctx.fillStyle = '#3a1a05';
        ctx.beginPath();
        ctx.moveTo(cx - T * 0.18, cy - T * 0.06);
        ctx.lineTo(cx - T * 0.06, cy - T * 0.06);
        ctx.lineTo(cx - T * 0.12, cy - T * 0.17);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(cx + T * 0.18, cy - T * 0.06);
        ctx.lineTo(cx + T * 0.06, cy - T * 0.06);
        ctx.lineTo(cx + T * 0.12, cy - T * 0.17);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(cx - T * 0.2, cy + T * 0.07);
        for (let i = 0; i <= 6; i++) ctx.lineTo(cx - T * 0.2 + i * T * 0.066, cy + T * (i % 2 ? 0.18 : 0.08));
        ctx.lineTo(cx + T * 0.2, cy + T * 0.12);
        ctx.quadraticCurveTo(cx, cy + T * 0.28, cx - T * 0.2, cy + T * 0.12);
        ctx.fill();
      }
      return;
    }
    case 'xmas': {
      const [c1, c2] = GIFT[(hash(x, y, 3) * GIFT.length) | 0]!;
      ctx.fillStyle = c1;
      rr(px + T * 0.1, py + T * 0.22, T * 0.8, T * 0.7, T * 0.06);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.15)';
      ctx.fillRect(px + T * 0.1, py + T * 0.22, T * 0.8, T * 0.1);
      ctx.fillStyle = c2;
      ctx.fillRect(px + T * 0.44, py + T * 0.22, T * 0.12, T * 0.7);
      ctx.fillRect(px + T * 0.1, py + T * 0.5, T * 0.8, T * 0.12);
      ctx.beginPath();
      ctx.ellipse(px + T * 0.36, py + T * 0.17, T * 0.13, T * 0.08, -0.4, 0, 7);
      ctx.ellipse(px + T * 0.64, py + T * 0.17, T * 0.13, T * 0.08, 0.4, 0, 7);
      ctx.fill();
      return;
    }
    case 'valentine':
      ctx.fillStyle = '#7a1a30';
      heartPath(px + T * 0.5, py + T * 0.54, T * 0.92);
      ctx.fill();
      ctx.fillStyle = '#c8305a';
      heartPath(px + T * 0.5, py + T * 0.5, T * 0.84);
      ctx.fill();
      ctx.fillStyle = '#ffd23f';
      ctx.fillRect(px + T * 0.46, py + T * 0.2, T * 0.08, T * 0.6);
      ctx.beginPath();
      ctx.ellipse(px + T * 0.4, py + T * 0.27, T * 0.09, T * 0.06, -0.4, 0, 7);
      ctx.ellipse(px + T * 0.6, py + T * 0.27, T * 0.09, T * 0.06, 0.4, 0, 7);
      ctx.fill();
      return;
    case 'school':
      for (let i = 0; i < 3; i++) {
        const xx = px + T * (0.26 + i * 0.18);
        const hh = T * (0.28 + hash(x, y, i) * 0.14);
        ctx.fillStyle = '#ffc21a';
        ctx.fillRect(xx, py + T * 0.28 - hh * 0.5, T * 0.1, hh);
        ctx.fillStyle = '#f3d6b0';
        ctx.beginPath();
        ctx.moveTo(xx, py + T * 0.28 - hh * 0.5);
        ctx.lineTo(xx + T * 0.05, py + T * 0.28 - hh * 0.5 - T * 0.1);
        ctx.lineTo(xx + T * 0.1, py + T * 0.28 - hh * 0.5);
        ctx.fill();
        ctx.fillStyle = '#333';
        ctx.fillRect(xx + T * 0.035, py + T * 0.28 - hh * 0.5 - T * 0.1, T * 0.03, T * 0.03);
      }
      ctx.fillStyle = '#b88a52';
      rr(px + T * 0.08, py + T * 0.3, T * 0.84, T * 0.62, T * 0.05);
      ctx.fill();
      ctx.fillStyle = '#caa06a';
      ctx.fillRect(px + T * 0.08, py + T * 0.3, T * 0.84, T * 0.14);
      ctx.fillStyle = 'rgba(230,215,170,.9)';
      ctx.fillRect(px + T * 0.42, py + T * 0.3, T * 0.16, T * 0.62);
      return;
    case 'classic':
      ctx.fillStyle = '#8a5228';
      rr(px + T * 0.05, py + T * 0.05, T * 0.9, T * 0.9, T * 0.1);
      ctx.fill();
      ctx.fillStyle = '#c8834a';
      rr(px + T * 0.11, py + T * 0.1, T * 0.78, T * 0.72, T * 0.07);
      ctx.fill();
      ctx.strokeStyle = '#8a5228';
      ctx.lineWidth = T * 0.05;
      ctx.beginPath();
      ctx.moveTo(px + T * 0.12, py + T * 0.36);
      ctx.lineTo(px + T * 0.88, py + T * 0.36);
      ctx.moveTo(px + T * 0.12, py + T * 0.58);
      ctx.lineTo(px + T * 0.88, py + T * 0.58);
      ctx.moveTo(px + T * 0.2, py + T * 0.12);
      ctx.lineTo(px + T * 0.8, py + T * 0.8);
      ctx.stroke();
      return;
    case 'neon':
      ctx.fillStyle = '#0d1f2b';
      rr(px + T * 0.1, py + T * 0.1, T * 0.8, T * 0.8, T * 0.08);
      ctx.fill();
      glow('#29f0ff', 6);
      ctx.strokeStyle = '#29f0ff';
      ctx.lineWidth = T * 0.05;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(px + T * 0.25, py + T * 0.25);
      ctx.lineTo(px + T * 0.75, py + T * 0.75);
      ctx.moveTo(px + T * 0.75, py + T * 0.25);
      ctx.lineTo(px + T * 0.25, py + T * 0.75);
      ctx.stroke();
      noGlow();
      return;
    case 'pixel':
      P(px, py, 0, 0, 8, 8, '#6e2f18');
      for (let r = 0; r < 4; r++) {
        const off = r % 2 ? 2 : 0;
        for (let c = -1; c < 3; c++) {
          const bx = c * 4 + off;
          const x0 = Math.max(0, bx);
          const x1 = Math.min(8, bx + 3);
          if (x1 > x0) P(px, py, x0, r * 2, x1 - x0, 1.6, '#b5532e');
        }
      }
      return;
    case 'cosmos':
      ctx.fillStyle = '#7a6a5e';
      ctx.beginPath();
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * 6.283;
        const r = T * (0.36 + hash(x, y, i) * 0.08);
        ctx.lineTo(px + T / 2 + Math.cos(a) * r, py + T / 2 + Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#5e5148';
      ctx.beginPath();
      ctx.arc(px + T * 0.4, py + T * 0.42, T * 0.09, 0, 7);
      ctx.arc(px + T * 0.62, py + T * 0.62, T * 0.06, 0, 7);
      ctx.fill();
      return;
    case 'cube':
      P(px, py, 0, 0, 8, 8, '#b3834f');
      for (let r = 1; r < 8; r += 2) P(px, py, 0, r, 8, 0.6, '#8a6238');
      P(px, py, ((hash(x, y) * 6) | 0) + 1, 2, 1, 1, '#8a6238');
      P(px, py, ((hash(x, y, 3) * 6) | 0) + 1, 6, 1, 1, '#8a6238');
      return;
    case 'jungle': {
      const g = ['#2f7a36', '#3f9a45', '#4fb055'];
      (
        [
          [0.32, 0.6, 0.26],
          [0.68, 0.6, 0.26],
          [0.5, 0.38, 0.28],
        ] as const
      ).forEach(([a, b, r], i) => {
        ctx.fillStyle = g[i]!;
        circle(px + a * T, py + b * T, r * T);
        ctx.fill();
      });
      ctx.fillStyle = '#ff5a8a';
      circle(px + T * 0.6, py + T * 0.35, T * 0.05);
      ctx.fill();
      return;
    }
  }
}

export function goldOverlay(px: number, py: number, round: boolean): void {
  ctx.save();
  ctx.fillStyle = 'rgba(255,200,40,.42)';
  rr(px + T * 0.06, py + T * 0.06, T * 0.88, T * 0.88, round ? T * 0.1 : 0);
  ctx.fill();
  glow('#ffd23f', 8);
  ctx.strokeStyle = '#ffd23f';
  ctx.lineWidth = T * 0.07;
  ctx.stroke();
  noGlow();
  const cx = px + T / 2;
  const cy = py + T / 2;
  const r1 = T * 0.2;
  const r2 = T * 0.09;
  ctx.fillStyle = '#fff6c4';
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 ? r2 : r1;
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function curseOverlay(px: number, py: number, round: boolean): void {
  ctx.save();
  ctx.fillStyle = 'rgba(90,20,140,.5)';
  rr(px + T * 0.06, py + T * 0.06, T * 0.88, T * 0.88, round ? T * 0.1 : 0);
  ctx.fill();
  glow('#b04fff', 9);
  ctx.strokeStyle = '#b04fff';
  ctx.lineWidth = T * 0.06;
  ctx.stroke();
  noGlow();
  ctx.strokeStyle = '#1a0a26';
  ctx.lineWidth = T * 0.04;
  ctx.beginPath();
  ctx.moveTo(px + T * 0.3, py + T * 0.2);
  ctx.lineTo(px + T * 0.45, py + T * 0.45);
  ctx.lineTo(px + T * 0.35, py + T * 0.62);
  ctx.moveTo(px + T * 0.45, py + T * 0.45);
  ctx.lineTo(px + T * 0.7, py + T * 0.55);
  ctx.stroke();
  ctx.fillStyle = '#e8d6ff';
  circle(px + T * 0.62, py + T * 0.3, T * 0.1);
  ctx.fill();
  ctx.fillStyle = '#1a0a26';
  ctx.beginPath();
  ctx.arc(px + T * 0.59, py + T * 0.29, T * 0.025, 0, 7);
  ctx.arc(px + T * 0.65, py + T * 0.29, T * 0.025, 0, 7);
  ctx.fill();
  ctx.restore();
}

/* ---------- bonusuri ---------- */

export const ITEM_COLOR: Record<ItemType, string> = {
  shield: '#4fd8ff',
  bomb: '#9fb4ff',
  fire: '#ff9a3c',
  speed: '#7dffb0',
  kick: '#ffb347',
  glove: '#ff8ad8',
  remote: '#ff4d4d',
  line: '#ffe14a',
  slow: '#ff2d2d',
  shrink: '#ff2d2d',
  fewer: '#ff2d2d',
  reverse: '#ff2d2d',
  hiccup: '#ff2d2d',
  dizzy: '#ff2d2d',
  maxspeed: '#ffd23f',
  maxfire: '#ffd23f',
  maxbomb: '#ffd23f',
  heart: '#ff5f93',
  crystal: '#6ff4ff',
  ice: '#9fe8ff',
  flash: '#fff27a',
  poison: '#8dff5a',
  hex: '#c27bff',
};

/** Culoarea bombelor speciale (corp + strălucire), folosită și la randarea bombelor. */
export const SPECIAL_COLOR = { ice: '#9fe8ff', flash: '#fff27a', poison: '#8dff5a' } as const;
const NEG = new Set<ItemType>(['slow', 'shrink', 'fewer', 'reverse', 'hiccup', 'dizzy']);
const GOLDS = new Set<ItemType>(['maxspeed', 'maxfire', 'maxbomb']);
const BASE_ICON: Partial<Record<ItemType, ItemType>> = {
  slow: 'speed',
  shrink: 'fire',
  fewer: 'bomb',
  maxspeed: 'speed',
  maxfire: 'fire',
  maxbomb: 'bomb',
};

function text(t: string, x: number, y: number, size: number, color: string, weight = 900): void {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px system-ui,sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(t, x, y);
}

export function item(it: ItemType, px: number, py: number, round: boolean): void {
  const cx = px + T / 2;
  const cy = py + T / 2;
  const neg = NEG.has(it);
  const gold = GOLDS.has(it);
  if (gold) {
    ctx.save();
    glow('#ffd23f', 14);
  }
  ctx.fillStyle = neg ? '#3a0f14' : gold ? '#3a2c05' : '#232842';
  rr(px + T * 0.12, py + T * 0.12, T * 0.76, T * 0.76, round ? T * 0.16 : 0);
  ctx.fill();
  ctx.strokeStyle = ITEM_COLOR[it];
  ctx.lineWidth = T * (neg || gold ? 0.08 : 0.06);
  if (neg) ctx.setLineDash([T * 0.1, T * 0.06]);
  ctx.stroke();
  ctx.setLineDash([]);
  if (gold) {
    noGlow();
    ctx.restore();
  }
  if (neg || gold) {
    const base = BASE_ICON[it];
    if (base) {
      ctx.save();
      if (neg) ctx.globalAlpha = 0.75;
      itemIcon(base, cx, cy);
      ctx.restore();
    } else text(it === 'reverse' ? '⇄' : it === 'dizzy' ? '@' : 'HIC', cx, cy + T * 0.02, T * 0.3, '#ff6b6b');
    const bx = px + T * 0.8;
    const by = py + T * 0.2;
    ctx.fillStyle = neg ? '#ff2d2d' : '#ffd23f';
    circle(bx, by, T * 0.15);
    ctx.fill();
    text(neg ? '−' : 'MAX', bx, by + T * 0.01, T * (neg ? 0.26 : 0.14), neg ? '#fff' : '#3a2c05');
    return;
  }
  itemIcon(it, cx, cy);
}

/** Bombă specială: corp colorat și un semn (fulg, stea, picătură). */
export function specialIcon(kind: 'ice' | 'flash' | 'poison', cx: number, cy: number, r = T * 0.19): void {
  const c = SPECIAL_COLOR[kind];
  glow(c, 8);
  ctx.fillStyle = '#10121c';
  circle(cx, cy + r * 0.2, r);
  ctx.fill();
  noGlow();
  ctx.strokeStyle = c;
  ctx.fillStyle = c;
  ctx.lineWidth = r * 0.22;
  ctx.lineCap = 'round';
  const y = cy + r * 0.2;
  if (kind === 'ice') {
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI) / 3;
      ctx.moveTo(cx - Math.cos(a) * r * 0.6, y - Math.sin(a) * r * 0.6);
      ctx.lineTo(cx + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6);
    }
    ctx.stroke();
  } else if (kind === 'flash') {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI) / 5 - Math.PI / 2;
      const rad = i % 2 ? r * 0.25 : r * 0.62;
      ctx.lineTo(cx + Math.cos(a) * rad, y + Math.sin(a) * rad);
    }
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(cx, y - r * 0.6);
    ctx.quadraticCurveTo(cx + r * 0.5, y + r * 0.1, cx, y + r * 0.5);
    ctx.quadraticCurveTo(cx - r * 0.5, y + r * 0.1, cx, y - r * 0.6);
    ctx.fill();
  }
}

function itemIcon(it: ItemType, cx: number, cy: number): void {
  switch (it) {
    case 'ice':
    case 'flash':
    case 'poison':
      specialIcon(it, cx, cy);
      text('×3', cx + T * 0.2, cy + T * 0.24, T * 0.16, ITEM_COLOR[it]);
      return;
    case 'hex':
      ctx.fillStyle = '#c27bff';
      ctx.beginPath();
      ctx.ellipse(cx, cy, T * 0.24, T * 0.14, 0, 0, 7);
      ctx.fill();
      ctx.fillStyle = '#1a0a26';
      circle(cx, cy, T * 0.08);
      ctx.fill();
      text('−1', cx, cy + T * 0.26, T * 0.16, '#c27bff');
      return;
    case 'heart':
      ctx.fillStyle = '#ff5f93';
      ctx.beginPath();
      ctx.moveTo(cx, cy + T * 0.2);
      ctx.bezierCurveTo(cx - T * 0.3, cy, cx - T * 0.18, cy - T * 0.24, cx, cy - T * 0.08);
      ctx.bezierCurveTo(cx + T * 0.18, cy - T * 0.24, cx + T * 0.3, cy, cx, cy + T * 0.2);
      ctx.fill();
      return;
    case 'crystal':
      glow('#6ff4ff', 12);
      ctx.fillStyle = '#6ff4ff';
      ctx.beginPath();
      ctx.moveTo(cx, cy - T * 0.26);
      ctx.lineTo(cx + T * 0.17, cy - T * 0.05);
      ctx.lineTo(cx, cy + T * 0.24);
      ctx.lineTo(cx - T * 0.17, cy - T * 0.05);
      ctx.closePath();
      ctx.fill();
      noGlow();
      ctx.fillStyle = '#e8ffff';
      ctx.beginPath();
      ctx.moveTo(cx, cy - T * 0.2);
      ctx.lineTo(cx + T * 0.07, cy - T * 0.05);
      ctx.lineTo(cx, cy + T * 0.02);
      ctx.closePath();
      ctx.fill();
      return;
    case 'shield':
      ctx.fillStyle = '#4fd8ff';
      ctx.beginPath();
      ctx.moveTo(cx, cy - T * 0.24);
      ctx.lineTo(cx + T * 0.2, cy - T * 0.16);
      ctx.quadraticCurveTo(cx + T * 0.2, cy + T * 0.12, cx, cy + T * 0.25);
      ctx.quadraticCurveTo(cx - T * 0.2, cy + T * 0.12, cx - T * 0.2, cy - T * 0.16);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#0e3a4a';
      ctx.fillRect(cx - T * 0.025, cy - T * 0.14, T * 0.05, T * 0.28);
      ctx.fillRect(cx - T * 0.12, cy - T * 0.04, T * 0.24, T * 0.05);
      return;
    case 'bomb':
      ctx.fillStyle = '#10121c';
      circle(cx, cy + T * 0.04, T * 0.19);
      ctx.fill();
      ctx.fillStyle = '#ffd23f';
      circle(cx + T * 0.14, cy - T * 0.17, T * 0.06);
      ctx.fill();
      return;
    case 'fire':
      ctx.fillStyle = '#ff7a1a';
      ctx.beginPath();
      ctx.moveTo(cx, cy - T * 0.25);
      ctx.quadraticCurveTo(cx + T * 0.24, cy, cx + T * 0.14, cy + T * 0.2);
      ctx.lineTo(cx - T * 0.14, cy + T * 0.2);
      ctx.quadraticCurveTo(cx - T * 0.24, cy, cx, cy - T * 0.25);
      ctx.fill();
      ctx.fillStyle = '#ffd23f';
      circle(cx, cy + T * 0.08, T * 0.08);
      ctx.fill();
      return;
    case 'speed':
      ctx.strokeStyle = '#7dffb0';
      ctx.lineWidth = T * 0.07;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (const o of [-0.1, 0.1]) {
        ctx.moveTo(cx + o * T - T * 0.08, cy - T * 0.14);
        ctx.lineTo(cx + o * T + T * 0.08, cy);
        ctx.lineTo(cx + o * T - T * 0.08, cy + T * 0.14);
      }
      ctx.stroke();
      return;
    case 'kick':
      ctx.fillStyle = '#ffb347';
      ctx.beginPath();
      ctx.moveTo(cx - T * 0.12, cy - T * 0.22);
      ctx.lineTo(cx + T * 0.02, cy - T * 0.22);
      ctx.lineTo(cx + T * 0.02, cy + T * 0.02);
      ctx.lineTo(cx + T * 0.22, cy + T * 0.06);
      ctx.lineTo(cx + T * 0.22, cy + T * 0.18);
      ctx.lineTo(cx - T * 0.12, cy + T * 0.18);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#10121c';
      circle(cx + T * 0.2, cy - T * 0.14, T * 0.06);
      ctx.fill();
      return;
    case 'remote':
      ctx.fillStyle = '#3a3f55';
      rr(cx - T * 0.14, cy - T * 0.08, T * 0.28, T * 0.3, T * 0.05);
      ctx.fill();
      ctx.strokeStyle = '#cfd3e6';
      ctx.lineWidth = T * 0.04;
      ctx.beginPath();
      ctx.moveTo(cx + T * 0.06, cy - T * 0.08);
      ctx.lineTo(cx + T * 0.12, cy - T * 0.26);
      ctx.stroke();
      ctx.fillStyle = '#ff4d4d';
      circle(cx, cy + T * 0.06, T * 0.07);
      ctx.fill();
      return;
    case 'line':
      ctx.fillStyle = '#10121c';
      for (let i = -1; i <= 1; i++) {
        circle(cx + i * T * 0.18, cy + T * 0.02, T * 0.08);
        ctx.fill();
      }
      ctx.fillStyle = '#ffe14a';
      ctx.fillRect(cx - T * 0.26, cy + T * 0.14, T * 0.52, T * 0.04);
      return;
    default:
      // mănușa
      ctx.fillStyle = '#ff8ad8';
      rr(cx - T * 0.13, cy - T * 0.14, T * 0.24, T * 0.3, T * 0.1);
      ctx.fill();
      ellipse(cx + T * 0.15, cy + T * 0.02, T * 0.07, T * 0.11, -0.5);
      ctx.fill();
      ctx.fillStyle = '#c24f9a';
      ctx.fillRect(cx - T * 0.13, cy + T * 0.1, T * 0.24, T * 0.06);
  }
}

/* ---------- bombe ---------- */

/** Bomba (fără scânteie, care e animată separat). `tcol` = culoarea echipei. `hot` = pulsul roșu din final. */
export function bomb(s: ThemeStyle, cx: number, cy: number, hot: boolean, tcol: string | null, sc = 1): void {
  const BC = (d: string) => tcol ?? d;
  const r = T * 0.32 * sc;
  const fuse = (x0: number, y0: number, c = '#c8a26a') => {
    ctx.strokeStyle = c;
    ctx.lineWidth = T * 0.05 * sc;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(cx + r * 0.9, cy - r * 1.1, cx + r * 0.7, cy - r * 1.3);
    ctx.stroke();
  };
  switch (s) {
    case 'halloween':
      ctx.fillStyle = hot ? '#5a1a1a' : BC('#1b1523');
      circle(cx, cy, r);
      ctx.fill();
      glow('#ff9a1a', 8);
      ctx.fillStyle = '#ff9a1a';
      for (const sd of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(cx + sd * r * 0.45, cy - r * 0.05);
        ctx.lineTo(cx + sd * r * 0.15, cy - r * 0.05);
        ctx.lineTo(cx + sd * r * 0.3, cy - r * 0.35);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.45, cy + r * 0.2);
      ctx.quadraticCurveTo(cx, cy + r * 0.65, cx + r * 0.45, cy + r * 0.2);
      ctx.quadraticCurveTo(cx, cy + r * 0.4, cx - r * 0.45, cy + r * 0.2);
      ctx.fill();
      noGlow();
      fuse(cx + r * 0.5, cy - r * 0.6);
      return;
    case 'xmas':
      ctx.fillStyle = hot ? '#ff6a6a' : BC('#c8202a');
      circle(cx, cy, r);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.fillRect(cx - r * 0.95, cy - r * 0.12, r * 1.9, r * 0.24);
      ctx.fillStyle = 'rgba(255,255,255,.6)';
      circle(cx - r * 0.38, cy - r * 0.42, r * 0.18);
      ctx.fill();
      ctx.fillStyle = '#e8c14a';
      ctx.fillRect(cx - r * 0.22, cy - r * 1.12, r * 0.44, r * 0.24);
      ctx.strokeStyle = '#e8c14a';
      ctx.lineWidth = T * 0.03 * sc;
      circle(cx, cy - r * 1.22, r * 0.12);
      ctx.stroke();
      fuse(cx + r * 0.1, cy - r * 1.1);
      return;
    case 'valentine':
      ctx.fillStyle = hot ? '#7a0f2a' : BC('#e0306a');
      heartPath(cx, cy + r * 0.05, r * 2.3);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.55)';
      circle(cx - r * 0.42, cy - r * 0.3, r * 0.18);
      ctx.fill();
      fuse(cx, cy - r * 0.42);
      return;
    case 'school':
      ctx.fillStyle = hot ? '#7a1a0f' : BC('#d83a2a');
      ctx.beginPath();
      ctx.arc(cx - r * 0.3, cy + r * 0.05, r * 0.72, 0, 7);
      ctx.arc(cx + r * 0.3, cy + r * 0.05, r * 0.72, 0, 7);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.5)';
      circle(cx - r * 0.5, cy - r * 0.3, r * 0.16);
      ctx.fill();
      ctx.fillStyle = '#3faa3a';
      ellipse(cx - r * 0.35, cy - r * 0.85, r * 0.32, r * 0.14, -0.5);
      ctx.fill();
      fuse(cx, cy - r * 0.55, '#6b4226');
      return;
    case 'neon': {
      const c = hot ? '#ff2fd6' : BC('#29f0ff');
      glow(c, 14);
      ctx.fillStyle = '#120a24';
      circle(cx, cy, r);
      ctx.fill();
      ctx.strokeStyle = c;
      ctx.lineWidth = T * 0.06 * sc;
      ctx.stroke();
      ctx.fillStyle = c;
      circle(cx, cy, r * 0.3);
      ctx.fill();
      noGlow();
      return;
    }
    case 'pixel': {
      const px = cx - T * 0.5 * sc;
      const py = cy - T * 0.45 * sc;
      const u = (T / 8) * sc;
      const Q = (x: number, y: number, w: number, h: number, c: string) => {
        ctx.fillStyle = c;
        ctx.fillRect(px + x * u, py + y * u, w * u + 0.5, h * u + 0.5);
      };
      const body = hot ? '#7a1a1a' : BC('#1a1a24');
      Q(2, 2, 4, 6, body);
      Q(1, 3, 6, 4, body);
      Q(2, 3, 1, 1, '#fff');
      Q(5, 0, 1, 2, '#c8a26a');
      return;
    }
    case 'cosmos':
      ctx.fillStyle = hot ? '#5a1a3a' : BC('#2a2f4a');
      circle(cx, cy, r * 0.85);
      ctx.fill();
      ctx.strokeStyle = '#8d97b5';
      ctx.lineWidth = T * 0.04 * sc;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * 6.28;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r * 0.85, cy + Math.sin(a) * r * 0.85);
        ctx.lineTo(cx + Math.cos(a) * r * 1.15, cy + Math.sin(a) * r * 1.15);
        ctx.stroke();
      }
      ctx.fillStyle = hot ? '#ff3b3b' : '#6a0f0f';
      circle(cx, cy, r * 0.25);
      ctx.fill();
      return;
    case 'cube': {
      const w = r * 1.6;
      ctx.fillStyle = hot ? '#6a1f1f' : BC('#2b2b2b');
      ctx.fillRect(cx - w / 2, cy - w / 2, w, w);
      ctx.fillStyle = '#444';
      ctx.fillRect(cx - w / 2, cy - w / 2, w, w * 0.2);
      ctx.fillStyle = hot ? '#ffcf5a' : '#bfa06a';
      ctx.fillRect(cx - w * 0.1, cy - w / 2 - T * 0.12 * sc, w * 0.2, T * 0.12 * sc);
      return;
    }
    case 'jungle':
      ctx.fillStyle = hot ? '#7a3a1a' : BC('#6b4226');
      circle(cx, cy, r);
      ctx.fill();
      ctx.fillStyle = '#3d2414';
      for (const [a, b] of [
        [-0.3, -0.25],
        [0.05, -0.35],
        [-0.1, 0],
      ] as const) {
        circle(cx + a * r, cy + b * r, r * 0.12);
        ctx.fill();
      }
      fuse(cx + r * 0.5, cy - r * 0.6);
      return;
    case 'classic':
      ctx.fillStyle = hot ? '#5a1a1a' : BC('#15171f');
      circle(cx, cy, r);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.55)';
      circle(cx - r * 0.38, cy - r * 0.3, r * 0.2);
      ctx.fill();
      fuse(cx + r * 0.5, cy - r * 0.6);
      return;
  }
}

/** Unde e scânteia fitilului, relativ la centrul bombei (în pătrățele). */
export function sparkOffset(s: ThemeStyle): [number, number] | null {
  if (s === 'neon' || s === 'cosmos') return null;
  if (s === 'pixel') return [0.31, -0.43];
  if (s === 'cube') return [0, -0.42];
  return [0.32 * 0.7, -0.32 * 1.3];
}

/** Antena cu led a bombei cu detonator (ledul e animat separat). */
export function antenna(cx: number, cy: number): void {
  const y0 = cy - T * 0.28;
  ctx.strokeStyle = '#cfd3e6';
  ctx.lineWidth = T * 0.035;
  ctx.beginPath();
  ctx.moveTo(cx - T * 0.12, y0 + T * 0.1);
  ctx.lineTo(cx - T * 0.2, y0 - T * 0.12);
  ctx.stroke();
}

/* ---------- flăcări, portal ---------- */

export function flame(
  colors: readonly [string, string, string],
  round: boolean,
  neon: boolean,
  px = 0,
  py = 0,
): void {
  const [c1, c2, c3] = colors;
  if (neon) glow(c1, 12);
  ctx.fillStyle = c1;
  rr(px + T * 0.04, py + T * 0.04, T * 0.92, T * 0.92, round ? T * 0.3 : 0);
  ctx.fill();
  noGlow();
  ctx.fillStyle = c2;
  rr(px + T * 0.16, py + T * 0.16, T * 0.68, T * 0.68, round ? T * 0.25 : 0);
  ctx.fill();
  ctx.fillStyle = c3;
  rr(px + T * 0.3, py + T * 0.3, T * 0.4, T * 0.4, round ? T * 0.2 : 0);
  ctx.fill();
}

export function portalRing(color: string, inner: boolean): void {
  const cx = T / 2;
  const cy = T / 2;
  glow(color, 10);
  ctx.strokeStyle = color;
  ctx.lineWidth = T * 0.06;
  ctx.globalAlpha = inner ? 0.5 : 0.9;
  ctx.beginPath();
  ctx.arc(cx, cy, T * (inner ? 0.24 : 0.36), 0, 4.6);
  ctx.stroke();
  ctx.globalAlpha = 1;
  noGlow();
}

/* ---------- personaje ---------- */

/** `fierce` = încruntat, hotărât (PLAY!/START! în meniuri); `blink` = ochi închiși (clipitul din meniuri). */
export type Expr = 'normal' | 'happy' | 'doom' | 'dead' | 'fierce' | 'blink';

/** Cum arată un personaj: care e (detaliile lui) și ce cosmetice poartă (id-uri din magazin). */
export interface Look {
  ch: string | null;
  hat: string | null;
  acc: string | null;
}
export const NO_LOOK: Look = { ch: null, hat: null, acc: null };

/**
 * Corpul personajului (fără picioare), cu pălăria temei (sau cea cumpărată), detaliile personajului
 * și ochii spre `face`. Origine = centrul pătrățelului.
 */
export function character(
  s: ThemeStyle,
  col: string,
  face: [number, number],
  expr: Expr,
  look: Look = NO_LOOK,
): void {
  body(s, col, face, expr, look);
  extras(look, face, expr !== 'dead');
}

/** Personajele care au pălăria lor (Bucătarul, Magicianul) nu mai primesc pălăria temei. */
const OWN_HAT = new Set(['chef', 'magician']);

function body(s: ThemeStyle, col: string, face: [number, number], expr: Expr, look: Look): void {
  const r = T * 0.34;
  const dark = '#12131c';
  const [fx, fy] = face;
  const eyes = (ey: number, er: number, sq = false) => {
    const ex = fx * r * 0.28;
    const y0 = ey + fy * r * 0.12;
    for (const sd of [-1, 1]) {
      const x = sd * r * 0.36 + ex;
      if (expr === 'happy') {
        ctx.strokeStyle = s === 'neon' ? col : dark;
        ctx.lineWidth = T * 0.045;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(x, y0 + er * 0.3, er * 0.75, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
        continue;
      }
      if (expr === 'blink') {
        ctx.strokeStyle = s === 'neon' ? col : dark;
        ctx.lineWidth = T * 0.04;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x - er * 0.9, y0 + er * 0.2);
        ctx.lineTo(x + er * 0.9, y0 + er * 0.2);
        ctx.stroke();
        continue;
      }
      if (expr === 'dead') {
        ctx.strokeStyle = s === 'neon' ? col : dark;
        ctx.lineWidth = T * 0.045;
        ctx.beginPath();
        ctx.moveTo(x - r * 0.15, y0 - r * 0.15);
        ctx.lineTo(x + r * 0.15, y0 + r * 0.15);
        ctx.moveTo(x + r * 0.15, y0 - r * 0.15);
        ctx.lineTo(x - r * 0.15, y0 + r * 0.15);
        ctx.stroke();
        continue;
      }
      ctx.fillStyle = s === 'neon' ? col : '#fff';
      if (sq) {
        ctx.fillRect(x - er, y0 - er * 1.2, er * 2, er * 2.4);
        ctx.fillStyle = dark;
        ctx.fillRect(x - er * 0.5 + fx * er * 0.5, y0 - er * 0.5 + fy * er * 0.6, er, er * 1.2);
      } else {
        ellipse(x, y0, er, er * 1.25);
        ctx.fill();
        ctx.fillStyle = s === 'neon' ? '#07050f' : dark;
        circle(x + fx * r * 0.08, y0 + fy * r * 0.1, er * 0.5);
        ctx.fill();
      }
    }
    if (expr === 'dead') {
      ctx.fillStyle = dark;
      ellipse(ex, y0 + r * 0.5, r * 0.16, r * 0.22);
      ctx.fill();
    } else if (expr === 'happy') {
      ctx.fillStyle = s === 'neon' ? col : dark;
      ctx.beginPath();
      ctx.arc(ex, y0 + r * 0.35, r * 0.24, 0, Math.PI);
      ctx.fill();
      ctx.fillStyle = '#ff6b8a';
      ctx.beginPath();
      ctx.arc(ex, y0 + r * 0.47, r * 0.1, 0, Math.PI);
      ctx.fill();
    } else if (expr === 'fierce') {
      ctx.strokeStyle = s === 'neon' ? col : dark;
      ctx.lineWidth = T * 0.04;
      ctx.lineCap = 'round';
      for (const sd of [-1, 1]) {
        const x = sd * r * 0.36 + ex;
        ctx.beginPath();
        ctx.moveTo(x - sd * r * 0.22, y0 - r * 0.24);
        ctx.lineTo(x + sd * r * 0.16, y0 - r * 0.42);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(ex - r * 0.17, y0 + r * 0.5);
      ctx.lineTo(ex + r * 0.17, y0 + r * 0.5);
      ctx.stroke();
    } else if (expr === 'doom') {
      ctx.strokeStyle = s === 'neon' ? col : dark;
      ctx.lineWidth = T * 0.035;
      ctx.lineCap = 'round';
      for (const sd of [-1, 1]) {
        const x = sd * r * 0.36 + ex;
        ctx.beginPath();
        ctx.moveTo(x - sd * r * 0.2, y0 - r * 0.36);
        ctx.lineTo(x + sd * r * 0.12, y0 - r * 0.26);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(ex, y0 + r * 0.62, r * 0.2, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
      ctx.fillStyle = '#8fd3ff';
      ellipse(r * 0.75, y0 - r * 0.05, r * 0.08, r * 0.13);
      ctx.fill();
    }
  };
  if (s === 'pixel') {
    const u = T / 9;
    const Q = (x: number, y: number, w: number, h: number, c: string) => {
      ctx.fillStyle = c;
      ctx.fillRect(x * u - 4.5 * u, y * u - 5 * u, w * u + 0.5, h * u + 0.5);
    };
    Q(2, 1, 5, 1, dark);
    Q(1, 2, 7, 5, dark);
    Q(2, 2, 5, 5, col);
    Q(1, 7, 2, 2, dark);
    Q(6, 7, 2, 2, dark);
    Q(2, 6, 5, 1, dark);
    if (expr !== 'dead') {
      Q(3 + Math.max(0, fx), 3 + Math.max(0, fy), 1, 2, '#fff');
      Q(5 + Math.max(0, fx), 3 + Math.max(0, fy), 1, 2, '#fff');
      if (expr === 'happy') Q(3, 5, 3, 1, dark);
    } else {
      Q(3, 3, 1, 1, dark);
      Q(5, 3, 1, 1, dark);
      Q(3, 5, 3, 1, dark);
    }
    return;
  }
  if (s === 'cube') {
    ctx.fillStyle = col;
    ctx.strokeStyle = dark;
    ctx.lineWidth = T * 0.05;
    ctx.fillRect(-r, -r * 1.1, r * 2, r * 2);
    ctx.strokeRect(-r, -r * 1.1, r * 2, r * 2);
    ctx.fillStyle = 'rgba(0,0,0,.15)';
    ctx.fillRect(-r, r * 0.5, r * 2, r * 0.4);
    eyes(-r * 0.3, r * 0.14, true);
    return;
  }
  if (s === 'neon') {
    glow(col, 12);
    ctx.strokeStyle = col;
    ctx.lineWidth = T * 0.06;
    ctx.fillStyle = '#0b0718';
    circle(0, -T * 0.02, r);
    ctx.fill();
    ctx.stroke();
    noGlow();
    eyes(-r * 0.12 - T * 0.02, r * 0.2);
    return;
  }
  ctx.fillStyle = col;
  ctx.strokeStyle = dark;
  ctx.lineWidth = T * 0.05;
  if (look.ch === 'robo') {
    rr(-r, -T * 0.02 - r, r * 2, r * 2, r * 0.35);
  } else if (look.ch === 'ghost') {
    // fantoma: cap rotund și poale ondulate, puțin transparentă
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(0, -T * 0.02, r, Math.PI, 0);
    const y0 = -T * 0.02 + r * 0.9;
    ctx.lineTo(r, y0);
    for (let i = 0; i < 4; i++) {
      const x = r - (i + 0.5) * (r / 2);
      ctx.quadraticCurveTo(x, y0 + (i % 2 ? -r * 0.25 : r * 0.25), r - (i + 1) * (r / 2), y0);
    }
    ctx.closePath();
  } else circle(0, -T * 0.02, r);
  ctx.fill();
  ctx.stroke();
  ctx.globalAlpha = 1;
  if (s === 'classic' && look.ch !== 'robo') {
    ctx.lineWidth = T * 0.04;
    ctx.beginPath();
    ctx.moveTo(0, -T * 0.02 - r);
    ctx.quadraticCurveTo(r * 0.3, -r * 1.6, r * 0.55, -r * 1.45);
    ctx.stroke();
    ctx.fillStyle = col;
    circle(r * 0.55, -r * 1.45, T * 0.05);
    ctx.fill();
  }
  if (s === 'jungle') {
    ctx.fillStyle = '#2f8a3a';
    ellipse(r * 0.25, -r * 1.05, r * 0.45, r * 0.18, -0.5);
    ctx.fill();
    ctx.strokeStyle = '#1d5a24';
    ctx.lineWidth = T * 0.02;
    ctx.beginPath();
    ctx.moveTo(-r * 0.1, -r * 0.85);
    ctx.lineTo(r * 0.6, -r * 1.25);
    ctx.stroke();
  }
  if (!look.hat && !OWN_HAT.has(look.ch ?? '')) hat(s, r);
  eyes(-r * 0.12 - T * 0.02, r * 0.2);
  if (s === 'school') {
    ctx.strokeStyle = dark;
    ctx.lineWidth = T * 0.03;
    const y0 = -r * 0.12 - T * 0.02;
    for (const sd of [-1, 1]) {
      circle(sd * r * 0.36, y0, r * 0.27);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(-r * 0.1, y0);
    ctx.lineTo(r * 0.1, y0);
    ctx.stroke();
  }
  if (s === 'cosmos') {
    ctx.strokeStyle = 'rgba(200,230,255,.8)';
    ctx.lineWidth = T * 0.035;
    ctx.fillStyle = 'rgba(160,210,255,.18)';
    circle(0, -T * 0.04, r * 1.22);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.7)';
    ellipse(-r * 0.55, -r * 0.6, r * 0.18, r * 0.1, -0.7);
    ctx.fill();
    ctx.fillStyle = '#ff5a5a';
    circle(0, -r * 1.3, T * 0.045);
    ctx.fill();
  }
}

function hat(s: ThemeStyle, r: number): void {
  const top = -T * 0.02 - r;
  if (s === 'halloween') {
    ctx.fillStyle = '#2a1640';
    ellipse(0, top + r * 0.25, r * 0.95, r * 0.2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-r * 0.55, top + r * 0.2);
    ctx.lineTo(r * 0.25, top - r * 1.1);
    ctx.lineTo(r * 0.55, top + r * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ff7a1a';
    ctx.fillRect(-r * 0.5, top + r * 0.02, r * 1, r * 0.14);
  } else if (s === 'xmas') {
    ctx.fillStyle = '#d8202a';
    ctx.beginPath();
    ctx.moveTo(-r * 0.7, top + r * 0.3);
    ctx.quadraticCurveTo(-r * 0.1, top - r * 1.1, r * 0.75, top - r * 0.5);
    ctx.lineTo(r * 0.7, top + r * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    rr(-r * 0.8, top + r * 0.15, r * 1.6, r * 0.3, r * 0.15);
    ctx.fill();
    circle(r * 0.8, top - r * 0.5, r * 0.18);
    ctx.fill();
  } else if (s === 'valentine') {
    ctx.strokeStyle = '#12131c';
    ctx.lineWidth = T * 0.03;
    for (const sd of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(sd * r * 0.3, top + r * 0.15);
      ctx.lineTo(sd * r * 0.55, top - r * 0.45);
      ctx.stroke();
      ctx.fillStyle = '#ff3d7f';
      heartPath(sd * r * 0.58, top - r * 0.55, r * 0.55);
      ctx.fill();
    }
  } else if (s === 'school') {
    ctx.fillStyle = '#1c2233';
    ctx.fillRect(-r * 0.5, top - r * 0.05, r * 1, r * 0.3);
    ctx.beginPath();
    ctx.moveTo(-r * 1.05, top - r * 0.08);
    ctx.lineTo(0, top - r * 0.45);
    ctx.lineTo(r * 1.05, top - r * 0.08);
    ctx.lineTo(0, top + r * 0.28);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = T * 0.025;
    ctx.beginPath();
    ctx.moveTo(0, top - r * 0.1);
    ctx.lineTo(r * 0.75, top + r * 0.05);
    ctx.lineTo(r * 0.75, top + r * 0.5);
    ctx.stroke();
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(r * 0.68, top + r * 0.45, r * 0.14, r * 0.2);
  }
}

/** Un picior (elipsă), centrat în origine. */
export function foot(s: ThemeStyle, col: string): void {
  const r = T * 0.34;
  if (s === 'neon') {
    glow(col, 8);
    ctx.strokeStyle = col;
    ctx.lineWidth = T * 0.06;
    ctx.beginPath();
    ctx.moveTo(0, -T * 0.03);
    ctx.lineTo(0, T * 0.03);
    ctx.stroke();
    noGlow();
    return;
  }
  ctx.fillStyle = s === 'cosmos' ? '#d8dcea' : s === 'cube' ? '#3a2a1a' : '#231c1c';
  ellipse(0, 0, r * 0.32, r * 0.2);
  ctx.fill();
}

/* ---------- pericole, steaguri, efecte ---------- */

export function spider(frame: number): void {
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ellipse(0, T * 0.18, T * 0.24, T * 0.08);
  ctx.fill();
  ctx.strokeStyle = '#15101c';
  ctx.lineWidth = T * 0.045;
  ctx.lineCap = 'round';
  for (const sd of [-1, 1])
    for (let i = 0; i < 4; i++) {
      const w = Math.sin(frame * Math.PI + i * 1.6 + (sd > 0 ? Math.PI : 0)) * T * 0.06;
      const y0 = -T * 0.12 + i * T * 0.08;
      ctx.beginPath();
      ctx.moveTo(0, y0);
      ctx.lineTo(sd * T * 0.2, y0 - T * 0.08 + w);
      ctx.lineTo(sd * T * 0.32, y0 + T * 0.06 + w);
      ctx.stroke();
    }
  ctx.fillStyle = '#231830';
  ellipse(0, T * 0.06, T * 0.15, T * 0.18);
  ctx.fill();
  ctx.fillStyle = '#15101c';
  circle(0, -T * 0.14, T * 0.1);
  ctx.fill();
  ctx.fillStyle = '#ff3b3b';
  for (const sd of [-1, 1]) {
    circle(sd * T * 0.045, -T * 0.18, T * 0.025);
    ctx.fill();
  }
  ctx.fillStyle = '#b04fff';
  circle(0, T * 0.08, T * 0.05);
  ctx.fill();
}

/** Nor: `mode` 0 alb, 1 încărcare întunecată, 2 încărcare fulger (ochi încruntați, scântei). */
export function cloud(mode: 0 | 1 | 2): void {
  const ch = mode > 0;
  const col = mode === 2 ? '#9aa3c0' : mode === 1 ? '#4a5068' : '#eef2fb';
  const sh = ch ? '#2f3448' : '#b9c3dc';
  for (const [ox, oy, r] of [
    [-0.24, 0.06, 0.2],
    [0.24, 0.06, 0.2],
    [0, -0.06, 0.26],
    [-0.1, 0.1, 0.2],
    [0.12, 0.12, 0.2],
  ] as const) {
    ctx.fillStyle = sh;
    circle(ox * T, oy * T + T * 0.04, r * T);
    ctx.fill();
  }
  for (const [ox, oy, r] of [
    [-0.24, 0.02, 0.19],
    [0.24, 0.02, 0.19],
    [0, -0.1, 0.25],
    [-0.1, 0.06, 0.19],
    [0.12, 0.08, 0.19],
  ] as const) {
    ctx.fillStyle = col;
    circle(ox * T, oy * T, r * T);
    ctx.fill();
  }
  ctx.fillStyle = ch ? '#fff36b' : '#3a4058';
  for (const sd of [-1, 1]) {
    circle(sd * T * 0.09, -T * 0.02, T * 0.035);
    ctx.fill();
  }
  if (ch) {
    ctx.strokeStyle = '#fff36b';
    ctx.lineWidth = T * 0.025;
    ctx.beginPath();
    ctx.moveTo(-T * 0.2, -T * 0.14);
    ctx.lineTo(-T * 0.04, -T * 0.08);
    ctx.moveTo(T * 0.2, -T * 0.14);
    ctx.lineTo(T * 0.04, -T * 0.08);
    ctx.stroke();
  }
  if (mode === 2) {
    ctx.strokeStyle = '#fff36b';
    ctx.lineWidth = T * 0.03;
    ctx.beginPath();
    ctx.moveTo(-T * 0.1, T * 0.2);
    ctx.lineTo(-T * 0.02, T * 0.3);
    ctx.lineTo(-T * 0.08, T * 0.36);
    ctx.stroke();
  }
}

/** Steag pe băț; baza bățului în origine. */
export function flag(col: string): void {
  ctx.fillStyle = '#12131c';
  ctx.fillRect(-T * 0.03, -T * 0.75, T * 0.06, T * 0.8);
  ctx.fillStyle = col;
  ctx.strokeStyle = '#12131c';
  ctx.lineWidth = T * 0.025;
  ctx.beginPath();
  ctx.moveTo(T * 0.03, -T * 0.75);
  ctx.quadraticCurveTo(T * 0.2, -T * 0.72, T * 0.42, -T * 0.66);
  ctx.quadraticCurveTo(T * 0.2, -T * 0.52, T * 0.03, -T * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

export function crown(): void {
  const y0 = 0;
  ctx.fillStyle = '#ffd23f';
  ctx.strokeStyle = '#8a6a00';
  ctx.lineWidth = T * 0.03;
  ctx.beginPath();
  ctx.moveTo(-T * 0.2, y0);
  ctx.lineTo(-T * 0.22, y0 - T * 0.2);
  ctx.lineTo(-T * 0.1, y0 - T * 0.1);
  ctx.lineTo(0, y0 - T * 0.26);
  ctx.lineTo(T * 0.1, y0 - T * 0.1);
  ctx.lineTo(T * 0.22, y0 - T * 0.2);
  ctx.lineTo(T * 0.2, y0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ff5f93';
  circle(0, y0 - T * 0.08, T * 0.035);
  ctx.fill();
}

/** Săgeata aurie de deasupra jucătorului propriu. */
export function arrow(): void {
  ctx.fillStyle = '#ffe14a';
  ctx.beginPath();
  ctx.moveTo(-T * 0.12, -T * 0.12);
  ctx.lineTo(T * 0.12, -T * 0.12);
  ctx.lineTo(0, T * 0.04);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#12131c';
  ctx.lineWidth = T * 0.025;
  ctx.stroke();
}

export function badge(ch: string): void {
  ctx.fillStyle = '#ff2d2d';
  circle(0, 0, T * 0.16);
  ctx.fill();
  text(ch, 0, T * 0.01, T * 0.18, '#fff');
}

/** Dungă de avertizare / zonă de fulger / cerc de bază etc. — forme simple. */
export function roundTile(fill: string, stroke: string | null, round: boolean): void {
  ctx.fillStyle = fill;
  rr(T * 0.08, T * 0.08, T * 0.84, T * 0.84, round ? T * 0.15 : 0);
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = T * 0.05;
    ctx.stroke();
  }
}

/** Inel (elipsă) cu contur; centrat în origine. */
export function ring(color: string, rx: number, ry: number, width: number, glowOn = false): void {
  if (glowOn) glow(color, 10);
  ctx.strokeStyle = color;
  ctx.lineWidth = T * width;
  ellipse(0, 0, T * rx, T * ry);
  ctx.stroke();
  noGlow();
}

export function disc(color: string, r: number, soft = false): void {
  if (soft) {
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, T * r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
  } else ctx.fillStyle = color;
  circle(0, 0, T * r);
  ctx.fill();
}

/** Elemente ambientale: fulg, inimioară, liliac, avion de hârtie. */
export function ambient(s: ThemeStyle): void {
  if (s === 'xmas') disc('#ffffff', 0.05);
  else if (s === 'valentine') {
    ctx.fillStyle = '#ff4d8a';
    heartPath(0, 0, T * 0.3);
    ctx.fill();
  } else if (s === 'halloween') {
    ctx.fillStyle = '#0d0812';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-T * 0.2, -T * 0.1, -T * 0.38, 0);
    ctx.quadraticCurveTo(-T * 0.2, T * 0.02, 0, T * 0.06);
    ctx.quadraticCurveTo(T * 0.2, T * 0.02, T * 0.38, 0);
    ctx.quadraticCurveTo(T * 0.2, -T * 0.1, 0, 0);
    ctx.fill();
  } else if (s === 'school') {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#9ab3cf';
    ctx.lineWidth = T * 0.02;
    ctx.beginPath();
    ctx.moveTo(T * 0.3, T * 0.1);
    ctx.lineTo(-T * 0.2, -T * 0.08);
    ctx.lineTo(-T * 0.08, T * 0.1);
    ctx.lineTo(-T * 0.2, T * 0.22);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

/* ---------- misiuni ---------- */

/** Turn roșu-alb cu steag; baza la (0, 0) = colțul pătrățelului; bulinele arată viața turnurilor blindate. */
export function tower(hp: number, maxHp: number): void {
  ctx.fillStyle = '#3a1418';
  ctx.fillRect(T * 0.12, -T * 0.35, T * 0.76, T * 1.25);
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i % 2 ? '#f3f1ea' : '#e0402f';
    ctx.fillRect(T * 0.16, -T * 0.3 + i * T * 0.23, T * 0.68, T * 0.23);
  }
  ctx.fillStyle = '#8a8f9c';
  ctx.fillRect(T * 0.1, -T * 0.42, T * 0.8, T * 0.1);
  ctx.strokeStyle = '#12131c';
  ctx.lineWidth = T * 0.03;
  ctx.beginPath();
  ctx.moveTo(T * 0.5, -T * 0.42);
  ctx.lineTo(T * 0.5, -T * 0.75);
  ctx.stroke();
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath();
  ctx.moveTo(T * 0.5, -T * 0.75);
  ctx.lineTo(T * 0.8, -T * 0.66);
  ctx.lineTo(T * 0.5, -T * 0.57);
  ctx.fill();
  if (maxHp > 1)
    for (let i = 0; i < maxHp; i++) {
      ctx.fillStyle = i < hp ? '#ff5a4d' : '#3a3f5c';
      circle(T * (0.38 + i * 0.24), T * 0.97, T * 0.07);
      ctx.fill();
    }
}

/** Cușca cu prietenul prins (colțul pătrățelului în origine). */
export function cage(col: string): void {
  ctx.fillStyle = '#2a2f45';
  ctx.fillRect(T * 0.08, T * 0.08, T * 0.84, T * 0.84);
  const cx = T / 2;
  const cy = T * 0.55;
  friendFace(col, cx, cy, false, [0, 1], true);
  ctx.strokeStyle = '#b9c0d3';
  ctx.lineWidth = T * 0.06;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(T * (0.14 + i * 0.18), T * 0.1);
    ctx.lineTo(T * (0.14 + i * 0.18), T * 0.9);
    ctx.stroke();
  }
  ctx.strokeRect(T * 0.1, T * 0.1, T * 0.8, T * 0.8);
}

export function helpText(): void {
  text('Help!', 0, 0, T * 0.2, '#ffffff', 800);
}

/** Fața unui prieten (bilă colorată). `faint` = ochi în X. */
export function friendFace(
  col: string,
  cx: number,
  cy: number,
  faint: boolean,
  dir: [number, number],
  sad = false,
): void {
  const dark = '#12131c';
  ctx.fillStyle = col;
  ctx.strokeStyle = dark;
  ctx.lineWidth = T * 0.04;
  circle(cx, cy, T * 0.25);
  ctx.fill();
  if (!sad) ctx.stroke();
  if (faint) {
    for (const sd of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + sd * T * 0.08 - T * 0.04, cy - T * 0.07);
      ctx.lineTo(cx + sd * T * 0.08 + T * 0.04, cy + 0.01);
      ctx.moveTo(cx + sd * T * 0.08 + T * 0.04, cy - T * 0.07);
      ctx.lineTo(cx + sd * T * 0.08 - T * 0.04, cy + 0.01);
      ctx.stroke();
    }
    return;
  }
  ctx.fillStyle = '#fff';
  for (const sd of [-1, 1]) {
    circle(cx + sd * T * 0.08, cy - T * 0.04, T * 0.06);
    ctx.fill();
  }
  ctx.fillStyle = dark;
  for (const sd of [-1, 1]) {
    circle(cx + sd * T * 0.08 + dir[0] * T * 0.02, cy - T * 0.03 + dir[1] * T * 0.02, T * 0.03);
    ctx.fill();
  }
  ctx.beginPath();
  if (sad) ctx.arc(cx, cy + T * 0.12, T * 0.06, Math.PI * 1.1, Math.PI * 1.9);
  else ctx.arc(cx, cy + T * 0.06, T * 0.08, 0, Math.PI);
  ctx.stroke();
}

/** Steagul cu carouri al cursei (baza bățului la origine). */
export function raceFlag(): void {
  ctx.fillStyle = '#12131c';
  ctx.fillRect(-T * 0.2, -T * 1.2, T * 0.06, T * 1.45);
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 4; c++) {
      ctx.fillStyle = (r + c) % 2 ? '#12131c' : '#ffffff';
      ctx.fillRect(T * (-0.14 + c * 0.12), T * (-1.18 + r * 0.12), T * 0.12, T * 0.12);
    }
}

/* ---------- personaje și cosmetice (portate din prototip; personajele noi desenate aici) ---------- */

/** Detaliile personajului și cosmeticele (pălărie, accesoriu), peste corp. */
function extras(look: Look, face: [number, number], alive: boolean): void {
  const r = T * 0.34;
  const [fx, fy] = face;
  const hc = -T * 0.02;
  const top = hc - r;
  const ey = -r * 0.12 - T * 0.02 + fy * r * 0.12;
  const ex = fx * r * 0.28;
  const dk = '#12131c';
  ctx.save();
  ctx.lineCap = 'round';
  switch (look.ch) {
    case 'bubu':
      if (!alive) break;
      ctx.fillStyle = 'rgba(255,110,140,.55)';
      for (const sd of [-1, 1]) {
        ellipse(sd * r * 0.55 + ex, ey + r * 0.32, r * 0.13, r * 0.08);
        ctx.fill();
      }
      break;
    case 'gugu':
      ctx.fillStyle = '#2b1d12';
      for (const sd of [-1, 1]) {
        ctx.save();
        ctx.translate(sd * r * 0.36 + ex, ey - r * 0.36);
        ctx.rotate(sd * 0.2);
        ctx.fillRect(-r * 0.24, -r * 0.07, r * 0.48, r * 0.14);
        ctx.restore();
      }
      mustache(ex, ey, r, '#2b1d12');
      break;
    case 'zuzu': {
      ctx.fillStyle = '#e0302f';
      ctx.fillRect(-r * 0.98, top + r * 0.3, r * 1.96, r * 0.2);
      const sd = fx || 1;
      ctx.beginPath();
      ctx.moveTo(-sd * r * 0.9, top + r * 0.35);
      ctx.lineTo(-sd * r * 1.4, top + r * 0.18);
      ctx.lineTo(-sd * r * 1.35, top + r * 0.55);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'fifi': {
      ctx.fillStyle = '#ff5fa8';
      const bx = r * 0.55;
      const by = top + r * 0.2;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx - r * 0.35, by - r * 0.2);
      ctx.lineTo(bx - r * 0.35, by + r * 0.2);
      ctx.closePath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + r * 0.35, by - r * 0.2);
      ctx.lineTo(bx + r * 0.35, by + r * 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffd0e6';
      circle(bx, by, r * 0.09);
      ctx.fill();
      if (!alive) break;
      ctx.strokeStyle = dk;
      ctx.lineWidth = T * 0.02;
      for (const sd of [-1, 1])
        for (let i = 0; i < 3; i++) {
          const x0 = sd * r * 0.36 + ex + (i - 1) * r * 0.1;
          ctx.beginPath();
          ctx.moveTo(x0, ey - r * 0.24);
          ctx.lineTo(x0 + (i - 1) * r * 0.05, ey - r * 0.36);
          ctx.stroke();
        }
      break;
    }
    case 'veta':
      ctx.fillStyle = '#d8306a';
      ctx.beginPath();
      ctx.moveTo(-r * 1.02, hc + r * 0.1);
      ctx.quadraticCurveTo(-r * 1.05, top - r * 0.15, 0, top - r * 0.12);
      ctx.quadraticCurveTo(r * 1.05, top - r * 0.15, r * 1.02, hc + r * 0.1);
      ctx.quadraticCurveTo(r * 0.6, top + r * 0.4, 0, top + r * 0.42);
      ctx.quadraticCurveTo(-r * 0.6, top + r * 0.4, -r * 1.02, hc + r * 0.1);
      ctx.fill();
      ctx.fillStyle = '#ffe14a';
      for (const [a, b] of [
        [-0.5, 0.05],
        [0, -0.05],
        [0.5, 0.05],
        [-0.25, 0.25],
        [0.28, 0.25],
      ] as const) {
        circle(a * r, top + b * r + r * 0.05, r * 0.07);
        ctx.fill();
      }
      ctx.fillStyle = '#8a4a22';
      rr(r * 0.75, hc + r * 0.25, r * 0.45, r * 0.38, r * 0.08);
      ctx.fill();
      ctx.strokeStyle = '#8a4a22';
      ctx.lineWidth = T * 0.025;
      ctx.beginPath();
      ctx.arc(r * 0.97, hc + r * 0.25, r * 0.14, Math.PI, 0);
      ctx.stroke();
      break;
    case 'maestru':
      ctx.fillStyle = '#f4f4f8';
      for (const sd of [-1, 1])
        for (let i = 0; i < 3; i++) {
          circle(sd * r * (0.85 + i * 0.08), top + r * (0.35 + i * 0.18), r * (0.2 - i * 0.03));
          ctx.fill();
        }
      circle(0, top - r * 0.02, r * 0.18);
      ctx.fill();
      if (!alive) break;
      ctx.strokeStyle = '#d9a520';
      ctx.lineWidth = T * 0.028;
      for (const sd of [-1, 1]) {
        circle(sd * r * 0.36 + ex, ey, r * 0.27);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(ex - r * 0.1, ey);
      ctx.lineTo(ex + r * 0.1, ey);
      ctx.stroke();
      break;
    case 'robo':
      ctx.strokeStyle = dk;
      ctx.lineWidth = T * 0.03;
      ctx.beginPath();
      ctx.moveTo(0, top);
      ctx.lineTo(0, top - r * 0.45);
      ctx.stroke();
      ctx.fillStyle = '#ff3b3b';
      circle(0, top - r * 0.5, r * 0.1);
      ctx.fill();
      if (!alive) break;
      ctx.fillStyle = dk;
      ctx.fillRect(ex - r * 0.3, ey + r * 0.36, r * 0.6, r * 0.14);
      ctx.fillStyle = '#9fe3ff';
      for (let i = 0; i < 4; i++)
        ctx.fillRect(ex - r * 0.26 + i * r * 0.14, ey + r * 0.39, r * 0.08, r * 0.08);
      break;
    case 'nova':
      // coroană de raze, ca un soare mic
      ctx.fillStyle = '#ffe14d';
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i - 2) * 0.5;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a - 0.12) * r * 0.7, top + r * 0.35 + Math.sin(a - 0.12) * r * 0.7);
        ctx.lineTo(Math.cos(a) * r * 1.15, top + r * 0.35 + Math.sin(a) * r * 1.15);
        ctx.lineTo(Math.cos(a + 0.12) * r * 0.7, top + r * 0.35 + Math.sin(a + 0.12) * r * 0.7);
        ctx.fill();
      }
      break;
    case 'shade':
      // glugă întunecată cu o fâșie de mască peste ochi
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(-r * 0.98, ey - r * 0.2, r * 1.96, r * 0.4);
      ctx.fillStyle = '#a78bfa';
      ctx.fillRect(-r * 0.98, ey + r * 0.2, r * 1.96, r * 0.05);
      break;
    case 'portia':
      // inel de portal violet deasupra capului
      ctx.strokeStyle = '#b388ff';
      ctx.lineWidth = T * 0.05;
      ellipse(0, top - r * 0.1, r * 0.55, r * 0.2);
      ctx.stroke();
      ctx.strokeStyle = '#e8dcff';
      ctx.lineWidth = T * 0.02;
      ellipse(0, top - r * 0.1, r * 0.38, r * 0.12);
      ctx.stroke();
      break;
    case 'slick':
      // bentiță de gheață și două dungi de viteză pe lateral
      ctx.fillStyle = '#e6f7ff';
      ctx.fillRect(-r * 0.96, top + r * 0.3, r * 1.92, r * 0.16);
      ctx.fillStyle = '#4aa8ff';
      ctx.fillRect(-r * 0.96, top + r * 0.36, r * 1.92, r * 0.04);
      break;
    case 'striker':
      // bentiță albă cu dungă și o minge lângă picior
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-r * 0.96, top + r * 0.28, r * 1.92, r * 0.18);
      ctx.fillStyle = '#12131c';
      ctx.fillRect(-r * 0.96, top + r * 0.34, r * 1.92, r * 0.05);
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = dk;
      ctx.lineWidth = T * 0.02;
      circle(r * 0.95, hc + r * 0.85, r * 0.26);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = dk;
      circle(r * 0.95, hc + r * 0.85, r * 0.09);
      ctx.fill();
      break;
    case 'chef':
      if (!look.hat) {
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#c9c9d4';
        ctx.lineWidth = T * 0.02;
        ctx.fillRect(-r * 0.5, top - r * 0.15, r, r * 0.35);
        ctx.strokeRect(-r * 0.5, top - r * 0.15, r, r * 0.35);
        for (const [x, y, rad] of [
          [-0.35, -0.45, 0.32],
          [0.35, -0.45, 0.32],
          [0, -0.65, 0.36],
        ] as const) {
          circle(x * r, top + y * r, rad * r);
          ctx.fill();
        }
      }
      mustache(ex, ey, r, '#3a2414');
      break;
    case 'ghost':
      if (!alive) break;
      ctx.fillStyle = dk;
      ellipse(ex, ey + r * 0.42, r * 0.1, r * 0.14);
      ctx.fill();
      break;
    case 'magician':
      if (!look.hat) {
        ctx.fillStyle = '#16161e';
        ctx.fillRect(-r * 0.75, top + r * 0.04, r * 1.5, r * 0.16);
        ctx.fillRect(-r * 0.45, top - r * 0.78, r * 0.9, r * 0.85);
        ctx.fillStyle = '#8a5cff';
        ctx.fillRect(-r * 0.45, top - r * 0.13, r * 0.9, r * 0.14);
      }
      // bagheta
      ctx.strokeStyle = dk;
      ctx.lineWidth = T * 0.04;
      ctx.beginPath();
      ctx.moveTo(r * 0.8, hc + r * 0.6);
      ctx.lineTo(r * 1.25, hc - r * 0.05);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(r * 1.18, hc + r * 0.05);
      ctx.lineTo(r * 1.25, hc - r * 0.05);
      ctx.stroke();
      break;
  }
  switch (look.acc) {
    case 'a_shades':
      if (!alive) break;
      ctx.fillStyle = '#111';
      for (const sd of [-1, 1]) {
        rr(sd * r * 0.36 + ex - r * 0.26, ey - r * 0.16, r * 0.52, r * 0.3, r * 0.1);
        ctx.fill();
      }
      ctx.fillRect(ex - r * 0.12, ey - r * 0.1, r * 0.24, r * 0.06);
      break;
    case 'a_mustache':
      mustache(ex, ey, r, '#3a2414');
      break;
    case 'a_scarf':
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = i % 2 ? '#ffffff' : '#e0302f';
        ctx.fillRect(-r * 0.95 + i * r * 0.38, hc + r * 0.62, r * 0.38, r * 0.22);
      }
      ctx.fillStyle = '#e0302f';
      ctx.fillRect(r * 0.35, hc + r * 0.75, r * 0.2, r * 0.45);
      break;
  }
  if (look.hat) cosmeticHat(look.hat, top + r * 0.12, r, fx);
  ctx.restore();
}

function mustache(ex: number, ey: number, r: number, col: string): void {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(ex, ey + r * 0.34);
  ctx.bezierCurveTo(ex - r * 0.3, ey + r * 0.2, ex - r * 0.55, ey + r * 0.5, ex - r * 0.62, ey + r * 0.3);
  ctx.bezierCurveTo(ex - r * 0.5, ey + r * 0.55, ex - r * 0.2, ey + r * 0.52, ex, ey + r * 0.44);
  ctx.bezierCurveTo(ex + r * 0.2, ey + r * 0.52, ex + r * 0.5, ey + r * 0.55, ex + r * 0.62, ey + r * 0.3);
  ctx.bezierCurveTo(ex + r * 0.55, ey + r * 0.5, ex + r * 0.3, ey + r * 0.2, ex, ey + r * 0.34);
  ctx.fill();
}

function cosmeticHat(h: string, y: number, r: number, fx: number): void {
  if (h === 'h_top') {
    ctx.fillStyle = '#16161e';
    ctx.fillRect(-r * 0.75, y - r * 0.08, r * 1.5, r * 0.16);
    ctx.fillRect(-r * 0.45, y - r * 0.9, r * 0.9, r * 0.85);
    ctx.fillStyle = '#e0302f';
    ctx.fillRect(-r * 0.45, y - r * 0.25, r * 0.9, r * 0.14);
  } else if (h === 'h_crown') {
    ctx.fillStyle = '#ffd23f';
    ctx.strokeStyle = '#8a6a00';
    ctx.lineWidth = T * 0.02;
    ctx.beginPath();
    ctx.moveTo(-r * 0.6, y);
    ctx.lineTo(-r * 0.65, y - r * 0.6);
    ctx.lineTo(-r * 0.32, y - r * 0.3);
    ctx.lineTo(0, y - r * 0.75);
    ctx.lineTo(r * 0.32, y - r * 0.3);
    ctx.lineTo(r * 0.65, y - r * 0.6);
    ctx.lineTo(r * 0.6, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    for (const [a, c] of [
      [-0.3, '#ff3b6b'],
      [0, '#3bc6ff'],
      [0.3, '#7dff6a'],
    ] as const) {
      ctx.fillStyle = c;
      circle(a * r, y - r * 0.15, r * 0.08);
      ctx.fill();
    }
  } else if (h === 'h_cap') {
    ctx.fillStyle = '#2f6de0';
    ctx.beginPath();
    ctx.arc(0, y + r * 0.05, r * 0.78, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(-r * 0.78, y, r * 1.56, r * 0.1);
    const vd = fx > 0 ? 1 : fx < 0 ? -1 : 1;
    ctx.fillStyle = '#1f4ea8';
    ellipse(vd * r * 0.7, y + r * 0.08, r * 0.45, r * 0.1);
    ctx.fill();
  } else if (h === 'h_cowboy') {
    ctx.fillStyle = '#8a5a2b';
    ellipse(0, y, r * 1.15, r * 0.2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-r * 0.5, y);
    ctx.quadraticCurveTo(-r * 0.55, y - r * 0.75, -r * 0.15, y - r * 0.6);
    ctx.lineTo(0, y - r * 0.5);
    ctx.lineTo(r * 0.15, y - r * 0.6);
    ctx.quadraticCurveTo(r * 0.55, y - r * 0.75, r * 0.5, y);
    ctx.fill();
    ctx.fillStyle = '#4a2a10';
    ctx.fillRect(-r * 0.5, y - r * 0.18, r, r * 0.12);
  } else if (h === 'h_party') {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-r * 0.45, y + r * 0.05);
    ctx.lineTo(r * 0.1, y - r * 1.05);
    ctx.lineTo(r * 0.5, y + r * 0.05);
    ctx.closePath();
    ctx.fillStyle = '#ff5fa8';
    ctx.fill();
    ctx.clip();
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i % 2 ? '#ffe14a' : '#4fc3ff';
      ctx.fillRect(-r, y - r * 1.1 + i * r * 0.28, r * 2, r * 0.12);
    }
    ctx.restore();
    ctx.fillStyle = '#fff';
    circle(r * 0.1, y - r * 1.08, r * 0.12);
    ctx.fill();
  }
}

/** O urmă la mers (magazin): stea, bulă, inimă sau punct. */
export function trail(shape: string, col: string): void {
  const r = T * 0.09;
  ctx.fillStyle = col;
  ctx.strokeStyle = col;
  ctx.lineWidth = T * 0.03;
  if (shape === 'star') {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const rad = i % 2 ? r * 0.45 : r;
      ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
    }
    ctx.closePath();
    ctx.fill();
  } else if (shape === 'ring') {
    circle(0, 0, r * 0.8);
    ctx.stroke();
  } else if (shape === 'heart') {
    heartPath(0, 0, r * 2);
    ctx.fill();
  } else {
    circle(0, 0, r * 0.8);
    ctx.fill();
  }
}

/** Uleiul Bucătarului pe un pătrățel. */
export function oil(): void {
  ctx.fillStyle = 'rgba(160,110,20,.55)';
  ellipse(T * 0.5, T * 0.55, T * 0.4, T * 0.28);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,230,140,.45)';
  ellipse(T * 0.38, T * 0.45, T * 0.1, T * 0.05, -0.4);
  ctx.fill();
}

/** Porumbelul Magicianului (bomba transformată). */
export function pigeon(): void {
  const r = T * 0.22;
  ctx.fillStyle = '#f4f4f8';
  ctx.strokeStyle = '#12131c';
  ctx.lineWidth = T * 0.025;
  ellipse(0, 0, r, r * 0.7);
  ctx.fill();
  ctx.stroke();
  circle(r * 0.8, -r * 0.45, r * 0.42);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffb000';
  ctx.beginPath();
  ctx.moveTo(r * 1.15, -r * 0.5);
  ctx.lineTo(r * 1.45, -r * 0.4);
  ctx.lineTo(r * 1.15, -r * 0.3);
  ctx.fill();
  ctx.fillStyle = '#12131c';
  circle(r * 0.9, -r * 0.55, r * 0.07);
  ctx.fill();
  ctx.fillStyle = '#d8dde8';
  ellipse(-r * 0.2, -r * 0.35, r * 0.6, r * 0.3, -0.5);
  ctx.fill();
}

/* ---------- Faza 5: recuzita fatalităților (centrată în (0,0), ~1 pătrățel) ---------- */

export function fatProp(kind: string, v = 0): void {
  const ink = '#12131c';
  ctx.strokeStyle = ink;
  ctx.lineWidth = T * 0.035;
  ctx.lineJoin = 'round';
  switch (kind) {
    case 'anvil': {
      ctx.fillStyle = '#5c6070';
      ctx.beginPath();
      ctx.moveTo(-T * 0.5, -T * 0.3);
      ctx.lineTo(T * 0.5, -T * 0.3);
      ctx.lineTo(T * 0.3, -T * 0.05);
      ctx.lineTo(T * 0.18, T * 0.05);
      ctx.lineTo(T * 0.3, T * 0.3);
      ctx.lineTo(-T * 0.3, T * 0.3);
      ctx.lineTo(-T * 0.18, T * 0.05);
      ctx.lineTo(-T * 0.3, -T * 0.05);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#8b90a3';
      ctx.fillRect(-T * 0.42, -T * 0.26, T * 0.8, T * 0.07);
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${T * 0.18}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('1000 kg', 0, T * 0.22);
      break;
    }
    case 'star': {
      ctx.fillStyle = '#fff6a8';
      glow('#fff6a8', 18);
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const r = i % 2 ? T * 0.1 : T * 0.42;
        const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      noGlow();
      break;
    }
    case 'corn': {
      ctx.fillStyle = '#fff4d0';
      for (const [dx, dy, r] of [
        [-0.1, 0.04, 0.12],
        [0.1, 0.02, 0.11],
        [0, -0.1, 0.12],
      ] as const) {
        circle(dx * T, dy * T, r * T);
        ctx.fill();
        ctx.stroke();
      }
      ctx.fillStyle = v === 0 ? '#ffd35a' : v === 1 ? '#ffe9a8' : '#ffc13a';
      circle(0, T * 0.02, T * 0.07);
      ctx.fill();
      break;
    }
    case 'ghost': {
      ctx.fillStyle = 'rgba(245,248,255,.95)';
      ctx.beginPath();
      ctx.moveTo(-T * 0.22, T * 0.28);
      ctx.lineTo(-T * 0.22, -T * 0.06);
      ctx.arc(0, -T * 0.06, T * 0.22, Math.PI, 0);
      ctx.lineTo(T * 0.22, T * 0.28);
      ctx.lineTo(T * 0.11, T * 0.2);
      ctx.lineTo(0, T * 0.28);
      ctx.lineTo(-T * 0.11, T * 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = ink;
      circle(-T * 0.08, -T * 0.08, T * 0.035);
      ctx.fill();
      circle(T * 0.08, -T * 0.08, T * 0.035);
      ctx.fill();
      // harpa
      ctx.strokeStyle = '#c98a1a';
      ctx.lineWidth = T * 0.04;
      ctx.beginPath();
      ctx.arc(T * 0.3, T * 0.1, T * 0.16, -Math.PI * 0.6, Math.PI * 0.45);
      ctx.moveTo(T * 0.2, -T * 0.03);
      ctx.lineTo(T * 0.2, T * 0.26);
      ctx.stroke();
      break;
    }
    case 'note': {
      ctx.fillStyle = ['#ff6fb0', '#6fd0ff', '#ffe14a'][v % 3]!;
      ctx.strokeStyle = ctx.fillStyle;
      ellipse(-T * 0.04, T * 0.1, T * 0.07, T * 0.05, -0.4);
      ctx.fill();
      ctx.lineWidth = T * 0.03;
      ctx.beginPath();
      ctx.moveTo(T * 0.02, T * 0.08);
      ctx.lineTo(T * 0.02, -T * 0.16);
      ctx.stroke();
      break;
    }
    case 'folder': {
      ctx.fillStyle = '#e9c46a';
      rr(-T * 0.45, -T * 0.3, T * 0.9, T * 0.6, T * 0.04);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#f4d98c';
      rr(-T * 0.45, -T * 0.38, T * 0.4, T * 0.1, T * 0.03);
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'stamp': {
      ctx.strokeStyle = '#d6322b';
      ctx.fillStyle = '#d6322b';
      ctx.lineWidth = T * 0.05;
      rr(-T * 0.5, -T * 0.16, T, T * 0.32, T * 0.04);
      ctx.stroke();
      ctx.font = `bold ${T * 0.2}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('REJECTED', 0, T * 0.07);
      break;
    }
    case 'spit': {
      ctx.strokeStyle = '#8a6a3a';
      ctx.lineWidth = T * 0.05;
      ctx.beginPath();
      ctx.moveTo(-T * 0.6, 0);
      ctx.lineTo(T * 0.6, 0);
      ctx.stroke();
      ctx.fillStyle = '#7b7f92';
      for (const x of [-0.6, 0.6]) {
        ctx.fillRect((x - 0.04) * T, -T * 0.22, T * 0.08, T * 0.44);
      }
      break;
    }
    case 'bell': {
      ctx.fillStyle = '#ffd24a';
      ctx.beginPath();
      ctx.arc(0, 0, T * 0.14, Math.PI, 0);
      ctx.lineTo(T * 0.18, T * 0.1);
      ctx.lineTo(-T * 0.18, T * 0.1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      circle(0, T * 0.14, T * 0.035);
      ctx.fill();
      ctx.fillStyle = ink;
      ctx.font = `bold ${T * 0.17}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('ding!', 0, -T * 0.2);
      break;
    }
    case 'bubble': {
      ctx.fillStyle = '#fff';
      rr(-T * 0.32, -T * 0.3, T * 0.64, T * 0.5, T * 0.16);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-T * 0.08, T * 0.19);
      ctx.lineTo(0, T * 0.34);
      ctx.lineTo(T * 0.1, T * 0.19);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillRect(-T * 0.06, T * 0.17, T * 0.14, T * 0.05);
      break;
    }
    case 'jet': {
      const g = ctx.createLinearGradient(0, -T * 0.1, 0, T * 0.5);
      g.addColorStop(0, '#fff6a8');
      g.addColorStop(0.5, '#ff9a2a');
      g.addColorStop(1, 'rgba(255,60,20,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-T * 0.14, -T * 0.1);
      ctx.quadraticCurveTo(0, T * 0.62, T * 0.14, -T * 0.1);
      ctx.closePath();
      ctx.fill();
      break;
    }
  }
}

/* ---------- Faza 4: personaje, tufișuri, gheață, otravă, capcane ---------- */

/**
 * Semnul personajului deasupra capului (desen provizoriu; arta finală ține de direcția artistică).
 * Centrat în (0, 0), cam 0.5×0.4 pătrățele.
 */
export function heroMark(id: string, col: string): void {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  switch (id) {
    case 'zuzu': // fulger
      ctx.fillStyle = '#ffe14a';
      ctx.beginPath();
      ctx.moveTo(T * 0.04, -T * 0.18);
      ctx.lineTo(-T * 0.1, T * 0.02);
      ctx.lineTo(0, T * 0.02);
      ctx.lineTo(-T * 0.05, T * 0.18);
      ctx.lineTo(T * 0.11, -T * 0.03);
      ctx.lineTo(T * 0.01, -T * 0.03);
      ctx.closePath();
      ctx.fill();
      return;
    case 'gogu': // șapcă
      ctx.fillStyle = '#2fd3c6';
      ellipse(0, T * 0.04, T * 0.18, T * 0.12);
      ctx.fill();
      ctx.fillRect(0, T * 0.02, T * 0.26, T * 0.06);
      return;
    case 'fifi': // fundă
      ctx.fillStyle = '#ff7ac8';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-T * 0.18, -T * 0.1);
      ctx.lineTo(-T * 0.18, T * 0.1);
      ctx.closePath();
      ctx.moveTo(0, 0);
      ctx.lineTo(T * 0.18, -T * 0.1);
      ctx.lineTo(T * 0.18, T * 0.1);
      ctx.closePath();
      ctx.fill();
      circle(0, 0, T * 0.05);
      ctx.fill();
      return;
    case 'veta': // basma cu buline
      ctx.fillStyle = '#b07cff';
      ctx.beginPath();
      ctx.moveTo(-T * 0.22, T * 0.12);
      ctx.quadraticCurveTo(0, -T * 0.28, T * 0.22, T * 0.12);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fff';
      for (const [x, y] of [
        [-0.08, 0.02],
        [0.06, -0.04],
        [0.1, 0.07],
      ]) {
        circle(x! * T, y! * T, T * 0.025);
        ctx.fill();
      }
      return;
    case 'maestro': // pălărie de vrăjitor cu stea
      ctx.fillStyle = '#3b2a7a';
      ctx.beginPath();
      ctx.moveTo(-T * 0.2, T * 0.14);
      ctx.lineTo(T * 0.2, T * 0.14);
      ctx.lineTo(T * 0.04, -T * 0.24);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffc83d';
      circle(T * 0.02, -T * 0.02, T * 0.04);
      ctx.fill();
      return;
    case 'robo': // antenă cu led
      ctx.strokeStyle = '#9aa7b8';
      ctx.lineWidth = T * 0.04;
      ctx.beginPath();
      ctx.moveTo(0, T * 0.16);
      ctx.lineTo(0, -T * 0.08);
      ctx.stroke();
      glow('#ff4d4d', 8);
      ctx.fillStyle = '#ff4d4d';
      circle(0, -T * 0.12, T * 0.06);
      ctx.fill();
      noGlow();
      return;
    default: // bubu: moț
      ctx.strokeStyle = col;
      ctx.lineWidth = T * 0.05;
      ctx.beginPath();
      ctx.moveTo(-T * 0.04, T * 0.14);
      ctx.quadraticCurveTo(-T * 0.12, -T * 0.08, T * 0.06, -T * 0.14);
      ctx.stroke();
  }
}

/** Blocul de gheață peste jucătorul înghețat (centrat). */
export function iceBlock(): void {
  ctx.fillStyle = 'rgba(159,232,255,0.42)';
  rr(-T * 0.42, -T * 0.6, T * 0.84, T * 1.0, T * 0.12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(230,250,255,0.9)';
  ctx.lineWidth = T * 0.04;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.moveTo(-T * 0.28, -T * 0.42);
  ctx.lineTo(-T * 0.12, -T * 0.5);
  ctx.moveTo(-T * 0.3, -T * 0.3);
  ctx.lineTo(-T * 0.22, -T * 0.34);
  ctx.stroke();
}

/** Norul toxic pe un pătrățel (origine stânga-sus). */
export function toxic(): void {
  glow('#8dff5a', 10);
  ctx.fillStyle = 'rgba(120,230,70,0.32)';
  for (const [x, y, r] of [
    [0.3, 0.4, 0.26],
    [0.65, 0.35, 0.24],
    [0.5, 0.65, 0.28],
  ] as const) {
    circle(x * T, y * T, r * T);
    ctx.fill();
  }
  noGlow();
}

/** Fum (bomba fumigenă) pe un pătrățel, origine în centru; `v` variază umflăturile ca norul să nu pară dalat. */
export function smoke(v: number): void {
  ctx.fillStyle = 'rgba(176,182,196,0.92)';
  for (let i = 0; i < 6; i++) {
    const a = hash(i, v, 77) * 6.28;
    const d = 0.12 + hash(i, v, 78) * 0.22;
    circle(Math.cos(a) * d * T, Math.sin(a) * d * T, T * (0.22 + hash(i, v, 79) * 0.12));
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(226,230,240,0.55)';
  for (let i = 0; i < 3; i++) {
    circle((hash(i, v, 80) - 0.5) * T * 0.5, (hash(i, v, 81) - 0.6) * T * 0.4, T * 0.15);
    ctx.fill();
  }
}

/**
 * Tufiș (origine: centrul pătrățelului): iarbă înaltă, cu fire — diferită de lăzi pe toate temele
 * (pe Jungle lăzile sunt deja tufe cu frunze).
 */
export function bush(c1: string, c2: string, variant: number): void {
  ctx.lineCap = 'round';
  ctx.fillStyle = 'rgba(20,60,20,0.35)';
  ellipse(0, T * 0.32, T * 0.44, T * 0.12);
  ctx.fill();
  for (let layer = 0; layer < 2; layer++) {
    ctx.strokeStyle = layer ? c1 : c2;
    ctx.lineWidth = T * (layer ? 0.06 : 0.08);
    for (let i = 0; i < 9; i++) {
      const u = (i + 0.5) / 9 - 0.5;
      const x0 = u * T * 0.82 + (hash(i, variant, layer + 3) - 0.5) * T * 0.08;
      const h = T * (0.55 + 0.3 * hash(i, variant, layer + 7));
      const lean = (hash(i, variant, 11) - 0.5) * T * 0.35 + u * T * 0.2;
      ctx.beginPath();
      ctx.moveTo(x0, T * 0.34);
      ctx.quadraticCurveTo(x0 + lean * 0.3, T * 0.34 - h * 0.6, x0 + lean, T * 0.34 - h);
      ctx.stroke();
    }
  }
}

/** Capcana lui Robo-Mici: o placă cu un led. */
export function trap(): void {
  ctx.fillStyle = '#3a3f55';
  rr(-T * 0.22, -T * 0.12, T * 0.44, T * 0.24, T * 0.06);
  ctx.fill();
  ctx.strokeStyle = '#9aa7b8';
  ctx.lineWidth = T * 0.03;
  ctx.stroke();
  ctx.fillStyle = '#ff4d4d';
  circle(0, 0, T * 0.05);
  ctx.fill();
}
