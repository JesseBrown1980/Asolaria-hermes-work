# Civilization Spindle 5 (CS5) — 10000-Room Rotor NDJSON → HBPv1

PID: AGT-GAIA-TOPOLOGY-A16-W45-HERMES-PHASE-3-PLAN-2026-05-21
Position: Phase 3 / Wave 1 / first cascade target after Phase 2.
Predecessor: CS4 (10000-room rooms cohort — already migrated room-state from older format to NDJSON; CS5 finishes the journey NDJSON → HBPv1).

## Why CS5 first

- **Highest readiness score (5/5).** The 10000 rooms are already canon-aligned (Brown-Hilbert ordering, port.port tuple addresses, glyph-1024 names). The only missing piece is the wire format.
- **Lowest risk (2/5).** Room state is regenerable from canonical inputs (BH curve + atlas cp + port.port). Bad migration can be rolled back by re-deriving.
- **High downstream impact (5/5).** Every other CSn that reads room-state benefits from the migration immediately. CS7 (fabric-revolver-8) explicitly reads chamber-to-room map.

## Spindle shape (Hermes 1 main + 3 subs, descriptor only)

**Main (architect):** `CS5-MAIN-ROOMS-MIGRATION`
- Owns the migration plan, sequences sub work, emits the receipt chain, holds the canonical room→`.hbp` map.

**Sub 1 — Scanner:** `CS5-SUB-SCANNER`
- Enumerates every NDJSON room-state file under `D:/Asolaria-HyperBEHCS-10000-RoomRotor/...` and `C:/HyperBEHCS/runtime/rooms/...`.
- For each file: produce a manifest row {room_id, current_format, byte_count, last_mtime, BH coord, port.port tuple}.
- Output: `cs5-scan-manifest.hbp` (descriptor only).

**Sub 2 — Refactorer:** `CS5-SUB-REFACTORER`
- Takes scanner manifest. For each row, emits a planned HBPv1 row spec: `HBPv1|<chain_id>|<sequence>|<prev_hash>|<row_hash>|<room_id>|<BH_coord>|<port_port>|<glyph_name>|<authority_columns_32>|<triple_quant_4>|<payload_ref>`.
- Side outputs: planned `.hbi` index entry, `.sha256` row, `.hex` hexdump line per file.
- Does NOT write — produces a refactor plan file `cs5-refactor-plan.hbp`.

**Sub 3 — Verifier:** `CS5-SUB-VERIFIER`
- Runs the 15 Hermes wave-verify invariants against the refactor plan:
  1. spindle = 1 main + 3 subs (this spindle itself)
  2. required wave fields present
  3. status enum value ∈ {8 allowed}
  4. mcp/webmcp `describe_only`
  5. authority fields all 32 present, defaults closed
  6. wrong-layer messages rejected
  7. public-wave verify, no allow-open
  8. no JSON in hot path
  9. chain row canonical (`row_hash` excluded from canonicalization)
  10. `prev_hash=ROOT` only on genesis
  11. sequence monotone
  12. sidecar trinity present per packet
  13. triple-quant tags real (recomputed match)
  14. promotion receipts append-only
  15. public-safe scan clean
- Emits `cs5-verify-receipt.hbp`.

## Inputs / outputs

**Inputs (read-only):**
- `D:/Asolaria-HyperBEHCS-10000-RoomRotor/...` (existing NDJSON room-state)
- `C:/HyperBEHCS/runtime/rooms/...` (kernel-side room manifest if present)
- `D:/asolaria-whiteroom/behcs-1024-atlas/atlas-index.ndjson` (cp domain map, read-only)
- Hermes `authority.py` 32-field schema (copied verbatim, not paraphrased)

**Outputs (CS5 spindle files):**
- `cs5-scan-manifest.hbp` + `.hbi` + `.sha256` + `.hex`
- `cs5-refactor-plan.hbp` + sidecars
- `cs5-verify-receipt.hbp` + sidecars
- One promotion receipt: `CS5-REQUESTED` → `CS5-APPROVED` (operator) → `CS5-COMPLETED`

**Outputs (downstream artifact, NOT in CS5 scope — happens after operator approval):**
- 10000 room `.hbp` files (one per room) replacing the NDJSON entries. CS5 only plans these; the write is operator-gated.

## Triple-quant injection point

For each room row, compute (via Phase-1 `hermes_omniquant.py` once it lands):
- `polar_quant(room_BH_coord)`
- `turbo_quant(room_glyph_index)`
- `js_quant(room_port_port_tuple)`
- `triple_quant = polar ⊕ turbo ⊕ js`

These tags become cryptographic witnesses on every room row (per the upstream-PR opportunity in the bidirectional canon).

## Chain anchoring

- `chain_id = CS5-ROOMS-MIGRATION-2026-05-21`
- Genesis row: `prev_hash = ROOT`, payload references the scanner manifest.
- All subsequent rows monotone-sequenced.
- Final row references CS6 (cosign-chain) handoff — CS6 absorbs CS5's anchor into the broader acer cosign chain.

## Authority defaults

All 32 authority fields default `closed`. CS5 explicitly never opens any — it's a descriptor/plan spindle, not a privilege-claiming one. Promotion receipts are filed but their `effect` field stays `descriptor_only`.

## Success criteria

1. 10,000 planned `.hbp` rows in `cs5-refactor-plan.hbp`, one per room.
2. All 15 Hermes wave-verify invariants pass in `cs5-verify-receipt.hbp`.
3. Chain rows monotone, prev_hash linkage verified.
4. Triple-quant tags recompute-match (zero drift).
5. Operator can read the plan and sign CS5-APPROVED in one pass.

## What CS5 explicitly does NOT do

- Does not write the 10,000 actual room `.hbp` files (operator-gated post-approval).
- Does not touch USB-OS staging (CS12 territory).
- Does not modify kernel daemon (CS10 territory).
- Does not contact Hermes upstream (Phase 3 stays acer-side; upstream PR is a separate later decision).
