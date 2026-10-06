# Jurnal de prompturi

Istoricul cererilor făcute agenților LLM în proiect, cele mai noi primele. Regula și formatul sunt în `AGENTS.md`.
Jurnalul începe pe 2026-09-28; fazele 0–2b au fost făcute înainte, iar istoricul lor e în `docs/progress.md` și în git.

## 2026-10-06 — Claude Code (Sonnet 5.5) — Faza 6: completări (server-first, daily, legal)

- **Cerut:** „adaugă și ce lipsește”; răspunsuri: textele legale sau pagini cu lorem ipsum, serverul sursa de adevăr.
- **Făcut:** D-067 (server-first: cumpărături / echipare / recompense offline prin API), provocarea zilei în client, pagini legale placeholder, `DELETE /me`, limitare de rată; vezi `docs/progress.md`.
- **Verificat:** lint, format, typecheck, `pnpm test` (cu Postgres), `pnpm build`; e2e cont / personaje / ui / online / heroes / fatalități cu server cu DB trec; `missions` (3D) pică intermitent și fără modificări.

## 2026-10-06 — Claude Code (Sonnet 5.5) — Faza 6: conturi, trofee, persistență

- **Cerut:** următoarea fază după merge-ul Fazei 5; hosting cu Docker local (decis cu omul: Fly.io mai târziu, Q-003 rămâne deschisă).
- **Făcut:** vezi `docs/progress.md` (Faza 6) și D-063–D-066, Q-011–Q-013. Fără PR încă.
- **Verificat:** lint, typecheck, `pnpm test` (cu `TEST_DATABASE_URL` pe Postgres 16 local), e2e online / personaje / fatalități.
- **Notă operațională:** Docker nu rulează în containerul cloud; compose-ul nu a fost rulat aici. Pe mașina ta: `pnpm db:up`, apoi `cp .env.example .env`.

## 2026-10-06 — Claude Code (Sonnet 5.5) — Faza 5: fatalități și cosmetice

- **Cerut:** începerea Fazei 5 din `PLAN.md`.
- **Făcut:** vezi `docs/progress.md` (Faza 5): content, Match, randare, galerie DEV, teste; D-061.
- **Verificat:** `pnpm lint`, `typecheck`, `test` verzi; Playwright `fatalities.spec.ts` trece; vizualul în arenă neconfirmat.

## 2026-10-06 — Claude Code (Opus 5.5) — Faza 4b: interfața „Comic”

- **Cerut:** „începe Faza 4b” (PLAN.md): interfața după `docs/design/ui.md` și machetele din `reference/ui/`, doar landscape, fără schimbări de gameplay.
- **Făcut:** tokeni + fonturi Bangers/Rubik locale; blocare landscape (iOS, Android, ecran „Rotate your phone”); componentele de bază (`ui/comic.ts`) cu răspuns la apăsare (vizual, sunete de interfață noi, vibrație); toate ecranele existente refăcute (principal, Play, Online, cameră privată, joc rapid, personaje, pagina personajului, magazin, pauză, setări, final, conexiune, rezultate) plus Missions, Practice, Themes; HUD de 44px cu variante și butoanele SUPER / bomba specială / BOOM! / BOMB; arena în cadru; personaje din meniuri care clipesc, privesc și reacționează (expresiile noi `fierce`, `blink`); tranziții (bandă de cerneală, fitil 3-2-1 + BOOM!). Deciziile D-055 – D-060, `docs/progress.md`, `GAME_DESIGN.md` (landscape, bara de 44px), testul nou `e2e/ui.spec.ts` și testele vechi adaptate. Commit-ul de pe `claude/kind-hypatia-8ysa02`.
- **Verificat:** `pnpm lint`, `pnpm typecheck`, `pnpm test`; Playwright pe build-ul final: toate testele trec (29 vechi adaptate + 6 noi în `ui.spec.ts`), fără testul de FPS (container fără GPU); capturile ecranelor în `docs/screens/ui/`, comparate vizual cu machetele la 844×390.
- **Notă operațională:** fitilul de start pune meciul pe pauză 2,1s; testele care pornesc meciuri din meniu și citesc imediat starea trebuie să țină cont (sau să pornească cu `motion: false`, care face tranzițiile instantanee). Checkpoint-ul Q-010 (numele) nu a fost atins: login-ul cu wordmark rămâne pentru Faza 6.

## 2026-10-06 — Claude Code (Opus 5.5) — Ghid de interacțiune: sunet, vibrație, mișcare

- **Cerut:** îndrumări pentru interacțiunea cu interfața: feedback tactil și sunete la apăsare și la schimbarea ecranului, animații de fundal, reacții ale personajelor din meniuri.
- **Făcut:** trei secțiuni noi în `docs/design/ui.md` (tabel acțiune → vizual / sunet / vibrație, reguli de mișcare ambientală, expresii și reacții ale personajelor), macheta interactivă `reference/ui/C-Motion.dc.html`, un task în Faza 4b. Fără schimbări de cod.
- **Verificat:** `pnpm lint`. Demo-ul nu a fost rulat după export.
- **Notă operațională:** duratele de vibrație sunt propuneri, de reglat pe telefon real. Expresia „încruntat” și sunetele de interfață („pop”, „tick”, „stamp”, „nope”) nu există încă în cod.

## 2026-10-06 — Claude Code (Opus 5.5) — Machetele aduse la zi cu Faza 4; doar landscape

- **Cerut:** încă o iterație de design înainte de merge, cu contextul de pe `main`; în plus, jocul să fie doar landscape, fără rotire în portrait.
- **Făcut:** machetele „Comic” refăcute după meniurile reale din `apps/client/src/app.ts` și textele din `packages/content`: meniu principal, Play, Online (nou), cameră privată, joc rapid, personaje (11, cu stări), pagina de personaj (nouă), magazin (nou), setări, pauză, final de meci, HUD (inimi, SUPER, bombă specială, BOOM!). `reference/ui/` recopiat (21 de fișiere), `docs/design/ui.md` actualizat (tabel ecran ↔ funcție din client, HUD, orientare), decizia D-054, task-ul de landscape în Faza 4b. Fără schimbări de cod.
- **Verificat:** `pnpm lint`, `pnpm typecheck`, `pnpm test`. Machetele nu au fost verificate vizual după export.
- **Notă operațională:** login-ul și clasamentul rămân pe canvas ca ecrane de viitor (Faza 6, respectiv neplanificat). `GAME_DESIGN.md` nu a fost modificat, deși mai descrie portrait și bara de 30px.

## 2026-10-06 — Claude Code (Opus 5.5) — Direcția vizuală a interfeței („Comic”)

- **Cerut:** 2–3 iterații de design pentru ecranele jocului (login, setări, personaje etc.), mai „de joc” și mai amuzante; pe parcurs: doar landscape, texte în engleză, ecrane de joc, tranziții cu fitil și explozie, impactul numelui „Fuse Arena”; la final, direcția C aleasă și adusă în proiect.
- **Făcut:** canvas de design cu două direcții („Toy” și „Comic”) pe aceleași ecrane; aleasă „Comic”. În repo: `docs/design/ui.md` (tokeni, componente, ecrane, HUD, tranziții), `reference/ui/` (18 machete + README), o linie în `CLAUDE.md`, Faza 4b în `PLAN.md`, deciziile D-051–D-053, Q-002 închisă, Q-010 (numele) deschisă, mini-plan în `docs/progress.md`. Fără schimbări de cod.
- **Verificat:** `pnpm lint`, `pnpm typecheck`, `pnpm test` (vezi commit-ul). Machetele nu au fost verificate vizual după export.
- **Notă operațională:** `CLAUDE.md` și `PLAN.md` au fost modificate aici; copiile din proiectul claude.ai trebuie actualizate manual ca să rămână identice. Machetele `.dc.html` nu se deschid singure în browser; se văd în canvas (link în `reference/ui/README.md`).

## 2026-10-06 — Claude Code (Opus 5.5) — Faza 4: integrarea ramurii existente

- **Cerut:** „continuă cu Faza 4” după merge-ul PR-ului #5. Exista deja ramura `feat/faza-4-personaje` (altă sesiune, 2026-10-01) cu Faza 4 completă, dar cu alt sistem de personaje; userul a ales integrarea ei, cu semnăturile din `main` și Super-urile din ramură.
- **Făcut:** merge manual (28 de fișiere, 74 de conflicte) pe `feat/faza-4-integrare`; model unic kit + erou, 4 Ultimate-uri noi, `heroes.ts` redus la afinități, UI unificat, deciziile ramurii renumerotate (D-042 – D-047, Q-009) + D-048 – D-050; balans pe 11 personaje.
- **Verificat:** `pnpm lint`, `pnpm typecheck`, `pnpm test` (sim 132, content 34, net 11, server 5), `pnpm balance 6000` (ținte atinse), Playwright 23/24 — testul de FPS a picat din cauza mașinii (baterie 11%, 30 fps și pe o pagină goală), nu a codului.
- **Notă operațională:** de rerulat testul de FPS pe alimentare. PR-urile stivuite se îmbină în ramura-părinte dacă aceasta nu e ștearsă — PR-ul ăsta e direct spre `main`.

## 2026-10-06 — Claude Code (Opus 5.5) — Deblocări treptate, calendar, panou DEV

- **Cerut:** un mod de admin/test în care proprietarul vede tot, în timp ce jucătorul normal primește conținutul puțin câte puțin (nivel, monede), cu previzualizări și conținut nou periodic (teme de eveniment, personaje). Sugestii, apoi implementare; alese variantele recomandate: panou DEV în build-uri interne, nivel + Fitile, personaj lunar + teme de eveniment.
- **Făcut:** `progression.ts` și gating în economie (content), ceas și profiluri de test (client), lacăte/teasere/„NEW” în meniuri, panoul DEV, deciziile D-039 – D-041. Branch `feat/deblocari-dev-panel`, PR peste #3.
- **Verificat:** `pnpm lint`, `pnpm typecheck`, `pnpm test` (sim 96, content 27, net 6, server 4), Playwright 18/18; build-ul public nu conține panoul (niciun chunk, verificat în `dist`), build-ul cu `VITE_DEV_TOOLS=1` îl conține; manual în browser: profil „New player”, data mutată pe 25 octombrie (Halloween, Ghost lansat și în rotație), +1 nivel deschide 1 vs 1.
- **Notă operațională:** build intern: `VITE_DEV_TOOLS=1 pnpm build`. Calendarul se editează în `packages/content/src/progression.ts` (`CHAR_RELEASE`). Prima variantă a steagului (`import.meta.env` citit în alt modul) lăsa chunk-ul panoului în build-ul public; acum e o constantă `define`.

## 2026-09-30 — Claude Code (Opus 5.5) — Personaje, progresie, magazin (implementare)

- **Cerut:** „continuă cu implementarea lucrurilor noi, fă acțiunile recomandate și împinge codul în PR-ul acela” (PR #3).
- **Făcut:** deciziile Q-004 – Q-008 pe variantele recomandate (D-034 – D-038); kitul personajelor și încărcările în sim; 11 personaje, magazin și economie în content; lobby cu personaje; client cu randare, voci, ecranele Personaje/pagina personajului/Magazin, recompense și HUD. Detalii în `docs/progress.md` (Faza 2c).
- **Verificat:** `pnpm lint`, `pnpm typecheck`, `pnpm test` (sim 96, content 18, net 6, server 4), Playwright 17/17 (FPS 60/60/60); manual în browser: grila de personaje, pagina Magicianului, cumpărarea unei pălării, meci FFA cu personaje.
- **Notă operațională:** Playwright a găsit un bug real (Back din pagina personajului ducea la meniul principal) — reparat. Profilul local folosește cheia `fitil-profile` (compatibilă cu prototipul).

## 2026-09-30 — Claude Code (Opus 5.5) — Cerințe noi: personaje, progresie, magazin

- **Cerut:** documentele actualizate în alt chat (`PLAN.md` cu Faza 2c, `GAME_DESIGN.md` cu cele 7 personaje, monede și magazin, prototipul cu ecranele Personaje/Magazin) plus idei noi: magazin cu monede, mai multe personaje cu abilități diferite, XP care le crește abilitățile, rarități Epic/Legendar/Mitic, monede cumpărate cu bani, mai puține bonusuri sau bonusuri care expiră (ex. fotbalistul are piciorul permanent, la ceilalți piciorul expiră după 2 folosiri), „ultimate”, pagină per personaj cu close-up, sunete și plusuri/minusuri. PR separat de Faza 3.
- **Făcut:** copiate `PLAN.md`, `GAME_DESIGN.md` și `reference/prototype.html` din versiunea userului (`CLAUDE.md` din repo a rămas, are regula 10 în plus); propunere în `docs/propuneri/personaje-progresie.md` (rarități, roster cu semnătură/compromis/Ultimate, bonusuri cu încărcări, XP și niveluri cu perk-uri, pagina personajului, economie cu Fitile/Gemuri fără cutii aleatoare, bucle de retenție, impact pe faze); întrebările Q-004 – Q-008. Branch `docs/personaje-progresie`, bazat pe Faza 3.
- **Verificat:** doar documente; `pnpm format:check`.
- **Notă operațională:** ideile cu putere cumpărată contrazic „fără pay-to-win” din `BUSINESS.md` §3 — propunerea recomandă varianta B (sidegrade + putere plafonată) și lasă decizia userului. După decizii, textul aprobat se mută în `GAME_DESIGN.md` / `PLAN.md` (și în proiectul claude.ai). `ROSTER` din `packages/content` are încă „Gogu”, documentele noi îl numesc „Gugu” — de aliniat în Faza 2c.

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
