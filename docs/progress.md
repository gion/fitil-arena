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

## Faza 2c — Personaje, monede, magazin (+ progresie)

**Mini-plan:** după decizia „variantele recomandate” (D-034 – D-036): kitul personajelor în sim (statistici + semnături + încărcări) cu teste pentru fiecare pasiv; datele (11 personaje, magazin, economie cu XP) în content, cu teste de economie; construcția comună a meciurilor offline/online cu personaje; clientul: randare 2D/3D, voci, ecranele Personaje, pagina personajului, Magazin, recompense la final; lobby online cu personajul fiecăruia.

**Făcut:**

- **sim**: `CharKit` (viteză, rază, bombe, maxim de bombe, vieți) și semnăturile: bomba mare la început (Bubu), a doua viață (Gugu), maxim 5 bombe (Zuzu), magnet (Fifi), Mănușă + scut la start (Tanti Veta), imunitate la boli fără Scut (Robo-Mici), Picior permanent + ricoșeu fără Mănușă (Striker), ulei care încetinește ceilalți + fitil mai lung (Chef), trecere printr-o ladă la 20s (Ghost), porumbel o dată pe rundă + scut la jumătate (Magician); `Rules.charges` — abilitățile din arenă cu încărcări; evenimente noi (`lifeLost`, `chargeOut`, `immune`, `pigeon`, `ghostIn`); `boxDestroyed` are proprietarul.
- **content**: 11 personaje pe 5 rarități (plusuri, minusuri, semnătură, Ultimate — doar prezentare —, voce, mers, replici în engleză), magazin (culori, pălării, accesorii, bombe, urme, voci + 11 culori exclusive de nivel 5), economie (profil valid din orice, cumpărare/echipare, XP și niveluri 1–10, recompense pe nivel, bonus zilnic, XP dublu la primul meci din zi), `botChars` din seed.
- **net/server**: fiecare loc din lobby are personaj și ținută (`me`), gazda poate alege „Classic”; meciurile offline folosesc aceeași construcție.
- **client**: personajele desenate în 2D (detaliile din prototip + cele 4 noi, corp pătrat Robo, fantoma transparentă și pe jumătate văzută în ladă, mărimea corpului, pălăriile și accesoriile cumpărate, bombe colorate, urme la mers, curcubeu animat, bomba mare, cronometrul bombelor pentru Maestru, uleiul, porumbelul, clipire după o viață pierdută) și în 3D (corp, detalii, pălării, mărime); voci sintetizate per personaj și pachete de voce; ecranele Personaje (cărți cu portrete animate și raritate), pagina personajului (close-up care se rotește, Listen, Try it, plusuri/minusuri, bare față de medie, Ultimate „coming soon”, nivel, bara de XP, recompensele pe niveluri, cumpărare/alegere), Magazin (tab-uri, previzualizare pe personajul tău, cumpărare/purtare/scoatere); monedele și personajul în meniul principal; „Characters / Classic” în meniul Play și în lobby; recompensele pe cardul de final (monede, XP, niveluri noi); HUD cu încărcări („Kick ×2”), vieți și maximul de bombe.
- **Teste**: sim 96 (15 noi: fiecare pasiv, încărcări, determinism cu toate pasivele), content 18 (economie: cumpărare fără fonduri refuzată, echipare/scoatere, persistență, niveluri, recompense; fiecare personaj pornește cu statisticile corecte; meciuri între boți cu toate personajele), Playwright 17 (nou: un obiect din fiecare categorie cumpărat și echipat + persistență; pagina personajului, cumpărare, meci cu personajul ales, recompense), FPS 60/60/60.

**Rămas / cunoscut:**

- Ultimate și perk-urile: Faza 4 (cu bench-ul de balans pe personaje; rata de victorie per personaj încă nemăsurată).
- În 3D lipsesc cronometrul Maestrului, uleiul, urmele și porumbelul (sunt doar în 2D).
- Boții nu știu de semnăturile noi (Ghost nu trece prin lăzi intenționat, nu evită uleiul).
- Proprietatea personajelor/cosmeticelor nu se verifică online (Faza 6).

## Deblocări treptate, calendar și panoul DEV (2026-10-06)

**Mini-plan:** regulile de deblocare ca funcții pure în content (nivel de jucător, moduri, personaje, teme, calendar, rotație), cu teste; profiluri multiple și ceas controlabil în client; lacăte, teasere și insigne „NEW” în meniuri; panou DEV exclus din build-ul public.

**Făcut:**

- **content** (`progression.ts`): `playerLevel` din XP-ul total, `modeLock`, `charState` (deținut / rotație / de cumpărat / nivel / „coming soon”), `themeState` (deschisă / eveniment / nivel / de cumpărat), `weeklyRotation`, `unlocksAt`, `openKeys`; economia verifică nivelul și lansarea la cumpărare, rotația la alegere, `buyTheme`, iar `reward` anunță nivelurile de jucător noi, ce deschid și temele de eveniment păstrate. Profilul are `themes` și `seen`.
- **client**: `clock.ts` (data curentă, mutabilă din panoul DEV), `store` cu profilul real + profiluri de test și rol de admin; lacăte pe moduri și teme, teme de eveniment „free now · play to keep”, cumpărarea temelor în afara perioadei; cărți de personaj cu siluetă și numărătoare, „Free this week”, „Player Lv N”; pagina personajului cu acțiunea potrivită stării; nivelul de jucător cu bară lângă monede; insigne „NEW” în meniul principal și pe elemente; bannere la nivel nou de jucător; dacă personajul ales nu mai e disponibil (rotația s-a terminat) joci cu Bubu; tema aleasă revine la una permisă.
- **Panoul DEV** (`dev/panel.ts`): profiluri (jucător nou / veteran / admin), +Fitile, +nivel, +XP, deblochează tot, resetări, data simulată cu sezonul, rotația și lansările afișate.
- **Teste**: content 27 (9 noi: curba, moduri, nivel + Fitile, calendar, rotație, teme, tema păstrată, niveluri de jucător în recompense, ce vede un jucător nou); Playwright 18 (nou: jucător nou — lacăte, teasere, rotație, teme, lipsa butonului DEV în build-ul public, nivelul 2 deschide 1 vs 1; testul de personaje rulează cu dată fixă).

**Rămas / cunoscut:**

- Datele din calendar sunt provizorii; pragurile de nivel sunt o primă estimare (de calibrat pe retenție, `BUSINESS.md` §5).
- Deblocările sunt locale, deci ocolibile din `localStorage` — verificarea reală vine cu conturile (Faza 6).
- Nu există încă misiuni zilnice sau battle pass (rămân în `GAME_DESIGN.md` §Progres).

## Demo web pe GitHub Pages (2026-10-01)

**Făcut:** workflow `Pages` care construiește clientul cu `VITE_OFFLINE_ONLY=1` (fără meniul Online și fără reluarea camerei) și îl publică pe GitHub Pages la fiecare push pe `main` (D-042). Se joacă tot ce e offline: Play cu boți, Practice, Misiuni, 2D/1P/3P, teme.

**Rămas:** Pages trebuie activat o dată din setările repo-ului (Settings → Pages → Source: GitHub Actions). Online-ul în demo așteaptă hostingul serverului (Q-003).

## Faza 4 — Personaje, Super, moduri

**Mini-plan** (milestone-uri, fiecare cu `lint + typecheck + test` verde și commit):

1. **sim — reguli**: personaje ca date (`HeroSpec`: Super, pasiv, statistici deja ajustate cu afinitățile), bara de Super (lăzi, eliminări, timp), cele 7 Super-uri și pasivele cu reguli (ricoșeu, scut o dată pe meci, capcană la moarte); inimi (`rules.lives`, Inima +1, max 3); bombe speciale cu 3 încărcături (gheață, flashbang, otravă) și Blestem; tufișuri cu `canSee` (boții respectă vizibilitatea); reguli pentru evenimentele de arenă (drop-uri, viteza șutului, aruncare mai lungă, fitil); modurile Coroana și Cartoful fierbinte; boți care folosesc Super-ul și joacă modurile noi.
2. **content**: cele 7 personaje (raritate, statistici, pasiv, Super), afinitățile personaj × temă, evenimentele de arenă trase din seed, `heroSpec(hero, temă)` care le combină, modurile noi și textele — validate cu zod.
3. **balans**: bench cu personaje și arene aleatoare (FFA de 4), raport în `docs/balance.md`; țintă 18–32% pe personaj și 15–35% pe arenă.
4. **net + server**: personajul ales în lobby (per loc), modurile noi, matchmaking public pe mod (camere publice care pornesc când se umplu sau după un timp, cu boți).
5. **client**: ecran de selecție personaj (cu afinitățile temei curente), buton Super cu bară, iconița bombei următoare pe buton și glisare pentru schimbare, inimi în HUD, anunțul evenimentului de arenă, randare 2D/3D pentru tot ce e nou.
6. **acceptare**: teste sim pentru fiecare abilitate și modificator, bench de balans, Playwright pentru selecție + modurile noi.

**Făcut:**

- **sim — personaje**: `HeroSpec` (Super, pasiv, statistici deja ajustate cu afinitatea temei) pe `PlayerSetup.hero`; bara de Super (0–100: +8 ladă spartă, +35 adversar lovit/eliminat, +1/s, înmulțit cu procentul personajului; se păstrează la revenire); cele 7 Super-uri (`heroes.ts`): bombă mare (+2 rază, în plus), dash 3 pătrățele, bombă lipicioasă (se lipește de primul jucător atins, fitil 1.5s), cluster (4 mini-bombe la exact 2 pătrățele), poșeta (aruncare 4–9 pătrățele peste ziduri), oprirea timpului (bombele celorlalți stau 1.5s), teleport (portalul mai îndepărtat sau un loc sigur la ≥5); pasive: ricoșeu la șut (2×), șalul (o lovitură pe meci, apoi doar 0.4s de fugă), capcana la moarte (explodează sub primul adversar, 15s), timerele bombelor (doar vizual).
- **sim — inimi, bonusuri, bombe speciale**: `rules.lives` + inimi din afinități (max 3), o lovitură ia o inimă cu 1.5s de invulnerabilitate; Inima (+1), Blestemul (adversarii −1 rază, 8s) și bombele speciale cu 3 încărcături, folosite înaintea celor normale, cu schimbarea tipului (`Input.swap`): gheață (îngheață 2s, apăsările scurtează, nu sparge lăzi), flashbang (orbește 2.5s), otravă (explozie + nor 3s; 1s în nor = o lovitură). Drop-urile noi doar cu `rules.extras` (12% din drop-uri).
- **sim — tufișuri**: `bush[]` generat din seed, ars de flacără; `canSee(s, viewer, target)` (ascuns la peste 1 pătrățel, coechipierii se văd, orbitul nu vede departe); boții țintesc doar ce văd.
- **sim — evenimente de arenă (reguli)**: `dropPct`, `kickPct`, `throwExtra`, `fuse`, `event`.
- **sim — moduri**: Coroana (o iei călcând pe ea, cade la moarte, 60s ținută sau cel mai mult în 2:30, revenire după 3s) și Cartoful fierbinte (primul la 3s, fitil 10–16s, trece la atingere cu 1s pauză, explodează în cruce cu raza 2 și elimină purtătorul).
- **Boți**: folosesc Super-urile (de scăpare când sunt în pericol, de atac când au ținte), vânează coroana/purtătorul, fug de cartof sau aleargă cu el spre cel mai apropiat, reacționează întârziat când sunt orbiți.
- **content**: cele 7 personaje (raritate, statistici, pasiv, Super, texte), afinitățile pe toate cele 10 teme, 7 evenimente de arenă cu ponderi, `matchRules(mod, temă, seed, aspect)` folosit identic de client și server, `botHeroes`, textele noi; validate cu zod.
- **Balans** (`pnpm balance`, `docs/balance.md`): 3500 de meciuri — personajele între 22% și 28%, fiecare personaj × arenă între 15.5% și 33% (ținte atinse).
- **net + server**: personajul ales per loc (`hero` la intrare și în lobby), `extras` comutabil de gazdă, input pe fir cu Super și schimbare (6 câmpuri, compatibil cu cele vechi); **joc rapid public** (`quick`, câte o cameră pe mod prin `filterBy`): pornește când se umple sau după 15s, cu numărătoare în lobby; tufișurile sunt oprite online (Q-009).
- **Client**: ecran de selecție a personajului (Super, pasiv, raritate, afinitatea cu tema curentă) din Play, Online și lobby; butonul Super cu inel de încărcare (Q pe tastatură), butonul bombei speciale următoare (R; în 3D și glisare în sus pe BOMB), inimi în HUD, stări (șal, blestem, înghețat, orbit), cipuri pentru coroană și cartof, bannerul evenimentului de arenă la start, meniul Online cu joc rapid pe mod, lobby cu personaj per jucător și comutatorul de evenimente. 2D: semnul fiecărui personaj, tufișuri (iarbă înaltă, ascund jucătorii și bombele adversarilor), bloc de gheață, nor toxic, flăcări colorate pe tip, bombe speciale colorate, bombe gri la oprirea timpului, timere pentru Master Fitil, capcane, coroana (pe jos și pe cap), cartoful cu secundele rămase, ochiul Blestemului, orbire și ceață ca fereastră în jurul tău. 3D: tufișuri, nor toxic, bombe colorate, gheață/coroană/cartof pe personaj, jucători ascunși, overlay de orbire/ceață.
- **Teste**: sim 111 (30 noi: fiecare Super și pasiv, inimi, încărcare, fiecare bombă specială, Blestem, drop-uri, tufișuri, Coroana, Cartoful, determinism cu personaje, boți care folosesc Super-urile); content 13; net 11 (personaje per loc, extras, joc rapid, input pe fir, Coroana și Cartoful în bucla cu latență); server 5 (joc rapid cu doi clienți headless, alt mod → altă cameră, hash-uri egale); Playwright: selecția personajului + Super din buton, Coroana și Cartoful în 2D și 3P, joc rapid în două browsere. `pnpm sim:bench` are și Coroana (~113s) și Cartoful (~33s): 0 excepții, 0 desync.

**Rămas / cunoscut:**

- **Q-009**: tufișurile online (sincronizarea prin input-uri dă fiecărui client toată starea); până la decizie sunt doar offline.
- Arta personajelor e provizorie (culoare + un semn deasupra capului); designul final ține de checkpoint-ul de direcție artistică. La fel numele (de lucru, traduse: „Auntie Veta”, „Master Fitil”).
- Interpretări de design notate în D-043 (oprirea timpului, teleportul, cluster-ul, capcana, gheața/flashbang-ul care nu sparg lăzi).
- Boții nu folosesc schimbarea bombei speciale (le folosesc în ordine) și încă nu folosesc mănușa/detonatorul/linia.
- Matchmaking-ul public e simplu (o cameră deschisă pe mod, fără niveluri de skill/regiuni); clasarea vine cu conturile (Faza 6).
- Testul de FPS nu poate rula în containerul cloud (fără GPU); e2e-urile rulează aici cu `PW_CHROMIUM=/opt/pw-browsers/chromium`.

## Faza 4 — integrarea cu personajele, magazinul și deblocările (2026-10-06)

**Context:** Faza 4 fusese făcută pe 2026-10-01 pe ramura `feat/faza-4-personaje` (pornită din Faza 3), în paralel cu Faza 2c + deblocările de pe `main`. Cele două aveau sisteme de personaje diferite și 28 de fișiere în conflict (74 de zone).

**Mini-plan:** merge manual, strat cu strat (sim → content → net/server → client), cu testele ambelor părți verzi după fiecare; un singur model de personaj (D-048); Ultimate pentru toate cele 11 personaje (D-049); bench de balans pe rosterul complet.

**Făcut:**

- **sim**: kit + erou pe același jucător (`applyHero` apoi `applyKit`), inimile din Faza 4 cu a doua viață a lui Gugu, ricoșeul unificat (`Bomb.bounce`), uleiul Bucătarului în `fire`, prima bombă mare și fitilul lung în `placeBomb`, `applyItem` cu opțiuni; 4 Ultimate-uri noi (Cutremur, Penalty, Boo!, Switcheroo) cu boți care le folosesc.
- **content**: `characters.ts` are `ultimate.kind`/`pct`; `heroes.ts` a rămas cu afinitățile (pe id-urile din roster, plus câteva pentru personajele noi), `heroSpec` și `charSetup`; modurile noi au niveluri de deblocare; balans refăcut pe 11 personaje.
- **net/server**: un singur `buildOnline` (personaje + reguli de arenă + încărcări, tufișuri doar offline), locuri cu personaj și ținută, joc rapid cu `MeMsg`.
- **client**: selecția de erou a ramurii a fost înlocuită cu butonul de personaj (nume — Ultimate, nota afinității) care deschide grila; butonul Ultimate arată numele și culoarea personajului; restul din Faza 4 (bombe speciale, inimi, tufișuri, Coroana, Cartoful, evenimente de arenă, joc rapid) e neschimbat.
- **Balans** (`docs/balance.md`, 6000 de meciuri): 19.5–31.4% pe personaj, fiecare personaj × arenă în 15–35% (ținte atinse după două ajustări de afinitate pe tema Valentin).
- **Teste**: sim 132 (96 + 30 din Faza 4 + 6 noi pentru Ultimate-urile noi și combinația kit + erou), content 34, net 11, server 5; Playwright 23 din 24.

**Rămas / cunoscut:**

- **Testul de FPS n-a putut fi validat la integrare**: laptopul era pe baterie la 11%, iar Chromium randa la 30 fps chiar și o pagină goală. Codul nostru pe cadru măsoară 0.1–0.4 ms cu CPU 4x. De rerulat pe alimentare (`pnpm test:e2e -g FPS`).
- Boții folosesc rar Penalty, Switcheroo și Portal Jump (cer o situație anume).
- Perk-urile de la nivelurile 4 și 8 (D-034) nu există încă.
- Boo! e doar vizual online (ca tufișurile, Q-009): clientul știe poziția.
- În 3D lipsesc în continuare cronometrul Maestrului, uleiul, urmele și porumbelul.
- Workflow-ul `Pages` (demo-ul cerut pe 2026-10-01) vine cu acest merge; publică doar după ce Pages e activat manual din setările repo-ului.

## Faza 4b — Interfața „Comic”

**Mini-plan:** (1) tokeni CSS + fonturi locale; (2) componentele de bază din `docs/design/ui.md`; (3) ecranele existente din `apps/client/src/ui`, pe rând, începând cu startul și pauza (inclusiv selecția de personaj, pagina de personaj, magazinul și jocul rapid, apărute în Fazele 2c și 4); (4) HUD-ul din joc; (5) tranzițiile. Fiecare pas cu smoke Playwright și captură în `docs/screens/`.

**Făcut:**

- Direcția aleasă și documentată: `docs/design/ui.md`, machete în `reference/ui/` (18 ecrane), deciziile D-051–D-053, faza adăugată în `PLAN.md`.
- Machetele refăcute după meniurile reale de pe `main` (Play, Online, personaje cu stări, pagina de personaj, magazin, HUD cu inimi, SUPER și bombă specială, recompense în Fitile și XP); acum sunt 21. Decizia D-054 (doar landscape).

**Implementat (2026-10-06):**

- **Tokeni și fonturi:** `apps/client/src/ui/styles.css` rescris pe tokenii din `docs/design/ui.md` (galben cu raster, cerneală, roșu, cyan, caption, ok); Bangers + Rubik woff2 locale în `src/ui/fonts/` cu `fonts.css` și licențele OFL (D-059, `assets/CREDITS.md`).
- **Doar landscape (D-054):** iOS `UISupportedInterfaceOrientations` fără portrait (+ `UIRequiresFullScreen` pe iPad), Android `screenOrientation="sensorLandscape"`; ecranul „Rotate your phone” în `index.html` (CSS pur, telefon în portrait); clientul cere mereu o arenă landscape (`aspect() ≥ 1`), mesajul de rotire din meniu a dispărut. Sim-ul a rămas neatins (fără schimbări de gameplay).
- **Componente** (`src/ui/comic.ts`): titlu de pagină, butoane (principal / secundar / cyan / pătrat), panou (alb, cyan cu raze), casete de narator și de informații, balon, ștampilă ON/OFF, selector segmentat, insigne (NEW!, PICKED!, READY!, DONE!), explozie, pastila cu Fitile; `installPress` = răspunsul la apăsare pentru toată interfața (vizual la `pointerdown`, sunet + vibrație după tip, elementele blocate se scutură, D-060).
- **Sunete de interfață** în `audio/sfx.ts` (`ui('pop' | 'tick' | 'stamp' | 'stampOff' | 'pick' | 'nope' | 'tada' | 'whoosh' | 'down')`, cel mult unul la 60 ms, fixe față de temă) și `sizzle()` pentru fitil; expresiile `fierce` și `blink` în `paint.ts`.
- **Personajele din meniuri** (`ui/portrait.ts`): mereu stil classic, se leagănă, clipesc la 3–5s, privesc spre ultima atingere, se uită în jur după 20s; reacții (PLAY! → încruntat + replică de luptă, alegere / cumpărare / victorie → `happy`, blocat / conexiune pierdută / înfrângere → `doom`, sunet oprit → „Fine. I’ll whisper.”) cu replici din `MENU_LINES` și din `win` / `quips` (D-058).
- **Ecrane refăcute** după machete: meniul principal, Play (grila de moduri, Rules, Bots, START!), Online (joc rapid + cameră privată), camera privată (locuri cu personaje, rânduri de reguli cu foaie de opțiuni, SHARE, D-056), jocul rapid („?” pe locurile goale, numărătoare), The Cast + pagina personajului (Listen / Try, Ultimate, nivel, recompense, Select / Buy), magazinul („Trying on” + buton de jos, D-055), pauza (ecran modal), setările (ștampile, Picture), finalul de meci (explozie, „X WINS!”, clasare cu cauza eliminării, „You got”, LEVEL UP!), „Connection lost” / „No way back”, rezultatele misiunilor / provocărilor / tutorialului; apoi Missions, Practice (cu legenda „How things work”) și Themes, fără machetă, din aceleași componente. Panoul DEV folosește clasele noi.
- **HUD:** bara neagră de 44px (D-053) cu variante FFA (tu în galben, scorul în Bangers), echipe (scor + buline pe membri), steag (capturi ca buline, „FLAG OUT!”), coroană, cartof, misiune (bara de viață), cronometru în mijloc, inimi SVG, BOMBS / RANGE / SPEED, abilități și efecte în casete; butoanele de vedere (2D/1P/3P) și de pauză de 48×44. Arena stă într-un cadru cu chenar de 4px, strâns pe hartă (`ArenaScene.area()` / `frameRect()`); minimapa 3D în stânga-sus, cu chenar. SUPER rotund galben cu inel de încărcare și „READY!”, bomba specială rotundă (ICE / FLASH / POISON ×n), BOOM! înclinat, BOMB mare în 3D, joystick-ul și indicațiile în stil comic.
- **Tranziții (D-057):** banda de cerneală (520 ms, `whoosh`) la navigare; fitil 3-2-1 + „BOOM!” la startul meciului din meniu, cu evenimentul arenei afișat; online doar explozia. Instant cu `settings.motion` oprit; buclele (raze, NEW!, „?”) se opresc și în fundal.
- **Teste:** `e2e/ui.spec.ts` — fiecare ecran refăcut se deschide fără erori în consolă și nu are elemente interactive vizibile sub 44px; capturi în `docs/screens/ui/`; tema arenei (Clasic vs Neon) nu schimbă stilurile interfeței; „Rotate your phone” în portrait; elementul blocat nu se deschide. Testele existente adaptate la fluxurile noi (previzualizare în grilă și magazin, regulile camerei în foaie, titlurile noi).

**Rămas / cunoscut:**

- Capturile din `docs/screens/ui/` trebuie comparate manual cu machetele (s-au comparat la implementare, pe 844×390).
- `C-RoundStart` e simplificat: fără ecranul „GET READY!” cu luptătorii; evenimentul arenei apare în timpul fitilului (D-057).
- Bangers nu a fost verificat pentru „ș/ț” (subsetul latin-ext e inclus); contează doar dacă apar texte în română.
- Duratele de vibrație și volumele sunetelor de interfață sunt cele propuse în `docs/design/ui.md`, nereglate pe telefon real.
- Machetele de login (Faza 6) și clasament rămân neimplementate; wordmark-ul așteaptă Q-010.

## Faza 5 — Fatalități & cosmetice (în lucru, 2026-10-06)

**Mini-plan:**

1. **content**: `fatalities.ts` (cele 7 din `GAME_DESIGN.md`, zod: durată ≤ 1.2s, raritate, preț) și `emotes.ts`; categoriile noi `fatality` și `emote` în magazin/`Outfit` (cumpărate cu Fitile, fără aleator); teste.
2. **client – logică**: `Match` alege fatalitatea din ținuta **ucigașului** (sim-ul rămâne neatins: cosmeticele nu sunt gameplay) și emite `fatality`; slow-motion + zoom 1s la ultima eliminare din rundă (offline; online doar zoom, D-017).
3. **client – randare**: `render/fatality.ts` (poză pură în funcție de timp + recuzită), folosit de `ArenaScene` și de galerie; emote-uri deasupra capului (buton în HUD, offline).
4. **galeria DEV**: fiecare fatalitate în buclă pe personajul ales, cu durata afișată; test Playwright.
5. **colecție locală**: ecran „Collection” cu tot ce ai (skin-uri, bombe, urme, voci, fatalități, emote-uri) + deblocare de test din panoul DEV; skin-urile de bombă primesc forme.

**Făcut:**

- **content**: `fatalities.ts` (cele 7, zod, durată ≤ 1.2s, raritate, preț în Fitile) și 6 emote-uri; categoriile `fatality` și `emote` în magazin și în `Outfit` (+ `cleanOutfit`); teste.
- **client**: `Match` alege fatalitatea din ținuta ucigașului (doar lovitură de flacără, nu pe sine) și emite `fatality`; slow-motion 35% + zoom 1s la ultima eliminare din rundă (offline; online doar zoom); `render/fatality.ts` (poze pure) + recuzită în `paint.fatProp`; sunete în `sfx.fat`; emote deasupra capului cu buton în HUD (offline); previzualizare în buclă în magazin și galeria DEV (`ui/fatPreview.ts`, panoul DEV: colecție + galerie).
- **Teste**: client 15 (vitest, pozele), content 37, e2e `fatalities.spec.ts` (toate cele 7 în arenă, emote, finale, 0 erori).

**Decizii:** sim-ul rămâne neatins (cosmeticele nu sunt gameplay; fatalitatea se alege pe client din ținuta ucigașului, care e deja în sloturi online) — D-061.

**Rămas / cunoscut:**

- Verificarea vizuală în arenă nu e confirmată (capturile din e2e nu arată clar victima); de privit în galeria DEV (`pnpm dev` → DEV → Fatalities).
- Emote-urile nu se sincronizează online; fatalitățile nu apar în vederile 3D.
- Skin-urile de bombă rămân culori (fără forme noi); voice packs-urile existente (Cat/Pirate/Opera) acoperă cerința.

## Faza 6 — Conturi, progres, persistență (2026-10-06)

**Mini-plan:** (1) `content/trophies.ts` (trofee per loc / victorie, trepte pentru matchmaking) cu teste; (2) `net`: statistici de meci în `ArenaHost` (locuri, ucideri, lăzi) și `MatchResult` la final; (3) `server`: Drizzle + Postgres (docker-compose local, D-063), schema, migrații, conturi anonime cu token; (4) API: `/auth/anon`, `/me`, import de profil la prima conectare, cumpărături / echipare cu funcțiile din `content`, rezultate de meci scrise doar de server, trofee, provocarea zilei + clasament; (5) camerele Colyseus: autentificare la intrare, recompense + trofee la final, joc rapid pe trepte de trofee; (6) client: cont anonim, token la intrare online, profilul de la server după meci; (7) teste de integrare (Vitest + Postgres), CI cu serviciu Postgres.

**Făcut:**

- **content**: `trophies.ts` (trofee per loc / victorie, trepte de 300), D-065; teste.
- **net**: `ArenaHost` ține ucideri / lăzi și produce `MatchResult` (locuri, câștigători, cine a plecat); `daily.ts` (provocarea zilei din dată + `replayDaily` determinist); tipul `MatchOutcome`.
- **server**: Drizzle + Postgres (`apps/server/src/db`, migrații în `apps/server/drizzle/`, aplicate la pornire), `docker-compose.yml` (`pnpm db:up`), conturi anonime cu token (hash SHA-256), API: `/auth/anon`, `/me`, `/me/name`, `/me/import` (o dată, plafon 20 000), `/shop/buy|equip`, `/chars/buy|select`, `/daily`, `/daily/score` (verificat prin reluare), `/daily/leaderboard`; CORS fără cookie-uri. Camerele: `onAuth` cu token, personaj / ținută restrânse la ce deține contul, treaptă de trofee verificată, la final `recordMatch` (monede, XP, trofee, istoric într-o tranzacție) + mesajul `outcome` către fiecare om cu cont. Jocul rapid se filtrează pe `mode` + `bracket`.
- **client**: cont anonim în fundal (`online/account.ts`, doar dacă `/health` spune `accounts: true`), token + treaptă la intrarea în camere (cu un retry dacă treapta din cache e veche), banner cu trofeele după meci.
- **teste**: content 39, net 16, server 13 (api, conturi + meci online între două conturi cu Postgres real), e2e online/personaje/fatalități trec; CI cu serviciu Postgres.

**Completări (aceeași zi, după feedback):**

- **Server-first (D-067)**: `/themes/buy`, `/rewards/offline` (plafoane + 30/zi), clientul trimite cumpărături / echipare / personaj / temă prin API (optimist + rollback), profilul de pe server îl înlocuiește pe cel local, recompense offline în coadă fără conexiune.
- **Provocarea zilei în client**: card în Practice (+ clasament top 20), arenă 16:9 fixă, seed de la server, input-urile înregistrate pe tick și trimise la final; serverul reia rularea.
- **Legal (D-068)**: pagini provizorii (lorem ipsum) în Setări și `privacy.html` / `terms.html`; `DELETE /me` + ecran „Delete account”; limitare de rată.
- **Teste**: server 16 (inclusiv recompense offline, ștergere, limită de rată), client 18 (coada de sincronizare), e2e `account.spec.ts` (cumpărătura trece prin API, ștergerea contului, legal) — cu `TEST_DATABASE_URL` serverul e2e are conturi și restul e2e-urilor rulează legate de cont.

**Rămas / cunoscut:**

- Misiunile nu au progres persistent (nici local; stelele sunt în `settings`, pe dispozitiv).
- Textele legale sunt placeholder: de înlocuit înainte de publicare (Q-011).
- Limitarea de rată e în memorie (un singur proces); la mai multe instanțe trece în Redis.
- Testele cu Postgres se sar fără `TEST_DATABASE_URL`; aici au rulat pe Postgres 16 instalat în container (Docker nu rulează în sesiunea cloud).
- Pe deploy, `apps/server/drizzle/` trebuie să existe lângă `dist/`.
- e2e: `missions` (3D, fără GPU) pică intermitent și fără modificările din Faza 6; `smoke` FPS nu rulează în container.

## Faza 7 — Modul Infinit (2026-10-06)

**Mini-plan:**

1. **sim — lumea pe chunk-uri**: stocarea circulară 64×64 (D-024) devine un șir de chunk-uri 32×32 încărcate în jurul **fiecărui om** (pătratul ±26) și descărcate când rămân departe de toți (cu 8 pătrățele de histerezis); slotul 0 e „vidul” (perete). Misiunile merg pe aceeași lume.
2. **sim — modul Infinit**: boți care apar la 9–15 pătrățele și dispar la > 24, mai puternici departe de centru (offline); revenire lângă locul morții pe un loc sigur, cu 3s de scut; scor (eliminări, lăzi, distanță, timp trăit); 50% din bonusuri pe jos la moarte (online); intrare / ieșire din lume cu locuri refolosite; lăzile cresc la loc spre forma generată. Teste deterministe.
3. **net — protocol de stare filtrată** pentru Infinit (D-030 nu merge: 80 de oameni, lume nemărginită): serverul trimite fiecărui client doar chunk-urile din jurul lui (diferențele față de lumea generată, pe care clientul o generează singur din seed), schimbările de celule, jucătorii și bombele din zonă, evenimentele din zonă; clasament + minimapă o dată pe secundă.
4. **server**: camera `infinite` (max 80 de clienți; Colyseus deschide singur o instanță nouă când una e plină = shard-uri), tick 20 Hz, statistici de tick și de trafic.
5. **client**: Infinit offline în Play (varianta din prototip) și online (Online → Infinite): HUD cu scor / eliminări / distanță, clasament top 10, minimapă, coroană pe lider.
6. **test de încărcare**: 80 de boți-client conectați la server; tick-ul și traficul per client în raport.

**Făcut:**

- **sim** (`world.ts`, `infinite.ts`): lumea infinită pe chunk-uri 32×32 încărcate în jurul fiecărui om (±26, păstrate până la ±34), refolosite când rămân departe de toți; slotul 0 = vid (perete). Modul Infinit: `createInfinite`, `infiniteRules(online)`, boți care apar la 9–15 pătrățele și dispar la > 24 (mai puternici departe de centru: rază, bombe, viteză, picior), revenire la 3–9 pătrățele de locul morții pe un loc fără pericol, cu 3s de scut, scor (`infScore`), `joinWorld` / `leaveWorld` cu locuri refolosite, 50% din bonusuri pe jos la moarte (online), lăzile cresc la loc spre forma generată. Statistici noi pe `Player`: `kills`, `boxes`, `far`, `lived`, `got`, `out`.
- **net** (`infinite.ts`, D-070): `InfHost` (server) + `InfView` (client): chunk-urile din zonă ca diferențe față de lumea generată local din seed, schimbări de celule doar pe chunk-urile „calde” (+4 reci pe tick ca plasă de siguranță), jucători și bombe ca delta per client, evenimente filtrate pe zonă, roster, clasament + minimapă la 1 Hz.
- **server**: camera `infinite` (`InfiniteRoom`, max 80, reconectare 10s); Colyseus deschide singur o instanță nouă când una e plină (shard). Statistici de tick în `infStats`.
- **client**: Play → **INFINITE WORLD** (offline, cu boți) și Online → **INFINITE WORLD** (lumea comună); HUD: SCORE / KO / FAR / loc (#k of n), ceas ∞, clasament top 10 cu coroana liderului (și coroana pe capul lui în arenă), minimapă cu scară adaptivă. Figurile 3D se creează și pentru jucătorii apăruți pe parcurs.
- **Teste**: sim 148 (16 noi: chunk-uri, determinism, boți, revenire, scor, bonusuri scăpate, intrare/ieșire, lăzi), net 22 (6 noi: oglinda clientului = serverul în zonă după 600 de tick-uri de luptă, interest management, trafic, roster, instanță plină), server 2 noi (doi oameni se văd, shard nou la instanță plină), e2e `infinite.spec.ts` (offline + online cu doi jucători; capturi în `docs/screens/infinite/`). `missions.spec.ts` adaptat la stocarea nouă.

**Test de încărcare** (`pnpm --filter @fitil/server load:inf`, server într-un proces separat, `NODE_ENV=production`, container cloud cu 4 vCPU; boții-client decodează tot, ca un client real, și trimit input la 20 Hz):

| Scenariu                                         | Tick/s | Tick mediu | p95     | p99     | max     | Trafic per client (mediu / max) |
| ------------------------------------------------ | ------ | ---------- | ------- | ------- | ------- | ------------------------------- |
| 80 boți, se răspândesc (dist. medie 78)          | 20.0   | 5.83 ms    | 7.83 ms | 9.83 ms | 16.4 ms | 2.34 / 4.53 KB/s                |
| 80 boți, `--crowd` (fără tendința spre exterior) | 20.0   | 5.42 ms    | 7.38 ms | 8.95 ms | 11.0 ms | 2.98 / 5.62 KB/s                |

Ambele: 20.0 cadre/s primite de fiecare client, o singură instanță, RSS ~190 MB. Criteriul (tick stabil 20 Hz, < 15 KB/s) e îndeplinit cu marjă: tick-ul folosește ~12% din bugetul de 50 ms.

**Rămas / cunoscut:**

- Online, jucătorul local nu are predicție în Infinit (se mișcă după ~RTT + un cadru); de adăugat dacă se simte greoi pe rețele reale.
- Infinitul nu dă încă recompense (monede/XP) și nu are clasament persistent; online nu sunt boți (o instanță cu puțini oameni e goală).
- Emote-urile și fatalitățile nu se sincronizează în Infinit online (fatalitatea se alege din ținuta ucigașului, care e în roster, deci merge; emote-urile nu).
- Shard-urile sunt per proces: la mai multe procese trebuie Redis presence (Q-003).
- Testele server cu Postgres s-au sărit (fără `TEST_DATABASE_URL` aici); codul de conturi nu s-a schimbat.

## Performanță — înghețări la efecte noi (2026-10-06)

Raportat: jocul merge mai greu și se blochează uneori când se întâmplă multe simultan.

**Găsit (măsurat cadru cu cadru, M1 Max; pe telefon duratele sunt de câteva ori mai mari):**

| Unde                                      | Cauză                                                                     | Înainte                                              | După                                   |
| ----------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------- | -------------------------------------- |
| 2D, „amețit”                              | `DizzyFX` creat / distrus la fiecare amețeală (shader + țintă de randare) | 107 ms prima dată, 40 ms apoi                        | fără cadru lung                        |
| 3D, prima flacără / primul nor / păianjen | shadere compilate la prima apariție                                       | 20–50 ms                                             | 0.7 ms (0 compilări după primul cadru) |
| 3D, flăcări / lăzi / bonusuri             | sfera de încadrare a mesh-urilor instanțiate calculată o dată, goală      | flăcări invizibile dacă originea lumii nu e în cadru | desenate mereu                         |

**Făcut:** `ArenaScene` creează `DizzyFX` o dată și îl pornește / oprește; `Renderer3D.build()` pregătește ascuns păianjen, nor, fulgere și desenează un cadru de încălzire (`warm()`); mesh-urile instanțiate au `frustumCulled = false`.

**Rămas / cunoscut:**

- Încetinirea constantă nu s-a reprodus pe desktop (2D: 10 000 de cadre fără niciun cadru > 4 ms; 12 meciuri la rând fără creșteri de memorie). De măsurat pe telefon: 3D are 4 lumini punctiforme mereu active și umbre 2048 pe calitate mare; canvas-ul 2D e la rezoluția fizică (DPR 3).
- Texturile 2D se generează tot la prima folosire (sub 1 ms fiecare pe desktop; nemăsurat pe telefon).
- După un cadru lung, simularea recuperează până la 5 tick-uri într-un singur cadru (`Match.update`).

## Faza 8 — Mobil & store readiness (2026-10-06)

**Mini-plan:**

1. **Nativ (Capacitor)**: splash până e gata jocul, bara de stare ascunsă, ecranul ținut aprins în meci, pauză + sunet oprit când aplicația trece în fundal, butonul „înapoi” pe Android (pauză / ecranul anterior).
2. **Deep links**: `fusearena://join/ABCD` și link web `…/?join=ABCD` → intri direct în camera privată; butonul SHARE din cameră trimite linkul.
3. **„Save clip”**: ultimele 10–20s din arenă (canvas) înregistrate continuu în meci, salvate / partajate la cerere (buton în pauză și pe ecranul de final).
4. **Analytics (PostHog) și crash reporting (Sentry)**: clienți mici proprii peste API-urile lor HTTP (fără SDK-uri grele), activi doar cu chei în `.env`; evenimente pentru retenție D1/D7, durata sesiunii, funnel-ul tutorialului; comutator în Setări.
5. **Web din link**: același build; pe web (nu în aplicație) apare îndemnul la instalare (linkuri de store provizorii).
6. **Build-uri**: workflow GitHub Actions `mobile.yml` — Android debug APK + pornire pe emulator cu captură; iOS build pentru simulator + pornire (doar manual, macOS costă minute).
7. **Store**: `docs/store-checklist.md`; capturi și clipuri pentru store / devlog generate din Playwright (`pnpm --filter @fitil/client store:shots`).

**Făcut:**

- **Nativ** (`apps/client/src/native.ts`, D-073): splash până e gata jocul (plasă de siguranță 5s), bara de stare ascunsă, ecran ținut aprins doar în meci (`keep-awake` / Screen Wake Lock pe web), pauză + `AudioContext.suspend()` în fundal, butonul „înapoi” pe Android (pauză → reluare → ecranul anterior / foaia deschisă → aplicația în fundal din meniul principal).
- **Deep links**: `fusearena://join/ABCD` (Android `intent-filter`, iOS `CFBundleURLTypes`; `SceneDelegate` le trimitea deja către Capacitor) și `…/?join=ABCD` pe web; parametrul se scoate din adresă după intrare. SHARE din cameră trimite linkul (`inviteUrl`: `VITE_WEB_URL`, altfel pagina curentă, altfel schema proprie).
- **„Save clip”** (`clip.ts`, D-074): copie micșorată a arenei (max 960px lățime, 30 fps) înregistrată de două `MediaRecorder` decalate; butonul cu cameră în pauză (offline și online) și pe ecranul de final; în aplicație prin foaia de partajare (`@capacitor/filesystem` + `@capacitor/share`), pe web Share sau descărcare; comutator „Record clips”.
- **Telemetrie** (`telemetry.ts`, D-075): PostHog (retenție, sesiuni, funnel tutorial, meciuri, clipuri, invitații) și Sentry (erori JS neprinse) prin clienți proprii, activi doar cu chei; comutator „Anonymous stats”.
- **Web din link**: butonul „GET THE APP” pe web când există `VITE_STORE_IOS` / `VITE_STORE_ANDROID` (linkul potrivit telefonului).
- **CI** (`.github/workflows/mobile.yml`, D-076): Android debug APK + pornire pe emulator (Android 14) cu capturi la start și după deep link, fără crash în logcat; iOS build pentru simulator + pornire, doar manual.
- **Store**: `docs/store-checklist.md`; `pnpm --filter @fitil/client store:shots` → capturi 1920×1080 (Google Play) și 2796×1290 (iPhone 6.7"), plus un clip de devlog de 20s, în `apps/client/store-shots/` (în afara git-ului).
- **Teste**: client 24 (6 noi: linkuri, dispozitiv, stive și cererea Sentry), e2e `mobile.spec.ts` (intrare în cameră prin `?join=`, „Save clip” produce un video din arenă).

**Rămas / cunoscut:**

- Build-urile native nu se pot face în containerul de lucru (Android SDK / Xcode nedisponibile): le verifică workflow-ul `Mobile` pe PR (Android) și la cerere (iOS).
- Checkpoint uman: conturile Apple / Google, nume + `appId` final, iconița finală, capturile alese, domeniul pentru App Links / Universal Links (Q-016), consimțământul pentru statistici (Q-014), build-urile iOS în CI (Q-015), politica de confidențialitate (Q-011).
- Înregistrarea din vederea 3D e verificată în Chromium; în WebView-ul iOS rămâne de verificat pe dispozitiv (dacă iese neagră, copia se face imediat după randare).
- Erorile native (Swift/Kotlin) nu ajung în Sentry; doar cele JS.

## Skin-ul „Toy” (alternativă la „Comic”, 2026-10-07)

**Mini-plan:** un strat CSS peste interfața existentă, fără DOM nou: tokeni, fonturi, apoi fiecare componentă cu fundal deschis, text moștenit sau înclinare; comutator în Settings și parametru în URL; test Playwright care parcurge meniurile în Toy.

**Făcut:**

- `apps/client/src/ui/toy.css` (activ la `<html data-skin="toy">`), `settings.skin` + `applySkin()`, rândul „Look” în Settings, `?skin=toy|comic` pentru sesiunea curentă.
- Fonturile Lilita One și Nunito împachetate local (`ui/fonts/`, `fonts.css`, `assets/CREDITS.md`).
- Două stiluri inline din `app.ts` mutate în clase (`.pvbox`, `.cap.info.plain`), ca să poată fi restilizate.
- Machetele Toy în `reference/ui-toy/` (21), secțiunea „Skin-uri” în `docs/design/ui.md`, decizia D-077.
- `apps/client/e2e/skin.spec.ts`: comutarea, păstrarea după reîncărcare, parametrul din URL; parcurgerea meniurilor și a HUD-ului în Toy, cu capturi în `docs/screens/ui-toy/`.

**Rămas / cunoscut:**

- Verificat vizual în Toy, din capturile testului (844×390): meniul principal, Play, personaje, pagina de personaj, magazin, setări, misiuni, practice, teme, texte legale, Online, camera privată și foaia de opțiuni, jocul rapid, HUD FFA / echipe / steag / 3D, pauză, reconectare, final de meci. **Neverificate în Toy:** tranzițiile (fitil, bandă), HUD-ul din Infinit, finalul de misiune și de provocare, tutorialul, ecranele de cont, panoul DEV.
- Lilita One e mai lată decât Bangers: câteva texte lungi se rup pe două rânduri (ex. „TUTORIAL · 6 STEPS”), iar taburile din magazin sunt la limită.
- Neverificat pe telefon real.

## Nova și Shade: bombă în arie și bombă fumigenă (2026-10-07)

**Mini-plan:** `sim` mai întâi (arie + fum, cu teste deterministe), apoi `content`, protocolul Infinit și randarea; bench de balans la final.

**Făcut:**

- `sim`: `Bomb.area` + `areaTiles` (rază `min(range+1, 3)`, ocolește stâlpii, lada oprește aria); Super-urile `nova` (Supernova) și `smoke` (bomba fumigenă); `GameState.smoke`; `canSee` ține cont de fum; boții evită aria și folosesc fumul.
- `content`: Nova (epic, `burst`, fitil +0.5s, 6 bombe) și Shade (legendar, viteză 185, 5 bombe); roster de 13 personaje.
- `net` (Infinit): aria în bombă, fumul în codul celulei. Client: fum în 2D/3D, accesorii, sunet.
- Teste: `packages/sim/test/burst-smoke.test.ts` (15).

**Rămas / cunoscut:**

- Echilibrul (fitil, raza, 10s de fum) e provizoriu: de jucat cu oameni. `sim:bench` nu măsoară pe personaj.
- Aspectul lui Nova și Shade e doar un accesoriu peste corpul generic; direcția artistică finală așteaptă proprietarul.
- Playwright nerulat în containerul de lucru (numărul de carduri din `characters.spec.ts` a fost actualizat la 13).

## Portia și Slick: poartă privată și alunecare (2026-10-07)

**Mini-plan:** sim (poartă + alunecare + Smash, cu teste), apoi `net` (câmpul `slide`), `content`, apoi client (swipe, porți, accesorii).

**Făcut:** vezi D-079. Teste noi: `packages/sim/test/gate-slide.test.ts` (12).

**Rămas / cunoscut:**

- Boții nu alunecă și nu folosesc Ultimate-urile `gate`/`smash`; porțile nu sunt sincronizate în Infinit.
- Pragul swipe-ului (56 px în 110 ms) e o primă estimare: de reglat pe telefon real.
- Pe telefon nu există încă un indiciu în joc pentru swipe (doar descrierea personajului).
