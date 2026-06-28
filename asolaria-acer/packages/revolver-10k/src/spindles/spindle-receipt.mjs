// spindle-receipt.mjs — emit one HBPv1 receipt row at spindle close.
// Receipt cosigns the 4 input rows (main + 3 subs) as antecedents, becoming a
// node in the hypergraph with edges back to the spindle's prior agents.
// ESM, no JSON on wire. Defensive import: prefer omniRow (antecedents-aware);
// fall back to plain hbpRow if omni-row module is unavailable.
import { appendFileSync, readFileSync, existsSync } from 'node:fs';
import { hbpRow } from '../hermes-disc/hbp-row.mjs';
import { writeAllSidecars } from '../hermes-disc/sidecars.mjs';

let _omniRow = null;
try {
  const mod = await import('../hermes-disc/omni-row.mjs');
  if (typeof mod.omniRow === 'function') _omniRow = mod.omniRow;
} catch (_e) {
  _omniRow = null; // fall back to hbpRow below
}

const VALID_OUTCOMES = new Set(['WAVE_RECEIPTED', 'WAVE_BLOCKED']);

function assertPidToken(label, v) {
  if (v === undefined || v === null) throw new Error(`${label} missing`);
  const s = String(v).trim();
  if (!s) throw new Error(`${label} empty`);
  if (/[|=,\n\r]/.test(s)) throw new Error(`${label} has forbidden char: ${JSON.stringify(s)}`);
  return s;
}

// mintReceipt — build one HBPv1 row summarizing a spindle close.
//   wave_id    : wave identifier (string)
//   spindle_id : spindle identifier (string)
//   main_pid   : main agent PID/token (string)
//   sub_pids   : array of 3 sub-agent PIDs/tokens
//   outcome    : 'WAVE_RECEIPTED' | 'WAVE_BLOCKED'
// Returns the canonical row string (no trailing newline).
export function mintReceipt({ wave_id, spindle_id, main_pid, sub_pids, outcome } = {}) {
  const wid = assertPidToken('wave_id', wave_id);
  const sid = assertPidToken('spindle_id', spindle_id);
  const main = assertPidToken('main_pid', main_pid);
  if (!Array.isArray(sub_pids)) throw new Error('sub_pids must be array');
  const subs = sub_pids.map((p, i) => assertPidToken(`sub_pids[${i}]`, p));
  if (!VALID_OUTCOMES.has(outcome)) {
    throw new Error(`outcome must be one of ${[...VALID_OUTCOMES].join('/')}; got ${outcome}`);
  }

  const ts_ms = Date.now();
  const pid = `RECEIPT-${sid}-${ts_ms}`;
  const antecedents = [main, ...subs];

  const baseFields = {
    layer: 'wave-receipt',
    pid,
    prof: 'spindle_receipt',
    supervisor: `SUP-SPINDLE-${sid}`,
    tuple: `wave-receipt:${wid}:${sid}`,
    status: outcome,
  };
  const extras = {
    wave_id: wid,
    spindle_id: sid,
    main_pid: main,
    sub_count: String(subs.length),
    ts_ms: String(ts_ms),
  };

  if (_omniRow) {
    return _omniRow({ ...baseFields, antecedents, ...extras });
  }
  // Fallback: emit antecedents as a CSV extra so the field is still present.
  const csv = antecedents.join(',');
  if (/[|=\n\r]/.test(csv)) throw new Error('antecedents CSV has forbidden char');
  return hbpRow({ ...baseFields, antecedents: csv, ...extras });
}

// appendReceiptToPack — append a receipt row to an existing .hbp file and
// regenerate the .hbi/.sha256/.hex sidecars. The row is written with a
// trailing newline. Throws if the packet path is missing or not a .hbp.
export function appendReceiptToPack(row, packetPath) {
  if (typeof row !== 'string' || !row.startsWith('HBPv1|')) {
    throw new Error('row must be an HBPv1 string');
  }
  if (typeof packetPath !== 'string' || !packetPath.endsWith('.hbp')) {
    throw new Error('packetPath must end with .hbp');
  }
  if (!existsSync(packetPath)) {
    throw new Error(`packet missing: ${packetPath}`);
  }
  const existing = readFileSync(packetPath, { encoding: 'utf-8' });
  const sep = existing.length === 0 || existing.endsWith('\n') ? '' : '\n';
  appendFileSync(packetPath, sep + row + '\n', { encoding: 'utf-8' });
  const sidecars = writeAllSidecars(packetPath);
  return { packetPath, ...sidecars };
}

// selfTest — mint a receipt for a 4-PID spindle and verify the antecedents
// field is present in the canonical row text.
export function selfTest() {
  const row = mintReceipt({
    wave_id: 'WAVE-RECEIPT-SELFTEST-T0',
    spindle_id: 'SPN-RT-001',
    main_pid: 'ACER-PID-H740C-A07-W104-P00-N00000',
    sub_pids: ['4949.4947', 'glyph:0F4C-098F', 'role:hermes-disc'],
    outcome: 'WAVE_RECEIPTED',
  });
  const hasAntecedents = /\|antecedents=[^|]+/.test(row);
  const hasMain = row.includes('ACER-PID-H740C-A07-W104-P00-N00000');
  const hasAllSubs = row.includes('4949.4947')
    && row.includes('glyph:0F4C-098F')
    && row.includes('role:hermes-disc');
  const hasStatus = row.includes('status=WAVE_RECEIPTED');
  const hasLayer = row.includes('layer=wave-receipt');
  const hasOmni = _omniRow !== null;
  const ok = hasAntecedents && hasMain && hasAllSubs && hasStatus && hasLayer;
  return { ok, hasOmni, hasAntecedents, hasMain, hasAllSubs, sample: row };
}

export function state() { return selfTest(); }
