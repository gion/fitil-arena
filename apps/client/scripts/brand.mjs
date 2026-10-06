/**
 * Generează iconițele aplicației și ecranele de pornire din SVG-uri proprii (fără asset-uri externe):
 * `assets/brand/*.svg` (sursele) și PNG-urile din `android/`, `ios/`, `public/`.
 * Rulare: `pnpm --filter @fitil/client brand` (are nevoie de Chromium-ul Playwright; în containere
 * cu altă versiune: `PW_CHROMIUM=/cale/chrome`).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const client = resolve(here, '..');
const root = resolve(client, '../..');

const INK = '#111111';
const PAPER = '#FFD60A';
const PAPER_DOT = '#F2B600';
const CYAN = '#19B5E8';
const RAY = '#5CCBF0';
const RED = '#E5262B';
const CORD = '#C98A4B';

/** Raze de benzi desenate pe fundal cyan, din centrul (cx, cy). */
const rays = (size, cx, cy, n = 20) => {
  const R = size * 1.5;
  let d = '';
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2;
    const a1 = a0 + Math.PI / n;
    const p = (a) => `${(cx + R * Math.cos(a)).toFixed(1)} ${(cy + R * Math.sin(a)).toFixed(1)}`;
    d += `M${cx} ${cy}L${p(a0)}L${p(a1)}Z`;
  }
  return `<rect width="${size}" height="${size}" fill="${CYAN}"/><path d="${d}" fill="${RAY}"/>`;
};

/** Stea cu `n` vârfuri (scânteia fitilului). */
const star = (cx, cy, ro, ri, n, rot = -Math.PI / 2) => {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? ri : ro;
    const a = rot + (i * Math.PI) / n;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
};

/** Bomba (în coordonate 1024×1024, încadrată aprox. în 170..960 × 60..910). */
const bomb = () => `
  <circle cx="498" cy="608" r="300" fill="${INK}"/>
  <g transform="rotate(40 655 345)">
    <rect x="590" y="290" width="130" height="110" rx="14" fill="#3A3F55" stroke="${INK}" stroke-width="22"/>
    <rect x="606" y="306" width="22" height="78" rx="8" fill="#5A6080"/>
  </g>
  <circle cx="470" cy="580" r="300" fill="#252A3D" stroke="${INK}" stroke-width="26"/>
  <path d="M260 640 A220 220 0 0 0 560 840" fill="none" stroke="#1A1E2C" stroke-width="40" stroke-linecap="round"/>
  <ellipse cx="365" cy="470" rx="78" ry="42" transform="rotate(-38 365 470)" fill="#FFFFFF"/>
  <circle cx="300" cy="560" r="20" fill="#FFFFFF"/>
  <path d="M690 300 C 730 215, 820 270, 838 185" fill="none" stroke="${INK}" stroke-width="48" stroke-linecap="round"/>
  <path d="M690 300 C 730 215, 820 270, 838 185" fill="none" stroke="${CORD}" stroke-width="24" stroke-linecap="round"/>
  <polygon points="${star(845, 170, 118, 58, 10)}" fill="${PAPER}" stroke="${INK}" stroke-width="16" stroke-linejoin="round"/>
  <polygon points="${star(845, 170, 58, 28, 8, -Math.PI / 3)}" fill="${RED}" stroke="${INK}" stroke-width="10" stroke-linejoin="round"/>`;

/** Bomba scalată `k` și centrată în pătratul de `size` (centrul conținutului ≈ 565, 485). */
const placed = (size, k, dx = 0, dy = 0) => {
  const s = (size / 1024) * k;
  const tx = size / 2 - 565 * s + dx;
  const ty = size / 2 - 485 * s + dy;
  return `<g transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${s.toFixed(4)})">${bomb()}</g>`;
};

const svg = (w, h, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;

/** Iconița completă (iOS, Android vechi, web): fundal cu raze + bomba. */
const iconSvg = svg(1024, 1024, rays(1024, 470, 580) + placed(1024, 0.84));
/** Android adaptiv: prim-planul transparent, în cercul sigur de 66/108. */
const fgSvg = svg(1024, 1024, placed(1024, 0.6));
/** Android adaptiv: fundalul cu raze. */
const bgSvg = svg(1024, 1024, rays(1024, 512, 512));
/** Iconița rotundă Android (lansatoare vechi). */
const roundSvg = svg(
  1024,
  1024,
  `<defs><clipPath id="c"><circle cx="512" cy="512" r="512"/></clipPath></defs><g clip-path="url(#c)">${rays(1024, 512, 512)}${placed(1024, 0.72)}</g>`,
);

const font = readFileSync(resolve(client, 'src/ui/fonts/bangers-latin-400-normal.woff2')).toString('base64');
/** Ecranul de pornire: hârtia galbenă cu puncte, bomba și „FUSE ARENA”. */
const splashHtml = (w, h) => {
  const u = Math.min(w, h) / 1000;
  const word = (t, size, color, stroke, dy) =>
    `<div style="font:400 ${size * u}px Bangers;letter-spacing:${4 * u}px;color:${color};-webkit-text-stroke:${stroke * u}px ${INK};paint-order:stroke fill;text-shadow:${7 * u}px ${7 * u}px 0 ${INK};transform:rotate(-4deg);margin-top:${dy * u}px;line-height:1">${t}</div>`;
  return `<html><head><style>@font-face{font-family:Bangers;src:url(data:font/woff2;base64,${font})}
  html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden}
  body{background:${PAPER} radial-gradient(${PAPER_DOT} 24%,transparent 25%) 0 0/${18 * u}px ${18 * u}px;display:flex;align-items:center;justify-content:center}
  .c{display:flex;flex-direction:column;align-items:center}</style></head>
  <body><div class="c"><svg width="${Math.round(360 * u)}" height="${Math.round(360 * u)}" viewBox="0 0 1024 1024">${placed(1024, 0.95)}</svg>
  ${word('FUSE', 150, RED, 14, 10)}${word('ARENA', 110, PAPER, 12, -10)}</div></body></html>`;
};

const out = (p) => {
  const f = resolve(root, p);
  mkdirSync(dirname(f), { recursive: true });
  return f;
};

writeFileSync(out('assets/brand/icon.svg'), iconSvg);
writeFileSync(out('assets/brand/icon-foreground.svg'), fgSvg);
writeFileSync(out('assets/brand/icon-background.svg'), bgSvg);
writeFileSync(out('apps/client/public/icon.svg'), iconSvg);

const browser = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
);
const page = await browser.newPage();

const shoot = async (html, w, h, file, transparent = false) => {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(html);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: out(file),
    omitBackground: transparent,
    clip: { x: 0, y: 0, width: w, height: h },
  });
};
const svgPage = (s, size) =>
  `<html><body style="margin:0;background:transparent">${s.replace(/width="1024" height="1024"/, `width="${size}" height="${size}"`)}</body></html>`;

// iOS: o singură iconiță 1024 (fără transparență)
await shoot(
  svgPage(iconSvg, 1024),
  1024,
  1024,
  'apps/client/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png',
);
// web
await shoot(svgPage(iconSvg, 180), 180, 180, 'apps/client/public/apple-touch-icon.png');
// Android
const res = 'apps/client/android/app/src/main/res';
for (const [d, k] of [
  ['mdpi', 1],
  ['hdpi', 1.5],
  ['xhdpi', 2],
  ['xxhdpi', 3],
  ['xxxhdpi', 4],
]) {
  const icon = 48 * k;
  const ad = 108 * k;
  await shoot(svgPage(iconSvg, icon), icon, icon, `${res}/mipmap-${d}/ic_launcher.png`);
  await shoot(svgPage(roundSvg, icon), icon, icon, `${res}/mipmap-${d}/ic_launcher_round.png`, true);
  await shoot(svgPage(fgSvg, ad), ad, ad, `${res}/mipmap-${d}/ic_launcher_foreground.png`, true);
  await shoot(svgPage(bgSvg, ad), ad, ad, `${res}/mipmap-${d}/ic_launcher_background.png`);
}
// ecrane de pornire
const splashes = [
  ['drawable', 480, 320],
  ['drawable-land-mdpi', 480, 320],
  ['drawable-land-hdpi', 800, 480],
  ['drawable-land-xhdpi', 1280, 720],
  ['drawable-land-xxhdpi', 1600, 960],
  ['drawable-land-xxxhdpi', 1920, 1280],
  ['drawable-port-mdpi', 320, 480],
  ['drawable-port-hdpi', 480, 800],
  ['drawable-port-xhdpi', 720, 1280],
  ['drawable-port-xxhdpi', 960, 1600],
  ['drawable-port-xxxhdpi', 1280, 1920],
];
for (const [d, w, h] of splashes) await shoot(splashHtml(w, h), w, h, `${res}/${d}/splash.png`);
// iOS: 2732² decupat „aspect fill”, deci conținutul stă în centru, mic
const iosSplash = splashHtml(2732, 2732).replace(
  /<div class="c">/,
  '<div class="c" style="transform:scale(.6)">',
);
for (const f of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png'])
  await shoot(iosSplash, 2732, 2732, `apps/client/ios/App/App/Assets.xcassets/Splash.imageset/${f}`);

await browser.close();
console.log('brand: gata');
