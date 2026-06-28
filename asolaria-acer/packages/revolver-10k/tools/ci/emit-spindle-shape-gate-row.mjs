#!/usr/bin/env node
// emit-spindle-shape-gate-row.mjs — append a single HBPv1 promote=1 row to
// data/ci-gates/spindle-shape-gate.hbp recording the gate-canon lock.
// Antecedent: seq=191. Authority surface fail-closed.
import { existsSync, mkdirSync, readFileSync, appendFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { appendChain } from '../../src/hermes-disc/chain.mjs';
import { parseHbpRow } from '../../src/hermes-disc/hbp-row.mjs';
import { writeAllSidecars } from '../../src/hermes-disc/sidecars.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = resolve(HERE, '..', '..');
const OUT = resolve(PKG_ROOT, 'data', 'ci-gates', 'spindle-shape-gate.hbp');

const CHAIN_ID = 'WAVE-CI-GATES';

// Rebuild in-memory chain state from existing file, if any.
const chains = new Map();
if (existsSync(OUT)) {
  const text = readFileSync(OUT, 'utf-8');
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith('HBPv1|')) continue;
    const parsed = parseHbpRow(line);
    const cid = parsed.fields.chain_id;
    if (!chains.has(cid)) chains.set(cid, []);
    chains.get(cid).push(parsed);
  }
}

const seed = {
  layer: 'ci-gate',
  pid: 'AGT-M5-SPINDLE-CI-GATE-PID-2026-05-19',
  prof: 'public-ci-descriptor',
  supervisor: 'prometheus',
  tuple: 'ci:spindle-shape:gate:1m3s-OR-1m5s',
  triple_quant: 'gate/canon/promote',
  polar_quant: 'describe/execute',
  js_quant: 'johnson-slithechen-public',
  turbo_quant: 'packet-first',
  // Authority surface fail-closed (schema-enforced). Promote-intent recorded
  // in non-authority field `gate_promote_intent` per Hermes discipline.
  json: '0', runtime: '0', promote: '0',
  gate_promote_intent: '1',
  status: 'WAVE_DESCRIBED',
  gate_status: 'GATE_CANON_LOCKED',
  gate_id: 'spindle-shape',
  canon: '1-main-plus-3-OR-5-subs',
  enforced_paths: 'packages/revolver-10k/data/**/*.hbp',
  check_tool: 'tools/ci/check-spindle-shape.mjs',
  workflow: '.github/workflows/spindle-shape.yml',
  selftest_file: 'tmp/spindle-builder-selftest.hbp',
  phoebe_prime: '4',
  operator_directive_seq: '191',
  antecedent_seq: '191',
  cp_supervisor: '64',
  authority_surface: 'fail-closed',
  acceptance: 'exit-0-on-canonical-shape',
};

const row = appendChain(chains, CHAIN_ID, seed);
mkdirSync(dirname(OUT), { recursive: true });
if (existsSync(OUT)) appendFileSync(OUT, row.raw + '\n', 'utf-8');
else writeFileSync(OUT, row.raw + '\n', 'utf-8');
writeAllSidecars(OUT);

process.stdout.write(
  `emit-spindle-shape-gate-row chain=${CHAIN_ID} sequence=${row.fields.sequence} ` +
  `row_hash=${row.fields.row_hash} out=${OUT.replace(/\\/g, '/')}\n`,
);
