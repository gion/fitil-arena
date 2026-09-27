// Placeholder până la Faza 1: va rula 1000 de meciuri bot-vs-bot și va raporta erori/desync/durată.
import { createRng, nextFloat, hashState } from '../src/index.ts';

const t0 = performance.now();
const r = createRng(1);
for (let i = 0; i < 1_000_000; i++) nextFloat(r);
console.log(
  `sim:bench (placeholder) ok — stare ${hashState(r)} în ${(performance.now() - t0).toFixed(1)} ms`,
);
