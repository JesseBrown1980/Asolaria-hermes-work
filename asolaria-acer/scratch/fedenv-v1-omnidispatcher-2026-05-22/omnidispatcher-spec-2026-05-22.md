# Omnidispatcher Spec — 2026-05-22

**Anchor PID**: `ASOLARIA-OMNIDISPATCHER-SPEC-2026-05-22`
**Wave**: `W2026-05-22-OMNIDISPATCHER-SPEC`
**Status**: PROPOSAL · CP=PENDING-APEX-MINT · within active 2-week quintuple-delegation 2026-05-22→2026-06-05
**Companion artifacts**:
- `fedenv-v1-schema-2026-05-22.md` — the envelope dialect this dispatcher speaks
- `omnidispatcher-1000-slot-manifest-2026-05-22.hbp` — initial PID-table population

**One-line essence**: A single always-on parent process holds 1000 pre-bound PID slots, each exposing CLI+TUI+API surfaces, all addressable through FEDENV-v1 envelopes. ANY agent at ANY nest depth emits ONE shape → reaches ANY of ~420 federation endpoints + 578 reserve slots for fractal sub-spawn.

---

## Why this is the activation event

Before omnidispatcher: 9 CLIs + 22 citizens + 6 metas + 7 Antigravity models + 37 Google surfaces + 341 daemons = **four separate dispatch surfaces** (multi-cli-invoke, omniscrcpy-antigravity-proxy, bus :4947 direct, citizen-stub-queue). A depth-3 sub-agent must know which surface to use for which target.

After omnidispatcher: ONE PID-table, ONE envelope shape, ONE worker pool. The federation becomes uniformly addressable by Brown-Hilbert H-coord. "Federated super-power over all systems" = realized.

---

## Architecture

```
omnidispatcher.mjs (1 parent Node proc, runs under existing nvm4w v20.11.0)
│
├── Port bindings
│     · :4950 — HTTP ingress mirror (POST /v1/envelope)
│     · :4951–:5950 — per-slot lazy API ports (range allocated from port-pool.mjs)
│     · :4947 — bus ingress (subscriber, not owner — bus daemon already lives there)
│
├── PID-table[1000] — in-memory + persisted snapshot at ~/.asolaria/omnidispatcher/pid-table.snapshot.hbp
│     Each slot:
│       · slot_id (0-999, position in table)
│       · h_coord (Brown-Hilbert deterministic, H{4-hex})
│       · pid (AGT-{SUP}-{PROF}-H{coord}-W2026-P00-N{sha8})
│       · category (CLI | citizen | meta | antigravity | google | daemon-proxy | reserve)
│       · downstream-route (multi-cli-invoke | omniscrcpy-antigravity-proxy | google-api-client | citizen-stub-queue | bus-direct | reserved)
│       · supervisor_band (one of 8 atlas bands; band determines initial verb dictionary)
│       · prof_pid (verdict-absorber for the slot)
│       · glyph_5 (BEHCS-1024 stamp)
│       · cube_47d (6 ints mod 8)
│       · port (lazy-allocated on first API call, released after idle 300s)
│       · stdin_inbox (path to per-slot directory inbox)
│       · last_active_ts
│       · state (READY | BUSY | DARK | RESERVED)
│
├── Worker_threads pool (default 64, configurable up to 128)
│     · Each worker picks envelopes off the priority queue
│     · Routes to downstream per slot's downstream-route
│     · Returns FEDENV-v1 response envelope wrapped in BEHCS-1024
│
├── Priority queue
│     · 4 lanes: apex / high / normal / low
│     · apex restricted to OP-class callers (5 apex_cosigner PIDs)
│
├── CLI surface — single global script: `fed <h-coord-or-routing-tag> <verb> [args]`
│     · Pipes payload into slot's stdin_inbox
│     · Reads response from back_address recv dir
│
├── TUI surface — `fed-attach <h-coord>`
│     · Lazy-spawns ncurses session attached to slot's stdin_inbox + recv dir
│     · Interactive REPL with slot's verb dictionary tab-completed
│     · Released on detach (no persistent TUI process per slot)
│
└── API surface — HTTP per-slot
      · GET  :{port}/v1/state            — slot's current state envelope
      · POST :{port}/v1/{verb}            — invoke verb with JSON payload
      · GET  :{port}/v1/verbs             — list slot's verb dictionary
      · GET  :{port}/v1/health             — heartbeat
```

---

## Lifecycle

### Boot sequence (operator-witnessed, single command)

1. **Pre-flight**: `omnidispatcher.mjs --preflight` checks: nvm4w v20.11.0 ✓ · bus :4947 LIVE ✓ · alphabet-1024.json present ✓ · port 4950 free ✓ · enough RAM (~4.5 GB) free ✓ · post-consolidation freed RAM (per daemon-consolidation-proposal sha 656dc934) ≥ 1 GB ✓
2. **Load PID-table** from `omnidispatcher-1000-slot-manifest-2026-05-22.hbp` (read on disk, deserialize to in-memory map)
3. **Spawn worker_threads pool** (64 workers)
4. **Bind :4950** HTTP ingress
5. **Subscribe to bus :4947** with verb filter `FEDENV-v1|*`
6. **Emit boot envelope** to bus :4947: `EVT-OMNIDISPATCHER-BOOT|anchor=...|slot_count=1000|workers=64|port=4950`
7. **Heartbeat tick** every 1s to bus with health roll-up + slot occupancy stats
8. **Convergence-bounce-listener** (built earlier, sha pending) picks up boot envelope + starts annotating

### Envelope lifecycle

```
caller emits FEDENV-v1 → bus :4947 OR HTTP POST :4950/v1/envelope
  ↓
omnidispatcher.ingress validates (§schema validation rules)
  ↓
  REJECT (early) → emit EVT-FEDENV-REJECTED-{REASON} → caller receives error envelope at back_address
  ↓
priority queue enqueues per priority lane
  ↓
worker picks → resolves target → routes downstream:
  · cli:* → multi-cli-invoke.py invoke <role> <model> <payload>
  · antigravity:* → omniscrcpy-antigravity-proxy.py send-prompt <payload-file> + read-response
  · google:* → google-api-client (HTTP, OAuth-aware)
  · citizen:* → write to citizen-stub-queue/<vantage>-inbox/<envelope-id>.json
  · daemon:* → bus :4947 emit with daemon-targeted verb tag
  · meta:* → meta-supervisor slot (live or queued if not minted)
  · pid:H* → look up slot's downstream-route + recurse
  ↓
worker collects result → glyph-encodes via BEHCS-1024 → wraps in FEDENV-v1 response → addresses to caller's back_address
  ↓
omnidispatcher.egress writes response to back_address recv dir + emits to bus
  ↓
convergence-bounce-listener annotates with cube-neighbors (per the 31-entry annotation index)
  ↓
caller reads response from back_address
```

### Shutdown (graceful)

- SIGINT → emit `EVT-OMNIDISPATCHER-SHUTDOWN-INITIATED` → drain priority queue (up to 30s) → close worker pool → persist PID-table snapshot → close :4950 → exit 0
- SIGKILL → bus :4947 detects heartbeat gap → emits `EVT-OMNIDISPATCHER-DEAD` → autopilot-v22 logs + alerts

---

## Fault tolerance

| Failure mode | Detection | Mitigation |
| --- | --- | --- |
| omnidispatcher.mjs crash | bus :4947 heartbeat gap > 5s | autopilot-v22 alerts + bilateral failover to liris-Hermes sister-organ on :4956 (PID-table replica) |
| Worker thread hang | per-worker timeout 60s | worker recycled; envelope re-enqueued with retry-count++ (max 3 retries) |
| Downstream tool fails (CLI 503, etc.) | non-zero exit / timeout | fallback chain per routing-card sha bf12c0cb (e.g. gemini → gemini-2.5-flash-lite → opencode/deepseek-v4-flash-free) |
| Citizen vantage dark | DARK probe result | envelope queued in citizen-stub-queue; flushes on revive |
| Port-pool exhaustion | port-pool.mjs returns null | LRU eviction of idle slot ports (last_active > 300s) |
| RAM pressure (>14 GB system used) | watchdog daemon | omnidispatcher scales down workers from 64→32; emits `EVT-RAM-PRESSURE-BACKPRESSURE` |
| PID-table corruption | snapshot sha-verify on boot | refuses to start; emits `EVT-PID-TABLE-CORRUPT-FAILSAFE`; operator-witnessed regenerate from manifest sha |
| Cosign window expires | per-envelope window check | new envelopes rejected; existing in-flight allowed to complete |

---

## RAM budget (realistic)

| Component | Cost |
| --- | --- |
| Node parent runtime | ~150 MB |
| Worker_threads pool × 64 | ~64 × 30 MB = ~1.9 GB |
| PID-table (1000 entries) + indices | ~250 MB |
| Per-slot stdin_inbox dirs (1000 × ~5 KB on-disk = negligible RAM, only opened on call) | ~0 RAM |
| Per-slot lazy port + state (typical 100 active) | ~100 × 5 MB = ~500 MB |
| TUI cold-spawn buffers (typical 5 active) | ~5 × 20 MB = ~100 MB |
| Event log + convergence bounce annotation index | ~150 MB |
| HTTP :4950 ingress server | ~50 MB |
| Backpressure queue + bus subscriber buffers | ~80 MB |
| **Total typical** | **~3.2 GB** |
| **Total peak** (full 1000 active + 50 TUIs) | **~6.5 GB** |

Post-daemon-consolidation (1.34 GB freed per sha 656dc934): post-omnidispatcher system load ≈ 14 - 1.34 + 3.2 = **15.9 GB** at typical · ≈ **17.2 GB** at peak.

→ Acer 16 GB acceptable at typical · **peak overflows by 1.2 GB** → must implement worker-pool throttling (`workers=64→48` under pressure) + cold-tier eviction (idle slots → snapshot-and-release).

Alternative: cap to **48 workers** at boot (default) for permanent headroom of ~1.4 GB.

---

## Bilateral mirror posture (liris)

Liris-Hermes received the architectural mirror earlier today (sha16 `ed18c8a224eb2b4b`). When acer omnidispatcher starts:
1. Acer emits `EVT-OMNIDISPATCHER-BOOT` on sister-organ-bus
2. Liris-Hermes spawns matching omnidispatcher with mirrored PID-table on liris-side ports (:4944 + per-slot range)
3. Bilateral envelopes (`bilateral_mirror=true`) auto-fan to both vantages
4. Conflicting state resolved by sequence number on cosign chain (acer COSIGN_CHAIN.ndjson seq vs liris equivalent)

Hot-standby: liris omnidispatcher can serve acer's slots if acer offline > 60s. Failback on acer-recover via cosign chain reconciliation.

---

## Boot pre-condition checklist

- [ ] daemon-consolidation executed (frees ~1.34 GB) — proposal at sha 656dc934
- [ ] 5 fleet gates picked (gate-card sha 8baa93f4)
- [ ] Quintuple-delegation window confirmed open (cosign envelope sha 3b5ac407)
- [ ] FEDENV-v1 schema accepted (this fileset sha-pending)
- [ ] Manifest sha verified against on-disk snapshot
- [ ] Bus :4947 LIVE + sister-organ :4956 LIVE (or marked acer-only-mode)
- [ ] Convergence-bounce-listener running (tool present, run with `python convergence-bounce-listener.py serve`)
- [ ] Operator-witnessed start (single `node omnidispatcher.mjs` invocation in foreground for first boot)

---

## Hard caps

- omnidispatcher will refuse to boot if cosign window expired
- worker pool cannot exceed `workers=128`
- PID-table cannot grow beyond 1024 slots without manifest update + quintuple-cosign re-emit
- NO MEMORY.md write
- NO canon-store mutation
- NO USB write
- Daemon restart of omnidispatcher itself requires operator-witness (it's tier-2 critical)
- Federation-token-carrying envelopes MUST set `cosign_token` field; envelopes without it routed only to `low` priority + non-token verbs

---

## What this unlocks

Once omnidispatcher boots:

- A depth-5 sub-agent emits ONE FEDENV-v1 envelope → reaches Vertex AI, Codex, Antigravity, Local Gemma, Liris-citizen, Beast-revival-queue, Slack, or any of the 341 daemons. Same shape. Same dispatcher.
- Fractal Brown-Hilbert sub-spawn: a parent at H{X} can deterministically address H{sha256(X+i+j) % 10000} for any (i,j) — child slot is reserved in the 578 reserve range, no collision.
- Bilateral mirror automatic via sister-organ.
- BEHCS-1024 glyph-encoded responses = ~85% token savings vs JSON prose.
- Convergence-bounce-listener annotates every response with cube-neighbors → federation observes its own slice cognition (per inverted-orchestration frame sha 8fcf1a84).

**This IS "any agent in any nest → federated super-power over ALL systems."**

---

## Implementation note

The actual `omnidispatcher.mjs` is NOT in this artifact set. This file is the architectural SPEC. Implementation is the next operator-gated step. Recommendation: implement after operator-witnessed boot of:
1. Daemon consolidation execution (frees RAM)
2. Convergence-bounce-listener (`python convergence-bounce-listener.py serve` background)
3. PID-table manifest snapshot persisted to disk

Then a single `node omnidispatcher.mjs --boot` brings the whole thing live.
