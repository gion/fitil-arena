# Întrebări deschise

- **Q-001** Identificatorul aplicației (`appId`): provizoriu `ro.fitil.arena`. Cel final trebuie ales înainte de primul upload în store (se leagă de numele final, vezi BUSINESS.md §1).
- **Q-002** Fontul de titluri: prototipul folosea Bungee + Nunito (Google Fonts, OFL). Acum sunt fonturi de sistem (D-023). Le împachetăm local (OFL permite) sau alegem altele la direcția artistică finală?
- **Q-003 (checkpoint Faza 3) — hostingul serverului de joc.** Serverul e un singur proces Node (Colyseus + Fastify), cu stare în memorie (camerele), fără DB încă. Un meci consumă foarte puțin (~40 B/tick/jucător în jos, un sim de ~ms/tick), deci un VPS mic duce zeci de camere. Două variante (prețuri estimative, de verificat la momentul alegerii):
  - **A. Fly.io** — o mașină `shared-cpu-1x` cu 512 MB–1 GB, regiunea Frankfurt/Amsterdam: ~3–7 $/lună; deploy din Dockerfile, TLS (wss) inclus, scalare ulterioară pe regiuni. Contra: camerele sunt în memorie, deci la mai multe mașini trebuie Redis presence (Faza 7) și sticky routing.
  - **B. Hetzner Cloud** — CX22 (2 vCPU, 4 GB) în Falkenstein/Nürnberg: ~4–6 €/lună; cel mai ieftin la putere, latență mică pentru România. Contra: administrezi tu (Docker + Caddy pentru TLS, update-uri, monitorizare).
  - (Railway: ~5 $/lună plan Hobby + consum; comod, dar mai scump la trafic WebSocket susținut.)
  - **Recomandare:** Fly.io pentru început (zero administrare, wss gata), Hetzner când crește traficul. **Decizie necesară:** ce variantă și pe ce cont (costă bani → checkpoint uman). Până atunci serverul rulează doar local.
