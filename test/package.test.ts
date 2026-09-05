import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
const cacheRoot = join(root, 'node_modules', '.cache');
const fixtures = join(root, 'test', 'fixtures');
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const compiler = join(dirname(require.resolve('typescript/package.json')), 'bin', 'tsc');
let temporaryDirectory: string;
let consumerDirectory: string;

function runNode(script: string, args: string[], cwd = root) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd,
    encoding: 'utf8',
    stdio: 'pipe',
    timeout: 30_000,
    windowsHide: true,
  });
  if (result.error) {
    throw result.error;
  }
  expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
}

beforeAll(() => {
  mkdirSync(cacheRoot, { recursive: true });
  temporaryDirectory = mkdtempSync(join(cacheRoot, 'jqueryx-package-'));
  consumerDirectory = join(temporaryDirectory, 'consumer');
  const packageDirectory = join(consumerDirectory, 'node_modules', 'jqueryx');
  const outputDirectory = join(packageDirectory, 'dist');
  const helperDirectory = join(temporaryDirectory, 'helpers');

  mkdirSync(packageDirectory, { recursive: true });
  writeFileSync(join(temporaryDirectory, 'package.json'), JSON.stringify({ type: 'module' }));
  writeFileSync(join(packageDirectory, 'package.json'), JSON.stringify(manifest, null, 2));
  cpSync(join(fixtures, 'consumer'), consumerDirectory, { recursive: true });

  runNode(compiler, ['-p', join(fixtures, 'tsconfig.json'), '--outDir', helperDirectory]);
  runNode(join(helperDirectory, 'build-package.js'), [outputDirectory]);
  runNode(compiler, ['-p', 'tsconfig.build.json', '--outDir', outputDirectory]);
  runNode(require.resolve('tsc-alias/dist/bin/index.js'), [
    '-p', 'tsconfig.build.json', '--outDir', outputDirectory,
  ]);

  const consumerConfig = {
    compilerOptions: {
      target: 'ES2021',
      module: 'ESNext',
      moduleResolution: 'Bundler',
      strict: true,
      noEmit: true,
      // Issue 10 tracks the separate builtinx/dom declaration conflict.
      skipLibCheck: true,
      // jQuery globals must arrive through the package, not ambient @types discovery.
      types: [],
    },
    files: ['types.ts'],
  };
  writeFileSync(join(consumerDirectory, 'tsconfig.json'), JSON.stringify(consumerConfig, null, 2));
  writeFileSync(join(consumerDirectory, 'tsconfig.runtime.json'), JSON.stringify({
    ...consumerConfig,
    compilerOptions: {
      ...consumerConfig.compilerOptions,
      noEmit: false,
      outDir: 'compiled',
      types: ['node'],
    },
    files: ['runtime.ts', 'entry.ts', 'business.ts'],
  }, null, 2));
}, 30_000);

afterAll(() => {
  if (temporaryDirectory && dirname(temporaryDirectory) === cacheRoot) {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

test('declares jQuery as a shared peer with a local development dependency', () => {
  expect(manifest.peerDependencies?.jquery).toEqual(expect.any(String));
  expect(manifest.devDependencies.jquery).toBe(manifest.peerDependencies.jquery);
  expect(manifest.dependencies.jquery).toBeUndefined();
});

test('ships the jQuery types as a consumer dependency', () => {
  expect(manifest.dependencies['@types/jquery']).toEqual(expect.any(String));
  expect(manifest.devDependencies['@types/jquery']).toBeUndefined();
});

test('the built entry installs shared globals before business modules execute', () => {
  runNode(compiler, ['-p', join(consumerDirectory, 'tsconfig.runtime.json')]);
  runNode(join(consumerDirectory, 'compiled', 'runtime.js'), [require.resolve('vitest/package.json')]);
});

test('consumers get global factories and base types by importing only jqueryx', () => {
  runNode(compiler, ['-p', join(consumerDirectory, 'tsconfig.json')]);
});
