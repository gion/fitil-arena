import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // căi relative: necesar în WebView-ul Capacitor
  build: { target: 'es2022', outDir: 'dist', chunkSizeWarningLimit: 2000 },
  server: { port: 5173 },
});
