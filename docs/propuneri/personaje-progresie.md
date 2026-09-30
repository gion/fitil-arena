# Propunere: personaje care cresc, abilități semnătură, magazin și monetizare

> Stare: **aprobată cu variantele recomandate** (2026-09-30, D-034 – D-036); implementat: rarități, cele 11 personaje cu semnături, încărcări, XP/niveluri cu recompense cosmetice, pagina personajului, magazinul. Rămân pentru Faza 4: Ultimate, perk-uri; pentru Faza 6: server ca sursă de adevăr, normalizare în clasat; pentru Faza 9: Gemuri și bani reali.
>
> Propunerea inițială (2026-09-30). Pornește de la ideile proprietarului (mesajul din 2026-09-30, vezi `docs/prompt-log.md`) și de la Faza 2c, deja scrisă în `PLAN.md` / `GAME_DESIGN.md` (7 personaje, monede, magazin cosmetic, implementate în `reference/prototype.html`).
> Nu modifică `PLAN.md` / `GAME_DESIGN.md` (rămân identice cu proiectul claude.ai). După ce deciziile de la final sunt luate, textul aprobat se mută acolo.

## 1. Ce vrem să obținem

- Să ai **motiv să încerci alt personaj**: fiecare are ceva competitiv sau amuzant pe care nu-l are altul (o „semnătură”), plus un **Ultimate**.
- Să ai **motiv să revii**: personajele tale cresc (XP, niveluri), deblochezi lucruri pe drum, ai obiective zilnice.
- Să existe **ceva de cumpărat** (monede, personaje, cosmetice), fără să strici corectitudinea meciurilor online. Asta decide dacă jocul rezistă în recenzii și în magazine.
- Personajele să fie **memorabile**: raritate vizibilă (Comun → Mitic), voce, sunete, mers, animații, replici proprii, și o pagină de prezentare în care le vezi de aproape și le auzi.

## 2. Tensiunea principală: progres vs. pay-to-win

`BUSINESS.md` §3 spune „free-to-play, **fără pay-to-win**”. Ideile noi („cumperi monede → cumperi un personaj”, „XP → abilități mai mari”) împing spre putere cumpărată. Recenziile („pay to win”), echilibrul în meciurile online și clasamentele au de suferit dacă un Mitic de nivel 10 e pur și simplu mai puternic.

Propunerea mea (**varianta B** de mai jos) păstrează senzația de creștere, dar limitează puterea:

| Variantă                                         | Ce dă nivelul                                                                                               | Ce se poate cumpăra cu bani reali                                                 | Risc                                                   |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------ |
| A. Totul cosmetic                                | doar cosmetice, titluri, animații                                                                           | cosmetice, personaje (sidegrade)                                                  | progres mai puțin „simțit”                             |
| **B. Sidegrade + putere plafonată (recomandat)** | **opțiuni**, nu cifre mai mari: sloturi de perk, variante de Ultimate, cosmetice; statistici +0–5% plafonat | monede (Gemuri), personaje direct, cosmetice, battle pass; **niciodată nivel/XP** | mic; în clasat se poate normaliza nivelul              |
| C. Putere care crește liber                      | +statistici la fiecare nivel                                                                                | și XP / niveluri                                                                  | pay-to-win clar, recenzii proaste, nebalansabil online |

Reguli propuse pentru varianta B:

- Raritatea aduce abilități **mai neobișnuite**, nu cifre mai mari (deja în `GAME_DESIGN.md`). Un Mitic e mai spectaculos și mai greu de stăpânit, nu mai puternic.
- XP-ul se câștigă **doar jucând** cu acel personaj; nu se vinde.
- În meciurile **clasate** (Faza 6) statisticile se normalizează la un nivel fix; nivelul contează doar pentru ce ai deblocat (perk-uri, cosmetice). În casual, misiuni și Infinit contează nivelul real (plafonat).
- Orice personaj cumpărabil cu bani e cumpărabil și cu monede câștigate jucând, într-un timp rezonabil (ex. un Epic ≈ 1 săptămână de joc normal).

## 3. Raritate și roster

Raritățile propuse: **Comun · Rar · Epic · Legendar · Mitic** (culori: gri, albastru, violet, auriu, roșu-curcubeu animat). Raritatea se vede peste tot: rama cărții, aura din lobby, animația de intrare în meci, sunetul la selectare.

Rosterul existent (Faza 2c) + propuneri noi, fiecare cu **semnătură** (ce are doar el) și **compromis** (ce are mai prost). Toate numele sunt de lucru, originale:

| Personaj              | Raritate | Semnătură (permanentă)                                              | Compromis                                  | Ultimate (idee)                                                                          |
| --------------------- | -------- | ------------------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Bubu                  | Comun    | prima bombă din rundă e uriașă                                      | nimic special altfel                       | Bombă mare (+2 rază, o dată)                                                             |
| Gugu                  | Comun    | 2 vieți, corp mare                                                  | cel mai lent                               | Cutremur: împinge bombele din jur                                                        |
| Zuzu                  | Comun    | cel mai rapid                                                       | maxim 5 bombe                              | Dash 3 pătrățele                                                                         |
| **Fotbalistul** (nou) | Rar      | **Picior permanent**; șuturile merg mai departe și ricoșează o dată | nu poate ridica bombe (fără Mănușă)        | „Penalty”: șutează toate bombele din linia privirii                                      |
| Fifi                  | Epic     | magnet pentru bonusuri                                              | corp mic, rază 1                           | Cluster: 4 mini-bombe în cruce                                                           |
| Tanti Veta            | Epic     | Mănușă permanentă, scut 8s la start                                 | lentă                                      | Poșeta: aruncă o bombă peste tot ecranul                                                 |
| **Bucătarul** (nou)   | Epic     | bombele lui lasă 2s de „ulei” care alunecă pe cine calcă            | bombele lui au fitil +0.3s                 | „Tigaia”: întoarce o bombă înapoi spre cel care a șutat-o                                |
| Maestrul Fitil        | Legendar | vede cronometrul bombelor                                           | rază de start 2, dar maxim 6 bombe         | Oprește timpul bombelor lui 1.5s                                                         |
| Robo-Mici             | Legendar | imun la boli, Picior la start                                       | nu poate lua Scut                          | Teleport pe orice portal                                                                 |
| **Fantoma** (nouă)    | Mitic    | trece prin **o** ladă pe rundă (se reîncarcă la 20s)                | 1 viață, nu poate lua inimi                | „Bau!”: 2s invizibil pentru ceilalți (vizual; online are nevoie de filtrare, vezi D-030) |
| **Magicianul** (nou)  | Mitic    | o dată pe rundă transformă o bombă a altcuiva într-un porumbel      | bonusurile pozitive îi durează la jumătate | „Truc”: schimbă locul cu un adversar                                                     |

Fiecare personaj are, ca date în `packages/content`: statistici, semnătură, compromis, Ultimate, voce (sintetizată acum, înregistrată mai târziu), 3–5 replici (moarte, victorie, eliminare, Ultimate), mers, animație de intrare, animație de victorie, un sunet propriu la pas / la bombă. Pentru boți: personaje aleatoare, cum e deja în prototip.

## 4. Bonusurile din arenă: mai puține sau care expiră

Ideea ta cu fotbalistul se generalizează frumos: **ce are un personaj ca semnătură e permanent la el; la ceilalți, același bonus luat din arenă e temporar.**

Propunere concretă (configurabilă per mod, ca să poată fi testată):

- **Bonusuri de abilitate** (Picior, Mănușă, Detonator, Linie): din arenă vin **cu încărcări** — Picior 3 șuturi, Mănușă 3 aruncări, Detonator 2 detonări, Linie 2 folosiri. Contorul se vede pe iconița din bară. Personajul cu semnătura respectivă le are nelimitat.
- **Bonusuri de statistică** (Bombă+, Rază+, Viteză+): rămân permanente în rundă (sunt baza genului), dar **mai rare** (−30% drop) în modurile cu personaje; aurii rămân „MAX” permanente.
- **Bonusurile negative și Scutul**: deja expiră (neschimbat).
- Moduri „Clasic” fără personaje (toți identici, bonusuri ca acum) rămân disponibile — pentru cine vrea jocul original și pentru camerele private.

De decis prin teste, nu pe hârtie: bench-ul din Faza 4 (rata de victorie per personaj 18–32%) se rulează pe ambele variante.

## 5. Creșterea personajelor (XP și niveluri)

- **XP per personaj**, doar jucând cu el: +10 pe meci terminat, +5 per eliminare, +3 per ladă (plafonat pe meci), +20 victorie, +XP dublu la primul meci din zi cu acel personaj.
- **Niveluri 1–10** (curba: nivelul 10 ≈ 60–80 de meciuri). Ce dă fiecare nivel (varianta B):
  - 2: replică nouă · 3: culoare exclusivă · 4: **primul perk** (alegi 1 din 2) · 5: animație de victorie · 6: al doilea slot de Ultimate (variantă) · 7: urmă exclusivă · 8: **al doilea perk** · 9: pălărie exclusivă · 10: rama „Maestru” + titlu + efect la intrare.
  - **Perk-urile** sunt alegeri mici cu compromis, nu plusuri curate: ex. Fotbalistul „șut mai lung, dar mai lent la întoarcere” sau „șut mai scurt, dar ricoșează de două ori”.
  - Statistici: cel mult +5% total la nivelul 10, și normalizate în clasat (vezi §2).
- **Maestrie**: 3 provocări per personaj („câștigă 5 meciuri cu Ultimate-ul”, „elimină 3 cu bombe șutate”) → monede + insignă.

## 6. Ultimate

E Super-ul din Faza 4, redenumit (sau păstrăm „Super”, de decis): bara se încarcă din lăzi sparte, eliminări și bonusuri luate; se declanșează cu un buton separat; are anunț, sunet și animație proprii (în stilul „momentelor de glorie”). Online e o acțiune în `Input`, deci funcționează cu sincronizarea din Faza 3 fără schimbări de protocol.

## 7. Pagina personajului

Un ecran per personaj (din lista „Personaje”):

- **Close-up 3D** pe o platformă care se rotește (glisare pentru rotire, dublu tap pentru animația de victorie); în 2D, portretul mare animat.
- **Ascultă**: vocea + o replică la alegere; butoane pentru sunetele lui (pas, bombă, Ultimate).
- **Plusuri / minusuri** în două coloane clare (verde / roșu), bare de statistici comparate cu media.
- **Semnătura și Ultimate-ul** cu un clip scurt (redare din sim, fără video: un mini-meci scriptat determinist pe o hartă mică).
- **Progres**: nivel, XP, ce deblochezi la următorul nivel, perk-urile alese, provocările de maestrie.
- **Încearcă-l**: un meci Practice cu personajul, chiar dacă nu-l ai (vezi rotația de mai jos).
- Cumpărare: preț în monede și/sau Gemuri, fără cutii aleatoare.

## 8. Economie și monetizare

- **Două monede** (deja în `GAME_DESIGN.md` §Progres): **Fitile** (câștigate jucând, ce e în prototip ca „monede”) și **Gemuri** (cumpărate cu bani; se câștigă și puține jucând, din battle pass și maestrie).
- **Cumpărare directă**, fără aleatoriu: personaje (Fitile sau Gemuri), cosmetice, pachete tematice, battle pass. **Fără cutii plătite cu recompense aleatoare** (regula din `BUSINESS.md`).
- Prețuri orientative (de calibrat): Rar 300 Fitile / 100 Gemuri, Epic 900 / 250, Legendar 2.000 / 500, Mitic 4.000 / 900 (sau Mitic doar în battle pass / eveniment, ca să rămână rar).
- **Rotație gratuită**: 2 personaje pe săptămână se pot juca gratuit (XP-ul rămâne dacă îl cumperi apoi) — principalul motor pentru „să vrei să încerci alt jucător”.
- Starter pack o dată (un Epic + Gemuri) și reclame recompensate opționale, doar în afara meciului (deja în `BUSINESS.md`).
- Tot ce ține de **bani reali** (produse în store, RevenueCat, validare pe server, prețuri, texte legale) rămâne în **Faza 9**, cu checkpoint uman. Până atunci Gemurile nu există sau sunt doar de test.

## 9. Ce ne ține în priză (bucle)

- **Sesiune**: meci → XP + Fitile pe personaj → bară de nivel aproape plină („încă un meci”).
- **Zi**: bonus zilnic, 3 misiuni zilnice (unele cer personaje diferite: „câștigă cu un Epic”), rotația săptămânală.
- **Săptămână / sezon**: battle pass, maestrie, un personaj nou sau un eveniment la 4–6 săptămâni.
- **Social**: în lobby-ul camerelor private (Faza 3) se vede personajul și nivelul fiecăruia; replicile personajelor ajung în clipurile distribuite.

## 10. Impact asupra planului

- **Faza 2c** (din `PLAN.md`): se implementează cum e scrisă (7 personaje cu pasive, monede locale, magazin cosmetic), cu două adăugiri ieftine: rarități vizibile și pagina personajului (fără XP). Ordinea din `PLAN.md` o pune înaintea Fazei 3, care e deja gata — propun să o facem acum, înainte de Faza 4.
- **Faza 4**: Ultimate (Super), semnăturile noi, bonusuri cu încărcări, bench de balans pe personaje. Personajele noi (Fotbalistul, Bucătarul, Fantoma, Magicianul) aici.
- **Faza 5**: animațiile de intrare/victorie, close-up-ul 3D, sunete per personaj.
- **Faza 6**: XP, niveluri, perk-uri, maestrie, rotația — pe server (sursa de adevăr), cu normalizare în clasat.
- **Faza 9**: Gemuri, prețuri, starter pack, battle pass (bani reali, checkpoint).

## 11. Decizii necesare (și în `docs/questions.md`, Q-004 – Q-008)

1. **Q-004** Cât de departe merge puterea din progres: A (doar cosmetic), **B (sidegrade + plafonat, recomandat)** sau C (putere liberă)? Varianta C contrazice `BUSINESS.md` §3.
2. **Q-005** Bonusurile de abilitate din arenă devin cu încărcări (Picior 3 șuturi etc.) în toate modurile, sau doar în modurile cu personaje, păstrând un mod „Clasic”?
3. **Q-006** Rarități: adăugăm **Rar** și **Mitic** la cele 3 existente (Comun/Epic/Legendar)? Miticele se vând sau doar se câștigă (battle pass / evenimente)?
4. **Q-007** Personajele noi propuse (Fotbalistul, Bucătarul, Fantoma, Magicianul) — da / nu / altele? Ce nume finale (țin de direcția artistică)?
5. **Q-008** „Ultimate” sau „Super” ca nume în joc? (Textele jocului sunt în engleză, D-028: „Ultimate” / „Super”.)
