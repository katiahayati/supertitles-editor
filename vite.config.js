import { defineConfig } from 'vite';

// Dev-server config only. The production build is driven by scripts/build.mjs,
// which builds each page separately so vite-plugin-singlefile can inline every
// page into a self-contained, file://-openable HTML document.
export default defineConfig({
  appType: 'mpa',
  server: {
    port: 5173,
    strictPort: true,
  },
});
