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

  // Compile the actual documented examples against the published declarations.
  const readme = readFileSync(join(root, 'README.md'), 'utf8');
  const examples = [...readme.matchAll(/^```ts\r?\n([\s\S]*?)^```/gm)];
  expect(examples.length).toBeGreaterThan(0);
  const exampleFiles = examples.map((example, index) => {
    const file = `readme-example-${index + 1}.ts`;
    writeFileSync(join(consumerDirectory, file), `import 'jqueryx';\n${example[1]}\nexport {};\n`);
    return file;
  });

  // Allows validating an unpublished peer build without changing the repository's dependency ranges.
  const builtinxPackage = process.env['JQUERYX_BUILTINX_PACKAGE_DIR'];
  if (builtinxPackage) {
    const peerManifest = JSON.parse(readFileSync(join(builtinxPackage, 'package.json'), 'utf8'));
    expect(peerManifest.name).toBe('builtinx');
    const peerDirectory = join(consumerDirectory, 'node_modules', 'builtinx');
    mkdirSync(peerDirectory, { recursive: true });
    writeFileSync(join(peerDirectory, 'package.json'), JSON.stringify(peerManifest, null, 2));
    cpSync(join(builtinxPackage, 'dist'), join(peerDirectory, 'dist'), { recursive: true });
  }

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
      // Check dependency declarations too, including native DOM augmentation compatibility.
      skipLibCheck: false,
      // jQuery globals must arrive through the package, not ambient @types discovery.
      types: [],
    },
    files: ['types.ts', ...exampleFiles],
  };
  writeFileSync(join(consumerDirectory, 'tsconfig.json'), JSON.stringify(consumerConfig, null, 2));
  writeFileSync(join(consumerDirectory, 'tsconfig.nodenext.json'), JSON.stringify({
    ...consumerConfig,
    compilerOptions: {
      ...consumerConfig.compilerOptions,
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
    },
  }, null, 2));
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

test.each(['jquery', 'builtinx', 'linqx'])('declares %s as a shared peer with a local development dependency', dependency => {
  expect(manifest.peerDependencies?.[dependency]).toEqual(expect.any(String));
  expect(manifest.devDependencies[dependency]).toBe(manifest.peerDependencies[dependency]);
  expect(manifest.dependencies[dependency]).toBeUndefined();
});

test('ships the jQuery types as a consumer dependency', () => {
  expect(manifest.dependencies['@types/jquery']).toEqual(expect.any(String));
  expect(manifest.devDependencies['@types/jquery']).toBeUndefined();
});

test.each(['host-first', 'package-first'])('the built entry shares all peer runtimes with %s loading', loadOrder => {
  runNode(compiler, ['-p', join(consumerDirectory, 'tsconfig.runtime.json')]);
  runNode(join(consumerDirectory, 'compiled', 'runtime.js'), [
    require.resolve('vitest/package.json'),
    loadOrder,
  ]);
});

test.each(['tsconfig.json', 'tsconfig.nodenext.json'])(
  'consumers and README examples compile against published types using %s', config => {
    runNode(compiler, ['-p', join(consumerDirectory, config)]);
  },
);

test('the published declaration graph uses explicit relative ESM paths', () => {
  const entry = readFileSync(join(consumerDirectory, 'node_modules/jqueryx/dist/index.d.ts'), 'utf8');
  expect(entry).toContain("'./extensions/index.js'");
  expect(entry).toContain("'./types/lib.js'");
});
