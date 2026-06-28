// spindle-builder.mjs — 1-main + 3-subagent spindle as 4 chained HBPv1 rows.
// Mirrors Hermes wave_templates.py::mcp_webmcp_wave_rows() row shape so the
// resulting packet verifies via bin/hbp-verify.mjs.
//
// On-wire format: pipe-delimited HBPv1 rows. No JSON. Authority surface is
// fail-closed (every AUTHORITY_FIELDS entry forced to 0 by hbpRow()).
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { appendChain } from '../hermes-disc/chain.mjs';
import { writeAllSidecars } from '../hermes-disc/sidecars.mjs';
import { verifyPacket } from '../../bin/hbp-verify.mjs';

// Build the seed (fields object) for one row. chain_id/sequence/prev_hash/
// row_hash are filled in by appendChain → hbpRow.
function rowSeed({
  wave_id, spindle_id, slot, role, goal, status, depends_on, class_tag,
}) {
  const pid = `PID-HBH-${wave_id}-${spindle_id}-${slot}`;
  const tuple = `${wave_id}:${spindle_id}:${slot}:${role}`;
  const output_receipt = `RECEIPT-${spindle_id}-${slot}`;
  const input_packet = slot === 'main' ? 'NONE' : 'PREVIOUS';
  return {
    layer: 'spindle-wave',
    pid,
    prof: 'public-wave-descriptor',
    supervisor: 'fail-closed-public',
    tuple,
    triple_quant: 'wave/spindle/receipt',
    polar_quant: 'describe/execute',
    js_quant: 'johnson-slithechen-public',
    turbo_quant: 'packet-first',
    json: '0',
    runtime: '0',
    promote: '0',
    status,
    wave_id,
    spindle_id,
    agent_slot: slot,
    role,
    goal,
    input_packet,
    output_receipt,
    depends_on,
    acceptance: 'packet-first-fail-closed-review',
    mcp_scope: 'describe_only',
    webmcp_scope: 'describe_only',
    class_tag,
  };
}

// buildSpindle({ wave_id, spindle_id, main_role, subagent_roles, goal, class_tag })
// → array of 4 HBPv1 row strings, chained on `WAVE-${wave_id}`.
// Main row first (depends_on=NONE, SPINDLE_MAIN_ASSIGNED).
// Subagent 1/2/3 follow (depends_on=${spindle_id}-main, SPINDLE_SUBAGENT_ASSIGNED).
export function buildSpindle({
  wave_id,
  spindle_id,
  main_role,
  subagent_roles,
  goal,
  class_tag = 'real-free',
}) {
  if (!wave_id || !spindle_id || !main_role || !goal) {
    throw new Error('buildSpindle requires wave_id, spindle_id, main_role, goal');
  }
  const subs = Array.isArray(subagent_roles) ? subagent_roles : [];
  if (subs.length !== 3) {
    throw new Error(`buildSpindle requires exactly 3 subagent_roles, got ${subs.length}`);
  }
  const chainId = `WAVE-${wave_id}`;
  const chains = new Map();
  const mainDep = `${spindle_id}-main`;

  const rows = [];
  rows.push(appendChain(chains, chainId, rowSeed({
    wave_id, spindle_id, slot: 'main', role: main_role, goal,
    status: 'SPINDLE_MAIN_ASSIGNED', depends_on: 'NONE', class_tag,
  })));
  for (let i = 0; i < 3; i++) {
    rows.push(appendChain(chains, chainId, rowSeed({
      wave_id, spindle_id, slot: `subagent-${i + 1}`, role: subs[i], goal,
      status: 'SPINDLE_SUBAGENT_ASSIGNED', depends_on: mainDep, class_tag,
    })));
  }
  return rows.map((r) => r.raw);
}

// writeSpindlePack(rows, outPath) — write the packet file + .hbi/.sha256/.hex
// sidecars. Returns { hbpPath, hbiPath, shaPath, hexPath, bytes }.
export function writeSpindlePack(rows, outPath) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('writeSpindlePack: rows must be a non-empty array');
  }
  if (!outPath || !outPath.endsWith('.hbp')) {
    throw new Error(`writeSpindlePack: outPath must end with .hbp, got ${outPath}`);
  }
  mkdirSync(dirname(outPath), { recursive: true });
  const text = rows.join('\n') + '\n';
  writeFileSync(outPath, text, { encoding: 'utf-8' });
  const sidecars = writeAllSidecars(outPath);
  return { hbpPath: outPath, ...sidecars, bytes: Buffer.byteLength(text, 'utf-8') };
}

// state() — return a small introspection summary of the module's identity.
export function state() {
  return {
    module: 'spindle-builder',
    rows_per_spindle: 4,
    shape: '1-main + 3-subagent',
    authority: 'fail-closed (all =0)',
    scope: { mcp: 'describe_only', webmcp: 'describe_only' },
    chain_id_format: 'WAVE-${wave_id}',
    pid_format: 'PID-HBH-${wave_id}-${spindle_id}-${slot}',
  };
}

// selfTest() — build a deterministic test spindle, write it, verify via
// hbp-verify.verifyPacket, return { rows, verify_ok }.
export function selfTest({ outPath } = {}) {
  const here = dirname(fileURLToPath(import.meta.url));
  const target = outPath ||
    `${here}/../../tmp/spindle-builder-selftest.hbp`.replace(/\\/g, '/');
  const rows = buildSpindle({
    wave_id: 'SELFTEST-v1',
    spindle_id: 'SPINDLE-SELFTEST',
    main_role: 'architect',
    subagent_roles: ['grammar', 'gates', 'receipts'],
    goal: 'build-selftest-spindle',
    class_tag: 'real-free',
  });
  const pack = writeSpindlePack(rows, target);
  const text = rows.join('\n') + '\n';
  const v = verifyPacket(text);
  return {
    rows: rows.length,
    verify_ok: v.ok,
    errors: v.errors,
    out: pack.hbpPath,
  };
}

// CLI entry: `node spindle-builder.mjs` runs selfTest() and prints one line.
const invokedDirect = (() => {
  try {
    return import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`
      || import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop());
  } catch { return false; }
})();
if (invokedDirect) {
  const result = selfTest();
  const line = `spindle-builder selfTest rows=${result.rows} verify_ok=${result.verify_ok} out=${result.out}`;
  process.stdout.write(line + (result.verify_ok ? '\n' : ` errors=${JSON.stringify(result.errors)}\n`));
  process.exit(result.verify_ok ? 0 : 1);
}
