# Interfața jocului — direcția „Comic” (C)

Direcția vizuală aleasă de proprietar pe 2026-10-06 (D-051): bandă desenată — galben cu raster, cerneală neagră, colțuri drepte, casete înclinate, baloane de vorbire. Texte în engleză (D-028). Tot jocul e **doar landscape** (D-054).

- **Sursa de adevăr pentru „cum arată”:** `reference/ui/*.dc.html` (un fișier per ecran, 844×390, stiluri inline). Fișierele se randează doar în canvasul de design (au nevoie de runtime-ul lui); în repo se citesc ca markup. Canvasul: https://claude.ai/artifact/5rH1dcy2uvaw4DJqTsSaKw (privat, al proprietarului).
- **Sursa de adevăr pentru „cum se simte” jocul** rămâne `reference/prototype.html`.
- Cifrele, numele de jucători și recompensele din machete sunt inventate, doar ca să umple ecranele.

## Regula de bază: interfața e fixă, tema schimbă doar arena

Meniurile, HUD-ul, butoanele și baloanele arată la fel în orice temă. Tema (`packages/content/src/themes.ts`) schimbă doar ce e **în interiorul cadrului arenei**: podea, pereți, lăzi, flăcări, bombe, stilul personajelor. Arena stă într-un cadru cu chenar de cerneală, ca o casetă de bandă desenată. Vezi `C-Game.dc.html` (Classic) și `C-Game-Neon.dc.html` (aceeași interfață, arenă Neon).

## Tokeni

| Token             | Valoare                                                     | Folosit la                                                                   |
| ----------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `--paper`         | `#FFD60A`                                                   | fundalul paginilor, accent pe negru                                          |
| `--paper-dot`     | `#F2B600`                                                   | rasterul: `radial-gradient(var(--paper-dot) 24%, transparent 25%)`, pas 14px |
| `--ink`           | `#111111`                                                   | text, contururi, umbre                                                       |
| `--white`         | `#FFFFFF`                                                   | panouri, butoane secundare                                                   |
| `--red`           | `#E5262B`                                                   | acțiunea principală, umbra elementului selectat                              |
| `--red-dark`      | `#B3151A`                                                   | text roșu pe alb (OFF, LOCKED), hover la linkuri                             |
| `--cyan`          | `#19B5E8` (raze: `#5CCBF0`)                                 | casetele cu personaje, acțiuni secundare                                     |
| `--caption`       | `#FFF3B0`                                                   | casetele de narator și de informații                                         |
| `--ok`            | `#5BE36A`                                                   | ON, READY                                                                    |
| Culori de jucător | `#FFD23F` `#FF5F93` `#4FC3FF` `#7DFFB0` `#FF8A3D` `#FFFFFF` | cele din `ArenaScene.ts`                                                     |

- **Contur:** 3px `--ink` la elemente mici, 4px la panouri și la butonul principal. Fără colțuri rotunjite, cu excepția baloanelor de vorbire și a elementelor rotunde (joystick, buton BOMB, buline).
- **Umbră:** dură, fără blur: `3px 3px 0`, `4px 4px 0` sau `5–7px` la panourile mari, în `--ink`. Elementul selectat are umbra în `--red`.
- **Înclinări:** butoanele `skewX(-6deg)`, titlurile de pagină `skewX(-8deg)`, panourile `rotate(±1–2deg)`, alternând semnul între vecini.
- **Spațiu sigur:** 56px stânga/dreapta (breton), 14–20px sus/jos. Ținte de atins de minimum 44px.

## Fonturi

- **Bangers** — titluri, butoane, cifre mari. **Rubik** (500/700/800, plus 500 italic pentru narator) — restul.
- Ambele sunt OFL. Trebuie împachetate local în `apps/client` (Capacitor rulează offline), nu încărcate de pe Google Fonts; se notează în `assets/CREDITS.md` când intră în repo. Asta închide Q-002.
- Bangers nu a fost verificat pentru „ș/ț”; contează doar dacă apar texte în română.

## Componente

| Componentă             | Descriere                                                                                   | Unde se vede                    |
| ---------------------- | ------------------------------------------------------------------------------------------- | ------------------------------- |
| Titlu de pagină        | bandă neagră, text `--paper`, Bangers 32px, înclinată                                       | toate ecranele cu „Back”        |
| Buton principal        | `--red`, text alb, contur 4px, umbră 5–6px, înclinat                                        | PLAY NOW!, START!, THIS ONE!    |
| Buton secundar         | alb (sau `--cyan`), contur 3px, umbră 4px, înclinat                                         | With Apple, NEW ROUND           |
| Buton „Back” / iconiță | pătrat alb 46px, contur 3px, umbră 3px                                                      | antetul paginilor               |
| Panou                  | alb sau `--cyan` cu raze, contur 4px, umbră 5–7px, ușor rotit                               | Home, Characters                |
| Casetă de narator      | `--caption`, contur 3px, text italic                                                        | „Meanwhile, in the arena…”      |
| Casetă de informații   | `--caption`, contur 3px, etichetă îngroșată urmată de text                                  | Host rules, You got             |
| Balon de vorbire       | alb, contur 3px, colț ascuțit spre personaj                                                 | replicile personajelor          |
| Ștampilă ON/OFF        | Bangers, rotită ±3–5°, verde pentru ON, roșu pe alb pentru OFF                              | Settings, Pause                 |
| Selector segmentat     | celule lipite, cea aleasă neagră cu text `--paper`                                          | Graphics, taburile din Rankings |
| Explozie („burst”)     | stea neregulată `--paper` cu contur, cu onomatopee peste                                    | Login, Match results, tranziție |
| Rând de clasament      | casetă albă, numărul într-un pătrat negru (roșu pentru top 3)                               | Rankings, Match results         |
| Personaj               | cel din joc (`paint.ts`, tema classic): bilă colorată, contur, antenă cu bobiță, ochi ovali | peste tot                       |

## Ecrane

Machetele urmează meniurile care există în client (`apps/client/src/app.ts`), cu textele din `packages/content`.

| Fișier                                         | Ecran                                                                                                | În client                   |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------- |
| `C-Home.dc.html`                               | Meniul principal: Play, Online, nivel de jucător, Fitile, Shop, Missions, Practice, Themes, Settings | `mainMenu`                  |
| `C-Mod.dc.html`                                | Play: personaj, grila de moduri (blocate pe nivel, NEW), Rules, Bots, Start                          | `playMenu`                  |
| `C-Online.dc.html`                             | Online: nume, personaj, Quick play pe mod, cameră privată (creează / intră cu cod)                   | `onlineMenu`                |
| `C-Lobby.dc.html`                              | Camera privată: cod, locuri, regulile gazdei (Mode, Rules, Bots, Theme, Events), Start               | `lobbyScreen`               |
| `C-Matchmaking.dc.html`                        | Camera de joc rapid, în așteptare („Starting in Ns…”)                                                | `lobbyScreen` (quick)       |
| `C-Personaje.dc.html`                          | Grila de personaje, cu stările lor (Selected, Lv, Free this week, preț, Player Lv, Coming in N days) | `charactersMenu`            |
| `C-Character.dc.html`                          | Pagina personajului: Listen, Try, Ultimate, nivel și XP, recompense pe nivel, Select / Buy           | `characterPage`             |
| `C-Shop.dc.html`                               | Magazin: categorii, obiecte (Wearing, Owned, preț, blocat pe nivelul unui personaj), previzualizare  | `shopMenu`                  |
| `C-RoundStart.dc.html`                         | Start de rundă, cu evenimentul de arenă                                                              | `startBanners`              |
| `C-Game.dc.html`                               | În joc, 2D; proprietăți: `theme` (classic/neon), `mode` (ffa/ctf)                                    | HUD                         |
| `C-Game-Neon.dc.html`, `C-Game-CTF.dc.html`    | Același ecran cu tema Neon, respectiv HUD-ul de steag                                                | HUD                         |
| `C-Game-3D.dc.html`                            | Controalele din vederea 3D: joystick, buton BOMB, minimapă                                           | HUD 3D                      |
| `C-Pauza.dc.html`                              | Pauză: Resume, Mode (repornește runda), Theme, Sound, Music, Quit                                    | `pauseDrawer`               |
| `C-Reconnect.dc.html`                          | Conexiune pierdută / reconectare eșuată                                                              | bannerele de conexiune      |
| `C-Final.dc.html`                              | Final de meci: câștigător, clasare, Fitile și XP primite, nivel nou                                  | `roundOver`, `grantRewards` |
| `C-Setari.dc.html`                             | Setări: Sound, Music, Vibration, Motion effects, 3D graphics quality, View                           | `settingsMenu`              |
| `C-Transitions.dc.html`                        | Prototipul de tranziții                                                                              | —                           |
| `C-Motion.dc.html`                             | Demo: răspuns la apăsare, mișcare ambientală, reacțiile personajului                                 | —                           |
| `C-Login.dc.html`, `C-Login-FuseArena.dc.html` | Login cu cont — **pentru Faza 6**, nu există încă în joc                                             | —                           |
| `C-Clasament.dc.html`                          | Clasament — **nu e în plan încă**, păstrat ca idee                                                   | —                           |

## HUD-ul din joc

- Bară neagră sus, de **44px** (nu 30px cum scrie în `GAME_DESIGN.md`), ca butoanele de vedere și de pauză să aibă ținta de 44px. Conține: jucătorii cu scorul (sau scorul pe echipe), cronometrul, inimile, bombele disponibile, abilitățile cu încărcături și efectele active, butonul de vedere (2D/1P/3P) și pauza.
- Arena ocupă restul ecranului, în cadru cu chenar de 4px.
- Butoanele de acțiune stau în colțul din dreapta-jos al arenei: **SUPER** (rotund, galben, cu inel roșu și eticheta „READY!” când e încărcat), **bomba specială următoare** (rotund, cyan, cu numărul de încărcături; glisare în sus = schimbă tipul) și **BOOM!** (detonatorul, deasupra lor). În 3D se adaugă butonul BOMB.
- Onomatopeele („BOOM!”, „tick… tick…”) și baloanele scurte („Uh-oh.”) se desenează peste arenă și țin de interfață, nu de temă.

## Orientare

Jocul e **doar landscape** (D-054): aplicația nu se rotește în portrait. În aplicația nativă orientarea se blochează din configurația iOS și Android; în browser, pe telefon ținut în portrait, se afișează un ecran „Rotate your phone” în loc de joc. Hărțile și așezarea echipelor rămân doar în varianta de landscape.

## Tranziții

- **Momente mari** (start de meci, victorie, deblocare): ecranul se întunecă, fitilul arde spre bombă cu numărătoare 3-2-1 (2,1s), apoi explozia acoperă ecranul cu „BOOM!” și dezvăluie pagina următoare (încă ~0,9s).
- **Navigare obișnuită:** o bandă neagră cu margine roșie trece peste ecran în ~0,5s; pagina se schimbă la jumătate.
- La `prefers-reduced-motion` (și la setarea echivalentă din joc) ambele se reduc la o schimbare instantanee.
- Timpii exacți și curbele sunt în `C-Transitions.dc.html` (blocul `@keyframes` și funcțiile `startMatch` / `wipeTo`).

## Interacțiune: apăsare, sunet, vibrație

Fiecare acțiune are trei răspunsuri simultane: vizual, sonor și tactil. Demo interactiv: `C-Motion.dc.html`. Vibrația trece prin `vibrate(ms)` din `apps/client/src/haptics.ts` (sub 25 ms = ușoară, 25–59 = medie, de la 60 = puternică) și respectă `settings.vibration`; sunetele sunt sintetizate în `audio/sfx.ts` și respectă `settings.sound`.

| Acțiune                                  | Vizual                                                      | Sunet                                | Vibrație                                  |
| ---------------------------------------- | ----------------------------------------------------------- | ------------------------------------ | ----------------------------------------- |
| Buton principal                          | intră 6px în propria umbră (80 ms), revine în 120 ms        | „pop” grav                           | 12 ms                                     |
| Buton secundar, „Back”, panou            | intră 3–4px în umbră                                        | „tick” scurt                         | 8 ms                                      |
| Ștampilă ON/OFF                          | ștampila cade de la 1,5× la 1× în 180 ms                    | „stamp”; mai grav la OFF             | 15 ms                                     |
| Alegere în grilă (mod, personaj, obiect) | cartea se ridică 3px, umbra devine roșie, apare „PICKED!”   | două note urcătoare                  | 10 ms                                     |
| Element blocat                           | se scutură stânga-dreapta 240 ms; personajul se întristează | bâzâit scurt „nope”                  | 20 · pauză 40 · 20 ms                     |
| Cumpărare                                | apare ștampila „YOURS!”, Fitile numără în jos               | `tada`                               | 30 ms                                     |
| Nivel nou, recompensă                    | explozie („burst”) + cifrele numără în sus                  | `tada`                               | 30 · 60 · 30 ms                           |
| Schimbare de ecran (bandă)               | banda de cerneală, 520 ms                                   | `whoosh`                             | —                                         |
| Start de meci (fitil)                    | numărătoare 3-2-1, apoi „BOOM!”                             | `sizzle` cât arde, explozie la final | 10 ms la fiecare cifră, 80 ms la explozie |
| Conexiune pierdută                       | panoul cade în ecran                                        | notă coborâtoare                     | 40 · 80 · 40 ms                           |

Reguli:

- Răspunsul vizual pornește la **apăsare** (`pointerdown`), nu la ridicarea degetului; acțiunea se execută la ridicare.
- Fără vibrație la derulare, la glisare sau la schimbările pe care nu le-a provocat jucătorul.
- Sunetele din meniuri sunt mai încete decât cele din meci și nu se suprapun: cel mult unul la 60 ms.
- Nimic nu depinde doar de sunet sau doar de vibrație; ambele pot fi oprite din setări.

## Mișcare ambientală

- **Razele** din spatele personajelor se rotesc foarte lent (o tură la 90 s).
- **Ștampilele de atenție** („NEW!”, „READY!”) pulsează o dată la 3 s. **Semnele de întrebare** din locurile goale se leagănă (±7°, 1,2 s).
- **Rasterul galben stă pe loc**, iar panourile își păstrează înclinarea fixă: fundalul nu concurează cu conținutul.
- Cel mult **două** animații în buclă pe ecran, în afara personajului. În timpul meciului, interfața nu are nicio animație în buclă în afara celor legate de joc (SUPER încărcat, steag plecat).
- Toate buclele se opresc când `settings.motion` e oprit (implicit la `prefers-reduced-motion`) și când aplicația e în fundal.

## Personajele din meniuri

Personajele din meniuri sunt cele din joc, desenate de `Portraits` (`apps/client/src/ui/portrait.ts`) cu expresiile din `paint.ts`.

- **În repaus:** se leagănă ușor (4px, 1,6 s) și clipesc la 3–5 s. Privesc spre ultimul element atins (parametrul `face`).
- **Reacții**, 0,8–1,4 s, apoi înapoi în repaus:

| Moment                                              | Expresie                                                     | Balon                   |
| --------------------------------------------------- | ------------------------------------------------------------ | ----------------------- |
| Apeși PLAY!, START!                                 | încruntat, hotărât (expresie nouă, de adăugat în `paint.ts`) | replică de luptă        |
| Îl alegi, cumperi ceva, câștigi                     | `happy`                                                      | replică de bucurie      |
| Apeși ceva blocat, pierzi conexiunea, pierzi meciul | `doom` (trist, cu strop de transpirație)                     | replică scurtă de necaz |
| Oprești sunetul                                     | `doom`, scurt                                                | „Fine. I’ll whisper.”   |
| Nimic de 20 s                                       | cască sau se uită în jur                                     | —                       |

- Replicile din baloane vin din `packages/content` (aceleași `quips` ca în meci), câte una la o reacție, fără să se repete imediat.
- Pe un ecran reacționează **un singur** personaj: cel mare. Cele mici din grile doar clipesc.
- Cu `settings.motion` oprit, personajele stau pe loc, dar își schimbă în continuare expresia.

## Ce nu e desenat încă

Missions (harta de capitole și finalul de misiune), Practice (tutorial, provocări), Themes, panoul DEV, ecranul „Rotate your phone”, splash-ul de încărcare, momentele „bye bye” și de glorie, HUD-ul pentru Crown și Hot potato, stările butoanelor (apăsat, dezactivat), mesajele de tip toast. Se construiesc din componentele de mai sus.
