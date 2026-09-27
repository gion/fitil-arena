# Decizii

- **D-001 (2026-09-27)** Capacitor configurat din Faza 0, nu din Faza 8, la cererea lui Gion: vrea să testeze pe iOS/Android pe parcurs. Restul Fazei 8 (iconițe, deep links, analytics etc.) rămâne acolo.
- **D-002** Phaser rămâne pe 3.x (`~3.90`), cum cere stack-ul, deși Phaser 4 e disponibil.
- **D-003** TypeScript `~6.0`: typescript-eslint suportă `<6.1`; TS 7 (port Go) încă nu e compatibil.
- **D-004** pnpm 10 (fixat în `packageManager`).
- **D-005** Pachetele interne se exportă ca sursă TS (`exports: ./src/index.ts`); Vite le compilează în client, `tsup` le include în bundle-ul serverului.
- **D-006** `zod` 4 în `packages/content`, `tsx` + `tsup` în server/sim (dev tools, fără impact la runtime în client).
- **D-007** Simularea folosește doar întregi: poziții în 1/1000 pătrățel, viteze în unități/tick, timere în tick-uri. Evită diferențe de rotunjire float între iOS/Android/server. Fără funcții trigonometrice în sim.
- **D-008** `step` modifică starea pe loc (performanță; bench-ul face ~4.5M tick-uri). Copie cu `structuredClone`/JSON când e nevoie.
- **D-009** Aleatoriul boților vine din `deriveRng(seed, tick, id)`, deci `botInput` e pur și dă același rezultat pe server și client.
- **D-010** Hurry up: blocuri în spirală de la 90s, câte unul la 0.3s — garantează că orice meci se termină în < 3.5 min.
- **D-011** Clientul avansează simularea după `rawDelta` (timp real), nu după delta netezit de Phaser.
- **D-012** Randare la rezoluția fizică: `Scale.NONE` cu `zoom = 1/DPR`; toate dimensiunile din scene se înmulțesc cu `DPR`.
