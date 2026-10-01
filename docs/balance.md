# Balans — Faza 4

Generat cu `pnpm balance 3500 --md` (`packages/content/scripts/balance.ts`): FFA de 4 boți „hard”, fiecare cu alt personaj (tras din seed), tema = `seed % 10`, evenimentul de arenă tras din seed, bonusurile noi și tufișurile active. Țintele din `PLAN.md`: **18–32% pe personaj**, **15–35% pe fiecare arenă**. Ultima rulare: **ambele ținte atinse**.

Eroarea standard pe o celulă personaj × temă e ~3.5 puncte (≈200 de apariții), deci diferențele mici între teme sunt zgomot.

3500 meciuri FFA de 4 boți „hard” · egaluri 2.5% · durată medie 80s · neterminate 0

| Personaj     | Victorii | Super-uri / meci | clasic | neon | pixel | cosmos | cuburi | jungla | halloween | craciun | valentin | scoala |
| ------------ | -------- | ---------------- | ------ | ---- | ----- | ------ | ------ | ------ | --------- | ------- | -------- | ------ |
| Bubu         | 22.3%    | 1.1              | 21.7   | 24.3 | 23.9  | 26.9   | 23.3   | 21.1   | 24.7      | 21.9    | 15.5     | 20.0   |
| Zuzu         | 24.7%    | 1.6              | 23.8   | 23.5 | 27.4  | 26.3   | 25.1   | 28.2   | 20.3      | 26.2    | 24.9     | 22.0   |
| Gogu         | 26.8%    | 0.7              | 30.7   | 24.7 | 27.1  | 22.5   | 23.0   | 25.7   | 27.8      | 23.9    | 31.5     | 30.9   |
| Fifi         | 22.8%    | 1.3              | 22.1   | 21.6 | 17.3  | 19.6   | 20.8   | 25.3   | 20.1      | 24.5    | 33.0     | 23.4   |
| Auntie Veta  | 28.3%    | 0.5              | 27.2   | 29.8 | 24.0  | 33.3   | 31.1   | 28.9   | 24.3      | 28.6    | 25.1     | 30.7   |
| Master Fitil | 22.2%    | 2.0              | 18.8   | 20.4 | 20.3  | 22.6   | 21.9   | 21.8   | 29.4      | 22.9    | 21.4     | 22.0   |
| Robo-Mici    | 23.4%    | 0.3              | 26.0   | 27.1 | 27.3  | 20.9   | 27.0   | 19.0   | 21.3      | 22.3    | 20.1     | 23.2   |

| Eveniment | Meciuri | Egaluri | Durată medie |
| --------- | ------- | ------- | ------------ |
| lowgrav   | 261     | 3.4%    | 85s          |
| wind      | 530     | 1.1%    | 80s          |
| bushy     | 563     | 2.3%    | 81s          |
| calm      | 1058    | 2.7%    | 81s          |
| short     | 287     | 4.5%    | 78s          |
| fat       | 552     | 1.4%    | 77s          |
| fog       | 249     | 3.6%    | 77s          |

## Ajustări făcute (de la prima rulare)

| Problemă                              | Cauză                                                                                  | Ajustare                                                                                                        |
| ------------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Fifi 9%                               | Cluster-ul punea mini-bombe la 1 pătrățel când direcția era blocată și o prindea pe ea | Mini-bombele doar la exact 2 pătrățele; Super +15%                                                              |
| Tanti Veta 43%                        | Șalul = practic o inimă în plus                                                        | Viteză 85%, Super 80%, după șal doar 0.4s invulnerabilă (flacăra ține 0.55s: trebuie să fugi)                   |
| Master Fitil 16%                      | Pasivul (vede timerele) nu ajută boții                                                 | Super 130%                                                                                                      |
| +1 inimă din afinitate: +13–15 puncte | O inimă în plus e foarte puternică                                                     | Inima vine cu o penalizare (Halloween: Master Fitil +1 inimă, Super −15%; Valentin: Fifi +1 inimă, −15% viteză) |
| Gogu ~29%, peste 35% pe unele teme    | Piciorul de la start + bomba lipicioasă                                                | Super 90%                                                                                                       |

## Ce nu acoperă bench-ul

- Boții nu folosesc mănușa, detonatorul și linia (din Faza 1), deci personajele care ar profita de ele sunt subestimate.
- Pasivul lui Master Fitil (timerele bombelor) e doar vizual, pentru om; la boți nu contează.
- Robo-Mici își folosește Super-ul rar (0.3/meci): teleportul e doar ieșirea de urgență când nu mai are drum de scăpare.
- Modurile pe echipe, Coroana și Cartoful nu sunt în acest raport (doar în `pnpm sim:bench`, pentru erori și durată).
