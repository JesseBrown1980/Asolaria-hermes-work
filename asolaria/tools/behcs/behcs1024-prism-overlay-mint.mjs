#!/usr/bin/env node
/**
 * behcs1024-prism-overlay-mint.mjs
 *
 * Mints a sidecar supervisor overlay for the BEHCS 1024 Prism frontend.
 * Canonical supervisor profile files are not mutated. council-vote.mjs
 * loads this overlay beside supervisor-concerns-overlay-v1.json.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { buildPostChainGcContract } = require("./post-chain-gc-contract.cjs");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..", "..");
const OVERLAY_DIR = path.join(ROOT, "data", "behcs", "pid-fabric", "overlays");
const REPORT_DIR = path.join(ROOT, "reports");
const OUT = path.join(OVERLAY_DIR, "behcs1024-prism-supervisor-overlay-latest.json");
const REPORT = path.join(REPORT_DIR, "behcs1024-prism-supervisor-overlay-latest.md");
const PRISM_REFLECTION_MODES = Object.freeze([
  "prism_question_observe_self",
  "pid_room_model_self",
  "capture_prism_test_self",
  "gnn_gulp_falsify_self",
  "boundary_gc_heal_self",
  "frontend_answer_evolve_self"
]);

const COMMON = [
  "behcs1024",
  "prism",
  "fabric",
  "envelope",
  "supervisor",
  "pid",
  "D16_PID",
  "D36_INFERENCE_SURFACE",
  "D39_GNN_EDGE",
  "D41_AGENT_TIER",
  "D42_MEETING_ROOM",
  "D47_BOUNDARY",
  "white_room",
  "glyph",
  "receipt"
];

const PROFILES = [
  {
    pid: "BH.BEHCS1024.PRISM.SUP.ROOT",
    supervisorId: "behcs1024_prism.root.supervisor",
    title: "BEHCS 1024 Prism root supervisor for tuple-bearing frontend questions",
    keywords: ["frontend", "question", "capture", "route", "submit", "answer", "recombine"],
    domains: ["daemons", "schema", "language_glyph", "hilbert_cube", "audit"]
  },
  {
    pid: "BH.BEHCS1024.PRISM.SUP.PID_PORTAL",
    supervisorId: "behcs1024_prism.pid_portal.supervisor",
    title: "OpenCode project-id and Brown-Hilbert PID portal supervisor",
    keywords: ["opencode", "project_id", "project_id_tuple", "portal", "room", "prime_room", "rotation"],
    domains: ["daemons", "hilbert_cube", "schema", "audit"]
  },
  {
    pid: "BH.BEHCS1024.PRISM.SUP.CAPTURE",
    supervisorId: "behcs1024_prism.capture_prism.supervisor",
    title: "Capture prism supervisor for many answers back into one local address space",
    keywords: ["capture_prism", "response_capture", "address_space", "local_repo", "aggregate", "spectrum"],
    domains: ["storage", "schema", "language_glyph", "audit"]
  },
  {
    pid: "BH.BEHCS1024.PRISM.SUP.GNN_GULP",
    supervisorId: "behcs1024_prism.gnn_gulp.supervisor",
    title: "GNN gulp supervisor for 1600-2000 message batches and reverse-gain routing",
    keywords: ["gnn", "reversegain", "reverse_gain", "gulp", "feeds", "edges", "training", "mistake_ledger"],
    domains: ["daemons", "gc_retention", "audit"]
  },
  {
    pid: "BH.BEHCS1024.PRISM.SUP.BOUNDARY_GC",
    supervisorId: "behcs1024_prism.boundary_gc.supervisor",
    title: "Boundary and garbage-collector supervisor for Prism receipts",
    keywords: ["boundary", "gc", "garbage_collector", "retention", "ttl", "timeout", "split_required"],
    domains: ["gc_retention", "schema", "audit", "sovereignty"]
  },
  {
    pid: "BH.BEHCS1024.PRISM.SUP.HERMES_BRIDGE",
    supervisorId: "behcs1024_prism.hermes_bridge.supervisor",
    title: "Hermes-to-fabric bridge supervisor for updated Hermes Agent profiles",
    keywords: ["hermes", "hermes_agent", "toolsets", "skills", "kanban", "cronjob", "mcp", "dashboard"],
    domains: ["daemons", "schema", "network", "audit"]
  }
];

function uniq(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function sha16(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, 16);
}

function repoRel(filePath) {
  const rel = path.relative(ROOT, filePath);
  if (path.isAbsolute(rel) || rel.startsWith("..")) return String(filePath).replace(/\\/g, "/");
  return rel.replace(/\\/g, "/");
}

function main() {
  fs.mkdirSync(OVERLAY_DIR, { recursive: true });
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const generatedAt = new Date().toISOString();
  const entries = PROFILES.map((profile) => ({
    pid: profile.pid,
    indicatorPid: profile.pid,
    nativePid: profile.pid,
    supervisorId: profile.supervisorId,
    title: profile.title,
    role: "behcs1024-prism-sidecar-supervisor",
    setId: "behcs1024-prism",
    sourceFile: "tools/behcs/behcs1024-prism-overlay-mint.mjs",
    derived_concerns: [
      "tuple_activation_alignment",
      "frontend_answer_capture",
      "pid_project_id_routing",
      "gnn_gulp_readiness",
      "white_room_promotion_gate"
    ],
    derived_voteKeywords: uniq([...COMMON, ...profile.keywords]),
    derived_domains: profile.domains,
    derivation_d11: "OBSERVED-from-local-prism-test",
    overlay_ts: generatedAt
  }));
  const overlay = {
    overlayId: "behcs1024-prism-supervisor-overlay-v1",
    overlayVersion: 1,
    generatedAt,
    source: "tools/behcs/behcs1024-prism-overlay-mint.mjs",
    derivation_d11: "OBSERVED-from-local-prism-test",
    note: "Sidecar Prism supervisor overlay. Canonical supervisor profile files are not mutated.",
    domainCatalog: uniq(entries.flatMap((entry) => entry.derived_domains)),
    counts: {
      total_supervisors: entries.length,
      total_keywords: entries.reduce((n, entry) => n + entry.derived_voteKeywords.length, 0)
    },
    post_chain_gc_contract: buildPostChainGcContract({
      generatedAt,
      runId: "behcs1024-prism-supervisor-overlay",
      waveType: "prism_supervisor_overlay",
      waveShape: "BEHCS1024 prism x PID portal x GNN gulp x boundary GC",
      selfReflecting: true,
      reflectionModes: PRISM_REFLECTION_MODES,
      retainedArtifacts: [repoRel(OUT), repoRel(REPORT)],
      holds: [
        "prism_frontend_answers_need_capture_review",
        "pid_portal_does_not_authorize_process_spawn",
        "gnn_gulp_supervisor_requires_bounded_windows",
        "boundary_gc_supervisor_cannot_delete_evidence"
      ],
      facts: { supervisors: entries.length }
    }),
    entries
  };
  fs.writeFileSync(OUT, JSON.stringify(overlay, null, 2) + "\n", "utf8");

  const fingerprint = sha16(JSON.stringify(overlay.entries));
  fs.writeFileSync(REPORT, [
    "# BEHCS 1024 Prism Supervisor Overlay",
    "",
    `Generated: ${generatedAt}`,
    `Overlay: ${path.relative(ROOT, OUT).replace(/\\/g, "/")}`,
    `Supervisors: ${entries.length}`,
    `Fingerprint: ${fingerprint}`,
    `Post-chain GC contract: ${overlay.post_chain_gc_contract.fingerprint}`,
    "",
    "## Purpose",
    "Teach the supervisor fabric the Prism-specific frontend vocabulary without mutating canonical supervisor profile files.",
    "",
    "## Minted Profiles",
    ...entries.map((entry) => `- ${entry.pid} — ${entry.title}`),
    ""
  ].join("\n"), "utf8");

  console.log(JSON.stringify({
    ok: true,
    overlay: path.relative(ROOT, OUT).replace(/\\/g, "/"),
    report: path.relative(ROOT, REPORT).replace(/\\/g, "/"),
    supervisors: entries.length,
    fingerprint
  }, null, 2));
}

main();
