# Hermes HBPv1 Migration Plan — `packages/revolver-10k`

**Spindle:** Civilization Spindle 1 — Architect (main).
**Source discipline:** BPI text frames (`<TAG>|v1|v2|...|sha8`) emitted by `src/bpi-codec.mjs::encodeFrame`.
**Target discipline:** HyperBEHCS Hermes HBPv1 rows + `.hbi`/`.sha256`/`.hex` sidecars + append-only chain + 32 authority fields default-closed (per `D:/hyperbehcs-hermes/SPEC.md` and `hyperbehcs_hermes/{packet,chain,authority}.py`).

**Scope of this document:** mapping only. NO code edits in this pass. The migrator + verifier subagents (Spindle 1, subagents 1–3) consume this verbatim.

---

## 0. Global rules (apply to every row template in §1)

Every emitted `.hbp` row MUST contain, in order:

1. The 13 **REQUIRED_FIELDS** from `packet.py:8-22`:
   `layer`, `pid`, `prof`, `supervisor`, `tuple`, `triple_quant`, `polar_quant`, `js_quant`, `turbo_quant`, `json`, `runtime`, `promote`, `status`.
2. The 4 **chain fields** from `chain.py:38-72`:
   `chain_id`, `sequence`, `prev_hash`, `row_hash`.
3. The **32 AUTHORITY_FIELDS** from `authority.py:62` (= LEGACY_CLOSED_FIELDS ∪ EXECUTION_FIELDS, deduped):
   `json, runtime, promote, endpoint, provider, mcp, usb_write, device_write,` `dispatch, route, shell, terminal, file_write, memory_write, tool_execute, skill_execute, mcp_execute, webmcp_execute, provider_call, endpoint_open, browser_control, keyboard_control, screenshot_capture, network_call, webhook_open, cron_create, device_read, usb_read, private_surface_export, hidden_surface_export, restricted_surface_export, secret_surface_export, repo_publish, package_release`.
   All default `=0` for revolver-10k emits (revolver-10k is descriptor-only; hookwall is the only authority gate, and it MUST always emit `=0` for everything except the request frame's promotion-receipt fields).
4. The 7 **DESCRIBE_ONLY_FIELDS** from `authority.py:64-72` (`memory_read, skill_read, tool_describe, mcp_describe, webmcp_describe, provider_describe, browser_observe`) default `=1` because revolver-10k is a public descriptor surface.

Quant-tag fixed strings (revolver-10k canon):
- `triple_quant=room/port/elapsed` (or `wave/spindle/receipt` for wave rows in §1.16)
- `polar_quant=describe/execute`
- `js_quant=johnson-slithechen-public`
- `turbo_quant=packet-first`

Field count: **13 required + 4 chain + 32 authority + 7 describe = 56 base fields** plus any row-specific tail fields (see each template).

`pid` format: reuse existing chamber/room/plane PIDs (`ACER-REVOLVER-CHAMBER-NNNN-<6glyph>`, `BH.PLANE.<ENT>.<12hex>`, `BH.ROOM.NNNNN.<12hex>`). DO NOT mint new PID shapes.

`row_hash`: per `chain.py:24` = `sha256(canonical_row_text(row) + "\n")` where `canonical_row_text` is the row without the `row_hash=` field. Emitter must compute over its own fields-in-order excluding `row_hash`, then append `row_hash=<hex>` last.

---

## 1. Acer → Hermes field map (15 BPI tags → 15 HBPv1 row templates)

Each subsection: **current BPI fields** (positional) → **HBPv1 row template** (named). Origin file + line for source-truth.

### 1.1 `FAOR` — Free Agent Output Result
**Source:** `src/intake.mjs:97` (bus path) and `src/intake.mjs:117` (cold-log path); also `src/bpi-codec.mjs:142` (selfTest).

**Current BPI fields (omniquant path, intake.mjs:74-83):**
`FAOR | provider | port_port | project_name | job_id | ok | qbytes_hex | qt_tag | sha8`

**Current BPI fields (legacy path, intake.mjs:85-95):**
`FAOR | provider | room_id | port_port | project_name | job_id | ok | elapsed_ms | rowId | stdout_len | sha8`

**Current BPI fields (cold-log path, intake.mjs:117-129):**
`FAOR | provider | room_id | port_port | project_name | job_id | ok | elapsed_ms | rowId | stdout_len | ts_ms | pid_anchor | sha8`

**HBPv1 row template:**
```
HBPv1|layer=revolver-intake|pid=ACER-REVOLVER-CHAMBER-<NNNN>-<6glyph>|prof=free-agent-output-result|supervisor=fail-closed-public|tuple=<port_outer>.<port_inner>:<room_id>:<job_id>|triple_quant=room/port/elapsed|polar_quant=describe/execute|js_quant=johnson-slithechen-public|turbo_quant=packet-first|json=0|runtime=0|promote=0|status=PUBLIC_DESCRIPTOR|chain_id=ACER-REVOLVER-INTAKE-v1|sequence=<n>|prev_hash=<hex|ROOT>|provider_name=<provider>|project_name=<project_name>|room_id=<n>|port_port=<port_port>|ok=<0|1>|elapsed_ms=<ms>|row_id=<rowId>|stdout_len=<len>|ts_ms=<epoch_ms>|pid_anchor=<pid_or_empty>|qbytes_hex=<hex_or_empty>|qt_tag=<tag_or_empty>|<32 authority=0>|<7 describe=1>|row_hash=<hex>
```

Notes:
- `provider_name` not `provider` to avoid colliding with the closed-default `provider` authority field. Same for `endpoint_name`, `mcp_name` elsewhere — see §5.
- `stdout` body never enters the row; the existing companion-file path (`intake.mjs:43-45`, `stdout/<rowid>.txt`) is preserved verbatim.

---

### 1.2 `PIDCX` — PID Context (per-room marker file)
**Source:** `src/revolver.mjs:40-50` (writes `PID_CONTEXT.bpi` into each spawned room dir).

**Current BPI fields:** `PIDCX | chamber_pid | room_id | project_name | port_port | provider | job_id | pid_anchor | ts_ms | sha8`

**HBPv1 row template:**
```
HBPv1|layer=revolver-pid-context|pid=<chamber_pid>|prof=room-pid-context|supervisor=fail-closed-public|tuple=<port_outer>.<port_inner>:<room_id>:<job_id>|triple_quant=room/port/elapsed|polar_quant=describe/execute|js_quant=johnson-slithechen-public|turbo_quant=packet-first|json=0|runtime=0|promote=0|status=AUTHORITY_DESCRIBED|chain_id=ACER-REVOLVER-PIDCTX-v1|sequence=<n>|prev_hash=<hex|ROOT>|chamber_pid=<pid>|room_id=<n>|project_name=<name>|port_port=<port_port>|provider_name=<provider>|job_id=<rev-XXX>|pid_anchor=<pid_or_empty>|ts_ms=<epoch_ms>|<32 authority=0>|<7 describe=1>|row_hash=<hex>
```

File: continue writing to `<room>/PID_CONTEXT.bpi` but contents become the HBPv1 row (single line, no JSON). Filename SHOULD migrate to `PID_CONTEXT.hbp` at refactor time (see §4, step 2).

---

### 1.3 `HBI` — HyperBEHCS Ingest
**Source:** `src/planes/hyperbehcs.mjs:40`.

**Current BPI fields:** `HBI | room_id | brown_hilbert_pid | lane | rotation_epoch | fingerprint | sha8`

**Name collision risk:** Hermes already defines `HBIv1` as the sidecar index grammar (`SPEC.md:43-51`, `indexer.py:7-25`). The acer `HBI` tag must NOT survive into HBPv1 with that name. **Rename in target: `room-ingest`.**

**HBPv1 row template:**
```
HBPv1|layer=room-ingest|pid=<brown_hilbert_pid>|prof=hyperbehcs-room-descriptor|supervisor=fail-closed-public|tuple=<lane>:<room_id>:<rotation_epoch>|triple_quant=room/port/elapsed|polar_quant=describe/execute|js_quant=johnson-slithechen-public|turbo_quant=packet-first|json=0|runtime=0|promote=0|status=PUBLIC_DESCRIPTOR|chain_id=ACER-REVOLVER-ROOM-INGEST-v1|sequence=<n>|prev_hash=<hex|ROOT>|room_id=<n>|brown_hilbert_pid=<pid>|lane=<lane>|rotation_epoch=<n>|fingerprint=<hex>|<32 authority=0>|<7 describe=1>|row_hash=<hex>
```

---

### 1.4 `CRZ` — Carry-Z
**Source:** `src/planes/carry_z.mjs:57`.

**Current BPI fields:** `CRZ | room_id | payload_sha16 | ts_ms | sha8`

**HBPv1 row template:**
```
HBPv1|layer=carry-z|pid=<binding_pid>|prof=carry-state|supervisor=fail-closed-public|tuple=carry_z:<slot_id>:<room_id>|triple_quant=room/port/elapsed|polar_quant=describe/execute|js_quant=johnson-slithechen-public|turbo_quant=packet-first|json=0|runtime=0|promote=0|status=CHAIN_LINK|chain_id=ACER-REVOLVER-CARRY-Z-v1|sequence=<n>|prev_hash=<hex|ROOT>|room_id=<n>|payload_sha16=<hex16>|slot_id=<slot>|ts_ms=<epoch_ms>|<32 authority=0>|<7 describe=1>|row_hash=<hex>
```

`binding_pid` from `_bindingCache.get(roomId).binding_pid` (`carry_z.mjs:36-45`).

---

### 1.5 `HRM` — Hierarchical Reasoning (descriptor-only stub)
**Source:** `src/planes/hrm.mjs:32`.

**Current BPI fields:** `HRM | prompt_sha16 | model | high_level_steps | low_level_steps | descriptor_only | sha8`

**HBPv1 row template:**
```
HBPv1|layer=hrm-bridge|pid=BH.PLANE.HRM.<12hex>|prof=hierarchical-reasoning-stub|supervisor=fail-closed-public|tuple=hrm:<model>:<prompt_sha16>|triple_quant=room/port/elapsed|polar_quant=describe/execute|js_quant=johnson-slithechen-public|turbo_quant=packet-first|json=0|runtime=0|promote=0|status=PUBLIC_DESCRIPTOR|chain_id=ACER-REVOLVER-HRM-v1|sequence=<n>|prev_hash=<hex|ROOT>|prompt_sha16=<hex16>|model_name=<gemma-4b-hrm-mtp|...>|high_level_steps=0|low_level_steps=0|hrm_mode=descriptor_only|<32 authority=0>|<7 describe=1>|row_hash=<hex>
```

The literal string `descriptor_only` becomes the field `hrm_mode=descriptor_only`. Until the Python-side runtime adapter lands, `provider_call=0` MUST remain closed.

---

### 1.6 `GLP` — Gulp ingest
**Source:** `src/planes/gulp.mjs:23`.

**Current BPI fields:** `GLP | room_id | payload_sha16 | window_size | sha8`

**HBPv1 row template:**
```
HBPv1|layer=gulp|pid=BH.PLANE.GULP.<12hex>|prof=intake-ring-buffer|supervisor=fail-closed-public|tuple=gulp:<room_id>:<window_size>|triple_quant=room/port/elapsed|polar_quant=describe/execute|js_quant=johnson-slithechen-public|turbo_quant=packet-first|json=0|runtime=0|promote=0|status=CHAIN_LINK|chain_id=ACER-REVOLVER-GULP-v1|sequence=<n>|prev_hash=<hex|ROOT>|room_id=<n>|payload_sha16=<hex16>|window_size=<n>|max_per_room=64|<32 authority=0>|<7 describe=1>|row_hash=<hex>
```

---

### 1.7 `SGP` / `SGF` — Super-gulp ingest + flush
**Source:** `src/planes/super_gulp.mjs:22,34`.

**Current BPI fields:**
- `SGP | room_id | payload_sha16 | window_size | sha8`
- `SGF | flush_count | record_count | batch_sha16 | ts_ms | sha8`

**HBPv1 row templates:**
```
HBPv1|layer=super-gulp-ingest|pid=BH.PLANE.SUPERGULP.<12hex>|prof=bulk-intake-ingest|supervisor=fail-closed-public|tuple=sgp:<room_id>:<window_size>|...|chain_id=ACER-REVOLVER-SUPERGULP-v1|sequence=<n>|prev_hash=<hex>|room_id=<n>|payload_sha16=<hex16>|window_size=<n>|max_window=2000|<32 authority=0>|<7 describe=1>|row_hash=<hex>
```
```
HBPv1|layer=super-gulp-flush|pid=BH.PLANE.SUPERGULP.<12hex>|prof=bulk-intake-flush|supervisor=fail-closed-public|tuple=sgf:<flush_count>:<record_count>|...|chain_id=ACER-REVOLVER-SUPERGULP-v1|sequence=<n>|prev_hash=<hex>|flush_count=<n>|record_count=<n>|batch_sha16=<hex16>|ts_ms=<epoch_ms>|<32 authority=0>|<7 describe=1>|row_hash=<hex>
```
Both SGP and SGF share `chain_id=ACER-REVOLVER-SUPERGULP-v1` (one chain per plane).

---

### 1.8 `GNN` — GNN feed
**Source:** `src/planes/gnn.mjs:26`.

**Current BPI fields:** `GNN | room_id | packed_bytes_hex | qt_tag | sha8`

**HBPv1 row template:**
```
HBPv1|layer=gnn-feed|pid=BH.PLANE.GNN.<12hex>|prof=graph-feature-projection|supervisor=fail-closed-public|tuple=gnn:<room_id>:<qt_tag>|triple_quant=room/port/elapsed|polar_quant=describe/execute|js_quant=johnson-slithechen-public|turbo_quant=packet-first|json=0|runtime=0|promote=0|status=CHAIN_LINK|chain_id=ACER-REVOLVER-GNN-v1|sequence=<n>|prev_hash=<hex|ROOT>|room_id=<n>|qbytes_hex=<hex>|qt_tag=<tag>|<32 authority=0>|<7 describe=1>|row_hash=<hex>
```

---

### 1.9 `GCR` / `GCS` — GC room + sweep
**Source:** `src/planes/gc.mjs:17,32`.

**Current BPI fields:**
- `GCR | room_id | ts_ms | sha8`
- `GCS | swept | active | now_ms | sha8`

**HBPv1 row templates:**
```
HBPv1|layer=gc-room|pid=BH.PLANE.GC.<12hex>|prof=post-chain-gc-room|supervisor=fail-closed-public|tuple=gcr:<room_id>:<ts_ms>|...|chain_id=ACER-REVOLVER-GC-v1|sequence=<n>|prev_hash=<hex>|room_id=<n>|ts_ms=<epoch_ms>|<32 authority=0>|<7 describe=1>|row_hash=<hex>
```
```
HBPv1|layer=gc-sweep|pid=BH.PLANE.GC.<12hex>|prof=post-chain-gc-sweep|supervisor=fail-closed-public|tuple=gcs:<swept>:<active>|...|chain_id=ACER-REVOLVER-GC-v1|sequence=<n>|prev_hash=<hex>|swept_count=<n>|active_rooms=<n>|ts_ms=<epoch_ms>|<32 authority=0>|<7 describe=1>|row_hash=<hex>
```

---

### 1.10 `HKW` / `HKG` — Hookwall request / grant
**Source:** `src/planes/hookwall.mjs:19,37`.

**Current BPI fields:**
- `HKW | room_id | intent_sha16 | 0 | default_deny_quintuple_required | sha8`
- `HKG | room_id | intent_sha16 | 1 | signer_count | sha8`

**HBPv1 row templates (these are the ONE place authority opens — promotion-receipt fields per `SPEC.md:111-121`):**
```
HBPv1|layer=hookwall-request|pid=BH.PLANE.HOOKWALL.<12hex>|prof=authority-gate-request|supervisor=fail-closed-public|tuple=hkw:<room_id>:<intent_sha16>|...|chain_id=ACER-REVOLVER-HOOKWALL-v1|sequence=<n>|prev_hash=<hex>|room_id=<n>|intent_sha16=<hex16>|granted=0|denial_reason=default_deny_quintuple_required|<32 authority=0>|<7 describe=1>|status=PROMOTION_REQUESTED|promotion_target=<intent_sha16>|promotion_field=<TBD-OPERATOR>|promotion_scope=room:<n>|promotion_expires=<TBD-OPERATOR>|promotion_revoked=0|row_hash=<hex>
```
```
HBPv1|layer=hookwall-grant|pid=BH.PLANE.HOOKWALL.<12hex>|prof=authority-gate-grant|supervisor=fail-closed-public|tuple=hkg:<room_id>:<intent_sha16>|...|chain_id=ACER-REVOLVER-HOOKWALL-v1|sequence=<n>|prev_hash=<hex>|room_id=<n>|intent_sha16=<hex16>|granted=1|signer_count=<n>|<32 authority=0>|<7 describe=1>|status=PROMOTION_APPROVED|promotion_target=<intent_sha16>|promotion_field=<TBD-OPERATOR>|promotion_scope=room:<n>|promotion_expires=<TBD-OPERATOR>|promotion_revoked=0|row_hash=<hex>
```

**Important:** even on grant, the 32 authority fields stay `=0` in this row. The grant row IS the promotion-receipt; per `SPEC.md:124-128` and `promotion.py`, downstream rows that want to flip e.g. `provider_call=1` must reference this row's `row_hash` via their `prev_hash` in a separate `ACER-REVOLVER-HOOKWALL-v1` chain link. Revolver-10k itself never flips authority fields; only operators with quintuple-auth do.

`promotion_field` and `promotion_expires` are **TBD-OPERATOR** — the current `hookwall.mjs` doesn't carry these; operators must decide whether to require them at request-time or grant-time.

---

### 1.11 `TPL` — Tuple route
**Source:** `src/planes/tuple.mjs:26`.

**Current BPI fields:** `TPL | outer | inner | slot | payload_sha16 | sha8`

**HBPv1 row template:**
```
HBPv1|layer=tuple-route|pid=BH.PLANE.TUPLE.<12hex>|prof=port-port-routing|supervisor=fail-closed-public|tuple=<outer>.<inner>:<slot>|triple_quant=room/port/elapsed|polar_quant=describe/execute|js_quant=johnson-slithechen-public|turbo_quant=packet-first|json=0|runtime=0|promote=0|status=PUBLIC_DESCRIPTOR|chain_id=ACER-REVOLVER-TUPLE-v1|sequence=<n>|prev_hash=<hex|ROOT>|port_outer=<n>|port_inner=<n>|pool_slot=<n>|payload_sha16=<hex16>|<32 authority=0>|<7 describe=1>|row_hash=<hex>
```

---

### 1.12 `CRP` — Crypto receipt
**Source:** `src/planes/crypto.mjs:17`.

**Current BPI fields:** `CRP | sha16 | sha32 | signer | ts_ms | sha8`

**HBPv1 row template:**
```
HBPv1|layer=receipt-crypto|pid=BH.PLANE.CRYPTO.<12hex>|prof=receipt-signature|supervisor=fail-closed-public|tuple=crp:<signer>:<sha16>|triple_quant=room/port/elapsed|polar_quant=describe/execute|js_quant=johnson-slithechen-public|turbo_quant=packet-first|json=0|runtime=0|promote=0|status=CHAIN_LINK|chain_id=ACER-REVOLVER-CRYPTO-v1|sequence=<n>|prev_hash=<hex|ROOT>|payload_sha16=<hex16>|payload_sha32=<hex32>|signer_name=<signer>|ts_ms=<epoch_ms>|<32 authority=0>|<7 describe=1>|row_hash=<hex>
```

---

### 1.13 `SHA` — sha-chain link
**Source:** `src/planes/sha.mjs:26`.

**Current BPI fields:** `SHA | room_id | link_index | link_sha16 | prev_sha16 | sha8`

**Mapping note:** the acer `SHA` plane IS a per-room append-only chain. Map directly onto Hermes chain mechanics — the acer `link_sha16` becomes the Hermes `row_hash` of THIS row; acer `prev_sha16` becomes Hermes `prev_hash`; acer `link_index` becomes Hermes `sequence`. One Hermes chain per room.

**HBPv1 row template:**
```
HBPv1|layer=sha-chain|pid=BH.PLANE.SHA.<12hex>|prof=hash-readback-link|supervisor=fail-closed-public|tuple=sha:<room_id>:<link_index>|triple_quant=room/port/elapsed|polar_quant=describe/execute|js_quant=johnson-slithechen-public|turbo_quant=packet-first|json=0|runtime=0|promote=0|status=CHAIN_LINK|chain_id=ACER-REVOLVER-SHA-room-<NNNNN>-v1|sequence=<link_index_plus_1>|prev_hash=<prev_sha16_expanded|ROOT>|room_id=<n>|<32 authority=0>|<7 describe=1>|row_hash=<hex>
```

**Caveat:** the existing acer SHA chain uses 16-hex truncated links (`sha.mjs:11-13`); Hermes `chain.py:24` uses full 64-hex sha256. Operator must decide whether to (a) widen acer to 64-hex during migration, or (b) keep the legacy 16-hex link in a side field `acer_link_sha16=<hex16>` and let Hermes compute its own 64-hex `row_hash` independently. **TBD-OPERATOR.** Recommend (a) for clean migration.

Acer `link_index` is zero-based (`sha.mjs:26`); Hermes `sequence` starts at 1 (`chain.py:57`). Emitter must use `sequence = link_index + 1`.

---

### 1.14 `QNT` — Quant receipt
**Source:** `src/planes/quant.mjs:16`.

**Current BPI fields:** `QNT | mode | packed_bytes_hex | qt_tag | room_id | sha8`

**HBPv1 row template:**
```
HBPv1|layer=quant|pid=BH.PLANE.QUANT.<12hex>|prof=omniquant-receipt|supervisor=fail-closed-public|tuple=qnt:<mode>:<room_id>|triple_quant=room/port/elapsed|polar_quant=describe/execute|js_quant=johnson-slithechen-public|turbo_quant=packet-first|json=0|runtime=0|promote=0|status=CHAIN_LINK|chain_id=ACER-REVOLVER-QUANT-v1|sequence=<n>|prev_hash=<hex|ROOT>|quant_mode=<triple|polar|turbo|jl>|qbytes_hex=<hex>|qt_tag=<tag>|room_id=<n>|<32 authority=0>|<7 describe=1>|row_hash=<hex>
```

---

### 1.15 `MNT` — PID mint
**Source:** `src/planes/minting.mjs:22,33`.

**Current BPI fields:** `MNT | entity | pid | tail | glyph_addr | sha8`

**HBPv1 row template:**
```
HBPv1|layer=pid-mint|pid=<pid>|prof=pid-mint-receipt|supervisor=fail-closed-public|tuple=mnt:<entity>:<tail>|triple_quant=room/port/elapsed|polar_quant=describe/execute|js_quant=johnson-slithechen-public|turbo_quant=packet-first|json=0|runtime=0|promote=0|status=CHAIN_LINK|chain_id=ACER-REVOLVER-MINT-v1|sequence=<n>|prev_hash=<hex|ROOT>|mint_entity=<entity>|mint_pid=<pid>|mint_tail=<hex12>|glyph_addr=<6glyph>|<32 authority=0>|<7 describe=1>|row_hash=<hex>
```

---

### 1.16 `RFX`, `WHR`, `WHC`, `IDX`, `WTC` — short-shape frames
**Sources:** `reflex.mjs:25`, `white_room.mjs:27,37`, `indexer.mjs:22`, `watcher.mjs:20`. All carry the standard 32-authority `=0` + 7-describe `=1` block + `row_hash`. One row template each:

- `RFX` (`kind|sha16|source|ts`) → `layer=reflex-lesson` / `chain_id=ACER-REVOLVER-REFLEX-v1` / `lesson_kind=<genius|mistake>` / `payload_sha16` / `source_name` / `ts_ms` / `status=CHAIN_LINK`.
- `WHR` (`sha16|urgency|source|ts`) → `layer=white-room-request` / `chain_id=ACER-REVOLVER-WHITEROOM-v1` / `payload_sha16` / `urgency=<low|normal|high|critical>` / `source_name` / `ts_ms` / `status=CHAIN_LINK`.
- `WHC` (`sha16|decision|ts`) → `layer=white-room-complete` / `chain_id=ACER-REVOLVER-WHITEROOM-v1` (shared with WHR) / `payload_sha16` / `decision=<approved|rejected|deferred>` / `ts_ms` / `status=CHAIN_LINK`.
- `IDX` (`key_sha16|payload_sha16|ts`) → `layer=indexer` / `chain_id=ACER-REVOLVER-INDEXER-v1` / `key_sha16` / `payload_sha16` / `ts_ms` / `status=CHAIN_LINK`.
- `WTC` (`event_kind|payload_sha16|ts_ms`) → `layer=watcher` / `chain_id=ACER-REVOLVER-WATCHER-v1` / `event_kind` / `payload_sha16` / `ts_ms` / `status=CHAIN_LINK`.

---

### 1.17 `CMP` / `SMP` — Compose / sample (planes/index.mjs)
**Source:** `src/planes/index.mjs:38,52-54`.

**Current BPI fields:**
- `CMP | count | joined_frames | sha8`
- `SMP | a | b | sha8`

**Decision:** `CMP` is a meta-envelope that wraps OTHER frames; under HBPv1 we should NOT preserve that wrapper shape (Hermes-native append-only chain replaces compounding). **Drop `CMP` entirely — its compose semantic is provided by chain `sequence`/`prev_hash`.** `SMP` is selfTest-only — drop.

Listed here for completeness; both go to §5 (cannot migrate).

---

## 2. Chain ID assignment

One `chain_id` per emit category. Acer-canonical naming:

| Plane / category | `chain_id` | Source files |
|---|---|---|
| Intake / FAOR | `ACER-REVOLVER-INTAKE-v1` | `intake.mjs` |
| PID context | `ACER-REVOLVER-PIDCTX-v1` | `revolver.mjs:40` |
| Room ingest (HBI-renamed) | `ACER-REVOLVER-ROOM-INGEST-v1` | `planes/hyperbehcs.mjs` |
| Carry-Z | `ACER-REVOLVER-CARRY-Z-v1` | `planes/carry_z.mjs` |
| HRM bridge | `ACER-REVOLVER-HRM-v1` | `planes/hrm.mjs` |
| Gulp | `ACER-REVOLVER-GULP-v1` | `planes/gulp.mjs` |
| Super-gulp | `ACER-REVOLVER-SUPERGULP-v1` | `planes/super_gulp.mjs` |
| GNN | `ACER-REVOLVER-GNN-v1` | `planes/gnn.mjs` |
| GC | `ACER-REVOLVER-GC-v1` | `planes/gc.mjs` |
| Hookwall | `ACER-REVOLVER-HOOKWALL-v1` | `planes/hookwall.mjs` |
| Tuple route | `ACER-REVOLVER-TUPLE-v1` | `planes/tuple.mjs` |
| Crypto receipt | `ACER-REVOLVER-CRYPTO-v1` | `planes/crypto.mjs` |
| SHA per-room chain | `ACER-REVOLVER-SHA-room-<NNNNN>-v1` | `planes/sha.mjs` (one chain per `roomId`) |
| Quant | `ACER-REVOLVER-QUANT-v1` | `planes/quant.mjs` |
| Mint | `ACER-REVOLVER-MINT-v1` | `planes/minting.mjs` |
| Reflex | `ACER-REVOLVER-REFLEX-v1` | `planes/reflex.mjs` |
| White-room (req + complete) | `ACER-REVOLVER-WHITEROOM-v1` | `planes/white_room.mjs` |
| Indexer | `ACER-REVOLVER-INDEXER-v1` | `planes/indexer.mjs` |
| Watcher | `ACER-REVOLVER-WATCHER-v1` | `planes/watcher.mjs` |

Per-chain state (`sequence` + last `row_hash`) must be persisted by the emitter so `prev_hash` is correct across process restarts. Suggested location: `D:/asolaria-revolver-intake/chains/<chain_id>.state` (one file per chain, two lines: `sequence=<n>` and `last_row_hash=<hex>`). **TBD-OPERATOR: confirm storage location.**

---

## 3. Status enum mapping

The 8 `WAVE_DESCRIPTOR_STATUSES` (`wave.py:24-33`) are wave-specific. Revolver-10k's emissions are descriptor + chain + promotion — so for the **non-wave** rows they map to the 4 statuses in `authority.py:5-10` (`AUTHORITY_DESCRIBED`, `CHAIN_ROOT`, `CHAIN_LINK`, `PUBLIC_DESCRIPTOR`) plus the 5 promotion statuses (`PROMOTION_*`).

| Acer event | Hermes `status` |
|---|---|
| `FAOR` emit (intake) | `PUBLIC_DESCRIPTOR` |
| `PIDCX` write | `AUTHORITY_DESCRIBED` (it describes who/where but grants nothing) |
| `HBI` (room-ingest) load | `PUBLIC_DESCRIPTOR` |
| `CRZ` carry append | `CHAIN_LINK` |
| `HRM` bridge stub | `PUBLIC_DESCRIPTOR` |
| `GLP` ingest | `CHAIN_LINK` |
| `SGP` ingest | `CHAIN_LINK` |
| `SGF` flush | `CHAIN_LINK` |
| `GNN` emit | `CHAIN_LINK` |
| `GCR` per-room GC | `CHAIN_LINK` |
| `GCS` sweep | `CHAIN_LINK` |
| `HKW` request (default-deny) | `PROMOTION_REQUESTED` |
| `HKG` grant (quintuple) | `PROMOTION_APPROVED` |
| Future denial frame | `PROMOTION_DENIED` (currently absent in acer code — add when needed) |
| Future revocation | `PROMOTION_REVOKED` (currently absent) |
| Future window expiry | `PROMOTION_EXPIRED` (currently absent) |
| `TPL` route | `PUBLIC_DESCRIPTOR` |
| `CRP` signed receipt | `CHAIN_LINK` |
| `SHA` chain link | `CHAIN_LINK` (first link of a room = `CHAIN_ROOT`) |
| `QNT` quant receipt | `CHAIN_LINK` |
| `MNT` mint | `CHAIN_LINK` (root of a fresh PID emits `CHAIN_ROOT`) |
| `RFX` lesson | `CHAIN_LINK` |
| `WHR` review request | `CHAIN_LINK` (whiteroom workflow is descriptor, not promotion) |
| `WHC` review complete | `CHAIN_LINK` |
| `IDX` index write | `CHAIN_LINK` |
| `WTC` watch event | `CHAIN_LINK` |

**CHAIN_ROOT vs CHAIN_LINK rule:** first row of any `chain_id` (i.e. `sequence=1`, `prev_hash=ROOT`) uses `status=CHAIN_ROOT`; all others use `CHAIN_LINK` unless overridden by the table above (`AUTHORITY_DESCRIBED`, `PUBLIC_DESCRIPTOR`, `PROMOTION_*`).

The 8 `WAVE_DESCRIPTOR_STATUSES` are NOT used by any current revolver-10k emit. They would only appear if revolver-10k publishes spindle-wave packets (e.g. for its own architect/subagent topology). See §4 risk note.

---

## 4. Migration order

Refactor in this order; each step is one PR-sized landing.

### Step 1 — `src/bpi-codec.mjs` (Risk: LOW)
Add (do not replace) a new exported function `encodeHbpRow(layer, pid, fields, { chainId, sequence, prevHash, status, profile, supervisor, tupleStr })`. Keep `encodeFrame` exactly as-is for backward-compat during transition. New function builds the 56-base-field row + `row_hash` per §0. Also expose `hbiRowFor(hbpRow, rowNumber)` (per `indexer.py:7-25`) and a `sha256SidecarFor(hbpBytes, filename)` helper.

**Tests to add:** rebuild `selfTest()` to assert `encodeHbpRow` output parses via the Python `packet.parse_row` semantics (re-implement minimal parser inline in JS for round-trip).

### Step 2 — `src/intake.mjs` (Risk: MEDIUM)
- `record()` continues to append to `D:/asolaria-revolver-intake/YYYY-MM-DD.frame` but should ALSO append `.hbp` rows to `D:/asolaria-revolver-intake/YYYY-MM-DD.hbp`. Dual-write window: 30 days (configurable env `HBP_DUAL_WRITE_DAYS=30`).
- `emitToBus()` builds an HBPv1 row and POSTs it instead of the BPI frame. Bus must accept HBPv1 text — confirm BEHCS bus at `:4947/behcs/send` accepts the new shape (or add `/behcs/hbp` route on the bus side). **TBD-OPERATOR: bus-side adapter.**
- Per-day file is the chain unit; on day-rollover the new `.hbp` file's first row uses `sequence=<carry_from_previous_day_plus_1>` and `prev_hash=<row_hash of last row in prior day's .hbp>`. Chain state persisted per §2.
- After the daily `.hbp` is fully written (at midnight UTC rollover or on demand), call sidecar writers (§6) for `.hbi`/`.sha256`/`.hex`.

### Step 3 — `src/planes/*.mjs` (Risk: LOW–MEDIUM each)
Refactor each plane's single `encodeFrame(<TAG>, [...])` call into `encodeHbpRow(<layer>, <pid>, {...}, chainOpts)`. Order: smallest first.
1. `watcher.mjs`, `indexer.mjs`, `reflex.mjs`, `gc.mjs`, `white_room.mjs` (one-call shims; low risk).
2. `tuple.mjs`, `crypto.mjs`, `quant.mjs`, `gnn.mjs`, `minting.mjs`.
3. `gulp.mjs`, `super_gulp.mjs`, `carry_z.mjs`.
4. `sha.mjs` (medium risk: SHA-chain semantics overlap with Hermes chain — see §1.13 caveat. Decide on link-width before refactor).
5. `hookwall.mjs` (medium risk: this is the ONLY plane that touches promotion-receipt fields — needs operator review).
6. `hyperbehcs.mjs` (medium risk: rename tag — confirm no downstream consumer parses literal `HBI|...`).
7. `hrm.mjs` (low; stub).

### Step 4 — `src/planes/index.mjs` (Risk: LOW)
Remove `composeFrame` from the public conductor surface (or hard-deprecate). Chain semantics replace it.

### Step 5 — `src/revolver.mjs::writePidContext` (Risk: LOW)
Rename `<room>/PID_CONTEXT.bpi` → `<room>/PID_CONTEXT.hbp`. Single HBPv1 row file (one line + trailing newline). Add sibling `PID_CONTEXT.sha256` + `PID_CONTEXT.hex` per §6.

### Step 6 — `test/` (Risk: LOW)
Add an integration test that pipes one day of synthetic emissions through the new path and runs `python -m hyperbehcs_hermes.cli wave verify` (or equivalent) against the result. Wire it into `bin/` if there's a smoke harness.

---

## 5. What CANNOT migrate (fields with no Hermes home)

| Acer field | Plane | Reason |
|---|---|---|
| `sha8` (frame integrity) | every BPI frame | Hermes uses full sha256 `row_hash` + `.sha256` sidecar (`SPEC.md:54-59`). The 8-hex truncated check has no Hermes equivalent. **Drop.** |
| `CMP` compound frame | `planes/index.mjs:38` | Hermes chain (`sequence`/`prev_hash`) supersedes compound wrapping. **Drop.** |
| `SMP` sample frame | `planes/index.mjs:52-54` | selfTest synthetic only. **Drop.** |
| BPI tag literal `HBI` | `planes/hyperbehcs.mjs:40` | Collides with Hermes `HBIv1` sidecar grammar. **Rename** to `room-ingest` per §1.3. |
| Plain `provider` field | `intake.mjs`, `revolver.mjs` | Collides with the closed-default `provider` authority field. **Rename** to `provider_name` (always-set). |
| Plain `endpoint`, `mcp` (if any future emits add these as bare names) | future | Same collision risk. Always suffix `_name` / `_url`. |
| `default_deny_quintuple_required` literal string field-3 | `hookwall.mjs:23` | Move to a named field `denial_reason=default_deny_quintuple_required`. Not a drop, but the positional shape is gone. |
| 16-hex truncated `link_sha16` / `prev_sha16` | `planes/sha.mjs` | Hermes wants 64-hex sha256. Either widen (recommended) or carry as `acer_link_sha16` side-field. **TBD-OPERATOR.** |
| `descriptor_only` literal in HRM | `planes/hrm.mjs:31` | Move to a named field `hrm_mode=descriptor_only`. |
| `payload` raw object | `carry_z.mjs:48`, `gulp.mjs:11`, etc. | Already not on-wire (only `payload_sha16` is). Confirms canon. No change. |
| `stdout` body | `intake.mjs:43-45` | Already routed to companion file. No change. |

Anything else implicit in the BPI codec (escape rules, `bytesToHex` helper, glyph self-test) is internal and not on-wire → keeps unchanged.

---

## 6. Sidecar generation — where in the pipeline

Per `SPEC.md:43-65` and `hyperbehcs_hermes/indexer.py`, every published `.hbp` file MUST have three sidecars:
- `<name>.hbi` — one `HBIv1` row per `.hbp` row (built by `build_hbi_rows` in `indexer.py:7-25`).
- `<name>.sha256` — `<sha256_of_hbp_bytes>  <name>.hbp` (single line).
- `<name>.hex` — lowercase hex of the raw `.hbp` bytes.

**Call sites in the acer pipeline:**

1. **End-of-day rollover** in `src/intake.mjs::record()` — when `todayFile()` produces a different path than the last write, the prior day's file is finalized. After finalize:
   - call `writeHbiSidecar(prevHbpPath)` → writes `<path>.hbi`
   - call `writeSha256Sidecar(prevHbpPath)` → writes `<path>.sha256`
   - call `writeHexSidecar(prevHbpPath)` → writes `<path>.hex`
2. **Per-room `PID_CONTEXT.hbp`** in `src/revolver.mjs::writePidContext()` — after writing the single-row `.hbp`, immediately call all three sidecar writers (the file is one row and is never appended to, so finalization is synchronous).
3. **Optional on-demand `flush` endpoint** on the bus / portal (`src/portal.mjs` likely) — operator-triggered "publish today's chain now". Same three-call sequence on today's in-progress `.hbp`. **TBD-OPERATOR: add HTTP route?**
4. **Spindle-wave packets** (future, §1.16 ext) — if revolver-10k ever publishes its own wave descriptors, those `.hbp` files MUST also get the sidecar trio. Adapter call site: wherever the wave writer lives (currently nowhere; **TBD-OPERATOR** for wave roadmap).

Sidecar writers (to add in Step 1, `src/bpi-codec.mjs`):
- `writeHbiSidecar(hbpPath)` — port `indexer.py:build_hbi_rows` to JS.
- `writeSha256Sidecar(hbpPath)` — `sha256(fs.readFileSync(hbpPath))` + `"  <basename>"`.
- `writeHexSidecar(hbpPath)` — `fs.readFileSync(hbpPath).toString('hex')`.

---

## 7. Test plan — three concrete asserts

The verifier subagent (Spindle 1, subagent-3) must run these against the migrator's output. All three must pass before chain promotion.

### Assert 1 — every emitted `.hbp` passes Hermes `wave verify`

```bash
cd D:/hyperbehcs-hermes
python -m hyperbehcs_hermes.cli wave verify \
  --packet D:/asolaria-revolver-intake/2026-05-19.hbp
```
Expected: exit 0, output contains `OK=true`, `AUTHORITY=fail-closed`, `JSON_HOT_PATH=closed`. Failure modes to surface explicitly:
- any row with `missing_required()` non-empty (per `packet.py:36`) → FAIL.
- any row with `open_authority_fields()` non-empty for a non-hookwall layer (per `packet.py:38-44`) → FAIL.
- chain `verify_append_only_chain` returns `ok=False` (per `chain.py:28-75`) → FAIL.

### Assert 2 — sidecar trio matches `.hbp` bytes

For each finalized `.hbp` produced by the migrator:
```bash
sha256sum -c D:/asolaria-revolver-intake/2026-05-19.sha256        # exit 0
test "$(wc -l < 2026-05-19.hbi)" -eq "$(wc -l < 2026-05-19.hbp)"  # equal row counts (SPEC.md:51)
test "$(xxd -p -c 0 2026-05-19.hbp)" = "$(cat 2026-05-19.hex)"     # hex matches bytes
```
All three must succeed.

### Assert 3 — round-trip parse parity vs legacy BPI

For a synthetic batch of 1000 events fed simultaneously to the legacy `encodeFrame` path AND the new `encodeHbpRow` path, assert:
- Both paths produce one record per event (count parity).
- For each (BPI frame, HBPv1 row) pair, the BPI positional fields are recoverable from the HBPv1 named fields by the mapping in §1 (per-tag projector implemented in `test/round_trip.test.mjs`). NO field silently dropped, NO field invented.
- The `chain_id` + `sequence` of the HBPv1 row is unique-per-chain and monotonic (no gaps, no reuse) — same invariant `chain.py:50-66` enforces.

If all three assert sets are green on a fresh 24-hour synthetic run, the migration is considered landed for that chain category. Repeat per `chain_id` from §2.

---

## 8. Operator-decision items (`TBD-OPERATOR`)

Collected from inline marks above:

1. **§1.10 hookwall** — what value goes in `promotion_field` / `promotion_expires` for the request and grant rows? (acer `hookwall.mjs` doesn't carry these today.)
2. **§1.13 SHA chain** — widen acer link to 64-hex, or carry both? Recommendation: widen.
3. **§2 chain state** — confirm storage location `D:/asolaria-revolver-intake/chains/<chain_id>.state` for per-chain `sequence` + last `row_hash`.
4. **§4 step 2** — confirm BEHCS bus at `127.0.0.1:4947/behcs/send` accepts HBPv1 text, or add `/behcs/hbp` route.
5. **§6 item 3** — add operator-triggered "publish today's chain now" HTTP route (probably in `src/portal.mjs`)?
6. **§6 item 4** — does revolver-10k ever emit its own spindle-wave packets? If yes, wave writer + sidecar wiring needs design.
7. **§4 step 3.6** — confirm no downstream consumer parses literal acer `HBI|...` frames (the rename from `HBI` → `room-ingest` is breaking for any naive substring matcher).

---

**End of plan.**
