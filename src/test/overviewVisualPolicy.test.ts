import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";
import { describe, expect, it, afterEach } from "vitest";

const execFileAsync = promisify(execFile);
const comparisonScript = path.resolve("scripts/compare-overview-evidence.mjs");
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(directory => rm(directory, { recursive: true, force: true })));
});

async function createComparison() {
  const root = await mkdtemp(path.join(tmpdir(), "overview-visual-policy-"));
  temporaryDirectories.push(root);
  const local = path.join(root, "local");
  const deployed = path.join(root, "deployed");
  const output = path.join(root, "output");
  await Promise.all([
    writeFile(path.join(root, "thresholds.json"), "{}"),
    writeFile(path.join(root, "exceptions.json"), "[]"),
    mkdir(local, { recursive: true }),
    mkdir(deployed, { recursive: true }),
  ]);
  return { root, local, deployed, output };
}

async function writeImage(file: string, width: number, height: number, changedPixels = 0, channelDelta = 0) {
  const data = Buffer.alloc(width * height * 3);
  for (let pixel = 0; pixel < changedPixels; pixel += 1) {
    data[pixel * 3] = channelDelta;
    data[pixel * 3 + 1] = channelDelta;
    data[pixel * 3 + 2] = channelDelta;
  }
  await sharp(data, { raw: { width, height, channels: 3 } }).png().toFile(file);
}

async function runComparison(
  fixture: Awaited<ReturnType<typeof createComparison>>,
  thresholds: unknown,
  exceptions: unknown = [],
  expectFailure = false,
  viewport = "desktop",
  changedPixels = 1,
  channelDelta = 1,
  width = 10,
  height = 10,
  deployedWidth = width,
  deployedHeight = height,
) {
  await Promise.all([
    writeFile(path.join(fixture.root, "thresholds.json"), JSON.stringify(thresholds)),
    writeFile(path.join(fixture.root, "exceptions.json"), JSON.stringify(exceptions)),
    writeImage(path.join(fixture.local, `overview-${viewport}.png`), width, height),
    writeImage(path.join(fixture.deployed, `overview-${viewport}.png`), deployedWidth, deployedHeight, changedPixels, channelDelta),
  ]);
  try {
    await execFileAsync(process.execPath, [
      comparisonScript,
      "--local", fixture.local,
      "--deployed", fixture.deployed,
      "--output", fixture.output,
      "--thresholds", path.join(fixture.root, "thresholds.json"),
      "--exceptions", path.join(fixture.root, "exceptions.json"),
    ]);
    if (expectFailure) throw new Error("comparison unexpectedly passed");
  } catch (error) {
    if (!expectFailure) throw error;
    expect((error as { code?: number }).code).toBe(1);
  }
  return JSON.parse(await readFile(path.join(fixture.output, "overview-evidence-comparison.json"), "utf8"));
}

describe("overview visual comparison policy", () => {
  for (const viewport of ["desktop", "tablet", "mobile"]) {
    it(`${viewport} allows changed-pixel ratio at the limit and blocks above it`, async () => {
      const fixture = await createComparison();
      const allowed = await runComparison(fixture, {
        viewports: { [viewport]: { maxChangedPixelRatio: 0.01 } },
      }, [], false, viewport);
      expect(allowed.summary.thresholdExceeded).toBe(0);

      const blocked = await runComparison(fixture, {
        viewports: { [viewport]: { maxChangedPixelRatio: 0.01 } },
      }, [], true, viewport, 2, 1);
      expect(blocked.summary.thresholdExceeded).toBe(1);
    });

    it(`${viewport} allows mean delta at the limit and blocks above it`, async () => {
      const fixture = await createComparison();
      const allowed = await runComparison(fixture, {
        viewports: { [viewport]: { maxMeanAbsoluteDelta: 2 } },
      }, [], false, viewport, 100, 2);
      expect(allowed.summary.thresholdExceeded).toBe(0);

      const blocked = await runComparison(fixture, {
        viewports: { [viewport]: { maxMeanAbsoluteDelta: 2 } },
      }, [], true, viewport, 100, 3);
      expect(blocked.summary.thresholdExceeded).toBe(1);
    });
  }

  it("blocks dimension changes even when no pixel threshold is exceeded", async () => {
    const fixture = await createComparison();
    const report = await runComparison(fixture, { viewports: { desktop: {} } }, [], true, "desktop", 0, 0, 10, 10, 11, 10);
    expect(report.differences[0].image.dimensionsChanged).toBe(true);
    expect(report.summary.thresholdExceeded).toBe(1);
  });

  it.each(["thresholds", "exceptions"])("fails clearly for malformed %s policy JSON", async policy => {
    const fixture = await createComparison();
    const policyPath = path.join(fixture.root, `${policy}.json`);
    await writeFile(policyPath, "{not-json");
    await expect(execFileAsync(process.execPath, [
      comparisonScript, "--local", fixture.local, "--deployed", fixture.deployed,
      "--output", fixture.output, "--thresholds", path.join(fixture.root, "thresholds.json"),
      "--exceptions", path.join(fixture.root, "exceptions.json"),
    ])).rejects.toMatchObject({ code: 1 });
  });

  it("suppresses only the reviewed artifact and viewport while reporting the exception", async () => {
    const fixture = await createComparison();
    await Promise.all([
      writeImage(path.join(fixture.local, "overview-mobile.png"), 10, 10),
      writeImage(path.join(fixture.deployed, "overview-mobile.png"), 10, 10, 2, 1),
      writeImage(path.join(fixture.local, "overview-tablet.png"), 10, 10),
      writeImage(path.join(fixture.deployed, "overview-tablet.png"), 10, 10, 2, 1),
    ]);
    const exception = { artifact: "overview-mobile.png", viewport: "mobile", reason: "Reviewed mobile rendering change" };
    const report = await runComparison(fixture, {
      viewports: {
        mobile: { maxChangedPixelRatio: 0.01 },
        tablet: { maxChangedPixelRatio: 0.01 },
      },
    }, [exception], true);
    const mobile = report.differences.find((item: { artifact: string }) => item.artifact === "overview-mobile.png");
    const tablet = report.differences.find((item: { artifact: string }) => item.artifact === "overview-tablet.png");
    expect(mobile.evaluation.exception).toEqual({ reason: exception.reason });
    expect(tablet.evaluation.exception).toBeNull();
    expect(report.summary.expectedExceptions).toBe(1);
    expect(report.summary.thresholdExceeded).toBe(1);
    expect(await readFile(path.join(fixture.output, "overview-evidence-comparison.md"), "utf8"))
      .toContain("expected exception: Reviewed mobile rendering change");
    const summary = await readFile(path.join(fixture.output, "overview-release-summary.md"), "utf8");
    expect(summary).toContain("## Blocked regressions");
    expect(summary).toContain("viewport: `tablet`");
    expect(summary).toContain("changed-pixel ratio: **0.02** (limit: 0.01)");
    expect(summary).toContain("mean absolute delta: **0.02** (limit: not configured)");
    expect(summary).toContain("## Reviewed exceptions");
    expect(summary).toContain("Reviewed exception: Reviewed mobile rendering change");
  });
});