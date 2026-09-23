// SPDX-License-Identifier: MIT
import path from 'node:path';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { checkCore } from './core-checks.mjs';
import { createTsLoader } from '../lib/tsload.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const result = checkCore(root);
const load = createTsLoader();
const pipeline = load(path.join(root, 'src/inscription/pipeline.ts')).runInscriptionPipeline;
const c = load(path.join(root, 'src/inscription/changes.ts'));
// Synthetic catalog exercises the browser-safe injection path, not textual evidence.
const catalog = { schema: 'wenyan.changes.catalog.v1', entries: Array.from(c.hexagrams(), (bits, i) => ({
  ordinal: i + 1, name: `例${i}`, bits, statement: { text: 'synthetic', source: {} }, extra: [],
  lines: Array.from({ length: 6 }, (_, j) => ({ position: j + 1, label: 'fixture', text: 'synthetic', source: {} })),
})) };
const text = '觀「例0」之初爻。';
const plain = JSON.parse(JSON.stringify(pipeline(text, { steps: 2 })));
const opt = JSON.parse(JSON.stringify(pipeline(text, { steps: 2, changes: { catalog } })));
assert.equal(opt.changes.status, 'IndexedText'); delete opt.changes;
assert.deepEqual(opt, plain);
assert.equal(pipeline(text, { changes: { catalog: {} }, safety: { requireAcknowledgement: true } }).blocked, true);
// Standard compiler syntax and its default pipeline entry remain untouched.
assert.ok(fs.readFileSync(path.join(root, 'src/parser.ts'), 'utf8').includes('readSyllogism,'));
console.log(JSON.stringify({ ...result, optIn: true, legacyFieldsEqual: true, sourceText: 'synthetic fixture only' }, null, 2));
