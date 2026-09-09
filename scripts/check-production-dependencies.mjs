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

    if (options.capture) {
      child.stdout.on('data', chunk => { stdout += chunk; });
      child.stderr.on('data', chunk => { stderr += chunk; });
    }

    const timeout = options.timeoutMs
      ? setTimeout(() => {
          child.kill('SIGTERM');
          rejectRun(new Error(`${command} ${args.join(' ')} timed out after ${options.timeoutMs}ms`));
        }, options.timeoutMs)
      : null;

    child.once('error', error => {
      if (timeout) clearTimeout(timeout);
      rejectRun(error);
    });
    child.once('exit', (code, signal) => {
      if (timeout) clearTimeout(timeout);
      resolveRun({ code, signal, stdout, stderr });
    });
  });
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
    const install = await run(npm, ['ci', '--omit=dev', '--no-audit', '--no-fund'], {
      cwd: productionCheckRoot,
    });
    if (install.code !== 0) {
      throw new Error(`npm ci --omit=dev failed with exit code ${install.code ?? 'unknown'}`);
    }

    return await callback(productionCheckRoot);
  } finally {
    await rm(productionCheckRoot, { recursive: true, force: true });
  }
}

export async function runBundledBackendImport(productionCheckRoot) {
  console.log('Importing the bundled backend with only production dependencies...');
  return run(
    process.execPath,
    ['--input-type=module', '-e', "await import('./server.js'); process.exit(0)"],
    {
      cwd: productionCheckRoot,
      capture: true,
      timeoutMs: 120_000,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        PRODUCTION_DEPENDENCY_CHECK: '1',
      },
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
      if (importResult.code !== 0) {
        const output = [importResult.stdout, importResult.stderr].filter(Boolean).join('\n').trim();
        throw new Error(
          `Bundled backend import failed with exit code ${importResult.code ?? `signal ${importResult.signal}`}.` +
          (output ? `\n${output}` : ''),
        );
      }

      console.log('Production dependency check passed.');
    },
  );
}

const invokedScript = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedScript) {
  await checkProductionDependencies();
}