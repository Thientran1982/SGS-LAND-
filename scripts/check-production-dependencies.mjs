import { spawn } from 'node:child_process';
import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = resolve(
  process.env.PRODUCTION_DEPENDENCY_SOURCE_ROOT ?? projectRoot,
);
const productionCheckParent = resolve(
  process.env.PRODUCTION_DEPENDENCY_TEMP_PARENT ?? tmpdir(),
);

function run(command, args, options = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      ...options,
      stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    if (options.capture) {
      child.stdout.on('data', chunk => { stdout += chunk; });
      child.stderr.on('data', chunk => { stderr += chunk; });
    }

    const timeout = options.timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          child.kill('SIGTERM');
        }, options.timeoutMs)
      : null;

    child.once('error', error => {
      if (timeout) clearTimeout(timeout);
      rejectRun(error);
    });
    child.once('exit', (code, signal) => {
      if (timeout) clearTimeout(timeout);
      resolveRun({
        code,
        signal,
        stdout,
        stderr,
        timedOut,
        timeoutMs: options.timeoutMs,
      });
    });
  });
}

function processTerminationDetails(result) {
  const details = [];
  if (result.code !== null && result.code !== undefined) {
    details.push(`exit code ${result.code}`);
  }
  if (result.signal) {
    details.push(`signal ${result.signal}`);
  }
  return details.length > 0 ? details.join(', ') : 'unknown termination';
}

function processOutput(result) {
  const output = [];
  if (result.stdout?.trim()) output.push(`[stdout]\n${result.stdout.trim()}`);
  if (result.stderr?.trim()) output.push(`[stderr]\n${result.stderr.trim()}`);
  return output.length > 0 ? `\n${output.join('\n')}` : '';
}

function installationError(result) {
  return new Error(
    `Production dependency installation failed during npm ci --omit=dev ` +
    `(${processTerminationDetails(result)}).${processOutput(result)}`,
  );
}

function importError(result) {
  if (result.timedOut) {
    return new Error(
      `Bundled backend import timed out after ${result.timeoutMs}ms ` +
      `(${processTerminationDetails(result)}).${processOutput(result)}`,
    );
  }

  return new Error(
    `Bundled backend import failed (${processTerminationDetails(result)}).` +
    processOutput(result),
  );
}

export function assertBundledBackendImportSucceeded(importResult) {
  if (importResult.timedOut || importResult.code !== 0) {
    throw importError(importResult);
  }
}

export async function withProductionDependencyCheckRoot(
  {
    sourceRoot: requestedSourceRoot = projectRoot,
    tempParent: requestedTempParent = tmpdir(),
  } = {},
  callback,
) {
  const resolvedSourceRoot = resolve(requestedSourceRoot);
  const resolvedTempParent = resolve(requestedTempParent);
  const productionCheckRoot = await mkdtemp(
    join(resolvedTempParent, 'sgs-production-dependencies-'),
  );

  try {
    const bundlePath = join(resolvedSourceRoot, 'server.js');
    await Promise.all([
      cp(join(resolvedSourceRoot, 'package.json'), join(productionCheckRoot, 'package.json')),
      cp(join(resolvedSourceRoot, 'package-lock.json'), join(productionCheckRoot, 'package-lock.json')),
      cp(bundlePath, join(productionCheckRoot, 'server.js')),
    ]);

    console.log('Installing the production-only dependency set in a temporary directory...');
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    let install;
    try {
      install = await run(npm, ['ci', '--omit=dev', '--no-audit', '--no-fund'], {
        cwd: productionCheckRoot,
        capture: true,
      });
    } catch (error) {
      throw new Error(
        `Production dependency installation could not start during npm ci --omit=dev: ${error.message}`,
        { cause: error },
      );
    }
    if (install.code !== 0) {
      throw installationError(install);
    }

    return await callback(productionCheckRoot);
  } finally {
    await rm(productionCheckRoot, { recursive: true, force: true });
  }
}

export async function runBundledBackendImport(
  productionCheckRoot,
  { timeoutMs = 120_000 } = {},
) {
  console.log('Importing the bundled backend with only production dependencies...');
  return run(
    process.execPath,
    ['--input-type=module', '-e', "await import('./server.js'); process.exit(0)"],
    {
      cwd: productionCheckRoot,
      capture: true,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        PRODUCTION_DEPENDENCY_CHECK: '1',
      },
      timeoutMs,
    },
  );
}

export async function checkProductionDependencies() {
  await withProductionDependencyCheckRoot(
    {
      sourceRoot,
      tempParent: productionCheckParent,
    },
    async productionCheckRoot => {
      const importResult = await runBundledBackendImport(productionCheckRoot);
      assertBundledBackendImportSucceeded(importResult);

      console.log('Production dependency check passed.');
    },
  );
}

const invokedScript = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedScript) {
  await checkProductionDependencies();
}