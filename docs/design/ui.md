# Interfața jocului — direcția „Comic” (C)

Direcția vizuală aleasă de proprietar pe 2026-10-06 (D-034): bandă desenată — galben cu raster, cerneală neagră, colțuri drepte, casete înclinate, baloane de vorbire. Texte în engleză (D-028), **doar landscape**.

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

| Fișier                                      | Ecran                                                                   |
| ------------------------------------------- | ----------------------------------------------------------------------- |
| `C-Login.dc.html`                           | Login (invitat, Apple, Google, cod de cameră)                           |
| `C-Login-FuseArena.dc.html`                 | Varianta de login dacă numele devine „Fuse Arena” (Q-004)               |
| `C-Home.dc.html`                            | Acasă                                                                   |
| `C-Mod.dc.html`                             | Alegerea modului                                                        |
| `C-Personaje.dc.html`                       | Personaje                                                               |
| `C-Lobby.dc.html`                           | Cameră privată                                                          |
| `C-Matchmaking.dc.html`                     | Căutare de jucători (pentru matchmaking-ul public, care nu există încă) |
| `C-RoundStart.dc.html`                      | Start de rundă, cu evenimentul de arenă                                 |
| `C-Game.dc.html`                            | În joc, 2D; proprietăți: `theme` (classic/neon), `mode` (ffa/ctf)       |
| `C-Game-Neon.dc.html`, `C-Game-CTF.dc.html` | Același ecran cu tema Neon, respectiv HUD-ul de steag                   |
| `C-Game-3D.dc.html`                         | Controalele din vederea 3D: joystick, buton BOMB, minimapă              |
| `C-Pauza.dc.html`                           | Pauză                                                                   |
| `C-Reconnect.dc.html`                       | Conexiune pierdută / reconectare eșuată                                 |
| `C-Final.dc.html`                           | Final de meci                                                           |
| `C-Setari.dc.html`                          | Setări                                                                  |
| `C-Clasament.dc.html`                       | Clasament                                                               |
| `C-Transitions.dc.html`                     | Prototipul de tranziții                                                 |

## HUD-ul din joc

- Bară neagră sus, de **44px** (nu 30px cum scrie în `GAME_DESIGN.md`), ca butoanele de vedere și de pauză să aibă ținta de 44px. Conține: jucătorii cu scorul (sau scorul pe echipe), cronometrul, bombe/rază/viteză, bonusul activ, butonul de vedere (2D/1P/3P) și pauza.
- Arena ocupă restul ecranului, în cadru cu chenar de 4px.
- Onomatopeele („BOOM!”, „tick… tick…”) și baloanele scurte („Uh-oh.”) se desenează peste arenă și țin de interfață, nu de temă.

## Tranziții

- **Momente mari** (start de meci, victorie, deblocare): ecranul se întunecă, fitilul arde spre bombă cu numărătoare 3-2-1 (2,1s), apoi explozia acoperă ecranul cu „BOOM!” și dezvăluie pagina următoare (încă ~0,9s).
- **Navigare obișnuită:** o bandă neagră cu margine roșie trece peste ecran în ~0,5s; pagina se schimbă la jumătate.
- La `prefers-reduced-motion` (și la setarea echivalentă din joc) ambele se reduc la o schimbare instantanee.
- Timpii exacți și curbele sunt în `C-Transitions.dc.html` (blocul `@keyframes` și funcțiile `startMatch` / `wipeTo`).

## Ce nu e desenat încă

Misiuni, provocarea zilei, prieteni, profil, magazin și battle pass, tutorial, splash de încărcare, momentele „bye bye” și de glorie, alegerea fatalității, stările butoanelor (apăsat, dezactivat), mesajele de tip toast.
