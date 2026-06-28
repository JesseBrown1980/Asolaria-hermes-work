# CARRY SHAPE INVENTORY — hyperbehcs-carry-quant-10000

Scan target: `D:/Asolaria-HyperBEHCS-10000-RoomRotor/hyperbehcs-carry-quant-10000/`
Scan scope: `manifest/`, `quant/`, `planes/`, `authority/`, `automation/` (full) + 1 sample room (`rooms/shard-0000/room-00000/`).
Generated: 2026-05-19 by Civ Spindle 4 / Subagent 1.

---

## 1. File table (carry root, excludes per-room scaffold)

| Path (relative to carry root) | Type | Size (KB) | Row count | First-row top-level keys |
| --- | --- | ---: | ---: | --- |
| `manifest/hyperbehcs-10000-room-rotor.v1.json` | JSON | 0.4 | 1 (obj) | `schema`, `task_id`, `run_id`, `generated_at`, `room_count`, `shard_size`, `shard_count`, `destination_root` |
| `manifest/rotor-report.md` | Markdown | 1.2 | n/a | (counts table) |
| `manifest/rotor-report.v1.json` | JSON | 122.7 | 1 (obj) | `ok`, `schema`, `task_id`, `run_id`, `generated_at`, `status`, `answer`, `target_root`, ... |
| `manifest/hash-readback-latest.ndjson` | NDJSON | 26050.8 | **40009** | `schema`, `path`, `bytes`, `sha256`, `readback_ok`, `hardware_mutations`, ... (zero-authority counters) |
| `manifest/plane-bindings-latest.ndjson` | NDJSON | 51606.4 | **10000** | `schema`, `room_id`, `shard_id`, `lane`, `brown_hilbert_pid`, `plane_count`, `plane_ids[]`, `bindings{}` |
| `manifest/rooms-latest.ndjson` | NDJSON | 54074.7 | **10000** | `schema`, `generated_at`, `room_index`, `room_id`, `shard_id`, `lane`, `rotation_epoch`, `brown_hilbert_pid`, `carry_state_slot`, `quant_slot`, `gulp_window`, `gc_window`, `automation`, `plane_bindings`, `boundary`, `fingerprint` |
| `manifest/shards-latest.ndjson` | NDJSON | 72.9 | **100** | `schema`, `shard_id`, `room_count`, `first_room`, `last_room`, `lane_counts{}`, `quant_receipt_fingerprint`, `descriptor_only`, ... |
| `quant/shard-quant-receipts-latest.ndjson` | NDJSON | 715.2 | **100** | `schema`, `shard_id`, `room_count`, `receipt{substrate_id, source_layer, vector_dimension, target_dimension, algorithms{}, ...}` |
| `planes/plane-contract.v1.json` | JSON | 14.3 | 1 (obj) | `schema`, `generated_at`, `task_id`, `room_count`, `shard_size`, `window_size`, `plane_count`, `descriptor_only`, `hookwall_gate_required_for_live_action`, `planes[]` |
| `authority/zero-authority-contract.v1.json` | JSON | 0.9 | 1 (obj) | `schema`, `generated_at`, `task_id`, `descriptor_only_room_fabric`, `d_drive_write_scope_only`, `live_agent_spawn_allowed`, ... (full zero-authority counters) |
| `automation/automation-contract.v1.json` | JSON | 1.2 | 1 (obj) | `schema`, `generated_at`, `task_id`, `room_count`, `shard_size`, `window_size`, `automation_mode`, `tick_contract{}`, ... |
| `automation/cursor.v1.json` | JSON | 1.8 | 1 (obj) | `schema`, `generated_at`, `cursor_index`, `window_size`, `active_room_ids[]` (64), `next_room_id`, `rotation_policy`, ... |

All files <100 MB — none skipped.

Carry-root file count: **12** (4 NDJSON, 7 JSON, 1 Markdown).

---

## 2. Total NDJSON row count (carry root, excludes per-room scaffold)

| NDJSON file | Rows |
| --- | ---: |
| `manifest/hash-readback-latest.ndjson` | 40,009 |
| `manifest/plane-bindings-latest.ndjson` | 10,000 |
| `manifest/rooms-latest.ndjson` | 10,000 |
| `manifest/shards-latest.ndjson` | 100 |
| `quant/shard-quant-receipts-latest.ndjson` | 100 |
| **Carry-root subtotal** | **60,209** |

Per-room NDJSON contribution (see Section 3): each room's `inbox.ndjson` and `outbox.ndjson` is a 1-byte newline-only file (0 rows). Across 10,000 rooms × 2 files = 20,000 empty NDJSON files contributing **0 rows**.

**TOTAL NDJSON ROWS (carry-wide): 60,209**

---

## 3. Per-shard sample — `rooms/shard-0000/room-00000/`

| File | Size (B) | Rows | Top-level keys / shape |
| --- | ---: | ---: | --- |
| `ROOM.json` | 7,187 | 1 obj | `schema` (hyperbehcs.d_drive_10000_room.room.v1), `generated_at`, `room_index`, `room_id`, `shard_id`, `lane` (=carry_z), `rotation_epoch`, `brown_hilbert_pid` (BH.ROOM.00000.3BDC52A59D58), `carry_state_slot`, `quant_slot`, `gulp_window`, `gc_window`, `automation{mode,auto_spawn_allowed,...}`, `plane_bindings{}` (17 planes: hyperbehcs/carry_z/hrm/gulp/super_gulp/gnn/gc/hookwall/tuple/crypto/sha/quant/minting/reflex/white_room/watcher/indexer — each with plane_id, role, slot_id, binding_pid, lane_affinity, descriptor_only, live_action_allowed, runtime_authority_grants, sha16), `boundary{}` (zero-authority counters), `fingerprint` |
| `ROOM-STATUS.json` | 696 | 1 obj | `schema` (hyperbehcs.d_drive_10000_room.status.v1), `room_id`, `brown_hilbert_pid`, `status` (=descriptor_ready), `active` (false), `leased` (false), `live_agent_spawn_allowed` (false), `runtime_promotion_allowed` (false), 15 zero-authority counters (hardware_mutations, cpu_affinity_changes, gpu_kernel_launches, gpu_driver_mutations, remote_writes, adb_actions, scrcpy_actions, device_file_writes, route_mutations, provider_calls, mcp_tool_calls, process_starts, executor_executions, cleanup_actions, runtime_authority_grants, production_promotions) — all 0 |
| `inbox.ndjson` | 1 | 0 | empty (single `\n`, hex `0a`) — descriptor-ready, no traffic |
| `outbox.ndjson` | 1 | 0 | empty (single `\n`, hex `0a`) — descriptor-ready, no traffic |

Scaled to 10,000 rooms:
- ROOM.json × 10,000 ≈ 71.8 MB total (≈ 7,187 B each).
- ROOM-STATUS.json × 10,000 ≈ 6.96 MB total (≈ 696 B each).
- inbox+outbox × 20,000 ≈ 20 KB total (1 B each, newline-only).
- Per-room file total = 40,000 files (matches `materialized_room_files` in rotor-report.md).

---

## 4. Migration size estimate (carry → HBPv1, 800 B/line)

Definition: every NDJSON row becomes one HBPv1 line averaging 800 bytes.

| Source | NDJSON rows | × 800 B = bytes | KB | MB |
| --- | ---: | ---: | ---: | ---: |
| hash-readback-latest | 40,009 | 32,007,200 | 31,256.1 | 30.5 |
| plane-bindings-latest | 10,000 | 8,000,000 | 7,812.5 | 7.6 |
| rooms-latest | 10,000 | 8,000,000 | 7,812.5 | 7.6 |
| shards-latest | 100 | 80,000 | 78.1 | 0.08 |
| shard-quant-receipts-latest | 100 | 80,000 | 78.1 | 0.08 |
| per-room inbox+outbox (×20,000 files) | 0 | 0 | 0 | 0 |
| **TOTAL** | **60,209** | **48,167,200** | **47,038.3** | **~45.9** |

`.hbp` output estimate: **~45.9 MB (47,038 KB)** for the full carry-wide migration at 800 B/HBPv1 line.

Note: the 7 single-object JSON files (manifest/contracts/cursor/plane-contract/rotor-report.v1/etc.) total ~141 KB and are not row-stream sources; if migrated as singletons they add 7 × 800 B = 5.6 KB negligible.

---

## Notes / boundaries observed

- Carry is **descriptor-only, zero-authority** (every JSON/NDJSON carries 15-field zero-counter boundary; `descriptor_only:true` ubiquitous).
- Lane on sample room = `carry_z`; shard-0000 `lane_counts` show 12 lanes mixed (carry_z, quant, reflex, gulp, super_gulp, gc, gnn, shannon, white_room, minting, watcher, indexer).
- 17 planes per room: hyperbehcs, carry_z, hrm, gulp, super_gulp, gnn, gc, hookwall, tuple, crypto, sha, quant, minting, reflex, white_room, watcher, indexer.
- `hash-readback-latest.ndjson` (40,009 rows ≈ 40,000 room files + 9 carry-root files) is the largest single source for HBPv1 migration.
- Rotor fingerprint: `0d78af5e3e69bee2`. Sample room fingerprint: `3bdc52a59d58a5ed`.
- No file exceeded 100 MB; largest = `rooms-latest.ndjson` at 52.8 MB.
