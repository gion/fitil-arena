# Test de multiplayer cu oameni reali

Testele automate (4 clienți headless, două browsere în Playwright, latență simulată) trec. Ce lipsește: meciuri între oameni, pe telefoane, pe rețele reale. Sesiunea de mai jos durează ~45 de minute, cu 2–4 oameni.

## Pregătire

- Serverul public pornit (`docs/deploy.md`); `curl https://api.DOMAIN/health` răspunde `ok`.
- Fiecare tester deschide `https://DOMAIN/?net=1` pe telefon (sau aplicația, cu Settings → **Network stats** pornit). În colțul din stânga sus apare, în meciurile online: `ping · buf · in · desync`.
  - **ping**: dus-întors până la server, în ms (roșu peste 200 ms sau la conexiune căzută);
  - **buf**: cadre primite și încă neafișate (normal 0–2);
  - **in**: input-uri trimise și neconfirmate (≈ ping / 50 ms);
  - **desync**: trebuie să rămână **0**.
- Cu cheie PostHog în build, fiecare meci trimite `match_end` cu `ping_avg`, `ping_p95`, `ping_max`, `drops`, `desyncs`, `resyncs`.
- Telefoane diferite dacă se poate: un Android mediu (2–3 ani), un iPhone, unul pe Wi-Fi, unul pe 4G/5G.

## Scenarii

Bifează și notează ping-ul văzut. La orice problemă: captură de ecran cu overlay-ul vizibil + ora.

| #   | Scenariu                                                                  | Ce trebuie să se întâmple                                                               | ✓ / notă |
| --- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | -------- |
| 1   | A creează camera (Online → Create), trimite linkul prin SHARE pe WhatsApp | B deschide linkul și ajunge direct în cameră, fără să tasteze codul                     |          |
| 2   | C intră cu codul de 4 litere                                              | apare în lobby la toți                                                                  |          |
| 3   | Gazda schimbă modul, tema, boții                                          | ceilalți văd schimbarea imediat                                                         |          |
| 4   | Meci FFA complet, toți pe Wi-Fi                                           | mișcarea proprie răspunde imediat; desync 0; finalul apare la toți                      |          |
| 5   | Meci pe echipe, un jucător pe 4G                                          | se poate juca; notează ping-ul și dacă „trece prin flăcări” (D-031)                     |          |
| 6   | În meci, un jucător trece de pe Wi-Fi pe 4G                               | banner „Reconnecting”, apoi revine în ≤ 15s și meciul continuă                          |          |
| 7   | Un jucător pune aplicația în fundal 5s, apoi revine                       | revine în meci (sau, după 15s, locul lui e preluat de un bot)                           |          |
| 8   | Un jucător închide aplicația de tot                                       | ceilalți continuă, locul lui devine bot                                                 |          |
| 9   | „Back to the room” după final, apoi încă un meci (revanșă)                | camera rămâne, al doilea meci pornește normal                                           |          |
| 10  | Quick Play (camera publică) cu 2 jucători                                 | se găsesc și meciul pornește singur                                                     |          |
| 11  | Infinite World online cu 2+ jucători                                      | se văd unul pe altul; notează dacă mișcarea pare întârziată (fără predicție în Infinit) |          |
| 12  | Android mediu, meci întreg în 2D apoi în 3D                               | fără sacadări vizibile; sunetul nu întârzie                                             |          |
| 13  | Un tester joacă din browser, altul din aplicație                          | aceeași cameră, totul ca mai sus                                                        |          |

## După sesiune

- Notează în `docs/progress.md` (secțiunea testelor de rețea): telefoanele, rețelele, ping-urile tipice, problemele, cu capturi în `docs/screens/mp-test/`.
- Ce urmărim în mod special, pentru deciziile deschise:
  - D-031: la 100–200 ms, se simte nedrept că flăcările vin cu întârziere? Dacă da: predicție și pentru bombe/flăcări.
  - Infinit fără predicție: e greoi? Dacă da: predicția jucătorului local și acolo.
  - Reconectarea: 15s ajung la o schimbare de rețea?
