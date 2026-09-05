import { resolve } from 'node:path';
import { build, loadConfigFromFile } from 'vite';

const loaded = await loadConfigFromFile(
  { command: 'build', mode: 'production' },
  resolve('vite.config.ts'),
);

const library = loaded?.config.build?.lib;
if (!loaded || !library) {
  throw new Error('Could not load the package library build configuration.');
}

await build({
  ...loaded.config,
  configFile: false,
  build: {
    ...loaded.config.build,
    outDir: process.argv[2],
    emptyOutDir: false,
    // Issue 8 tracks the missing dom entry; exercise the existing public entry here.
    lib: {
      ...library,
      entry: { index: resolve('src/index.ts') },
    },
  },
});
