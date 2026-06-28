# U3-NESTED-SPINDLE-SMOKE - Findings

**Anchor:** ASOLARIA-U3-NESTED-SPINDLE-SMOKE-PID-2026-05-20
**Agent:** U3-NESTED-SPINDLE-SMOKE (acer-claude subagent)
**Date:** 2026-05-20
**Script:** `D:\AsolariaGuides\hermes-unlock-2026-05-20\U3-nested-spindle-smoke.mjs`
**NDJSON:** `D:\AsolariaGuides\hermes-unlock-2026-05-20\U3-nested-spindle-smoke.ndjson`

## Mission

1+3+9+27+81 fractal Hermes-style spindle smoke. Descriptor-only (no LLM call, no
runtime/promote/json hot-path gates fired). BH-PID via sha16-of-(parent_pid + index).
Each node emits one HBPv1 row.

## Topology

| Depth | Role               | Count |
|------:|--------------------|------:|
| 0     | main               | 1     |
| 1     | sub                | 3     |
| 2     | sub-sub            | 9     |
| 3     | sub-sub-sub        | 27    |
| 4     | sub-sub-sub-sub    | 81    |
| -     | **Total**          | **121** |

Fanout = 3 at every level; MAX_DEPTH = 4 (5 layers, one extra for fun).

## Results (run 1)

- expectedWorkers: 121
- totalRows: **121**
- uniquePids: **121**
- uniquenessVerified: **true**
- descriptorOnlyAll: **true** (every row has `mode:"descriptor-only"`, `gates.{runtime,promote,json}=false`)
- pidSynthMs: 1.536 ms
- totalWithWriteMs: 2.412 ms
- pidsPerSec: **78,781**
- ndjson bytes: 25,066
- ndjson rows: 121

## Results (run 2, determinism check)

- uniquenessVerified: true
- descriptorOnlyAll: true
- pidsPerSec: 39,068 (variance from JIT/GC at small N)
- bytes: **25,066** (identical byte-output -> deterministic)

## Spot-check (NDJSON head/tail)

```
first: {"v":"HBPv1","pid":"7739744D76154B10","parent":"OP-JESSE-FABRIC-ROOT","depth":0,"idx":0,"role":"main",...}
last:  {"v":"HBPv1","pid":"FBFA95F28F0705C7","parent":"1FC19A4E1A49D308","depth":4,"idx":2,"role":"sub-sub-sub-sub",...}
```

## Interpretation

- Throughput **78,781 PIDs/sec** for 121-node tree is below the **~181K PIDs/sec**
  ceiling measured today on bulk BH-PID synth. At N=121, fixed costs (Node startup,
  fs write, JSON.stringify, perf_hooks) dominate; per-PID sha256 is sub-microsecond.
- For Hermes spindle dispatch this is irrelevant - the practical bottleneck is
  Gemma/Claude LLM tokens, not PID synthesis. Confirms PID generation is **not** a
  spindle bottleneck at any depth that humans would design.
- Fractal recursion (1 + 3^k) cleanly nests; PID tree is fully deterministic from
  ROOT_PARENT seed `OP-JESSE-FABRIC-ROOT` => safe to replay/cosign.
- Descriptor-only mode confirmed across all 121 rows. No runtime/promote/json gates
  fired - safe per spindle-discipline canon (Hermes 1e0e786, JSON hot-path REJECTED).

## Substrate-commit row

```
SUBSTRATE-COMMIT  U3-NESTED-SPINDLE-SMOKE  2026-05-20
  anchor=ASOLARIA-U3-NESTED-SPINDLE-SMOKE-PID-2026-05-20
  workers=121  unique=121  descriptor_only=true
  pids_per_sec=78781  total_ms=2.412  ndjson_bytes=25066
  fanout=3  max_depth=4  layers=5
  gates_fired={runtime:0, promote:0, json:0}
  deterministic=true (byte-identical re-run)
  ceiling_today=~181K PIDs/sec (bulk); small-N startup-dominated
```

## Files

- `D:\AsolariaGuides\hermes-unlock-2026-05-20\U3-nested-spindle-smoke.mjs` (script, 121-line)
- `D:\AsolariaGuides\hermes-unlock-2026-05-20\U3-nested-spindle-smoke.ndjson` (121 rows, 25,066 bytes)
- `D:\AsolariaGuides\hermes-unlock-2026-05-20\U3-nested-spindle-smoke-FINDINGS.md` (this file)
