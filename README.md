# Fitil Arena

Monorepo: `packages/sim` (simulare deterministă), `packages/content` (date), `apps/client` (Phaser + Capacitor), `apps/server` (Fastify, Colyseus din Faza 3).

## Pornire

```bash
corepack enable        # sau: npm i -g pnpm@10
pnpm i
pnpm dev               # client pe http://localhost:5173 (și de pe telefon, în aceeași rețea) + API pe :3000
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

## Pe telefon

Cerințe: Xcode 26+ (iOS), Android Studio cu SDK 36 (Android). Capacitor 8 folosește Swift Package Manager, deci nu e nevoie de CocoaPods.

```bash
cd apps/client
pnpm ios        # build web + sync + deschide Xcode → alegi telefonul/simulatorul → Run
pnpm android    # build web + sync + deschide Android Studio → Run
```

Pentru iterare rapidă, deschide `http://<ip-mac>:5173` din browserul telefonului cât rulează `pnpm dev`.
