# Handover — 2026-09-30

Pentru sesiunea următoare (Claude Code în terminal). Sesiunea anterioară a rulat în extensia VS Code și nu se poate relua cu `claude --resume`, așa că tot ce trebuie știut e aici.

## Cum pornești

1. Citește `CLAUDE.md`, `AGENTS.md` și documentele indicate acolo (`PLAN.md`, `GAME_DESIGN.md`, `BUSINESS.md`).
2. Citește `docs/progress.md` (ce s-a făcut pe faze), `docs/decisions.md` (D-001 – D-029), `docs/questions.md` și `docs/prompt-log.md`.
3. Verifică că totul e verde: `pnpm i && pnpm lint && pnpm typecheck && pnpm test`.
4. **Regulă nouă:** fiecare interacțiune care schimbă ceva se încheie cu o intrare în `docs/prompt-log.md` (format în `AGENTS.md`).

## Starea proiectului

- **Gata:** Faza 0 (repo, CI, shell Capacitor), Faza 1 (sim determinist), Faza 2 (client jucabil offline: 7 moduri, Practice, vederi 3D, 10 teme), Faza 2b (Misiuni în lume infinită, 8 misiuni în 2 capitole).
- **Limba jocului: engleză** (D-028), fără sistem de traduceri. Documentele și comentariile din cod rămân în română.
- **Voce:** 10 replici temporare generate cu Chatterbox în `apps/client/public/voice/`, încărcate prin `DEFAULT_VOICE` din `apps/client/src/audio/voice.ts`; restul replicilor și țipetele sunt sintetizate. Userul a renunțat deocamdată la înregistrări proprii. Uneltele de generare sunt în `tools/voice/` (Python, venv-uri ignorate de git; vezi D-029).
- **Teste:** sim 81, content 6, server 1, Playwright 14 (+10 capturi de ecran, rulate doar cu `SCREENS=1`).
- **Git:** munca din fazele 2, 2b și sesiunea audio e pe branch-ul `handover/faza-2-audio`, cu PR spre `main`. După merge: `git checkout main && git pull`.

## Pasul următor: Faza 3 — Multiplayer online (camere private)

Detaliile și criteriile de acceptare sunt în `PLAN.md`. Userul a primit rezumatul și a fost de acord să continuăm cu ea. Ordinea propusă:

1. Mini-plan în `docs/progress.md` (regula 1 din `CLAUDE.md`).
2. Colyseus în `apps/server` (acum e doar Fastify cu `/health`): o cameră care rulează `packages/sim` autoritar la 20 Hz; clienții trimit doar input cu număr de secvență. Colyseus e deja în stack (`CLAUDE.md`), dar notează versiunea și motivul în `docs/decisions.md`.
3. Camere private cu cod de 4 litere; gazda alege tema și regulile; sloturile goale = boți.
4. Client online: predicție pentru jucătorul local + reconciliere, interpolare pentru ceilalți. Slow-motion-ul și zoom-ul cinematic rămân pur vizuale online (D-017).
5. Reconectare în 15s.
6. Simulator de latență în dev (100–200 ms, jitter, 2% pierdere).
7. Test automat: 4 clienți headless, meci complet, hash-urile de stare coincid la final.
8. **Checkpoint uman** la final: hostingul serverului — propune 2 variante (Fly.io / Railway / Hetzner) cu costuri estimate, în `docs/questions.md`.

## Capcane și lucruri de știut

- **Calea proiectului:** lucrează din `/private/var/www/fitil-arena` (pe macOS `/var` e un link spre `/private/var`; sesiunile și memoria Claude sunt legate de calea cu `/private`).
- **Determinism:** logica de joc stă doar în `packages/sim` — fără `Math.random`, `Date.now`, DOM (ESLint le blochează). Tot aleatoriul vine din `deriveRng` (D-009). Tufișurile (Faza 4) vor cere filtrare pe server a pozițiilor ascunse — ține cont de asta când proiectezi sincronizarea stării.
- **Texte:** cheile din `DEFAULT_VOICE` trebuie să fie identice cu textele din `@fitil/content`, inclusiv apostroful tipografic `’` („I’m lightning!”).
- **Playwright** rulează cu un singur worker și `channel: 'chromium'` (D-022); o rulare completă durează ~3 minute. Nu rulează încă în CI (trebuie instalat browserul în workflow).
- **Hugging Face:** pe conexiune lentă descărcările pică cu „CAS Client Error”; merg cu `HF_HUB_DISABLE_XET=1`.

## Rămase din fazele anterioare (nu blochează Faza 3)

- Boții nu folosesc încă mănușa, detonatorul și linia.
- Playwright în CI.
- `GAME_DESIGN.md` citează replicile în română.
- Întrebările Q-001 (appId final) și Q-002 (font de titluri) din `docs/questions.md` — țin de numele și direcția artistică finală.
- Păianjenii omoară mult (~0.8 morți/meci) — balans în Faza 4.
