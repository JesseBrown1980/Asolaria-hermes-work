#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..", "..");
const VERSION = "HYPERBEHCS_HERMES_WORKER_PROMPT_PREVIEW_SWEEP_v0";
const DEFAULT_RUN = "hyperbehcs-hermes-worker-prompt-preview-sweep-20260516";
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

function firstRow(rows, tag) {
  return rows.find((entry) => entry.tag === tag) || null;
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
    index.push(row("HHERMPREVIEWSWEEPIDX", { run, row: number, tag, offset, bytes }));
    offset += bytes;
  });
  return index;
}

function writePreviewTask(options) {
  const helper = slotName(options.slot);
  const taskId = `${options.run}-slot${String(options.slot).padStart(2, "0")}`;
  const prompt = row("HHERMPREVIEWSWEEPTASKPROMPT", {
    run: options.run,
    slot: options.slot,
    helper,
    goal: "preview_worker_root_access_pointer",
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
  const inbox = path.join(options.sweepRoot, "inbox", `${helper}.hbp`);
  fs.writeFileSync(inbox, `${taskRow}\n`, "ascii");
  return { taskId, prompt, inbox };
}

function runWorkerPreview(options) {
  const helper = slotName(options.slot);
  const accessPointer = path.join(options.sourceRoot, "access", `${helper}.hbp`);
  const result = spawnSync("node", [
    options.workerScript,
    "--preview-prompt",
    "--slot",
    String(options.slot),
    "--spindle-root",
    options.sweepRoot,
    "--runtime",
    "codex",
    "--access-pointer",
    accessPointer,
    "--workdir",
    ROOT
  ], {
    cwd: ROOT,
    encoding: "utf8",
    shell: false,
    timeout: options.timeoutMs,
    windowsHide: true
  });
  const promptRow = firstRow(parseRows(result.stdout), "HHERMWORKPROMPT");
  return {
    code: result.status ?? 1,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    promptRow,
    accessPointer
  };
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
  const rows = parseRows(fs.readFileSync(pointer, "utf8").replace(/^\uFEFF/, ""));
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

function buildHyperbehcsHermesWorkerPromptPreviewSweep(options = {}) {
  const run = clean(options.run || DEFAULT_RUN);
  const generatedAt = clean(options.generatedAt || new Date().toISOString());
  const sourceRoot = path.resolve(options.sourceRoot || DEFAULT_SOURCE_ROOT);
  const sweepRoot = path.resolve(options.sweepRoot || path.join(ROOT, "runtime", run));
  const workerScript = path.resolve(options.workerScript || DEFAULT_WORKER);
  const slots = Math.max(1, Math.min(24, Number.parseInt(String(options.slots ?? 24), 10) || 24));
  const timeoutMs = Math.max(5000, Number.parseInt(String(options.timeoutMs ?? 30000), 10) || 30000);
  mkdirs(sweepRoot);

  const lines = [
    row("HHERMPREVIEWSWEEPRUN", {
      version: VERSION,
      run,
      generated_at: generatedAt,
      source_root: repoRel(sourceRoot),
      sweep_root: repoRel(sweepRoot),
      worker: repoRel(workerScript),
      slots,
      runtime: "codex",
      preview_processes: slots,
      worker_execution: 0,
      provider_call: 0,
      tool_calls: 0,
      runtime_authority: 0
    }),
    row("HHERMPREVIEWSWEEPROOT", {
      run,
      source_root: repoRel(sourceRoot),
      sweep_root: repoRel(sweepRoot),
      source_mutation: 0,
      sweep_inbox_write: 1,
      access_pointer_mode: "source_root_override"
    })
  ];

  let previewedSlots = 0;
  let subaccessSlots = 0;
  let readyAccessSlots = 0;
  let promptBytes = 0;
  let failures = 0;

  for (let slot = 0; slot < slots; slot += 1) {
    const helper = slotName(slot);
    const task = writePreviewTask({ run, slot, sweepRoot });
    const preview = runWorkerPreview({ slot, sourceRoot, sweepRoot, workerScript, timeoutMs });
    const pointer = readAccessPointerSummary(preview.accessPointer);
    const fields = preview.promptRow?.fields || new Map();
    const ok = fields.get("ok") === "1" && preview.code === 0 ? 1 : 0;
    const subaccess = fields.get("subaccess") === "1" ? 1 : 0;
    const accessExists = fields.get("access_exists") === "1" ? 1 : 0;
    const access = fields.get("access") || "0";
    const mcp = fields.get("mcp") || "0";
    const hyper = fields.get("hyper") || "0";
    const gates = fields.get("gates") || "0";
    const hydrate = fields.get("hydrate") || "0";
    const callAuthority = fields.get("call_authority") || "missing";
    const runtimeAuthority = fields.get("runtime_authority") || "missing";
    const runtimeCall = fields.get("runtime_call") || "missing";
    const ready = ok &&
      subaccess === 1 &&
      accessExists === 1 &&
      access === "1" &&
      mcp === "8" &&
      hyper === "6" &&
      gates === "8" &&
      pointer.state === "present" &&
      pointer.access === "1" &&
      pointer.mcp === "8" &&
      pointer.hyper === "6" &&
      pointer.gates === "8" &&
      pointer.gateRows === 8 &&
      pointer.callAuthority === "0" &&
      pointer.runtimeAuthority === "0" &&
      hydrate === "0" &&
      callAuthority === "0" &&
      runtimeAuthority === "0" &&
      runtimeCall === "0";
    if (ok) previewedSlots += 1;
    if (subaccess) subaccessSlots += 1;
    if (ready) readyAccessSlots += 1;
    if (!ready) failures += 1;
    promptBytes += Number.parseInt(fields.get("bytes") || "0", 10) || 0;

    lines.push(row("HHERMPREVIEWSWEEPTASK", {
      run,
      slot,
      helper,
      task_id: task.taskId,
      inbox: repoRel(task.inbox),
      allow_provider: 0,
      allow_tools: 0,
      prompt_sha256: sha256(task.prompt)
    }));
    lines.push(row("HHERMPREVIEWSWEEPSLOT", {
      run,
      slot,
      helper,
      ok,
      task_id: fields.get("task_id") || "missing",
      prompt_sha256: fields.get("prompt_sha256") || "missing",
      bytes: fields.get("bytes") || 0,
      subaccess,
      access_pointer: repoRel(preview.accessPointer),
      access_exists: accessExists,
      access,
      mcp,
      hyper,
      gates,
      pointer_state: pointer.state,
      pointer_access: pointer.access,
      pointer_mcp: pointer.mcp,
      pointer_hyper: pointer.hyper,
      pointer_gates: pointer.gates,
      pointer_gate_rows: pointer.gateRows,
      pointer_call_authority: pointer.callAuthority,
      pointer_runtime_authority: pointer.runtimeAuthority,
      hydrate,
      call_authority: callAuthority,
      runtime_authority: runtimeAuthority,
      runtime_call: runtimeCall,
      code: preview.code,
      stdout_sha256: sha256(preview.stdout),
      stderr_sha256: sha256(preview.stderr),
      ready: ready ? 1 : 0
    }));
  }

  lines.push(row("HHERMPREVIEWSWEEPOBS", {
    ok: failures === 0 && previewedSlots === slots && subaccessSlots === slots && readyAccessSlots === slots ? 1 : 0,
    previewed_slots: previewedSlots,
    expected_slots: slots,
    subaccess_slots: subaccessSlots,
    ready_access_slots: readyAccessSlots,
    failures,
    prompt_bytes: promptBytes,
    source_mutation: 0,
    provider_calls: 0,
    tools_called: 0,
    runtime_authority: 0
  }));
  lines.push(row("HHERMPREVIEWSWEEPGATE", {
    mcp_server_boot: 0,
    mcp_tool_call: 0,
    browser_action: 0,
    google_request: 0,
    oauth_state_change: 0,
    secret_read: 0,
    route_mutation: 0,
    usb_write: 0,
    worker_execution: 0,
    runtime_authority: 0,
    production_promotion: 0
  }));

  const hbp = `${lines.join("\n")}\n`;
  const hbi = `${buildIndex(lines, run).join("\n")}\n`;
  return {
    run,
    generatedAt,
    sourceRoot,
    sweepRoot,
    lines,
    hbp,
    hbi,
    sha256: sha256(hbp),
    hex: Buffer.from(hbp, "utf8").toString("hex")
  };
}

function renderReport(packet) {
  const obs = firstRow(parseRows(packet.hbp), "HHERMPREVIEWSWEEPOBS");
  return [
    "# HyperBEHCS Hermes Worker Prompt Preview Sweep",
    "",
    `Run: \`${packet.run}\``,
    `SHA256: \`${packet.sha256}\``,
    "",
    "## Observation",
    "",
    `- ok: \`${obs?.fields.get("ok") || 0}\``,
    `- previewed slots: \`${obs?.fields.get("previewed_slots") || 0}/${obs?.fields.get("expected_slots") || 0}\``,
    `- subaccess slots: \`${obs?.fields.get("subaccess_slots") || 0}\``,
    `- ready access slots: \`${obs?.fields.get("ready_access_slots") || 0}\``,
    `- failures: \`${obs?.fields.get("failures") || 0}\``,
    `- prompt bytes: \`${obs?.fields.get("prompt_bytes") || 0}\``,
    "- The sweep writes preview tasks only into its run-specific preview root.",
    "- No helper execution, provider, MCP tool, browser action, Google request, secret read, USB write, runtime authority, or production promotion is launched."
  ].join("\n") + "\n";
}

function writeHyperbehcsHermesWorkerPromptPreviewSweep(options = {}) {
  const packet = buildHyperbehcsHermesWorkerPromptPreviewSweep(options);
  const base = path.resolve(options.out || path.join(ROOT, "data", "behcs", "hermes-worker-preview-sweep", packet.run));
  fs.mkdirSync(base, { recursive: true });
  const files = [
    ["hyperbehcs-hermes-worker-prompt-preview-sweep.hbp", packet.hbp],
    ["hyperbehcs-hermes-worker-prompt-preview-sweep.hbi", packet.hbi],
    ["hyperbehcs-hermes-worker-prompt-preview-sweep.sha256", `${packet.sha256}\n`],
    ["hyperbehcs-hermes-worker-prompt-preview-sweep.hex", `${packet.hex}\n`],
    ["hyperbehcs-hermes-worker-prompt-preview-sweep.md", renderReport(packet)]
  ];
  for (const [name, content] of files) fs.writeFileSync(path.join(base, name), content, "ascii");
  const latestReport = path.join(ROOT, "reports", "hyperbehcs-hermes-worker-prompt-preview-sweep-latest.md");
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
      "  node tools/behcs/hyperbehcs-hermes-worker-prompt-preview-sweep.mjs --source-root PATH --slots 24"
    ].join("\n"));
    return;
  }
  const { packet, base } = writeHyperbehcsHermesWorkerPromptPreviewSweep({
    run: argValue("--run", DEFAULT_RUN),
    generatedAt: argValue("--generated-at", ""),
    sourceRoot: argValue("--source-root", DEFAULT_SOURCE_ROOT),
    sweepRoot: argValue("--sweep-root", ""),
    workerScript: argValue("--worker-script", DEFAULT_WORKER),
    slots: Number.parseInt(argValue("--slots", "24"), 10),
    timeoutMs: Number.parseInt(argValue("--timeout-ms", "30000"), 10),
    out: argValue("--out", "")
  });
  const obs = firstRow(parseRows(packet.hbp), "HHERMPREVIEWSWEEPOBS");
  console.log(row("HHERMPREVIEWSWEEPSUM", {
    ok: obs?.fields.get("ok") || 0,
    run: packet.run,
    previewed_slots: obs?.fields.get("previewed_slots") || 0,
    expected_slots: obs?.fields.get("expected_slots") || 0,
    subaccess_slots: obs?.fields.get("subaccess_slots") || 0,
    ready_access_slots: obs?.fields.get("ready_access_slots") || 0,
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
  buildHyperbehcsHermesWorkerPromptPreviewSweep,
  writeHyperbehcsHermesWorkerPromptPreviewSweep
};
