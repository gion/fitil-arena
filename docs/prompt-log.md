# Jurnal de prompturi

Istoricul cererilor făcute agenților LLM în proiect, cele mai noi primele. Regula și formatul sunt în `AGENTS.md`.
Jurnalul începe pe 2026-09-28; fazele 0–2b au fost făcute înainte, iar istoricul lor e în `docs/progress.md` și în git.

## 2026-10-01 — Claude Code (Opus 5.5) — Faza 4: personaje, Super, moduri

- **Cerut:** după demo-ul pe Pages, Faza 4 din PLAN.
- **Făcut:** sim (personaje, Super-uri, pasive, inimi, bombe speciale, Blestem, tufișuri, evenimente de arenă, Coroana, Cartoful, boți), content (personaje, afinități, evenimente, `matchRules`), bench de balans (`pnpm balance`, `docs/balance.md`), net/server (personaj per loc, extras, joc rapid public pe mod), client (selecție, Super, bombe speciale, HUD, randare 2D/3D). Decizii D-035–D-039, întrebarea Q-004 (tufișuri online). Branch `feat/faza-4-personaje` (include și branch-ul de Pages).
- **Verificat:** `pnpm lint`, `typecheck`, `format:check`, `test` (sim 111, content 13, net 11, server 5); `pnpm sim:bench` 1000 meciuri, 0 excepții/neterminate/desync; `pnpm balance 3500`: ținte atinse; Playwright: testele existente (fără FPS) + 6 noi, trecute.
- **Notă operațională:** în containerul cloud, Playwright are nevoie de `PW_CHROMIUM=/opt/pw-browsers/chromium` (Chromium-ul instalat nu e versiunea cerută de `@playwright/test`); testul de FPS cere GPU.

## 2026-10-01 — Claude Code (Opus 5.5) — Demo jucabil pe GitHub Pages

- **Cerut:** un demo jucabil online (HTML); dacă merge pe GitHub Pages sau e nevoie de Vercel. Apoi Faza 4.
- **Făcut:** `.github/workflows/pages.yml` (build client cu `VITE_OFFLINE_ONLY=1` → deploy Pages la push pe `main`); în `apps/client/src/app.ts` meniul Online și reluarea camerei sunt ascunse în build-ul demo; `.env.example` și D-034.
- **Verificat:** `pnpm lint`, `format:check`, `typecheck`, `test` (sim 81, content 6, net 6, server 4). Build-ul demo servit sub `/fitil-arena/`: meniul pornește fără butonul Online, un meci cu boți rulează, 0 erori în consolă.
- **Notă operațională:** Pages se activează o dată manual: Settings → Pages → Source: „GitHub Actions”. Pe repo privat, Pages cere GitHub Pro.

## 2026-09-30 — Claude Code (Opus 5.5) — Faza 3: multiplayer online (camere private)

- **Cerut:** începerea Fazei 3 după handover (după repararea Prettier pe PR-ul fazei 2).
- **Făcut:** `packages/net` (protocol, `ArenaHost`, `NetClient`, `lagLink`), `ArenaRoom` Colyseus 0.18 în `apps/server`, client online (meniu, lobby, predicție, reconectare, revenire după reîncărcare), decizii D-030 – D-033, Q-003 (hosting), `.claude/launch.json` pentru preview. Branch `feat/faza-3-multiplayer`.
- **Verificat:** `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test` (sim 81, content 6, net 6, server 4), Playwright 15/15 (online + smoke + misiuni; FPS 60/60/60 cu CPU 4x); manual în browser cu 150 ms latență simulată (meci complet, revanșă, reîncărcare).
- **Notă operațională:** serverul de joc ascultă pe 2567; pe mașina de dezvoltare portul 3000 era ocupat de alt proces, deci preview-ul pornește API-ul pe 3001 (`API_PORT`). Playwright pornește singur serverul de joc (`pnpm --filter @fitil/server serve`). Hostingul așteaptă decizia (Q-003).

## 2026-09-30 — Claude Code (Opus 5.5) — Prettier reparat pe PR-ul fazei 2

- **Cerut:** repararea verificării de formatare înainte de merge-ul PR-ului `handover/faza-2-audio`, apoi începerea Fazei 3.
- **Făcut:** CI pica la `pnpm format:check` pe `apps/client/src/app.ts` și `packages/content/src/texts.ts`; rulat `prettier --write` pe cele două fișiere (doar formatare, fără schimbări de logică).
- **Verificat:** `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test` (sim 81, content 6, server 1), `pnpm build` — toate trec local.
- **Notă operațională:** rulează `pnpm format:check` (sau `pnpm format`) înainte de push; CI-ul îl verifică, dar nu face parte din `lint`.

## 2026-09-30 — Claude Code (Opus 5.5) — Handover, jurnal de prompturi, PR

- **Cerut:** sesiunea din extensia VS Code nu apărea în `claude --resume` din terminal; userul a cerut un fișier de handover, commit și PR, ca să continue în Claude Code. În plus, o regulă nouă: orice interacțiune cu un LLM se încheie cu o intrare într-un jurnal de prompturi, ca un changelog.
- **Făcut:** `docs/handover.md` (starea proiectului, capcane, pașii următori — Faza 3); `AGENTS.md` nou, cu regula jurnalului și formatul; regula 10 în `CLAUDE.md`; acest jurnal, completat retroactiv pentru sesiunea 2026-09-28 – 30; secțiune nouă în `docs/progress.md`. Commit-urile locale (fazele 2, 2b și sesiunea audio) au fost puse pe un branch separat, cu PR spre `main`.
- **Verificat:** `pnpm lint`, `pnpm typecheck`, `pnpm test`.
- **Notă operațională:** după merge, `git pull` pe `main` în directorul local.

## 2026-09-29 — Claude Code (Opus 5.5) — Pachet de voce temporar în joc

- **Cerut:** modelele noi (Turbo, Orpheus, Dia) au dezamăgit; userul a cerut folosirea replicilor din prima iterație Chatterbox până la înregistrări proprii, apoi actualizarea configurației ESLint.
- **Făcut:** 10 MP3-uri mono în `apps/client/public/voice/` (liniște tăiată, volum egalizat la −16 LUFS); `DEFAULT_VOICE` în `apps/client/src/audio/voice.ts`, cu variante multiple per replică (două „Bye bye”); `FileVoice` se încarcă la primul meci (după `AudioContext`), cu fallback pe sinteză; replica „Hurry up!” se aude acum și ca voce. ESLint ignoră `**/.venv/**` și `tools/voice/out/**`. Sursa e notată în `assets/CREDITS.md`. Commit `09d4937`.
- **Verificat:** `pnpm lint`, `pnpm typecheck`, `pnpm test` (sim 81, content 6, server 1), Playwright 14 trecute. Redarea efectivă în joc nu a fost ascultată manual.
- **Notă operațională:** înregistrările proprii se pun cu aceleași nume de fișier în `apps/client/public/voice/`; replicile noi primesc un rând în `DEFAULT_VOICE` (cheia = textul exact din `@fitil/content`, inclusiv apostroful tipografic ’).

## 2026-09-29 — Claude Code (Opus 5.5) — Comparație modele de voce locale

- **Cerut:** modele mai jucăușe/exagerate decât Chatterbox; după ce userul a eliberat spațiu, testarea celorlalte unelte locale.
- **Făcut:** variante Chatterbox cu exagerare maximă și pitch-shift (ffmpeg rubberband); `tools/voice/lines.py` (set comun de replici cu etichete neutre `{laugh}` etc.), `try_turbo.py` (Chatterbox Turbo), `orpheus/try_orpheus.py` (Orpheus 3B, copia unsloth) și `orpheus/try_dia.py` (Dia 1.6B prin transformers), cu venv separat în `tools/voice/orpheus/.venv`. Commit-uri `b1920a1`, `2d3dcd3`.
- **Verificat:** Turbo și Orpheus: durate normale (1–4s). Dia: ~11.7s la aproape toate replicile (lungimea maximă) — nepotrivit pentru replici scurte, și lent (~45s/replică).
- **Notă operațională:** descărcările de pe Hugging Face picau cu „CAS Client Error” pe conexiune lentă; merg cu `HF_HUB_DISABLE_XET=1`. Userul a ales Chatterbox original.

## 2026-09-28 — Claude Code (Opus 5.5) — Chatterbox instalat local

- **Cerut:** un TTS gratuit pentru trial; apoi instalarea locală a lui Chatterbox pentru test.
- **Făcut:** `uv` prin Homebrew; venv Python 3.11 în `tools/voice/.venv` cu `chatterbox-tts` 0.1.7 (+ `setuptools<81`); `tools/voice/try_lines.py` generează 10 replici în `tools/voice/out/` (ignorat de git). Decizia D-029. Commit `0773a0c`.
- **Verificat:** generare pe MPS, 2–6s per replică, fișiere de 0.5–2s.
- **Notă operațională:** fără `setuptools<81`, watermarker-ul Perth e `None` (lipsește `pkg_resources`) și modelul pică la încărcare.

## 2026-09-28 — Claude Code (Opus 5.5) — Tot jocul trece pe engleză

- **Cerut:** schimbarea tuturor textelor și a audio-ului pe engleză; varianta aleasă: „doar engleză”, fără sistem de traduceri.
- **Făcut:** traduse textele din `packages/content` (moduri, bonusuri, replici, mesaje de moarte, echipe „Blue”/„Red”, „You”, provocări, tutorial, teme, misiuni, capitole) și din client (meniuri, HUD, anunțuri, ecrane de final); `speechSynthesis` pe `en-US`; `<html lang="en">`. Id-urile au rămas neschimbate. Decizia D-028. Commit `3cf111c`.
- **Verificat:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, Playwright 14 trecute.
- **Notă operațională:** `GAME_DESIGN.md` încă citează replicile în română.

## 2026-09-28 — Claude Code (Opus 5.5) — Surse audio și listă de replici pentru TTS

- **Cerut:** audio-ul sintetizat e slab; de unde se pot genera voci („bye bye”, țipete) de calitate de producție; apoi lista textelor de generat prin TTS.
- **Făcut:** recomandări (actori de voce, ElevenLabs, SFX din Sonniss/Kenney/Freesound CC0) și lista de replici per personaj, crainic și fatalități, construită din `packages/content/src/texts.ts` și `GAME_DESIGN.md`. Fără schimbări de cod.
- **Verificat:** —
