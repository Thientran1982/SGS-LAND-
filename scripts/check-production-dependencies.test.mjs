import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  runBundledBackendImport,
  withProductionDependencyCheckRoot,
} from './check-production-dependencies.mjs';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixtureFiles = ['package.json', 'package-lock.json', 'server.js'];

async function assertNoValidationArtifacts(tempParent) {
  assert.deepEqual(await readdir(tempParent), []);
}

test('validates production dependencies without mutating the workspace', async () => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'sgs-production-dependency-fixture-'));
  const tempParent = await mkdtemp(join(tmpdir(), 'sgs-production-dependency-parent-'));

  try {
    await Promise.all(
      fixtureFiles.map(file => cp(join(projectRoot, file), join(fixtureRoot, file))),
    );
    const originalWorkspaceFiles = await Promise.all(
      fixtureFiles.map(async file => [file, await readFile(join(projectRoot, file))]),
    );
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

        await writeFile(join(productionCheckRoot, 'server.js'), generatedBundle);
        const passed = await runBundledBackendImport(productionCheckRoot);
        const passedOutput = `${passed.stdout}\n${passed.stderr}`;

        assert.equal(passed.code, 0, passedOutput);
      },
    );

    await assertNoValidationArtifacts(tempParent);
    assert.deepEqual((await readdir(fixtureRoot)).sort(), fixtureFiles.sort());

    for (const [file, original] of originalWorkspaceFiles) {
      assert.deepEqual(
        await readFile(join(projectRoot, file)),
        original,
        `${file} in the developer workspace was modified`,
      );
    }
  } finally {
    await Promise.all([
      rm(fixtureRoot, { recursive: true, force: true }),
      rm(tempParent, { recursive: true, force: true }),
    ]);
  }
});