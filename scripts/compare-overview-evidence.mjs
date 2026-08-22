import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const value = process.argv[index];
  if (value.startsWith('--')) args.set(value, process.argv[index + 1]);
}

const localRoot = args.get('--local');
const deployedRoot = args.get('--deployed');
const outputRoot = args.get('--output') || 'overview-comparison';
const thresholdsPath = args.get('--thresholds');
const exceptionsPath = args.get('--exceptions');
if (!localRoot || !deployedRoot) {
  console.error('Usage: node scripts/compare-overview-evidence.mjs --local <dir> --deployed <dir> [--output <dir>] [--thresholds <file>] [--exceptions <file>]');
  process.exit(1);
}

async function readJson(file, fallback) {
  if (!file) return fallback;
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (error) {
    console.error(`Could not read JSON policy ${file}: ${error.message}`);
    process.exit(1);
  }
}

const thresholdPolicy = await readJson(thresholdsPath, {});
const configuredThresholds = thresholdPolicy.viewports || thresholdPolicy;
const configuredExceptions = await readJson(exceptionsPath, []);
const exceptions = Array.isArray(configuredExceptions)
  ? configuredExceptions
  : configuredExceptions.exceptions || [];

const typeFor = (file) => {
  const lower = file.toLowerCase();
  if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.webp')) return 'screenshot';
  if (lower.endsWith('.zip') || lower.endsWith('.trace')) return 'trace';
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'html';
  if (lower.includes('request-trace') || lower.endsWith('.json')) return 'request-trace';
  return 'other';
};

const viewportFor = (file, content) => {
  const match = file.match(/overview-(desktop|tablet|mobile)/i) || file.match(/(desktop|tablet|mobile)/i);
  if (match) return match[1].toLowerCase();
  if (typeFor(file) === 'request-trace') {
    try {
      const viewport = JSON.parse(content).viewport;
      if (viewport?.width >= 1200) return 'desktop';
      if (viewport?.width >= 700) return 'tablet';
      if (viewport?.width) return 'mobile';
    } catch {
      // The file is still compared as an opaque artifact when it is not JSON.
    }
  }
  return 'all';
};

async function filesUnder(root) {
  const result = new Map();
  async function visit(directory) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      else result.set(path.relative(root, absolute).split(path.sep).join('/'), absolute);
    }
  }
  try {
    await visit(root);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  return result;
}

function normalizedJson(value) {
  return JSON.stringify(value, (key, child) => {
    if (key === 'url' && typeof child === 'string') {
      try {
        const url = new URL(child);
        return `<origin>${url.pathname}${url.search}${url.hash}`;
      } catch {
        return child;
      }
    }
    return child;
  }, 2);
}

async function digest(file, type) {
  const buffer = await fs.readFile(file);
  if (type === 'request-trace') {
    try {
      return createHash('sha256').update(normalizedJson(JSON.parse(buffer.toString()))).digest('hex');
    } catch {
      // Fall through to byte hashing for malformed or non-JSON trace files.
    }
  }
  return createHash('sha256').update(buffer).digest('hex');
}

async function imageDifference(localFile, deployedFile) {
  try {
    const [local, deployed] = await Promise.all([
      sharp(localFile).raw().toBuffer({ resolveWithObject: true }),
      sharp(deployedFile).raw().toBuffer({ resolveWithObject: true }),
    ]);
    if (local.info.width !== deployed.info.width || local.info.height !== deployed.info.height || local.info.channels !== deployed.info.channels) {
      return { changedPixels: null, totalPixels: local.info.width * local.info.height, dimensionsChanged: true };
    }
    let changedPixels = 0;
    let totalDelta = 0;
    for (let index = 0; index < local.data.length; index += 1) {
      const delta = Math.abs(local.data[index] - deployed.data[index]);
      if (delta > 0) changedPixels += 1;
      totalDelta += delta;
    }
    return {
      changedPixels: Math.ceil(changedPixels / local.info.channels),
      totalPixels: local.info.width * local.info.height,
      meanAbsoluteDelta: Number((totalDelta / local.data.length).toFixed(3)),
      dimensionsChanged: false,
    };
  } catch (error) {
    return { comparisonError: error.message };
  }
}

function thresholdFor(viewport) {
  return configuredThresholds[viewport] || configuredThresholds.all || null;
}

function exceptionFor(item) {
  return exceptions.find((exception) =>
    (exception.artifact === item.artifact || exception.artifact === '*') &&
    (!exception.viewport || exception.viewport === item.viewport || exception.viewport === '*')
  ) || null;
}

function evaluateImage(item) {
  const image = item.image;
  const thresholds = thresholdFor(item.viewport);
  if (!image || !thresholds) return null;
  const changedPixelRatio = image.totalPixels
    ? Number((image.changedPixels / image.totalPixels).toFixed(6))
    : null;
  const exceeded = image.dimensionsChanged ||
    (thresholds.maxChangedPixels != null && image.changedPixels > thresholds.maxChangedPixels) ||
    (thresholds.maxChangedPixelRatio != null && changedPixelRatio > thresholds.maxChangedPixelRatio) ||
    (thresholds.maxMeanAbsoluteDelta != null && image.meanAbsoluteDelta > thresholds.maxMeanAbsoluteDelta);
  const exception = exceeded ? exceptionFor(item) : null;
  return {
    changedPixelRatio,
    thresholds,
    exceeded,
    exception: exception ? { reason: exception.reason || 'No reason supplied' } : null,
  };
}

function displayValue(value) {
  return value == null ? 'not measured' : String(value);
}

function thresholdDetails(evaluation) {
  if (!evaluation?.thresholds) return 'no configured visual limit';
  const limits = [];
  if (evaluation.thresholds.maxChangedPixels != null) {
    limits.push(`changed pixels ≤ ${evaluation.thresholds.maxChangedPixels}`);
  }
  if (evaluation.thresholds.maxChangedPixelRatio != null) {
    limits.push(`ratio ≤ ${evaluation.thresholds.maxChangedPixelRatio}`);
  }
  if (evaluation.thresholds.maxMeanAbsoluteDelta != null) {
    limits.push(`mean delta ≤ ${evaluation.thresholds.maxMeanAbsoluteDelta}`);
  }
  return limits.length ? limits.join('; ') : 'no configured visual limit';
}

function regressionSummary(item) {
  const evaluation = item.evaluation;
  const image = item.image;
  if (!evaluation || !image) {
    return `- **${item.artifact}** — viewport: \`${item.viewport}\`; ${item.status === 'changed' ? 'content digest differs' : 'artifact only present on one side'}.`;
  }
  return [
    `- **${item.artifact}** — viewport: \`${item.viewport}\`;`,
    `changed-pixel ratio: **${displayValue(evaluation.changedPixelRatio)}**`,
    `(limit: ${evaluation.thresholds?.maxChangedPixelRatio ?? 'not configured'});`,
    `mean absolute delta: **${displayValue(image.meanAbsoluteDelta)}**`,
    `(limit: ${evaluation.thresholds?.maxMeanAbsoluteDelta ?? 'not configured'});`,
    `configured limits: ${thresholdDetails(evaluation)}.`,
  ].join(' ');
}

const RELEASE_SUMMARY_DETAIL_LIMIT = 12;

function compactRegressionIndex(items) {
  const byViewport = new Map();
  for (const item of items) {
    const artifacts = byViewport.get(item.viewport) || [];
    artifacts.push(item.artifact);
    byViewport.set(item.viewport, artifacts);
  }
  return [
    '| Viewport | Blocked artifacts | Count |',
    '| --- | --- | ---: |',
    ...[...byViewport.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([viewport, artifacts]) => `| \`${viewport}\` | ${artifacts.join('<br>')} | ${artifacts.length} |`),
  ];
}

function compactReleaseSection(title, items, detailLabel) {
  if (items.length <= RELEASE_SUMMARY_DETAIL_LIMIT) {
    return [title, '', ...items.map(regressionSummary), ''];
  }
  return [
    title,
    '',
    `All ${items.length} ${detailLabel} are represented below. Expand the details for measured values and configured limits; the complete evidence report remains available as an uploaded artifact.`,
    '',
    ...compactRegressionIndex(items),
    '',
    '<details>',
    `<summary>Show ${items.length} ${detailLabel} details</summary>`,
    '',
    ...items.map(regressionSummary),
    '',
    '</details>',
    '',
  ];
}

const [localFiles, deployedFiles] = await Promise.all([filesUnder(localRoot), filesUnder(deployedRoot)]);
const names = [...new Set([...localFiles.keys(), ...deployedFiles.keys()])].sort();
const differences = [];
for (const name of names) {
  const localFile = localFiles.get(name);
  const deployedFile = deployedFiles.get(name);
  const type = typeFor(name);
  const content = localFile ? await fs.readFile(localFile, 'utf8').catch(() => '') : '';
  const difference = {
    artifact: name,
    type,
    viewport: viewportFor(name, content),
    status: !localFile ? 'added-in-deployed' : !deployedFile ? 'missing-in-deployed' : 'changed',
  };
  if (localFile && deployedFile) {
    difference.localSha256 = await digest(localFile, type);
    difference.deployedSha256 = await digest(deployedFile, type);
    if (difference.localSha256 === difference.deployedSha256) continue;
    if (type === 'screenshot') {
      difference.image = await imageDifference(localFile, deployedFile);
      difference.evaluation = evaluateImage(difference);
    }
  }
  differences.push(difference);
}

const report = {
  generatedAt: new Date().toISOString(),
  localRoot,
  deployedRoot,
  comparedArtifacts: names.length,
  differences,
  summary: {
    changed: differences.filter((item) => item.status === 'changed').length,
    addedInDeployed: differences.filter((item) => item.status === 'added-in-deployed').length,
    missingInDeployed: differences.filter((item) => item.status === 'missing-in-deployed').length,
    thresholdExceeded: differences.filter((item) => item.evaluation?.exceeded && !item.evaluation.exception).length,
    expectedExceptions: differences.filter((item) => item.evaluation?.exception).length,
  },
};
await fs.mkdir(outputRoot, { recursive: true });
await fs.writeFile(path.join(outputRoot, 'overview-evidence-comparison.json'), `${JSON.stringify(report, null, 2)}\n`);
const lines = [
  '# Overview evidence comparison',
  '',
  `Compared ${report.comparedArtifacts} artifacts. ${differences.length} difference(s) found.`,
  '',
  '| Viewport | Artifact type | Status | Artifact | Detail |',
  '| --- | --- | --- | --- | --- |',
];
for (const item of differences) {
  const evaluation = item.evaluation;
  const detail = item.image
    ? `${item.image.changedPixels ?? 'dimension'} pixels changed${item.image.meanAbsoluteDelta == null ? '' : ` (mean delta ${item.image.meanAbsoluteDelta})`}${evaluation?.changedPixelRatio == null ? '' : ` (ratio ${evaluation.changedPixelRatio})`}`
    : item.status === 'changed' ? 'content digest differs' : 'artifact only present on one side';
  const disposition = evaluation?.exception
    ? `expected exception: ${evaluation.exception.reason}`
    : evaluation?.exceeded
      ? 'THRESHOLD EXCEEDED'
      : item.status;
  lines.push(`| ${item.viewport} | ${item.type} | ${disposition} | ${item.artifact} | ${detail}${evaluation?.thresholds ? `; limits: ${JSON.stringify(evaluation.thresholds)}` : ''} |`);
}
if (!differences.length) lines.push('| all | all | identical | — | No differences detected |');
await fs.writeFile(path.join(outputRoot, 'overview-evidence-comparison.md'), `${lines.join('\n')}\n`);
const failures = differences.filter((item) => item.evaluation?.exceeded && !item.evaluation.exception);
const reviewedExceptions = differences.filter((item) => item.evaluation?.exception);
const summaryLines = [
  '# Overview visual regression release check',
  '',
  failures.length
    ? `**Blocked:** ${failures.length} unapproved visual regression${failures.length === 1 ? '' : 's'} exceeded the configured limit${failures.length === 1 ? '' : 's'}.`
    : '**Passed:** no unapproved visual regression exceeded its configured limit.',
  '',
];
if (failures.length) {
  summaryLines.push(...compactReleaseSection('## Blocked regressions', failures, 'unapproved blocked regressions'));
}
if (reviewedExceptions.length) {
  summaryLines.push('## Reviewed exceptions', '', 'These differences are covered by a reviewed exception and did not block the release:', '');
  if (reviewedExceptions.length <= RELEASE_SUMMARY_DETAIL_LIMIT) {
    summaryLines.push(...reviewedExceptions.map((item) => `${regressionSummary(item)} Reviewed exception: ${item.evaluation.exception.reason}`), '');
  } else {
    summaryLines.push(
      `All ${reviewedExceptions.length} reviewed exceptions remain separate from blocked regressions. Expand the details for reasons and measured values.`,
      '',
      ...compactRegressionIndex(reviewedExceptions),
      '',
      '<details>',
      `<summary>Show ${reviewedExceptions.length} reviewed exception details</summary>`,
      '',
      ...reviewedExceptions.map((item) => `${regressionSummary(item)} Reviewed exception: ${item.evaluation.exception.reason}`),
      '',
      '</details>',
      '',
    );
  }
}
summaryLines.push(
  'Complete evidence: `overview-evidence-comparison.json` and `overview-evidence-comparison.md`.',
  '',
);
await fs.writeFile(path.join(outputRoot, 'overview-release-summary.md'), `${summaryLines.join('\n')}\n`);
if (failures.length) {
  for (const item of failures) {
    console.error(`::error title=Overview visual regression::${item.artifact} (${item.viewport}) exceeded its visual threshold: ratio ${displayValue(item.evaluation.changedPixelRatio)} (limit ${item.evaluation.thresholds?.maxChangedPixelRatio ?? 'not configured'}), mean delta ${displayValue(item.image?.meanAbsoluteDelta)} (limit ${item.evaluation.thresholds?.maxMeanAbsoluteDelta ?? 'not configured'}). See overview-release-summary.md for details.`);
  }
  process.exitCode = 1;
}
console.log(`Compared ${report.comparedArtifacts} artifacts; found ${differences.length} difference(s); ${failures.length} threshold failure(s).`);