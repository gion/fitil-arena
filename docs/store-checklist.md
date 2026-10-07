# Checklist de store (Faza 8)

Stare: ✅ gata în repo · 🔧 de făcut în cod · 👤 checkpoint uman (cont, bani, decizie, texte legale).

## Comun (iOS + Android)

|     | Ce                                                                                   | Unde / note                                                                                                                            |
| --- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| ✅  | Doar landscape, ecran complet                                                        | `Info.plist` (`UISupportedInterfaceOrientations`, `UIRequiresFullScreen`), `AndroidManifest.xml` (`sensorLandscape`), D-054            |
| ✅  | Ecran de pornire (splash) până e gata jocul                                          | `capacitor.config.ts` (`launchAutoHide: false`) + `hideSplash()` în `main.ts`; plasă de siguranță la 5s                                |
| ✅  | Bara de stare ascunsă în joc                                                         | `@capacitor/status-bar` în `native.ts`                                                                                                 |
| ✅  | Vibrații native                                                                      | `@capacitor/haptics` (`haptics.ts`)                                                                                                    |
| ✅  | Ecran ținut aprins în meci, liber în meniuri                                         | `@capacitor-community/keep-awake` / Screen Wake Lock pe web (`keepAwake`)                                                              |
| ✅  | Pauză + sunet oprit când aplicația trece în fundal                                   | `appStateChange` / `visibilitychange` → `pause()`, `AudioContext.suspend()`                                                            |
| ✅  | Butonul „înapoi” (Android)                                                           | pauză în meci, ecranul anterior în meniuri, aplicația în fundal din meniul principal                                                   |
| ✅  | Deep links pentru invitații                                                          | `fusearena://join/ABCD` (Android `intent-filter`, iOS `CFBundleURLTypes`) și `…/?join=ABCD` pe web                                     |
| 👤  | Linkuri https care deschid aplicația (App Links / Universal Links)                   | cer domeniul final + `assetlinks.json` / `apple-app-site-association` (Q-016)                                                          |
| ✅  | „Save clip” (ultimele 10–20s)                                                        | `clip.ts`; în aplicație prin foaia de partajare a sistemului (`@capacitor/share`)                                                      |
| ✅  | Crash reporting                                                                      | Sentry, client propriu (`telemetry.ts`), activ cu `VITE_SENTRY_DSN`                                                                    |
| ✅  | Analytics: retenție D1/D7, durata sesiunii, funnel tutorial                          | PostHog, client propriu (`telemetry.ts`), activ cu `VITE_POSTHOG_KEY`                                                                  |
| 👤  | Conturi PostHog (regiunea EU) și Sentry; în PostHog „Discard client IP data” activat | chei în `.env` la build-ul de release                                                                                                  |
| 👤  | Consimțământ pentru statistici (joc pentru copii)                                    | Q-014; acum: activ implicit, comutator „Anonymous stats” în Setări                                                                     |
| ✅  | Versiunea web jucabilă din link, cu îndemn la instalare                              | același build; butonul „GET THE APP” apare pe web când există `VITE_STORE_IOS` / `VITE_STORE_ANDROID`                                  |
| 👤  | Hostingul web și al serverului de joc (`wss://`)                                     | Q-003; `VITE_SERVER_URL`, `VITE_WEB_URL`                                                                                               |
| 👤  | Nume final + verificare de marcă, `appId` final                                      | Q-010, Q-001 (acum `ro.fitil.arena`, „Fuse Arena”)                                                                                     |
| 👤  | Iconiță finală                                                                       | există iconițe provizorii (D-069)                                                                                                      |
| ✅  | Capturi pentru store (generate)                                                      | `pnpm --filter @fitil/client store:shots` → `apps/client/store-shots/` (Google Play 1920×1080, iPhone 6.7" 2796×1290) + clip de devlog |
| 👤  | Capturile finale alese, texte de prezentare, video de prezentare                     | din `store-shots/`                                                                                                                     |
| 👤  | Politica de confidențialitate și termenii (URL public)                               | Q-011; acum lorem ipsum (D-068), `privacy.html` / `terms.html`                                                                         |
| 👤  | Clasificarea de vârstă (IARC / App Store) și secțiunea pentru copii                  | „cartoon, fără sânge” (CLAUDE.md §8); fără reclame personalizate (BUSINESS.md §3)                                                      |
| ✅  | Ștergerea contului din aplicație                                                     | Setări → Delete account (`DELETE /me`, D-068) — cerință App Store și Google Play                                                       |

## Android (Google Play)

|     | Ce                                              | Note                                                                                                                                     |
| --- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| ✅  | Build debug + pornire pe emulator               | workflow `Mobile` (`.github/workflows/mobile.yml`): APK ca artefact, captură la pornire și după deep link, verificare de crash în logcat |
| 👤  | Cont Google Play Developer (25 USD, o dată)     | checkpoint (costă)                                                                                                                       |
| 🔧  | Build de release semnat (AAB) + cheia de upload | după cont; cheia doar în secrete CI, niciodată în git                                                                                    |
| 👤  | Pagina de pre-înregistrare                      | după cont                                                                                                                                |
| 👤  | Formularul „Data safety”                        | datele trimise: id anonim de instalare, evenimente de joc, rapoarte de erori; cont anonim (nume ales, progres)                           |
| 🔧  | `targetSdkVersion` la zi la momentul uploadului | acum 36 (`variables.gradle`)                                                                                                             |

## iOS (App Store)

|     | Ce                                         | Note                                                            |
| --- | ------------------------------------------ | --------------------------------------------------------------- |
| ✅  | Build pentru simulator + pornire           | workflow `Mobile`, job `ios`, doar manual (runner macOS, Q-015) |
| 👤  | Cont Apple Developer (99 USD/an)           | checkpoint (costă)                                              |
| 🔧  | Semnare, profil de distribuție, TestFlight | după cont (Faza 10)                                             |
| 👤  | „App Privacy” (nutrition labels)           | aceleași date ca la „Data safety”                               |
| 🔧  | `NSUserTrackingUsageDescription`           | **nu** e nevoie: nu folosim IDFA / tracking între aplicații     |
