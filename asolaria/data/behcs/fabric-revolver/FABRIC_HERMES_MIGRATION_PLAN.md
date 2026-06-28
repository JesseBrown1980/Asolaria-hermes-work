# Fabric-Revolver HBPv1 Migration Plan — `C:/Users/acer/Asolaria/data/behcs/fabric-revolver/`

**Spindle:** Civilization Spindle 3 — Architect (main).
**Source surface:** Pre-HyperBEHCS 8-chamber fabric-revolver (JSON + NDJSON). Cycle `EMPTY -> LOAD -> RUNNING -> COLLECT -> EJECT -> EMPTY`. 6 free models. PID format `ACER-REVOLVER-CHAMBER-NN-<16hex>`.
**Target discipline:** HyperBEHCS Hermes `.hbp` rows + `.hbi` / `.sha256` / `.hex` sidecars + append-only chain + 32 default-closed authority fields (per `D:/hyperbehcs-hermes/SPEC.md` and reference template `C:/asolaria-acer/packages/revolver-10k/HERMES_MIGRATION_PLAN.md`).
**Scope:** mapping only. No code, no emission, no deletion. Migrator/verifier subagents consume this verbatim.

---

## 0. Global rules

Every emitted `.hbp` row carries, in order:

1. The 13 REQUIRED fields (`SPEC.md` lines 13-28): `layer`, `pid`, `prof`, `supervisor`, `tuple`, `triple_quant`, `polar_quant`, `js_quant`, `turbo_quant`, `json`, `runtime`, `promote`, `status`.
2. The 4 chain fields: `chain_id`, `sequence`, `prev_hash`, `row_hash`.
3. The 32 authority fields default `=0` (fabric-revolver is descriptor-only; it never opens execution authority).
4. The 7 describe-only fields default `=1` (public descriptor surface).
5. Row-specific tail fields per template in section 1.

Fabric-revolver quant-tag fixed strings:

- `triple_quant=chamber/cycle/slot` (chamber rows), `range/objective/lane` (task rows), `wave/spindle/receipt` (wave rows), `objective/proof/kind` (mint rows)
- `polar_quant=describe/execute` (always)
- `js_quant=johnson-slithechen-public` (always)
- `turbo_quant=packet-first` (always)

PID rule: reuse existing IDs verbatim. Chamber rows use `ACER-REVOLVER-CHAMBER-NN-<16hex>`. Task / receipt / wave / mint rows reuse the existing `id` string from JSON as their `record_id` tail field and adopt a synthetic descriptor PID `ACER-FABRIC-<KIND>-PID-<8hex>` where `<8hex>` is the first 8 chars of the record's `proof_sha16` (or `id` if no proof). Do NOT mint new global PIDs; this is a descriptor migration, not a re-identification.

`row_hash` rule (per `chain.py:24`): emitter computes `sha256(canonical_row_text + "\n")` over the row text excluding the trailing `row_hash=` field, then appends `row_hash=<hex>` last.

Sidecars (per `SPEC.md:43-64`):

- `<file>.hbp` — source truth, pipe-delimited HBPv1 rows
- `<file>.hbi` — one HBIv1 row per HBP row (row count equality required)
- `<file>.sha256` — `<sha256>  <basename.hbp>`
- `<file>.hex` — lowercase hex of full `.hbp` bytes

---

## 1. JSON -> HBPv1 field maps (six file kinds, six tables)

### 1.1 `chambers-latest.json` -> `chambers-latest.hbp`

Top-level fields `ok`, `runtime`, `generated_at`, `updated_at`, `execute_default`, `architecture`, `models`, `task_types`, `counters` collapse into ONE header row (`chamber_header`); each entry of `chambers[]` becomes ONE `chamber_state` row. Total rows = 1 + 8 = 9.

**Per-chamber map (one row per `chambers[i]`):**

| JSON field | HBPv1 field | Notes |
|---|---|---|
| `chambers[i].index` | `chamber_index` | 0..7 |
| `chambers[i].state` | `status` | mapped via section 3 |
| `chambers[i].model` | `model_name` | rename to avoid colliding with reserved `provider` authority field |
| `chambers[i].pid` | `pid` | direct reuse, exists in chain-id namespace already |
| `chambers[i].assigned_task_id` | `assigned_task_id` | empty when null |
| `chambers[i].assigned_at` | `assigned_at_iso` | empty when null |
| `chambers[i].updated_at` | `updated_at_iso` | |
| `chambers[i].cycle_count` | `cycle_count` | |
| `chambers[i].last_receipt_id` | `last_receipt_id` | |
| `chambers[i].last_exit_code` | `last_exit_code` | empty when null |
| `chambers[i].last_error` | `last_error` | empty when null; if present, URL-encode pipes |
| `chambers[i].last_model_ok` | `last_model_ok` | 0 / 1 / empty |
| `runtime` (top) | `prof=acer-fabric-revolver-chamber` | constant |
| `architecture.cycle` | `chamber_cycle=EMPTY/LOAD/RUNNING/COLLECT/EJECT/EMPTY` | header row only |
| `architecture.active_chambers` | `active_chambers=8` | header row only |
| `models[]` | `models=opencode/deepseek-v4-flash-free,opencode/big-pickle,...` | header row only, comma-joined |
| `task_types[]` | `task_types=surface_registry,dashboard_pipe,...` | header row only, comma-joined |
| `counters.{loaded,executed,dry_assigned,collected,ejected}` | `counter_loaded`, `counter_executed`, `counter_dry_assigned`, `counter_collected`, `counter_ejected` | header row only |
| `execute_default` | `execute_default=0` | header row only |
| `generated_at` / `updated_at` | `generated_at_iso`, `updated_at_iso` | header row only |
| `tuple` | `tuple=chamber:<index>:<cycle_count>` (chamber rows), `tuple=header:revolver:<active_chambers>` (header) | synthesized |
| `layer` | `layer=fabric-revolver-chamber` (chamber rows), `layer=fabric-revolver-header` (header) | constant |
| `supervisor` | `supervisor=fail-closed-public` | constant |

### 1.2 `state-latest.json` -> `state-latest.hbp`

Single document -> single HBPv1 row plus one inner row per `architecture.lanes[]` entry (12 lanes -> 12 rows) and one inner row per `dispatch_modes[]` (5 rows) and one row per `next_actions[]` (5 rows). Total rows = 1 header + 12 lanes + 5 dispatch + 5 actions = 23.

| JSON field | HBPv1 field | Notes |
|---|---|---|
| `id` | `record_id` | header row |
| `generated_at` | `generated_at_iso` | header row |
| `architecture.name` | `arch_name` | header row |
| `architecture.viability_rule` | `viability_rule` | header row, URL-encode pipes and `=` |
| `architecture.shellless_backend_nodes` | `shellless=1` | header row |
| `architecture.process_per_node` | `process_per_node=0` | header row |
| `architecture.active_slots` | `active_slots=36` | header row |
| `architecture.logical_nodes_declared` | `logical_nodes_declared=1000000` | header row |
| `architecture.gulp_thresholds[]` | `gulp_thresholds=2000,5000` | header row |
| `architecture.dashboard_pipe` | `dashboard_pipe_path` | header row |
| `architecture.tasklist` | `tasklist_path` | header row |
| `architecture.lanes[i]` | one row each, `layer=fabric-revolver-lane`, `lane_name=<value>`, `lane_index=<i>` | inner row |
| `substrate.registry_ok` | `registry_ok=1` | header row |
| `substrate.registry_generated_at` | `registry_generated_at_iso` | header row |
| `substrate.registry_surfaces` | `registry_surfaces=24` | header row |
| `substrate.registry_live_or_observed` | `registry_live_or_observed=21` | header row |
| `counts.{tasks,logical_nodes_covered,genius_mints,mistake_mints}` | `count_tasks`, `count_logical_nodes_covered`, `count_genius_mints`, `count_mistake_mints` | header row |
| `dispatch_modes[i]` | one row each, `layer=fabric-revolver-dispatch-mode`, `dispatch_mode=<value>` | inner row |
| `next_actions[i]` | one row each, `layer=fabric-revolver-next-action`, `next_action=<value>` (URL-encode pipes) | inner row |
| `status` (header) | `status=PUBLIC_DESCRIPTOR` | constant |
| `status` (lane / dispatch / action rows) | `status=SPINDLE_DESCRIBED` | constant |

### 1.3 `chamber-receipts.ndjson` -> `chamber-receipts.hbp`

One HBPv1 row per NDJSON record. `event` field discriminates five row variants but all share one chain.

| JSON field | HBPv1 field | Notes |
|---|---|---|
| `id` | `record_id` | reuse verbatim |
| `ts` | `ts_iso` | |
| `event` | `event_name` | one of `load_dry`, `load_execute`, `collect`, `collect_execute`, `eject` |
| `chamber` | `chamber_index` | 0..7 |
| `chamber_pid` | `pid` | direct reuse |
| `model` | `model_name` | |
| `task_id` | `task_id` | |
| `surface_id` | `surface_id` | |
| `objective_id` | `objective_id` | |
| `omnispindle` | `omnispindle` | `spindle-1`..`spindle-8` |
| `omniflywheel` | `omniflywheel` | `flywheel-1` |
| `proof_sha16` | `proof_sha16` | |
| `execute` | `execute_flag=0\|1` | mirror of `polar_quant`; informational only |
| `materialization` | `materialization=range_packet_not_process_per_node` | constant in practice |
| `logical_node_range.{start,end,count}` | `range_start`, `range_end`, `range_count` | |
| `layer` | `layer=fabric-revolver-receipt-<event_name>` | derived from `event` |
| `prof` | `prof=chamber-receipt` | constant |
| `tuple` | `tuple=<event>:<chamber>:<task_id>` | synthesized |
| `status` | per section 3 | depends on `event` |
| `chain_id` | `ACER-FABRIC-RECEIPT-v1` | per section 2 |

### 1.4 `tasklist-latest.ndjson` -> `tasklist-latest.hbp`

One row per task. Fields denser than receipts; `route[]`, `gates[]`, `gulp{}` are nested.

| JSON field | HBPv1 field | Notes |
|---|---|---|
| `id` | `record_id` | `frw-NNNN-<16hex>` |
| `ts` | `ts_iso` | |
| `status` | `status` | per section 3 |
| `shellless` | `shellless=1` | constant in practice |
| `fabric` | `fabric=BEHCS-1024` | constant in practice |
| `active_slot` | `active_slot` | |
| `revolver_chamber` | `chamber_index` | |
| `lane` | `lane_name` | one of the 12 lanes |
| `omnispindle` | `omnispindle` | |
| `omniflywheel` | `omniflywheel` | |
| `objective_id` | `objective_id` | |
| `objective` | `objective_text` | URL-encode pipes; this is human prose |
| `surface_id` | `surface_id` | |
| `surface_node` | `surface_node` | |
| `surface_layer` | `surface_layer` | |
| `surface_kind` | `surface_kind` | |
| `logical_node_range.{start,end,count}` | `range_start`, `range_end`, `range_count` | |
| `materialization` | `materialization` | |
| `route[]` | `route=surface_registry,hookwall,forward_gnn,reverse_gain_gnn,omnishannon,white_room,gc` | comma-joined |
| `gates[]` | `gates=LAW-001+bus+live,dashboard+feed+writeable,...` | comma-joined; spaces -> `+` |
| `gulp.gulp_2000_bucket` | `gulp_2000_bucket` | |
| `gulp.super_gulp_5000_bucket` | `gulp_5000_bucket` | |
| `proof_sha16` | `proof_sha16` | |
| `layer` | `layer=fabric-revolver-task` | constant |
| `prof` | `prof=range-packet-task` | constant |
| `pid` | `pid=ACER-FABRIC-TASK-PID-<8hex(proof_sha16)>` | synthesized descriptor PID |
| `tuple` | `tuple=range:<range_start>-<range_end>:<lane_name>` | synthesized |
| `chain_id` | `ACER-FABRIC-TASK-v1` | per section 2 |

### 1.5 `waves-latest.ndjson` -> `waves-latest.hbp`

Currently a single architecture-summary row. Treat as a wave-descriptor packet so the SPEC v0.3 spindle-wave grammar applies.

| JSON field | HBPv1 field | Notes |
|---|---|---|
| `ok` | `ok=1` | |
| `id` | `wave_id` | `behcs1024-fabric-revolver-<16hex>` |
| `generated_at` | `generated_at_iso` | |
| `architecture.name` | `arch_name` | |
| `architecture.viability_rule` | `viability_rule` | URL-encode |
| `architecture.shellless_backend_nodes` | `shellless=1` | |
| `architecture.process_per_node` | `process_per_node=0` | |
| `architecture.active_slots` | `active_slots=36` | |
| `architecture.logical_nodes_declared` | `logical_nodes_declared=1000000` | |
| `architecture.lanes[]` | `lanes=deepseek_v4_tui,codex_acer,...` | comma-joined |
| `architecture.gulp_thresholds[]` | `gulp_thresholds=2000,5000` | |
| `architecture.dashboard_pipe` | `dashboard_pipe_path` | |
| `architecture.tasklist` | `tasklist_path` | |
| `substrate.registry_ok` | `registry_ok=1` | |
| `substrate.registry_generated_at` | `registry_generated_at_iso` | |
| `substrate.registry_surfaces` | `registry_surfaces` | |
| `substrate.registry_live_or_observed` | `registry_live_or_observed` | |
| `counts.{tasks,logical_nodes_covered,genius_mints,mistake_mints}` | `count_tasks`, `count_logical_nodes_covered`, `count_genius_mints`, `count_mistake_mints` | |
| `dispatch_modes[]` | `dispatch_modes=dashboard_visible,law001_bus_receipt,...` | comma-joined |
| `next_actions[]` | `next_actions=Mount+dashboard+feed...,Mirror+dashboard+feed...,...` | comma-joined; spaces -> `+`; pipes URL-encoded |
| `layer` | `layer=fabric-revolver-wave` | constant |
| `prof` | `prof=behcs1024-fabric-wave-descriptor` | constant |
| `pid` | `pid=ACER-FABRIC-WAVE-PID-<8hex(wave_id tail)>` | synthesized |
| `tuple` | `tuple=wave:spindle-1:<count_tasks>` | synthesized |
| `spindle_id` | `spindle-1` | wave-grammar required; placeholder until real assignment |
| `agent_slot` | `main` | wave-grammar required |
| `status` | `WAVE_DESCRIBED` | per section 3 |
| `chain_id` | `ACER-FABRIC-WAVE-v1` | per section 2 |

### 1.6 `genius-mistake-mints-latest.ndjson` -> `genius-mistake-mints-latest.hbp`

One row per mint. Two `kind` variants (`genius_mint`, `mistake_mint`); both share one chain.

| JSON field | HBPv1 field | Notes |
|---|---|---|
| `id` | `record_id` | `genius-<obj>-<16hex>` or `mistake-<obj>-<16hex>` |
| `ts` | `ts_iso` | |
| `kind` | `kind` | `genius_mint` or `mistake_mint` |
| `objective_id` | `objective_id` | |
| `summary` | `summary_text` | URL-encode pipes |
| `proof_sha16` | `proof_sha16` | |
| `layer` | `layer=fabric-revolver-mint-<kind>` | derived from `kind` |
| `prof` | `prof=white-room-mint` | constant |
| `pid` | `pid=ACER-FABRIC-MINT-PID-<8hex(proof_sha16)>` | synthesized |
| `tuple` | `tuple=<objective_id>:<proof_sha16>:<kind>` | synthesized |
| `status` | `WAVE_RECEIPTED` (per section 3, mints are post-review) | constant |
| `chain_id` | `ACER-FABRIC-MINT-v1` | per section 2 |

`completed-tasks.ndjson` follows the receipt template (1.3) extended with three terminal status values (`complete`, `deferred_external_tui`, `execute_failed`) mapped per section 3; reuse `chain_id=ACER-FABRIC-RECEIPT-v1` since it is structurally a receipt subset (`{ts, task_id, chamber, status, receipt_id}`). One row per record. No new tail fields beyond `terminal_status=<value>`.

---

## 2. Chain ID assignment

One chain per category. Sequence is monotonic within chain; `prev_hash` chains rows in append order (ROOT for sequence 0).

| Source file | `chain_id` | Notes |
|---|---|---|
| `chambers-latest.json` (header + 8 chamber rows) | `ACER-FABRIC-CHAMBER-v1` | Re-emit full snapshot per cycle; chain re-rooted on cycle restart only. |
| `state-latest.json` (header + lane + dispatch + action rows) | `ACER-FABRIC-STATE-v1` | One chain even across the three sub-row classes; sequence advances row by row. |
| `chamber-receipts.ndjson` + `completed-tasks.ndjson` | `ACER-FABRIC-RECEIPT-v1` | One chain across all 5 receipt events and 3 terminal completed-task statuses; append-only. |
| `tasklist-latest.ndjson` | `ACER-FABRIC-TASK-v1` | Append-only across `queue_ready` / `duplicate_suppressed`. |
| `waves-latest.ndjson` | `ACER-FABRIC-WAVE-v1` | Wave-descriptor chain per SPEC v0.3. |
| `genius-mistake-mints-latest.ndjson` | `ACER-FABRIC-MINT-v1` | One chain, both `genius_mint` and `mistake_mint` share it. |

Chain IDs are local to fabric-revolver; they do NOT collide with `ACER-REVOLVER-*-v1` IDs reserved by `packages/revolver-10k` (which use the `REVOLVER` infix, not `FABRIC`). Verifier MUST reject cross-chain `prev_hash` references.

---

## 3. Status enum mapping

Fabric-revolver native states `EMPTY / LOAD / RUNNING / COLLECT / EJECT` (chamber cycle), receipt events `load_dry / load_execute / collect / collect_execute / eject`, task statuses `queue_ready / duplicate_suppressed`, completed-task terminals `complete / deferred_external_tui / execute_failed` map onto Hermes `WAVE_DESCRIPTOR_STATUSES` (the 8 values from `SPEC.md:154-157`).

| Fabric-revolver native | Hermes `status=` | Rationale |
|---|---|---|
| `EMPTY` (chamber cycle) | `WAVE_DESCRIBED` | Slot exists, nothing assigned. |
| `LOAD` (chamber cycle) | `SPINDLE_MAIN_ASSIGNED` | Chamber bound to a model + task but not yet running. |
| `RUNNING` (chamber cycle) | `SPINDLE_SUBAGENT_ASSIGNED` | Active execution; subagent-equivalent occupies the slot. |
| `COLLECT` (chamber cycle) | `SPINDLE_REVIEW_REQUESTED` | Output gathered, awaiting white-room review / GC. |
| `EJECT` (chamber cycle) | `SPINDLE_REVIEWED` | Reviewed and cleared, returning toward EMPTY. |
| `load_dry` (receipt event) | `SPINDLE_DESCRIBED` | Dry assign, descriptor only, no execution. |
| `load_execute` (receipt event) | `SPINDLE_MAIN_ASSIGNED` | Execution intent recorded; mirrors chamber `LOAD`. |
| `collect` (receipt event) | `SPINDLE_REVIEW_REQUESTED` | Mirrors chamber `COLLECT`. |
| `collect_execute` (receipt event) | `SPINDLE_REVIEW_REQUESTED` | Same review-pending state, distinguished by `event_name`. |
| `eject` (receipt event) | `SPINDLE_REVIEWED` | Mirrors chamber `EJECT`. |
| `queue_ready` (task) | `WAVE_DESCRIBED` | Task described, awaiting any chamber. |
| `duplicate_suppressed` (task) | `WAVE_BLOCKED` | Refused; duplicate of an existing wave. |
| `complete` (completed-task) | `WAVE_RECEIPTED` | Final, with receipt id. |
| `deferred_external_tui` (completed-task) | `WAVE_BLOCKED` | Deferred to external TUI; no Hermes-side receipt. |
| `execute_failed` (completed-task) | `WAVE_BLOCKED` | Failure terminal; receipt id may exist but execution did not complete. |
| (mint rows, both kinds) | `WAVE_RECEIPTED` | Mints are post-review by definition. |
| (state-latest header) | `WAVE_DESCRIBED` | Snapshot descriptor. |
| (state-latest lane / dispatch / next-action rows) | `SPINDLE_DESCRIBED` | Sub-descriptors. |
| (waves-latest header) | `WAVE_DESCRIBED` | Architecture-summary wave. |

Note that `SPINDLE_REVIEW_REQUESTED` is reused for both `collect` and `collect_execute`; the discriminator is the `event_name` field, not `status`. Verifier MUST NOT treat status alone as event identity.

---

## 4. Migration order (safest -> riskiest)

Files migrated bottom-up by chain-fragility. Each step emits the new `.hbp` + `.hbi` + `.sha256` + `.hex` while leaving the JSON / NDJSON in place (see section 5). No file is deleted in this plan.

1. **`genius-mistake-mints-latest.ndjson`** — flat, 24 rows, no nested arrays, no cross-file references. Safest. Mints chain (`ACER-FABRIC-MINT-v1`) has zero downstream consumers in the current codebase, so any error is contained.
2. **`waves-latest.ndjson`** — exactly 1 row currently; trivial to round-trip and verify. Drives `ACER-FABRIC-WAVE-v1` chain initialization.
3. **`tasklist-latest.ndjson`** — 91 rows, well-shaped, no `last_error` blobs; `route[]` / `gates[]` arrays are the only complexity (handled by comma-join + space-to-`+` rule).
4. **`completed-tasks.ndjson`** — 107 rows, simplest receipt subset; lets the `ACER-FABRIC-RECEIPT-v1` chain warm up before the full receipts file.
5. **`chamber-receipts.ndjson`** — 340 rows, five event variants, shares `ACER-FABRIC-RECEIPT-v1` with completed-tasks. Verifier MUST validate the merged chain is monotonic across both source files (use timestamp tiebreaker on equal `ts`).
6. **`state-latest.json`** — 1 header + 12 + 5 + 5 = 23 rows; nested arrays + prose strings (`viability_rule`, `next_actions`) need URL-encoding discipline.
7. **`chambers-latest.json`** — last, because it is the cycle-state-of-record and any chain corruption here would mis-describe live chamber states to dashboards. Re-emit full 9-row snapshot on every revolver tick once cutover (section 5) completes.

The `_sandbox/` directory is out of scope.

---

## 5. Backward compatibility and cutover

Operate in dual-emit mode for one full revolver cycle (one full `EMPTY -> LOAD -> RUNNING -> COLLECT -> EJECT -> EMPTY` traversal across all 8 chambers) before cutover.

Phase A — dual-emit (one cycle):

- Emitter writes BOTH `<file>.json|ndjson` (existing path, unchanged) AND `<file>.hbp` + `<file>.hbi` + `<file>.sha256` + `<file>.hex` (new path) on every tick.
- Dashboards continue reading the JSON path (no consumer change required this phase).
- Verifier subagent runs after each tick: re-derives the JSON projection from the `.hbp` rows and diffs against the JSON file. Any non-empty diff fails the tick and the `.hbp` set for that tick is discarded.
- Chain monotonicity check (`sequence` strictly +1, `prev_hash` matches prior `row_hash`, `row_hash` recomputable) is mandatory at end of every tick.
- Cosign row is appended to the federation cosign chain at end of phase A summarizing the cycle outcome.

Phase B — primary-flip (one further cycle):

- Dashboards re-pointed to `.hbp` as primary. JSON path continues to be written but marked `cold_provenance=1` in any metadata sidecar.
- All consumers (dashboard at `:4949`, dashboard-feeds mirror, liris bilateral mirror at `:4944`) read `.hbp` only. JSON is read-back only on emitter-side for the diff check.

Phase C — cutover:

- Emitter stops writing JSON for receipts / tasks / waves / mints (the append-only NDJSON files). The current JSON is renamed `<file>.json.frozen-<ISO>` and preserved in place as cold provenance.
- `chambers-latest.json` and `state-latest.json` remain dual-written one extra cycle (these are snapshot files, not append-only) before they too freeze and the canonical sources become `chambers-latest.hbp` and `state-latest.hbp`.
- Cutover is authorized by the quintuple-auth chain in effect (see MEMORY index: `project_quintuple_auth_fabric_decide_window_*`). Quintuple-auth must explicitly sign the cutover row; this plan does NOT pre-authorize it.

Rollback: at any point in phases A or B, removing the `.hbp/.hbi/.sha256/.hex` files restores pure JSON operation with zero data loss.

---

## 6. What CANNOT migrate cleanly

The following fabric-revolver fields have no clean Hermes target and require a flagged decision before phase C.

- **`architecture.viability_rule` (state-latest, waves-latest)** — long English prose with no canonical encoding. Stored as `viability_rule=<URL-encoded>` but Hermes verifiers do not currently validate prose length; risk of row-length blowup on systems that enforce a row-byte ceiling. Recommendation: cap at 512 chars and overflow to a sidecar pointer field `viability_rule_sidecar=<filename>`.
- **`next_actions[]` (state-latest, waves-latest)** — also human prose. Same problem as `viability_rule`. Same recommendation.
- **`objective` (tasklist) free-text** — one full English sentence per task. 91 sentences will materially inflate the `.hbp` byte size. Recommendation: hash-and-sidecar — replace with `objective_sha16=<hex16>` in the row and write the prose to `tasklist-objectives.txt` keyed by sha16. Loses inline readability but bounds row size.
- **`logical_node_range.count` redundancy** — derivable from `end - start + 1`. Hermes has no field-derivation convention; keep both as `range_start`, `range_end`, `range_count` and accept the redundancy.
- **`gulp.gulp_2000_bucket` / `gulp.super_gulp_5000_bucket`** — these are running counters that change every tick. The `chain_id=ACER-FABRIC-TASK-v1` chain expects append-only semantics, but a task row with a changing counter implies in-place mutation. Recommendation: emit a NEW task row on every counter change (append-only) and treat the latest sequence per `record_id` as authoritative; verifier MUST honor latest-sequence-wins for task counter reads. This is a semantic shift consumers must be told about.
- **`models[]` and `task_types[]` (chambers-latest header)** — string arrays. Comma-joined into a single field works only because no value contains a comma; verifier MUST reject if any model name or task type ever contains a literal comma. Add an emit-time assert.
- **`execute_default=false` (chambers-latest)** — semantically authority-relevant (it gates the chamber `execute` flag). Hermes already has `runtime=0` / `promote=0` defaults; mapping `execute_default` to a closed authority field would falsely imply revolver-10k-style authority extension. Keep as descriptor field `execute_default=0` and document in the consumer guide that fabric-revolver is descriptor-only regardless of this value.
- **`omnispindle` / `omniflywheel` role names** — these are glyph roles per `project_named_agents_are_glyph_roles_not_daemons.md`, not real PIDs. They survive as `omnispindle=spindle-N` / `omniflywheel=flywheel-N` string fields but Hermes verifiers MUST NOT treat them as PID-shaped tokens (no `BH.*` / `ACER-*` prefix). Add a verifier exception for these two field names.
- **`receipt_id` (completed-tasks)** is `revolver-eject-<16hex>`; it does NOT follow Hermes PID grammar. Carry verbatim as `receipt_id=<value>`; do not promote to a `pid` field.
- **`_sandbox/` directory** — out of scope. Contains experimental files; document as excluded and leave untouched.

---

**End of plan.** Six file kinds mapped, six tables in section 1, one chain-ID per category in section 2, one status-mapping table in section 3, seven-step migration order in section 4, three-phase cutover in section 5, nine non-migrating items called out in section 6.
