/**
 * pnpm balance [meciuri=3500]
 * FFA de 4 boți „hard” cu personaje diferite, pe teme și evenimente trase din seed.
 * Raportează rata de victorie per personaj și per personaj × arenă (temă), plus folosirea Super-urilor.
 * `--md` scrie tabelul în Markdown (pentru docs/balance.md).
 */
import { TICK_HZ, collectInputs, createGame, step } from '@fitil/sim';
import { CHAR_IDS, THEMES, botChars, charById, charSetup, matchRules, pickArenaEvent } from '../src/index.ts';

const N = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 3500);
const MD = process.argv.includes('--md');
const MAX = 5 * 60 * TICK_HZ;

type Tally = { n: number; w: number };
const per: Record<string, Tally> = {};
const perTheme: Record<string, Record<string, Tally>> = {};
const perEvent: Record<string, { n: number; draws: number; ticks: number }> = {};
const supers: Record<string, number> = {};
let draws = 0;
let timeouts = 0;
let ticks = 0;
const t0 = performance.now();

for (let seed = 1; seed <= N; seed++) {
  const theme = THEMES[seed % THEMES.length]!.id;
  const heroes = botChars(seed, [], 4);
  const s = createGame({
    seed,
    rules: { ...matchRules('ffa', theme, seed, 16 / 9), charges: true },
    players: heroes.map((h) => ({ bot: 'hard' as const, ...charSetup(h, theme) })),
  });
  while (!s.result && s.tick < MAX) {
    step(s, collectInputs(s));
    for (const e of s.events)
      if (e.type === 'super') supers[heroes[e.player]!] = (supers[heroes[e.player]!] ?? 0) + 1;
  }
  const ev = pickArenaEvent(seed).id;
  perEvent[ev] ??= { n: 0, draws: 0, ticks: 0 };
  perEvent[ev].n++;
  perEvent[ev].ticks += s.tick;
  if (!s.result) timeouts++;
  ticks += s.tick;
  const win = s.result?.winner ?? null;
  if (win === null) {
    draws++;
    perEvent[ev].draws++;
  }
  heroes.forEach((h, i) => {
    per[h] ??= { n: 0, w: 0 };
    perTheme[h] ??= {};
    perTheme[h][theme] ??= { n: 0, w: 0 };
    per[h].n++;
    perTheme[h][theme].n++;
    if (win === i) {
      per[h].w++;
      perTheme[h][theme].w++;
    }
  });
}

const pct = (t?: Tally) => (t && t.n ? (100 * t.w) / t.n : NaN);
const f = (v: number) => (Number.isNaN(v) ? '—' : v.toFixed(1));
const out: string[] = [];
const secs = ((performance.now() - t0) / 1000).toFixed(0);
let ok = true;

if (MD) {
  out.push(
    `${N} meciuri FFA de 4 boți „hard” · egaluri ${f((100 * draws) / N)}% · durată medie ${(ticks / N / TICK_HZ).toFixed(0)}s · neterminate ${timeouts}`,
  );
  out.push('');
  out.push('| Personaj | Victorii | Ultimate / meci | ' + THEMES.map((t) => t.id).join(' | ') + ' |');
  out.push('|---|---|---|' + THEMES.map(() => '---').join('|') + '|');
}
for (const h of CHAR_IDS) {
  const w = pct(per[h]);
  if (!(w >= 18 && w <= 32)) ok = false;
  const cells = THEMES.map((t) => {
    const v = pct(perTheme[h]?.[t.id]);
    if (!(v >= 15 && v <= 35)) ok = false;
    return f(v);
  });
  const sp = ((supers[h] ?? 0) / (per[h]?.n ?? 1)).toFixed(1);
  if (MD) out.push(`| ${charById(h).name} | ${f(w)}% | ${sp} | ${cells.join(' | ')} |`);
  else
    out.push(
      `${charById(h).name.padEnd(13)} ${f(w).padStart(5)}%  super/meci ${sp}  · pe teme: ${cells.join(' ')}`,
    );
}
if (MD) {
  out.push('');
  out.push('| Eveniment | Meciuri | Egaluri | Durată medie |');
  out.push('|---|---|---|---|');
  for (const [id, e] of Object.entries(perEvent))
    out.push(`| ${id} | ${e.n} | ${f((100 * e.draws) / e.n)}% | ${(e.ticks / e.n / TICK_HZ).toFixed(0)}s |`);
} else {
  out.unshift(
    `balance — ${N} meciuri în ${secs}s · egaluri ${f((100 * draws) / N)}% · durată medie ${(ticks / N / TICK_HZ).toFixed(0)}s · neterminate ${timeouts}`,
  );
  out.push(`ținte (18–32% pe personaj, 15–35% pe arenă): ${ok ? 'OK' : 'NU'}`);
}
console.log(out.join('\n'));
