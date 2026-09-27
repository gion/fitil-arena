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
