import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

const dir = import.meta.dirname;
export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(dir, 'src'),
    },
  },
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'jsdom',
    setupFiles: ['test/setupFiles.ts'],
    globals: true,
    env: {
      NODE_ENV: 'test',
    },
  },
  plugins: [
  ],
});
