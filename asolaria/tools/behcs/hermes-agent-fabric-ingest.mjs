#!/usr/bin/env node
/**
 * hermes-agent-fabric-ingest.mjs
 *
 * Updates/indexes NousResearch/hermes-agent into the BEHCS fabric without
 * vendoring the whole upstream repo into Asolaria Git.
 *
 * Writes compact local artifacts:
 *   data/behcs/hermes-agent/hermes-agent-package-index-latest.json
 *   data/behcs/hermes-agent/hermes-agent-fabric-ingest-latest.ndjson
 *   data/behcs/hermes-agent/hermes-agent-behcs1024-tuple-index-latest.json
 *   data/behcs/hermes-agent/hermes-agent-gnn-edges-latest.ndjson
 *   data/behcs/hookwall/hermes-agent-hookwall-patterns-latest.json
 *   data/behcs/mistake-patterns/hermes-agent-mistake-patterns-latest.json
 *   data/behcs/pid-fabric/overlays/hermes-agent-supervisor-overlay-latest.json
 *   reports/hermes-agent-fabric-ingest-latest.md
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..", "..");
const DEFAULT_SOURCE = "C:\\Users\\acer\\.cache\\asolaria\\hermes-agent";
const REPO_URL = "https://github.com/NousResearch/hermes-agent.git";
const OUT_DIR = path.join(ROOT, "data", "behcs", "hermes-agent");
const OVERLAY_DIR = path.join(ROOT, "data", "behcs", "pid-fabric", "overlays");
const REPORT_DIR = path.join(ROOT, "reports");
const PACKAGE_INDEX = path.join(OUT_DIR, "hermes-agent-package-index-latest.json");
const FABRIC_NDJSON = path.join(OUT_DIR, "hermes-agent-fabric-ingest-latest.ndjson");
const TUPLE_INDEX = path.join(OUT_DIR, "hermes-agent-behcs1024-tuple-index-latest.json");
const GNN_EDGES = path.join(OUT_DIR, "hermes-agent-gnn-edges-latest.ndjson");
const HOOKWALL_DIR = path.join(ROOT, "data", "behcs", "hookwall");
const HOOKWALL_PATTERNS = path.join(HOOKWALL_DIR, "hermes-agent-hookwall-patterns-latest.json");
const MISTAKE_DIR = path.join(ROOT, "data", "behcs", "mistake-patterns");
const MISTAKE_PATTERNS = path.join(MISTAKE_DIR, "hermes-agent-mistake-patterns-latest.json");
const OVERLAY_PATH = path.join(OVERLAY_DIR, "hermes-agent-supervisor-overlay-latest.json");
const REPORT_PATH = path.join(REPORT_DIR, "hermes-agent-fabric-ingest-latest.md");

const EXCLUDE_DIRS = new Set([
  ".git", ".venv", "venv", "__pycache__", "node_modules", ".mypy_cache",
  ".pytest_cache", ".ruff_cache", "dist", "build", ".tox", ".cache"
]);
const MANIFEST_NAMES = new Set([
  "package.json", "pyproject.toml", "setup.py", "setup.cfg", "requirements.txt",
  "uv.lock", "poetry.lock", "pnpm-lock.yaml", "yarn.lock"
]);

const GATED_SURFACES = [
  {
    id: "hidden",
    label: "hidden file/folder surface",
    risk: 6,
    tuple: { D4_RISK: 6, D31_SHADOW_MIRROR: "local_cache_snapshot", D37_AUTHORITY_TOPOLOGY: "operator_local", D47_BOUNDARY: "opaque_inferred" },
    gate: "hidden_surface_metadata_only",
    mistake: "do_not_treat_hidden_files_as_public_corpus"
  },
  {
    id: "stealth",
    label: "stealth envelope surface",
    risk: 7,
    tuple: { D4_RISK: 7, D38_ENCRYPTION: "vault_encrypted", D47_BOUNDARY: "boundary_typed" },
    gate: "stealth_payload_redaction_required",
    mistake: "never_expand_stealth_payload_into_plaintext_index"
  },
  {
    id: "restricted",
    label: "restricted authority surface",
    risk: 8,
    tuple: { D4_RISK: 8, D28_APPROVAL_BOX: "hard_deny", D37_AUTHORITY_TOPOLOGY: "hard_deny_gate", D47_BOUNDARY: "acl_shaped" },
    gate: "restricted_surface_owner_gate",
    mistake: "operator_authority_required_before_action"
  },
  {
    id: "secret",
    label: "secret/vault surface",
    risk: 9,
    tuple: { D4_RISK: 9, D38_ENCRYPTION: "vault_encrypted", D46_VAULT: "hardened_secrets", D47_BOUNDARY: "opaque_inferred" },
    gate: "secret_material_forbidden_in_index",
    mistake: "index_metadata_only_no_secret_values"
  },
  {
    id: "shadow",
    label: "shadow/mirror evidence surface",
    risk: 5,
    tuple: { D4_RISK: 5, D31_SHADOW_MIRROR: "local_cache_snapshot", D32_STRUCTURAL_INVARIANT: "single_run", D47_BOUNDARY: "negative_space_dominant" },
    gate: "shadow_evidence_not_live_truth",
    mistake: "shadow_rows_require_promotion_before_use"
  },
  {
    id: "drive",
    label: "drive descriptor surface",
    risk: 6,
    tuple: { D4_RISK: 6, D15_DEVICE: "storage_descriptor", D21_HARDWARE: "drive", D47_BOUNDARY: "ttl_fingerprinted" },
    gate: "drive_descriptor_no_raw_path_dump",
    mistake: "drive_paths_are_redacted_or_hashed"
  },
  {
    id: "folder",
    label: "folder descriptor surface",
    risk: 5,
    tuple: { D4_RISK: 5, D3_TARGET: "index", D13_SURFACE: "folder_descriptor", D47_BOUNDARY: "boundary_typed" },
    gate: "folder_descriptor_no_bulk_copy",
    mistake: "folder_inventory_is_metadata_not_content"
  },
  {
    id: "file",
    label: "file descriptor surface",
    risk: 5,
    tuple: { D4_RISK: 5, D3_TARGET: "index", D13_SURFACE: "file_descriptor", D11_PROOF: "hash", D47_BOUNDARY: "boundary_typed" },
    gate: "file_hash_only_until_promoted",
    mistake: "file_contents_not_ingested_without_owner_approval"
  },
  {
    id: "usb",
    label: "USB bridge and removable-media surface",
    risk: 7,
    tuple: { D4_RISK: 7, D21_HARDWARE: "usb", D31_SHADOW_MIRROR: "sovereignty_USB_snapshot", D34_CROSS_COLONY: "document_share_v0", D47_BOUNDARY: "asymmetric_reach" },
    gate: "usb_bridge_metadata_only",
    mistake: "usb_tasks_must_not_reveal_vault_values"
  }
];

function arg(name, def = null) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

const sourceRoot = path.resolve(arg("--source", process.env.HERMES_AGENT_SOURCE || DEFAULT_SOURCE));
const sync = process.argv.includes("--sync");

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function sha256File(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function sha16(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, 16);
}

function runGit(args, cwd = ROOT) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    shell: false,
    timeout: 180000,
    windowsHide: true
  });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${(result.stderr || result.stdout || "").slice(0, 500)}`);
  }
  return String(result.stdout || "").trim();
}

function syncSource() {
  if (fs.existsSync(path.join(sourceRoot, ".git"))) {
    runGit(["-C", sourceRoot, "fetch", "--depth", "1", "origin", "main"]);
    runGit(["-C", sourceRoot, "checkout", "main"]);
    runGit(["-C", sourceRoot, "reset", "--hard", "origin/main"]);
    return "updated";
  }
  ensureDir(path.dirname(sourceRoot));
  runGit(["clone", "--depth", "1", REPO_URL, sourceRoot]);
  return "cloned";
}

function gitInfo() {
  if (!fs.existsSync(path.join(sourceRoot, ".git"))) return {};
  return {
    remote: REPO_URL,
    commit: runGit(["-C", sourceRoot, "rev-parse", "HEAD"]),
    short_commit: runGit(["-C", sourceRoot, "rev-parse", "--short=12", "HEAD"]),
    committed_at: runGit(["-C", sourceRoot, "log", "-1", "--format=%cI"]),
    subject: runGit(["-C", sourceRoot, "log", "-1", "--format=%s"]),
  };
}

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDE_DIRS.has(ent.name)) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      walk(full, out);
    } else if (ent.isFile()) {
      out.push(full);
    }
  }
  return out;
}

function rel(file) {
  return path.relative(sourceRoot, file).replace(/\\/g, "/");
}

function classifyFile(file) {
  const r = rel(file);
  const name = path.basename(file);
  if (MANIFEST_NAMES.has(name) || /^requirements.*\.txt$/i.test(name)) return "manifest";
  if (/\/SKILL\.md$/i.test(r)) return "skill";
  if (/^hermes_cli\/.*\.py$/i.test(r)) return "python_package";
  if (/^packages\/[^/]+\/package\.json$/i.test(r)) return "node_package";
  if (/\/tests?\//i.test(r) || /(^|\/)test_.*\.py$/i.test(r) || /\.test\.[jt]s$/i.test(r)) return "test";
  if (/README|CHANGELOG|RELEASE|LICENSE/i.test(name)) return "doc";
  return "source";
}

function packageStem(file) {
  const r = rel(file);
  if (r.startsWith("hermes_cli/")) return "hermes_cli";
  const parts = r.split("/");
  if (parts[0] === "packages" && parts[1]) return `packages/${parts[1]}`;
  if (parts[0] === "skills" && parts[1]) return `skills/${parts[1]}`;
  return parts[0] || ".";
}

function buildIndex() {
  if (!fs.existsSync(sourceRoot)) throw new Error(`Hermes source not found: ${sourceRoot}`);
  const files = walk(sourceRoot);
  const byClass = {};
  const byPackage = {};
  const manifests = [];
  const skillFiles = [];
  for (const file of files) {
    const cls = classifyFile(file);
    byClass[cls] = (byClass[cls] || 0) + 1;
    const pkg = packageStem(file);
    byPackage[pkg] = byPackage[pkg] || { files: 0, classes: {}, manifests: [] };
    byPackage[pkg].files++;
    byPackage[pkg].classes[cls] = (byPackage[pkg].classes[cls] || 0) + 1;
    if (cls === "manifest") {
      const item = { path: rel(file), sha256: sha256File(file), bytes: fs.statSync(file).size };
      manifests.push(item);
      byPackage[pkg].manifests.push(item);
    }
    if (cls === "skill") skillFiles.push(rel(file));
  }
  const packages = Object.entries(byPackage)
    .map(([name, info]) => ({ name, ...info }))
    .sort((a, b) => b.files - a.files || a.name.localeCompare(b.name));
  const git = gitInfo();
  const fingerprint = sha16(JSON.stringify({ git, manifests: manifests.map((m) => [m.path, m.sha256]) }));
  return {
    ok: true,
    generated_at: new Date().toISOString(),
    source: {
      repo: REPO_URL,
      root_fingerprint: sha16(sourceRoot),
      ...git
    },
    counts: {
      files: files.length,
      manifests: manifests.length,
      skills: skillFiles.length,
      packages: packages.length
    },
    by_class: byClass,
    packages,
    manifests,
    skill_files: skillFiles.slice(0, 300),
    fingerprint
  };
}

function makeSupervisorOverlay(index) {
  const generatedAt = new Date().toISOString();
  const specs = [
    ["ROOT", "hermes_agent.root.supervisor", "Hermes Agent root fabric supervisor", ["hermes", "hermes_agent", "agent", "supervisor", "fabric", "pid", "glyph", "white_room", "receipt"]],
    ["TOOLS", "hermes_agent.tools.supervisor", "Hermes toolset and action surface supervisor", ["toolsets", "tools", "browser", "terminal", "code_execution", "vision", "messaging", "delegation"]],
    ["SKILLS", "hermes_agent.skills.supervisor", "Hermes skills catalogue supervisor", ["skills", "skill", "SKILL", "catalogue", "profile", "autoload"]],
    ["MEMORY", "hermes_agent.memory.supervisor", "Hermes memory and session snapshot supervisor", ["memory", "session", "snapshot", "recall", "state"]],
    ["KANBAN", "hermes_agent.kanban.supervisor", "Hermes Kanban and durable task board supervisor", ["kanban", "task", "board", "durable", "queue"]],
    ["CRON", "hermes_agent.cron.supervisor", "Hermes cronjob and long-running process supervisor", ["cronjob", "cron", "background", "process", "heartbeat", "watchdog"]],
    ["MCP", "hermes_agent.mcp.supervisor", "Hermes MCP and connector compatibility supervisor", ["mcp", "connector", "provider", "tool", "transport"]],
    ["DASHBOARD", "hermes_agent.dashboard.supervisor", "Hermes dashboard and local UI supervisor", ["dashboard", "frontend", "ui", "web", "status"]],
    ["SECURITY", "hermes_agent.security.supervisor", "Hermes security, redaction, and command-scan supervisor", ["security", "redaction", "scanner", "guardrail", "policy", "audit"]],
    ["GATED_SURFACES", "hermes_agent.gated_surfaces.supervisor", "Hermes hidden stealth restricted secret shadow drive folder file and USB supervisor", ["hidden", "stealth", "restricted", "secret", "shadow", "drive", "folder", "file", "usb", "vault"]],
    ["FABRIC_BRIDGE", "hermes_agent.fabric_bridge.supervisor", "Hermes-to-BEHCS fabric bridge supervisor", ["behcs", "prism", "opencode", "gnn", "feeds", "boundary", "envelope"]]
  ];
  const common = [
    "D16_PID", "D36_INFERENCE_SURFACE", "D39_GNN_EDGE", "D41_AGENT_TIER",
    "D42_MEETING_ROOM", "D47_BOUNDARY", "daemons", "schema"
  ];
  const entries = specs.map(([suffix, supervisorId, title, keywords], i) => ({
    pid: `BH.HERMES.AGENT.SUP.${String(i).padStart(3, "0")}.${suffix}`,
    indicatorPid: `BH.HERMES.AGENT.SUP.${String(i).padStart(3, "0")}.${suffix}`,
    nativePid: `BH.HERMES.AGENT.SUP.${String(i).padStart(3, "0")}.${suffix}`,
    supervisorId,
    title,
    role: "hermes-agent-sidecar-supervisor",
    setId: "hermes-agent-upstream",
    sourceFile: "tools/behcs/hermes-agent-fabric-ingest.mjs",
    sourceCommit: index.source.short_commit || null,
    derived_concerns: [
      "upstream_package_indexing",
      "fabric_profile_minting",
      "white_room_ingest",
      "tool_surface_mapping",
      "dashboard_integration"
    ],
    derived_voteKeywords: Array.from(new Set([...common, ...keywords])),
    derived_domains: ["daemons", "schema", "audit", "language_glyph"],
    derivation_d11: "OBSERVED-from-local-source-index",
    overlay_ts: generatedAt
  }));
  return {
    overlayId: "hermes-agent-supervisor-overlay-v1",
    overlayVersion: 1,
    generatedAt,
    source: "tools/behcs/hermes-agent-fabric-ingest.mjs",
    upstream: index.source,
    derivation_d11: "OBSERVED-from-local-source-index",
    note: "Sidecar Hermes Agent supervisor overlay. Canonical supervisor profile files are not mutated.",
    domainCatalog: ["daemons", "schema", "audit", "language_glyph"],
    counts: {
      total_supervisors: entries.length,
      indexed_files: index.counts.files,
      indexed_packages: index.counts.packages,
      indexed_skills: index.counts.skills
    },
    entries
  };
}

function writeFabricNdjson(index, overlay) {
  const rows = [];
  rows.push({
    type: "HERMES_AGENT_SOURCE_INDEX",
    id: `hermes-agent-source-${index.fingerprint}`,
    ts: index.generated_at,
    source: index.source,
    counts: index.counts,
    fingerprint: index.fingerprint
  });
  for (const pkg of index.packages.slice(0, 500)) {
    rows.push({
      type: "HERMES_AGENT_PACKAGE_GLYPH",
      id: `hermes-agent-package-${sha16(pkg.name)}`,
      ts: index.generated_at,
      package: pkg.name,
      file_count: pkg.files,
      classes: pkg.classes,
      manifest_fingerprints: pkg.manifests.map((m) => ({ path: m.path, sha16: m.sha256.slice(0, 16) }))
    });
  }
  for (const entry of overlay.entries) {
    rows.push({
      type: "HERMES_AGENT_SUPERVISOR_PROFILE",
      id: entry.pid,
      ts: overlay.generatedAt,
      pid: entry.pid,
      supervisorId: entry.supervisorId,
      title: entry.title,
      keywords: entry.derived_voteKeywords,
      domains: entry.derived_domains,
      d11: entry.derivation_d11
    });
  }
  fs.writeFileSync(FABRIC_NDJSON, rows.map((row) => JSON.stringify(row)).join("\n") + "\n", "utf8");
  return rows.length;
}

function tupleForPackage(index, pkg, ordinal) {
  const isSkill = pkg.name.startsWith("skills/") || pkg.classes.skill > 0;
  const isTest = pkg.classes.test > pkg.files / 2;
  const surface = isSkill ? "hermes_skill" : isTest ? "hermes_test" : "hermes_package";
  const lane = isSkill ? "forge" : isTest ? "sentinel" : "vector";
  return {
    id: `BH.HERMES.${surface.toUpperCase()}.${sha16(pkg.name).toUpperCase()}`,
    source_package: pkg.name,
    source_commit: index.source.short_commit || null,
    behcs_1024: {
      D1_ACTOR: "hermes_agent",
      D2_VERB: "index",
      D3_TARGET: "fabric",
      D4_RISK: isSkill ? 4 : 3,
      D5_LAYER: "agent",
      D6_GATE: "hookwall",
      D7_STATE: "observed",
      D8_CHAIN: "feeds",
      D9_WAVE: "gather",
      D10_DIALECT: "IX",
      D11_PROOF: "hash",
      D12_SCOPE: "persistent",
      D13_SURFACE: surface,
      D14_ENERGY: "light",
      D16_PID: `hermes-agent:${lane}:p${ordinal + 2}`,
      D17_PROFILE: isSkill ? "hermes-skill-v1" : "hermes-package-v1",
      D18_AI_MODEL: "human_operator",
      D22_TRANSLATION: "tuple_to_english",
      D24_INTENT: "exploratory",
      D25_TRINITY: "LX-491_omni_GNN_inference",
      D26_OMNIDIRECTIONAL: "receive",
      D35_HYPERLANGUAGE: "47D",
      D36_INFERENCE_SURFACE: "gnn_local",
      D37_AUTHORITY_TOPOLOGY: "operator_local",
      D38_ENCRYPTION: "plaintext",
      D39_GNN_EDGE: "feeds",
      D40_HYBRID_MODEL: "local_llm",
      D41_AGENT_TIER: "micro",
      D42_MEETING_ROOM: "ad_hoc",
      D43_MISTAKE_LEDGER: "corrected",
      D44_HEARTBEAT: "alive",
      D45_OMNICALENDAR: "immediate",
      D46_VAULT: "session_ephemeral",
      D47_BOUNDARY: "boundary_typed"
    },
    behcs_256: {
      actor: "hermes_agent",
      lane,
      surface,
      proof: "manifest_hash",
      source_class_counts: pkg.classes,
      manifest_sha16: pkg.manifests.map((m) => m.sha256.slice(0, 16))
    }
  };
}

function makeTupleIndex(index, overlay) {
  const packageTuples = index.packages.slice(0, 1024).map((pkg, i) => tupleForPackage(index, pkg, i));
  const skillTuples = index.skill_files.slice(0, 1024).map((skill, i) => ({
    id: `BH.HERMES.SKILL.${sha16(skill).toUpperCase()}`,
    source_skill: skill,
    behcs_1024: {
      D1_ACTOR: "hermes_agent",
      D2_VERB: "skill_index",
      D3_TARGET: "fabric",
      D4_RISK: 4,
      D5_LAYER: "agent",
      D6_GATE: "hookwall",
      D7_STATE: "observed",
      D8_CHAIN: "feeds",
      D9_WAVE: "gather",
      D10_DIALECT: "IX",
      D11_PROOF: "hash",
      D12_SCOPE: "persistent",
      D13_SURFACE: "hermes_skill",
      D14_ENERGY: "light",
      D16_PID: `hermes-skill:forge:p${i + 2}`,
      D17_PROFILE: "hermes-skill-v1",
      D24_INTENT: "exploratory",
      D36_INFERENCE_SURFACE: "gnn_local",
      D39_GNN_EDGE: "feeds",
      D41_AGENT_TIER: "micro",
      D42_MEETING_ROOM: "ad_hoc",
      D47_BOUNDARY: "boundary_typed"
    }
  }));
  const gatedSurfaceTuples = GATED_SURFACES.map((surface) => ({
    id: `BH.HERMES.GATED.${surface.id.toUpperCase()}`,
    label: surface.label,
    gate: surface.gate,
    mistake_pattern: surface.mistake,
    behcs_1024: {
      D1_ACTOR: "hermes_agent",
      D2_VERB: "hold",
      D3_TARGET: surface.id,
      D5_LAYER: "agent",
      D6_GATE: "hookwall",
      D7_STATE: "gated",
      D8_CHAIN: "blocks",
      D9_WAVE: "single",
      D10_DIALECT: "IX",
      D11_PROOF: "hash",
      D12_SCOPE: "persistent",
      D13_SURFACE: `${surface.id}_descriptor`,
      D14_ENERGY: "light",
      D16_PID: `hermes-gated:sentinel:${surface.id}`,
      D17_PROFILE: "hermes-gated-surface-v1",
      D24_INTENT: "defensive",
      D36_INFERENCE_SURFACE: "gnn_local",
      D39_GNN_EDGE: "blocks",
      D41_AGENT_TIER: "micro",
      D42_MEETING_ROOM: "ad_hoc",
      D43_MISTAKE_LEDGER: "became_law",
      D44_HEARTBEAT: "alive",
      ...surface.tuple
    }
  }));
  return {
    ok: true,
    generated_at: index.generated_at,
    source_commit: index.source.short_commit || null,
    index_fingerprint: index.fingerprint,
    live_canon: "47D",
    expansion_overlay_policy: "D48-D49/D50+ remain overlay/proposal until ratified",
    counts: {
      package_tuples: packageTuples.length,
      skill_tuples: skillTuples.length,
      gated_surface_tuples: gatedSurfaceTuples.length,
      supervisor_profiles: overlay.entries.length
    },
    package_tuples: packageTuples,
    skill_tuples: skillTuples,
    gated_surface_tuples: gatedSurfaceTuples
  };
}

function writeGnnEdges(index, tupleIndex, overlay) {
  const rows = [];
  const ts = index.generated_at;
  rows.push({ from: "hermes-agent", to: "behcs-fabric", verb: "feeds", weight: 0.94, ts, id: `hermes-source-${index.fingerprint}` });
  for (const tuple of tupleIndex.package_tuples.slice(0, 200)) {
    rows.push({ from: tuple.id, to: "hermes-agent", verb: "part_of", weight: 0.72, ts, id: `hermes-pkg-edge-${sha16(tuple.id)}` });
    rows.push({ from: tuple.id, to: "behcs1024-prism", verb: "feeds", weight: 0.68, ts, id: `hermes-pkg-prism-${sha16(tuple.id)}` });
  }
  for (const tuple of tupleIndex.skill_tuples.slice(0, 200)) {
    rows.push({ from: tuple.id, to: "hermes-skill-catalogue", verb: "part_of", weight: 0.76, ts, id: `hermes-skill-edge-${sha16(tuple.id)}` });
  }
  for (const tuple of tupleIndex.gated_surface_tuples) {
    rows.push({ from: tuple.id, to: "hookwall", verb: "blocks", weight: 0.96, ts, id: `hermes-gated-hookwall-${sha16(tuple.id)}` });
    rows.push({ from: tuple.id, to: "mistake-ledger", verb: "prevents", weight: 0.92, ts, id: `hermes-gated-mistake-${sha16(tuple.id)}` });
  }
  for (const entry of overlay.entries) {
    rows.push({ from: entry.pid, to: "supervisor-registry", verb: "summonable_as", weight: 0.9, ts, id: `hermes-supervisor-edge-${sha16(entry.pid)}` });
  }
  fs.writeFileSync(GNN_EDGES, rows.map((row) => JSON.stringify(row)).join("\n") + "\n", "utf8");
  return rows.length;
}

function writeHookwallPatterns(index) {
  ensureDir(HOOKWALL_DIR);
  const patterns = GATED_SURFACES.map((surface) => ({
    id: `hermes_${surface.id}_surface_gate`,
    surface: surface.id,
    label: surface.label,
    risk: surface.risk,
    gate: surface.gate,
    action: surface.risk >= 8 ? "deny_without_owner_promotion" : "metadata_only",
    exact_policy: "index descriptors, hashes, and counts only; do not ingest raw private contents or secret values",
    tuple: surface.tuple
  }));
  const out = {
    ok: true,
    generated_at: index.generated_at,
    source_commit: index.source.short_commit || null,
    policy: "sidecar hookwall candidates; review before hard enforcement",
    patterns
  };
  fs.writeFileSync(HOOKWALL_PATTERNS, JSON.stringify(out, null, 2) + "\n", "utf8");
  return patterns.length;
}

function writeMistakePatterns(index) {
  ensureDir(MISTAKE_DIR);
  const mistakes = GATED_SURFACES.map((surface) => ({
    id: `hermes_${surface.id}_${sha16(surface.mistake)}`,
    surface: surface.id,
    risk: surface.risk,
    pattern: surface.mistake,
    prevention: surface.gate,
    route: surface.risk >= 8 ? "mistake-ledger/high-risk" : "mistake-ledger/review",
    d43: "became_law"
  }));
  const out = {
    ok: true,
    generated_at: index.generated_at,
    source_commit: index.source.short_commit || null,
    policy: "mistake patterns for GNN/reverse-gain; no raw secret or private file contents",
    mistakes
  };
  fs.writeFileSync(MISTAKE_PATTERNS, JSON.stringify(out, null, 2) + "\n", "utf8");
  return mistakes.length;
}

function writeReport(index, overlay, rowCount, syncStatus, extra = {}) {
  const lines = [
    "# Hermes Agent Fabric Ingest",
    "",
    `Generated: ${index.generated_at}`,
    `Source repo: ${REPO_URL}`,
    `Sync status: ${syncStatus || "not requested"}`,
    `Commit: ${index.source.short_commit || "unknown"}`,
    `Subject: ${index.source.subject || "unknown"}`,
    `Fingerprint: ${index.fingerprint}`,
    "",
    "## Indexed Surface",
    `- Files: ${index.counts.files}`,
    `- Packages: ${index.counts.packages}`,
    `- Manifests: ${index.counts.manifests}`,
    `- Skills: ${index.counts.skills}`,
    `- Fabric rows: ${rowCount}`,
    `- Minted supervisors: ${overlay.entries.length}`,
    `- BEHCS tuples: ${extra.tuples || 0}`,
    `- GNN edges: ${extra.gnnEdges || 0}`,
    `- Hookwall patterns: ${extra.hookwallPatterns || 0}`,
    `- Mistake patterns: ${extra.mistakePatterns || 0}`,
    "",
    "## Boundary Policy",
    "- Hidden, stealth, restricted, secret, shadow, drive, folder, file, and USB surfaces are indexed as gated metadata only.",
    "- No raw secret values, raw vault values, private file contents, or bulk drive listings are written by this ingest.",
    "- Live canon is 47D; D48-D49/D50+ remain overlay/proposal rows until separately ratified.",
    "",
    "## Top Packages",
    ...index.packages.slice(0, 20).map((pkg) => `- ${pkg.name}: ${pkg.files} files`),
    "",
    "## Minted Supervisors",
    ...overlay.entries.map((entry) => `- ${entry.pid} - ${entry.title}`),
    ""
  ];
  fs.writeFileSync(REPORT_PATH, lines.join("\n"), "utf8");
}

function main() {
  let syncStatus = null;
  if (sync) syncStatus = syncSource();
  ensureDir(OUT_DIR);
  ensureDir(OVERLAY_DIR);
  ensureDir(REPORT_DIR);
  const index = buildIndex();
  const overlay = makeSupervisorOverlay(index);
  const tupleIndex = makeTupleIndex(index, overlay);
  fs.writeFileSync(PACKAGE_INDEX, JSON.stringify(index, null, 2) + "\n", "utf8");
  fs.writeFileSync(OVERLAY_PATH, JSON.stringify(overlay, null, 2) + "\n", "utf8");
  fs.writeFileSync(TUPLE_INDEX, JSON.stringify(tupleIndex, null, 2) + "\n", "utf8");
  const rowCount = writeFabricNdjson(index, overlay);
  const gnnEdges = writeGnnEdges(index, tupleIndex, overlay);
  const hookwallPatterns = writeHookwallPatterns(index);
  const mistakePatterns = writeMistakePatterns(index);
  writeReport(index, overlay, rowCount, syncStatus, {
    tuples: tupleIndex.counts.package_tuples + tupleIndex.counts.skill_tuples + tupleIndex.counts.gated_surface_tuples,
    gnnEdges,
    hookwallPatterns,
    mistakePatterns
  });
  console.log(JSON.stringify({
    ok: true,
    sync_status: syncStatus || "not_requested",
    source_commit: index.source.short_commit || null,
    files: index.counts.files,
    packages: index.counts.packages,
    skills: index.counts.skills,
    supervisors: overlay.entries.length,
    fabric_rows: rowCount,
    tuple_rows: tupleIndex.counts.package_tuples + tupleIndex.counts.skill_tuples + tupleIndex.counts.gated_surface_tuples,
    gnn_edges: gnnEdges,
    hookwall_patterns: hookwallPatterns,
    mistake_patterns: mistakePatterns,
    fingerprint: index.fingerprint,
    artifacts: {
      package_index: path.relative(ROOT, PACKAGE_INDEX).replace(/\\/g, "/"),
      fabric_ndjson: path.relative(ROOT, FABRIC_NDJSON).replace(/\\/g, "/"),
      tuple_index: path.relative(ROOT, TUPLE_INDEX).replace(/\\/g, "/"),
      gnn_edges: path.relative(ROOT, GNN_EDGES).replace(/\\/g, "/"),
      hookwall_patterns: path.relative(ROOT, HOOKWALL_PATTERNS).replace(/\\/g, "/"),
      mistake_patterns: path.relative(ROOT, MISTAKE_PATTERNS).replace(/\\/g, "/"),
      overlay: path.relative(ROOT, OVERLAY_PATH).replace(/\\/g, "/"),
      report: path.relative(ROOT, REPORT_PATH).replace(/\\/g, "/")
    }
  }, null, 2));
}

main();
