import { test } from '@playwright/test';
import { THEMES } from '@fitil/content';

/** Capturi temă × vedere în docs/screens/ (rulează doar cu SCREENS=1: `pnpm screens`). */
test.skip(!process.env.SCREENS, 'doar la cerere');
test.use({ deviceScaleFactor: 1.5 });

for (const th of THEMES)
  test(`captură ${th.id}`, async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => (window as unknown as { __fitil?: unknown }).__fitil);
    for (const view of ['2d', 'fps', 'chase']) {
      await page.evaluate(
        async ([id, v]) => {
          const { app } = (
            window as unknown as {
              __fitil: {
                app: {
                  setTheme(i: string): void;
                  setView(v: string, p: boolean): Promise<void>;
                  start(k: unknown): void;
                };
              };
            }
          ).__fitil;
          app.setTheme(id!);
          await app.setView(v!, false);
          app.start({ type: 'mode', mode: 'ffa' });
        },
        [th.id, view],
      );
      await page.waitForTimeout(2200);
      await page.screenshot({ path: `../../docs/screens/${th.id}-${view}.jpg`, type: 'jpeg', quality: 70 });
    }
  });
