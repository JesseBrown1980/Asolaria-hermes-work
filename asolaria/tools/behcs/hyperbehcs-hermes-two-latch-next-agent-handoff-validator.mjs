#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..", "..");
const VERSION = "HYPERBEHCS_HERMES_TWO_LATCH_NEXT_AGENT_HANDOFF_VALIDATOR_v0";
const DEFAULT_RUN = "hyperbehcs-hermes-two-latch-next-agent-handoff-validator-20260516";
const DEFAULT_HANDOFF = path.join(ROOT, "data", "behcs", "hermes-two-latch-next-agent-handoff", "hyperbehcs-hermes-two-latch-next-agent-handoff-20260516", "hyperbehcs-hermes-two-latch-next-agent-handoff.hbp");
const HANDOFF_DECISION = "handoff_complete_no_launch";
const GUARDRAIL_DECISION = "do_not_launch_without_operator_two_latch_runtime_context";
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

function rowsByTag(rows, tag) {
  return rows.filter((entry) => entry.tag === tag);
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
    index.push(row("HHERM2LATCHHANDOFFVALIDX", { run, row: number, tag, offset, bytes }));
    offset += bytes;
  });
  return index;
}

function resolveInputPath(inputPath) {
  const normalized = String(inputPath || "").replace(/\//g, path.sep);
  if (!normalized) return "";
  if (path.isAbsolute(normalized)) return normalized;
  return path.join(ROOT, normalized);
}

function inputLine(run, name, filePath) {
  const text = readText(filePath);
  return row("HHERM2LATCHHANDOFFVALINPUT", {
    run,
    input: name,
    path: repoRel(filePath),
    exists: fs.existsSync(filePath) ? 1 : 0,
    bytes: Buffer.byteLength(text, "utf8"),
    sha256: text ? sha256(text) : "none"
  });
}

function refLine(run, name, filePath, expectedSha) {
  const text = readText(filePath);
  const actualSha = text ? sha256(text) : "none";
  return row("HHERM2LATCHHANDOFFVALREF", {
    run,
    input: name,
    path: repoRel(filePath),
    exists: fs.existsSync(filePath) ? 1 : 0,
    expected_sha256: expectedSha || "missing",
    actual_sha256: actualSha,
    pass: expectedSha && expectedSha === actualSha ? 1 : 0
  });
}

function checkLine(run, name, pass, reason, extra = {}) {
  return row("HHERM2LATCHHANDOFFVALCHECK", {
    run,
    check: name,
    pass: pass ? 1 : 0,
    reason,
    ...extra
  });
}

function zeroAuthority(rowEntry) {
  return field(rowEntry, "launch", "1") === "0" &&
    field(rowEntry, "provider_calls", field(rowEntry, "provider_call", "1")) === "0" &&
    field(rowEntry, "runtime_authority", "1") === "0";
}

function directivePresent(nextRows, directive) {
  return nextRows.some((entry) =>
    field(entry, "directive") === directive &&
    field(entry, "launch_authorized", "1") === "0" &&
    field(entry, "runtime_authority", "1") === "0"
  );
}

function buildHyperbehcsHermesTwoLatchNextAgentHandoffValidator(options = {}) {
  const run = clean(options.run || DEFAULT_RUN);
  const generatedAt = clean(options.generatedAt || new Date().toISOString());
  const handoffPath = path.resolve(options.handoff || DEFAULT_HANDOFF);
  const handoffText = readText(handoffPath);
  const handoffRows = parseRows(handoffText);
  const runRow = firstRow(handoffRows, "HHERM2LATCHHANDOFFRUN");
  const obsRow = firstRow(handoffRows, "HHERM2LATCHHANDOFFOBS");
  const boundaryRow = firstRow(handoffRows, "HHERM2LATCHHANDOFFBOUNDARY");
  const inputRows = rowsByTag(handoffRows, "HHERM2LATCHHANDOFFINPUT");
  const nextRows = rowsByTag(handoffRows, "HHERM2LATCHHANDOFFNEXT");
  const guardrailInput = inputRows.find((entry) => field(entry, "input") === "guardrail_summary") || null;
  const guardrailPath = resolveInputPath(field(guardrailInput, "path"));
  const guardrailExpectedSha = field(guardrailInput, "sha256");
  const guardrailText = readText(guardrailPath);
  const guardrailRows = parseRows(guardrailText);
  const guardrailObs = firstRow(guardrailRows, "HHERM2LATCHGUARDOBS");

  const handoffShapeOk = field(runRow, "next_agent_handoff", "0") === "1" &&
    field(runRow, "fail_closed", "0") === "1" &&
    field(runRow, "launch", "1") === "0" &&
    field(runRow, "provider_call", "1") === "0" &&
    field(runRow, "runtime_authority", "1") === "0";
  const handoffObsOk = field(obsRow, "ok", "0") === "1" &&
    field(obsRow, "decision") === HANDOFF_DECISION &&
    field(obsRow, "guardrail_decision") === GUARDRAIL_DECISION &&
    field(obsRow, "next_allowed") === NEXT_ALLOWED &&
    numberField(obsRow, "failed_checks") === 0 &&
    field(obsRow, "launch_authorized", "1") === "0" &&
    field(obsRow, "launch_ready", "1") === "0" &&
    zeroAuthority(obsRow);
  const boundaryOk = field(boundaryRow, "helper_pool_launch", "1") === "0" &&
    field(boundaryRow, "worker_start", "1") === "0" &&
    field(boundaryRow, "provider_call", "1") === "0" &&
    field(boundaryRow, "cleanup", "1") === "0" &&
    field(boundaryRow, "runtime_authority", "1") === "0" &&
    field(boundaryRow, "production_promotion", "1") === "0";
  const directivesOk = directivePresent(nextRows, "do_not_treat_continue_as_launch_authorization") &&
    directivePresent(nextRows, "fresh_operator_two_latch_context_required_for_any_real_launch") &&
    directivePresent(nextRows, "verify_guardrail_summary_before_runtime_action");
  const guardrailShaOk = Boolean(guardrailExpectedSha) &&
    Boolean(guardrailText) &&
    sha256(guardrailText) === guardrailExpectedSha;
  const guardrailOk = field(guardrailObs, "ok", "0") === "1" &&
    field(guardrailObs, "decision") === GUARDRAIL_DECISION &&
    field(guardrailObs, "launch_authorized", "1") === "0" &&
    zeroAuthority(guardrailObs);

  const checks = [
    ["handoff_shape", handoffShapeOk, handoffShapeOk ? "handoff_shape_ok" : "handoff_shape_drift"],
    ["handoff_observation", handoffObsOk, handoffObsOk ? "handoff_observation_ok" : "handoff_observation_drift"],
    ["handoff_boundary", boundaryOk, boundaryOk ? "handoff_boundary_zero_authority" : "handoff_boundary_drift"],
    ["handoff_directives", directivesOk, directivesOk ? "handoff_directives_ok" : "handoff_directives_drift"],
    ["guardrail_sha_readback", guardrailShaOk, guardrailShaOk ? "guardrail_sha_readback_ok" : "guardrail_sha_readback_drift"],
    ["guardrail_observation", guardrailOk, guardrailOk ? "guardrail_observation_ok" : "guardrail_observation_drift"]
  ];
  const passed = checks.filter((entry) => entry[1]).length;
  const failed = checks.length - passed;
  const ok = failed === 0;

  const lines = [
    row("HHERM2LATCHHANDOFFVALRUN", {
      version: VERSION,
      run,
      generated_at: generatedAt,
      validator: 1,
      fail_closed: 1,
      launch: 0,
      helper_pool_launch: 0,
      provider_call: 0,
      tool_calls: 0,
      runtime_authority: 0
    }),
    inputLine(run, "next_agent_handoff", handoffPath),
    refLine(run, "guardrail_summary", guardrailPath, guardrailExpectedSha),
    ...checks.map(([name, pass, reason]) => checkLine(run, name, pass, reason)),
    row("HHERM2LATCHHANDOFFVALOBS", {
      ok: ok ? 1 : 0,
      run,
      checks: checks.length,
      passed_checks: passed,
      failed_checks: failed,
      decision: ok ? "validated_handoff_no_launch" : "fail_closed",
      handoff_decision: field(obsRow, "decision", "missing"),
      guardrail_decision: field(guardrailObs, "decision", field(obsRow, "guardrail_decision", "missing")),
      next_allowed: ok ? NEXT_ALLOWED : "repair_handoff_inputs",
      launch_ready: 0,
      launch_authorized: 0,
      launch: 0,
      helper_pool_launch: 0,
      worker_start: 0,
      provider_calls: 0,
      tools_called: 0,
      runtime_authority: 0
    }),
    row("HHERM2LATCHHANDOFFVALBOUNDARY", {
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
      production_promotion: 0,
      next_allowed: ok ? NEXT_ALLOWED : "repair_handoff_inputs"
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
  const obs = firstRow(parseRows(packet.hbp), "HHERM2LATCHHANDOFFVALOBS");
  return [
    "# HyperBEHCS Hermes Two-Latch Next-Agent Handoff Validator",
    "",
    `Run: \`${packet.run}\``,
    `SHA256: \`${packet.sha256}\``,
    "",
    "## Observation",
    "",
    `- ok: \`${field(obs, "ok", "0")}\``,
    `- checks: \`${field(obs, "passed_checks", "0")}/${field(obs, "checks", "0")}\``,
    `- decision: \`${field(obs, "decision", "missing")}\``,
    `- handoff decision: \`${field(obs, "handoff_decision", "missing")}\``,
    `- guardrail decision: \`${field(obs, "guardrail_decision", "missing")}\``,
    "- Validator is read-only and grants no launch or runtime authority.",
    "- A plain continue remains non-authorizing."
  ].join("\n") + "\n";
}

function writeHyperbehcsHermesTwoLatchNextAgentHandoffValidator(options = {}) {
  const packet = buildHyperbehcsHermesTwoLatchNextAgentHandoffValidator(options);
  const base = path.resolve(options.out || path.join(ROOT, "data", "behcs", "hermes-two-latch-next-agent-handoff-validator", packet.run));
  fs.mkdirSync(base, { recursive: true });
  const files = [
    ["hyperbehcs-hermes-two-latch-next-agent-handoff-validator.hbp", packet.hbp],
    ["hyperbehcs-hermes-two-latch-next-agent-handoff-validator.hbi", packet.hbi],
    ["hyperbehcs-hermes-two-latch-next-agent-handoff-validator.sha256", `${packet.sha256}\n`],
    ["hyperbehcs-hermes-two-latch-next-agent-handoff-validator.hex", `${packet.hex}\n`],
    ["hyperbehcs-hermes-two-latch-next-agent-handoff-validator.md", renderReport(packet)]
  ];
  for (const [name, content] of files) fs.writeFileSync(path.join(base, name), content, "ascii");
  const latestReport = path.join(ROOT, "reports", "hyperbehcs-hermes-two-latch-next-agent-handoff-validator-latest.md");
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
      "  node tools/behcs/hyperbehcs-hermes-two-latch-next-agent-handoff-validator.mjs --run NAME"
    ].join("\n"));
    return;
  }
  const { packet, base } = writeHyperbehcsHermesTwoLatchNextAgentHandoffValidator({
    run: argValue("--run", DEFAULT_RUN),
    generatedAt: argValue("--generated-at", ""),
    handoff: argValue("--handoff", DEFAULT_HANDOFF),
    out: argValue("--out", "")
  });
  const obs = firstRow(parseRows(packet.hbp), "HHERM2LATCHHANDOFFVALOBS");
  console.log(row("HHERM2LATCHHANDOFFVALSUM", {
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
  buildHyperbehcsHermesTwoLatchNextAgentHandoffValidator,
  writeHyperbehcsHermesTwoLatchNextAgentHandoffValidator
};
