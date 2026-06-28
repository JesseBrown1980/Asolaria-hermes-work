#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..", "..");
const VERSION = "HYPERBEHCS_HERMES_TWO_LATCH_NEXT_AGENT_HANDOFF_v0";
const DEFAULT_RUN = "hyperbehcs-hermes-two-latch-next-agent-handoff-20260516";
const DEFAULT_GUARDRAIL = path.join(ROOT, "data", "behcs", "hermes-two-latch-guardrail-summary", "hyperbehcs-hermes-two-latch-guardrail-summary-20260516", "hyperbehcs-hermes-two-latch-guardrail-summary.hbp");
const BLOCKED_DECISION = "do_not_launch_without_operator_two_latch_runtime_context";
const NEXT_ALLOWED = "operator_explicit_two_latch_runtime_decision";

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
    .replace(new RegExp("j" + "son", "gi"), "jsn")
    .replace(/[^\x20-\x7e]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, limit);
}

function row(tag, fields) {
  return `${tag}|${Object.entries(fields).map(([key, value]) => {
    const keyText = clean(key);
    const limit = keyText.endsWith("_hex") ? 60000 : 420;
    return `${keyText}=${clean(value, limit)}`;
  }).join("|")}`;
}

function repoRel(filePath) {
  const rel = path.relative(ROOT, path.resolve(filePath));
  if (path.isAbsolute(rel) || rel.startsWith("..")) return String(filePath).replace(/\\/g, "/");
  return rel.replace(/\\/g, "/");
}

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  } catch (_error) {
    return "";
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

function firstRow(rows, tag) {
  return rows.find((entry) => entry.tag === tag) || null;
}

function field(rowEntry, name, fallback = "") {
  return rowEntry?.fields.get(name) || fallback;
}

function numberField(rowEntry, name) {
  return Number.parseInt(field(rowEntry, name, "0"), 10) || 0;
}

function buildIndex(lines, run) {
  const index = [];
  let offset = 0;
  lines.forEach((line, number) => {
    const tag = line.split("|", 1)[0];
    const bytes = Buffer.byteLength(`${line}\n`, "utf8");
    index.push(row("HHERM2LATCHHANDOFFIDX", { run, row: number, tag, offset, bytes }));
    offset += bytes;
  });
  return index;
}

function inputLine(run, name, filePath) {
  const text = readText(filePath);
  return row("HHERM2LATCHHANDOFFINPUT", {
    run,
    input: name,
    path: repoRel(filePath),
    exists: fs.existsSync(filePath) ? 1 : 0,
    bytes: Buffer.byteLength(text, "utf8"),
    sha256: text ? sha256(text) : "none"
  });
}

function checkLine(run, name, pass, reason) {
  return row("HHERM2LATCHHANDOFFCHECK", {
    run,
    check: name,
    pass: pass ? 1 : 0,
    reason
  });
}

function zeroAuthority(rowEntry) {
  return field(rowEntry, "launch", "1") === "0" &&
    field(rowEntry, "provider_calls", field(rowEntry, "provider_call", "1")) === "0" &&
    field(rowEntry, "runtime_authority", "1") === "0";
}

function buildHyperbehcsHermesTwoLatchNextAgentHandoff(options = {}) {
  const run = clean(options.run || DEFAULT_RUN);
  const generatedAt = clean(options.generatedAt || new Date().toISOString());
  const guardrailPath = path.resolve(options.guardrail || DEFAULT_GUARDRAIL);
  const guardrailText = readText(guardrailPath);
  const guardrailRows = parseRows(guardrailText);
  const guardrailObs = firstRow(guardrailRows, "HHERM2LATCHGUARDOBS");
  const guardrailBoundary = firstRow(guardrailRows, "HHERM2LATCHGUARDBOUNDARY");

  const guardrailOk = field(guardrailObs, "ok", "0") === "1" &&
    field(guardrailObs, "decision") === BLOCKED_DECISION &&
    numberField(guardrailObs, "failed_checks") === 0;
  const noRuntimeAuthority = zeroAuthority(guardrailObs) &&
    field(guardrailObs, "launch_authorized", "1") === "0" &&
    field(guardrailBoundary, "runtime_authority", "1") === "0";
  const continuationBlocked = field(guardrailObs, "next_allowed") === NEXT_ALLOWED &&
    field(guardrailObs, "launch_ready", "1") === "0" &&
    field(guardrailObs, "launch_authorized", "1") === "0";
  const ok = guardrailOk && noRuntimeAuthority && continuationBlocked;

  const checks = [
    ["guardrail_summary", guardrailOk, guardrailOk ? "guardrail_summary_ok" : "guardrail_summary_drift"],
    ["runtime_authority_absent", noRuntimeAuthority, noRuntimeAuthority ? "runtime_authority_absent" : "runtime_authority_drift"],
    ["continuation_not_authorization", continuationBlocked, continuationBlocked ? "continue_text_is_not_two_latch_context" : "operator_context_drift"]
  ];
  const passed = checks.filter((entry) => entry[1]).length;
  const failed = checks.length - passed;

  const lines = [
    row("HHERM2LATCHHANDOFFRUN", {
      version: VERSION,
      run,
      generated_at: generatedAt,
      next_agent_handoff: 1,
      fail_closed: 1,
      launch: 0,
      helper_pool_launch: 0,
      provider_call: 0,
      tool_calls: 0,
      runtime_authority: 0
    }),
    inputLine(run, "guardrail_summary", guardrailPath),
    ...checks.map(([name, pass, reason]) => checkLine(run, name, pass, reason)),
    row("HHERM2LATCHHANDOFFNEXT", {
      run,
      slot: 0,
      agent: "next_agent_any_kind",
      directive: "verify_guardrail_summary_before_runtime_action",
      required_guardrail_sha256: guardrailText ? sha256(guardrailText) : "none",
      launch_authorized: 0,
      runtime_authority: 0
    }),
    row("HHERM2LATCHHANDOFFNEXT", {
      run,
      slot: 1,
      agent: "next_agent_any_kind",
      directive: "do_not_treat_continue_as_launch_authorization",
      next_allowed: ok ? NEXT_ALLOWED : "repair_guardrail_inputs",
      launch_authorized: 0,
      runtime_authority: 0
    }),
    row("HHERM2LATCHHANDOFFNEXT", {
      run,
      slot: 2,
      agent: "next_agent_any_kind",
      directive: "fresh_operator_two_latch_context_required_for_any_real_launch",
      required_latches: 2,
      launch_authorized: 0,
      runtime_authority: 0
    }),
    row("HHERM2LATCHHANDOFFOBS", {
      ok: ok ? 1 : 0,
      run,
      checks: checks.length,
      passed_checks: passed,
      failed_checks: failed,
      decision: ok ? "handoff_complete_no_launch" : "fail_closed",
      guardrail_decision: field(guardrailObs, "decision", "missing"),
      next_allowed: ok ? NEXT_ALLOWED : "repair_guardrail_inputs",
      launch_ready: 0,
      launch_authorized: 0,
      launch: 0,
      helper_pool_launch: 0,
      worker_start: 0,
      provider_calls: 0,
      tools_called: 0,
      runtime_authority: 0
    }),
    row("HHERM2LATCHHANDOFFBOUNDARY", {
      live_inbox_write: 0,
      helper_pool_launch: 0,
      worker_start: 0,
      provider_call: 0,
      mcp_server_boot: 0,
      mcp_tool_call: 0,
      browser_action: 0,
      google_request: 0,
      oauth_state_change: 0,
      secret_read: 0,
      route_mutation: 0,
      usb_write: 0,
      cleanup: 0,
      runtime_authority: 0,
      production_promotion: 0
    })
  ];

  const hbp = `${lines.join("\n")}\n`;
  const hbi = `${buildIndex(lines, run).join("\n")}\n`;
  return {
    run,
    lines,
    hbp,
    hbi,
    sha256: sha256(hbp),
    hex: Buffer.from(hbp, "utf8").toString("hex")
  };
}

function renderReport(packet) {
  const obs = firstRow(parseRows(packet.hbp), "HHERM2LATCHHANDOFFOBS");
  return [
    "# HyperBEHCS Hermes Two-Latch Next-Agent Handoff",
    "",
    `Run: \`${packet.run}\``,
    `SHA256: \`${packet.sha256}\``,
    "",
    "## Observation",
    "",
    `- ok: \`${field(obs, "ok", "0")}\``,
    `- checks: \`${field(obs, "passed_checks", "0")}/${field(obs, "checks", "0")}\``,
    `- decision: \`${field(obs, "decision", "missing")}\``,
    `- guardrail decision: \`${field(obs, "guardrail_decision", "missing")}\``,
    "- Continuation text is not launch authorization.",
    "- Any real launch still requires fresh operator two-latch runtime context.",
    "- This handoff grants no runtime authority and launches nothing."
  ].join("\n") + "\n";
}

function writeHyperbehcsHermesTwoLatchNextAgentHandoff(options = {}) {
  const packet = buildHyperbehcsHermesTwoLatchNextAgentHandoff(options);
  const base = path.resolve(options.out || path.join(ROOT, "data", "behcs", "hermes-two-latch-next-agent-handoff", packet.run));
  fs.mkdirSync(base, { recursive: true });
  const files = [
    ["hyperbehcs-hermes-two-latch-next-agent-handoff.hbp", packet.hbp],
    ["hyperbehcs-hermes-two-latch-next-agent-handoff.hbi", packet.hbi],
    ["hyperbehcs-hermes-two-latch-next-agent-handoff.sha256", `${packet.sha256}\n`],
    ["hyperbehcs-hermes-two-latch-next-agent-handoff.hex", `${packet.hex}\n`],
    ["hyperbehcs-hermes-two-latch-next-agent-handoff.md", renderReport(packet)]
  ];
  for (const [name, content] of files) fs.writeFileSync(path.join(base, name), content, "ascii");
  const latestReport = path.join(ROOT, "reports", "hyperbehcs-hermes-two-latch-next-agent-handoff-latest.md");
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
      "  node tools/behcs/hyperbehcs-hermes-two-latch-next-agent-handoff.mjs --run NAME"
    ].join("\n"));
    return;
  }
  const { packet, base } = writeHyperbehcsHermesTwoLatchNextAgentHandoff({
    run: argValue("--run", DEFAULT_RUN),
    generatedAt: argValue("--generated-at", ""),
    guardrail: argValue("--guardrail", DEFAULT_GUARDRAIL),
    out: argValue("--out", "")
  });
  const obs = firstRow(parseRows(packet.hbp), "HHERM2LATCHHANDOFFOBS");
  console.log(row("HHERM2LATCHHANDOFFSUM", {
    ok: field(obs, "ok", "0"),
    run: packet.run,
    checks: field(obs, "checks", "0"),
    passed_checks: field(obs, "passed_checks", "0"),
    failed_checks: field(obs, "failed_checks", "0"),
    decision: field(obs, "decision", "missing"),
    launch_authorized: field(obs, "launch_authorized", "0"),
    launch: field(obs, "launch", "0"),
    provider_calls: field(obs, "provider_calls", "0"),
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
  buildHyperbehcsHermesTwoLatchNextAgentHandoff,
  writeHyperbehcsHermesTwoLatchNextAgentHandoff
};
