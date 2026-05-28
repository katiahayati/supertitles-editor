// Builds each page separately so vite-plugin-singlefile can inline every page
// into one self-contained HTML file (the plugin disables code-splitting, which
// rollup forbids with multiple inputs in a single build).
import { build } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const pages = [
  'index.html',
  'pdf-annotator.html',
  'presentation-editor.html',
  'presentation-viewer.html',
  'supertitles-manager.html',
  'recital-manager.html',
];

for (const [i, page] of pages.entries()) {
  await build({
    root,
    configFile: false,
    plugins: [viteSingleFile()],
    build: {
      emptyOutDir: i === 0, // clear dist once, then append each page
      rollupOptions: { input: resolve(root, page) },
    },
    logLevel: 'warn',
  });
}

console.log(`\nBuilt ${pages.length} self-contained pages into dist/`);
