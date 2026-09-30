/**
 * pnpm sim:bench [meciuri=1000]
 * Rulează meciuri bot-vs-bot headless și raportează excepții, meciuri neterminate în 5 min simulate,
 * durata medie, victorii pe nivel de bot și un control de determinism (10 meciuri rulate de două ori).
 */
import {
  TICK_HZ,
  collectInputs,
  createGame,
  ctfRules,
  duelRules,
  gridForAspect,
  hashState,
  rotateRules,
  shiftRules,
  step,
} from '../src/index.ts';
import type { BotLevel, GameSetup } from '../src/index.ts';

const N = Number(process.argv[2] ?? 1000);
const MAX_TICKS = 5 * 60 * TICK_HZ;
const LEVELS: BotLevel[] = ['easy', 'normal', 'hard', 'insane'];

const MODES = [
  'ffa 16:9',
  'ffa 4:3',
  'ffa portret',
  '1v1',
  'echipe 3v3',
  'rânduri mobile',
  'rotativă',
  'CTF',
];

function setupFor(seed: number): GameSetup {
  const kind = seed % MODES.length;
  const four = () => LEVELS.map((_, i) => ({ bot: LEVELS[(seed + i) % 4]! }));
  if (kind === 5) return { seed, rules: shiftRules(16 / 9), players: four() };
  if (kind === 6) return { seed, rules: rotateRules(), players: four() };
  if (kind === 7)
    return {
      seed,
      rules: ctfRules(19.5 / 9),
      players: [0, 0, 0, 1, 1, 1].map((team, i) => ({ bot: LEVELS[(seed + i) % 4]!, team })),
    };
  if (kind === 3)
    return {
      seed,
      rules: duelRules(seed),
      players: [{ bot: LEVELS[seed % 4]! }, { bot: LEVELS[(seed + 1) % 4]! }],
    };
  if (kind === 4)
    return {
      seed,
      rules: { mode: 'teams', ...gridForAspect(19.5 / 9) },
      players: [0, 0, 0, 1, 1, 1].map((team, i) => ({ bot: LEVELS[(seed + i) % 4]!, team })),
    };
  const aspect = [16 / 9, 4 / 3, 9 / 19.5][kind]!;
  return { seed, rules: gridForAspect(aspect), players: four() };
}

function playMatch(seed: number) {
  const setup = setupFor(seed);
  const s = createGame(setup);
  while (!s.result && s.tick < MAX_TICKS) {
    step(s, collectInputs(s));
    for (const e of s.events) {
      if (e.type === 'curse') curses.boxes++;
      if (e.type === 'death' && e.cause === 'spider') curses.spiderKills++;
      if (e.type === 'death' && e.cause === 'lightning') curses.strikeKills++;
      if (e.type === 'death' && e.cause === 'crush') curses.crush++;
      if (e.type === 'capture') curses.captures++;
    }
  }
  return { s, setup };
}

const t0 = performance.now();
let errors = 0;
let timeouts = 0;
let totalTicks = 0;
let draws = 0;
let hurry = 0;
const wins: Record<BotLevel, number> = { easy: 0, normal: 0, hard: 0, insane: 0 };
const played: Record<BotLevel, number> = { easy: 0, normal: 0, hard: 0, insane: 0 };
let longest = 0;
const curses = { boxes: 0, spiderKills: 0, strikeKills: 0, crush: 0, captures: 0 };
const perMode = MODES.map(() => ({ n: 0, ticks: 0 }));

for (let seed = 1; seed <= N; seed++) {
  try {
    const { s, setup } = playMatch(seed);
    if (!s.result) {
      timeouts++;
      continue;
    }
    totalTicks += s.tick;
    perMode[seed % MODES.length]!.n++;
    perMode[seed % MODES.length]!.ticks += s.tick;
    longest = Math.max(longest, s.tick);
    if (s.rules.hurryUpTick && s.tick >= s.rules.hurryUpTick) hurry++;
    if (!setup.rules?.mode || setup.rules.mode === 'ffa') {
      for (const p of s.players) played[p.bot as BotLevel]++;
      if (s.result.winner === null) draws++;
      else wins[s.players[s.result.winner]!.bot as BotLevel]++;
    } else if (s.result.team === null) draws++;
  } catch (e) {
    errors++;
    if (errors <= 3) console.error(`seed ${seed}:`, e);
  }
}

let desync = 0;
for (let seed = 1; seed <= 10; seed++)
  if (hashState(playMatch(seed).s) !== hashState(playMatch(seed).s)) desync++;

const done = N - errors - timeouts;
const pct = (a: number, b: number) => (b ? ((100 * a) / b).toFixed(1) : '0') + '%';
console.log(`sim:bench — ${N} meciuri în ${((performance.now() - t0) / 1000).toFixed(1)}s`);
console.log(`  excepții: ${errors} · neterminate în 5 min: ${timeouts} · desync (10 re-rulări): ${desync}`);
console.log(
  `  durată medie: ${(totalTicks / Math.max(1, done) / TICK_HZ).toFixed(1)}s · cel mai lung: ${(longest / TICK_HZ).toFixed(1)}s · au ajuns la hurry up: ${pct(hurry, done)} · egaluri: ${pct(draws, done)}`,
);
console.log(
  '  rată de victorie pe nivel (FFA + 1v1): ' +
    LEVELS.map((l) => `${l} ${pct(wins[l], played[l])}`).join(' · '),
);
console.log(
  '  durată medie pe mod: ' +
    MODES.map(
      (m, i) => `${m} ${(perMode[i]!.ticks / Math.max(1, perMode[i]!.n) / TICK_HZ).toFixed(0)}s`,
    ).join(' · '),
);
console.log(
  `  lăzi blestemate declanșate: ${curses.boxes} · uciși de păianjeni: ${curses.spiderKills} · de fulger: ${curses.strikeKills} · striviți: ${curses.crush} · capturi CTF: ${curses.captures}`,
);
if (errors || timeouts || desync) process.exit(1);
