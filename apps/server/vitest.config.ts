import { defineConfig } from 'vitest/config';

// testele cu Postgres golesc tabelele: fișierele rulează pe rând
export default defineConfig({ test: { fileParallelism: false } });
