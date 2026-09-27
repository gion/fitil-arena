# Fitil — context pentru Claude Code

Joc mobil multiplayer cu bombe, pe grilă, stil arenă (inspirație de gen: arena bomber + hero brawler).
Titlu de lucru: **Fitil**. Proprietar: Gion (web dev, TypeScript/Vue/React). Publicare prin SRL-ul propriu.

Documente de citit înainte de orice task:
- `PLAN.md` — fazele, ordinea și criteriile de acceptare. Lucrezi fază cu fază, în ordine.
- `GAME_DESIGN.md` — regulile jocului, modurile, personajele, fatalitățile.
- `BUSINESS.md` — mărci/copyright, monetizare, costuri, ținte de retenție, viralitate. Respectă regulile de acolo (fără nume/asset-uri din alte jocuri, fără cutii plătite aleatoare).
- `reference/prototype.html` — prototipul jucabil actual (single file, canvas 2D + Three.js). Sursa de adevăr pentru „cum se simte” jocul: viteze, timer bombă (2.4s), flacără (0.55s), mănușă, picior, detonator, linie, portaluri, teme, sunete sintetizate, AI boți, controale touch, vederile 3D. Three.js se încarcă de pe cdnjs.

## Stack (nu schimba fără aprobare)
- Monorepo **pnpm workspaces**, TypeScript strict peste tot, Node 22 LTS.
- `packages/sim` — simularea jocului: TypeScript pur, **determinist**, fără DOM, fără `Math.random()` direct (RNG cu seed), fără `Date.now()`. Tick fix 20 Hz. Rulează identic pe server și client.
- `packages/content` — date: personaje, skin-uri, fatalități, teme, moduri (JSON/TS tipat, validat cu zod).
- `apps/client` — **Phaser 3** + Vite. Împachetat pentru mobil cu **Capacitor** (iOS + Android).
- Vederile 3D (1P/3P) — **Three.js**, ca renderer separat peste aceeași stare de joc ca renderer-ul 2D (Phaser).
- `apps/server` — **Colyseus** (rooms, matchmaking, server autoritar) + **Fastify** pentru API (conturi, inventar, progres).
- DB: **Postgres** (Drizzle ORM). Cache/presence: Redis doar când e nevoie (faza modului infinit).
- Teste: **Vitest** (sim + server), **Playwright** (smoke client în browser).
- Lint/format: ESLint + Prettier. CI: GitHub Actions.

## Comenzi (menține-le funcționale)
- `pnpm i` · `pnpm dev` (client + server local) · `pnpm test` · `pnpm lint` · `pnpm typecheck` · `pnpm build`
- `pnpm sim:bench` — rulează 1000 meciuri bot-vs-bot headless, raportează erori/desync/durată.

## Reguli de lucru autonom
1. Înainte de fiecare fază: citește secțiunea din `PLAN.md`, scrie un mini-plan în `docs/progress.md`, apoi implementează.
2. După fiecare milestone: `pnpm lint && pnpm typecheck && pnpm test` trebuie să treacă. Apoi commit mic, mesaj clar (Conventional Commits).
3. Actualizează `docs/progress.md`: ce s-a făcut, ce a rămas, decizii luate, probleme cunoscute.
4. Logica de joc stă **doar** în `packages/sim`. Clientul doar randează + trimite input. Serverul doar rulează sim-ul și sincronizează.
5. Orice regulă nouă de gameplay primește test în `packages/sim` (scenariu determinist cu seed).
6. Nu adăuga dependențe grele fără motiv scris în `docs/decisions.md`.
7. Fără asset-uri, nume sau personaje din alte jocuri (Bomberman, Brawl Stars, Mario, Pokémon, Minecraft, Among Us etc.). Doar asset-uri proprii, generate procedural sau CC0 (sursa notată în `assets/CREDITS.md`).
8. Conținut cartoon, fără sânge/gore (rating de vârstă mic). Fatalitățile sunt comice.
9. Secrete doar în `.env` (niciodată în git). `.env.example` ține la zi.

## Oprește-te și întreabă (checkpoint uman) când:
- ceva costă bani (servicii plătite, conturi de store, domenii, hosting de producție);
- e o decizie de direcție artistică finală, nume final, logo;
- implementezi plăți reale, politici de confidențialitate, texte legale;
- ai de publicat ceva (store, producție);
- o cerință din plan pare contradictorie sau imposibilă.
Lasă întrebarea în `docs/questions.md` și continuă cu ce nu depinde de ea.
