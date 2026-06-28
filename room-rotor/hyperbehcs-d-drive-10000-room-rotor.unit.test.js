"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const root = path.resolve(__dirname, "..");

(async () => {
  const mod = await import(pathToFileURL(path.join(root, "tools", "behcs", "hyperbehcs-d-drive-10000-room-rotor.mjs")).href);
  const manifest = mod.buildHyperbehcsDDrive10000RoomRotor({
    generatedAt: "2026-05-16T00:00:00.000Z",
    targetRoot: "D:\\Asolaria-HyperBEHCS-Rotor-Unit",
    label: "unit",
    roomCount: 24,
    shardSize: 6,
    windowSize: 5,
    writeFiles: false
  });

  assert.equal(manifest.ok, true);
  assert.equal(manifest.schema, "hyperbehcs.d_drive_10000_room_rotor.v1");
  assert.equal(manifest.status, "d_drive_10000_room_rotor_plan_ready");
  assert.equal(manifest.room_count, 24);
  assert.equal(manifest.counts.room_count, 24);
  assert.equal(manifest.counts.shard_count, 4);
  assert.equal(manifest.counts.quant_shard_receipts, 4);
  assert.equal(manifest.counts.hyperbehcs_plane_count, 17);
  assert.equal(manifest.counts.plane_binding_rows, 24);
  assert.equal(manifest.cursor.window_size, 5);
  assert.equal(manifest.cursor.live_agent_spawn_allowed, false);
  assert.equal(manifest.plane_binding_summary.explicit_planes, true);
  assert.equal(manifest.plane_binding_summary.plane_count, 17);
  assert.equal(manifest.plane_binding_summary.hookwall_gate_required_for_live_action, true);
  assert.equal(manifest.plane_contract.plane_count, 17);
  assert.equal(manifest.plane_contract.hookwall_gate_required_for_live_action, true);
  assert.ok(manifest.plane_contract.planes.some((plane) => plane.plane_id === "hrm" && plane.role === "hierarchical_reasoning"));
  assert.ok(manifest.plane_contract.planes.some((plane) => plane.plane_id === "gulp" && plane.role === "intake"));
  assert.ok(manifest.plane_contract.planes.some((plane) => plane.plane_id === "gnn" && plane.role === "graph_feed"));
  assert.ok(manifest.plane_contract.planes.some((plane) => plane.plane_id === "gc" && plane.role === "post_chain_gc"));
  assert.ok(manifest.plane_contract.planes.some((plane) => plane.plane_id === "hookwall" && plane.role === "authority_gate"));
  assert.ok(manifest.plane_contract.planes.some((plane) => plane.plane_id === "tuple" && plane.role === "routing_tuple"));
  assert.ok(manifest.plane_contract.planes.some((plane) => plane.plane_id === "crypto" && plane.role === "receipt_crypto"));
  assert.ok(manifest.plane_contract.planes.some((plane) => plane.plane_id === "sha" && plane.role === "hash_readback"));
  assert.ok(manifest.gnn_edges.some((row) => row.to === "hookwall" && row.relation === "binds_explicit_hyperbehcs_plane"));
  assert.ok(manifest.shannon_symbols.some((row) => row.symbol === "HYPERBEHCS_PLANE_COUNT" && row.value === 17));
  assert.equal(manifest.automation_contract.live_agent_spawn_allowed, false);
  assert.equal(manifest.zero_authority_contract.process_start_allowed, false);
  assert.equal(manifest.boundary.d_drive_room_fabric, true);
  assert.equal(manifest.boundary.live_agent_spawn_allowed, false);
  assert.equal(manifest.paths.manifest.startsWith("D:/Asolaria-HyperBEHCS-Rotor-Unit/unit/"), true);
  assert.ok(manifest.gnn_edges.every((row) => row.grants_authority === false));
  assert.ok(manifest.shannon_symbols.some((row) => row.symbol === "ROOM_COUNT" && row.value === 24));

  assert.throws(() => mod.buildHyperbehcsDDrive10000RoomRotor({
    targetRoot: "C:\\tmp\\bad",
    writeFiles: false
  }), /target must be on D/);
  assert.throws(() => mod.buildHyperbehcsDDrive10000RoomRotor({
    targetRoot: "D:\\",
    writeFiles: false
  }), /Refusing to materialize/);

  for (const key of [
    "hardware_mutations",
    "cpu_affinity_changes",
    "gpu_kernel_launches",
    "gpu_driver_mutations",
    "remote_writes",
    "adb_actions",
    "scrcpy_actions",
    "device_file_writes",
    "route_mutations",
    "provider_calls",
    "mcp_tool_calls",
    "process_starts",
    "executor_executions",
    "cleanup_actions",
    "runtime_authority_grants",
    "production_promotions"
  ]) {
    assert.equal(manifest.counts[key], 0, `${key} count must stay zero`);
    assert.equal(manifest.boundary[key], 0, `${key} boundary must stay zero`);
    assert.equal(manifest.zero_authority_contract[key], 0, `${key} contract must stay zero`);
  }

  console.log(JSON.stringify({ ok: true, test: "hyperbehcs-d-drive-10000-room-rotor" }));
})().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
