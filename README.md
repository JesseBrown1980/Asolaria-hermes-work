# Asolaria — Hermes work

Consolidated **Hermes / HyperHermes** work built by Asolaria: the self-improving agent, its spindle,
the dispatcher as a registered first-class citizen, formal absorption of the upstream Hermes agent,
and the Host-8 Rust agent runtime.

> **Carve-out:** no keys/seeds/tokens; no private HBP/HBI corpus or receipts; no PID-office files;
> no PII captures; no runtime inbox/outbox/access lanes; no internal agent memory. Source + docs +
> tests + contracts only.

## 2026-07-11 Path-2 and storage update

HyperHermes is now documented as the materialization/handoff layer around two measured exact-recovery
paths:

- **Path 1:** retained-store recall through an authenticated address;
- **Path 2:** exact no-store CRT recovery from jointly sufficient shadows;
- **DBBH→DBWH:** white-side re-projection before emission;
- **storage tier:** HDD/SSD holds cubes, shadows, receipts, queues, and cold agent state;
- **accelerator tier:** trained GNN/LLM inference remains an optional sidecar.

Full component-specific record:

[`HYPERHERMES-PATH2-STORAGE-AND-VERIFICATION-2026-07-11.md`](HYPERHERMES-PATH2-STORAGE-AND-VERIFICATION-2026-07-11.md)

## The operating chain

```text
addressed envelope
  -> OmniDispatcher
  -> HyperHermes spindle / worker
  -> Hookwall + GNN/Fischer + Shannon
  -> white-room KEEP or COMPACT
  -> GULP / cube / receipt on storage
  -> next-agent handoff
  -> exact recall/reconstruction when rematerialized
```

Possible agents remain cheap PID/seed/address state; only active agents become bodies. Completed work
returns to durable storage rather than piling in RAM or GPU VRAM.

## What's here

### Dispatcher — first-class citizen

- Hermes spindle-dispatcher launcher;
- OmniDispatcher routes, validator, worker, port pool, reject tee, tests;
- FEDENV-v1 spec/schema;
- meta-supervisor state descriptor.

The registered dispatcher PID remains in the private sovereign PID office.

### Spindle

- HyperBEHCS Hermes spindle worker;
- revolver-10k spindle builder and receipt;
- spindle-fractal canon;
- unit tests and nested-spindle smoke records.

### Agent and self-improving loop

- original Hermes agent implementation orchestrator;
- learning-loop contract, runtime snapshot, security backport, plugin gates, runtime/source manifests;
- learning-loop, transport, WAL, security, and readiness smoke records;
- fabric ingest and two-latch next-agent handoff.

### Absorption and migration

- upstream Hermes activation dispatcher;
- Hermes/revolver/fabric migration plans;
- carry plan and BEHCS preparation artifacts.

### Host-8 Rust agent runtime

- kernel agent runtime;
- server agent runtime;
- agent roster schema.

## Low-GPU / storage-rich applicability

A machine does not need a GPU to perform:

- queueing and dispatch;
- spindle/handoff state;
- SHA/Host8/BEHCS/CRT recovery;
- HBP/HBI receipt handling;
- Hookwall/Fischer/Shannon deterministic gates;
- white-room compaction;
- N-Nest recomputation.

HDD/SSD can retain cube bodies, Path-1 content, Path-2 shadows, checkpoints, graph ledgers, receipts,
and cold agent state. RAM retains only the bounded active work. Trained GNN/LLM inference may still
use CPU/GPU accelerators.

The result is a tiered fabric, not “disk is a GPU.”

## Pre-Asolaria GNN origin

The routed GNN sidecars descend from Jesse's AI healthcare assistant. The four healthcare model
files match the later Asolaria sidecar blobs exactly. BigPickle then combines L0/L4 with G1/G2/G3/G4,
OmniShannon, SHA fallback, Fischer, and Hookwall. Later trained checkpoints live in the trained-GNN
repository.

## Independent verification — 2026-07-11

- `MEASURED_CLAUDE_FABLE5_THIRD_SEAT`, operator supplied:
  Path 1 rustc 1.97 **19/19** and Path 2 rustc 1.97 **30/30**.
- `AUDITED_GPT_5_6_PRO`: complete healthcare-GNN, BigPickle, trained-GNN, Hookwall/Shannon,
  Q-PRISM, white-room, cube-mint, Dispatcher, HyperHermes, reductions, algorithms, and N-Nest audit.
- `MEASURED_GPT_DIRECTED_GITHUB_ACTIONS`: successful Rust 1.97.0 runs `29134408321`,
  `29134413119`, and `29134419389`.

These recovery receipts do not claim a new live Hermes/Hilbra cross-machine benchmark.

## Where the rest lives

- live Host-8 lane: `JesseBrown1980/asolaria-federation-1024`
- algorithms/findings: `JesseBrown1980/Algorithms-of-Asolaria`
- Path 1: `JesseBrown1980/dbbh-coms-quant-prism`
- Path 2: `JesseBrown1980/path2-two-shadow-recovery`

Status: built source/docs/tests snapshot, gated / E=0 in original homes; no fire or cutover without
operator authority.

## Kernel fleets + stubbed rooms

See `KERNEL-FLEET-AND-STUBBED-ROOMS.md` for 10k/20k/100k kernel fleets and rooms-as-RAM inventory.
