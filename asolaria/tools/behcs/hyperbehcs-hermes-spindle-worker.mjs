#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..", "..");
const DEFAULT_HERMES_ROOT = "D:\\Asolaria-External\\hermes-agent-upstream";
const DEFAULT_SPINDLE_ROOT = path.join(ROOT, "runtime", "hyperbehcs-hermes-spindle");

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  if (index === -1 || index + 1 >= process.argv.length) return fallback;
  return process.argv[index + 1];
}

function hasArg(name) {
  return process.argv.includes(name);
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

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function fromHex(value) {
  const text = String(value || "").trim();
  if (!/^(?:[0-9a-fA-F]{2})+$/.test(text)) return "";
  return Buffer.from(text, "hex").toString("utf8");
}

function mkdirs(root) {
  for (const rel of ["inbox", "outbox", "leases", "go", "hookwall", "gnn", "logs", "access"]) {
    fs.mkdirSync(path.join(root, rel), { recursive: true });
  }
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

function firstRow(rows, tag, predicate = () => true) {
  return rows.find((entry) => entry.tag === tag && predicate(entry)) || null;
}

function slotName(slot) {
  return `helper-${String(slot).padStart(2, "0")}`;
}

function pathsFor(root, slot) {
  const name = slotName(slot);
  return {
    inbox: path.join(root, "inbox", `${name}.hbp`),
    outbox: path.join(root, "outbox", `${name}.hbp`),
    lease: path.join(root, "leases", `${name}.lease.hbp`),
    hookwall: path.join(root, "hookwall", `${name}.hbp`),
    gnn: path.join(root, "gnn", `${name}.hbp`),
    access: path.join(root, "access", `${name}.hbp`),
    log: path.join(root, "logs", `${name}.txt`)
  };
}

function append(file, line) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `${line}\n`, "ascii");
}

function acquireLease(file, slot, pid) {
  const line = row("HHERMLEASE", {
    slot,
    pid,
    started_at: new Date().toISOString(),
    state: "held"
  });
  try {
    const fd = fs.openSync(file, "wx");
    fs.writeFileSync(fd, `${line}\n`, "ascii");
    fs.closeSync(fd);
    return true;
  } catch (_error) {
    return false;
  }
}

function releaseLease(file, slot, pid) {
  try {
    fs.unlinkSync(file);
  } catch (_error) {
    return;
  }
  console.log(row("HHERMWORKLEASE", { slot, pid, state: "released" }));
}

function completedTaskIds(file) {
  const ids = new Set();
  if (!fs.existsSync(file)) return ids;
  for (const parsed of parseRows(fs.readFileSync(file, "utf8"))) {
    if (parsed.tag !== "HHERMRESULT") continue;
    const id = parsed.fields.get("task_id");
    if (id) ids.add(id);
  }
  return ids;
}

function readNextTask(inboxFile, outboxFile) {
  if (!fs.existsSync(inboxFile)) return null;
  const completed = completedTaskIds(outboxFile);
  const text = fs.readFileSync(inboxFile, "utf8");
  for (const parsed of parseRows(text)) {
    if (parsed.tag !== "HHERMTASK") continue;
    const taskId = parsed.fields.get("task_id") || sha256(parsed.line).slice(0, 16);
    if (completed.has(taskId)) continue;
    const prompt = fromHex(parsed.fields.get("prompt_hex")) || parsed.fields.get("prompt") || "";
    return {
      taskId,
      prompt,
      allowProvider: parsed.fields.get("allow_provider") === "1",
      allowTools: parsed.fields.get("allow_tools") === "1",
      runtime: parsed.fields.get("runtime") || "",
      provider: parsed.fields.get("provider") || "",
      pid: parsed.fields.get("pid") || "",
      raw: parsed.line
    };
  }
  return null;
}

function readAccessDescriptor(options) {
  const supplied = String(options.accessPointer || "").trim();
  const pointer = supplied ? path.resolve(supplied) : pathsFor(options.spindleRoot, options.slot).access;
  if (!fs.existsSync(pointer)) {
    return {
      state: "missing",
      pointer,
      bytes: 0,
      sha256: "none",
      access: 0,
      mcp: 0,
      hyper: 0,
      gates: 0
    };
  }
  const raw = fs.readFileSync(pointer, "utf8").replace(/^\uFEFF/, "");
  const rows = parseRows(raw);
  const helperAccess = firstRow(rows, "HHERMHELPERACCESS");
  return {
    state: "present",
    pointer,
    bytes: Buffer.byteLength(raw, "utf8"),
    sha256: sha256(raw),
    access: helperAccess?.fields.get("access") || 0,
    mcp: helperAccess?.fields.get("mcp") || 0,
    hyper: helperAccess?.fields.get("hyper") || 0,
    gates: helperAccess?.fields.get("gates") || rows.filter((entry) => entry.tag === "HHERMHELPERACCESSGATE").length
  };
}

function buildSubagentPrompt(task, options, access = readAccessDescriptor(options)) {
  const accessRows = access.state === "present" ? [
    row("HHERMSUBACCESS", {
      slot: options.slot,
      state: access.state,
      pointer: access.pointer,
      sha256: access.sha256,
      bytes: access.bytes,
      access: access.access,
      mcp: access.mcp,
      hyper: access.hyper,
      gates: access.gates,
      hydrate: 0,
      call_authority: 0,
      runtime_authority: 0
    })
  ] : [];
  return [
    row("HHERMSUBCONTRACT", {
      pid: task.pid || `HHERM-PID-${String(options.slot).padStart(2, "0")}`,
      slot: options.slot,
      runtime: options.runtime,
      frontend: 0,
      shell: 0,
      headerless: 1,
      borderless: 1,
      format: "tuple_rows"
    }),
    ...accessRows,
    row("HHERMSUBPIPE", { stage: "memory", action: "load_slot_memory_context" }),
    row("HHERMSUBPIPE", { stage: "index", action: "load_hbp_hbi_pointer_context" }),
    row("HHERMSUBPIPE", { stage: "think", action: "reason_inside_slot_contract" }),
    row("HHERMSUBPIPE", { stage: "memory_plan", action: "emit_memory_plan_pointer" }),
    row("HHERMSUBPIPE", { stage: "index_memory_think", action: "merge_index_memory_reasoning" }),
    row("HHERMSUBPIPE", { stage: "execute", action: "run_bounded_task_and_emit_receipts" }),
    "",
    String(task.prompt || "")
  ].join("\n");
}

function resolveCodexLaunch(rawCommand) {
  const command = String(rawCommand || process.env.ASOLARIA_CODEX_CLI || "").trim();
  const candidates = [];
  if (command) candidates.push(command);
  const where = process.platform === "win32"
    ? spawnSync("where", ["codex"], { encoding: "utf8", shell: false, windowsHide: true })
    : spawnSync("which", ["codex"], { encoding: "utf8", shell: false, windowsHide: true });
  if (where.status === 0) {
    candidates.push(...String(where.stdout || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean));
  }
  candidates.push("codex");

  for (const item of candidates) {
    if (process.platform === "win32") {
      const codexDir = path.dirname(item);
      const nodeExePath = path.join(codexDir, "node.exe");
      const codexJsPath = path.join(codexDir, "node_modules", "@openai", "codex", "bin", "codex.js");
      if (fs.existsSync(nodeExePath) && fs.existsSync(codexJsPath)) {
        return { command: nodeExePath, prefixArgs: [codexJsPath], shell: false };
      }
      if (item.toLowerCase().endsWith(".cmd") || item.toLowerCase().endsWith(".ps1")) {
        continue;
      }
    }
    return { command: item, prefixArgs: [], shell: false };
  }
  return { command: "codex", prefixArgs: [], shell: false };
}

function runHermesTask(task, options) {
  if (!task.allowProvider) {
    return {
      ok: 0,
      state: "blocked",
      reason: "provider_gate",
      stdout: "",
      stderr: "",
      code: 1
    };
  }
  const env = {
    ...process.env,
    HERMES_PYTHON_SRC_ROOT: options.hermesRoot,
    HERMES_CWD: options.hermesRoot,
      PYTHONPATH: `${options.hermesRoot}${path.delimiter}${process.env.PYTHONPATH || ""}`
  };
  if (!task.allowTools) {
    env.HERMES_TUI_TOOLSETS = "";
  }
  const result = spawnSync(options.python, ["-m", "hermes_cli.main", "--oneshot", buildSubagentPrompt(task, options)], {
    cwd: options.hermesRoot,
    env,
    encoding: "utf8",
    shell: false,
    timeout: options.timeoutMs,
    windowsHide: true
  });
  return {
    ok: result.status === 0 ? 1 : 0,
    state: result.status === 0 ? "complete" : "failed",
    reason: result.error ? result.error.message : "",
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    code: result.status ?? 1
  };
}

function runCodexTask(task, options) {
  if (!task.allowProvider) {
    return {
      ok: 0,
      state: "blocked",
      reason: "provider_gate",
      stdout: "",
      stderr: "",
      code: 1
    };
  }
  const launch = resolveCodexLaunch(options.codexCli);
  const args = [
    "-a",
    "never",
    "-s",
    options.sandbox,
    "-m",
    options.codexModel,
    "-c",
    `model_reasoning_effort="${options.codexReasoning}"`,
    "exec",
    "--skip-git-repo-check",
    "-C",
    options.workdir,
    buildSubagentPrompt(task, options)
  ];
  const result = spawnSync(launch.command, [...launch.prefixArgs, ...args], {
    cwd: options.workdir,
    env: process.env,
    encoding: "utf8",
    shell: false,
    timeout: options.timeoutMs,
    windowsHide: true
  });
  return {
    ok: result.status === 0 ? 1 : 0,
    state: result.status === 0 ? "complete" : "failed",
    reason: result.error ? result.error.message : "",
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    code: result.status ?? 1
  };
}

function runTask(task, options) {
  const requested = String(task.runtime || task.provider || options.runtime || "hermes").toLowerCase();
  if (requested === "codex" || requested === "codex_headless" || requested === "codex_subagent") {
    return runCodexTask(task, { ...options, runtime: "codex" });
  }
  return runHermesTask(task, { ...options, runtime: "hermes" });
}

function writeReceipts(files, slot, task, result) {
  const digest = sha256(`${result.stdout}\n${result.stderr}`);
  fs.writeFileSync(files.log, [
    result.reason ? `reason=${result.reason}` : "",
    result.stdout || "",
    result.stderr || ""
  ].filter(Boolean).join("\n"), "utf8");
  append(files.outbox, row("HHERMRESULT", {
    slot,
    task_id: task.taskId,
    ok: result.ok,
    state: result.state,
    code: result.code,
    reason: result.reason || "",
    result_sha256: digest,
    result_log: files.log
  }));
  append(files.hookwall, row("HHERMHOOKEVENT", {
    event: result.ok ? "AgentComplete" : "AgentProcess",
    slot,
    task_id: task.taskId,
    state: result.state,
    ok: result.ok
  }));
  append(files.gnn, row("HHERMGNNVEC", {
    slot,
    task_id: task.taskId,
    signal: "helper_activity",
    sha256: digest,
    state: result.state
  }));
}

function workerOnce(options) {
  mkdirs(options.spindleRoot);
  const files = pathsFor(options.spindleRoot, options.slot);
  const pid = process.pid;
  if (!acquireLease(files.lease, options.slot, pid)) {
    console.log(row("HHERMWORK", { ok: 0, slot: options.slot, reason: "lease_exists" }));
    return 2;
  }
  try {
    console.log(row("HHERMWORK", {
      ok: 1,
      slot: options.slot,
      mode: "once",
      root: options.spindleRoot,
      hermes_root: options.hermesRoot
    }));
    const task = readNextTask(files.inbox, files.outbox);
    if (!task) {
      append(files.hookwall, row("HHERMHOOKEVENT", { event: "AgentSpawn", slot: options.slot, state: "idle" }));
      console.log(row("HHERMWORKIDLE", { slot: options.slot, inbox: files.inbox }));
      return 0;
    }
    append(files.hookwall, row("HHERMHOOKEVENT", { event: "AgentSpawn", slot: options.slot, task_id: task.taskId }));
    const result = options.dryRun
      ? { ok: 1, state: "dry_run", reason: "", stdout: "dry_run", stderr: "", code: 0 }
      : runTask(task, options);
    writeReceipts(files, options.slot, task, result);
    console.log(row("HHERMWORKDONE", { slot: options.slot, task_id: task.taskId, state: result.state, ok: result.ok }));
    return result.ok ? 0 : 1;
  } finally {
    if (options.releaseLease) releaseLease(files.lease, options.slot, pid);
  }
}

function workerLoop(options) {
  mkdirs(options.spindleRoot);
  const files = pathsFor(options.spindleRoot, options.slot);
  const pid = process.pid;
  if (!acquireLease(files.lease, options.slot, pid)) {
    console.log(row("HHERMWORK", { ok: 0, slot: options.slot, reason: "lease_exists" }));
    return 2;
  }
  console.log(row("HHERMWORK", {
    ok: 1,
    slot: options.slot,
    mode: "loop",
    root: options.spindleRoot,
    hermes_root: options.hermesRoot,
    poll_ms: options.pollMs
  }));
  setInterval(() => {
    const task = readNextTask(files.inbox, files.outbox);
    if (!task) return;
    append(files.hookwall, row("HHERMHOOKEVENT", { event: "AgentProcess", slot: options.slot, task_id: task.taskId }));
    const result = runTask(task, options);
    writeReceipts(files, options.slot, task, result);
    console.log(row("HHERMWORKDONE", { slot: options.slot, task_id: task.taskId, state: result.state, ok: result.ok }));
  }, options.pollMs).unref();
  process.stdin.resume();
  return 0;
}

function previewPrompt(options) {
  mkdirs(options.spindleRoot);
  const files = pathsFor(options.spindleRoot, options.slot);
  const task = readNextTask(files.inbox, files.outbox);
  const access = readAccessDescriptor(options);
  if (!task) {
    console.log(row("HHERMWORKPROMPT", {
      ok: 0,
      slot: options.slot,
      reason: "no_task",
      access_pointer: access.pointer,
      access_exists: access.state === "present" ? 1 : 0,
      runtime_call: 0
    }));
    return 0;
  }
  const prompt = buildSubagentPrompt(task, options, access);
  console.log(row("HHERMWORKPROMPT", {
    ok: 1,
    slot: options.slot,
    task_id: task.taskId,
    prompt_sha256: sha256(prompt),
    bytes: Buffer.byteLength(prompt, "utf8"),
    subaccess: prompt.includes("HHERMSUBACCESS|") ? 1 : 0,
    access_pointer: access.pointer,
    access_exists: access.state === "present" ? 1 : 0,
    access: access.access,
    mcp: access.mcp,
    hyper: access.hyper,
    gates: access.gates,
    hydrate: 0,
    call_authority: 0,
    runtime_authority: 0,
    runtime_call: 0
  }));
  return 0;
}

function main() {
  const options = {
    slot: Number.parseInt(argValue("--slot", "0"), 10),
    spindleRoot: path.resolve(argValue("--spindle-root", DEFAULT_SPINDLE_ROOT)),
    hermesRoot: path.resolve(argValue("--hermes-root", DEFAULT_HERMES_ROOT)),
    python: argValue("--python", "python"),
    runtime: argValue("--runtime", "hermes").toLowerCase() === "codex" ? "codex" : "hermes",
    codexCli: argValue("--codex-cli", ""),
    codexModel: argValue("--codex-model", "gpt-5.5"),
    codexReasoning: argValue("--codex-reasoning", "xhigh"),
    accessPointer: argValue("--access-pointer", ""),
    sandbox: argValue("--sandbox", "workspace-write"),
    workdir: path.resolve(argValue("--workdir", ROOT)),
    pollMs: Math.max(1000, Number.parseInt(argValue("--poll-ms", "5000"), 10)),
    timeoutMs: Math.max(5000, Number.parseInt(argValue("--timeout-ms", "600000"), 10)),
    dryRun: hasArg("--dry-run"),
    releaseLease: hasArg("--release-lease")
  };
  if (!Number.isInteger(options.slot) || options.slot < 0 || options.slot > 23) {
    console.error(row("HHERMWORKERR", { ok: 0, reason: "slot_out_of_range", slot: options.slot }));
    process.exitCode = 1;
    return;
  }
  if (hasArg("--preview-prompt")) {
    process.exitCode = previewPrompt(options);
    return;
  }
  if (hasArg("--status")) {
    const files = pathsFor(options.spindleRoot, options.slot);
    console.log(row("HHERMWORKSTATUS", {
      slot: options.slot,
      root: options.spindleRoot,
      hermes_root: options.hermesRoot,
      runtime: options.runtime,
      codex_model: options.codexModel,
      codex_reasoning: options.codexReasoning,
      inbox: files.inbox,
      outbox: files.outbox,
      access: path.join(options.spindleRoot, "access"),
      access_exists: fs.existsSync(path.join(options.spindleRoot, "access")) ? 1 : 0,
      access_pointer: files.access,
      access_pointer_exists: fs.existsSync(files.access) ? 1 : 0,
      lease: files.lease,
      lease_exists: fs.existsSync(files.lease) ? 1 : 0,
      runtime_call: 0
    }));
    return;
  }
  const code = hasArg("--loop") ? workerLoop(options) : workerOnce(options);
  process.exitCode = code;
}

try {
  main();
} catch (error) {
  console.error(row("HHERMWORKERR", { ok: 0, reason: error?.message || error }));
  process.exitCode = 1;
}
