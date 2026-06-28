// emit-hermes-r2-attach-hbp.mjs — one-shot emitter for the R2-attach fixture row.
// Appends a single FIXTURE_RESTORED HBPv1 row to data/fixtures/hermes-r2-attach.hbp.
// Chain: COHORT-R-FIXTURE-RESTORED. seq=191 antecedent=190 (per task spec).
import { writeFileSync, existsSync, appendFileSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { hbpRow, parseHbpRow } from '../src/hermes-disc/hbp-row.mjs';
import { selfTest } from '../src/fixtures/hermes-attach.mjs';

const OUT = 'C:/asolaria-acer/packages/revolver-10k/data/fixtures/hermes-r2-attach.hbp';
const ANCHOR = 'FIXTURE-RESTORED-HERMES-R2-PID-2026-05-19';
const PREV_ANCHOR = 'FIXTURE-RESTORED-HERMES-R1-PID-2026-05-19';

const r = selfTest();
if (!r.shape_ok || !r.verify_ok || !r.bus_subscribed) {
  process.stderr.write(`selfTest failed: ${JSON.stringify(r)}\n`);
  process.exit(1);
}

// Resolve prev_hash from prior row in the file if present, else ROOT.
// The task asserts seq=191 antecedent=190; we keep that as named metadata,
// while the on-wire prev_hash respects chain integrity (row_hash of prior row).
let prevHash = 'ROOT';
if (existsSync(OUT)) {
  const lines = readFileSync(OUT, 'utf-8').split('\n').filter((l) => l.trim());
  if (lines.length > 0) {
    const last = parseHbpRow(lines[lines.length - 1]);
    prevHash = last.fields.row_hash || 'ROOT';
  }
}

const row = hbpRow({
  layer: 'fixture-restored',
  pid: ANCHOR,
  prof: 'cohort-r-phase-r2-hermes-attach',
  supervisor: 'fail-closed-public',
  tuple: `cohort-r:phase-r2:${r.spindle_id}`,
  triple_quant: 'wave/spindle/receipt',
  polar_quant: 'describe/execute',
  js_quant: 'johnson-slithechen-public',
  turbo_quant: 'packet-first',
  json: '0',
  runtime: '0',
  // on-wire authority `promote` is fail-closed (=0 forced by hbpRow). The
  // fixture promote=1 marker is carried as named metadata `promote_marker`.
  promote: '0',
  status: 'WAVE_RECEIPTED',
  chain_id: 'COHORT-R-FIXTURE-RESTORED',
  sequence: '191',
  prev_hash: prevHash,
  promote_marker: '1',
  antecedent_seq: '190',
  antecedent_pid: PREV_ANCHOR,
  cohort: 'cohort-R',
  phase: 'R2',
  fixture_module: 'src/fixtures/hermes-attach.mjs',
  daemon_attached: 'packages/meta-supervisor-hermes/bin/daemon.mjs',
  bus_topic: 'hermes:spindle:tick',
  main_count: String(r.main_count),
  sub_count: String(r.sub_count),
  spindle_rows: String(r.rows),
  shape_ok: r.shape_ok ? '1' : '0',
  chain_verify_ok: r.verify_ok ? '1' : '0',
  ts_ms: String(Date.now()),
});

mkdirSync(dirname(OUT), { recursive: true });
const line = row + '\n';
if (existsSync(OUT)) appendFileSync(OUT, line, 'utf-8');
else writeFileSync(OUT, line, 'utf-8');

process.stdout.write(`FIXTURE_RESTORED anchor=${ANCHOR} seq=191 antecedent=190 out=${OUT}\n`);
