# Plăți reale: configurare (Faza 9)

Codul e gata (D-082, D-083). Ca să se poată cumpăra pe bune, mai trebuie conturile și produsele. Totul de mai jos ține de tine (conturi, bani, prețuri).

## Ce se vinde

| Produs (id în store) | Tip            | Dă                                            | Preț provizoriu |
| -------------------- | -------------- | --------------------------------------------- | --------------- |
| `gems_100`           | consumabil     | 100 Gemuri                                    | €0.99           |
| `gems_550`           | consumabil     | 550 Gemuri                                    | €4.99           |
| `gems_1200`          | consumabil     | 1200 Gemuri                                   | €9.99           |
| `starter_pack`       | non-consumabil | 300 Gemuri + 1000 Fitile + bomba „Rocket red” | €2.99           |

Cu Gemuri se cumpără pista premium a battle pass-ului (500) și pachete de Fitile. Prețurile reale se aleg în consolele de store (Q-017); jocul afișează prețul localizat venit din store.

## Pași

1. **Conturile de store** (Google Play 25 $, Apple 99 $/an), apoi **contractul pentru aplicații plătite** și datele fiscale/bancare ale SRL-ului (Play Console → Payments profile; App Store Connect → Agreements, Tax, and Banking).
2. **Produsele** cu id-urile de mai sus:
   - Google Play Console → Monetize → In-app products (consumabilele și starter pack-ul sunt toate „in-app products”);
   - App Store Connect → In-App Purchases: `gems_*` = Consumable, `starter_pack` = Non-Consumable.
3. **RevenueCat** (gratuit la început, cu comision peste un prag de venit; verifică planul curent):
   - un proiect, cu aplicația iOS și cea Android legate de store-uri;
   - produsele importate (aceleași id-uri);
   - **cheile publice** ale aplicațiilor în `.env` la build-ul mobil: `VITE_REVENUECAT_IOS=appl_…`, `VITE_REVENUECAT_ANDROID=goog_…`;
   - **cheia secretă** (Project settings → API keys → Secret, `sk_…`) în `deploy/.env` pe server: `REVENUECAT_SECRET_KEY`;
   - **webhook-ul**: Integrations → Webhooks → URL `https://api.DOMAIN/webhooks/revenuecat`, „Authorization header value” = un șir lung aleator (`Bearer $(openssl rand -hex 24)`), pus și în `deploy/.env` ca `REVENUECAT_WEBHOOK_AUTH`.
4. **Verificare**: din RevenueCat trimite evenimentul de test (răspunsul trebuie să fie `{"result":"test"}`), apoi o cumpărare în sandbox (TestFlight / Play internal testing) → Gemurile apar în joc în câteva secunde.

## Cum funcționează

- Jocul cumpără prin SDK-ul RevenueCat, cu id-ul contului anonim drept `appUserID`.
- RevenueCat validează chitanța la Apple/Google și anunță serverul (webhook). Ca rezervă, după cumpărare jocul cere `POST /purchases/sync`, care ia lista direct de la RevenueCat.
- Serverul acordă fiecare tranzacție o singură dată (`purchases.tx_id`). Rambursările scad Gemurile date.
- **Restore purchases** (cerut de Apple): starter pack-ul revine pe contul de pe telefonul nou. Gemurile, fiind consumabile, nu se restaurează (comportamentul standard al store-urilor).

## Dezvoltare și teste

`FAKE_PURCHASES=1` pe server (doar local; în producție serverul refuză să pornească) → în joc butoanele de cumpărare funcționează fără store. Testul e2e `monetization.spec.ts` îl folosește.

## De știut pentru review

- Jocul e pentru copii: fără reclame, fără cutii aleatoare, prețuri clare, mesajul „Ask a grown-up before you buy”. Apple Kids Category și Google Families Policy cer și ca linkurile/cumpărăturile să fie „în spatele unei verificări parentale” dacă aplicația e în categoria Kids: decizia de categorie e în Q-011 / Q-018.
- Câmpurile webhook-ului sunt după formatul RevenueCat cunoscut; documentația lor nu a fost accesibilă din containerul de lucru, deci evenimentul de test de la pasul 4 e verificarea.
