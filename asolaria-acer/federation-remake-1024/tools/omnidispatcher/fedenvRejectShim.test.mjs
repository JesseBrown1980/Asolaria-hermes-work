// fedenvRejectShim.test.mjs — proves the P1 emit-shim end-to-end:
// REAL validate() rejects → teeReject → corpus rows → harness HARVEST + CLASSIFY.
// Uses a temp BH_FEDENV_REJECT_PATH so the real corpus is never polluted.
import assert from 'node:assert';
import { readFileSync, existsSync, rmSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';

const tmp = mkdtempSync(join(tmpdir(), 'fedenv-shim-'));
const CORPUS = join(tmp, 'fedenv-rejections.hbp');
process.env.BH_FEDENV_REJECT_PATH = CORPUS; // shim resolves path at call time

// parse HBPv1 pipe rows: `KIND|k=v|k=v|…` -> { _kind, ...fields }
function parseHbp(text) {
  return text.trim().split(/\r?\n/).filter(Boolean).map((line) => {
    const [kind, ...parts] = line.split('|');
    const o = { _kind: kind };
    for (const p of parts) { const i = p.indexOf('='); if (i > -1) o[p.slice(0, i)] = p.slice(i + 1).replace(/%7C/g, '|'); }
    return o;
  });
}

const { validate } = await import('./validator.mjs');
const { teeReject } = await import('./fedenvRejectShim.mjs');
const require = createRequire(import.meta.url);
const H = require('C:/Users/acer/Asolaria/src/harnessFailureHarvester.js');
const C = require('C:/Users/acer/Asolaria/src/harnessClassify.js');

let passes = 0, fails = 0;
function t(name, fn) { try { fn(); console.log(`  ✓ ${name}`); passes++; } catch (e) { console.error(`  ✗ ${name} — ${e.message}`); fails++; } }

// Mirror the real ingressEnvelope reject cascade (validate → resolveTarget → tee).
function simulateIngress(env, resolveTargetStub) {
  const v = validate(env);
  if (!v.ok) { teeReject('validate', v.reason, v.detail, env); return { ok: false, reason: v.reason }; }
  const slot = resolveTargetStub(env.target);
  if (!slot) { teeReject('resolve_target', 'EVT-FEDENV-REJECTED-UNRESOLVABLE-TARGET', `target=${env.target}`, env); return { ok: false, reason: 'EVT-FEDENV-REJECTED-UNRESOLVABLE-TARGET' }; }
  return { ok: true };
}

const base = {
  caller_pid: 'AGT-TEST-W0-P0-N0', target: 'cli:opencode:big-pickle', verb: 'invoke',
  payload: 'hello', back_address: 'recv/test', cube_47d: '3-5-3-4-1-5', glyph_5: '✶✶✶✶✶',
  cosign_token: 'FOUNDATION-V3-LAW-EXTENDED-4MO', ttl_seconds: 300,
  antecedents: '0000000000000000', row_hash: 'abcdef0123456789',
};
// resolver: a real cli slot resolves; pid:H01FD has no slot (the verified bug class)
const resolveStub = (tgt) => (tgt.startsWith('cli:') ? { slot_id: 1, downstream_route: 'multi-cli-invoke' } : null);

// fire the cascade
const missing = { ...base }; delete missing.back_address;          // → validate MALFORMED
const badPrefix = { ...base, target: 'frob:nope' };                 // → validate UNRESOLVABLE (bad prefix)
const expired = { ...base, cosign_token: 'STALE-WINDOW-2024' };     // → validate EXPIRED-COSIGN
const pidH = { ...base, target: 'pid:H01FD' };                      // passes validate, dies at resolve
const good = { ...base };                                           // valid + resolves → NO tee

simulateIngress(missing, resolveStub);
simulateIngress(badPrefix, resolveStub);
simulateIngress(expired, resolveStub);
simulateIngress(pidH, resolveStub);
const okres = simulateIngress(good, resolveStub);

t('valid envelope is accepted and does NOT tee a reject', () => {
  assert.strictEqual(okres.ok, true);
});
t('shim wrote a HBPv1 pipe row per reject (4 rejects, 1 accept)', () => {
  assert.ok(existsSync(CORPUS), 'corpus file should exist');
  const rows = parseHbp(readFileSync(CORPUS, 'utf8'));
  assert.strictEqual(rows.length, 4, `expected 4 reject rows, got ${rows.length}`);
  assert.ok(rows.every((r) => r._kind === 'EVT-FEDENV-REJECTED' && r.ts && r.stage && r.reason && r.sha16));
});
t('both tee surfaces fire (validate AND resolve_target)', () => {
  const rows = parseHbp(readFileSync(CORPUS, 'utf8'));
  const stages = new Set(rows.map((r) => r.stage));
  assert.ok(stages.has('validate'), 'validate tee should fire');
  assert.ok(stages.has('resolve_target'), 'resolve_target tee should fire (the pid:H class)');
});
t('HARVEST reads the shim corpus as the fedenv source', () => {
  const h = H.harvest({ sources: { dlq: join(tmp, 'none1'), ingress_schema: join(tmp, 'none2'), fedenv: CORPUS } });
  assert.strictEqual(h.counts.by_source.fedenv, 4);
  assert.strictEqual(h.counts.malformed.fedenv, 0);
});
t('CLASSIFY maps FEDENV rejects: env_contract (malformed/cosign) + action_realization (unresolvable)', () => {
  const h = H.harvest({ sources: { dlq: join(tmp, 'none1'), ingress_schema: join(tmp, 'none2'), fedenv: CORPUS } });
  const { dist } = C.classifyAll(h.records);
  assert.ok((dist.by_type.env_contract || 0) >= 2, `env_contract>=2, got ${dist.by_type.env_contract}`);
  assert.ok((dist.by_type.action_realization || 0) >= 2, `action_realization>=2, got ${dist.by_type.action_realization}`);
  assert.strictEqual(dist.escalate, 0); // none of these are resource_unavailable
});

try { rmSync(tmp, { recursive: true, force: true }); } catch {}
console.log(`\nRESULT: ${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
