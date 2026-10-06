# Balans — Faza 4

Generat cu `pnpm balance 6000 --md` (`packages/content/scripts/balance.ts`): FFA de 4 boți „hard”, fiecare cu alt personaj (tras din seed, din toate cele 11), tema = `seed % 10`, evenimentul de arenă tras din seed, bonusurile noi, tufișurile și încărcările active. Fiecare personaj joacă cu semnătura lui (kit), Ultimate-ul și afinitatea temei. Țintele din `PLAN.md`: **18–32% pe personaj**, **15–35% pe fiecare arenă** — atinse.

Eroarea standard pe o celulă personaj × temă e ~3 puncte (≈220 de apariții), deci diferențele mici între teme sunt zgomot.

Observații: boții folosesc rar Ultimate-urile care cer o situație anume (Penalty, Switcheroo, Portal Jump); Gugu (două vieți) și Robo-Mici (imun + Picior) sunt la marginea de sus, Tanti Veta și Bubu la cea de jos — de urmărit după ce joacă oameni.

6000 meciuri FFA de 4 boți „hard” · egaluri 2.5% · durată medie 83s · neterminate 1

| Personaj     | Victorii | Ultimate / meci | clasic | neon | pixel | cosmos | cuburi | jungla | halloween | craciun | valentin | scoala |
| ------------ | -------- | --------------- | ------ | ---- | ----- | ------ | ------ | ------ | --------- | ------- | -------- | ------ |
| Bubu         | 20.4%    | 1.1             | 20.4   | 19.5 | 21.9  | 25.0   | 15.7   | 20.3   | 17.2      | 21.1    | 21.7     | 21.9   |
| Gugu         | 31.4%    | 1.7             | 34.6   | 32.7 | 28.6  | 27.8   | 34.0   | 31.2   | 30.6      | 32.1    | 34.0     | 27.7   |
| Zuzu         | 24.2%    | 1.7             | 20.4   | 25.1 | 28.6  | 27.8   | 21.0   | 26.0   | 24.4      | 24.5    | 21.8     | 22.3   |
| Striker      | 21.2%    | 0.1             | 17.3   | 20.1 | 22.0  | 22.8   | 20.0   | 22.7   | 22.5      | 19.5    | 25.6     | 20.0   |
| Fifi         | 24.4%    | 1.4             | 27.7   | 23.3 | 23.3  | 26.3   | 26.6   | 22.4   | 26.1      | 25.4    | 21.4     | 21.7   |
| Auntie Veta  | 19.5%    | 0.5             | 19.0   | 20.5 | 20.1  | 21.5   | 20.4   | 19.4   | 15.0      | 20.2    | 17.5     | 20.9   |
| Chef         | 27.1%    | 0.6             | 33.2   | 28.6 | 23.7  | 21.4   | 28.2   | 27.5   | 25.3      | 28.5    | 27.2     | 26.9   |
| Master Fitil | 21.7%    | 2.2             | 24.5   | 18.0 | 21.9  | 19.5   | 22.3   | 21.6   | 29.5      | 20.3    | 18.9     | 20.5   |
| Robo-Mici    | 29.5%    | 0.4             | 28.6   | 30.2 | 32.1  | 26.7   | 30.6   | 27.6   | 27.2      | 29.8    | 31.4     | 30.5   |
| Ghost        | 21.5%    | 1.3             | 15.9   | 20.6 | 20.8  | 21.1   | 22.5   | 25.4   | 19.2      | 19.4    | 24.5     | 25.0   |
| Magician     | 28.1%    | 0.1             | 25.1   | 32.7 | 28.4  | 27.7   | 26.7   | 26.0   | 28.7      | 28.8    | 27.5     | 29.1   |

| Eveniment | Meciuri | Egaluri | Durată medie |
| --------- | ------- | ------- | ------------ |
| lowgrav   | 449     | 2.4%    | 85s          |
| wind      | 933     | 2.5%    | 83s          |
| bushy     | 930     | 3.0%    | 86s          |
| calm      | 1816    | 2.6%    | 84s          |
| short     | 482     | 3.1%    | 80s          |
| fat       | 938     | 1.9%    | 81s          |
| fog       | 452     | 2.2%    | 84s          |
