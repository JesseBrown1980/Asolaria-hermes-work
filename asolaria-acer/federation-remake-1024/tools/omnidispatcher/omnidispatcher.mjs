#!/usr/bin/env node
// omnidispatcher.mjs — Asolaria federation single-parent dispatcher
// Spec sha:    ad1dea5d1b5a91c9e37e96dcf52960d7b2e13275ae8ccbaf9f12ffe0895567f5
// Schema sha:  cf724b2e (FEDENV-v1)
// Manifest sha: b3bf33347ca962aae46143839a279a991d19fbf6caecec6eb2e90a5e0313dcde
// Cosign window: QUINTUPLE-DELEGATED-2WEEK-2026-05-22-to-2026-06-05
//
// Boot: `node omnidispatcher.mjs --boot [--workers=48]`
// Preflight only: `node omnidispatcher.mjs --preflight`
//
// Holds 1000-slot PID-table in memory.
// Spawns N worker_threads (default 48 → ~14 GB headroom on 16 GB box).
// HTTP ingress :4950.  Per-slot lazy ports :4951-:5950.
// Subscribes (passive read) to bus :4947; emits heartbeat every 1s.
// Per-slot stdin_inbox at C:/asolaria-acer/pid-inboxes/<H-coord>/ watched via fs.watch.

import { createServer, request as httpRequest } from 'node:http';
import { Worker } from 'node:worker_threads';
import { readFile, writeFile, mkdir, watch as fsWatch, readdir, unlink } from 'node:fs/promises';
import { existsSync, statSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve as pathResolve } from 'node:path';
import { createHash } from 'node:crypto';
import { hostname, totalmem, freemem } from 'node:os';

import { validate as validateEnvelope, priorityOf, COSIGN_WINDOW } from './validator.mjs';
import { PortPool } from './port-pool.mjs';
import { teeReject } from './fedenvRejectShim.mjs'; // P1 Life-Harness emit-shim (operator-greenlit 2026-06-03)

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── Config ─────────────────────────────────────────────────────────────────
const SPEC_SHA = 'ad1dea5d1b5a91c9e37e96dcf52960d7b2e13275ae8ccbaf9f12ffe0895567f5';
const MANIFEST_SHA = 'b3bf33347ca962aae46143839a279a991d19fbf6caecec6eb2e90a5e0313dcde';
const SCHEMA_SHA = 'cf724b2e';
const ANCHOR_PID = 'ASOLARIA-OMNIDISPATCHER-SPEC-2026-05-22';
const HBP_MANIFEST = 'C:/HyperBEHCS/store/system-upgrade-2026-05-22/omnidispatcher-1000-slot-manifest-2026-05-22.hbp';
const COLD_MANIFEST = 'C:/HyperBEHCS/store/system-upgrade-2026-05-22/omnidispatcher-1000-slot-manifest-2026-05-22.cold.json';
const PID_INBOX_ROOT = 'C:/asolaria-acer/pid-inboxes';
const SNAPSHOT_DIR = pathResolve(process.env.USERPROFILE || process.env.HOME || '.', '.asolaria/omnidispatcher');
const HTTP_INGRESS_PORT = 4950;
const BUS_HOST = '127.0.0.1';
const BUS_PORT = 4947;
const DEFAULT_WORKERS = 48;
const MAX_WORKERS = 128;
const HEARTBEAT_MS = 1_000;
const DRAIN_TIMEOUT_MS = 30_000;
const PORT_SWEEP_INTERVAL_MS = 30_000;

// ─── CLI parse ──────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const out = { boot: false, preflight: false, workers: DEFAULT_WORKERS };
  for (const a of argv.slice(2)) {
    if (a === '--boot') out.boot = true;
    else if (a === '--preflight') out.preflight = true;
    else if (a.startsWith('--workers=')) out.workers = Math.min(MAX_WORKERS, Math.max(1, parseInt(a.slice(10), 10) || DEFAULT_WORKERS));
  }
  return out;
}

// ─── Manifest loader ────────────────────────────────────────────────────────
// Parse the .hbp pipe-delimited manifest into in-memory PID-table.
// (cold.json may not exist; the .hbp is canonical per HBP-first feedback rule.)
function parseSlotLine(line) {
  // SLOT|id=NNNN|category=X|name=Y|h_coord=HXXXX|glyph_5=...|cube_47d_xyz_mod8=...|band=...|route=...|pid=...|prof=...|state=...|...
  const parts = line.split('|');
  if (parts[0] !== 'SLOT') return null;
  const kv = Object.create(null);
  for (let i = 1; i < parts.length; i++) {
    const eq = parts[i].indexOf('=');
    if (eq === -1) continue;
    kv[parts[i].slice(0, eq)] = parts[i].slice(eq + 1);
  }
  if (!kv.id) return null;
  return {
    slot_id: parseInt(kv.id, 10),
    category: kv.category ?? 'unknown',
    name: kv.name ?? '',
    h_coord: kv.h_coord ?? '',
    glyph_5: kv.glyph_5 ?? '',
    cube_47d: kv.cube_47d_xyz_mod8 ?? '0-0-0-0-0-0',
    supervisor_band: kv.band ?? '',
    downstream_route: kv.route ?? 'reserved',
    pid: kv.pid ?? '',
    prof_pid: kv.prof ?? '',
    state: kv.state ?? 'READY',
    cp: kv.cp ?? '',
    antecedents: kv.antecedents ?? '',
    row_hash: kv.row_hash ?? '',
    // runtime fields populated lazily
    port: null,
    stdin_inbox: null,
    last_active_ts: 0,
  };
}

async function loadManifest() {
  // Prefer cold.json if present (mandate-preferred easier load), else parse .hbp directly.
  if (existsSync(COLD_MANIFEST)) {
    try {
      const raw = await readFile(COLD_MANIFEST, 'utf8');
      const j = JSON.parse(raw);
      if (Array.isArray(j.slots) && j.slots.length > 0) {
        return { source: 'cold.json', slots: j.slots, anchor: j.anchor_pid ?? ANCHOR_PID };
      }
    } catch (err) {
      console.error(`[manifest] cold.json read/parse failed, falling back to .hbp: ${err.message}`);
    }
  }
  if (!existsSync(HBP_MANIFEST)) {
    throw new Error(`Manifest not found: neither ${COLD_MANIFEST} nor ${HBP_MANIFEST}`);
  }
  const raw = await readFile(HBP_MANIFEST, 'utf8');
  const lines = raw.split(/\r?\n/);
  const slots = [];
  let anchor = ANCHOR_PID;
  for (const line of lines) {
    if (!line) continue;
    if (line.startsWith('HBPv1|') && line.includes('anchor_pid=')) {
      const m = line.match(/anchor_pid=([^|]+)/);
      if (m) anchor = m[1];
      continue;
    }
    if (line.startsWith('SLOT|')) {
      const s = parseSlotLine(line);
      if (s) slots.push(s);
    }
  }
  return { source: 'hbp', slots, anchor };
}

// ─── PID-table indices ──────────────────────────────────────────────────────
// 2026-05-22 patch: prefer non-reserve slots on h_coord collision.
// Manifest has dup h_coords between META slots (32, 34) and reserve fractal-spawn slots.
// Without this fix, byHCoord last-write-wins routes META envelopes to reserve-rejection.
function buildIndices(slots) {
  const bySlotId = new Map();
  const byHCoord = new Map();
  const byPid = new Map();
  // Categories in addressable order (lower index = higher precedence on h_coord collision):
  const CATEGORY_PRECEDENCE = ['meta', 'citizen', 'antigravity', 'cli', 'google', 'daemon-proxy', 'reserve'];
  const prec = (c) => {
    const i = CATEGORY_PRECEDENCE.indexOf(c);
    return i < 0 ? 999 : i;
  };
  for (const s of slots) {
    bySlotId.set(s.slot_id, s);
    if (s.h_coord) {
      const existing = byHCoord.get(s.h_coord);
      // Keep the slot with higher precedence (lower prec value)
      if (!existing || prec(s.category) < prec(existing.category)) {
        byHCoord.set(s.h_coord, s);
      }
    }
    if (s.pid) byPid.set(s.pid, s);
  }
  return { bySlotId, byHCoord, byPid };
}

// ─── Priority queue (4 lanes) ───────────────────────────────────────────────
class PriorityQueue {
  constructor() {
    this.lanes = { apex: [], high: [], normal: [], low: [] };
  }
  enqueue(item, lane = 'normal') {
    if (!this.lanes[lane]) lane = 'normal';
    this.lanes[lane].push(item);
  }
  dequeue() {
    for (const lane of ['apex', 'high', 'normal', 'low']) {
      if (this.lanes[lane].length > 0) return this.lanes[lane].shift();
    }
    return null;
  }
  depth() {
    return this.lanes.apex.length + this.lanes.high.length + this.lanes.normal.length + this.lanes.low.length;
  }
  laneDepths() {
    return { apex: this.lanes.apex.length, high: this.lanes.high.length, normal: this.lanes.normal.length, low: this.lanes.low.length };
  }
}

// ─── Worker pool ────────────────────────────────────────────────────────────
class WorkerPool {
  constructor(size, onResult) {
    this.size = size;
    this.onResult = onResult;
    this.workers = [];
    this.idle = []; // worker objects available for work
    this.busy = new Map(); // jobId -> worker
    this.jobCounter = 0;
  }
  async start() {
    const workerPath = join(__dirname, 'worker.mjs');
    for (let i = 0; i < this.size; i++) {
      const w = new Worker(workerPath, { workerData: { workerId: i } });
      w._workerId = i;
      w.on('message', (msg) => this._onMessage(w, msg));
      w.on('error', (err) => {
        console.error(`[worker ${i}] error:`, err.message);
      });
      w.on('exit', (code) => {
        console.error(`[worker ${i}] exit code=${code}`);
      });
      this.workers.push(w);
    }
  }
  _onMessage(worker, msg) {
    if (msg?.type === 'ready') {
      this.idle.push(worker);
    } else if (msg?.type === 'result') {
      this.busy.delete(msg.jobId);
      this.idle.push(worker);
      try { this.onResult(msg); } catch (err) { console.error('[onResult]', err); }
    }
  }
  /** Try to dispatch one item from queue. Returns true if dispatched. */
  tryDispatch(queue) {
    if (this.idle.length === 0) return false;
    const item = queue.dequeue();
    if (!item) return false;
    const worker = this.idle.pop();
    const jobId = ++this.jobCounter;
    this.busy.set(jobId, worker);
    worker.postMessage({ type: 'dispatch', envelope: item.envelope, slot: item.slot, jobId });
    return true;
  }
  async terminateAll() {
    await Promise.all(this.workers.map(w => w.terminate().catch(() => 0)));
  }
  stats() {
    return { size: this.size, idle: this.idle.length, busy: this.busy.size };
  }
}

// ─── Bus subscriber (passive HTTP poll — bus daemon owns the port) ──────────
async function busSubscribeOnce(lastIdx) {
  return new Promise((resolve) => {
    const req = httpRequest({
      host: BUS_HOST,
      port: BUS_PORT,
      method: 'GET',
      path: `/v1/since?idx=${lastIdx}&filter=FEDENV-v1`,
      timeout: 3_000,
    }, (res) => {
      let body = '';
      res.on('data', c => { body += c.toString('utf8'); });
      res.on('end', () => {
        try {
          const j = JSON.parse(body);
          resolve({ ok: true, events: j.events ?? [], nextIdx: j.next_idx ?? lastIdx });
        } catch {
          resolve({ ok: false, events: [], nextIdx: lastIdx });
        }
      });
    });
    req.on('error', () => resolve({ ok: false, events: [], nextIdx: lastIdx }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, events: [], nextIdx: lastIdx }); });
    req.end();
  });
}

/** Emit a verb-tagged event to bus :4947 (best-effort, fire-and-forget). */
function busEmit(verbTag, payload) {
  try {
    const body = JSON.stringify({ verb_tag: verbTag, payload, ts: new Date().toISOString() });
    const req = httpRequest({
      host: BUS_HOST,
      port: BUS_PORT,
      method: 'POST',
      path: '/v1/emit',
      headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) },
      timeout: 2_000,
    });
    req.on('error', () => {});
    req.on('timeout', () => req.destroy());
    req.write(body);
    req.end();
  } catch {}
}

// ─── HTTP ingress ───────────────────────────────────────────────────────────
function makeHttpIngress({ onEnvelope, getState, getSlots }) {
  const server = createServer((req, res) => {
    const reply = (status, obj) => {
      const body = JSON.stringify(obj);
      res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) });
      res.end(body);
    };
    if (req.method === 'GET' && req.url === '/v1/health') {
      return reply(200, { ok: true, ts: new Date().toISOString(), anchor: ANCHOR_PID });
    }
    if (req.method === 'GET' && req.url === '/v1/state') {
      return reply(200, getState());
    }
    if (req.method === 'GET' && req.url === '/v1/slots') {
      return reply(200, { slots: getSlots() });
    }
    if (req.method === 'POST' && req.url === '/v1/envelope') {
      let buf = '';
      req.on('data', c => { buf += c.toString('utf8'); if (buf.length > 128 * 1024) req.destroy(); });
      req.on('end', () => {
        let env;
        try { env = JSON.parse(buf); } catch {
          return reply(400, { ok: false, reason: 'EVT-FEDENV-REJECTED-MALFORMED', detail: 'invalid JSON' });
        }
        const out = onEnvelope(env);
        if (!out.ok) return reply(400, out);
        return reply(202, out);
      });
      return;
    }
    reply(404, { ok: false, error: 'unknown route' });
  });
  return server;
}

// ─── Per-slot stdin_inbox watcher ───────────────────────────────────────────
// On slot activation: mkdir per-H inbox; fs.watch picks up new JSON envelopes.
async function ensureSlotInbox(slot) {
  if (slot.stdin_inbox) return slot.stdin_inbox;
  const dir = join(PID_INBOX_ROOT, slot.h_coord || `slot-${slot.slot_id}`);
  await mkdir(dir, { recursive: true });
  slot.stdin_inbox = dir;
  return dir;
}

async function startInboxWatcher(slot, onInboxEnvelope) {
  const dir = await ensureSlotInbox(slot);
  try {
    const watcher = fsWatch(dir, { persistent: false }, async (eventType, filename) => {
      if (!filename || !filename.endsWith('.json')) return;
      const fp = join(dir, filename);
      try {
        const raw = await readFile(fp, 'utf8');
        const env = JSON.parse(raw);
        onInboxEnvelope(slot, env, fp);
      } catch { /* file may have been removed mid-read */ }
    });
    // Note: fs.watch on Windows fires for both create + change; consumer should idempotently
    // process by env.row_hash + unlink-on-handled.
    return watcher;
  } catch (err) {
    console.error(`[inbox watcher ${slot.slot_id}] failed:`, err.message);
    return null;
  }
}

// ─── Snapshot persistence ───────────────────────────────────────────────────
async function persistSnapshot(state) {
  try {
    await mkdir(SNAPSHOT_DIR, { recursive: true });
    const fp = join(SNAPSHOT_DIR, 'pid-table.snapshot.hbp');
    // Emit HBPv1-anchor + SLOT lines (mirrors source manifest format)
    const lines = [];
    const ts = new Date().toISOString();
    lines.push(`HBPv1|layer=omnidispatcher-snapshot|anchor_pid=${ANCHOR_PID}|ts=${ts}|slot_count=${state.slots.length}|manifest_sha=${MANIFEST_SHA}`);
    for (const s of state.slots) {
      lines.push(`SLOT|id=${String(s.slot_id).padStart(4, '0')}|category=${s.category}|name=${s.name}|h_coord=${s.h_coord}|route=${s.downstream_route}|pid=${s.pid}|state=${s.state}|port=${s.port ?? ''}|last_active_ts=${s.last_active_ts}`);
    }
    await writeFile(fp, lines.join('\n') + '\n', 'utf8');
    return fp;
  } catch (err) {
    console.error('[snapshot] persist failed:', err.message);
    return null;
  }
}

// ─── Preflight checks ───────────────────────────────────────────────────────
function preflight() {
  const checks = [];
  // Node version
  const nv = process.versions.node;
  checks.push({ name: 'node-version', ok: nv.startsWith('20.'), got: nv, want: '20.x' });
  // Manifest readable
  let manifestOk = false;
  let manifestActualSha = null;
  try {
    const raw = readFileSync(HBP_MANIFEST);
    manifestActualSha = createHash('sha256').update(raw).digest('hex');
    manifestOk = manifestActualSha === MANIFEST_SHA;
  } catch (err) {
    manifestOk = false;
  }
  checks.push({ name: 'manifest-sha', ok: manifestOk, got: manifestActualSha, want: MANIFEST_SHA });
  // Port 4950 free (best-effort: attempt a quick bind)
  // (Skipping actual bind here; preflight is advisory.)
  checks.push({ name: 'port-4950-target', ok: true, note: 'verified at boot bind' });
  // RAM
  const freeGb = freemem() / (1024 ** 3);
  const totalGb = totalmem() / (1024 ** 3);
  checks.push({ name: 'free-ram-gb', ok: freeGb >= 1.5, got: freeGb.toFixed(2), want: '>=1.5' });
  checks.push({ name: 'total-ram-gb', ok: true, got: totalGb.toFixed(2) });
  // Cosign window (advisory — we don't probe a clock service)
  checks.push({ name: 'cosign-window', ok: true, got: COSIGN_WINDOW });
  return { ok: checks.every(c => c.ok), checks };
}

// ─── Banner ─────────────────────────────────────────────────────────────────
function printBanner(workers, manifestSource, slotCount) {
  const lines = [
    '────────────────────────────────────────────────────────────────────────',
    '  OMNIDISPATCHER · Asolaria federation single-parent dispatcher',
    '────────────────────────────────────────────────────────────────────────',
    `  anchor_pid       : ${ANCHOR_PID}`,
    `  spec_sha         : ${SPEC_SHA}`,
    `  schema_sha       : ${SCHEMA_SHA}  (FEDENV-v1)`,
    `  manifest_sha     : ${MANIFEST_SHA}`,
    `  manifest_source  : ${manifestSource}`,
    `  slot_count       : ${slotCount}`,
    `  workers          : ${workers}`,
    `  http_ingress     : :${HTTP_INGRESS_PORT}`,
    `  bus_subscriber   : ${BUS_HOST}:${BUS_PORT} (passive read)`,
    `  per_slot_ports   : :4951-:5950 (lazy alloc)`,
    `  pid_inbox_root   : ${PID_INBOX_ROOT}`,
    `  snapshot_dir     : ${SNAPSHOT_DIR}`,
    `  cosign_window    : ${COSIGN_WINDOW}`,
    `  host             : ${hostname()}`,
    '────────────────────────────────────────────────────────────────────────',
  ];
  for (const l of lines) console.log(l);
}

// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs(process.argv);

  if (args.preflight) {
    const r = preflight();
    console.log(JSON.stringify(r, null, 2));
    process.exit(r.ok ? 0 : 1);
  }

  if (!args.boot) {
    console.log('Usage: node omnidispatcher.mjs --boot [--workers=N]');
    console.log('       node omnidispatcher.mjs --preflight');
    process.exit(2);
  }

  // Preflight (warn but don't refuse — operator-witnessed boot)
  const pre = preflight();
  if (!pre.ok) {
    console.warn('[preflight] WARNINGS:');
    for (const c of pre.checks.filter(c => !c.ok)) {
      console.warn(`  - ${c.name}: got=${c.got} want=${c.want}`);
    }
  }

  const manifest = await loadManifest();
  const { bySlotId, byHCoord, byPid } = buildIndices(manifest.slots);
  const portPool = new PortPool();
  const queue = new PriorityQueue();
  const seenInboxHashes = new Set(); // de-dupe inbox replays

  printBanner(args.workers, manifest.source, manifest.slots.length);

  // Resolve a target string → slot (or null)
  function resolveTarget(target) {
    if (typeof target !== 'string') return null;
    if (target.startsWith('pid:H')) {
      const h = target.slice(4); // "Hxxxx"
      return byHCoord.get(h) || null;
    }
    if (target.startsWith('cli:')) {
      // cli:<role>:<model>  → first matching CLI slot by name=role
      const role = target.split(':')[1];
      for (const s of manifest.slots) {
        if (s.category === 'CLI' && s.name === role) return s;
      }
      return null;
    }
    if (target.startsWith('antigravity:')) {
      const model = target.split(':').slice(1).join(':');
      for (const s of manifest.slots) {
        if (s.category === 'antigravity' && s.name === model) return s;
      }
      return null;
    }
    if (target.startsWith('citizen:')) {
      const vantage = target.split(':')[1];
      for (const s of manifest.slots) {
        if (s.category === 'citizen' && s.name === vantage) return s;
      }
      return null;
    }
    if (target.startsWith('daemon:')) {
      const entity = target.split(':')[1];
      for (const s of manifest.slots) {
        if (s.category === 'daemon-proxy' && s.name === entity) return s;
      }
      // Daemon may not have a dedicated slot — fall through to bus-direct synthetic
      return {
        slot_id: -1,
        category: 'daemon-proxy',
        name: entity,
        downstream_route: 'bus-direct',
        h_coord: 'H0000',
        glyph_5: '?????',
        cube_47d: '0-0-0-0-0-0',
        pid: `AGT-OMNIDISPATCHER-DAEMON-PROXY-${entity}`,
      };
    }
    if (target.startsWith('google:')) {
      const surface = target.split(':')[1];
      for (const s of manifest.slots) {
        if (s.category === 'google' && s.name === surface) return s;
      }
      return null;
    }
    if (target.startsWith('meta:')) {
      const name = target.split(':')[1];
      for (const s of manifest.slots) {
        if (s.category === 'meta' && s.name === name) return s;
      }
      return null;
    }
    return null;
  }

  // Ingress: validate + enqueue
  function ingressEnvelope(env) {
    const v = validateEnvelope(env);
    if (!v.ok) {
      busEmit(v.reason, { row_hash: env?.row_hash, detail: v.detail });
      teeReject('validate', v.reason, v.detail, env); // P1 dual-tee → Life-Harness corpus
      return { ok: false, reason: v.reason, detail: v.detail };
    }
    const slot = resolveTarget(env.target);
    if (!slot) {
      busEmit('EVT-FEDENV-REJECTED-UNRESOLVABLE-TARGET', { target: env.target, row_hash: env.row_hash });
      teeReject('resolve_target', 'EVT-FEDENV-REJECTED-UNRESOLVABLE-TARGET', `target=${env.target}`, env); // P1 dual-tee
      return { ok: false, reason: 'EVT-FEDENV-REJECTED-UNRESOLVABLE-TARGET', detail: `target=${env.target}` };
    }
    if (slot.downstream_route === 'reserved') {
      busEmit('EVT-FEDENV-REJECTED-RESERVED-SLOT', { slot_id: slot.slot_id, row_hash: env.row_hash });
      teeReject('reserved_slot', 'EVT-FEDENV-REJECTED-RESERVED-SLOT', `slot ${slot.slot_id}`, env); // P1 dual-tee
      return { ok: false, reason: 'EVT-FEDENV-REJECTED-RESERVED-SLOT', detail: `slot ${slot.slot_id}` };
    }
    // Lazy port alloc on first call
    if (slot.slot_id >= 0 && !slot.port) {
      const p = portPool.allocate(slot.slot_id) ?? (portPool.evictLRU(1), portPool.allocate(slot.slot_id));
      slot.port = p;
      // Start inbox watcher lazily on first activation
      ensureSlotInbox(slot).then(() => {
        startInboxWatcher(slot, (s, ienv, fp) => {
          if (seenInboxHashes.has(ienv.row_hash)) {
            unlink(fp).catch(() => 0);
            return;
          }
          seenInboxHashes.add(ienv.row_hash);
          ingressEnvelope(ienv);
          unlink(fp).catch(() => 0);
        }).catch(() => 0);
      });
    }
    slot.last_active_ts = Date.now();
    slot.state = 'BUSY';
    queue.enqueue({ envelope: env, slot }, priorityOf(env));
    return { ok: true, accepted: true, row_hash: env.row_hash, slot_id: slot.slot_id, queue_depth: queue.depth() };
  }

  // Worker result handler — emit response envelope + write to back_address recv dir
  async function onWorkerResult(msg) {
    const { response, jobId, elapsedMs, workerId, rawResult } = msg;
    busEmit('EVT-FEDENV-RESPONSE', { in_reply_to: response.in_reply_to, slot_pid: response.caller_pid, ok: rawResult.ok, elapsed_ms: elapsedMs, worker_id: workerId });
    // Write response to back_address recv dir
    try {
      if (response.back_address) {
        const recvDir = pathResolve('C:/asolaria-acer', response.back_address);
        await mkdir(recvDir, { recursive: true });
        const fp = join(recvDir, `${response.row_hash}.json`);
        await writeFile(fp, JSON.stringify(response, null, 2), 'utf8');
      }
    } catch (err) {
      console.error('[response-write] failed:', err.message);
    }
    // Slot state back to READY (best-effort: locate by pid)
    const slot = byPid.get(response.caller_pid);
    if (slot) slot.state = 'READY';
  }

  const pool = new WorkerPool(args.workers, onWorkerResult);
  await pool.start();

  // HTTP ingress server
  const ingress = makeHttpIngress({
    onEnvelope: ingressEnvelope,
    getState: () => ({
      anchor: ANCHOR_PID,
      ts: new Date().toISOString(),
      slot_count: manifest.slots.length,
      active_slots: [...byPid.values()].filter(s => s.state === 'BUSY').length,
      queue_depth: queue.depth(),
      queue_lanes: queue.laneDepths(),
      worker_pool: pool.stats(),
      port_pool: portPool.stats(),
      ram_mb: Math.round((totalmem() - freemem()) / (1024 * 1024)),
    }),
    getSlots: () => manifest.slots.map(s => ({
      slot_id: s.slot_id,
      category: s.category,
      name: s.name,
      h_coord: s.h_coord,
      downstream_route: s.downstream_route,
      state: s.state,
      port: s.port,
      last_active_ts: s.last_active_ts,
    })),
  });

  await new Promise((res, rej) => {
    ingress.listen(HTTP_INGRESS_PORT, '127.0.0.1', () => res()).on('error', rej);
  });
  console.log(`[ingress] LISTEN on :${HTTP_INGRESS_PORT}`);

  // Dispatch loop — drain queue into idle workers
  const dispatchTick = setInterval(() => {
    while (pool.tryDispatch(queue)) { /* keep dispatching while workers idle + queue non-empty */ }
  }, 5);

  // Heartbeat loop
  const heartbeatTick = setInterval(() => {
    busEmit('EVT-OMNIDISPATCHER-HEARTBEAT', {
      ts: new Date().toISOString(),
      slot_count: manifest.slots.length,
      active_slots: [...byPid.values()].filter(s => s.state === 'BUSY').length,
      queue_depth: queue.depth(),
      ram_mb: Math.round((totalmem() - freemem()) / (1024 * 1024)),
      anchor: ANCHOR_PID,
    });
  }, HEARTBEAT_MS);

  // Bus subscriber poll loop
  let lastBusIdx = 0;
  const busTick = setInterval(async () => {
    const r = await busSubscribeOnce(lastBusIdx);
    if (r.ok) {
      lastBusIdx = r.nextIdx;
      for (const ev of r.events) {
        if (ev?.envelope) ingressEnvelope(ev.envelope);
      }
    }
  }, 1_000);

  // Port-pool idle sweep
  const sweepTick = setInterval(() => {
    const released = portPool.sweep();
    if (released.length > 0) {
      for (const sid of released) {
        const s = bySlotId.get(sid);
        if (s) { s.port = null; s.state = 'DARK'; }
      }
    }
  }, PORT_SWEEP_INTERVAL_MS);

  // Boot envelope to bus
  busEmit('EVT-OMNIDISPATCHER-BOOT', {
    anchor: ANCHOR_PID,
    spec_sha: SPEC_SHA,
    manifest_sha: MANIFEST_SHA,
    slot_count: manifest.slots.length,
    workers: args.workers,
    port: HTTP_INGRESS_PORT,
    ts: new Date().toISOString(),
  });

  // Graceful shutdown
  let shuttingDown = false;
  async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n[shutdown] received ${signal} — draining ${queue.depth()} envelopes (≤${DRAIN_TIMEOUT_MS}ms)`);
    busEmit('EVT-OMNIDISPATCHER-SHUTDOWN-INITIATED', { reason: signal, queue_depth: queue.depth() });
    clearInterval(heartbeatTick);
    clearInterval(busTick);
    clearInterval(sweepTick);
    // Drain up to DRAIN_TIMEOUT_MS
    const deadline = Date.now() + DRAIN_TIMEOUT_MS;
    while (queue.depth() > 0 || pool.busy.size > 0) {
      if (Date.now() > deadline) {
        console.log(`[shutdown] drain deadline reached; remaining_queue=${queue.depth()} remaining_busy=${pool.busy.size}`);
        break;
      }
      while (pool.tryDispatch(queue)) {}
      await new Promise(r => setTimeout(r, 50));
    }
    clearInterval(dispatchTick);
    ingress.close();
    await pool.terminateAll();
    const snapFp = await persistSnapshot({ slots: manifest.slots });
    busEmit('EVT-OMNIDISPATCHER-SHUTDOWN', { snapshot: snapFp, ts: new Date().toISOString() });
    console.log(`[shutdown] snapshot=${snapFp}`);
    console.log('[shutdown] clean exit');
    process.exit(0);
  }
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch(err => {
  console.error('[fatal]', err);
  process.exit(1);
});
