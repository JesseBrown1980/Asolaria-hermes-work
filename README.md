# Asolaria — Hermes work

Consolidated **Hermes / HyperHermes** work built by Asolaria (mostly 2026-05 → 2026-06): the
self-improving agent, its spindle, the dispatcher (a registered first-class citizen), the formal
absorption of the upstream Hermes agent, and the Host-8 Rust agent-runtime. Gathered here from across
the Asolaria tree into one place.

> **Carve-out (what's intentionally NOT here):** no keys / seeds / tokens; no HBP/HBI **corpus** or
> receipts (corpus stays local by rule); no `PID-Registration-Office` registered-PID files; no screen
> captures (PII); no runtime inbox/outbox/access lanes; no internal agent-memory. This repo is the
> **source + docs + tests + contracts** layer only. Every file was secret-scanned before commit.

## What's here

### Dispatcher (first-class citizen)
- `hyperbehcs/store/Start-Hermes-Spindle-Dispatcher-2026-05-20.ps1` — the dispatcher launcher
- `asolaria-acer/federation-remake-1024/tools/omnidispatcher/` — the **omnidispatcher** (routes /
  validator / worker / port-pool / fedenvRejectShim + test / package.json) — the Rust-era dispatch lane
- `asolaria-acer/scratch/fedenv-v1-omnidispatcher-2026-05-22/` — the omnidispatcher spec + schema
- `asolaria-acer/tmp/meta-supervisor-hermes.state.json`
  - *(the registered dispatcher PID `sup-hermes-spindle-dispatcher-e08300d7e4a33186` lives in the
    sovereign PID-Registration-Office and is intentionally NOT published here.)*

### Spindle
- `asolaria/tools/behcs/hyperbehcs-hermes-spindle-worker.mjs` — the spindle worker
- `asolaria-acer/packages/revolver-10k/src/spindles/` — spindle-builder + spindle-receipt
- `asolaria-acer/packages/revolver-10k/docs/SPINDLE-FRACTAL-CANON.md`
- `asolaria/tests/hyperbehcs-hermes-spindle-*.unit.test.js`
- `guides/.../A16-HERMES-PHASE-3/`, `guides/hermes-unlock-2026-05-20/` (nested-spindle smoke + findings)

### The agent itself (with the self-improving learning loop)
- `asolaria/tools/original-hermes-agent-implementation-orchestrator.js`
- `asolaria/data/behcs/original-hermes-agent/` — contracts (learning-loop-contract.v1, runtime-snapshot,
  security-backport-manifest, plugin-hook gates) + runtime-index + source-manifest + readiness
- `asolaria/reports/original-hermes-agent-*` — implementation tranche, learning-loop smoke, runtime
  index, security-backport / security-targeted-tests / transport-router / wal-state smokes
- `asolaria/tools/behcs/hermes-agent-fabric-ingest.mjs`
- agent-to-agent handoff: `asolaria/tools/behcs/hyperbehcs-hermes-two-latch-next-agent-handoff*.mjs` + tests

### Absorption + migration (the upstream Hermes was formally absorbed)
- `asolaria-acer/packages/hermes-absorption/plans/nous-hermes-new/implementation/P4-activation-dispatcher.js`
- `asolaria-acer/packages/revolver-10k/HERMES_MIGRATION_PLAN.md`
- `asolaria/data/behcs/fabric-revolver/FABRIC_HERMES_MIGRATION_PLAN.md`
- `roomrotor/CARRY_HERMES_MIGRATION_PLAN.md`
- `asolaria-acer/reports/OMNI-17-HERMES-PREP.behcs-256.json`

### Host-8 Rust agent-runtime (first-class)
- `asolaria-acer/federation-remake-1024/kernel/core/src/agent_runtime/mod.rs`
- `asolaria-acer/federation-remake-1024/servers/agent-runtime/src/lib.rs`
- `asolaria-acer/federation-remake-1024/AGENT_ROSTER_SCHEMA.md`

## Where the rest lives
The live Host-8 lane: **https://github.com/JesseBrown1980/asolaria-federation-1024** ·
algorithms/findings: **https://github.com/JesseBrown1980/Algorithms-of-Asolaria**

Status tag: this is a snapshot of built work — gated / E=0 in its original homes (no fire, no cutover
without operator authority). Provided as the source/docs record.

## Kernel fleets + stubbed rooms
See `KERNEL-FLEET-AND-STUBBED-ROOMS.md` — the 10k/20k/100k kernel fleets + the stubbed-rooms (rooms-as-RAM) inventory: `kernel-fleet/` + `room-rotor/`.
