import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    // three.js alone is ~550 kB minified (~150 kB gzipped); that's expected.
    chunkSizeWarningLimit: 700,
  },
});
