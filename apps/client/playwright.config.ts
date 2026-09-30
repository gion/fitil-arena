import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 150_000,
  // meciurile rulează pe timp real; testele în paralel și-ar fura cadre (FPS nereal)
  workers: 1,
  use: {
    baseURL: 'http://localhost:4173',
    ...devices['Pixel 7'],
    // landscape, cum se joacă pe telefon
    viewport: { width: 915, height: 412 },
    // headless-ul nou al Chromium folosește GPU-ul real (Metal/ANGLE); cel vechi randează software
    channel: 'chromium',
  },
  webServer: [
    {
      command: 'pnpm build && pnpm preview',
      url: 'http://localhost:4173',
      reuseExistingServer: true,
    },
    {
      // serverul de joc (Colyseus) pentru testele online; API-ul pe alt port ca să nu se ciocnească
      command: 'pnpm --filter @fitil/server serve',
      port: 2567,
      env: { API_PORT: '3099' },
      reuseExistingServer: true,
    },
  ],
});
