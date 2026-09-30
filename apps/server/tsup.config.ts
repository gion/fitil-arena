import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/main.ts'],
  format: ['esm'],
  target: 'node22',
  clean: true,
  splitting: false,
  // pachetele interne se exportă ca sursă TS, deci intră în bundle
  noExternal: ['@fitil/sim', '@fitil/content', '@fitil/net'],
});
