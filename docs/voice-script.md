# Omni Voice — scripturi de seed și listă de lucru

Jocul e în engleză (D-028), deci toate scripturile sunt în engleză.
Un seed bun: 15–25s, un singur vorbitor, fără muzică, fără ecou, ton constant, pauze naturale.

## 1. Narația de seed, ~20s (toate vocile)

Citește-o la fel pentru fiecare voce, ca să le poți compara între ele. Aprox. 52 de cuvinte.

> Welcome to the arena. The fuse is lit, the crates are stacked, and nobody leaves
> without a story to tell. Some will run, some will hide, and a few will try something
> truly brilliant. Remember: every bomb has a timer, and every timer has a sense of
> humor. Ready? Three, two, one… light the fuse!

Dacă vrei o variantă fără ton de crainic (pentru personajele caricaturale), a doua:

> Okay, okay, listen. I told you this would work, and look: it worked! Mostly. A little
> bit of smoke never hurt anybody. Well, not permanently. Anyway, I'm still standing,
> you're still laughing, so I'd call that a win. Now, who wants to go again?

## 2. Câte 3 seed-uri scurte per personaj (8–12s fiecare)

Același text de bază pentru emoții diferite, ca să prinzi gama vocii: **A** neutru/prezentare,
**B** bucurie/victorie, **C** durere/pierdere. În tabel sunt concatenate, câte o linie fiecare (A, apoi B, apoi C), ~25–30s în total. Fiecare personaj are propriul text (caracterul se aude în el).

| Personaj         | Voce                      | Seed (A + B + C, lipește-l ca atare)                                                                                                                                                          |
| ---------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Bubu**         | Valf Energetic            | Hi! I'm Bubu. I'm round, I'm happy, and my first bomb is always the biggest one.<br>Hee hee hee, I won! Did you see that? Too easy!<br>Oh no, oh no, my cheeks! That was so not fair!         |
| **Gugu**         | Gravel Midnight           | Name's Gugu. Heavy feet, thick skin, and two lives. Come and try.<br>Ho ho ho! Who's the boss now? That's right, me.<br>Hmpf. Again? I had a second life for this one.                        |
| **Zuzu**         | Cherry Twinkle            | Zuzu here! Fastest legs in the arena. Blink and you missed me.<br>Yee-haw! You didn't even see me coming!<br>Ow! Okay, okay, I was going too fast. Again!                                     |
| **Striker**      | Charlie                   | Striker. Every bomb is a ball, and I never miss a penalty.<br>GOOOAL! Champions! Put that on the scoreboard!<br>Offside?! That was never a foul. Rematch!                                     |
| **Fifi**         | Lily Soft, Cute and Sweet | Fifi, darling. Graceful, charming, and I pick up everything that sparkles.<br>Whee-hoo! With grace, of course.<br>My bow! Do you know how long that took me?                                  |
| **Auntie Veta**  | Minnie                    | I'm Auntie Veta. Handbag, headscarf, and absolutely zero patience.<br>Shame on all of you! That's what manners get you!<br>Vai… oh dear, oh dear. What is this world coming to?               |
| **Chef**         | Will                      | I'm the Chef. I cook with fire. Literally. Dinner is served.<br>Bon appétit! Chef's kiss! Order up!<br>My soufflé! You ruined my soufflé!                                                     |
| **Master Fitil** | Callum                    | I am Master Fitil. I know every fuse by heart. Every tick. Every spark.<br>Mwa-ha-ha! All according to plan, my dear apprentices.<br>Impossible… I counted the seconds. I counted them twice! |
| **Robo-Mici**    | Retro Robot               | Beep. Boop. I am Robo-Mici. Illness protocols: disabled. Boom protocols: online.<br>Beep-boop! Victory! Mission complete!<br>Warning. Warning. Power low. Ouch, in robot.                     |
| **Ghost**        | Fergy Frog                | Crates? What crates? I'm just passing through.<br>Boo-hoo-hoo! You never saw me, did you?<br>Wait, I'm already… oh, never mind.                                                               |
| **Magician**     | Horatius                  | Ladies and gentlemen! Now you see the bomb… now it's a pigeon!<br>Ta-da! Thank you, thank you, you've been a wonderful audience.<br>Where did my hat go?! It was right here!                  |
| **Nova**         | Laura                     | Nova! Why aim down a line when you can hit the whole block?<br>Supernova, baby! Light them all up!<br>Too close… I overcooked it.                                                             |
| **Shade**        | Craig                     | Shade. Now you see me… now it's just smoke.<br>Smoke clears. I'm still here.<br>Sloppy. I was careless. It won't happen twice.                                                                |
| **Portia**       | Lily Velvety Actress      | I am Portia. Why walk around when you can step through?<br>Bravissima! Take a bow, everyone, take a bow!<br>Oh, the tragedy! The drama! The humiliation!                                      |
| **Slick**        | Jerry B                   | Name's Slick. Fast hands, faster feet, and a whole lot of ice.<br>Smooth. Like butter, like ice, like me.<br>Whoa, whoa, I slipped. Totally on purpose.                                       |

## 3. Lista de lucru (ordinea recomandată)

1. **Test de seed** — citești narația de la punctul 1 cu 1–2 voci, generezi în Omni Voice, asculți. Alegi vocea care se aude cel mai curat.
2. **Seed-uri per voce** — înregistrezi A/B/C din tabel pentru fiecare voce. Export WAV mono, 24–48 kHz, fără zgomot de fundal, nume: `seed_<personaj>_<a|b|c>.wav`.
3. **Mapare voce → personaj** — decizi ce voce ia fiecare personaj (15 personaje; nu e obligatoriu 15 voci diferite, poți face 6–8 și le distingi prin pitch/ritm).
4. **Generare replici din joc** — pentru fiecare personaj, din `packages/content/src/characters.ts` (`win`, `quips`, `taunts`) și `packages/content/src/texts.ts` (`QUIPS`, `TAUNTS`, `BYE`, `HERO_LINES`, `MENU_LINES`). Minim 3 variante per replică (repetarea obosește).
5. **Crainic / narator** — cu vocea din punctul 1: start de meci, "3-2-1", "Hurry up!", final de meci, fatalități.
6. **Post-procesare** — tăiat liniștea, egalizat la −16 LUFS, mono, MP3. Pipeline-ul există deja pentru pachetul temporar (`apps/client/public/voice/`, `DEFAULT_VOICE` în `apps/client/src/audio/voice.ts`).
7. **Integrare** — fișierele noi cu aceleași nume înlocuiesc pachetul temporar; replicile noi primesc rând în `DEFAULT_VOICE` (cheia = textul exact, inclusiv apostroful tipografic ’).
8. **Credite** — notezi sursa și licența în `assets/CREDITS.md`. Dacă vocile sunt clonate dintr-un om real, ai nevoie de consimțământ scris (checkpoint legal, vezi `docs/questions.md`).

## 4. Variante per replică (țintă)

| Tip                                | Câte per personaj | Exemple                          |
| ---------------------------------- | ----------------- | -------------------------------- |
| Victorie (`win`)                   | 3                 | "Too easy!", "Who's next?"       |
| Pierdut o viață / moarte (`quips`) | 4                 | "Ouch!", "Mommy!", "Not fair!"   |
| Batjocură la eliminare (`taunts`)  | 3                 | "Hehe!", "Ha ha ha!"             |
| "Bye bye…"                         | 2                 | triști, spre cameră              |
| Meniu — luptă                      | 3                 | "Light the fuse!", "Bombs away!" |
| Meniu — repaus                     | 3                 | "Ready when you are."            |
| Momente de glorie (`HERO_LINES`)   | 2 per tip         | viteză, bombe, rază              |

Total orientativ: ~20 clipuri × 15 personaje = ~300 clipuri scurte (1–3s).
