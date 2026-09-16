import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const script = join(process.cwd(), "scripts", "check-publish-size.sh");

function run(root, budget) {
  return spawnSync("bash", [script], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PUBLISH_SIZE_ROOT: root,
      PUBLISH_SIZE_BUDGET_GIB: String(budget),
    },
    encoding: "utf8",
  });
}

test("passes a small publish workspace under the budget", async () => {
  const root = await mkdtemp(join(tmpdir(), "publish-size-pass-"));
  try {
    await mkdir(join(root, "dist"));
    await writeFile(join(root, "dist", "server.js"), "runtime");

    const result = run(root, 1);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /OK: enough headroom/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("fails with the largest paths when the budget is exceeded", async () => {
  const root = await mkdtemp(join(tmpdir(), "publish-size-fail-"));
  try {
    await mkdir(join(root, "large-runtime"));
    await writeFile(join(root, "large-runtime", "artifact.bin"), "runtime");

    const result = run(root, 0);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /exceeds the safety budget/);
    assert.match(result.stderr, /large-runtime/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});