import { readFileSync } from 'node:fs';
import { matchesGlob, resolve } from 'node:path';

test.each(['pnpm-lock.yaml', 'pnpm-workspace.yaml'])(
  'the build workflow includes changes to %s', path => {
    const workflow = readFileSync(resolve(import.meta.dirname, '../.github/workflows/build.yml'), 'utf8');
    const filters = workflow.match(/filters: \|\r?\n((?:[ \t]{10,}[^\r\n]*\r?\n)+)/)?.[1];
    expect(filters, 'The changes job must define its build path filter.').toBeDefined();
    const patterns = Array.from(filters!.matchAll(/^[ \t]+-\s+(.+)$/gm), match =>
      match[1].trim().replace(/^['"]|['"]$/g, ''),
    );
    expect(patterns.some(pattern => matchesGlob(path, pattern))).toBe(true);
  },
);
