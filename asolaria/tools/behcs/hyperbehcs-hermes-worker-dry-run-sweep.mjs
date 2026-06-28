#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..", "..");
const VERSION = "HYPERBEHCS_HERMES_WORKER_DRY_RUN_SWEEP_v0";
const DEFAULT_RUN = "hyperbehcs-hermes-worker-dry-run-sweep-20260516";
const DEFAULT_SOURCE_ROOT = path.join(ROOT, "runtime", "hyperbehcs-hermes-mcp-subaccess-duo");
const DEFAULT_WORKER = path.join(ROOT, "tools", "behcs", "hyperbehcs-hermes-spindle-worker.mjs");
const BUSES = ["inbox", "outbox", "leases", "go", "hookwall", "gnn", "logs", "access"];

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  if (index === -1 || index + 1 >= process.argv.length) return fallback;
  return process.argv[index + 1];
}

function hasArg(name) {
  return process.argv.includes(name);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function clean(value, limit = 420) {
  return String(value ?? "")
    .replace(/[|{}\[\]"\r\n\t]/g, "_")
    .replace(/[^\x20-\x7e]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, limit);
}

function row(tag, fields) {
  return `${tag}|${Object.entries(fields).map(([key, value]) => {
    const keyText = clean(key);
    return `${keyText}=${clean(value, keyText.endsWith("_hex") ? 60000 : 420)}`;
  }).join("|")}`;
}

function repoRel(filePath) {
  const rel = path.relative(ROOT, filePath);
  if (path.isAbsolute(rel) || rel.startsWith("..")) return String(filePath).replace(/\\/g, "/");
  return rel.replace(/\\/g, "/");
}

function parseRows(text) {
  const rows = [];
  for (const line of String(text || "").split(/\r?\n/)) {
    if (!line.trim()) continue;
    const parts = line.split("|");
    const tag = parts.shift();
    const fields = new Map();
    for (const part of parts) {
      const pivot = part.indexOf("=");
      if (pivot > 0) fields.set(part.slice(0, pivot), part.slice(pivot + 1));
    }
    rows.push({ tag, fields, line });
  }
  return rows;
}

function readRows(filePath) {
  try {
    return parseRows(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
  } catch (_error) {
    return [];
  }
}

function firstRow(rows, tag, predicate = () => true) {
  return rows.find((entry) => entry.tag === tag && predicate(entry)) || null;
}

function slotName(slot) {
  return `helper-${String(slot).padStart(2, "0")}`;
}

function mkdirs(root) {
  for (const rel of BUSES) fs.mkdirSync(path.join(root, rel), { recursive: true });
}

function buildIndex(lines, run) {
  const index = [];
  let offset = 0;
  lines.forEach((line, number) => {
    const tag = line.split("|", 1)[0];
    const bytes = Buffer.byteLength(`${line}\n`, "utf8");
    index.push(row("HHERMDRYSWEEPIDX", { run, row: number, tag, offset, bytes }));
    offset += bytes;
  });
  return index;
}

function writeDryRunTask(options) {
  const helper = slotName(options.slot);
  const taskId = `${options.run}-slot${String(options.slot).padStart(2, "0")}`;
  const prompt = row("HHERMDRYSWEEPTASKPROMPT", {
    run: options.run,
    slot: options.slot,
    helper,
    goal: "dry_run_worker_receipt_path",
    provider_call: 0,
    tool_calls: 0,
    runtime_authority: 0
  });
  const taskRow = row("HHERMTASK", {
    task_id: taskId,
    command: "/Goal",
    runtime: "codex",
    provider: "codex",
    pid: `HHERM-PID-${String(options.slot).padStart(2, "0")}`,
    allow_provider: 0,
    allow_tools: 0,
    prompt_hex: Buffer.from(prompt, "utf8").toString("hex")
  });
  const inbox = path.join(options.dryRoot, "inbox", `${helper}.hbp`);
  fs.writeFileSync(inbox, `${taskRow}\n`, "ascii");
  return { taskId, prompt, inbox };
}

function copyAccessPointer(options) {
  const helper = slotName(options.slot);
  const source = path.join(options.sourceRoot, "access", `${helper}.hbp`);
  const target = path.join(options.dryRoot, "access", `${helper}.hbp`);
  if (!fs.existsSync(source)) return { source, target, copied: 0 };
  fs.copyFileSync(source, target);
  return { source, target, copied: 1 };
}

function readAccessPointerSummary(pointer) {
  if (!fs.existsSync(pointer)) {
    return {
      state: "missing",
      access: "0",
      mcp: "0",
      hyper: "0",
      gates: "0",
      gateRows: 0,
      callAuthority: "missing",
      runtimeAuthority: "missing"
    };
  }
  const rows = readRows(pointer);
  const access = firstRow(rows, "HHERMHELPERACCESS");
  return {
    state: "present",
    access: access?.fields.get("access") || "0",
    mcp: access?.fields.get("mcp") || "0",
    hyper: access?.fields.get("hyper") || "0",
    gates: access?.fields.get("gates") || "0",
    gateRows: rows.filter((entry) => entry.tag === "HHERMHELPERACCESSGATE").length,
    callAuthority: access?.fields.get("call_authority") || "missing",
    runtimeAuthority: access?.fields.get("runtime_authority") || "missing"
  };
}

function runWorkerDryRun(options) {
  const result = spawnSync("node", [
    options.workerScript,
    "--slot",
    String(options.slot),
    "--spindle-root",
    options.dryRoot,
    "--runtime",
    "codex",
    "--dry-run",
    "--release-lease",
    "--workdir",
    ROOT
  ], {
    cwd: ROOT,
    encoding: "utf8",
    shell: false,
    timeout: options.timeoutMs,
    windowsHide: true
  });
  return {
    code: result.status ?? 1,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    stdoutRows: parseRows(result.stdout)
  };
}

function buildHyperbehcsHermesWorkerDryRunSweep(options = {}) {
  const run = clean(options.run || DEFAULT_RUN);
  const generatedAt = clean(options.generatedAt || new Date().toISOString());
  const sourceRoot = path.resolve(options.sourceRoot || DEFAULT_SOURCE_ROOT);
  const dryRoot = path.resolve(options.dryRoot || path.join(ROOT, "runtime", run));
  const workerScript = path.resolve(options.workerScript || DEFAULT_WORKER);
  const slots = Math.max(1, Math.min(24, Number.parseInt(String(options.slots ?? 24), 10) || 24));
  const timeoutMs = Math.max(5000, Number.parseInt(String(options.timeoutMs ?? 30000), 10) || 30000);
  mkdirs(dryRoot);

  const lines = [
    row("HHERMDRYSWEEPRUN", {
      version: VERSION,
      run,
      generated_at: generatedAt,
      source_root: repoRel(sourceRoot),
      dry_root: repoRel(dryRoot),
      worker: repoRel(workerScript),
      slots,
      runtime: "codex",
      dry_run: 1,
      worker_processes: slots,
      provider_call: 0,
      tool_calls: 0,
      runtime_authority: 0
    }),
    row("HHERMDRYSWEEPROOT", {
      run,
      source_root: repoRel(sourceRoot),
      dry_root: repoRel(dryRoot),
      source_mutation: 0,
      dry_root_write: 1,
      release_lease: 1
    })
  ];

  let completedSlots = 0;
  let outboxReceipts = 0;
  let hookSpawnReceipts = 0;
  let hookCompleteReceipts = 0;
  let gnnReceipts = 0;
  let releasedLeases = 0;
  let copiedAccess = 0;
  let failures = 0;

  for (let slot = 0; slot < slots; slot += 1) {
    const helper = slotName(slot);
    const task = writeDryRunTask({ run, slot, dryRoot });
    const accessCopy = copyAccessPointer({ slot, sourceRoot, dryRoot });
    const access = readAccessPointerSummary(accessCopy.target);
    if (accessCopy.copied) copiedAccess += 1;
    const worker = runWorkerDryRun({ slot, dryRoot, workerScript, timeoutMs });
    const outboxPath = path.join(dryRoot, "outbox", `${helper}.hbp`);
    const hookPath = path.join(dryRoot, "hookwall", `${helper}.hbp`);
    const gnnPath = path.join(dryRoot, "gnn", `${helper}.hbp`);
    const leasePath = path.join(dryRoot, "leases", `${helper}.lease.hbp`);
    const logPath = path.join(dryRoot, "logs", `${helper}.txt`);
    const outboxRows = readRows(outboxPath);
    const hookRows = readRows(hookPath);
    const gnnRows = readRows(gnnPath);
    const resultRow = firstRow(outboxRows, "HHERMRESULT", (entry) => entry.fields.get("task_id") === task.taskId);
    const hookSpawn = firstRow(hookRows, "HHERMHOOKEVENT", (entry) => entry.fields.get("event") === "AgentSpawn" && entry.fields.get("task_id") === task.taskId);
    const hookComplete = firstRow(hookRows, "HHERMHOOKEVENT", (entry) => entry.fields.get("event") === "AgentComplete" && entry.fields.get("task_id") === task.taskId);
    const gnnVec = firstRow(gnnRows, "HHERMGNNVEC", (entry) => entry.fields.get("task_id") === task.taskId);
    const workDone = firstRow(worker.stdoutRows, "HHERMWORKDONE", (entry) => entry.fields.get("task_id") === task.taskId);
    const leaseRelease = firstRow(worker.stdoutRows, "HHERMWORKLEASE", (entry) => entry.fields.get("slot") === String(slot) && entry.fields.get("state") === "released");
    const leaseExists = fs.existsSync(leasePath) ? 1 : 0;
    const logExists = fs.existsSync(logPath) ? 1 : 0;
    const ready = worker.code === 0 &&
      resultRow?.fields.get("ok") === "1" &&
      resultRow?.fields.get("state") === "dry_run" &&
      resultRow?.fields.get("code") === "0" &&
      hookSpawn &&
      hookComplete?.fields.get("state") === "dry_run" &&
      hookComplete?.fields.get("ok") === "1" &&
      gnnVec?.fields.get("state") === "dry_run" &&
      workDone?.fields.get("state") === "dry_run" &&
      workDone?.fields.get("ok") === "1" &&
      leaseRelease &&
      leaseExists === 0 &&
      logExists === 1 &&
      access.state === "present" &&
      access.access === "1" &&
      access.mcp === "8" &&
      access.hyper === "6" &&
      access.gates === "8" &&
      access.gateRows === 8 &&
      access.callAuthority === "0" &&
      access.runtimeAuthority === "0";

    if (ready) completedSlots += 1;
    if (resultRow) outboxReceipts += 1;
    if (hookSpawn) hookSpawnReceipts += 1;
    if (hookComplete) hookCompleteReceipts += 1;
    if (gnnVec) gnnReceipts += 1;
    if (leaseExists === 0 && leaseRelease) releasedLeases += 1;
    if (!ready) failures += 1;

    lines.push(row("HHERMDRYSWEEPTASK", {
      run,
      slot,
      helper,
      task_id: task.taskId,
      inbox: repoRel(task.inbox),
      allow_provider: 0,
      allow_tools: 0,
      prompt_sha256: sha256(task.prompt)
    }));
    lines.push(row("HHERMDRYSWEEPSLOT", {
      run,
      slot,
      helper,
      ok: ready ? 1 : 0,
      task_id: task.taskId,
      worker_code: worker.code,
      work_done: workDone ? 1 : 0,
      outbox: resultRow ? 1 : 0,
      result_state: resultRow?.fields.get("state") || "missing",
      result_ok: resultRow?.fields.get("ok") || 0,
      hook_spawn: hookSpawn ? 1 : 0,
      hook_complete: hookComplete ? 1 : 0,
      gnn: gnnVec ? 1 : 0,
      gnn_state: gnnVec?.fields.get("state") || "missing",
      log: logExists,
      lease_released: leaseExists === 0 && leaseRelease ? 1 : 0,
      lease_exists: leaseExists,
      access_copied: accessCopy.copied,
      access_pointer: repoRel(accessCopy.target),
      access: access.access,
      mcp: access.mcp,
      hyper: access.hyper,
      gates: access.gates,
      pointer_gate_rows: access.gateRows,
      pointer_call_authority: access.callAuthority,
      pointer_runtime_authority: access.runtimeAuthority,
      provider_call: 0,
      tool_calls: 0,
      runtime_authority: 0,
      stdout_sha256: sha256(worker.stdout),
      stderr_sha256: sha256(worker.stderr),
      ready: ready ? 1 : 0
    }));
  }

  lines.push(row("HHERMDRYSWEEPOBS", {
    ok: failures === 0 && completedSlots === slots ? 1 : 0,
    completed_slots: completedSlots,
    expected_slots: slots,
    outbox_receipts: outboxReceipts,
    hook_spawn_receipts: hookSpawnReceipts,
    hook_complete_receipts: hookCompleteReceipts,
    gnn_receipts: gnnReceipts,
    released_leases: releasedLeases,
    copied_access_pointers: copiedAccess,
    failures,
    source_mutation: 0,
    provider_calls: 0,
    tools_called: 0,
    runtime_authority: 0
  }));
  lines.push(row("HHERMDRYSWEEPGATE", {
    mcp_server_boot: 0,
    mcp_tool_call: 0,
    browser_action: 0,
    google_request: 0,
    oauth_state_change: 0,
    secret_read: 0,
    route_mutation: 0,
    usb_write: 0,
    provider_call: 0,
    runtime_authority: 0,
    production_promotion: 0
  }));

  const hbp = `${lines.join("\n")}\n`;
  const hbi = `${buildIndex(lines, run).join("\n")}\n`;
  return {
    run,
    generatedAt,
    sourceRoot,
    dryRoot,
    lines,
    hbp,
    hbi,
    sha256: sha256(hbp),
    hex: Buffer.from(hbp, "utf8").toString("hex")
  };
}

function renderReport(packet) {
  const obs = firstRow(parseRows(packet.hbp), "HHERMDRYSWEEPOBS");
  return [
    "# HyperBEHCS Hermes Worker Dry-Run Sweep",
    "",
    `Run: \`${packet.run}\``,
    `SHA256: \`${packet.sha256}\``,
    "",
    "## Observation",
    "",
    `- ok: \`${obs?.fields.get("ok") || 0}\``,
    `- completed slots: \`${obs?.fields.get("completed_slots") || 0}/${obs?.fields.get("expected_slots") || 0}\``,
    `- outbox receipts: \`${obs?.fields.get("outbox_receipts") || 0}\``,
    `- hook complete receipts: \`${obs?.fields.get("hook_complete_receipts") || 0}\``,
    `- GNN receipts: \`${obs?.fields.get("gnn_receipts") || 0}\``,
    `- released leases: \`${obs?.fields.get("released_leases") || 0}\``,
    `- copied access pointers: \`${obs?.fields.get("copied_access_pointers") || 0}\``,
    `- failures: \`${obs?.fields.get("failures") || 0}\``,
    "- The sweep writes only into its run-specific dry root.",
    "- No provider, MCP tool, browser action, Google request, secret read, USB write, runtime authority, or production promotion is launched."
  ].join("\n") + "\n";
}

function writeHyperbehcsHermesWorkerDryRunSweep(options = {}) {
  const packet = buildHyperbehcsHermesWorkerDryRunSweep(options);
  const base = path.resolve(options.out || path.join(ROOT, "data", "behcs", "hermes-worker-dry-run-sweep", packet.run));
  fs.mkdirSync(base, { recursive: true });
  const files = [
    ["hyperbehcs-hermes-worker-dry-run-sweep.hbp", packet.hbp],
    ["hyperbehcs-hermes-worker-dry-run-sweep.hbi", packet.hbi],
    ["hyperbehcs-hermes-worker-dry-run-sweep.sha256", `${packet.sha256}\n`],
    ["hyperbehcs-hermes-worker-dry-run-sweep.hex", `${packet.hex}\n`],
    ["hyperbehcs-hermes-worker-dry-run-sweep.md", renderReport(packet)]
  ];
  for (const [name, content] of files) fs.writeFileSync(path.join(base, name), content, "ascii");
  const latestReport = path.join(ROOT, "reports", "hyperbehcs-hermes-worker-dry-run-sweep-latest.md");
  if (options.writeLatestReport !== false) {
    fs.mkdirSync(path.dirname(latestReport), { recursive: true });
    fs.writeFileSync(latestReport, renderReport(packet), "ascii");
  }
  return { packet, base, latestReport };
}

function main() {
  if (hasArg("--help")) {
    console.log([
      "Usage:",
      "  node tools/behcs/hyperbehcs-hermes-worker-dry-run-sweep.mjs --source-root PATH --slots 24"
    ].join("\n"));
    return;
  }
  const { packet, base } = writeHyperbehcsHermesWorkerDryRunSweep({
    run: argValue("--run", DEFAULT_RUN),
    generatedAt: argValue("--generated-at", ""),
    sourceRoot: argValue("--source-root", DEFAULT_SOURCE_ROOT),
    dryRoot: argValue("--dry-root", ""),
    workerScript: argValue("--worker-script", DEFAULT_WORKER),
    slots: Number.parseInt(argValue("--slots", "24"), 10),
    timeoutMs: Number.parseInt(argValue("--timeout-ms", "30000"), 10),
    out: argValue("--out", "")
  });
  const obs = firstRow(parseRows(packet.hbp), "HHERMDRYSWEEPOBS");
  console.log(row("HHERMDRYSWEEPSUM", {
    ok: obs?.fields.get("ok") || 0,
    run: packet.run,
    completed_slots: obs?.fields.get("completed_slots") || 0,
    expected_slots: obs?.fields.get("expected_slots") || 0,
    outbox_receipts: obs?.fields.get("outbox_receipts") || 0,
    hook_complete_receipts: obs?.fields.get("hook_complete_receipts") || 0,
    gnn_receipts: obs?.fields.get("gnn_receipts") || 0,
    released_leases: obs?.fields.get("released_leases") || 0,
    failures: obs?.fields.get("failures") || 0,
    sha256: packet.sha256,
    out: repoRel(base)
  }));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(error?.stack || error);
    process.exitCode = 1;
  }
}

export {
  buildHyperbehcsHermesWorkerDryRunSweep,
  writeHyperbehcsHermesWorkerDryRunSweep
};
