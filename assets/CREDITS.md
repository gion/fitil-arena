# Credite asset-uri

Momentan toate grafica și sunetele sunt generate procedural în cod. Orice asset extern (CC0 sau propriu) se notează aici cu sursa și licența.

## Voce

- `apps/client/public/voice/*.mp3` — replici generate local cu **Chatterbox** (Resemble AI, model sub licență MIT, folosire comercială permisă), cu `tools/voice/try_lines.py`. **Temporare**: vor fi înlocuite de înregistrări proprii cu aceleași nume de fișier. Conțin watermark-ul audio inaudibil Perth, pus de model.

## Fonturi

- `apps/client/src/ui/fonts/bangers-*.woff2` — **Bangers** (Vernon Adams, The Bangers Project Authors), SIL Open Font License 1.1 (`OFL-Bangers.txt`). Fișierele woff2 din pachetul npm `@fontsource/bangers` 5.3.0 (subseturile latin și latin-ext).
- `apps/client/src/ui/fonts/rubik-*.woff2` — **Rubik** (The Rubik Project Authors), SIL Open Font License 1.1 (`OFL-Rubik.txt`). Din `@fontsource/rubik` 5.3.0: greutățile 500, 700, 800 și 500 italic, subseturile latin și latin-ext.
- `apps/client/src/ui/fonts/lilita-one-*.woff2` — **Lilita One** (Juan Montoreano), SIL Open Font License 1.1 (`OFL-LilitaOne.txt`). Din `@fontsource/lilita-one` 5.3.0: greutatea 400, subseturile latin și latin-ext. Folosit de skin-ul „Toy”.
- `apps/client/src/ui/fonts/nunito-*.woff2` — **Nunito** (The Nunito Project Authors), SIL Open Font License 1.1 (`OFL-Nunito.txt`). Din `@fontsource/nunito` 5.3.0: greutățile 700, 800, 900, subseturile latin și latin-ext. Folosit de skin-ul „Toy”.
- Copiate în repo (nu dependențe), ca aplicația să meargă offline în Capacitor; declarate în `apps/client/src/ui/fonts.css`.

## Iconiță și ecran de pornire

- `assets/brand/*.svg`, iconițele din `apps/client/android/.../mipmap-*`, `apps/client/ios/.../AppIcon.appiconset`, ecranele de pornire și `apps/client/public/icon.svg` / `apple-touch-icon.png` — desenate procedural, proprii, cu `apps/client/scripts/brand.mjs` (`pnpm --filter @fitil/client brand`). Wordmark-ul de pe ecranul de pornire folosește Bangers (vezi Fonturi).
