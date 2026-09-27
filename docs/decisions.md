# Decizii

- **D-001 (2026-09-27)** Capacitor configurat din Faza 0, nu din Faza 8, la cererea lui Gion: vrea să testeze pe iOS/Android pe parcurs. Restul Fazei 8 (iconițe, deep links, analytics etc.) rămâne acolo.
- **D-002** Phaser rămâne pe 3.x (`~3.90`), cum cere stack-ul, deși Phaser 4 e disponibil.
- **D-003** TypeScript `~6.0`: typescript-eslint suportă `<6.1`; TS 7 (port Go) încă nu e compatibil.
- **D-004** pnpm 10 (fixat în `packageManager`).
- **D-005** Pachetele interne se exportă ca sursă TS (`exports: ./src/index.ts`); Vite le compilează în client, `tsup` le include în bundle-ul serverului.
- **D-006** `zod` 4 în `packages/content`, `tsx` + `tsup` în server/sim (dev tools, fără impact la runtime în client).
