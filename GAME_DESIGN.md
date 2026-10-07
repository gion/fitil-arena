# Fitil — Game Design

## Pilonii
1. **Meciuri scurte** (2–3 min), intri în joc în sub 10 secunde.
2. **Comic**: țipete, voice lines, fatalități absurde. Morțile sunt amuzante, nu frustrante.
3. **Ușor de învățat, greu de stăpânit**: grilă, bombe, lanțuri, șuturi, aruncări.
4. **Cosmetic, nu pay-to-win**: banii cumpără stil, nu putere.

## Reguli de bază (din prototip)
- **Grila se adaptează la ecran**: 11 rânduri în landscape, iar numărul de coloane (impar, 13–27) e ales după proporția ecranului ca harta să-l umple complet. Jocul e doar landscape (D-054); varianta de portrait din sim rămâne nefolosită de client. Pereți ficși pe pozițiile pare + lăzi distructibile (~70%). În multiplayer, dimensiunea e fixată de cameră (gazda/modul), nu de fiecare client.
- Bombă: 2.4s timer, flacără în cruce, durată 0.55s, reacție în lanț. **Raza de start = 1** — creșterea vine doar din bonusuri (bonusul de rază cade mai des).
- **Lăzi care reapar**: când rămân sub 35% din lăzile inițiale, apare o ladă nouă la 2.5–5.5s, pe un pătrățel liber, la cel puțin 3 pătrățele de orice jucător (cu animație de apariție).
- Bonusuri de bază: +Bombă, +Rază, +Viteză, Picior (șut bombă), Mănușă, Detonator, Linie (vezi mai jos).
- **Portaluri — doar în situații speciale**: nu există la începutul rundei. Când un **lanț de 4+ bombe** explodează (o bombă o declanșează pe alta), se deschide o pereche de portaluri pe pătrățele libere, departe unul de altul (≥ jumătate din hartă). Stau deschise **15s** (clipesc în ultimele 2.5s), teleportează jucători și bombe (șutate/aruncate). Un nou lanț de 4 le reîmprospătează timpul. Anunț pe ecran: „Lanț de 4! S-a deschis un portal”.
- **Lăzi aurii (speciale)**: ~4.5% din lăzi (7% în 1 vs 1; 6% din lăzile care reapar) sunt aurii, cu stea și sclipire. Spartă, o ladă aurie lasă **garantat** un bonus maxim: **Viteză maximă**, **Rază maximă (8)** sau **Bombe maxime (8)**. Afișat cu chenar auriu și eticheta MAX; anunț pe ecran când îl iei.
- „Hurry up”: după 90s arena se strânge din margini (blocuri cad) — de adăugat.

### Mănușă, Detonator, Linie (implementate în prototip)
- **Mănușă**: tap cât stai pe o bombă = o ridici; tap pe bomba altcuiva din fața ta = o ridici; tap cu bomba în mână = o arunci 3 pătrățele în direcția privirii, peste ziduri; dacă locul e ocupat, continuă până găsește unul liber. Aruncată în afara hărții, **reintră prin partea opusă** (wrap). **Dublu tap** = pui bomba și o ridici imediat.
- **Detonator**: bombele tale nu mai explodează singure; apare butonul **BUM!** (doar cât ai astfel de bombe pe hartă) care le detonează pe toate. Siguranță: explodează singure după 15s. Boții nu îl folosesc (sau doar cu logică dedicată).
- **Linie**: **dublu tap** = prima bombă sub tine, restul bombelor disponibile (max 5 total) în linie, în direcția privirii, până la primul obstacol.
- Prioritate la dublu tap când ai ambele: Linie > ridicare cu Mănușa.

## Senzație & feedback (implementate în prototip)
- **Personajul tău e evidențiat**: inel auriu pulsând la picioare + săgeată deasupra capului (și inel în 3D).
- **Tremurat de ecran după distanță**: explozie lângă tine = zguduire puternică + vibrație (haptic) proporțională; departe = abia se simte; lanțurile se cumulează. Dezactivat la `prefers-reduced-motion` / setare.
- Țipete comice sintetizate la moarte + replici vocale (speechSynthesis în prototip; în joc: voice packs înregistrate).

## Interfață & controale (mobil)
- **Harta ocupă tot ecranul**; UI-ul stă într-o **bară de 44px** sus (D-053, ca butoanele să aibă ținta minimă de atins; arena e într-un cadru cu chenar, vezi `docs/design/ui.md`) (jucători + scor, bombe disponibile, rază, viteză, bonusuri active, buton Vedere, buton Meniu). Nimic nu acoperă arena.
- **Meniu = pauză**: panou lateral (teme, sunet, rundă nouă, continuă). Pauză automată când aplicația trece în fundal.
- **2D**: jumătatea stângă = joystick care **apare sub deget** și dispare la ridicare (te urmează dacă tragi mai departe); jumătatea dreaptă = **tap oriunde pune bomba** (fără buton), cu un cerc scurt de feedback. Indicațiile de control dispar la prima atingere sau după 6s.
- Robustețe: orice atingere nouă preia joystick-ul (evită blocarea când se pierde evenimentul de ridicare la multi-touch).

## Vederi 3D (în același joc, comutabile: 2D · 1P · 3P)
- Aceeași simulare pe grilă, randată 3D cu Three.js; harta 2D rămâne ca **minimapă** în colț.
- **1P (persoana întâi)**: cameră la nivelul ochilor, **mâna cu bomba** vizibilă în colț (se leagănă la mers, gest de aruncare la plasare; goală când nu ai bombe).
- **3P**: cameră în spate-sus. Mort = cameră de sus peste arenă.
- **Controale 3D**: joystick stânga = mers **relativ la cameră** (înainte/înapoi/lateral), cuantizat pe grilă cu histerezis și **asistență** (dacă direcția principală e blocată și împingi ușor lateral, ia direcția liberă); glisare pe dreapta = rotire cameră; buton **BOMBĂ** pe centrul jumătății drepte; bomba/aruncarea/linia merg în direcția privirii. Desktop: W/S/A/D + săgeți pentru rotire + mouse.
- **Grafică**: texturi per temă (generate din desenele 2D), umbre reale de la soare, tone mapping, cer/ceață în culoarea temei; **bombe realiste** (metal lucios, capac, fitil curbat, scânteie luminoasă, puls roșu înainte de explozie, antenă cu led pentru detonator; variante pe temă: cub, cocos, mină cu țepi, inel neon); **flăcări** ca limbi de foc aditive + halou pe podea + **lumină de explozie** care luminează pereții.
- Setare de calitate grafică (umbre on/off, rezoluție) pentru telefoane slabe — de adăugat.

### Tufișuri
- Pătrățele de tufiș prin care poți merge; cine stă în tufiș e invizibil pentru adversari, cu excepția celor aflați la cel mult 1 pătrățel distanță. Bombele puse în tufiș se văd doar ca o sclipire slabă a fitilului.
- Flacăra arde tufișul (dispare pentru restul rundei).
- Anti-trișare: serverul nu trimite deloc poziția jucătorului ascuns către clienții care nu au voie să-l vadă. Boții respectă aceeași regulă.

### Bombe speciale
Se culeg ca bonus cu **3 încărcături**; se folosesc înaintea bombelor normale. Butonul de acțiune arată iconița bombei următoare; glisare în sus pe buton = schimbă tipul.
- **Gheață** — nu omoară; îngheață jucătorii atinși 2s (nu se mișcă, nu pun bombe). Un jucător înghețat moare normal dacă îl prinde o flacără → combo-uri. Apăsări repetate pe buton scurtează înghețul.
- **Flashbang / Întuneric** — nu omoară; jucătorii din rază văd ecranul întunecat 2.5s (doar propriul personaj și un cerc mic în jur rămân vizibile). La boți: reacție întârziată.
- **Otravă** — explozie normală + nor toxic pe pătrățelele atinse, 3s. Cine stă 1s în nor pierde o inimă. Norul blochează vizual parțial.

## Lăzi blestemate și pericole de mediu (implementate în prototip)
- **Ladă blestemată**: mov, crăpată, cu un mic craniu comic și o strălucire mov care pulsează (~3.5% din lăzi; ~3% în Infinit și din lăzile care reapar). Semnalizată ca să poată fi învățată și evitată — sau spartă intenționat lângă adversari.
- Spartă, după ~0.7s declanșează la întâmplare unul din blesteme, cu anunț roșu pe ecran:
  - **Păianjeni**: ies **2** păianjeni din ladă. Stau pe loc 1–1.4s (timp de reacție), apoi aleargă **cam cât un jucător la start** (≈3–3.4 pătrățele/s) spre cel mai apropiat jucător, cu mici ezitări. **Atingerea te omoară** — după ce omoară pe cineva, **păianjenul dispare** (scutul te salvează o dată și distruge păianjenul). **Nu pot trece de bombe** (se întorc din drum) și **mor în explozii**. Dispar singuri după 14s. Omoară pe oricine, inclusiv boți.
  - **Nori de furtună**: ies **2 norișori** care plutesc încet (≈1.5 pătrățele/s) pe culoare, pe jumătate la întâmplare, pe jumătate spre jucători. La fiecare ~2–3.5s un nor se oprește, **se încarcă 1.1s** (se înnegrește, clipește, ochi galbeni încruntați, scântei) și pe jos apare **zona de lovire în cruce, galbenă, care clipește** — ai timp să fugi. Apoi fulgerul lovește din nor în cruce (centru + 4 vecini): omoară, sparge lăzi, declanșează bombe; tunet, flash scurt, tremurat de ecran. Norii se risipesc după 14s. În 3D sunt nori pufoși cu umbră, iar zona de lovire apare pe podea.
- Boții văd păianjenii și zonele de lovire ale norilor ca zone periculoase și le ocolesc. Moartea apare ca „Prăjit de un păianjen!” / „Prăjit de fulger!”. Frecvență: ~2.5% din lăzi.
- Idei de extins: ceață, cutremur (lăzile se mută), liliac care fură bombe, bombă-cartof care se plimbă singură.

## Bonusuri negative (implementate în prototip)
Semnalizate clar: fundal roșu închis, **chenar roșu punctat** și **insignă roșie cu „−”**. ~17% din drop-urile obișnuite, 6 tipuri. Boții le ocolesc; jucătorul primește anunț roșu + vibrație.
- **Încetinit** — viteză −0.6 (minim 2.3).
- **Rază −1** (minim 1).
- **Bombă −1** (minim 1).
- **Comenzi inversate** 8s — mersul e oglindit; iconiță roșie ⇄ deasupra personajului și contor în bară.
- **Amețit** 10s — „boala” de beție: în 2D harta se **ondulează în valuri** (fâșii orizontale deplasate sinusoidal) și culorile pulsează; în 3D camera se **leagănă** (ruliu, tangaj, FOV care respiră). Steluțe care se rotesc deasupra capului, contor „Amețit Xs” în bară. Efectul se estompează în ultima secundă și e dezactivat la `prefers-reduced-motion`. Boții amețiți se mai împiedică în direcții aleatoare.
- **Sughiț de bombe** 6s — pui bombe involuntar la ~0.85s; iconiță roșie „!” și contor în bară.

## Bonusuri noi
- **Scut (implementat în prototip)** — durează max 10s și **se consumă la prima explozie** care te prinde (te salvează o dată, apoi dispare, cu 0.8s de invulnerabilitate ca aceeași flacără să nu te omoare imediat; anunț „Scutul te-a salvat!”); bulă albastră în jurul personajului (2D și 3D) care clipește în ultimele 2s, contor „Scut Xs” în bară. Expiră, nu e permanent. ~8% din drop-urile pozitive. În Infinit primești 3s de scut la fiecare respawn.
- **Inimă** (+1 inimă, maxim 3). Pierderea unei inimi dă 1.5s de invulnerabilitate cu clipire.
- **Blestem** — timp de 8s, raza bombelor tuturor adversarilor scade cu 1 (minim 1). Afișat cu iconiță deasupra lor.
- Idei de extins: **Magnet** (atrage bonusurile din jur), **Fitil scurt** (bombele tale explodează în 1.5s), **Frână** (adversarii −20% viteză pentru 6s).

Reglaj: frecvența de drop pentru bonusurile de control (gheață, flashbang, blestem) mai mică decât pentru cele clasice; configurabil per mod și dezactivabil în camere private.

## Personaje (brawleri)
Date în `packages/content`. Fiecare are: statistici de bază, o **abilitate pasivă** și un **Super** (se încarcă din lăzi sparte + lovituri).
Raritate: Comun · Rar · Epic · Legendar — raritatea aduce abilități mai neobișnuite, **nu** statistici mai mari.

**Implementat în prototip** (statistici, pasiv, înfățișare, mers, voce; Super-ul rămâne pentru Faza 4):
| Personaj | Raritate / preț | Statistici | Pasiv | Înfățișare | Mers | Voce (sintetizată) + replici |
|---|---|---|---|---|---|---|
| **Bubu** | Comun, gratuit | viteză 3.3, rază 1 | prima bombă din rundă e uriașă (+2 rază, desenată mai mare) | rotund, obraji roz | țopăie | „hi hi hi” (3 chicote înalte) |
| **Gugu** | Comun, gratuit | viteză 2.75, rază 2, **2 vieți**, corp 115% | a doua viață: supraviețuiește o lovitură (clipire 1.8s, „mai am o viață!”) | sprâncene groase, mustață | pași apăsați cu praf | „ho ho ho” grav |
| **Zuzu** | Comun, gratuit | viteză 4.0, max 5 bombe, corp 88% | cel mai rapid | bentiță roșie care flutură | fuge lăsând praf | „ii-haa!” |
| **Fifi** | Epic, 150 | viteză 3.45 | **magnet**: culege bonusurile pozitive din pătrățelele vecine | fundă roz, gene | se răsucește | fluierat |
| **Tanti Veta** | Epic, 150 | viteză 2.95, corp 105% | pornește cu **Mănușă** și **8s de scut** | batic cu flori, poșetă | legănat | „vai…” + „Vai de capul vostru!” |
| **Maestrul Fitil** | Legendar, 300 | viteză 3.2, rază 2 | **vede cronometrul** tuturor bombelor (cifre deasupra) | păr alb ciufulit, ochelari aurii | plutește | „mua-ha-ha” |
| **Robo-Mici** | Legendar, 300 | viteză 3.2 | **imun la boli** (încetinire, inversare, amețeală, sughiț); pornește cu Picior | corp pătrat metalic, antenă cu led, grilaj-gură | mers sacadat | „bip-bop” |
- Vocea personajului se aude când elimini pe cineva, când câștigi, când pierzi o viață; la moarte/victorie spune o replică proprie (speechSynthesis în prototip, înregistrări în final).
- Boții primesc personaje aleatoare, diferite de al tău; în 3D fiecare personaj are corpul și detaliile lui (mărime, mustață, bentiță, fundă, batic, păr, corp de robot).
- Ideile de Super din tabelul de mai jos rămân pentru Faza 4.

| Personaj | Raritate | Pasiv (idee inițială) | Super |
|---|---|---|---|
| Bubu | Comun | — | Bombă mare (rază +2, o dată) |
| Zuzu | Comun | Viteză de start +1 | Dash 3 pătrățele |
| Gugu | Comun | 2 vieți | Cutremur: împinge bombele din jur |
| Fifi | Epic | Bombe care ricoșează la șut | Cluster: 4 mini-bombe în cruce |
| Tanti Veta | Epic | Scut 1 lovitură/meci | Poșeta: aruncă o bombă peste tot ecranul |
| Maestrul Fitil | Legendar | Vede timerul bombelor | Oprește timpul pentru bombele lui 1.5s |
| Robo-Mici | Legendar | Lasă o capcană la moarte | Teleport pe orice portal |
| Nova | Epic | Bombele explodează **în arie**, nu în cruce (rază = raza bombei (crește cu bonusurile de rază), maxim 3; cercul ariei se vede deasupra stâlpilor și lăzilor; ocolește stâlpii, lăzile o opresc); fitil +0.5s, maxim 6 bombe | Supernova: bombă uriașă cu aria cu o treaptă peste plafon |
| Shade | Legendar | Cel mai rapid (185), maxim 5 bombe | Bomba fumigenă: la 3 pătrățele în față, nor de rază 3, 10s; cine e în fum nu se vede de la mai mult de 1 pătrățel, iar cine e în fum nu vede de departe (coechipierii se văd mereu) |

### Afinități de arenă
Fiecare arenă/temă dă bonusuri sau penalizări mici anumitor personaje, ca meciurile să nu fie identice:
- Exemple: în **Junglă** Zuzu +10% viteză (e „de-al locului”), Robo-Mici −10% viteză (ruginește). În **Cosmos** gravitație mică: bombele aruncate zboară +1 pătrățel pentru toți, Tanti Veta −1 rază. În **Neon** Maestrul Fitil vede și bombele altora cu 0.3s mai devreme.
- Statistici afectate: viteză, rază de start, bombe de start, **inimi** (vezi mai jos), timp de încărcare Super.
- **Inimi**: implicit 1 (o flacără = moarte, ca acum). Unele afinități dau +1 inimă (supraviețuiești unei flăcări, clipești 1.5s invulnerabil) sau un scut temporar.
- **Variație ușor aleatoare**: la începutul fiecărui meci se trage din seed-ul meciului un „eveniment de arenă” (ex. „Vânt din est: bombele șutate merg mai departe”, „Lăzi grase: 50% mai multe bonusuri”, „Ceață: vizibilitate redusă”). Anunțat pe ecran 2s la start.
- Reguli de balans: modificări mici (±10–15%, max +1 inimă), afișate înainte de meci pe ecranul de selecție, deterministe din seed (identice pe server și client), dezactivabile în meciurile clasate dacă strică echilibrul.

### Modul Persoana Întâi (FPS)
Aceeași lume pe grilă, văzută din ochii personajului (3D simplu: pereții și lăzile sunt cuburi, tema dă texturile). Aceleași reguli de bombe, flăcări și bonusuri; se schimbă doar perspectiva și mișcarea.
- **Arma**: aruncătorul de fitile. Tap = arunci bomba în arc unde țintești (vizibil un arc de previzualizare); ține apăsat = arunci mai departe. Bombele speciale (gheață, flashbang, otravă) funcționează la fel.
- **Mișcare**: continuă, nu pe pătrățele. Sărituri scurte peste bombe. Picior = șut în bombă cu privirea.
- **Controale pe mobil**: joystick stânga pentru mers, glisare pe jumătatea dreaptă pentru privire, buton de aruncare și buton de săritură; aim assist ușor. Pe desktop: mouse + WASD.
- **Harta**: minimapă în colț cu grila văzută de sus (important, altfel e greu de citit flacăra în cruce).
- **Flacăra în cruce** se vede ca un zid de foc care se întinde pe culoare; sunetul 3D arată din ce direcție vine.
- **Solo**: FFA 4–8 jucători, respawn cu scor pe timp (5 min) sau ultimul rămas.
- **Echipă**: 3v3 / 4v4 — Deathmatch pe echipe, și „Detonare”: o echipă pune bomba mare pe un obiectiv, cealaltă o dezamorsează.
- Fatalitățile se văd în **camera ucigașului** 1s (vederea de la persoana a treia), apoi revine perspectiva normală.

## Moduri de joc
- **Clasic (FFA 4)** — toți contra toți, ultimul rămas. Hartă adaptată la ecran.
- **1 vs 1 (implementat în prototip)** — arenă mică **pătrată 11×11**, doar 2 jucători (colțuri opuse). Ambii pornesc cu **aceleași 3 bonusuri alese la întâmplare** (corect pentru amândoi), anunțate la start. Lăzi aurii puțin mai dese.
- **Echipe 2v2 / 3v3 (implementat în prototip)** — echipele pe culori: **Albaștrii** (nuanțe de albastru) și **Roșii** (nuanțe de roșu); coechipierii au un inel în culoarea echipei. **Foc prieten oprit complet**: nici bombele coechipierilor, nici **propriile bombe** nu te rănesc. **Bombele au culoarea echipei** (albastru/roșu, în 2D și 3D) plus un inel colorat pe jos, ca să vezi dintr-o privire ale cui sunt. Echipele pornesc pe laturi opuse (stânga/dreapta; jocul e doar landscape). Câștigă echipa care rămâne cu cel puțin un jucător. Scor pe echipă în bară, cu buline pentru membrii vii/eliminați. Mesaj la moarte: „Echipa ta mai luptă”. În camere private, foc prieten comutabil.
- **Capturează steagul (3v3, implementat în prototip)** — fiecare echipă are un steag la baza ei (mijlocul laturii proprii, marcată cu un cerc în culoarea echipei; lăzile din jurul bazelor sunt curățate, iar culoarea dintre baze e mai liberă).
  - **Furi** steagul adversarilor trecând peste el; purtătorul e cu 15% mai lent și poartă steagul în spate.
  - **Capturezi** ducându-l pe tile-ul bazei tale **doar dacă steagul tău e acasă**.
  - Purtătorul eliminat **scapă steagul** pe loc; coechipierii proprietari îl **returnează instant** atingându-l, adversarii îl pot relua; revine singur acasă după 10s (cu numărătoare pe ecran).
  - **Nu se elimină echipe**: revii în joc după 3s la spawn, cu bonusurile resetate și 2s de scut.
  - Câștigă prima echipă la **3 capturi** sau cea cu mai multe capturi după **3 minute** (altfel egalitate). Foc prieten oprit, bombe colorate pe echipă.
  - Bara: capturi per echipă, „⚑!” când steagul echipei e în afara bazei, cronometru. Anunțuri pentru furt, scăpare, salvare, captură (confetti + moment de glorie pentru captura ta).
  - Boți: purtătorul fuge acasă; dacă steagul echipei e căzut, merg să-l salveze; dacă e purtat de un adversar, îl vânează; ultimul bot din echipă apără baza; restul atacă. Își sapă drum prin lăzi spre obiectiv.
- **Arena rotativă (implementat în prototip)** — toți contra toți pe o arenă pătrată 11×11 care **se rotește continuu** pe ecran (2D). Viteza crește gradual de la 4°/s la 14°/s (în ~90s), iar la fiecare 25s sensul se inversează lin (anunț pe ecran). Arena se scalează ca să încapă mereu în ecran la orice unghi. **Controalele sunt relative la ecran**: joystick-ul/săgețile se convertesc în direcția de pe grilă cea mai apropiată de unghiul curent (cu histerezis, fără tremurat la 45°), deci trebuie să-ți ajustezi continuu direcția. Boții joacă pe grilă, neafectați. În vederile 3D controalele sunt deja relative la cameră; se rotește doar minimapa.
- **Rânduri mobile (implementat în prototip)** — toți contra toți; la fiecare ~3.5–6.5s un **rând sau o coloană** (dintre cele fără stâlpi) e anunțat 1.6s cu **dungă roșie pulsantă și săgeți roșii** la capete, apoi **alunecă 3–6 pătrățele** (câte un pas la 0.34s, animat) în sensul săgeților, cu tot conținutul: lăzi (inclusiv aurii/blestemate), bonusuri, bombe; ce iese pe o parte intră pe cealaltă. **Jucătorii nu sunt cărați**: dacă o ladă intră în pătratul tău ești **împins** un pătrat înainte; dacă acolo e perete/altă ladă/bombă, ești **strivit** (animație turtită, mesaj „Strivit de rândul mobil!”). Scutul te salvează (sparge lada). Boții evită rândul anunțat.
- Modul se alege din ecranul de start sau din meniul de pauză (reîncepe runda).
- **Coroana** — cine ține coroana cel mai mult; coroana cade la moarte.
- **Cartoful fierbinte** — o bombă uriașă trece de la un jucător la altul prin atingere; explodează la 0.
- **Practice** — offline, contra boți (Ușor/Normal/Greu/Nebun), manechine de antrenament, tutorial interactiv în 6 pași, provocări (ex. „câștigă doar cu șuturi”, „5 lanțuri într-un meci”).
- **Provocarea zilei** — hartă cu seed zilnic, același pentru toți, clasament global.
- **Infinit** (vezi mai jos).
- **Camere private** cu cod de 4 litere, regulile alese de gazdă, locuri goale umplute cu boți.

### Misiuni (singleplayer, implementate în prototip)
Tu singur, fără jucători-boți, în lumea infinită (generată procedural), cu **bară de viață 0–100%** în loc de moarte la prima atingere.
- **Daune**: explozie/fulger −35%, păianjen −20%, urmate de 1.2s de invulnerabilitate (clipire), flash roșu, tremurat și vibrație. Scutul absoarbe o lovitură. La 0% → misiune eșuată. Momentul „bye bye” apare doar dacă lovitura te-ar omorî (viață ≤ 35%).
- **Inimă** (+25% viață) apare ca drop doar în misiuni (~14% din drop-uri).
- **Săgeată de obiectiv** la marginea ecranului (galbenă, cu distanța în metri), relativă la cameră în 3D; dispare când ești aproape.
- **Pericole**: păianjeni rătăcitori apar periodic în jur (max 3; 1 în Cursă), iar lăzile blestemate/aurii există ca în Infinit.
- **Stele 1–3** salvate local, afișate pe butoanele misiunilor; ecran de final cu timp, viață, criterii de stele, reîncercare și alegerea altei misiuni.

| Misiune | Obiectiv | ★★ | ★★★ |
|---|---|---|---|
| **Colecționar** | 10 cristale ascunse în lăzi obișnuite (5–20 pătrățele de start). Cristalul rămâne pe jos după spargere (nu îl distrug exploziile). | < 150s | < 100s și ≥ 50% viață |
| **Demolare** | 5 turnuri roșu-alb cu steag; 2 sunt **blindate** (2 explozii, buline de viață). | < 150s | < 100s și ≥ 50% viață |
| **Salvare** | 3 prieteni în cuști (înconjurate de lăzi); spargi cușca, prietenul te urmează; dacă îl prinde o explozie leșină 3s. Îi duci la **casa cu steag verde** (start). | < 180s | < 130s și ≥ 50% viață |
| **Cursă** | Steag cu carouri la 19–22 pătrățele, **60s**; lăzi mai rare (30%). | ≥ 15s rămase | ≥ 25s rămase |

Idei pentru următoarele: Livrare (bombă specială dusă cu mănușa la seif), Supraviețuire 90s, Puzzle cu bombe limitate, Cuib de păianjeni, Paratrăsnet; boși: Regina Păianjen, Norul-Tunet, Lada-Mamut, Dublura. Misiunile de puzzle/boss ar trebui să aibă arene fixe, construite de mână.

### Modul Infinit (tip „.io”)
**Varianta offline din prototip (implementată):**
- Tu ești mereu în **centrul ecranului**; când te miști, se mișcă harta (cameră care te urmărește lin). **Fără margini**: poți merge oricât, în orice direcție.
- Lumea e generată din coordonate (hash determinist): stâlpi pe pozițiile pare, lăzi ~50%, lăzi aurii ~3.5%. Memoria e o grilă circulară 64×64 care se **regenerează în jurul camerei** (rază 26), deci lumea e practic infinită cu memorie constantă. Zonele părăsite se regenerează când revii.
- Inamici peste tot: boți care apar la 9–15 pătrățele de tine (menținuți ~7 în jur) și dispar când rămân la > 24. **Cu cât ești mai departe de centru, cu atât sunt mai puternici** (rază, bombe, viteză, picior).
- La moarte: după 2.2s **revii aproape de locul unde ai murit** (3–9 pătrățele, pe un loc sigur: fără pericol de explozie, fără inamici la < 3 pătrățele), cu statisticile resetate și 3s de scut; locul se curăță în cruce. Centrul hărții nu mai e punct de respawn (se golește după un timp).
- Scor: eliminări ×100 + lăzi sparte ×10 + distanța maximă față de centru ×5. Bara arată Scor, Eliminări, Departe.
- Portalurile (după lanț de 4) apar în jurul tău; aruncarea cu mănușa nu mai face wrap (nu există margini).
- În 3D: pereții, podeaua și umbrele urmăresc camera (randare doar în jurul jucătorului, restul ascuns de ceață).

**Varianta online (implementată în Faza 7, D-070 – D-072; fără boți și fără recompense încă):**
- Hartă mare generată procedural pe **chunk-uri** 32×32 (seed de server), extinsă pe măsură ce jucătorii o explorează; chunk-urile goale se reciclează.
- 30–80 jucători pe instanță, **drop-in/drop-out**, respawn după 3s cu upgrade-urile pierdute.
- Scor = eliminări + lăzi sparte + timp supraviețuit; la moarte îți scapi 50% din bonusuri pe jos (încurajează vânătoarea).
- Cu cât ai scor mai mare, cu atât ești mai vizibil (coroană, aură) → ținta tuturor.
- Clasament live top 10 + minimapă.
- Tehnic: **interest management** — serverul trimite doar entitățile din chunk-urile din jurul jucătorului; instanțe (shard-uri) separate când se umplu.

## „Bye bye” — momentul fără scăpare (implementat în prototip)
- Când **nu mai ai nicio cale de scăpare** (ești în raza unei bombe care va exploda și niciun drum nu duce la un loc sigur; fără picior/mănușă care să te salveze, fără scut), jocul detectează automat situația.
- **Slow-motion** (40%), **zoom mare** pe personaj (2D: până la 2.4×, centrat pe tine; 3D: cameră cinematică în fața personajului, peste obstacole).
- Personajul **se uită trist la bombă**, apoi **se întoarce spre tine** (sprâncene triste, gură în jos, strop de transpirație) și apare un balon de vorbire **„bye bye…”** + voce „Bye bye!” — apoi explozia.
- Dacă scapi totuși (ex. bomba e șutată de altcineva), momentul se anulează.
- Detecția ignoră bombele cu detonator care nu sunt pe cale să explodeze și, în echipe, bombele propriei echipe.

## Momente de glorie (implementate în prototip)
Același sistem cinematic ca „bye bye”, dar pentru momente bune: **zoom pe personaj** (2D ~2.1×, 3D cameră în față), **față fericită** (ochi ^^ și zâmbet), **balon de vorbire auriu** cu o replică comică + voce, sunet de victorie și vibrație.
| Declanșator | Animație | Replici (exemple) |
|---|---|---|
| Atingi **viteza maximă** | linii de viteză în spate, picioare care se învârt, tremurat | „Sunt fulger!”, „Frânele sunt opționale.” |
| Atingi **8 bombe** | jonglezi cu 6 bombe mici care se rotesc în jurul tău | „Cine vrea artificii?”, „Magazinul de bombe: deschis!” |
| Atingi **raza maximă** | aură de flăcări în culorile temei | „Raza mea acoperă tot!”, „Până la orizont!” |
| **Câștigi runda** (sau echipa ta) | sărituri de bucurie, coroană, confetti; în echipe sărbătorește un coechipier dacă tu ai murit | „Sunt legendă!”, „Aplauze, vă rog!”, „Muncă de echipă!” |
- La maxime: slow-motion 30% timp de ~1.7s (nu poți fi luat prin surprindere complet, dar e scurt). La victorie nu e slow-motion; ecranul de final apare după moment.
- „Bye bye” are prioritate: dacă ești prins fără scăpare, momentul de glorie se oprește.
- Replicile stau în `packages/content` (localizabile), iar în versiunea finală pot veni din pachetele de voce cosmetice.

## Fatalități
Animație comică scurtă (≤1.2s, nu blochează jocul) jucată pe victimă, aleasă de **ucigaș** din colecția lui. La ultima eliminare din rundă: slow-motion + zoom 1s.
Exemple (toate originale, cartoon, fără sânge):
- **Rachetă** — victima e lansată pe cer, dispare ca o stea care sclipește.
- **Clătită** — cade o nicovală, victima devine plată și se dezlipește de pe ecran ca un sticker.
- **Popcorn** — victima pocnește în floricele, care cad pe jos.
- **Fantomița** — iese un fantomaș care cântă la harpă și plutește în sus.
- **Balonul** — se umflă și zboară dezumflându-se haotic cu sunet de pârț de balon.
- **Pui la rotisor** — se rumenește, se învârte, „ding!” de cuptor.
- **Arhivat** — victima e pusă într-un dosar și ștampilată „RESPINS”.
Fatalitățile au raritate și se deblochează din battle pass / magazin.

## Cosmetice
- **Skin-uri** per personaj (culori, costume, efecte de pas).
- **Pachete de voce** — țipete și replici la moarte/victorie (inspirate de farmecul jocurilor vechi, dar înregistrate de noi). Idee: concurs în comunitate cu voci trimise de jucători (cu acord de licență).
- **Skin-uri de bombă**, **urme de flacără**, **emote-uri**, **fatalități**, **teme de arenă** (Clasic, Neon, 8-Bit, Cosmos, Cuburi, Junglă + teme de eveniment, vezi mai jos).

## Magazin și monede (implementate în prototip)
- **Monede** (salvate local): +1 per ladă spartă de tine, +5 per eliminare, +5 la finalul fiecărei runde, +25 victorie (+20 victorie de echipă), +10 per captură de steag, +15 per stea în misiuni, **+50 bonus zilnic** la prima partidă din zi. Start: 100 monede. Afișate în bară și la finalul rundei („+X monede · total Y”).
- **Personaje**: Bubu, Gugu, Zuzu gratuite; Fifi și Tanti Veta 150; Maestrul Fitil și Robo-Mici 300. Ecran „Personaje” cu previzualizare animată, descriere, bare de statistici, buton „Ascultă” (vocea + replica) și Alege/Cumpără.
- **Magazin** pe categorii, cu previzualizare animată pe personajul tău; cumperi o dată, apoi echipezi/scoți oricând:
  - Culori: Verde (gratuit), Roșu aprins 40, Violet 40, Negru 80, Auriu 120, Curcubeu 200 (animat). În echipe se folosește culoarea echipei.
  - Pălării: Șapcă 50, Coif de petrecere 60, Joben 80, Pălărie de cowboy 90, Coroană 200 (înlocuiesc pălăria temei).
  - Accesorii: Mustață 40, Fular 50, Ochelari de soare 60.
  - Bombe: Bomboană 70, Pepene 80, Craniu 100, Disco 150 (și în 3D, ca culoare).
  - Urme la mers: Steluțe 60, Bule 60, Inimioare 60, Flăcări 90.
  - Voci (înlocuiesc vocea personajului, cu replici proprii): Pisică 80, Pirat 100, Operă 120.
- Totul e cosmetic; avantajele vin doar din alegerea personajului (fiecare cu compromisuri). Boost-urile plătite cu monede rămân de adăugat doar pentru misiuni/Infinit.

## Progres & economie
- Trofee per personaj; ligi sezoniere (resetare parțială).
- Battle pass sezonier (gratuit + premium); misiuni zilnice/săptămânale.
- Monede: **Fitile** (câștigate jucând) și **Gemuri** (cumpărate). Magazin rotativ zilnic.
- **Fără cutii plătite cu recompense aleatoare** (reglementate/interzise în unele țări). Doar cumpărare directă + battle pass.

## Teme de eveniment (implementate în prototip)
Fiecare temă schimbă podeaua, pereții, lăzile, bombele (2D și 3D), pălăria personajelor, flăcările, portalul, muzica și efecte ambientale. Tema de sezon e aleasă automat dacă jucătorul n-a ales alta și e marcată „sezon” în listă; celelalte au eticheta „eveniment”.
| Temă | Perioadă (auto) | Podea / pereți / lăzi | Bombă | Personaje | Ambient & culori |
|---|---|---|---|---|---|
| **Halloween** | 1 oct – 5 nov | iarbă mov-închis cu frunze / pietre de mormânt / dovleci (unii sculptați) | bombă neagră cu față de dovleac luminoasă | pălărie de vrăjitoare | lilieci, ceață mov, flăcări verzi-fantomatice, muzică minoră cu ecou, cer 3D întunecat |
| **Crăciun** | 1 dec – 6 ian | zăpadă / blocuri de gheață cu zăpadă / cadouri colorate cu fundă | glob de brad roșu cu bandă albă și agățătoare aurie | căciulă de Moș Crăciun | ninsoare, flăcări roșu-auriu, muzică veselă cu clopoței |
| **Valentine** | 1 – 15 feb | carouri roz cu inimioare / blocuri cu inimi / cutii-inimă cu fundă | bombă în formă de inimă | antene cu inimioare | inimioare care plutesc, flăcări roz, muzică lentă |
| **Școala** | septembrie | foaie de caiet dictando cu margine roșie / teancuri de cărți / cutii cu creioane | măr cu frunză (codița e fitilul) | tocă de absolvent + ochelari | avioane de hârtie, muzică săltăreață |
- În versiunea finală: evenimente limitate în timp cu recompense cosmetice (skin-uri, bombe, fatalități tematice), misiuni de eveniment și pass de eveniment.

## Viralitate
- Buton „Salvează clipul” — ultimele 10s ca video scurt vertical, cu watermark, gata de TikTok/Reels.
- Reluări ale fatalităților.
- Link de invitație în cameră privată (deep link în aplicație).
- Recompensă pentru prieteni invitați (cosmetic, nu putere).
