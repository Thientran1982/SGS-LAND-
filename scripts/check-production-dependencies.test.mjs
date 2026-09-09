import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const checkerPath = join(projectRoot, 'scripts', 'check-production-dependencies.mjs');
const fixtureFiles = ['package.json', 'package-lock.json', 'server.js'];

function runChecker(sourceRoot, tempParent) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [checkerPath], {
      cwd: projectRoot,
      env: {
        ...process.env,
        PRODUCTION_DEPENDENCY_SOURCE_ROOT: sourceRoot,
        PRODUCTION_DEPENDENCY_TEMP_PARENT: tempParent,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.once('error', rejectRun);
    child.once('close', (code, signal) => resolveRun({ code, signal, stdout, stderr }));
  });
}

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

    await writeFile(
      join(fixtureRoot, 'server.js'),
      `import 'vitest';\n${generatedBundle}`,
    );
    const failed = await runChecker(fixtureRoot, tempParent);
    const failedOutput = `${failed.stdout}\n${failed.stderr}`;

    assert.notEqual(failed.code, 0, 'a dev-only runtime import must fail validation');
    assert.match(failedOutput, /Bundled backend import failed/);
    assert.match(failedOutput, /Cannot find package ['"]vitest['"]/);
    await assertNoValidationArtifacts(tempParent);

    await writeFile(join(fixtureRoot, 'server.js'), generatedBundle);
    const passed = await runChecker(fixtureRoot, tempParent);
    const passedOutput = `${passed.stdout}\n${passed.stderr}`;

    assert.equal(passed.code, 0, passedOutput);
    assert.match(passedOutput, /Production dependency check passed/);
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