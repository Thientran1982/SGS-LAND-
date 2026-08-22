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
if (!localRoot || !deployedRoot) {
  console.error('Usage: node scripts/compare-overview-evidence.mjs --local <dir> --deployed <dir> [--output <dir>]');
  process.exit(1);
}

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
    if (type === 'screenshot') difference.image = await imageDifference(localFile, deployedFile);
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
  const detail = item.image
    ? `${item.image.changedPixels ?? 'dimension'} pixels changed${item.image.meanAbsoluteDelta == null ? '' : ` (mean delta ${item.image.meanAbsoluteDelta})`}`
    : item.status === 'changed' ? 'content digest differs' : 'artifact only present on one side';
  lines.push(`| ${item.viewport} | ${item.type} | ${item.status} | ${item.artifact} | ${detail} |`);
}
if (!differences.length) lines.push('| all | all | identical | — | No differences detected |');
await fs.writeFile(path.join(outputRoot, 'overview-evidence-comparison.md'), `${lines.join('\n')}\n`);
console.log(`Compared ${report.comparedArtifacts} artifacts; found ${differences.length} difference(s).`);