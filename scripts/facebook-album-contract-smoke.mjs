import { spawnSync } from 'node:child_process';

const result = spawnSync(process.execPath, [
  'node_modules/vitest/vitest.mjs',
  'run',
  '--config',
  'vitest.server.config.ts',
  'server/test/facebookPagePublisher.test.ts',
  '-t',
  'Facebook album contract smoke',
], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    // The suite stubs fetch and uses fake values; it must never contact Facebook.
    FB_GRAPH_VERSION: 'v19.0',
  },
  stdio: 'inherit',
});

process.exit(result.status ?? 1);