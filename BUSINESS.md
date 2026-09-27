# Fitil — Business, lansare, monetizare

> Estimări orientative, nu consultanță juridică sau financiară. Cifrele se recalibrează după soft launch.

## 1. Copyright și mărci
- **Mecanica de joc nu e protejată** (bombe pe grilă, flacără în cruce, bonusuri). Protejate sunt: nume, mărci, personaje, grafică, sunete, muzică, texte.
- **Nu folosi „Bomberman”** (marcă Konami) sau nume/personaje din alte jocuri în: numele aplicației, descriere, cuvinte cheie din store, reclame. Magazinele resping aplicațiile care folosesc nume de jocuri cunoscute (keyword stuffing).
- Temele de arenă nu imită jocuri existente (Mario, Minecraft, Pokémon, Among Us, Brawl Stars etc.). Doar stiluri generice (Neon, 8-Bit, Cosmos, Cuburi, Junglă).
- Asset-uri: doar originale, procedurale sau CC0, cu sursa în `assets/CREDITS.md`. Licențe actuale: Three.js (MIT), Phaser (MIT), fonturi Google (OFL) — toate permit uz comercial.
- Voci/pachete de voce trimise de comunitate: doar cu acord scris de licență.
- **Înainte de lansare**: verificare nume ca marcă (EUIPO, OSIM, USPTO), eventual înregistrare marcă; rezervare domeniu și conturi sociale.

## 2. Tehnologie: web împachetat (Capacitor), nu nativ
- Jocul 2D/3D ușor rulează bine în WebView pe telefoane din ultimii 4–5 ani. Precedent: *Vampire Survivors* a pornit ca joc Phaser.
- Nativ prin pluginuri: haptics, plăți în aplicație (RevenueCat), notificări push, Sign in with Apple/Google, deep links.
- Avantaj major: **același joc rulează ca link în browser** → invitații în cameră fără instalare (motor de viralitate), apoi îndemn la instalare.
- Riscuri de urmărit: latență audio pe unele Android-uri, performanță 3D pe telefoane slabe (setare de calitate), App Store Review (aplicația trebuie să fie completă, nu „un site împachetat”).
- Pragul pentru a trece pe Unity/Godot: 3D greu, zeci de entități animate pe ecran sau performanță sub 45 fps pe Android mediu după optimizări.

## 3. Monetizare
Model: **free-to-play**, fără pay-to-win.
- **Cosmetice** (skin-uri, fatalități, pachete de voce, skin-uri de bombă, emote-uri, teme de arenă) — magazin direct + rotativ zilnic.
- **Battle pass** sezonier (~6–8 săptămâni): pistă gratuită + premium (~5 €).
- **Reclame recompensate, opționale** (vezi clip → monede / dublează recompensa de meci), niciodată în mijlocul meciului. Achiziție „fără reclame”.
- Pachete de pornire (starter pack) cu discount, o singură dată.
- **Interzis**: cutii plătite cu recompense aleatoare (restricționate/interzise în unele țări UE); afișare clară a prețurilor.
- Comision magazine: 15% prin programele pentru dezvoltatori mici (sub 1 mil. $/an), apoi 30%. Plăți prin SRL; TVA/facturare gestionate de magazine ca revânzător (de verificat cu contabilul).

## 4. Costuri de funcționare (estimări)
| Categorie | Cost |
|---|---|
| Apple Developer | 99 $/an |
| Google Play | 25 $ o singură dată |
| Servere de joc + API + DB, la început | 20–100 €/lună |
| Servere la ~10k jucători activi/zi | 200–500 €/lună |
| Servere la ~100k jucători activi/zi | 1.000–3.000 €/lună |
| Grafică profesională (personaje, skin-uri, iconiță, capturi store) | 3.000–15.000 € inițial (freelanceri) |
| Sunete/voci/muzică (opțional, dacă nu rămân sintetizate) | 500–3.000 € |
| Politică de confidențialitate, termeni, contabilitate | câteva sute €/an |
| Analytics / crash reporting | gratuit la început (PostHog, Sentry) |
| Marketing plătit (user acquisition) | 0,5–3 $ / instalare în UE/SUA — **doar după ce retenția e bună** |

## 5. Scenarii de venit (primul an după lansare)
Ipoteză: venit mediu 0,03–0,10 $ per jucător activ pe zi (tipic pentru jocuri de acțiune free-to-play).

| Scenariu | Descărcări | Jucători activi/zi | Venit brut/an | Observații |
|---|---|---|---|---|
| Pesimist (cel mai frecvent) | 5–20 mii | 100–500 | 1–10 mii $ | de regulă pe pierdere după costuri |
| Realist | 100–300 mii | 3–10 mii | 50–250 mii $ | joc bun + tracțiune organică (TikTok, prieteni) |
| Optimist | 2–5 milioane | 100 mii+ | 2–5 milioane $ | devine viral; rar |

### Ținte de retenție pentru decizii (soft launch)
| Metrică | Ținta minimă | Bun |
|---|---|---|
| Revin a doua zi (D1) | 35% | 40%+ |
| Revin după 7 zile (D7) | 12% | 15%+ |
| Revin după 30 zile (D30) | 5% | 8%+ |
| Tutorial terminat | 70% | 85%+ |
| Durată medie sesiune | 8 min | 12 min+ |

Regulă: **nu se cheltuie pe marketing plătit** până nu sunt atinse țintele minime D1 și D7. Sub ținte → iterații pe gameplay, onboarding și primele 10 minute.

## 6. Viralitate — ce trebuie să aibă
- **Joacă cu prietenii în 10 secunde**: link de invitație → intră direct în cameră, fără cont, chiar din browser.
- **Momente distribuibile**: buton „Salvează clipul” (ultimele 10s, video vertical cu watermark), reluări de fatalități, țipete comice.
- **Identitate proprie**: personaje și voci memorabile, bune de meme; nume ușor de ținut minte.
- **Pentru creatori**: camere private cu reguli custom, editor de hărți cu coduri, mod spectator/streamer.
- **Provocarea zilei** cu clasament global și între prieteni.
- **Evenimente sezoniere**, recompense cosmetice pentru prieteni invitați.
- **Devlog pe TikTok/Reels/Shorts** din timpul dezvoltării (clipuri scurte din prototip): marketing gratuit + test de interes înainte de lansare. Pagină de pre-înregistrare în Google Play.
- Cerințe mici de hardware, descărcare mică (< 100 MB), pornire rapidă.
