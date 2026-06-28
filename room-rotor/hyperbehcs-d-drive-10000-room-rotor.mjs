#!/usr/bin/env node
"use strict";

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..", "..");
const require = createRequire(import.meta.url);
const {
  ZERO_COUNTERS,
  buildQuantizedSubstrateReceipt
} = require(path.join(ROOT, "src", "behcs", "hyperbehcsQuantSubstrate.js"));

export const TASK_ID = "HYP-D-10000-ROOM-ROTOR";
export const RUN_ID = "hyperbehcs-d-drive-10000-room-rotor-20260516";

const DEFAULT_TARGET_ROOT = "D:\\Asolaria-HyperBEHCS-10000-RoomRotor";
const DEFAULT_ROOM_COUNT = 10000;
const DEFAULT_SHARD_SIZE = 100;
const DEFAULT_WINDOW_SIZE = 64;

const LANES = Object.freeze([
  "carry_z",
  "quant",
  "reflex",
  "gulp",
  "super_gulp",
  "gc",
  "gnn",
  "shannon",
  "white_room",
  "minting",
  "watcher",
  "indexer"
]);

const HYPERBEHCS_PLANES = Object.freeze([
  { plane_id: "hyperbehcs", role: "room_fabric_root", purpose: "HyperBEHCS room rotor identity and room lease descriptors" },
  { plane_id: "carry_z", role: "carry_state", purpose: "Carry-Z state continuation slot per room" },
  { plane_id: "hrm", role: "hierarchical_reasoning", purpose: "HRM high-level/low-level recurrent reasoning descriptor slots" },
  { plane_id: "gulp", role: "intake", purpose: "Gulp intake receipts and mistake/evidence absorption" },
  { plane_id: "super_gulp", role: "bulk_intake", purpose: "Super Gulp aggregate intake and wide evidence folds" },
  { plane_id: "gnn", role: "graph_feed", purpose: "GNN edge emission for room, shard, receipt, and gate relations" },
  { plane_id: "gc", role: "post_chain_gc", purpose: "Post-chain garbage-collection descriptors without delete authority" },
  { plane_id: "hookwall", role: "authority_gate", purpose: "Hookwall gate descriptor for promotion and live authority checks" },
  { plane_id: "tuple", role: "routing_tuple", purpose: "Brown-Hilbert tuple addressing for actor/device/lane/prime and room/shard/lane/state" },
  { plane_id: "crypto", role: "receipt_crypto", purpose: "Descriptor crypto receipt slots and tamper-evident envelope markers" },
  { plane_id: "sha", role: "hash_readback", purpose: "SHA-256 file readback and SHA-16 descriptor fingerprints" },
  { plane_id: "quant", role: "quant_receipt", purpose: "Shard quantized substrate receipts" },
  { plane_id: "minting", role: "pid_mint", purpose: "Brown-Hilbert PID descriptor minting without process spawn" },
  { plane_id: "reflex", role: "lesson_memory", purpose: "Reflex learning lesson and mistake-pattern descriptors" },
  { plane_id: "white_room", role: "review_gate", purpose: "White-room review packet descriptors before promotion" },
  { plane_id: "watcher", role: "watch_feed", purpose: "Watcher status and readiness descriptors" },
  { plane_id: "indexer", role: "memory_index", purpose: "Memory/index feed descriptors for lookup and replay" }
]);

const LOCAL_OUTPUTS = Object.freeze({
  reportJson: path.join(ROOT, "reports", "hyperbehcs-d-drive-10000-room-rotor-latest.json"),
  reportMd: path.join(ROOT, "reports", "hyperbehcs-d-drive-10000-room-rotor-latest.md"),
  dashboardFeed: path.join(ROOT, "data", "behcs", "dashboard-feeds", "hyperbehcs-d-drive-10000-room-rotor-latest.json"),
  gnnEdges: path.join(ROOT, "data", "behcs", "gnn-feeds", "hyperbehcs-d-drive-10000-room-rotor-edges-latest.ndjson"),
  shannonSymbols: path.join(ROOT, "data", "behcs", "shannon", "hyperbehcs-d-drive-10000-room-rotor-symbols-latest.ndjson")
});

function sha256Buffer(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value || ""), "utf8").digest("hex");
}

function sha16(value) {
  return sha256(typeof value === "string" ? value : JSON.stringify(value)).slice(0, 16);
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function writeText(filePath, value) {
  ensureDir(filePath);
  fs.writeFileSync(filePath, value.endsWith("\n") ? value : `${value}\n`, "utf8");
}

function writeJson(filePath, value) {
  writeText(filePath, JSON.stringify(value, null, 2));
}

function writeNdjson(filePath, rows) {
  writeText(filePath, rows.map((row) => JSON.stringify(row)).join("\n"));
}

function parseArgs(argv = process.argv.slice(2)) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--target-root") out.targetRoot = argv[++i];
    if (arg === "--label") out.label = argv[++i];
    if (arg === "--rooms") out.roomCount = Number(argv[++i]);
    if (arg === "--shard-size") out.shardSize = Number(argv[++i]);
    if (arg === "--window-size") out.windowSize = Number(argv[++i]);
    if (arg === "--manifest-only") out.materializeRooms = false;
  }
  return out;
}

function normalizeTargetRoot(input) {
  const targetRoot = path.resolve(input || process.env.ASOLARIA_HYPERBEHCS_ROOM_ROTOR_ROOT || DEFAULT_TARGET_ROOT);
  const parsed = path.parse(targetRoot);
  if (parsed.root.toUpperCase() !== "D:\\") {
    throw new Error(`10000-room rotor target must be on D:\\, got ${targetRoot}`);
  }
  if (targetRoot.toUpperCase() === "D:\\") {
    throw new Error("Refusing to materialize the room rotor directly at D:\\ root.");
  }
  return targetRoot;
}

function safeLabel(value) {
  return String(value || RUN_ID)
    .replace(/[^A-Za-z0-9_.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || RUN_ID;
}

function buildRunRoot(targetRoot, label) {
  return path.join(targetRoot, safeLabel(label));
}

function roomPid(index, digest) {
  return `BH.ROOM.${String(index).padStart(5, "0")}.${digest.slice(0, 12).toUpperCase()}`;
}

function planePid(planeId, digest) {
  return `BH.PLANE.${planeId.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}.${digest.slice(0, 12).toUpperCase()}`;
}

function roomShard(index, shardSize) {
  return Math.floor(index / shardSize);
}

function roomPath(runRoot, shard, index) {
  return path.join(
    runRoot,
    "rooms",
    `shard-${String(shard).padStart(4, "0")}`,
    `room-${String(index).padStart(5, "0")}`
  );
}

function buildPlaneBinding({ plane, roomId, index, shard, lane }) {
  const digest = sha256(`${TASK_ID}:${plane.plane_id}:${roomId}:${index}:${shard}:${lane}`);
  return {
    plane_id: plane.plane_id,
    role: plane.role,
    slot_id: `${plane.plane_id}:${String(shard).padStart(4, "0")}:${String(index).padStart(5, "0")}`,
    binding_pid: planePid(plane.plane_id, digest),
    lane_affinity: lane,
    descriptor_only: true,
    live_action_allowed: false,
    runtime_authority_grants: 0,
    sha16: digest.slice(0, 16)
  };
}

function buildRoomPlaneBindings({ roomId, index, shard, lane }) {
  return Object.fromEntries(HYPERBEHCS_PLANES.map((plane) => [
    plane.plane_id,
    buildPlaneBinding({ plane, roomId, index, shard, lane })
  ]));
}

function buildRoom({ generatedAt, index, shard, shardSize, roomCount }) {
  const lane = LANES[index % LANES.length];
  const rotationEpoch = Math.floor(index / LANES.length);
  const digest = sha256(JSON.stringify({ index, shard, lane, rotationEpoch, roomCount, task: TASK_ID }));
  const roomId = `room-${String(index).padStart(5, "0")}`;
  return {
    schema: "hyperbehcs.d_drive_10000_room.room.v1",
    generated_at: generatedAt,
    room_index: index,
    room_id: roomId,
    shard_id: `shard-${String(shard).padStart(4, "0")}`,
    lane,
    rotation_epoch: rotationEpoch,
    brown_hilbert_pid: roomPid(index, digest),
    carry_state_slot: `carry:${String(index % 1024).padStart(4, "0")}`,
    quant_slot: `quant:${String(shard).padStart(4, "0")}:${String(index % shardSize).padStart(3, "0")}`,
    gulp_window: Math.floor(index / 2000),
    gc_window: Math.floor(index / 5000),
    automation: {
      mode: "descriptor_ready",
      auto_spawn_allowed: false,
      process_start_allowed: false,
      provider_call_allowed: false,
      route_mutation_allowed: false,
      promotion_requires_gate: "hyperbehcs.carry_state_reflex_promotion_gate"
    },
    plane_bindings: buildRoomPlaneBindings({ roomId, index, shard, lane }),
    boundary: {
      descriptor_only: true,
      d_drive_room_descriptor: true,
      live_agent_spawn_allowed: false,
      runtime_promotion_allowed: false,
      ...ZERO_COUNTERS
    },
    fingerprint: digest.slice(0, 16)
  };
}

function buildRooms({ generatedAt, roomCount, shardSize }) {
  return Array.from({ length: roomCount }, (_, index) => {
    const shard = roomShard(index, shardSize);
    return buildRoom({ generatedAt, index, shard, shardSize, roomCount });
  });
}

function groupByShard(rooms) {
  const groups = new Map();
  for (const room of rooms) {
    if (!groups.has(room.shard_id)) groups.set(room.shard_id, []);
    groups.get(room.shard_id).push(room);
  }
  return Array.from(groups.entries()).map(([shardId, rows]) => ({ shardId, rows }));
}

function buildPlaneContract({ generatedAt, roomCount, shardSize, windowSize }) {
  return {
    schema: "hyperbehcs.d_drive_10000_room.plane_contract.v1",
    generated_at: generatedAt,
    task_id: TASK_ID,
    room_count: roomCount,
    shard_size: shardSize,
    window_size: windowSize,
    plane_count: HYPERBEHCS_PLANES.length,
    descriptor_only: true,
    hookwall_gate_required_for_live_action: true,
    planes: HYPERBEHCS_PLANES.map((plane) => ({
      schema: "hyperbehcs.d_drive_10000_room.plane.v1",
      plane_id: plane.plane_id,
      role: plane.role,
      purpose: plane.purpose,
      binding_mode: "per_room_descriptor_slot",
      live_action_allowed: false,
      runtime_promotion_allowed: false,
      runtime_authority_grants: 0,
      ...ZERO_COUNTERS
    })),
    live_agent_spawn_allowed: false,
    runtime_promotion_allowed: false,
    ...ZERO_COUNTERS
  };
}

function buildPlaneBindingRows(rooms) {
  return rooms.map((room) => {
    const row = {
      schema: "hyperbehcs.d_drive_10000_room.plane_bindings.v1",
      room_id: room.room_id,
      shard_id: room.shard_id,
      lane: room.lane,
      brown_hilbert_pid: room.brown_hilbert_pid,
      plane_count: HYPERBEHCS_PLANES.length,
      plane_ids: HYPERBEHCS_PLANES.map((plane) => plane.plane_id),
      bindings: room.plane_bindings,
      descriptor_only: true,
      hookwall_gate_required_for_live_action: true,
      live_action_allowed: false,
      runtime_authority_grants: 0,
      ...ZERO_COUNTERS
    };
    return { ...row, fingerprint: sha16(row) };
  });
}

function quantReceiptForShard({ shardId, rows }) {
  const vector = [
    rows.length,
    rows.filter((row) => row.lane === "carry_z").length,
    rows.filter((row) => row.lane === "quant").length,
    rows.filter((row) => row.lane === "gc").length,
    rows.filter((row) => row.lane === "gnn").length,
    rows.filter((row) => row.lane === "shannon").length,
    Number(shardId.replace(/[^0-9]/g, "")) || 0,
    rows.reduce((sum, row) => sum + row.room_index, 0) % 100000
  ];
  return {
    schema: "hyperbehcs.d_drive_10000_room.shard_quant_receipt.v1",
    shard_id: shardId,
    room_count: rows.length,
    receipt: buildQuantizedSubstrateReceipt({
      substrate_id: "storage_d_drive",
      source_layer: "hyperbehcs_10000_room_rotor",
      vector,
      targetDimension: 4,
      seed: `${TASK_ID}:${shardId}`
    })
  };
}

function buildShardRows(groups) {
  return groups.map((group) => {
    const laneCounts = Object.fromEntries(LANES.map((lane) => [lane, group.rows.filter((row) => row.lane === lane).length]));
    const first = group.rows[0];
    const last = group.rows[group.rows.length - 1];
    const quant = quantReceiptForShard(group);
    const row = {
      schema: "hyperbehcs.d_drive_10000_room.shard.v1",
      shard_id: group.shardId,
      room_count: group.rows.length,
      first_room: first.room_id,
      last_room: last.room_id,
      lane_counts: laneCounts,
      quant_receipt_fingerprint: quant.receipt.receipt?.fingerprint || "",
      descriptor_only: true,
      ...ZERO_COUNTERS
    };
    return { ...row, fingerprint: sha16(row), quant_receipt: quant };
  });
}

function buildAutomationContract({ generatedAt, roomCount, shardSize, windowSize }) {
  return {
    schema: "hyperbehcs.d_drive_10000_room.automation_contract.v1",
    generated_at: generatedAt,
    task_id: TASK_ID,
    room_count: roomCount,
    shard_size: shardSize,
    window_size: windowSize,
    automation_mode: "descriptor_rotation_ready",
    tick_contract: {
      input: "cursor + promotion gate + operator authority",
      output: "next room lease descriptor",
      writes_allowed_without_authority: ["cursor descriptor", "lease descriptor", "readback receipt"],
      writes_blocked_without_authority: ["process spawn", "provider call", "route mutation", "cleanup", "production promotion"]
    },
    live_agent_spawn_allowed: false,
    runtime_promotion_allowed: false,
    ...ZERO_COUNTERS
  };
}

function buildCursor({ generatedAt, rooms, windowSize }) {
  const activeRooms = rooms.slice(0, Math.max(1, Math.min(windowSize, rooms.length)));
  return {
    schema: "hyperbehcs.d_drive_10000_room.cursor.v1",
    generated_at: generatedAt,
    cursor_index: 0,
    window_size: activeRooms.length,
    active_room_ids: activeRooms.map((row) => row.room_id),
    next_room_id: rooms[activeRooms.length]?.room_id || rooms[0]?.room_id || "",
    rotation_policy: "round_robin_descriptor_only",
    live_agent_spawn_allowed: false,
    ...ZERO_COUNTERS
  };
}

function targetPaths(runRoot) {
  return {
    manifest: path.join(runRoot, "manifest", "hyperbehcs-10000-room-rotor.v1.json"),
    rooms: path.join(runRoot, "manifest", "rooms-latest.ndjson"),
    shards: path.join(runRoot, "manifest", "shards-latest.ndjson"),
    quantReceipts: path.join(runRoot, "quant", "shard-quant-receipts-latest.ndjson"),
    planeBindings: path.join(runRoot, "manifest", "plane-bindings-latest.ndjson"),
    planeContract: path.join(runRoot, "planes", "plane-contract.v1.json"),
    cursor: path.join(runRoot, "automation", "cursor.v1.json"),
    automationContract: path.join(runRoot, "automation", "automation-contract.v1.json"),
    zeroAuthorityContract: path.join(runRoot, "authority", "zero-authority-contract.v1.json"),
    readback: path.join(runRoot, "manifest", "hash-readback-latest.ndjson")
  };
}

function materializeRooms({ runRoot, rooms }) {
  const written = [];
  for (const room of rooms) {
    const shardNumber = Number(room.shard_id.replace(/[^0-9]/g, "")) || 0;
    const dir = roomPath(runRoot, shardNumber, room.room_index);
    const roomFile = path.join(dir, "ROOM.json");
    const statusFile = path.join(dir, "ROOM-STATUS.json");
    const inboxFile = path.join(dir, "inbox.ndjson");
    const outboxFile = path.join(dir, "outbox.ndjson");
    writeJson(roomFile, room);
    writeJson(statusFile, {
      schema: "hyperbehcs.d_drive_10000_room.status.v1",
      room_id: room.room_id,
      brown_hilbert_pid: room.brown_hilbert_pid,
      status: "descriptor_ready",
      active: false,
      leased: false,
      live_agent_spawn_allowed: false,
      runtime_promotion_allowed: false,
      ...ZERO_COUNTERS
    });
    writeText(inboxFile, "");
    writeText(outboxFile, "");
    written.push(roomFile, statusFile, inboxFile, outboxFile);
  }
  return written;
}

function hashReadback(filePaths) {
  return filePaths.map((filePath) => {
    const buffer = fs.readFileSync(filePath);
    const row = {
      schema: "hyperbehcs.d_drive_10000_room.hash_readback.v1",
      path: filePath.replace(/\\/g, "/"),
      bytes: buffer.length,
      sha256: sha256Buffer(buffer),
      readback_ok: true,
      ...ZERO_COUNTERS
    };
    return { ...row, fingerprint: sha16(row) };
  });
}

function zeroAuthorityContract(generatedAt) {
  return {
    schema: "hyperbehcs.d_drive_10000_room.zero_authority_contract.v1",
    generated_at: generatedAt,
    task_id: TASK_ID,
    descriptor_only_room_fabric: true,
    d_drive_write_scope_only: true,
    live_agent_spawn_allowed: false,
    runtime_promotion_allowed: false,
    process_start_allowed: false,
    provider_call_allowed: false,
    route_mutation_allowed: false,
    cleanup_allowed: false,
    delete_allowed: false,
    ...ZERO_COUNTERS
  };
}

function gnnEdges({ generatedAt, runRoot, roomCount, shardRows, planeContract }) {
  const edges = [
    ["HyperBEHCS", TASK_ID, "materializes_d_drive_room_rotor"],
    [TASK_ID, "Carry-Z", "allocates_carry_state_room_slots"],
    [TASK_ID, "Quant", "allocates_shard_quant_receipts"],
    [TASK_ID, "agent_spawning", "blocks_live_spawn_until_gate"],
    [TASK_ID, runRoot.replace(/\\/g, "/"), "writes_room_fabric_to_d_drive"]
  ].map(([from, to, relation]) => ({
    schema: "hyperbehcs.d_drive_10000_room.edge.v1",
    generated_at: generatedAt,
    from,
    to,
    relation,
    grants_authority: false,
    room_count: roomCount,
    ...ZERO_COUNTERS
  }));
  for (const shard of shardRows.slice(0, 200)) {
    edges.push({
      schema: "hyperbehcs.d_drive_10000_room.edge.v1",
      generated_at: generatedAt,
      from: TASK_ID,
      to: shard.shard_id,
      relation: "owns_room_shard_descriptor",
      grants_authority: false,
      room_count: shard.room_count,
      ...ZERO_COUNTERS
    });
  }
  for (const plane of planeContract.planes) {
    edges.push({
      schema: "hyperbehcs.d_drive_10000_room.edge.v1",
      generated_at: generatedAt,
      from: TASK_ID,
      to: plane.plane_id,
      relation: "binds_explicit_hyperbehcs_plane",
      grants_authority: false,
      role: plane.role,
      room_count: roomCount,
      ...ZERO_COUNTERS
    });
  }
  return edges.map((row) => ({ ...row, fingerprint: sha16(row) }));
}

function shannonSymbols(counts) {
  return [
    ["ROOM_COUNT", counts.room_count],
    ["SHARD_COUNT", counts.shard_count],
    ["MATERIALIZED_ROOM_FILES", counts.materialized_room_files],
    ["HASH_READBACK_ROWS", counts.hash_readback_rows],
    ["QUANT_SHARD_RECEIPTS", counts.quant_shard_receipts],
    ["HYPERBEHCS_PLANE_COUNT", counts.hyperbehcs_plane_count],
    ["PLANE_BINDING_ROWS", counts.plane_binding_rows],
    ["LIVE_AGENT_SPAWN_ALLOWED", counts.live_agent_spawn_allowed],
    ["RUNTIME_AUTHORITY_GRANTS", counts.runtime_authority_grants]
  ].map(([symbol, value]) => ({
    schema: "hyperbehcs.d_drive_10000_room.shannon_symbol.v1",
    task_id: TASK_ID,
    symbol,
    value,
    bits: value > 0 ? Math.ceil(Math.log2(value + 1)) : 0,
    fingerprint: sha16(`${symbol}:${value}`)
  }));
}

function markdownReport(manifest) {
  return [
    "# HyperBEHCS D-Drive 10,000 Room Rotor",
    "",
    `Status: ${manifest.status}`,
    "",
    `Fingerprint: ${manifest.fingerprint}`,
    "",
    `Destination: ${manifest.destination_root}`,
    "",
    "## Counts",
    "",
    "| Metric | Value |",
    "| --- | ---: |",
    ...Object.entries(manifest.counts).map(([key, value]) => `| ${key} | ${value} |`),
    "",
    "## Boundary",
    "",
    "This materializes a D-drive room fabric for amplified HyperBEHCS work. It does not spawn agents, start processes, call providers/MCP tools, mutate routes, clean files, grant authority, or promote production."
  ].join("\n");
}

function buildCounts({ rooms, shardRows, materializedFiles, readbackRows, planeRows }) {
  return {
    room_count: rooms.length,
    shard_count: shardRows.length,
    materialized_room_files: materializedFiles.length,
    hash_readback_rows: readbackRows.length,
    hash_readback_ok: readbackRows.filter((row) => row.readback_ok).length,
    quant_shard_receipts: shardRows.length,
    hyperbehcs_plane_count: HYPERBEHCS_PLANES.length,
    plane_binding_rows: planeRows.length,
    active_window_size: Math.min(DEFAULT_WINDOW_SIZE, rooms.length),
    live_agent_spawn_allowed: 0,
    runtime_promotion_allowed: 0,
    ...ZERO_COUNTERS
  };
}

export function buildHyperbehcsDDrive10000RoomRotor(options = {}) {
  const generatedAt = options.generatedAt || new Date().toISOString();
  const targetRoot = normalizeTargetRoot(options.targetRoot);
  const runRoot = buildRunRoot(targetRoot, options.label);
  const roomCount = Math.max(1, Math.min(100000, Math.round(Number(options.roomCount || DEFAULT_ROOM_COUNT))));
  const shardSize = Math.max(1, Math.min(1000, Math.round(Number(options.shardSize || DEFAULT_SHARD_SIZE))));
  const windowSize = Math.max(1, Math.min(2048, Math.round(Number(options.windowSize || DEFAULT_WINDOW_SIZE))));
  const rooms = buildRooms({ generatedAt, roomCount, shardSize });
  const groups = groupByShard(rooms);
  const shardRows = buildShardRows(groups);
  const planeRows = buildPlaneBindingRows(rooms);
  const cursor = buildCursor({ generatedAt, rooms, windowSize });
  const automation = buildAutomationContract({ generatedAt, roomCount, shardSize, windowSize });
  const zeroAuthority = zeroAuthorityContract(generatedAt);
  const planeContract = buildPlaneContract({ generatedAt, roomCount, shardSize, windowSize });
  const paths = targetPaths(runRoot);

  const writeFiles = options.writeFiles !== false;
  const materializedFiles = writeFiles && options.materializeRooms !== false
    ? materializeRooms({ runRoot, rooms })
    : [];
  if (writeFiles) {
    writeJson(paths.manifest, {
      schema: "hyperbehcs.d_drive_10000_room.manifest.v1",
      task_id: TASK_ID,
      run_id: RUN_ID,
      generated_at: generatedAt,
      room_count: roomCount,
      shard_size: shardSize,
      shard_count: shardRows.length,
      destination_root: runRoot.replace(/\\/g, "/")
    });
    writeNdjson(paths.rooms, rooms);
    writeNdjson(paths.shards, shardRows.map(({ quant_receipt: _qr, ...row }) => row));
    writeNdjson(paths.quantReceipts, shardRows.map((row) => row.quant_receipt));
    writeNdjson(paths.planeBindings, planeRows);
    writeJson(paths.planeContract, planeContract);
    writeJson(paths.cursor, cursor);
    writeJson(paths.automationContract, automation);
    writeJson(paths.zeroAuthorityContract, zeroAuthority);
  }

  const readbackTargets = writeFiles
    ? [
      paths.manifest,
      paths.rooms,
      paths.shards,
      paths.quantReceipts,
      paths.planeBindings,
      paths.planeContract,
      paths.cursor,
      paths.automationContract,
      paths.zeroAuthorityContract,
      ...materializedFiles
    ]
    : [];
  const readbackRows = writeFiles ? hashReadback(readbackTargets) : [];
  if (writeFiles) writeNdjson(paths.readback, readbackRows);

  const counts = buildCounts({ rooms, shardRows, materializedFiles, readbackRows, planeRows });
  counts.active_window_size = cursor.window_size;
  const edges = gnnEdges({ generatedAt, runRoot, roomCount, shardRows, planeContract });
  const shannon = shannonSymbols(counts);
  const status = !writeFiles
    ? "d_drive_10000_room_rotor_plan_ready"
    : counts.room_count === roomCount && counts.hash_readback_ok === counts.hash_readback_rows
    ? "d_drive_10000_room_rotor_ready"
    : "d_drive_10000_room_rotor_incomplete";
  const base = {
    ok: status === "d_drive_10000_room_rotor_ready" || status === "d_drive_10000_room_rotor_plan_ready",
    schema: "hyperbehcs.d_drive_10000_room_rotor.v1",
    task_id: TASK_ID,
    run_id: RUN_ID,
    generated_at: generatedAt,
    status,
    answer: "d_drive_10000_room_rotor_materialized_descriptor_only_no_live_spawn",
    target_root: targetRoot.replace(/\\/g, "/"),
    destination_root: runRoot.replace(/\\/g, "/"),
    room_count: roomCount,
    shard_size: shardSize,
    window_size: windowSize,
    lanes: LANES,
    plane_binding_summary: {
      schema: "hyperbehcs.d_drive_10000_room.plane_binding_summary.v1",
      explicit_planes: true,
      plane_count: HYPERBEHCS_PLANES.length,
      plane_binding_rows: planeRows.length,
      plane_ids: HYPERBEHCS_PLANES.map((plane) => plane.plane_id),
      descriptor_only: true,
      hookwall_gate_required_for_live_action: true,
      live_action_allowed: false,
      runtime_authority_grants: 0
    },
    paths: Object.fromEntries(Object.entries(paths).map(([key, value]) => [key, value.replace(/\\/g, "/")])),
    cursor,
    plane_contract: planeContract,
    automation_contract: automation,
    zero_authority_contract: zeroAuthority,
    counts,
    gnn_edges: edges,
    shannon_symbols: shannon,
    boundary: {
      descriptor_only: true,
      d_drive_room_fabric: true,
      live_agent_spawn_allowed: false,
      process_start_allowed: false,
      provider_call_allowed: false,
      route_mutation_allowed: false,
      runtime_promotion_allowed: false,
      grants_authority: false,
      ...ZERO_COUNTERS
    }
  };
  return { ...base, fingerprint: sha16(base) };
}

export function writeHyperbehcsDDrive10000RoomRotor(manifest) {
  const runRoot = manifest.destination_root.replace(/\//g, "\\");
  const reportJson = path.join(runRoot, "manifest", "rotor-report.v1.json");
  const reportMd = path.join(runRoot, "manifest", "rotor-report.md");
  writeJson(reportJson, manifest);
  writeText(reportMd, markdownReport(manifest));
  writeJson(LOCAL_OUTPUTS.reportJson, manifest);
  writeText(LOCAL_OUTPUTS.reportMd, markdownReport(manifest));
  writeJson(LOCAL_OUTPUTS.dashboardFeed, {
    schema: "hyperbehcs.dashboard_feed.d_drive_10000_room_rotor.v1",
    task_id: TASK_ID,
    status: manifest.status,
    fingerprint: manifest.fingerprint,
    destination_root: manifest.destination_root,
    plane_binding_summary: manifest.plane_binding_summary,
    counts: manifest.counts,
    boundary: manifest.boundary
  });
  writeNdjson(LOCAL_OUTPUTS.gnnEdges, manifest.gnn_edges);
  writeNdjson(LOCAL_OUTPUTS.shannonSymbols, manifest.shannon_symbols);
  return { ...LOCAL_OUTPUTS, d_report_json: reportJson, d_report_md: reportMd };
}

export function runHyperbehcsDDrive10000RoomRotor(options = {}) {
  const manifest = buildHyperbehcsDDrive10000RoomRotor(options);
  const outputs = writeHyperbehcsDDrive10000RoomRotor(manifest);
  return { manifest, outputs };
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const args = parseArgs();
  const { manifest } = runHyperbehcsDDrive10000RoomRotor(args);
  console.log(JSON.stringify({
    ok: manifest.ok,
    fingerprint: manifest.fingerprint,
    status: manifest.status,
    destination_root: manifest.destination_root,
    counts: manifest.counts,
    answer: manifest.answer
  }, null, 2));
}
