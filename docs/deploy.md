# Deploy în producție (un VPS)

Tot jocul rulează pe un singur server cu Docker Compose (D-081):

| Adresă               | Ce e                                  | Container           |
| -------------------- | ------------------------------------- | ------------------- |
| `https://DOMAIN`     | jocul în browser (invitații din link) | `web` (Caddy)       |
| `https://api.DOMAIN` | API-ul: conturi, profil, clasamente   | `server` (Fastify)  |
| `wss://play.DOMAIN`  | serverul de joc (camere, Infinit)     | `server` (Colyseus) |
| —                    | Postgres + backup zilnic              | `db`, `backup`      |

Certificatele TLS le ia Caddy singur de la Let's Encrypt. Fișierele: `Dockerfile`, `deploy/`.

## 1. Ce îți trebuie (o singură dată)

1. **Un VPS**: recomandat Hetzner Cloud **CX22** (2 vCPU, 4 GB, ~5 €/lună), Ubuntu 24.04, locația Falkenstein sau Nürnberg (latență mică pentru România). La creare adaugi cheia ta SSH publică.
2. **Domeniul**, cu 4 înregistrări DNS de tip **A** spre IP-ul serverului:
   `DOMAIN`, `www.DOMAIN`, `api.DOMAIN`, `play.DOMAIN` (sau un singur wildcard `*.DOMAIN` + `DOMAIN`).
3. **Pregătirea serverului** (firewall, Docker, actualizări automate, SSH doar cu cheie):
   ```sh
   ssh root@IP 'bash -s' < deploy/setup-server.sh
   ```
4. **Configurația** pe server, în `/opt/fuse-arena/deploy/.env` (modelul e `deploy/.env.example`):
   ```sh
   ssh root@IP
   cd /opt/fuse-arena/deploy
   nano .env   # DOMAIN, ACME_EMAIL, POSTGRES_PASSWORD=$(openssl rand -hex 24)
   ```
   `.env` rămâne doar pe server; nu intră în git.

## 2. Deploy automat din GitHub

O cheie SSH separată, doar pentru deploy:

```sh
ssh-keygen -t ed25519 -f fuse-deploy -N ''          # pe calculatorul tău
ssh-copy-id -i fuse-deploy.pub root@IP
ssh-keyscan IP                                       # rezultatul = DEPLOY_KNOWN_HOSTS
```

În GitHub → repo → **Settings → Secrets and variables → Actions**:

| Tip      | Nume                 | Valoare                                             |
| -------- | -------------------- | --------------------------------------------------- |
| Secret   | `DEPLOY_SSH_KEY`     | conținutul fișierului `fuse-deploy` (cheia privată) |
| Secret   | `DEPLOY_KNOWN_HOSTS` | rezultatul `ssh-keyscan IP`                         |
| Variable | `DEPLOY_HOST`        | IP-ul serverului                                    |
| Variable | `DEPLOY_DOMAIN`      | domeniul (fără `https://`)                          |

De acum, fiecare push pe `main` cu CI verde face deploy (workflow-ul **Deploy**), iar la final un test de fum joacă un meci de 15s prin `wss://play.DOMAIN`. Primul deploy îl pornești manual: Actions → Deploy → Run workflow. Fără `DEPLOY_HOST`, workflow-ul nu face nimic.

Prima construcție durează câteva minute; certificatele apar în ~1 minut după ce DNS-ul a ajuns la server.

## 3. Verificare manuală

```sh
curl https://api.DOMAIN/health                       # {"ok":true,"tickHz":20,"accounts":true}
pnpm --filter @fitil/server smoke wss://play.DOMAIN https://api.DOMAIN
```

Pe server:

```sh
cd /opt/fuse-arena
docker compose -f deploy/docker-compose.yml --env-file deploy/.env ps
docker compose -f deploy/docker-compose.yml --env-file deploy/.env logs -f server
```

## 4. Aplicația mobilă

Build-ul Capacitor trebuie să știe adresele publice (în `.env` local, la `pnpm mobile:sync`):

```sh
VITE_SERVER_URL=wss://play.DOMAIN
VITE_API_URL=https://api.DOMAIN
VITE_WEB_URL=https://DOMAIN
```

## 5. Backup și restaurare

Backup-ul zilnic e în `/opt/fuse-arena/deploy/backups/` (14 zile). Copiază-le periodic și în altă parte (de exemplu Hetzner Storage Box sau calculatorul tău: `rsync root@IP:/opt/fuse-arena/deploy/backups/ ./backups/`).

Restaurare:

```sh
cd /opt/fuse-arena
gunzip -c deploy/backups/fitil-AAAALLZZ-HHMM.sql.gz | \
  docker compose -f deploy/docker-compose.yml --env-file deploy/.env exec -T db psql -U fitil fitil
```

## 6. Test de multiplayer fără server (gratuit)

Pentru o sesiune cu prietenii înainte de VPS: `pnpm dev` pe calculatorul tău și un tunel public (de exemplu `cloudflared tunnel --url http://localhost:5173` pentru pagină și încă unul pentru `:2567` și `:3000`), cu `VITE_SERVER_URL` / `VITE_API_URL` puse pe adresele tunelurilor. Mai simplu e direct VPS-ul: aceleași pași ca mai sus. Planul de test: `docs/multiplayer-test.md`.

## Limite cunoscute

- Un singur proces de joc: camerele sunt în memorie, deci un deploy deconectează meciurile în curs (reconectarea durează 15s, apoi se pierde camera). Deploy-urile se fac când nu se joacă, până la mai multe procese + Redis.
- Build-ul se face pe server (fără registru de imagini); pe un VPS de 2 GB poate rămâne fără memorie.
