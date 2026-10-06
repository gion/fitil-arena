import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

export default defineConfig(({ mode }) => ({
  base: './', // căi relative: necesar în WebView-ul Capacitor
  build: { target: 'es2022', outDir: 'dist', chunkSizeWarningLimit: 2000 },
  server: { port: 5173 },
  define: {
    // uneltele de dezvoltare (panoul DEV): constantă la compilare, ca build-ul public să nu le conțină deloc
    // versiunea din Settings
    __APP_VERSION__: JSON.stringify(pkg.version),
    __DEV_TOOLS__: JSON.stringify(mode === 'development' || process.env.VITE_DEV_TOOLS === '1'),
  },
}));
