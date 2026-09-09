import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  assertBundledBackendImportSucceeded,
  runBundledBackendImport,
  withProductionDependencyCheckRoot,
} from './check-production-dependencies.mjs';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixtureFiles = ['package.json', 'package-lock.json', 'server.js'];

async function assertNoValidationArtifacts(tempParent) {
  assert.deepEqual(await readdir(tempParent), []);
}

async function snapshotWorkspace() {
  return Promise.all(
    fixtureFiles.map(async file => [file, await readFile(join(projectRoot, file))]),
  );
}

async function assertWorkspaceUnchanged(originalWorkspaceFiles) {
  for (const [file, original] of originalWorkspaceFiles) {
    assert.deepEqual(
      await readFile(join(projectRoot, file)),
      original,
      `${file} in the developer workspace was modified`,
    );
  }
}

async function createFixtureRoot() {
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'sgs-production-dependency-fixture-'));
  await Promise.all(
    fixtureFiles.map(file => cp(join(projectRoot, file), join(fixtureRoot, file))),
  );
  return fixtureRoot;
}

test('validates production dependencies without mutating the workspace', async () => {
  const fixtureRoot = await createFixtureRoot();
  const tempParent = await mkdtemp(join(tmpdir(), 'sgs-production-dependency-parent-'));

  try {
    const originalWorkspaceFiles = await snapshotWorkspace();
    const generatedBundle = await readFile(join(fixtureRoot, 'server.js'), 'utf8');

    await withProductionDependencyCheckRoot(
      { sourceRoot: fixtureRoot, tempParent },
      async productionCheckRoot => {
        await writeFile(
          join(productionCheckRoot, 'server.js'),
          `import 'vitest';\n${generatedBundle}`,
        );
        const failed = await runBundledBackendImport(productionCheckRoot);

        assert.notEqual(failed.code, 0, 'a dev-only runtime import must fail validation');
        assert.match(failed.stderr, /Cannot find package ['"]vitest['"]/);
        assert.throws(
          () => assertBundledBackendImportSucceeded(failed),
          error => {
            assert.match(error.message, /Bundled backend import failed \(exit code 1\)/);
            assert.match(error.message, /\[stderr\][\s\S]*Cannot find package ['"]vitest['"]/);
            return true;
          },
        );

        await writeFile(join(productionCheckRoot, 'server.js'), generatedBundle);
        const passed = await runBundledBackendImport(productionCheckRoot);
        const passedOutput = `${passed.stdout}\n${passed.stderr}`;

        assert.equal(passed.code, 0, passedOutput);
      },
    );

    await assertNoValidationArtifacts(tempParent);
    assert.deepEqual((await readdir(fixtureRoot)).sort(), fixtureFiles.sort());
    await assertWorkspaceUnchanged(originalWorkspaceFiles);
  } finally {
    await Promise.all([
      rm(fixtureRoot, { recursive: true, force: true }),
      rm(tempParent, { recursive: true, force: true }),
    ]);
  }
});

test('cleans up the temporary install when npm ci fails', async () => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'sgs-production-dependency-install-failure-'));
  const tempParent = await mkdtemp(join(tmpdir(), 'sgs-production-dependency-parent-'));

  try {
    const originalWorkspaceFiles = await snapshotWorkspace();
    await Promise.all([
      writeFile(
        join(fixtureRoot, 'package.json'),
        JSON.stringify({
          name: 'dependency-check-install-failure',
          version: '1.0.0',
          private: true,
          dependencies: { 'left-pad': '1.3.0' },
        }),
      ),
      writeFile(
        join(fixtureRoot, 'package-lock.json'),
        JSON.stringify({
          name: 'dependency-check-install-failure',
          version: '1.0.0',
          lockfileVersion: 3,
          requires: true,
          packages: {
            '': {
              name: 'dependency-check-install-failure',
              version: '1.0.0',
              dependencies: {},
            },
          },
        }),
      ),
      writeFile(join(fixtureRoot, 'server.js'), 'export {};'),
    ]);

    await assert.rejects(
      withProductionDependencyCheckRoot(
        { sourceRoot: fixtureRoot, tempParent },
        async () => {
          throw new Error('npm ci unexpectedly succeeded');
        },
      ),
      error => {
        assert.match(
          error.message,
          /Production dependency installation failed during npm ci --omit=dev/,
        );
        assert.match(error.message, /exit code 1/);
        assert.match(error.message, /\[stderr\][\s\S]*npm (ERR!|error)/i);
        return true;
      },
    );

    await assertNoValidationArtifacts(tempParent);
    await assertWorkspaceUnchanged(originalWorkspaceFiles);
  } finally {
    await Promise.all([
      rm(fixtureRoot, { recursive: true, force: true }),
      rm(tempParent, { recursive: true, force: true }),
    ]);
  }
});

test('cleans up the temporary install when backend import times out', async () => {
  const fixtureRoot = await createFixtureRoot();
  const tempParent = await mkdtemp(join(tmpdir(), 'sgs-production-dependency-parent-'));

  try {
    const originalWorkspaceFiles = await snapshotWorkspace();
    await writeFile(
      join(fixtureRoot, 'server.js'),
      'console.error("backend import timed out");\nsetInterval(() => {}, 1000);\nawait new Promise(() => {});',
    );

    await withProductionDependencyCheckRoot(
      { sourceRoot: fixtureRoot, tempParent },
      async productionCheckRoot => {
        const timedOut = await runBundledBackendImport(productionCheckRoot, { timeoutMs: 100 });
        assert.equal(timedOut.timedOut, true);
        assert.throws(
          () => assertBundledBackendImportSucceeded(timedOut),
          error => {
            assert.match(error.message, /Bundled backend import timed out after 100ms/);
            assert.match(error.message, /signal SIGTERM/);
            assert.match(error.message, /\[stderr\][\s\S]*backend import timed out/);
            return true;
          },
        );
      },
    );

    await assertNoValidationArtifacts(tempParent);
    await assertWorkspaceUnchanged(originalWorkspaceFiles);
  } finally {
    await Promise.all([
      rm(fixtureRoot, { recursive: true, force: true }),
      rm(tempParent, { recursive: true, force: true }),
    ]);
  }
});