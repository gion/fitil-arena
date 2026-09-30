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

## Faza 2 — Client jucabil offline + Practice

**Mini-plan** (milestone-uri, fiecare cu `lint + typecheck + test` verde și commit):

1. **sim — reguli noi**: lăzi blestemate (păianjeni, nori de furtună cu fulger anunțat), cauze de moarte noi (`spider`, `lightning`, `crush`), detecția „fără scăpare” (`isDoomed`, pentru „bye bye”), evenimente de maxim atins (momente de glorie), urmărirea bombelor șutate/aruncate până la moarte (`via`), manechine, respawn generic.
2. **sim — moduri**: Rânduri mobile, Arena rotativă (unghi determinist în întregi), Capturează steagul 3v3 (furt, scăpare, returnare, revenire după 3s, 3 capturi / 3 min) cu boți pe roluri; boții ocolesc păianjenii, zonele de fulger și rândul anunțat. Bench extins cu toate modurile.
3. **sim — Practice**: pașii tutorialului și cele 5 provocări evaluate determinist din evenimente.
4. **content**: cele 10 teme din prototip (6 de bază + 4 de eveniment cu sezon automat), moduri, nume de bonusuri, replici (momente de glorie, țipete), provocări, tutorial — validate cu zod.
5. **client 2D**: arhitectură `Match` (sim la 20 Hz + interpolare) → renderere separate. Randare Phaser din texturi procedurale generate per temă („theme pack” înlocuibil cu sprite-uri), UI în DOM peste canvas (bara de 30px, meniu-pauză lateral, joystick sub deget, tap = bombă, BUM!), tremurat + haptic după distanță, „bye bye” și momente de glorie (slow-motion + zoom), amețeală cu shader de valuri, arena rotativă cu camera rotită, audio sintetizat + muzică per temă + voice packs, meniu principal (Joacă / Teme / Setări), Practice (boți pe 4 niveluri, tutorial, manechine, provocări).
6. **client 3D**: renderer Three.js (1P/3P) peste aceeași stare, minimapă 2D, controale relative la cameră cu asistență, mâna cu bomba, umbre, lumini de explozie, setare de calitate.
7. **acceptare**: Playwright (Practice 30s în 2D/1P/3P cu touch prin CDP, 0 erori), FPS cu CPU throttling 4x, capturi per temă × vedere în `docs/screens/`.

**Făcut:**

- **sim**: lăzi blestemate (2 păianjeni care vânează, nu trec de bombe, mor în explozii; 2 nori care anunță zona 1.1s și trăsnesc în cruce), cauze de moarte `spider`/`lightning`/`crush`, `doomBomb` („bye bye”), evenimente `maxed` (momente de glorie), `via` pe bombe (șutată/aruncată), foc prieten comutabil, manechine, revenire generică în joc, limită de timp.
- **Moduri**: Rânduri mobile (anunț, pași animați, împingere/strivire, scutul sparge lada), Arena rotativă (unghi în micro-grade întregi, 4→14°/s, inversare la 25s), Capturează steagul 3v3 (furt, purtător −15%, scăpare, returnare, revenire după 10s, captură doar cu steagul propriu acasă, revenire în joc după 3s cu 2s scut, 3 capturi / 3 min) cu boți pe roluri. Boții ocolesc păianjenii, zonele de fulger și rândul anunțat. `Input.face` pentru 3D.
- **Practice (sim)**: tutorial în 6 pași (mergi, bombă, bonus, picior, mănușă, manechin) cu verificare deterministă, manechine care revin după 2s, 5 provocări (Șutangiul, Artificierul, Minimalistul, Fulgerul, Aruncătorul).
- **content**: cele 10 teme din prototip (6 + 4 de eveniment cu sezon automat, inclusiv fereastra peste Anul Nou), moduri, nume de bonusuri, replici, mesaje de moarte, echipe, roster, texte de provocări și tutorial — validate cu zod.
- **Client 2D (Phaser)**: `Match` (sim la 20 Hz după timpul real, interpolare 60 fps, slow-motion 40% la „bye bye” / 30% la maxime), randare din texturi procedurale per temă (`TexBank`, strat static pre-randat), toate elementele din prototip (lăzi aurii/blestemate, bonusuri pozitive/negative/MAX, bombe pe temă și pe echipă cu inel, scânteie, antenă detonator, flăcări, portaluri care clipesc, păianjeni, nori, fulgere, steaguri, halo + săgeată, scut, steluțe de amețeală, insigne ⇄/!, animație de moarte, turtire la strivire, coroană/confetti/jonglerie/aură/linii de viteză), tremurat de ecran după distanță, amețeala ca shader de valuri + culori (PostFX), arena rotativă prin camera Phaser (cu scalare ca să încapă), zoom cinematic, ambient de temă, grilă adaptivă (portrait + landscape).
- **UI (DOM)**: bara de 30px (jucători/echipe/CTF/provocare + bombe, rază, viteză, bonusuri active, contoare), meniu-pauză lateral (mod, temă, sunet, meniu principal), pauză automată în fundal, meniu principal (Joacă / Practice / Teme / Setări), selector de mod și nivel de boți, setări persistente (sunet, muzică, vibrații, efecte de mișcare, calitate 3D, vedere), joystick sub deget care urmează degetul, tap în dreapta = bombă cu cerc de feedback, dublu tap, BUM!, indicații care dispar, anunțuri, balon „bye bye…” / replici, toast la moarte, carduri de final.
- **Audio**: efecte sintetizate + muzică generată per temă (portate), sistem de voice pack (`SynthVoice` implicit, `FileVoice` din manifest de fișiere, cu fallback).
- **Haptic**: tipare de vibrație (nativ prin Capacitor, `navigator.vibrate` în browser), proporțional cu distanța exploziei.
- **3D (Three.js)**: 1P și 3P peste aceeași stare, minimapa 2D în colț, controale relative la cameră cu histerezis și asistență, glisare/săgeți pentru rotire, buton BOMBĂ, mâna cu bomba (leagăn, gest la aruncare), texturi din desenele temei, umbre, bombe pe temă (lucioase, puls roșu, antenă cu led), flăcări aditive + halou + lumini de explozie, păianjeni/nori/fulgere/zone/steaguri 3D, camere cinematice la „bye bye” și momente de glorie, legănare la amețeală, setare de calitate (umbre, rezoluție).
- **Acceptare** (Playwright, `pnpm test:e2e`): pornește fără erori; Practice (manechine) 30s în 2D, 1P și 3P cu touch real prin CDP (joystick + tap cu al doilea deget), verificat că jucătorul se mișcă și pune bombe, 0 erori în consolă. **FPS cu CPU throttling 4x: 2D 60 · 1P 60 · 3P 60** (MacBook M1 Max, Chromium headless nou cu GPU). Capturi temă × vedere: `docs/screens/` (30, `pnpm --filter @fitil/client screens`).
- Teste: sim 65, content 4, server 1. Bench: 1000 meciuri pe 8 moduri în ~10s, 0 excepții / neterminate / desync; CTF ~161s în medie, 2.7 capturi pe meci.

**Rămas / cunoscut:**

- FPS-ul e măsurat pe un Mac cu GPU puternic (CPU încetinit 4x). Pe telefon real (Android mediu) încă nemăsurat — de făcut cu build-ul Capacitor. În headless-ul vechi (randare software SwiftShader) iese 2D ~36 / 3D ~14.
- `pnpm test:e2e` nu rulează în CI: pe Linux fără GPU testul de FPS ar pica (randare software). De adăugat în CI fără testul de FPS.
- Fonturi: fonturi de sistem (fără Bungee/Nunito de pe Google Fonts, ca aplicația să nu facă cereri externe). Fontul final ține de direcția artistică (checkpoint).
- Nu există încă un pachet de voce înregistrat; doar sistemul (sinteză + fișiere).
- Simplificări vizuale față de prototip: sclipirea care traversează lada aurie e înlocuită cu un puls; stelele din tema Cosmos nu mai clipesc (sunt în stratul static).
- Păianjenii omoară mult (≈0.8 morți/meci în bench) — balans în Faza 4.
- Boții încă nu folosesc mănușa, detonatorul și linia (din Faza 1).
- Controalele relative la ecran din Arena rotativă sunt testate doar prin cod și capturi, nu manual pe telefon.

## Faza 2b — Misiuni (singleplayer)

**Mini-plan:** misiunile din prototip se joacă în lumea infinită, deci întâi lumea: stocare circulară 64×64 în `packages/sim`, generată din hash-ul coordonatelor și regenerată în jurul jucătorului (e și primul punct din Faza 7, adus înainte pentru că acceptarea 2b cere „ținte păstrate la regenerarea lumii”). Apoi misiunile ca stare de sim (ținte, prieteni, bară de viață), definițiile în `packages/content`, clientul (cameră care urmărește, HUD, săgeată, hartă de capitole, ecran de rezultat) și testele.

**Făcut:**

- **sim — lume infinită** (`world.ts`): `genCell` determinist (stâlpi pe pozițiile pare, start liber, lăzi/aurii/blestemate din hash), `ensureWindow` cu raza 26 în jurul jucătorului, bombele și păianjenii prea departe dispar; `idx`/`inBounds` știu de stocarea circulară, deci restul simulării (bombe, lanțuri, boți, BFS) merge neschimbat. Aruncarea nu mai face wrap, portalurile apar în jurul jucătorului.
- **sim — misiuni** (`missions.ts`): ținte deterministe din seed (distanță [dmin, dmax] față de start, nu pe stâlpi, la ≥4 pătrățele între ele), cristale ascunse în lăzi (nu ard), turnuri blindate (2 explozii), cuști înconjurate de lăzi, prieteni care te urmează și leșină 3s în flacără, casa (start), steagul cursei; bară de viață (−35% explozie/fulger, −20% păianjen, 1.2s invulnerabilitate, scutul absoarbe), inimi +25% (~14% din drop-uri), păianjeni rătăcitori, limită de timp, victorie/înfrângere, `missionGoal` (săgeata), `missionStars`.
- **content**: 8 misiuni în 2 capitole (cele 4 din prototip + variante mai grele), cu tip, număr de ținte, distanțe, limită de timp, densitate, criterii de stele, păianjeni — validate cu zod; deblocare progresivă (misiune cu misiune, capitolul 2 cu 8★ în capitolul 1).
- **Client**: modul Misiuni în meniul principal cu harta de capitole (stele, lacăte), cameră care te urmărește lin, randarea ferestrei vizibile (2D și 3D), turnuri cu buline de viață și tremurat la lovitură, cuști cu „Ajutor!”, prieteni, casa și steagul verde, steagul cu carouri, flash roșu la rănire, bara de viață în HUD, obiectivul și cronometrul, săgeata de obiectiv (2D pe hartă, 3D relativ la cameră), „bye bye” doar când lovitura te-ar omorî (viață ≤ 35%), ecran de rezultat cu stele/timp/viață/criterii, reîncercare, misiunea următoare. Stelele sunt salvate local (`settings.stars`).
- **Teste**: sim 81 (16 noi pentru lume și misiuni: generare deterministă, fără margini, zone modificate păstrate cât sunt în rază, ținte din seed pentru fiecare tip, ținte păstrate la regenerare, victorie/înfrângere pe fiecare tip, blindaj, leșin, cursă cu timp, bară de viață, păianjeni, stele, determinism); content 6. Playwright: harta misiunilor (deblocare) + fiecare din cele 8 misiuni pornește, se termină forțat cu reușită (stele salvate) și apoi cu eșec, fără erori; smoke-ul din Faza 2 trece în continuare (FPS 60/60/60 cu CPU 4x).

**Rămas / cunoscut:**

- Stelele sunt doar locale; sincronizarea cu contul e în Faza 6.
- Nu există boți în lumea infinită (vin cu modul Infinit, Faza 7); nici chunk-uri online.
- În 3D, săgeata de obiectiv e un overlay 2D la marginea ecranului (ca în prototip), nu un obiect 3D.
- Misiunile nu au încă provocări de tip puzzle/boss (idei în GAME_DESIGN).

## Jocul trece pe engleză (2026-09-28)

**Făcut:** toate textele vizibile au fost traduse în engleză (moduri, bonusuri, replici, mesaje de moarte, echipe „Blue”/„Red”, personajul „You”, provocări, tutorial, teme, misiuni, capitole, meniuri, HUD, anunțuri, ecrane de final, „Help!” din cuști). `speechSynthesis` folosește `en-US`, iar `<html lang="en">`. Id-urile au rămas la fel (D-028). Testele Playwright au fost actualizate la textele noi; lint, typecheck și toate testele trec.

**Rămas:** vocile înregistrate (ElevenLabs sau actori) după lista de replici în engleză; `GAME_DESIGN.md` încă citează replicile în română.

## Voce temporară și handover (2026-09-29 – 30)

**Făcut:** 10 replici generate local cu Chatterbox (D-029) în `apps/client/public/voice/`, redate prin `FileVoice` cu fallback pe sinteză; uneltele de generare și comparația de modele (Turbo, Orpheus, Dia) în `tools/voice/`. Handover pentru sesiunea următoare în `docs/handover.md`; jurnalul de prompturi (`docs/prompt-log.md`, regulă în `AGENTS.md`).

**Rămas:** înregistrări proprii (amânate de user); țipetele și restul replicilor sunt încă sintetizate.

## Faza 3 — Multiplayer online (camere private)

**Mini-plan:**

1. `packages/net` (nou, TypeScript pur, fără DOM): protocolul (mesaje, input compact), construcția meciului online (moduri, sloturi, jucători umani → id-uri), `ArenaHost` (logica autoritară a camerei, fără timere: cozi de input cu număr de secvență, cadre, hash-uri periodice, preluare de boți) și `NetClient` (starea confirmată, starea afișată cu jitter buffer, predicția jucătorului local), plus `lagLink` (simulator de latență: întârziere, jitter, pierdere ca retransmisie TCP).
2. `apps/server`: Colyseus 0.18 (`ArenaRoom` peste `ArenaHost`) pe portul 2567, lângă Fastify; cameră privată cu cod de 4 litere ca `roomId`; lobby (gazda alege modul, tema, boții), start, 20 Hz, reconectare 15s (`allowReconnection`), sloturile părăsite devin boți.
3. Client: `Match` primește id-ul jucătorului local și un „driver” online (fără slow-motion al simulării, D-017); meniul Online (creează / intră cu cod), lobby, carduri de final cu întoarcere în lobby; `?lag=150` pornește simulatorul de latență.
4. Teste: `packages/net` (buclă în memorie cu latență și ordine amestecată), `apps/server` (4 clienți headless @colyseus/sdk pe serverul local, meci complet, hash-uri egale, inclusiv un client cu latență și o reconectare).
5. Checkpoint: variante de hosting în `docs/questions.md`.

**Făcut:**

- **`packages/net`** (nou): protocolul (lobby, `snap` cu starea JSON, cadre `f` la fiecare tick cu input-urile umane compacte + ack-uri + hash la 20 de tick-uri, `end` cu hash-ul final), `buildOnline` (aceleași reguli ca offline; pe echipe oamenii se împart alternativ, sloturile goale sunt boți), `ArenaHost` (logica autoritară fără rețea: lobby, gazdă, configurare, start, cozi de input numerotate — maxim 2 în așteptare, bomba/detonarea nu se pierd la contopire —, preluarea sloturilor de boți la plecare, finalul după animații), `NetClient` (starea confirmată, starea afișată cu jitter buffer și salt când se adună >40 de cadre, predicția jucătorului local, resincronizare la desync sau cadru lipsă), `lagLink` (simulator de latență cu coadă ordonată).
- **Server**: Colyseus 0.18 (`ArenaRoom`) pe portul 2567, lângă API-ul Fastify; codul camerei (4 litere, fără I/O) e `roomId`, cameră privată; reconectare 15s (`onDrop` + `allowReconnection`), la reconectare primești starea completă; camera se blochează în meci și revine în lobby după final (revanșă). Mod rapid de tick doar în afara producției (teste).
- **Client**: `Match` primește id-ul jucătorului local și driverul online (toate referințele la jucătorul 0 din randare 2D/3D și UI au fost înlocuite), fără slow-motion al simulării online (D-017); meniul **Online** (nume, creează camera, intră cu cod), lobby (locuri, gazdă, mod/boți/temă aleși de gazdă și văzuți de toți, Start), meniul de pauză online (meciul continuă, stai pe loc), carduri de final cu „Back to the room”, bannere la pierderea/revenirea conexiunii, **revenire în cameră după reîncărcarea paginii** (token în `sessionStorage`), tema camerei fără să schimbe tema salvată. `?lag=150&jitter=40&loss=0.02` pornește simulatorul (doar în dev).
- **Teste**: net 6 (buclă în memorie cu latență/jitter: FFA, 2v2, CTF complete cu hash-uri egale la server și la toți clienții, predicție, plecare → bot); server 4 (**4 clienți headless @colyseus/sdk pe serverul local, meci complet, hash-urile coincid la final** — unul cu latență simulată, unul cu reconectare la mijlocul meciului; cod greșit refuzat); Playwright 15 (nou: doi jucători în browsere separate, cameră cu cod, gazda schimbă modul, meciul pornește la amândoi, mișcarea gazdei se vede la oaspete, 0 desync, 0 erori).
- **Manual (browser, 150 ms ±37 ms, 2% pierdere)**: mișcarea proprie răspunde imediat (predicția), restul lumii vine cu ~300 ms întârziere, 4–5 input-uri neconfirmate, buffer 1–2 cadre, 0 desync pe un meci complet; revanșa și revenirea după reîncărcare merg.

**Rămas / cunoscut:**

- Hostingul (Q-003) — checkpoint uman; până atunci doar local. Clientul mobil (Capacitor) are nevoie de `VITE_SERVER_URL` spre serverul public (`wss://`).
- Bombele/flăcările sunt afișate din starea autoritară (întârziată), jucătorul local din predicție (D-031): la 150 ms poți părea că treci printr-o flacără care la tine „s-a stins deja”; moartea e mereu cea de pe server. De reevaluat la teste pe telefon.
- Fluiditatea „manual la 150 ms” e verificată în browser pe desktop, nu încă pe telefon real.
- Informația ascunsă (tufișuri, Faza 4) nu e compatibilă cu sincronizarea prin input-uri fără filtrare (D-030).
- Fără matchmaking public (doar camere private, cum cere faza); fără spectatori.
