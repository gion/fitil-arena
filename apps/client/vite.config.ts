import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  base: './', // căi relative: necesar în WebView-ul Capacitor
  build: { target: 'es2022', outDir: 'dist', chunkSizeWarningLimit: 2000 },
  server: { port: 5173 },
  define: {
    // uneltele de dezvoltare (panoul DEV): constantă la compilare, ca build-ul public să nu le conțină deloc
    __DEV_TOOLS__: JSON.stringify(mode === 'development' || process.env.VITE_DEV_TOOLS === '1'),
  },
}));
