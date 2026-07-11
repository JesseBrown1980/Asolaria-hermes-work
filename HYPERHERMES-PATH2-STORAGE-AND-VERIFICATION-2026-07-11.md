# HyperHermes, Path 2, storage, and verification — 2026-07-11

## HyperHermes role

HyperHermes is the materialization and handoff layer around the measured recovery/scoring fabric:

```text
addressed envelope
  -> OmniDispatcher
  -> Hermes spindle / worker
  -> Hookwall + GNN/Fischer + Shannon
  -> white-room KEEP/COMPACT
  -> GULP / cube / receipt
  -> next-agent handoff
```

The new exact-recovery plane adds:

```text
Path 1 -> recover a retained object by authenticated address
Path 2 -> recover an unretained object from jointly sufficient CRT shadows
DBWH   -> re-project the candidate and require black/white agreement before emission
```

## Why this is compatible with infinitely many potential agents

The system does not instantiate every possible agent body. HyperHermes can maintain compact
identities, manifests, handles, and queues while materializing only the active worker/spindle:

```text
possible agents -> cheap PID/seed/address state
active agents   -> bounded materialized bodies
finished agents -> receipts/cubes/cold state on HDD/SSD
```

This is the same sparse materialization law used by the dispatcher and GULP system.

## Storage-backed self-improvement loop

```text
message/result
  -> graph/GNN/reverse-gain/Shannon analysis
  -> white-room decision
  -> durable cube/glyph/hash/receipt on storage
  -> next run retrieves compact learned state
  -> active body rematerializes only when needed
```

The loop can improve routing/context between runs without retaining the entire prior corpus in RAM
or GPU VRAM.

## Hardware split

### CPU/HDD/SSD-capable roles

- dispatcher and queue;
- spindle state and handoff receipts;
- HBP/HBI/SHA/HEX storage;
- Path-1 content-addressed recall;
- Path-2 CRT recovery;
- DBBH→DBWH watcher comparisons;
- Hookwall/Fischer/Shannon deterministic gates;
- white-room compaction;
- N-Nest recomputation.

### Optional accelerator roles

- trained GNN inference/training;
- LLM generation;
- dense tensor workloads.

This lets low-GPU computers participate as real Hermes/storage/recovery/verification nodes. It does
not claim a hard drive performs neural matrix multiplication.

## Pre-Asolaria GNN origin

The GNN sidecars routed by the Hermes/BigPickle fabric descend from Jesse's AI healthcare assistant.
Four model files are byte-identical between the healthcare repository and Asolaria sidecar:

```text
baseline     510f78890ec94b113f0610afbade8bafe6ca20e0
prototype    99e3087a10ee58e90c0935f5ab63b72fd3cdd07e
contrastive  56329e61eb3e6ddb3ee97b46f997dd8dd8c6b39f
gsl          886b3b0c0cdbddba983fa8c3ae083c4520d38f0e
```

The healthcare comparison is repository-reported training evidence. Later trained `.pt` artifacts
and manifests live in the trained-GNN repository.

## Independent verification

### Claude Fable 5 — operator-supplied third seat

```text
dbbh-coms-quant-prism       rustc 1.97   19/19 green
path2-two-shadow-recovery   rustc 1.97   30/30 green
```

### GPT-5.6 Pro — audit and independent CI execution

GPT-5.6 Pro audited the complete recovery, GNN, scoring, white-room, cube-mint, dispatcher,
HyperHermes, reductions, algorithms, and N-Nest chain.

GPT-authored Rust 1.97.0 workflows completed successfully:

```text
Path 1      run 29134408321   exact 19-test assertion PASS
Path 2      run 29134413119   exact 30-test assertion PASS
Q-PRISM 3D run 29134419389   all targets PASS
```

## Claim ledger

- `MEASURED`: Hermes source/contracts/tests, dispatcher/spindle surfaces, recovery crates and tests.
- `MEASURED_CLAUDE_FABLE5_THIRD_SEAT`: supplied Rust results.
- `MEASURED_GPT_DIRECTED_GITHUB_ACTIONS`: successful Rust CI.
- `AUDITED_GPT_5_6_PRO`: complete cross-repository audit.
- `BOUNDARY`: storage replaces resident state and repeated movement, not neural arithmetic.
- `UNVERIFIED`: a live cross-machine Hermes handoff joining trained GNN, Path-2 CRT, Hilbra, and
  hardware-enforced one-use shares in one transaction.
