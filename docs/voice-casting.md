# Distribuția vocilor (ElevenLabs, voci disponibile contului)

Potrivire făcută după descrierile din bibliotecă. „Alternativă" = ce încerci dacă prima nu sună bine.
Seed-urile de test sunt în `docs/voice-script.md`.

| Personaj         | Voce aleasă (voice_id)                                        | De ce                            | Alternativă                          |
| ---------------- | ------------------------------------------------------------- | -------------------------------- | ------------------------------------ |
| **Bubu**         | Valf Energetic (nou, id de completat)                         | energic, tineresc                | Lutz (`9yzdeviXkFddZ4Oz8Mok`)        |
| **Gugu**         | Gravel Midnight (nou, id de completat)                        | grav, "ho ho ho"                 | Brian (`nPczCjzI2devNBz1zQrb`)       |
| **Zuzu**         | Cherry Twinkle — Bubbly and Sweet (`XJ2fW4ybq7HouelYYGcL`)    | veselă, rapidă                   | Laura (`FGY2WhTYpPnrIDTdsKH5`)       |
| **Striker**      | Charlie — Deep, Confident, Energetic (`IKne3meq5aSn9XLyUdCD`) | sportiv, sigur pe el             | Harry (`SOYHLrjzK2X1ezoPC6cr`)       |
| **Fifi**         | Lily — Soft, Cute and Sweet (`Pt5YrLNyu6d2s3s4CVMg`)          | grațioasă, dulce                 | Jessica (`cgSgspJ2msm6clMCkdW9`)     |
| **Auntie Veta**  | Minnie — High pitch cartoon (`eppqEXVumQ3CfdndcIBd`)          | voce de bătrânică (ales de tine) | Jen Frankie (`a5zfmqTslZJBP0jutmVY`) |
| **Chef**         | Will — Relaxed Optimist (`bIHbv24MWmeRgasZH58o`)              | prietenos, relaxat               | Chris (`iP95p4xoKVk53GoZ742B`)       |
| **Master Fitil** | Callum — Husky Trickster (`N2lVS1w4EtoT3dr4eOWO`)             | ironic, șmecher, misterios       | Craig (`J6QyEgpWnUhfFeU38ghG`)       |
| **Robo-Mici**    | Retro Robot (nou, id de completat)                            | robotică nativă                  | River (`SAz9YHcvj6GT2YYXdXww`)       |
| **Ghost**        | Fergy Frog — Sweet Companion (`n3tkGOcEribaYI5zg4pu`)         | blând, stângaci, simpatic        | Craig (`J6QyEgpWnUhfFeU38ghG`)       |
| **Magician**     | Horatius — Energetic Character (`qXpMhyvQqiRxWQs4qSSB`)       | teatral, "over the top"          | George (`JBFqnCBsd6RMkjVDRZzb`)      |
| **Nova**         | Laura — Enthusiast, Quirky (`FGY2WhTYpPnrIDTdsKH5`)           | entuziastă, aparte               | Liam (`TX3LPaxmHKxFdv7VOQHJ`)        |
| **Shade**        | Craig — Comforting, Raspy (`J6QyEgpWnUhfFeU38ghG`)            | răgușit, calm, "fum"             | Adam (`pNInz6obpgDQGcFmaJgB`)        |
| **Portia**       | Lily — Velvety Actress (`pFZP5JQG7iQjIQuC4Bku`)               | britanică, actriță, dramatică    | Sarah (`EXAVITQu4vr4xnSDxMaL`)       |
| **Slick**        | Jerry B — California Surfer Dude (`rHWSYoq8UlV0YIBKMryp`)     | relaxat, cool                    | Roger (`CwhRBWXzGAHq8TQ4Fs17`)       |
| **Crainic**      | Hal — Animated Social (nou, id de completat)                  | animat, energic                  | Daniel (`onwK4e9ZLuTAKqWW03F9`)      |

## Primul test (6 voci, cele mai diferite între ele)

1. Gugu — Gravel Midnight
2. Zuzu — Cherry Twinkle
3. Auntie Veta — Minnie
4. Master Fitil — Callum
5. Slick — Jerry B
6. Magician — Horatius

Textul: seed-ul A al fiecărui personaj din `docs/voice-script.md`, apoi o replică de moarte ("Mommy!") ca să vezi dacă vocea ține emoția.
Ce asculți: se înțelege la 1–2 secunde? Are caracter fără să obosească la repetări? Rămâne diferită de vecinele ei?

## Note

- Mai multe personaje pot rămâne pe aceeași voce dacă o modifici prin stability/style și pitch în post, dar pentru distincție clară ține-le pe voci diferite.
- Voci din bibliotecă pot dispărea dacă proprietarul le retrage (vezi tooltip-ul din listă); cele cu "Default Voice" sunt sigure. Pentru voci folosite în producție, notează licența în `assets/CREDITS.md`.
