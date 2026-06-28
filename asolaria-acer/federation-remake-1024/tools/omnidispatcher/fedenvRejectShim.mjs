// fedenvRejectShim.mjs — Life-Harness P1 emit-shim (operator-greenlit 2026-06-03).
//
// DUAL-TEE: every FEDENV ingress rejection is forked into the Life-Harness
// failure corpus, alongside the existing busEmit. The dispatcher previously
// emitted rejections ONLY to the bus (the "empty pipe" the cross-vantage review
// found) — so the env_contract / action_realization failure layers had no
// persisted corpus to learn from. This shim fills it.
//
// HOT-PATH CANON (HyperBEHCS): rows are HBPv1 PIPE format — `KIND|k=v|k=v|…` with
// `|`→%7C escaping and a per-row sha16, matching the router's GHOST-ENVELOPE| /
// encodeHbp convention. NOT JSON. JSON stays cold/compat only. sha16/hex are the
// free-token content addresses the federation already uses.
//
// CONTRACT (inviolable for a corpus-farming write):
//   - ADDITIVE: called BESIDE each busEmit reject; never changes control flow.
//   - BEST-EFFORT: a corpus write MUST NOT break dispatch (worst case: one
//     silenced console.error, dispatch continues).
//   - LOOSELY COUPLED: imports nothing from the router/harness — just appends
//     pipe rows the harness HARVEST organ reads.
//
// CROSS-REPO PATH: the dispatcher lives in C:/asolaria-acer/…; the harness loop
// consuming this corpus lives in C:/Users/acer/Asolaria/. Bridge = absolute path,
// resolved at call time (override at launch via BH_FEDENV_REJECT_PATH).

import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';

const DEFAULT_PATH = 'C:/Users/acer/Asolaria/data/behcs/fedenv-rejections.hbp';
const KIND = 'EVT-FEDENV-REJECTED';

export function rejectPath() {
  return process.env.BH_FEDENV_REJECT_PATH || DEFAULT_PATH;
}

// HBPv1 escape (matches router encodeHbp): | -> %7C, CR dropped, LF -> space.
const esc = (s) => String(s ?? '').replace(/[|\r\n]/g, (m) => ({ '|': '%7C', '\r': '', '\n': ' ' })[m] || '');

let _warned = false;
export function teeReject(stage, reason, detail, env) {
  try {
    const ts = new Date().toISOString();
    // Carry the FULL omnilanguage raw material the rejected envelope holds:
    //   verb (action) · target (noun/entity) · cube_47d (the 6-tuple address) ·
    //   glyph_5 (the glyph sentence). The harness side tokenizes these into HG256
    //   glyph256 at freeze time via hg256RuntimeContract (the real encoder).
    const fields = [
      `ts=${esc(ts)}`,
      `stage=${esc(stage)}`,
      `reason=${esc(reason ?? '')}`,
      `detail=${esc(detail ?? '')}`,
      `caller_pid=${esc(env?.caller_pid ?? '')}`,
      `verb=${esc(env?.verb ?? '')}`,            // omnilanguage VERB
      `target=${esc(env?.target ?? '')}`,        // omnilanguage NOUN/entity
      `cube_47d=${esc(env?.cube_47d ?? '')}`,    // the 6-TUPLE address
      `glyph_5=${esc(env?.glyph_5 ?? '')}`,      // the GLYPH sentence
      `row_hash=${esc(env?.row_hash ?? '')}`,
    ];
    const sha16 = createHash('sha256').update(`${ts}|${stage}|${reason}|${env?.caller_pid ?? ''}|${env?.target ?? ''}|${env?.row_hash ?? ''}`).digest('hex').slice(0, 16);
    fields.push(`sha16=${sha16}`);
    const row = `${KIND}|${fields.join('|')}`;
    const p = rejectPath();
    mkdirSync(dirname(p), { recursive: true });
    appendFileSync(p, row + '\n');
  } catch (e) {
    // farming is best-effort — a corpus write must NEVER break dispatch.
    if (!_warned) { _warned = true; try { console.error('[fedenvRejectShim] tee failed (silenced):', String(e)); } catch {} }
  }
}

export default { teeReject, rejectPath };
