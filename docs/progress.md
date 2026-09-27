# Progres

## Faza 0 — Fundația repo-ului (+ shell mobil adus înainte)

**Mini-plan:** monorepo pnpm cu `packages/sim`, `packages/content`, `apps/client`, `apps/server`; TS strict, ESLint (reguli de determinism pe sim), Prettier, Vitest, Playwright, CI. În plus față de plan: Capacitor configurat din start în `apps/client`, ca să rulăm pe telefon încă din Faza 2 (decizie D-001).

**Făcut:**

- Structura monorepo + scripturile din `CLAUDE.md` (`dev`, `build`, `test`, `lint`, `typecheck`, `sim:bench`, plus `mobile:sync`).
- `packages/sim`: RNG mulberry32 cu stare serializabilă, hash de stare, constante din prototip; teste.
- `packages/content`: schemă zod pentru teme; test.
- `apps/server`: Fastify cu `/health`; test cu `inject`. Colyseus intră în Faza 3.
- `apps/client`: Vite + Phaser 3 + Capacitor 8 (iOS + Android), scenă de verificare cu haptic nativ; smoke test Playwright.
- CI GitHub Actions: lint, format, typecheck, test, build.

**Rămas / cunoscut:**

- `reference/prototype.html` trebuie copiat din proiect în repo.
- Build-urile native (Xcode / Android Studio) se rulează pe Mac; vezi README.
- Smoke-ul Playwright (`pnpm test:e2e`) a trecut pe build (Pixel 7 emulat, 0 erori în consolă); nu rulează încă în CI (trebuie instalat browserul în workflow).

## Faza 1 — Simularea deterministă (`packages/sim`)

**Mini-plan:** stare serializabilă (JSON simplu), `step(state, inputs)` la 20 Hz, poziții și timere întregi (unități de 1/1000 pătrățel, tick-uri) ca să nu existe diferențe de float între platforme; RNG mulberry32 în stare; boți ca funcție pură `botInput(state, id)`.

**Făcut:**

- Model: `GameState`, `Player`, `Bomb`, evenimente (`bombPlaced`, `explode`, `death{killerId,cause}`, `pickup`, `kick`, `lift`, `throw`, `land`, `teleport`, `portalOpen/Close`, `boxSpawn`, `hurryUp`, `blockFall`, `roundEnd`...).
- Reguli portate din prototip: mișcare tile-to-tile cu întoarcere din mers, bombe (2.4s), flacără în cruce (0.55s) oprită de stâlpi/lăzi, lanțuri (1 tick între verigi), lăzi cu drop-uri (tabelul din prototip, 17% negative), lăzi aurii → bonus maxim garantat, lăzi care reapar sub 35%, picior, mănușă (ridicare, dublu tap, aruncare peste ziduri cu wrap), detonator (15s siguranță), linie, scut (se consumă o dată + 0.8s invulnerabilitate), bonusuri negative (încetinit, rază/bombă −1, inversat, amețit, sughiț), portaluri după lanț de 4 (15s, jucători + bombe), moarte, sfârșit de rundă (FFA / echipe), foc prieten oprit în echipe (inclusiv propriile bombe).
- **Hurry up** (nou față de prototip): de la 90s cade un bloc la 0.3s, în spirală din colț spre centru; omoară, distruge bombele/bonusurile de sub el.
- Preseturi: `gridForAspect(aspect)` (regula de grilă adaptivă), `duelRules(seed)` (1 vs 1: 11×11, 3 bonusuri de start identice, aurii 7%).
- Boți pe 4 niveluri (`easy`, `normal`, `hard`, `insane`): fugă din pericol, bombe lângă lăzi/adversari doar cu drum de scăpare, bonusuri, vânătoare la nivelurile grele. `normal`+ folosesc o hartă de pericol cu timp (fitile + lanțuri) → mult mai puține sinucideri.
- Teste: 25 (scenarii pentru fiecare regulă + determinism 2000 tick-uri + serializare JSON).
- `pnpm sim:bench`: 1000 meciuri în ~23s — 0 excepții, 0 neterminate în 5 min, 0 desync; durată medie 89s, max 138s; victorii FFA/1v1: easy 12% · normal 33% · hard 31% · insane 32%.
- Client: scenă de verificare cu meci live între 4 boți (formă simplă, interpolare 60 fps, sim pe timp real). **Randare crisp**: canvas la rezoluția fizică (CSS × devicePixelRatio, plafonat la 3), coordonate în pixeli fizici.

**Rămas / cunoscut:**

- Boții încă se sinucid destul de des (~25% din morți) — mai ales prinși de bombele altora; balansul intră în Faza 4.
- Boții nu folosesc mănușa/detonatorul/linia (doar piciorul, implicit).
- Lăzile blestemate, modurile speciale (CTF, rotativă, rânduri mobile) și „bye bye”/momentele de glorie sunt în Faza 2 (tot în `packages/sim`).
- `reference/prototype.html` încă lipsește din repo.
