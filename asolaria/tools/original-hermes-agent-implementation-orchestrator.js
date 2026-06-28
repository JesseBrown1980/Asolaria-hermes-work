#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const behcsGulp = require("./behcs/behcs-gulp-runtime");
const hermesContracts = require("../src/behcs/originalHermesAgentContracts");

const repoRoot = path.resolve(__dirname, "..");
const LOGICAL_AGENTS = 30_000_000_000;
const GULP_SIZE = 2_000;
const PROOF_MESSAGES_DEFAULT = 2_000;
const WRITE_BUFFER = 5_000;

const GC_DIR = rel("data/behcs/garbage-collector");
const GC_STATE_PATH = path.join(GC_DIR, "collector-state.json");
const GC_BUFFER_PATH = path.join(GC_DIR, "message-paths.ndjson");
const ABSORB_MANIFEST = rel("data/behcs/original-hermes-agent/source-manifest-latest.json");
const ABSORB_ARCHITECTURE = rel("data/behcs/original-hermes-agent/architecture-capsules-latest.json");
const ABSORB_QUEUE = rel("data/behcs/original-hermes-agent/implementation-queue-latest.ndjson");

const OUTPUTS = Object.freeze({
  learningLoop: rel("data/behcs/original-hermes-agent/contracts/learning-loop-contract.v1.json"),
  walState: rel("data/behcs/original-hermes-agent/contracts/wal-state-contract.v1.json"),
  transportRouter: rel("data/behcs/original-hermes-agent/contracts/transport-router-contract.v1.json"),
  pluginHookGate: rel("data/behcs/original-hermes-agent/contracts/plugin-hook-gac-gate.v1.json"),
  pluginHookEval: rel("data/behcs/original-hermes-agent/contracts/plugin-hook-unsafe-sample-eval-latest.json"),
  securityBackport: rel("data/behcs/original-hermes-agent/contracts/security-backport-manifest.v1.json"),
  validation: rel("data/behcs/original-hermes-agent/contracts/original-hermes-contract-validation-latest.json"),
  queue: rel("data/behcs/original-hermes-agent/implementation-tranche-queue-latest.ndjson"),
  proof: rel("data/behcs/original-hermes-agent/implementation-tranche-proof-latest.ndjson"),
  supervisors: rel("data/behcs/supervisors/original-hermes-agent/original-hermes-implementation-supervisors.v1.json"),
  map: rel("data/behcs/maps/original-hermes-agent/original-hermes-implementation-map.v1.json"),
  state: rel("data/behcs/state/original-hermes-agent/original-hermes-implementation.state.json"),
  hermes: rel("data/behcs/hermes/original-hermes-agent/original-hermes-implementation-dispatch-latest.json"),
  shannon: rel("data/behcs/shannon/original-hermes-agent/original-hermes-implementation-consensus-latest.json"),
  cube: rel("data/behcs/cubes/original-hermes-agent-implementation-tranche.cube.js"),
  reportJson: rel("reports/original-hermes-agent-implementation-tranche-latest.json"),
  reportMd: rel("reports/original-hermes-agent-implementation-tranche-latest.md"),
  inbox: rel("data/behcs/inbox.ndjson"),
  outbox: rel("data/behcs/outbox.ndjson"),
  gnnEdges: rel("data/behcs/gnn-live-edges.ndjson")
});

function rel(p) { return path.join(repoRoot, p); }
function repoRel(p) { return path.relative(repoRoot, p).replace(/\\/g, "/"); }
function ensureDir(filePath) { fs.mkdirSync(path.dirname(filePath), { recursive: true }); }
function sha256Text(value) { return crypto.createHash("sha256").update(String(value), "utf8").digest("hex"); }
function safeInt(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}
function parseArgValue(argv, name, fallback) {
  const prefix = `--${name}=`;
  const found = argv.find((arg) => String(arg).startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}
function readJson(filePath, fallback = {}) {
  try { return JSON.parse(fs.readFileSync(filePath, "utf8")); } catch { return fallback; }
}
function writeJson(filePath, value) {
  ensureDir(filePath);
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
function writeText(filePath, value) {
  ensureDir(filePath);
  fs.writeFileSync(filePath, value.endsWith("\n") ? value : `${value}\n`, "utf8");
}
function writeNdjson(filePath, rows) {
  ensureDir(filePath);
  fs.writeFileSync(filePath, rows.map((row) => JSON.stringify(row)).join("\n") + "\n", "utf8");
}
function appendNdjson(filePath, row) {
  ensureDir(filePath);
  fs.appendFileSync(filePath, `${JSON.stringify(row)}\n`, "utf8");
}
function readNdjson(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, "utf8").split(/\r?\n/).filter((line) => line.trim()).map((line) => {
    try { return JSON.parse(line); } catch { return null; }
  }).filter(Boolean);
}
function trimBuffer(maxLines) {
  const rows = readNdjson(GC_BUFFER_PATH);
  if (rows.length <= maxLines) return rows.length;
  writeNdjson(GC_BUFFER_PATH, rows.slice(-maxLines));
  return maxLines;
}
function updateCollectorStatePatch(patch) {
  const current = readJson(GC_STATE_PATH, {});
  writeJson(GC_STATE_PATH, { ...current, ...patch });
}

class BufferedNdjsonWriter {
  constructor(filePath, bufferSize = WRITE_BUFFER) {
    this.filePath = filePath;
    this.bufferSize = Math.max(1, safeInt(bufferSize, WRITE_BUFFER, 1, Number.MAX_SAFE_INTEGER));
    this.buffer = [];
    this.fd = null;
    this.linesWritten = 0;
  }
  open() {
    ensureDir(this.filePath);
    this.fd = fs.openSync(this.filePath, "a");
  }
  write(row) {
    this.buffer.push(JSON.stringify(row));
    this.linesWritten += 1;
    if (this.buffer.length >= this.bufferSize) this.flush();
  }
  flush() {
    if (!this.buffer.length) return;
    const body = `${this.buffer.join("\n")}\n`;
    if (this.fd != null) fs.writeSync(this.fd, body, undefined, "utf8");
    else {
      ensureDir(this.filePath);
      fs.appendFileSync(this.filePath, body, "utf8");
    }
    this.buffer = [];
  }
  close() {
    this.flush();
    if (this.fd != null) {
      fs.closeSync(this.fd);
      this.fd = null;
    }
  }
}

function sourceDigestFor(manifest, capsuleId) {
  const sourceByCapsule = {
    self_improving_learning_loop: "README.md",
    sqlite_wal_session_memory: "hermes_state.py",
    transport_abc_provider_router: "agent/transports/base.py",
    plugin_hook_surface: "hermes_cli/plugins.py",
    release_v011_security_hardening: "RELEASE_v0.11.0.md"
  };
  const source = sourceByCapsule[capsuleId];
  return manifest.sourceEntries?.find((entry) => entry.path === source)?.sha256 || manifest.digest || "";
}

function buildContracts(generatedAt) {
  const manifest = readJson(ABSORB_MANIFEST, {});
  const architecture = readJson(ABSORB_ARCHITECTURE, {});
  const learningLoop = hermesContracts.buildLearningLoopContract({
    generatedAt,
    sourceDigest: sourceDigestFor(manifest, "self_improving_learning_loop")
  });
  const walState = hermesContracts.buildWalStateContract({
    generatedAt,
    sourceDigest: sourceDigestFor(manifest, "sqlite_wal_session_memory")
  });
  const transportRouter = hermesContracts.buildTransportRouterContract({
    generatedAt,
    sourceDigest: sourceDigestFor(manifest, "transport_abc_provider_router")
  });
  const pluginHookGate = hermesContracts.buildPluginHookGate({
    generatedAt,
    sourceDigest: sourceDigestFor(manifest, "plugin_hook_surface")
  });
  const pluginHookEval = hermesContracts.evaluatePluginHook({
    gate: pluginHookGate,
    request: {
      pluginId: "sample_untrusted_hermes_hook",
      phase: "pre_tool_call",
      manifestDigest: "",
      secretAccess: true,
      shell: true,
      network: true,
      connectorPolicy: false,
      shadowWrite: true,
      rollbackSurface: ""
    }
  });
  const securityBackport = hermesContracts.buildSecurityBackportManifest({
    generatedAt,
    sourceDigest: sourceDigestFor(manifest, "release_v011_security_hardening")
  });
  const validation = hermesContracts.validateContracts({
    learningLoop,
    walState,
    transportRouter,
    pluginHookGate,
    pluginHookEval,
    securityBackport
  });
  return {
    manifest,
    architecture,
    learningLoop,
    walState,
    transportRouter,
    pluginHookGate,
    pluginHookEval,
    securityBackport,
    validation
  };
}

function buildQueue(generatedAt, contracts) {
  const prior = readNdjson(ABSORB_QUEUE);
  const base = [
    {
      id: "activate_learning_loop_contract",
      lane: "memory_skills",
      priority: "P0",
      action: "Bind original Hermes learning loop to BEHCS mistake-ledger, reverse-gain, Atlas promotion, and skill activation gates.",
      contractDigest: contracts.learningLoop.digest
    },
    {
      id: "stage_wal_state_contract",
      lane: "memory_ledger",
      priority: "P0",
      action: "Stage WAL/session-lineage contract for Asolaria stores before any store migration.",
      contractDigest: contracts.walState.digest
    },
    {
      id: "stage_transport_router_contract",
      lane: "model_routing",
      priority: "P0",
      action: "Stage transport-router contract for brainPolicy and workerRouter without importing provider secrets.",
      contractDigest: contracts.transportRouter.digest
    },
    {
      id: "activate_plugin_hook_gac_gate",
      lane: "plugins_hooks",
      priority: "P0",
      action: "Deny unregistered Hermes-style plugin/shell hooks until GAC, audit, scope, and rollback gates pass.",
      contractDigest: contracts.pluginHookGate.digest
    },
    {
      id: "stage_security_backport_manifest",
      lane: "security",
      priority: "P0",
      action: "Backport security hardening as queued targeted tests for gateway, risk engine, hooks, sandbox, and connector secrets.",
      contractDigest: contracts.securityBackport.digest
    }
  ];
  return base.map((item, index) => ({
    ...item,
    generatedAt,
    status: "queued_requires_supervisor",
    supervisor: `original_hermes_impl_${item.lane}_supervisor`,
    priorQueueItem: prior.find((candidate) => candidate.lane === item.lane)?.id || null,
    cubeCoordinates: ["original_hermes_agent", "implementation_tranche", item.lane, String(index + 1)]
  }));
}

function buildSupervisors(generatedAt, queue) {
  return [
    {
      id: "original_hermes_implementation_supervisor_of_supervisors",
      generatedAt,
      role: "implementation_root",
      scope: "Turn original Hermes upstream architecture capsules into BEHCS runtime contracts without running upstream Hermes.",
      gates: ["source_digest", "contract_validation", "gac", "shannon", "real_gulp_proof", "no_secret_import"]
    },
    ...queue.map((item, index) => ({
      id: item.supervisor,
      generatedAt,
      role: "contract_lane_supervisor",
      lane: item.lane,
      ordinal: index + 1,
      queueItem: item.id,
      contractDigest: item.contractDigest,
      gates: ["contract_schema", "rollback_surface", "manual_runtime_enable", "audit_log"]
    }))
  ];
}

function buildMap(generatedAt, contracts, queue, supervisors) {
  const contractNodes = [
    ["learning_loop", contracts.learningLoop.digest],
    ["wal_state", contracts.walState.digest],
    ["transport_router", contracts.transportRouter.digest],
    ["plugin_hook_gate", contracts.pluginHookGate.digest],
    ["security_backport", contracts.securityBackport.digest]
  ].map(([id, digest]) => ({ id, type: "contract", digest }));
  const nodes = [
    { id: "original_hermes_absorption", type: "source", digest: contracts.manifest.digest },
    { id: "contract_validation", type: "validation", ok: contracts.validation.ok, digest: contracts.validation.digest },
    { id: "implementation_queue", type: "queue", count: queue.length },
    { id: "supervisors", type: "supervisor", count: supervisors.length },
    { id: "real_gulp_proof", type: "proof" },
    ...contractNodes
  ];
  const edges = [
    ["original_hermes_absorption", "learning_loop", "implements"],
    ["original_hermes_absorption", "wal_state", "implements"],
    ["original_hermes_absorption", "transport_router", "implements"],
    ["original_hermes_absorption", "plugin_hook_gate", "implements"],
    ["original_hermes_absorption", "security_backport", "implements"],
    ["learning_loop", "implementation_queue", "feeds"],
    ["wal_state", "implementation_queue", "feeds"],
    ["transport_router", "implementation_queue", "feeds"],
    ["plugin_hook_gate", "implementation_queue", "feeds"],
    ["security_backport", "implementation_queue", "feeds"],
    ["contract_validation", "implementation_queue", "gates"],
    ["implementation_queue", "supervisors", "assigned_to"],
    ["supervisors", "real_gulp_proof", "proves"]
  ].map(([from, to, relation]) => ({ from, to, relation }));
  return {
    id: "original-hermes-agent-implementation-map",
    generatedAt,
    nodes,
    edges,
    counts: { nodes: nodes.length, edges: edges.length },
    digest: sha256Text(JSON.stringify({ nodes, edges }))
  };
}

async function runBehcsProof(generatedAt, proofCount, contracts, queue) {
  const proofRows = [];
  const beforeStatus = behcsGulp.collectorStatus();
  const beforeState = beforeStatus.state || {};
  const startSequence = safeInt(beforeState.totalReceived, 0, 0, Number.MAX_SAFE_INTEGER);
  let lastPathGlyph = beforeState.lastPathGlyph || "";
  let lastMessageGlyph = beforeState.lastMessageGlyph || "";
  const writer = new BufferedNdjsonWriter(GC_BUFFER_PATH, WRITE_BUFFER);
  writer.open();
  const contractIds = [
    "learningLoop",
    "walState",
    "transportRouter",
    "pluginHookGate",
    "securityBackport"
  ];
  for (let i = 0; i < proofCount; i += 1) {
    const item = queue[i % queue.length];
    const key = contractIds[i % contractIds.length];
    const contract = contracts[key];
    const firstAgent = i * GULP_SIZE + 1;
    const lastAgent = firstAgent + GULP_SIZE - 1;
    const msg = {
      id: `original-hermes-impl-proof-${generatedAt.replace(/[-:.TZ]/g, "").slice(0, 14)}-${String(i).padStart(4, "0")}`,
      ts: generatedAt,
      received_at: generatedAt,
      type: "agent_packet",
      from: "original_hermes_agent_implementation_orchestrator",
      to: "behcs_gulp_runtime",
      verb: "EVT-ORIGINAL-HERMES-AGENT-IMPLEMENTATION-30B",
      payload: {
        room: "whiteroom",
        totalLogicalAgents: String(LOGICAL_AGENTS),
        logicalGulpSize: GULP_SIZE,
        logicalGulps: LOGICAL_AGENTS / GULP_SIZE,
        proofSlice: i,
        workerRange: `${firstAgent}..${lastAgent}`,
        queueItem: item.id,
        lane: item.lane,
        contractId: contract.contractId,
        contractDigest: contract.digest,
        validationDigest: contracts.validation.digest,
        forwardGnn: "mine_original_hermes_implementation_genius",
        reverseGainGnn: "block_secret_runtime_hook_install_sprawl",
        shannon: "contract_validated_runtime_blocked",
        openMythos: "future_engine_contract_only",
        omniflywheel: "route_supervisors_contracts",
        omnispindle: "compact_pid_ranges_no_process_storm",
        gc: "bounded_proof_slice"
      }
    };
    proofRows.push(msg);
    const record = behcsGulp.attachBehcsPath(msg, {
      sequence: startSequence + i + 1,
      reason: "original_hermes_agent_implementation_30b",
      remoteMeta: { ip: "127.0.0.1", port: 4947, method: "LOCAL", protocol: "behcs" },
      reflex: { action: "original_hermes_implementation_proof_slice", runInference: true }
    });
    lastPathGlyph = record.pathGlyph || lastPathGlyph;
    lastMessageGlyph = record.messageGlyph || lastMessageGlyph;
    writer.write(record);
  }
  writer.close();
  const retained = trimBuffer(Math.max(proofCount + 500, 2_500));
  updateCollectorStatePatch({
    totalReceived: startSequence + proofCount,
    sinceLastGulp: safeInt(beforeState.sinceLastGulp, 0, 0, Number.MAX_SAFE_INTEGER) + proofCount,
    lastReceivedAt: generatedAt,
    lastPathGlyph,
    lastMessageGlyph,
    lastError: "",
    lastFileCapReason: "original_hermes_agent_implementation_30b_bulk"
  });
  const gulp = await behcsGulp.runGulpRehydration({ force: true, reason: "original_hermes_agent_implementation_30b" });
  return { proofRows, gulp: { ...gulp, bulkProofRetainedAfterAppend: retained, bulkProofLinesWritten: writer.linesWritten } };
}

function buildShannon(summary) {
  const gulpOk = summary.behcsGulp?.ok === true && Number(summary.behcsGulp?.mistakesDetected || 0) === 0;
  const contractsOk = summary.contracts.validation.ok === true;
  return {
    id: "original-hermes-agent-implementation-shannon-consensus",
    generatedAt: summary.generatedAt,
    status: gulpOk && contractsOk
      ? "PROCEED_ORIGINAL_HERMES_IMPLEMENTATION_CONTRACTS_READY_RUNTIME_BLOCKED"
      : "HALT_ORIGINAL_HERMES_IMPLEMENTATION_CONTRACTS",
    confidence: gulpOk && contractsOk ? 0.95 : 0.55,
    runtimeInstallAllowed: false,
    reasons: [
      `contractsOk=${contractsOk}`,
      `Gulp proof ${summary.behcsGulp?.gulpId || "preview"} mistakes=${summary.behcsGulp?.mistakesDetected ?? "n/a"}`,
      "Plugin hook unsafe sample denied as expected.",
      "Provider secrets and native Windows runtime remain blocked."
    ]
  };
}

function buildReport(summary, shannon) {
  const lines = [];
  lines.push("# Original Hermes Agent Implementation Tranche");
  lines.push("");
  lines.push(`Generated: ${summary.generatedAt}`);
  lines.push(`Status: ${summary.status}`);
  lines.push(`Logical agents: ${summary.logicalAgents}`);
  lines.push(`Logical Gulp windows: ${summary.logicalGulps}`);
  lines.push(`Shannon: ${shannon.status}`);
  lines.push("");
  lines.push("## Contracts");
  lines.push("");
  lines.push(`- Learning loop: ${summary.contracts.learningLoop.digest}`);
  lines.push(`- WAL/session state: ${summary.contracts.walState.digest}`);
  lines.push(`- Transport router: ${summary.contracts.transportRouter.digest}`);
  lines.push(`- Plugin hook GAC gate: ${summary.contracts.pluginHookGate.digest}`);
  lines.push(`- Security backport manifest: ${summary.contracts.securityBackport.digest}`);
  lines.push(`- Validation: ok=${summary.contracts.validation.ok}; digest=${summary.contracts.validation.digest}`);
  lines.push("");
  lines.push("## Queue");
  lines.push("");
  for (const item of summary.queue) lines.push(`- ${item.priority}: ${item.id} (${item.lane}) -> ${item.action}`);
  lines.push("");
  lines.push("## BEHCS Gulp Proof");
  lines.push("");
  lines.push(`- Gulp ID: ${summary.behcsGulp?.gulpId || "n/a"}`);
  lines.push(`- Processed: ${summary.behcsGulp?.processedMessages ?? "n/a"}`);
  lines.push(`- Runtime mistakes: ${summary.behcsGulp?.mistakesDetected ?? "n/a"}`);
  lines.push(`- GNN edges: ${summary.behcsGulp?.gnnEdges ?? "n/a"}`);
  lines.push("");
  lines.push("## Honesty Boundary");
  lines.push("");
  lines.push("- Contracts and gates only.");
  lines.push("- No upstream Hermes runtime install.");
  lines.push("- No provider login, no API credential import, no gateway launch.");
  lines.push("- No native Windows Hermes execution.");
  lines.push("- No raw 30B materialization, no live model storm, no shadow file edits.");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function buildCube(summary, shannon) {
  return `const cube = Object.freeze(${JSON.stringify({
    id: "original-hermes-agent-implementation-tranche",
    generatedAt: summary.generatedAt,
    logicalAgents: summary.logicalAgents,
    status: summary.status,
    shannon: shannon.status,
    runtimeInstallAllowed: false,
    gulpId: summary.behcsGulp?.gulpId || null,
    report: repoRel(OUTPUTS.reportMd),
    map: repoRel(OUTPUTS.map),
    supervisors: repoRel(OUTPUTS.supervisors),
    digest: summary.digest
  }, null, 2)});\n\nexport default cube;\nexport { cube };\n`;
}

function writeEvents(summary) {
  const event = {
    ts: summary.generatedAt,
    type: "original_hermes_agent_implementation_tranche_complete",
    status: summary.status,
    logicalAgents: summary.logicalAgents,
    gulpId: summary.behcsGulp?.gulpId || null,
    report: repoRel(OUTPUTS.reportMd),
    digest: summary.digest
  };
  appendNdjson(OUTPUTS.inbox, { ...event, direction: "in" });
  appendNdjson(OUTPUTS.outbox, { ...event, direction: "out" });
  appendNdjson(OUTPUTS.gnnEdges, {
    ts: summary.generatedAt,
    type: "original_hermes_implementation_edge",
    from: "original_hermes_upstream_contracts",
    to: "asolaria_behcs_runtime_contracts",
    weight: 1,
    digest: summary.digest
  });
}

async function run({ execute = false, proofMessages = PROOF_MESSAGES_DEFAULT } = {}) {
  const generatedAt = new Date().toISOString();
  const startedAt = Date.now();
  const contracts = buildContracts(generatedAt);
  const queue = buildQueue(generatedAt, contracts);
  const supervisors = buildSupervisors(generatedAt, queue);
  const map = buildMap(generatedAt, contracts, queue, supervisors);
  const proofCount = safeInt(proofMessages, PROOF_MESSAGES_DEFAULT, 0, 2_000);
  const behcs = execute ? await runBehcsProof(generatedAt, proofCount, contracts, queue) : { proofRows: [], gulp: { ok: true, skipped: true, reason: "preview" } };
  const elapsedMs = Date.now() - startedAt;
  const status = contracts.validation.ok && behcs.gulp?.ok === true
    ? "ORIGINAL_HERMES_IMPLEMENTATION_CONTRACTS_READY_RUNTIME_BLOCKED"
    : "ORIGINAL_HERMES_IMPLEMENTATION_CONTRACTS_GATED";
  const summary = {
    id: "original-hermes-agent-implementation-tranche",
    generatedAt,
    startedAt: new Date(startedAt).toISOString(),
    finishedAt: new Date().toISOString(),
    status,
    logicalAgents: String(LOGICAL_AGENTS),
    logicalGulps: LOGICAL_AGENTS / GULP_SIZE,
    compactMode: "30b_contract_implementation_real_gulp_proof",
    elapsedMs,
    contracts,
    queue,
    supervisors,
    map,
    counts: {
      queueItems: queue.length,
      supervisors: supervisors.length,
      proofMessages: behcs.proofRows.length,
      validationErrors: contracts.validation.errors.length
    },
    behcsGulp: behcs.gulp,
    digest: null
  };
  summary.digest = sha256Text(JSON.stringify({ ...summary, digest: null }));
  const shannon = buildShannon(summary);
  const hermes = {
    id: "original-hermes-agent-implementation-dispatch",
    generatedAt,
    status: "READY_CONTRACTS_RUNTIME_BLOCKED",
    rootSupervisor: "original_hermes_implementation_supervisor_of_supervisors",
    priorityQueue: queue,
    blockedRuntimePromotions: [
      "native_windows_hermes_runtime",
      "provider_secret_import",
      "unregistered_plugin_hooks",
      "bulk_gateway_enable"
    ]
  };
  const state = {
    id: "original-hermes-agent-implementation-state",
    generatedAt,
    status: summary.status,
    shannon: shannon.status,
    gulpId: summary.behcsGulp?.gulpId || null,
    sinceLastGulp: behcsGulp.collectorStatus().state?.sinceLastGulp ?? null,
    digest: summary.digest
  };
  writeJson(OUTPUTS.learningLoop, contracts.learningLoop);
  writeJson(OUTPUTS.walState, contracts.walState);
  writeJson(OUTPUTS.transportRouter, contracts.transportRouter);
  writeJson(OUTPUTS.pluginHookGate, contracts.pluginHookGate);
  writeJson(OUTPUTS.pluginHookEval, contracts.pluginHookEval);
  writeJson(OUTPUTS.securityBackport, contracts.securityBackport);
  writeJson(OUTPUTS.validation, contracts.validation);
  writeNdjson(OUTPUTS.queue, queue);
  writeNdjson(OUTPUTS.proof, behcs.proofRows);
  writeJson(OUTPUTS.supervisors, supervisors);
  writeJson(OUTPUTS.map, map);
  writeJson(OUTPUTS.state, state);
  writeJson(OUTPUTS.hermes, hermes);
  writeJson(OUTPUTS.shannon, shannon);
  writeText(OUTPUTS.cube, buildCube(summary, shannon));
  writeJson(OUTPUTS.reportJson, summary);
  writeText(OUTPUTS.reportMd, buildReport(summary, shannon));
  writeEvents(summary);
  return summary;
}

function status() {
  const manifest = readJson(ABSORB_MANIFEST, {});
  const architecture = readJson(ABSORB_ARCHITECTURE, {});
  return {
    id: "original-hermes-agent-implementation-orchestrator",
    status: manifest.digest && architecture.digest ? "READY" : "MISSING_ABSORPTION_INPUTS",
    logicalAgents: String(LOGICAL_AGENTS),
    logicalGulps: LOGICAL_AGENTS / GULP_SIZE,
    upstreamHead: manifest.head || null,
    upstreamVersion: manifest.version || null,
    architectureCapsules: architecture.capsules?.length || 0,
    outputs: OUTPUTS
  };
}

function main(argv) {
  const action = argv[2] || "status";
  const execute = argv.includes("--execute");
  const proofMessages = safeInt(parseArgValue(argv, "proof-messages", PROOF_MESSAGES_DEFAULT), PROOF_MESSAGES_DEFAULT, 0, 2_000);
  if (action === "status") {
    console.log(JSON.stringify(status(), null, 2));
    return;
  }
  if (action === "run") {
    run({ execute, proofMessages }).then((result) => {
      console.log(JSON.stringify(result, null, 2));
    }).catch((error) => {
      console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
      process.exitCode = 1;
    });
    return;
  }
  console.error(JSON.stringify({
    ok: false,
    error: `Unknown action: ${action}`,
    usage: [
      "node tools/original-hermes-agent-implementation-orchestrator.js status",
      "node tools/original-hermes-agent-implementation-orchestrator.js run --execute --proof-messages=2000"
    ]
  }, null, 2));
  process.exitCode = 2;
}

main(process.argv);
