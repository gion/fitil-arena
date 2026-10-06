# Fitil — Plan de implementare (pentru execuție autonomă)

Fiecare fază are: **scop**, **task-uri**, **criterii de acceptare** (verificabile de agent), **checkpoint uman** dacă e cazul.
Nu trece la faza următoare până nu trec criteriile. Progresul se ține în `docs/progress.md`.

---

## Faza 0 — Fundația repo-ului
**Scop:** monorepo gol dar complet funcțional.
- pnpm workspaces: `packages/sim`, `packages/content`, `apps/client`, `apps/server`.
- TS strict, ESLint, Prettier, Vitest, Playwright, scripturile din `CLAUDE.md`.
- GitHub Actions: lint + typecheck + test la fiecare push.
- `docs/progress.md`, `docs/decisions.md`, `docs/questions.md`, `assets/CREDITS.md`, `.env.example`.

**Acceptare:** `pnpm i && pnpm lint && pnpm typecheck && pnpm test && pnpm build` trec pe repo curat.

---

## Faza 1 — Simularea deterministă (`packages/sim`)
**Scop:** tot gameplay-ul din `reference/prototype.html`, portat ca bibliotecă pură.
- Model: `GameState` serializabil, `step(state, inputs[], dt=50ms) → state`, RNG cu seed (mulberry32 sau similar).
- Mișcare pe grilă tile-to-tile, bombe, flăcări, lanțuri, lăzi, drop-uri, bonusuri, picior, mănușă (ridicare/aruncare cu wrap), portaluri, moarte, sfârșit de rundă, „hurry up”.
- AI boți (portat din prototip) ca funcție `botInput(state, playerId) → Input`, cu 4 niveluri de dificultate.
- Evenimente emise pentru client (bombă pusă, explozie, moarte cu `killerId`, pickup) — clientul le folosește pentru sunete/animații.
- `pnpm sim:bench`: 1000 meciuri bot-vs-bot.

**Acceptare:**
- Teste de scenariu pentru fiecare regulă (lanț, șut oprit de perete, aruncare cu wrap, portal cu bombă, bombă ținută nu explodează, moarte pe flacără).
- Test de determinism: același seed + aceleași input-uri → hash de stare identic după 2000 de tick-uri.
- Bench: 0 excepții, fiecare meci se termină în < 5 min simulat.

---

## Faza 2 — Client jucabil offline + Practice
**Scop:** jocul din prototip, rescris curat în Phaser, jucabil pe telefon, fără server.
- Randare procedurală (ca în prototip) pentru cele 6 teme; arhitectură de „theme pack” ușor de înlocuit cu sprite-uri reale mai târziu.
- Grilă adaptivă la proporția ecranului, rază de start 1, lăzi care reapar, halo pe jucătorul propriu, tremurat de ecran + haptic după distanța exploziei (vezi `GAME_DESIGN.md`).
- Layout conform secțiunii „Interfață & controale”: hartă pe tot ecranul, bară de 30px sus, meniu-pauză lateral, joystick care apare sub deget, tap în dreapta = bombă, indicații care dispar. Portrait + landscape, safe-area.
- Bonusurile Mănușă (tap/dublu tap, aruncare peste ziduri cu wrap), Detonator (buton BUM!) și Linie (dublu tap), cu teste de sim pentru fiecare.
- Moduri offline cu boți: Arena rotativă (rotație progresivă cu inversare de sens, controale relative la ecran), Rânduri mobile (alunecare anunțată, împingere/strivire), Capturează steagul 3v3 (furt, scăpare, returnare, revenire în joc după 3s, 3 capturi / 3 minute, roluri de boți atac/apărare), Clasic (FFA 4), **1 vs 1** (arenă 11×11, bonusuri de start identice aleatoare), **Echipe 2v2/3v3** (culori de echipă, foc prieten oprit, spawn pe laturi opuse). Selector de mod în start și în pauză.
- Portaluri doar după un lanț de 4+ bombe (15s), bonusuri negative semnalizate (6 tipuri, inclusiv Amețit cu harta ondulată), bonusul Scut (10s, expiră), lăzi aurii cu bonus maxim garantat, lăzi blestemate (păianjeni care vânează jucători, blocați de bombe și uciși de explozii; nori de furtună care plutesc și fulgeră în zone anunțate) — conform `GAME_DESIGN.md`. Teste de sim: numărarea lanțurilor, foc prieten oprit, efectele cu durată (inversare, sughiț, scut consumat la o explozie), detecția „fără scăpare” (momentul „bye bye” cu slow-motion și zoom), momentele de glorie (zoom + animație + replică la viteză/bombe/rază maximă și la victorie), foc prieten complet în echipe (inclusiv propriile bombe), bombe colorate pe echipă, drop garantat din lada aurie.
- **Vederi 3D comutabile (2D · 1P · 3P)** cu Three.js peste aceeași simulare: minimapă 2D, controale relative la cameră cu asistență, buton de bombă, mâna cu bomba în 1P, texturi per temă, umbre, bombe și flăcări realiste, lumini de explozie; setare de calitate (umbre/rezoluție). Randarea 3D e un „renderer” separat care citește aceeași stare ca cel 2D.
- Audio: sunete sintetizate și muzică per temă (portat), sistem de „voice pack” care acceptă și fișiere audio.
- Meniu principal: Joacă (Practice), Teme, Setări (sunet/muzică/vibrații).
- **Practice mode**: boți pe 4 niveluri, tutorial interactiv în 6 pași, manechine, 5 provocări.
- Interpolare vizuală între tick-uri (sim la 20 Hz, randare la 60 fps).

**Acceptare:** Playwright smoke: pornește, intră în Practice, rulează 30s fără erori în consolă, în toate cele 3 vederi (touch simulat prin CDP: joystick + tap). FPS ≥ 55 în 2D și ≥ 45 în 3D cu CPU throttling 4x (raportat în progress). Captură de ecran per temă × vedere salvată în `docs/screens/`.

---

## Faza 2b — Misiuni (singleplayer)
- Modul Misiuni din prototip: bară de viață cu daune și invulnerabilitate, inimi, săgeată de obiectiv (2D + 3D), păianjeni rătăcitori, stele salvate, ecran de rezultat.
- Misiunile: Colecționar, Demolare (turnuri blindate), Salvare (prieteni care te urmează, leșin), Cursă (60s). Definite data-driven în `packages/content` (tip, număr de ținte, distanțe, limite de timp, criterii de stele) ca să se adauge ușor altele.
- Hartă de capitole (deblocare progresivă), sincronizarea stelelor cu contul în Faza 6.

**Acceptare:** teste de sim pentru fiecare tip de misiune (ținte generate determinist din seed, condiții de victorie/înfrângere, calculul stelelor, ținte păstrate la regenerarea lumii); Playwright: fiecare misiune pornește și se poate termina forțat fără erori.

---

## Faza 2c — Personaje, monede, magazin
- Cele 7 personaje din prototip data-driven în `packages/content` (statistici, pasiv, mers, voce, replici, preț), cu teste de sim pentru fiecare pasiv (a doua viață, magnet, imunitate, bomba mare, limită de bombe).
- Economie locală: monede pe evenimente, bonus zilnic, inventar, echipare; migrare pe cont în Faza 6 (serverul devine sursa de adevăr pentru monede).
- Randare cosmetice în 2D și 3D; ecrane Personaje și Magazin cu previzualizări.

**Acceptare:** test că fiecare personaj pornește cu statisticile corecte; test de economie (cumpărare fără fonduri refuzată, echipare/scoatere, persistență); Playwright: cumpără și echipează un obiect din fiecare categorie fără erori.

---

## Faza 3 — Multiplayer online (camere private)
**Scop:** 2–4 jucători online, în aceeași cameră, cu cod.
- Colyseus room care rulează `packages/sim` autoritar la 20 Hz; clienții trimit doar input cu număr de secvență.
- Client: predicție pentru jucătorul local + reconciliere; interpolare pentru ceilalți.
- Camere private cu cod de 4 litere, gazda alege tema și regulile, sloturi goale = boți.
- Reconectare în 15s după pierderea conexiunii.
- Simulator de latență în dev (100–200 ms, jitter, pierdere 2%).

**Acceptare:** test automat cu 4 clienți headless conectați la serverul local, meci complet fără desync (hash-urile coincid la final). Joc fluid manual la 150 ms latență simulată.

**Checkpoint uman:** alegerea hostingului pentru server (Fly.io / Railway / Hetzner) — propune 2 variante cu costuri estimate.

---

## Faza 4 — Personaje, Super, moduri
- Sistem de personaje data-driven (`packages/content`), abilități pasive + Super cu bară de încărcare.
- Implementează cele 7 personaje din `GAME_DESIGN.md`.
- Moduri: Coroana, Cartoful fierbinte (Echipe 2v2/3v3 și 1 vs 1 există din Faza 2; aici se adaugă matchmaking pentru ele).
- Ecran de selecție personaj.
- Afinități de arenă (bonusuri/penalizări per personaj × temă), sistem de inimi (implicit 1), evenimente de arenă aleatoare din seed, afișate la start. Toate data-driven în `packages/content`.
- Tufișuri (invizibilitate, arse de flacără) cu filtrare pe server: poziția ascunsă nu ajunge la clienții care n-au voie s-o vadă.
- Bombe speciale cu încărcături (gheață, flashbang, otravă) și bonusurile Inimă și Blestem, conform `GAME_DESIGN.md`. UI: iconița bombei următoare pe buton, glisare pentru schimbare.

**Acceptare:** fiecare abilitate și fiecare tip de modificator are test de sim; bench cu personaje și arene aleatoare: rată de victorie per personaj între 18% și 32% în FFA de 4, și pe fiecare arenă în parte între 15% și 35% (raport de balans în `docs/balance.md`).

---

## Faza 4b — Interfața „Comic”
**Scop:** meniurile, HUD-ul și tranzițiile arată ca în `docs/design/ui.md` și `reference/ui/`, doar landscape. Fără schimbări de gameplay.
- Tokeni CSS și fonturile Bangers + Rubik împachetate local (notate în `assets/CREDITS.md`).
- **Doar landscape** (D-054): orientarea blocată în iOS și Android, ecran „Rotate your phone” în browser pe telefon în portrait, scoasă adaptarea de portrait din client.
- Componentele de bază din specificație (butoane, panou, casete, balon, ștampilă ON/OFF, selector segmentat, titlu de pagină).
- Ecranele existente refăcute pe rând: meniul principal, Play, Online, camera privată și jocul rapid, personajele și pagina de personaj, magazinul, pauza, setările, finalul de meci, bannerele de conexiune; apoi Missions, Practice și Themes, care nu au machetă.
- HUD-ul din joc (bară de 44px, variante FFA / echipe / steag) și controalele din 3D.
- Tranzițiile: fitil + explozie la start de meci, bandă de cerneală la navigare; reduse la `prefers-reduced-motion`.
- HUD-ul primește și butoanele de acțiune din machetă (SUPER, bomba specială, BOOM!).
- Ecranele fără funcționalitate încă (login cu cont, clasament) se fac în fazele lor, după aceleași machete.

**Acceptare:** `pnpm lint && pnpm typecheck && pnpm test` trec; smoke Playwright pe fiecare ecran refăcut (se deschide, 0 erori în consolă, niciun element interactiv sub 44px); capturi în `docs/screens/` comparate manual cu machetele; tema arenei se poate schimba fără ca interfața să se modifice.

**Checkpoint uman:** numele final (Fitil / Fuse Arena, Q-010) înainte de a fixa wordmark-ul de pe login.

---

## Faza 5 — Fatalități & cosmetice (fără plăți încă)
- Sistem de fatalități: eveniment `death{killerId, fatalityId}` → animație pe client (≤1.2s, nu blochează). Implementează cele 7 din `GAME_DESIGN.md`.
- Slow-motion + zoom la ultima eliminare din rundă.
- Skin-uri, skin-uri de bombă, emote-uri, voice packs — toate ca date + randare.
- Colecție locală (deblocări de test).

**Acceptare:** galerie de dev cu fiecare fatalitate rulând în buclă; nicio fatalitate > 1.2s; conținut validat cu zod.

---

## Faza 6 — Conturi, progres, persistență
- Fastify API + Postgres (Drizzle): cont anonim pe dispozitiv (upgrade la Apple/Google Sign-In mai târziu), profil, inventar, trofee per personaj, misiuni.
- Rezultatele meciurilor sunt scrise **doar de server**.
- Matchmaking public simplu după trofee (FFA și 2v2).
- Provocarea zilei cu seed zilnic + clasament.

**Acceptare:** teste de integrare API (Vitest + Postgres în Docker); un meci online actualizează trofeele ambilor jucători.

**Checkpoint uman:** politica de confidențialitate, GDPR, vârsta minimă.

---

## Faza 7 — Modul Infinit
- Pornește din varianta offline din prototip (cameră centrată pe jucător, lume procedurală din hash, stocare circulară regenerată în jurul camerei, boți care apar/dispar după distanță și devin mai puternici departe de centru, respawn lângă locul morții pe o poziție sigură, cu scut, scor) — mutată în `packages/sim` cu teste: aceeași coordonată generează mereu aceeași celulă; zonele modificate rămân modificate cât sunt în rază.
- Lume pe chunk-uri 32×32 generată din seed, încărcare/descărcare dinamică.
- Instanță cu 30–80 jucători, interest management (doar chunk-urile vecine se sincronizează).
- Respawn, scor, drop de bonusuri la moarte, clasament live, minimapă.
- Shard-uri: instanță nouă când una se umple.

**Acceptare:** test de încărcare cu 80 de boți-client conectați: tick stabil la 20 Hz, bandwidth per client < 15 KB/s (raport în progress).

---

## Faza 8 — Mobil & store readiness
- Capacitor iOS + Android: iconițe, splash, orientare, haptics nativ, blocare ecran activ, pauză la background.
- Deep links pentru invitații în cameră.
- „Salvează clipul”: înregistrare ultimelor 10s din canvas → video.
- Analytics (ex. PostHog, self-host posibil): retenție D1/D7, durată sesiune, funnel tutorial.
- Crash reporting (Sentry).

**Acceptare:** build-uri debug iOS și Android care rulează pe emulator; checklist de store completat în `docs/store-checklist.md`.

- Versiune web jucabilă din link (același build) pentru invitații fără instalare, cu îndemn la instalare.
- Pagină de pre-înregistrare Google Play; materiale pentru devlog (capturi/clipuri automate din Playwright).

**Checkpoint uman:** conturi Apple Developer și Google Play, nume final (verificat ca marcă — vezi `BUSINESS.md` §1), iconiță finală, capturi.

---

## Faza 9 — Monetizare
- Monede, magazin rotativ, battle pass (gratuit + premium).
- In-app purchases prin RevenueCat, validare pe server, restaurare cumpărături.
- Reclame recompensate opționale (în afara meciului) + achiziție „fără reclame”; starter pack.
- Fără cutii plătite cu recompense aleatoare. Model complet în `BUSINESS.md` §3.

**Checkpoint uman:** prețuri, produse în store, texte legale, test cu cumpărături sandbox.

---

## Faza 10 — Beta & soft launch
- TestFlight + Google Play closed testing.
- Soft launch în 2–3 țări mici; ținte și reguli de decizie în `BUSINESS.md` §5 (D1 ≥ 35%, D7 ≥ 12%, D30 ≥ 5%, tutorial terminat ≥ 70%). Fără marketing plătit sub ținte.
- Dashboard de metrici (PostHog): retenție pe cohorte, funnel tutorial, venit per jucător activ/zi, cost servere per jucător.

**Checkpoint uman:** decizia de lansare.

---

## Faza 11 — Modul FPS liber (după lansare)
**Scop:** mod shooter separat, cu mișcare liberă (nu pe grilă), solo și echipă. Vederea 1P pe grilă există deja din Faza 2; faza asta adaugă mișcare continuă, sărituri și aruncare țintită în arc.
- Extinde `packages/sim` cu un sub-modul de mișcare continuă (poziție float, coliziune cu grila, sărituri, traiectorii de aruncare în arc). Regulile de bombe/flăcări/bonusuri rămân cele de pe grilă.
- Client: refolosește renderer-ul 3D din Faza 2 (Three.js, texturi, umbre, bombe, flăcări, mâna cu bomba); adaugă sunet 3D (WebAudio PannerNode) și arc de previzualizare la aruncare.
- Controale mobile: joystick + glisare pentru privire + aim assist; desktop: pointer lock.
- Rețea: 30 Hz pentru acest mod, predicție pentru mișcare + lag compensation pentru aruncări.
- Moduri: FFA 4–8 (solo) și 3v3/4v4 (Deathmatch pe echipe, Detonare).
- Minimapă de sus, fatalități în camera ucigașului.

**Acceptare:** teste de sim pentru mișcarea continuă (coliziuni, arc de aruncare determinist); 8 clienți headless fără desync; ≥ 50 fps pe un Android de gamă medie (raportat).

**Checkpoint uman:** confirmarea că merită construit, pe baza datelor din soft launch (e un mod mare, aproape un al doilea joc).

---

## Backlog de idei (după MVP)
- Editor de hărți + cod de partajare.
- Reluări complete și mod spectator.
- Cluburi/clanuri, chat cu mesaje predefinite (sigur pentru minori).
- Evenimente sezoniere: temele Halloween / Crăciun / Valentine / Școala există în prototip (grafică, bombe, pălării, ambient, muzică, selecție automată după dată); de adăugat recompense, misiuni și pass de eveniment, plus teme noi (Paște, vară/plajă, 1 Iunie).
- Mod „Boss”: 4 jucători contra unui bot uriaș.
- Ligi clasate cu resetare sezonieră.
