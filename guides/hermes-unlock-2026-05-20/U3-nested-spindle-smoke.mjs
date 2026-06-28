#!/usr/bin/env node
// U3-NESTED-SPINDLE-SMOKE
// 1+3+9+27+81 fractal Hermes-style spindle smoke test
// Descriptor-only (no LLM, no runtime, no promote, no json hot path)
// Uses Brown-Hilbert sha16-of-(parent_pid + index) PID synthesis.
//
// Author: U3-NESTED-SPINDLE-SMOKE subagent (acer-claude)
// Date: 2026-05-20
// Anchor: ASOLARIA-U3-NESTED-SPINDLE-SMOKE-PID-2026-05-20

import { createHash } from 'node:crypto';
import { writeFileSync, statSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_NDJSON = `${__dirname}/U3-nested-spindle-smoke.ndjson`;

// ---------- BH-PID synth (sha16-of-parent+index) ----------
function bhPid(parentPid, index) {
  const h = createHash('sha256').update(`${parentPid}|${index}`).digest('hex');
  return h.slice(0, 16).toUpperCase();
}

// ---------- HBPv1 descriptor row ----------
function hbpv1Row(pid, parentPid, depth, indexAtLevel, role) {
  return {
    v: 'HBPv1',
    pid,
    parent: parentPid,
    depth,
    idx: indexAtLevel,
    role,
    mode: 'descriptor-only',
    gates: { runtime: false, promote: false, json: false },
    ts: Date.now(),
  };
}

// ---------- Fractal spindle build ----------
// Layout (recursive 1 main + 3 subs):
//   depth 0: 1   (main)
//   depth 1: 3   (subs)
//   depth 2: 9   (sub-subs)
//   depth 3: 27  (sub-sub-subs)
//   depth 4: 81  (sub-sub-sub-subs)  <- "one extra layer for fun"
//   Total  : 121 logical workers
const ROOT_PARENT = 'OP-JESSE-FABRIC-ROOT';
const MAX_DEPTH = 4;       // 0..4 inclusive => 5 layers
const FANOUT = 3;          // 1 + 3^1 + 3^2 + 3^3 + 3^4 = 1+3+9+27+81 = 121

const rows = [];
const pidSet = new Set();

function emit(parentPid, depth, indexAtLevel, role) {
  const pid = bhPid(parentPid, indexAtLevel);
  rows.push(hbpv1Row(pid, parentPid, depth, indexAtLevel, role));
  pidSet.add(pid);
  if (depth < MAX_DEPTH) {
    for (let i = 0; i < FANOUT; i++) {
      const childRole = `sub${'-sub'.repeat(depth)}`;
      emit(pid, depth + 1, i, childRole);
    }
  }
}

// ---------- Run ----------
const t0 = performance.now();
emit(ROOT_PARENT, 0, 0, 'main');
const t1 = performance.now();

// Serialize NDJSON
const ndjson = rows.map((r) => JSON.stringify(r)).join('\n') + '\n';
mkdirSync(__dirname, { recursive: true });
writeFileSync(OUT_NDJSON, ndjson, 'utf8');
const t2 = performance.now();

const stat = statSync(OUT_NDJSON);

// ---------- Verify ----------
const expected = 1 + 3 + 9 + 27 + 81; // 121
const uniqueCount = pidSet.size;
const totalRows = rows.length;
const allDescriptorOnly = rows.every(
  (r) => r.mode === 'descriptor-only' &&
         r.gates.runtime === false &&
         r.gates.promote === false &&
         r.gates.json === false
);

const elapsedMs = t1 - t0;
const elapsedTotalMs = t2 - t0;
const pidsPerSec = totalRows / (elapsedMs / 1000);

const report = {
  anchor: 'ASOLARIA-U3-NESTED-SPINDLE-SMOKE-PID-2026-05-20',
  expectedWorkers: expected,
  totalRows,
  uniquePids: uniqueCount,
  uniquenessVerified: uniqueCount === totalRows && totalRows === expected,
  descriptorOnlyAll: allDescriptorOnly,
  layerCounts: {
    depth0_main: rows.filter((r) => r.depth === 0).length,
    depth1_sub: rows.filter((r) => r.depth === 1).length,
    depth2_subsub: rows.filter((r) => r.depth === 2).length,
    depth3_subsubsub: rows.filter((r) => r.depth === 3).length,
    depth4_subsubsubsub: rows.filter((r) => r.depth === 4).length,
  },
  timing: {
    pidSynthMs: +elapsedMs.toFixed(3),
    totalWithWriteMs: +elapsedTotalMs.toFixed(3),
    pidsPerSec: Math.round(pidsPerSec),
  },
  ndjson: {
    path: OUT_NDJSON,
    bytes: stat.size,
    rows: totalRows,
  },
};

console.log(JSON.stringify(report, null, 2));
