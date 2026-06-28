# Carry HBPv1 Migration Plan — `D:/Asolaria-HyperBEHCS-10000-RoomRotor/hyperbehcs-carry-quant-10000/`

**Spindle:** Civilization Spindle 4 — Architect (main).
**Source surface:** HyperBEHCS 10000-Room Carry (NDJSON + singleton JSON). 10000 rooms across 100 shards, 17 planes per room, `descriptor_only: true`, `live_action_allowed: false`. Generated 2026-05-16 by `hyperbehcs-d-drive-10000-room-rotor-20260516`.
**Target discipline:** HyperBEHCS Hermes `.hbp` rows + `.hbi` / `.sha256` / `.hex` sidecars + append-only chain + 32 default-closed authority fields (per `D:/hyperbehcs-hermes/SPEC.md` and reference templates `C:/asolaria-acer/packages/revolver-10k/HERMES_MIGRATION_PLAN.md` and `C:/Users/acer/Asolaria/data/behcs/fabric-revolver/FABRIC_HERMES_MIGRATION_PLAN.md`).
**Scope:** mapping only. No code, no emission, no deletion. Migrator/verifier subagents consume this verbatim.

---

## 0. Global rules

Every emitted `.hbp` row carries, in order:

1. The 13 REQUIRED fields (`SPEC.md` 13-28): `layer`, `pid`, `prof`, `supervisor`, `tuple`, `triple_quant`, `polar_quant`, `js_quant`, `turbo_quant`, `json`, `runtime`, `promote`, `status`.
2. The 4 chain fields: `chain_id`, `sequence`, `prev_hash`, `row_hash`.
3. The 32 authority fields default `=0` — the carry is `descriptor_only:true` by its own contract; it never opens execution authority.
4. The 7 describe-only fields default `=1` — public descriptor surface.
5. Row-specific tail fields per template in section 2.

Carry quant-tag fixed strings:

- `triple_quant=room/shard/lane` (room and binding rows), `shard/room_count/fingerprint` (shard rows), `path/bytes/sha256` (hash-readback rows), `shard/source/target` (quant-receipt rows)
- `polar_quant=describe/execute` (always)
- `js_quant=johnson-slithechen-public` (always)
- `turbo_quant=packet-first` (always)

PID rule: reuse existing IDs verbatim. Room rows use `brown_hilbert_pid` (`BH.ROOM.NNNNN.<12hex>`). Plane-binding rows use the per-plane `binding_pid` (`BH.PLANE.<ENT>.<12hex>`). Shard and quant-receipt rows synthesize descriptor PIDs from the `shard_id` (`ACER-CARRY-SHARD-PID-shard-NNNN` and `ACER-CARRY-QUANT-PID-shard-NNNN`). Hash-readback rows synthesize from the sha256 prefix (`ACER-CARRY-HASH-PID-<8hex(sha256)>`). Do NOT mint new global PIDs; this is a descriptor migration, not a re-identification.

`row_hash` rule (per `chain.py:24`): emitter computes `sha256(canonical_row_text + "\n")` over the row text excluding the trailing `row_hash=` field, then appends `row_hash=<hex>` last.

Sidecars (per `SPEC.md:43-64`):

- `<file>.hbp` — source truth, pipe-delimited HBPv1 rows
- `<file>.hbi` — one HBIv1 row per HBP row (row count equality required)
- `<file>.sha256` — `<sha256>  <basename.hbp>`
- `<file>.hex` — lowercase hex of full `.hbp` bytes

The two singleton JSON files (`manifest/hyperbehcs-10000-room-rotor.v1.json`, `planes/plane-contract.v1.json`) and the report files (`manifest/rotor-report.md`, `manifest/rotor-report.v1.json`) are OUT OF SCOPE for this pass — they are static schema/contract documents, not row streams. They remain in place under the source carry as cold provenance.

---

## 1. File → pack map

Five NDJSON files. Recommended pack count = **106** total `.hbp` files. The plane-bindings file is sharded into 100 packs (one per shard) — see §1 recommendation below.

| Source NDJSON | Source rows | Target `.hbp` file(s) | `chain_id` | Pack count | Target row count |
|---|---|---|---|---|---|
| `manifest/shards-latest.ndjson` | 100 | `manifest/shards-latest.hbp` | `ACER-CARRY-SHARDS-v1` | 1 | 100 |
| `quant/shard-quant-receipts-latest.ndjson` | 100 | `quant/shard-quant-receipts-latest.hbp` | `ACER-CARRY-QUANT-RECEIPTS-v1` | 1 | 100 |
| `manifest/rooms-latest.ndjson` | 10000 | `manifest/rooms-latest.hbp` | `ACER-CARRY-ROOMS-v1` | 1 | 10000 |
| `manifest/plane-bindings-latest.ndjson` | 10000 | `manifest/plane-bindings/plane-bindings-shard-NNNN.hbp` × 100 | `ACER-CARRY-PLANE-BINDINGS-v1` | 100 | 170000 (100 rooms/shard × 17 plane rows + 100 binding-header rows × 100 shards = 100×(100×17+1) = 170100) — see §2.2 |
| `manifest/hash-readback-latest.ndjson` | 40009 | `manifest/hash-readback/hash-readback-part-NN.hbp` × 4 | `ACER-CARRY-HASH-READBACK-v1` | 4 | 40009 |

**Total source rows:** 60209.
**Total target `.hbp` rows:** 100 + 100 + 10000 + 170100 + 40009 = **220309**.
**Total `.hbp` files:** 1 + 1 + 1 + 100 + 4 = **107**.

### §1 recommendation — plane-bindings sharding

The source `manifest/plane-bindings-latest.ndjson` is 10000 rows × ~5.3KB/row = 52.8 MB. Each row contains 17 nested plane bindings (a `bindings{}` map keyed by `plane_id`). Choice:

- **Option A — ONE pack with 10000 rows, nested bindings collapsed into 17 tuple fields per row.** Keeps row count = source row count. Row width = ~4KB (17 × ~250B per binding). `.hbp` row-byte ceiling concerns flagged in MEMORY (per `SPEC.md` v0.3 row width guidance) — 4KB-wide rows exceed comfortable parser/diff windows.
- **Option B (RECOMMENDED) — 100 packs sharded by `shard_id` matching the existing 100-shard structure, plane bindings UNNESTED into one row per (room, plane).** Each pack = one shard = 100 rooms = 100 × 17 = 1700 plane-binding rows + 1 binding-header row (the room's outer envelope with `plane_count=17`, `plane_ids=[…]`, `brown_hilbert_pid=…`) = **1701 rows per pack**. Pack count = 100. Total = 100 × 1701 = 170100 rows.

**Choose B.** Rationale:

1. Aligns target packs with the existing 100-shard topology (already canon in `shards-latest.ndjson`).
2. Per-row width stays under 600 bytes (single plane binding ≈ 250B + headers ≈ 200B + chain/auth fields ≈ 150B).
3. Diff-friendly: a single-shard re-emission only rewrites one pack.
4. Verifier chain monotonicity is preserved by single `chain_id=ACER-CARRY-PLANE-BINDINGS-v1` across all 100 packs (sequence advances across pack boundaries — pack file is a filesystem artifact, the chain is logical).
5. Mirrors how `chain.py` chains span multiple ndjson files in the fabric-revolver plan (`chamber-receipts.ndjson` + `completed-tasks.ndjson` share `ACER-FABRIC-RECEIPT-v1`).

### §1 recommendation — hash-readback sharding

40009 rows × ~660B/row = ~26 MB. Single-pack is borderline but acceptable. Recommendation: split into **4 packs of ~10002-10003 rows each** by source row index (no semantic shard key exists on hash-readback rows — they're flat path/sha256 records). Pack boundaries: `[0,10003)`, `[10003,20005)`, `[20005,30007)`, `[30007,40009)`. Naming: `hash-readback-part-00.hbp` … `hash-readback-part-03.hbp`. Single chain `ACER-CARRY-HASH-READBACK-v1` spans all 4 packs. See §5 for full sharding strategy.

---

## 2. Per-file row template

### 2.1 `manifest/shards-latest.ndjson` → `manifest/shards-latest.hbp`

One row per shard. 100 rows.

| Source field | HBPv1 field | Notes |
|---|---|---|
| `schema` | (informational only, not emitted) | |
| `shard_id` | `shard_id` | `shard-NNNN` |
| `room_count` | `room_count` | 100 in all rows |
| `first_room` | `first_room` | `room-NNNNN` |
| `last_room` | `last_room` | `room-NNNNN` |
| `lane_counts.<lane>` | `lane_count_<lane>` | 12 lane fields: `carry_z`, `quant`, `reflex`, `gulp`, `super_gulp`, `gc`, `gnn`, `shannon`, `white_room`, `minting`, `watcher`, `indexer` |
| `quant_receipt_fingerprint` | `quant_receipt_fingerprint` | `<hex16>` |
| `descriptor_only` | `descriptor_only=1` | constant, but mirrored for clarity |
| `hardware_mutations` … `production_promotions` (16 zero-counters) | (not emitted as tail fields) | The 32 authority fields already cover these. Verifier asserts source `=0` then drops. |
| `fingerprint` | `shard_fingerprint` | `<hex16>` |
| `layer` | `layer=carry-shard` | constant |
| `prof` | `prof=hyperbehcs-shard-descriptor` | constant |
| `pid` | `pid=ACER-CARRY-SHARD-PID-shard-NNNN` | synthesized from `shard_id` |
| `tuple` | `tuple=shard:<shard_id>:<room_count>` | synthesized |
| `triple_quant` | `triple_quant=shard/room_count/fingerprint` | row class fixed |
| `status` | `status=SPINDLE_DESCRIBED` | per §4 |
| `chain_id` | `ACER-CARRY-SHARDS-v1` | per §3 |
| `supervisor` | `supervisor=fail-closed-public` | constant |

### 2.2 `manifest/plane-bindings-latest.ndjson` → `manifest/plane-bindings/plane-bindings-shard-NNNN.hbp` × 100

Each source row = one room with `bindings{}` map of 17 planes. **Strategy: unnest into 17 plane-binding rows per room + 1 binding-header row per room.**

Per shard (100 rooms): 100 × (1 header + 17 bindings) = 1701 rows.

**Header row (one per room, layer=carry-binding-header):**

| Source field | HBPv1 field | Notes |
|---|---|---|
| `room_id` | `room_id` | `room-NNNNN` |
| `shard_id` | `shard_id` | |
| `lane` | `lane_name` | one of 12 lanes |
| `brown_hilbert_pid` | `pid` | `BH.ROOM.NNNNN.<12hex>` — direct reuse |
| `plane_count` | `plane_count=17` | constant |
| `plane_ids` | `plane_ids=hyperbehcs,carry_z,hrm,gulp,super_gulp,gnn,gc,hookwall,tuple,crypto,sha,quant,minting,reflex,white_room,watcher,indexer` | comma-joined, fixed order |
| `layer` | `layer=carry-binding-header` | constant |
| `prof` | `prof=hyperbehcs-room-plane-bindings` | constant |
| `tuple` | `tuple=room:<room_id>:<shard_id>` | synthesized |
| `triple_quant` | `triple_quant=room/shard/lane` | |
| `status` | `status=SPINDLE_DESCRIBED` | |

**Plane-binding row (17 per room, layer=carry-binding-plane):**

For each `(room_id, plane_id)` pair, emit one row with the inner `bindings[plane_id]` fields:

| Source field | HBPv1 field | Notes |
|---|---|---|
| `bindings[p].plane_id` | `plane_id` | |
| `bindings[p].role` | `plane_role` | rename to avoid colliding with reserved Hermes roles |
| `bindings[p].slot_id` | `slot_id` | `<plane>:0000:00000` |
| `bindings[p].binding_pid` | `pid` | `BH.PLANE.<ENT>.<12hex>` — direct reuse |
| `bindings[p].lane_affinity` | `lane_affinity` | |
| `bindings[p].descriptor_only` | `descriptor_only=1` | constant |
| `bindings[p].live_action_allowed` | `live_action_allowed=0` | constant; mirror of authority closure |
| `bindings[p].runtime_authority_grants` | `runtime_authority_grants=0` | constant |
| `bindings[p].sha16` | `binding_sha16` | `<hex16>` |
| (carried context) | `room_id`, `shard_id`, `lane_name` | denormalized from outer row for row-level join-free read |
| `layer` | `layer=carry-binding-plane` | constant |
| `prof` | `prof=hyperbehcs-plane-binding` | constant |
| `tuple` | `tuple=binding:<room_id>:<plane_id>` | synthesized |
| `triple_quant` | `triple_quant=room/shard/lane` | |
| `status` | `status=SPINDLE_DESCRIBED` | |

**Tuple field strategy for nested 17-plane bindings (the key question):** UNNEST. Each room produces 17 atomic rows + 1 header row in append order following the canonical `plane_ids[]` order (`hyperbehcs, carry_z, hrm, gulp, super_gulp, gnn, gc, hookwall, tuple, crypto, sha, quant, minting, reflex, white_room, watcher, indexer`). This avoids row-width blowup, keeps every `binding_pid` queryable by its own row, and lets the `.hbi` index point at individual plane bindings — which is what a `BH.PLANE.*` consumer expects.

Chain sequence across all 100 packs is monotonic: shard-0000 emits sequences `[0, 1700]`, shard-0001 emits `[1701, 3401]`, …, shard-0099 emits `[168399, 170099]`. Verifier MUST validate the chain across pack-file boundaries.

### 2.3 `manifest/rooms-latest.ndjson` → `manifest/rooms-latest.hbp`

One row per room. 10000 rows. The source row has a `plane_bindings{}` map identical to the plane-bindings file — do NOT re-unnest it here. The room pack carries the room-level descriptor; per-plane detail lives in pack 2.2.

| Source field | HBPv1 field | Notes |
|---|---|---|
| `schema` | (informational only) | |
| `generated_at` | `generated_at_iso` | |
| `room_index` | `room_index` | 0..9999 |
| `room_id` | `room_id` | `room-NNNNN` |
| `shard_id` | `shard_id` | |
| `lane` | `lane_name` | |
| `rotation_epoch` | `rotation_epoch=0` | constant in current carry |
| `brown_hilbert_pid` | `pid` | direct reuse |
| `carry_state_slot` | `carry_state_slot` | `carry:NNNN` |
| `quant_slot` | `quant_slot` | `quant:NNNN:NNN` |
| `gulp_window` | `gulp_window=0` | |
| `gc_window` | `gc_window=0` | |
| `automation.mode` | `automation_mode=descriptor_ready` | |
| `automation.auto_spawn_allowed` | `auto_spawn_allowed=0` | |
| `automation.process_start_allowed` | `process_start_allowed=0` | |
| `automation.provider_call_allowed` | `provider_call_allowed=0` | |
| `automation.route_mutation_allowed` | `route_mutation_allowed=0` | |
| `automation.promotion_requires_gate` | `promotion_gate=hyperbehcs.carry_state_reflex_promotion_gate` | constant in carry |
| `plane_bindings` | (NOT emitted in this pack — see 2.2) | |
| `layer` | `layer=carry-room` | constant |
| `prof` | `prof=hyperbehcs-room-descriptor` | constant |
| `tuple` | `tuple=room:<room_id>:<shard_id>` | synthesized |
| `triple_quant` | `triple_quant=room/shard/lane` | |
| `status` | `status=SPINDLE_DESCRIBED` | |
| `chain_id` | `ACER-CARRY-ROOMS-v1` | |

The source row file shape IS PRESENT (verified by `head -c 3000` on `rooms-latest.ndjson` — first row carries `schema=hyperbehcs.d_drive_10000_room.room.v1` and full `plane_bindings{}` map). Plane-binding detail is materially duplicated between `rooms-latest.ndjson` and `plane-bindings-latest.ndjson`; the migration deliberately routes the per-plane detail through pack 2.2 only and lets pack 2.3 stay at room-level granularity.

### 2.4 `manifest/hash-readback-latest.ndjson` → `manifest/hash-readback/hash-readback-part-NN.hbp` × 4

One row per readback entry. 40009 rows total, sharded into 4 packs (see §5).

| Source field | HBPv1 field | Notes |
|---|---|---|
| `schema` | (informational only) | |
| `path` | `file_path` | full source path; URL-encode `|` if any (none in current data) |
| `bytes` | `byte_count` | integer |
| `sha256` | `sha256` | `<hex64>` |
| `readback_ok` | `readback_ok=1` | constant in current data; verifier MUST reject `=0` |
| 16 zero-counter authority fields | (not emitted) | 32 authority fields cover them |
| `fingerprint` | `readback_fingerprint` | `<hex16>` |
| `layer` | `layer=carry-hash-readback` | constant |
| `prof` | `prof=hyperbehcs-hash-readback` | constant |
| `pid` | `pid=ACER-CARRY-HASH-PID-<8hex(sha256)>` | synthesized from sha256 prefix |
| `tuple` | `tuple=hash:<8hex(sha256)>:<byte_count>` | synthesized |
| `triple_quant` | `triple_quant=path/bytes/sha256` | |
| `status` | `status=SPINDLE_DESCRIBED` | |
| `chain_id` | `ACER-CARRY-HASH-READBACK-v1` | |

### 2.5 `quant/shard-quant-receipts-latest.ndjson` → `quant/shard-quant-receipts-latest.hbp`

One row per shard quant receipt. 100 rows. The source row has a deeply nested `receipt{}` containing `algorithms{}` with 7+ algorithm objects. **Strategy: hash-and-sidecar the nested algorithms**, keep only the receipt-level fingerprints and the source/target dimensions inline.

| Source field | HBPv1 field | Notes |
|---|---|---|
| `schema` | (informational only) | |
| `shard_id` | `shard_id` | |
| `room_count` | `room_count=100` | constant |
| `receipt.schema` | `receipt_schema=hyperbehcs.quantized_substrate_receipt.v1` | |
| `receipt.substrate_id` | `substrate_id=storage_d_drive` | constant |
| `receipt.source_layer` | `source_layer=hyperbehcs_10000_room_rotor` | constant |
| `receipt.vector_dimension` | `source_dimension=8` | constant |
| `receipt.target_dimension` | `target_dimension=4` | constant |
| `receipt.algorithms{}` | `algorithms_sidecar=quant/<shard_id>-algorithms.json` | hashed-and-sidecar; full nested algorithm payloads written to per-shard sidecar JSON; sha16 of the algorithms blob recorded as `algorithms_sha16` |
| `receipt.algorithms{}` (sha16) | `algorithms_sha16` | sha16 of canonical JSON of the algorithms object |
| (top-level zero-counters) | (not emitted) | 32 authority fields cover |
| `layer` | `layer=carry-quant-receipt` | constant |
| `prof` | `prof=hyperbehcs-shard-quant-receipt` | constant |
| `pid` | `pid=ACER-CARRY-QUANT-PID-shard-NNNN` | synthesized |
| `tuple` | `tuple=quant:<shard_id>:<algorithms_sha16>` | synthesized |
| `triple_quant` | `triple_quant=shard/source/target` | |
| `status` | `status=SPINDLE_DESCRIBED` | |
| `chain_id` | `ACER-CARRY-QUANT-RECEIPTS-v1` | |

Rationale for sidecar: the nested `algorithms{}` contains 7+ entries (johnson_lindenstrauss_projection, turbo_quant, polar_quant, triple_quant, json_subnet_quant, …) each with `projection[]`, `quantized[]`, `dequantized[]`, `metadata{}`, and duplicate snake/camel-case keys (`source_dimension`+`sourceDimensions`). Inlining all of it into 100 HBPv1 rows would average 10KB+ per row. Sidecar pattern matches the `objective_sha16` recommendation in `FABRIC_HERMES_MIGRATION_PLAN.md` §6.

---

## 3. Chain ID assignment

One chain per source category. Sequence is monotonic within chain; `prev_hash` chains rows in append order (ROOT for sequence 0). All chain IDs use the `ACER-CARRY-*-v1` prefix to namespace-isolate from `ACER-REVOLVER-*-v1` (revolver-10k) and `ACER-FABRIC-*-v1` (fabric-revolver).

| Source file(s) | `chain_id` | Pack(s) | Notes |
|---|---|---|---|
| `manifest/shards-latest.ndjson` | `ACER-CARRY-SHARDS-v1` | `shards-latest.hbp` | 100-row single pack. |
| `manifest/plane-bindings-latest.ndjson` | `ACER-CARRY-PLANE-BINDINGS-v1` | `plane-bindings/plane-bindings-shard-NNNN.hbp` × 100 | One logical chain spans all 100 packs; sequence advances across pack boundaries. |
| `manifest/rooms-latest.ndjson` | `ACER-CARRY-ROOMS-v1` | `rooms-latest.hbp` | 10000-row single pack. |
| `manifest/hash-readback-latest.ndjson` | `ACER-CARRY-HASH-READBACK-v1` | `hash-readback/hash-readback-part-NN.hbp` × 4 | One logical chain spans all 4 packs. |
| `quant/shard-quant-receipts-latest.ndjson` | `ACER-CARRY-QUANT-RECEIPTS-v1` | `shard-quant-receipts-latest.hbp` | 100-row single pack. |

Verifier MUST reject cross-chain `prev_hash` references. Chain `ACER-CARRY-*-v1` IDs are local to this carry; they do NOT collide with `ACER-REVOLVER-*-v1` (revolver-10k codepath, which use the `REVOLVER` infix) nor with `ACER-FABRIC-*-v1` (fabric-revolver codepath, which use the `FABRIC` infix).

---

## 4. Status enum mapping

The carry is `descriptor_only: true` by its own contract (`manifest/hyperbehcs-10000-room-rotor.v1.json` plus every source row carries `descriptor_only:true` and `live_action_allowed:false` at the plane-binding level). Per Hermes `WAVE_DESCRIPTOR_STATUSES` (`SPEC.md:154-157`), the only status that fits a pure descriptor stream with no execution intent is `SPINDLE_DESCRIBED`.

| Source field/condition | Hermes `status=` | Rationale |
|---|---|---|
| every row, all 5 chains | `SPINDLE_DESCRIBED` | Descriptor-only carry; no chamber cycle, no wave receipts, no execution. |
| `readback_ok:false` in hash-readback (none observed) | (verifier MUST reject row) | Carry contract requires readback success; any `false` invalidates the carry. |
| `descriptor_only:false` in any plane binding (none observed) | (verifier MUST reject row) | Carry contract requires descriptor-only; any `false` is a contract violation, NOT a status promotion. |

No status promotions occur in this migration. The carry never enters `SPINDLE_MAIN_ASSIGNED` / `SPINDLE_REVIEW_REQUESTED` / `WAVE_RECEIPTED` / etc. — those are runtime states the carry deliberately disclaims.

---

## 5. Sharding strategy for `hash-readback-latest.ndjson`

40009 rows, ~660B/row avg, ~26 MB total. Chunked into **4 packs**:

| Pack | Source row range | Row count | Approx pack size |
|---|---|---|---|
| `hash-readback-part-00.hbp` | `[0, 10003)` | 10003 | ~6.5 MB |
| `hash-readback-part-01.hbp` | `[10003, 20005)` | 10002 | ~6.5 MB |
| `hash-readback-part-02.hbp` | `[20005, 30007)` | 10002 | ~6.5 MB |
| `hash-readback-part-03.hbp` | `[30007, 40009)` | 10002 | ~6.5 MB |

Pack boundaries are by source row index only; no semantic shard key exists on hash-readback rows. Single chain `ACER-CARRY-HASH-READBACK-v1` spans all 4 packs; sequence is monotonic across pack boundaries.

Rationale for 4 packs (not 1, not 40):

- 1 pack = 26 MB single file — borderline acceptable but ungainly for diffs / partial re-emit.
- 4 packs = ~6.5 MB each — fits cleanly into editor windows, diff tools, and dashboard partial-load patterns.
- 40+ packs = excessive filesystem overhead; the rows have no natural per-10-row grouping.

`.hbi` sidecar: one per `.hbp`, also 4 files, row count equality with its parent pack. `.sha256` and `.hex` likewise per-pack.

---

## 6. Migration order (safest → riskiest)

Files migrated bottom-up by size, fragility, and downstream consumer count. Each step emits the new `.hbp` + `.hbi` + `.sha256` + `.hex` while leaving the source NDJSON in place. No file is deleted in this plan.

1. **`manifest/shards-latest.ndjson`** — 100 rows, flat, no nested arrays. Smallest. `ACER-CARRY-SHARDS-v1` chain has zero downstream consumers in the current codebase; any error is contained.
2. **`quant/shard-quant-receipts-latest.ndjson`** — 100 rows, but each carries a deep nested `algorithms{}` blob. Sidecar pattern (§2.5) is the only structural complexity. Tests the sidecar discipline before larger packs.
3. **`manifest/rooms-latest.ndjson`** — 10000 rows, ~5.5 KB/row source but emitted row excludes the nested `plane_bindings{}` so output rows are ~600B. Single pack, single chain. No nested-array gymnastics at emit time (the `plane_bindings{}` is simply dropped — its detail flows through pack 2.2 instead).
4. **`manifest/plane-bindings-latest.ndjson`** — 10000 source rows × 17 nested bindings = 170100 emitted rows across 100 packs. Largest pack-count, sharded by `shard_id`. Verifier MUST validate the merged chain `ACER-CARRY-PLANE-BINDINGS-v1` is monotonic across all 100 packs in `shard_id` ascending order (use lexicographic order on `shard-NNNN`).
5. **`manifest/hash-readback-latest.ndjson`** — 40009 rows across 4 packs. Largest in absolute row count. Last because (a) the chain is the longest and most expensive to re-emit on error, (b) the `.hbi` sidecar build for 40009 rows is the slowest, (c) the readback file references all the other files by path — if those files have already migrated to `.hbp`, the readback paths still point at the original `.ndjson` source-truth (which remains in place — see §7).

The `manifest/hyperbehcs-10000-room-rotor.v1.json` and `planes/plane-contract.v1.json` are NOT migrated — they are static schema documents, not row streams. Same for `manifest/rotor-report.md` and `manifest/rotor-report.v1.json`.

The `authority/`, `automation/`, and `rooms/` subdirectories of the source carry are out of scope for this NDJSON-to-HBPv1 pass; they may contain additional artifacts but the rotor-manifest (`hyperbehcs-10000-room-rotor.v1.json`) declares only the five NDJSON files plus two JSON singletons as canonical row streams.

---

## 7. Storage

The migrator writes new packs to the SIBLING directory:

```
D:/Asolaria-HyperBEHCS-10000-RoomRotor/hyperbehcs-carry-quant-10000-hbp/
├── manifest/
│   ├── shards-latest.hbp + .hbi + .sha256 + .hex
│   ├── rooms-latest.hbp + .hbi + .sha256 + .hex
│   ├── plane-bindings/
│   │   ├── plane-bindings-shard-0000.hbp + .hbi + .sha256 + .hex
│   │   ├── plane-bindings-shard-0001.hbp + .hbi + .sha256 + .hex
│   │   └── … (98 more) …
│   └── hash-readback/
│       ├── hash-readback-part-00.hbp + .hbi + .sha256 + .hex
│       ├── hash-readback-part-01.hbp + .hbi + .sha256 + .hex
│       ├── hash-readback-part-02.hbp + .hbi + .sha256 + .hex
│       └── hash-readback-part-03.hbp + .hbi + .sha256 + .hex
└── quant/
    ├── shard-quant-receipts-latest.hbp + .hbi + .sha256 + .hex
    └── <shard-NNNN>-algorithms.json × 100 (per-shard quant algorithm sidecars from §2.5)
```

The original `hyperbehcs-carry-quant-10000/` directory is NOT modified. The original NDJSON files remain in place as cold provenance per the Hermes dual-emit / freeze-source discipline established in the prior spindle plans (`FABRIC_HERMES_MIGRATION_PLAN.md` §5).

Total target filesystem footprint estimate:

- 107 `.hbp` files + 107 `.hbi` + 107 `.sha256` + 107 `.hex` = 428 files.
- Plus 100 per-shard quant algorithm sidecars = 528 files total in the new SIBLING directory.
- Approx total size: shards ~50 KB + quant-receipts ~50 KB + algorithm sidecars ~3 MB + rooms ~6 MB + plane-bindings ~100 MB + hash-readback ~30 MB = **~140 MB** in target SIBLING (vs ~135 MB source carry).

Cosign discipline: at completion of all 5 migrations, a single cosign row is appended to the federation cosign chain summarizing the carry-to-pack migration outcome (chain row anchor `ACER-CARRY-HBP-MIGRATION-PID-2026-05-19` recommended). Quintuple-auth window per `project_quintuple_auth_fabric_decide_window_2026_05_07_to_05_21.md` covers this descriptor migration without further authorization (carry is descriptor-only, no execution-authority promotion occurs).

---

**End of plan.** Five source NDJSON files mapped to 107 `.hbp` packs across 5 chains (§1+§3), per-file row templates in §2, status enum trivially `SPINDLE_DESCRIBED` for all rows (§4), hash-readback 4-way sharding (§5), 5-step migration order (§6), SIBLING storage layout (§7). Total target row count: **220309**. Total target pack files: **107**.
