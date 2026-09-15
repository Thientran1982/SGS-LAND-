import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_ROUTER_INSTRUCTION } from '../server/ai/defaultPrompts';
import { ROUTER_EXTRACTION_FIELDS, ROUTER_SCHEMA } from '../server/ai/routerSchema';

type JsonObject = Record<string, unknown>;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const extractionProperties = (ROUTER_SCHEMA.properties?.extraction as JsonObject)?.properties as JsonObject;
const schemaFields = new Set(Object.keys(extractionProperties || {}));
const declaredFields = new Set<string>(ROUTER_EXTRACTION_FIELDS);

function promptExtractionFields(prompt: string): Set<string> {
  const block = prompt.match(/"extraction"\s*:\s*\{([\s\S]*?)\n\s*\},\s*\n\s*"persona_signals"/)?.[1];
  if (!block) throw new Error('Could not find the extraction object in DEFAULT_ROUTER_INSTRUCTION');
  return new Set([...block.matchAll(/^\s*"([A-Za-z][A-Za-z0-9_]*)"\s*:/gm)].map(match => match[1]));
}

function serverExtractionFields(source: string): Set<string> {
  // These are the fields accessed by the production orchestration code. The
  // shared RouterExtraction type also makes new accesses fail typecheck unless
  // the field is added to the contract first.
  return new Set([
    ...[...source.matchAll(/\b(?:extraction|ext)\??\.([A-Za-z][A-Za-z0-9_]*)/g)].map(match => match[1]),
    ...[...source.matchAll(/\bextraction\s*\[\s*['"]([A-Za-z][A-Za-z0-9_]*)['"]\s*\]/g)].map(match => match[1]),
  ]);
}

function goldExtractionFields(value: unknown): Set<string> {
  const cases = (value as { cases?: Array<{ expectedExtraction?: JsonObject }> })?.cases || [];
  return new Set(cases.flatMap(testCase => Object.keys(testCase.expectedExtraction || {})));
}

function sorted(values: Set<string>): string[] {
  return [...values].sort();
}

function report(label: string, fields: Set<string>): string[] {
  const missing = sorted(new Set([...fields].filter(field => !schemaFields.has(field))));
  return missing.length ? [`- ${label} -> ROUTER_SCHEMA thiếu: ${missing.join(', ')}`] : [];
}

const promptFields = promptExtractionFields(DEFAULT_ROUTER_INSTRUCTION);
const serverSource = fs.readFileSync(path.join(root, 'server/ai.ts'), 'utf8');
const goldSet = JSON.parse(fs.readFileSync(path.join(root, 'seed/eval/agent-goldset.json'), 'utf8')) as unknown;
const serverFields = serverExtractionFields(serverSource);
const goldFields = goldExtractionFields(goldSet);
const errors = [
  ...report('ROUTER_EXTRACTION_FIELDS', declaredFields),
  ...report('Prompt extraction', promptFields),
  ...report('server/ai.ts extraction access', serverFields),
  ...report('seed/eval/agent-goldset.json expectedExtraction', goldFields),
];

const promptOnly = sorted(new Set([...promptFields].filter(field => !schemaFields.has(field))));
const schemaOnly = sorted(new Set([...schemaFields].filter(field => !promptFields.has(field))));
const declaredOnly = sorted(new Set([...declaredFields].filter(field => !schemaFields.has(field))));
const undeclaredSchema = sorted(new Set([...schemaFields].filter(field => !declaredFields.has(field))));

if (promptOnly.length || schemaOnly.length || declaredOnly.length || undeclaredSchema.length || errors.length) {
  console.error('Router extraction schema drift detected.');
  if (promptOnly.length) console.error(`- Prompt có nhưng ROUTER_SCHEMA thiếu: ${promptOnly.join(', ')}`);
  if (schemaOnly.length) console.error(`- ROUTER_SCHEMA có nhưng prompt thiếu: ${schemaOnly.join(', ')}`);
  if (declaredOnly.length) console.error(`- ROUTER_EXTRACTION_FIELDS có nhưng ROUTER_SCHEMA thiếu: ${declaredOnly.join(', ')}`);
  if (undeclaredSchema.length) console.error(`- ROUTER_SCHEMA có nhưng ROUTER_EXTRACTION_FIELDS thiếu: ${undeclaredSchema.join(', ')}`);
  for (const error of errors) console.error(error);
  process.exit(1);
}

console.log(`Router extraction schema OK (${schemaFields.size} fields).`);
console.log(`Compared prompt, server/ai.ts, scripts/eval-agents.ts shared schema, and ${goldFields.size} gold-set fields.`);