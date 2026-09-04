import { defineConfig } from 'vite';
import { resolve } from 'node:path';

const dir = import.meta.dirname;
export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(dir, './src'),
    },
  },
  plugins: [
  ],
  build: {
    lib: {
      entry: {
        index: resolve(dir, 'src/index.ts'),
        dom: resolve(dir, 'src/dom.ts')
      },
      formats: ['es']
    },
  }
});