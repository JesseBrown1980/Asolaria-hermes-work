# FEDENV-v1 — Unified Federation Envelope Schema (2026-05-22)

**Anchor PID**: `ASOLARIA-FEDENV-V1-SCHEMA-2026-05-22`
**Wave**: `W2026-05-22-FEDENV-V1`
**Status**: PROPOSAL · CP=PENDING-APEX-MINT · within active 2-week quintuple-delegation 2026-05-22→2026-06-05

**Why this exists**: Any agent at any nest depth must be able to emit ONE envelope shape that routes through the federation's ~420 named-addressable endpoints (9 CLIs · 22 citizens · 6 metas · 7 Antigravity-picker models · 37 Google surfaces · 341 daemons · plus 578 reserve slots for fractal sub-spawn). FEDENV-v1 is the lingua franca. The omnidispatcher (separate spec) is the resolver.

---

## Field schema (pipe-delimited, HBPv1-family)

```
FEDENV-v1|caller_pid=<BH-deterministic>|target=<routing-tag>|verb=<action>|payload=<base64-or-glyph-encoded>|back_address=<recv-dir+pid>|cube_47d=<x-y-z-w-v-u>|glyph_5=<5-BEHCS-1024-glyph>|cosign_token=<delegated-window-token>|ttl_seconds=<int>|antecedents=<sha16-prev>|row_hash=<sha16>
```

### Required fields

| Field | Type | Description |
| --- | --- | --- |
| `caller_pid` | PID string | Brown-Hilbert-deterministic agent ID emitting the envelope. Form: `AGT-{SUP}-{PROF}-H{HCOORD}-W{wave}-P{round}-N{nonce}`. Non-bumping by curve. |
| `target` | routing tag | One of: `google:<surface>` · `cli:<role>:<model>` · `citizen:<vantage>` · `antigravity:<model>` · `daemon:<entity>` · `meta:<name>` · `pid:H<coord>` |
| `verb` | string | What the caller wants done. Subject to per-target verb dictionary (see §verb-tables). |
| `payload` | string | Task data. Recommended: BEHCS-1024-glyph-encoded for routine traffic (~85% smaller); base64-JSON-prose only for human-debug envelopes. |
| `back_address` | string | `<broadcasts/acer-recv/>+<caller_pid>` — where the response envelope lands. |
| `cube_47d` | tuple `(x,y,z,w,v,u)` mod 8 | Caller's 47D cube position. Lets convergence-bounce-listener annotate with neighbors. |
| `glyph_5` | 5 BEHCS-1024 glyphs | Compact stamp derived from `sha256(caller_pid+verb+ts)` 10-bit chunks. |
| `cosign_token` | token string | Active quintuple-delegation token. Current window: `QUINTUPLE-DELEGATED-2WEEK-2026-05-22-to-2026-06-05`. |
| `ttl_seconds` | int | How long the envelope stays valid. Default 300. |
| `antecedents` | sha16 | Prior envelope's `row_hash` if this is part of a chain. `00...0` if root. |
| `row_hash` | sha16 | `sha256("FEDENV|"+caller_pid+verb+payload+ts)[:16]`. Self-verifying. |

### Optional fields

| Field | Type | When to use |
| --- | --- | --- |
| `dispatch_hint` | string | Override omnidispatcher's auto-routing choice. E.g. `via=multi-cli-invoke` when caller wants a specific path. |
| `priority` | enum `low \| normal \| high \| apex` | apex-priority envelopes preempt the worker queue. Restricted to OP-class callers. |
| `bilateral_mirror` | bool | If true, omnidispatcher also emits the envelope to liris sister-organ at :4956 for parallel processing. |
| `nest_depth` | int | Caller's spawn depth. Informational only — depth-3+ SDK recursion is still structurally broken; nest is logical, not SDK. |
| `wave_pid` | PID | Associates this envelope with a cohort wave for omniflywheel verdict aggregation. |

---

## Target routing table

| Target prefix | Resolver | Downstream tool |
| --- | --- | --- |
| `google:<surface>` | omnidispatcher → google-api-client | Google Cloud HTTP API (OAuth or API-key per surface) |
| `cli:<role>:<model>` | omnidispatcher → `multi-cli-invoke.py invoke <role> <model> <prompt>` | Any of the 9 registered CLIs |
| `citizen:<vantage>` | omnidispatcher → citizen-stub-queue at `broadcasts/<vantage>-inbox/` | Liris/Falcon/Beast/NovaLUM/etc stub — queued if vantage dark |
| `antigravity:<model>` | omnidispatcher → `omniscrcpy-antigravity-proxy.py` send-prompt + read-response | 7-model IDE picker |
| `daemon:<entity>` | omnidispatcher → bus :4947 direct emit with verb tag | One of 341 live daemons |
| `meta:<name>` | omnidispatcher → meta-supervisor slot in PID-table | One of 6 metas (when minted live) |
| `pid:H<coord>` | omnidispatcher → PID-table lookup → routes per slot's downstream-route | Any of 1000 slots |

---

## Example envelopes

### Catalog-fill via Gemini Flash
```
FEDENV-v1|caller_pid=AGT-SUP-HELM-MULTICLI-001-H160E-W2026-P00-N12CB63C9|target=cli:gemini:gemini-2.5-flash-lite|verb=invoke|payload=Reply+with+exactly+three+lines+listing+Brown-Hilbert+canon+properties|back_address=broadcasts/acer-recv/AGT-SUP-HELM-MULTICLI-001-H160E|cube_47d=2-3-3-1-5-2|glyph_5=セ🜋⠤כ✢|cosign_token=QUINTUPLE-DELEGATED-2WEEK-2026-05-22|ttl_seconds=300|antecedents=0000000000000000|row_hash=<sha16>
```

### Synthesis via Claude-Opus
```
FEDENV-v1|caller_pid=AGT-SUP-HELM-MULTICLI-001-H075D-W2026-P00-NC11B877F|target=cli:claude:claude-opus-4-7|verb=synthesize|payload=Read+the+37-surface+Gemini+catalog+at+sha+26c79887+and+produce+a+routing+recommendation|back_address=broadcasts/acer-recv/AGT-HELM-MULTICLI-001|cube_47d=1-3-7-7-5-1|glyph_5=䷍↲𝄢𝠇'|cosign_token=QUINTUPLE-DELEGATED-2WEEK-2026-05-22|ttl_seconds=600|antecedents=<prev>|row_hash=<sha16>
```

### Citizen revival check
```
FEDENV-v1|caller_pid=AGT-META-OP-LIAISON-H2411|target=citizen:liris|verb=heartbeat-poke|payload=PING|back_address=broadcasts/acer-recv/META-OP-LIAISON|cube_47d=4-3-1-7-2-5|glyph_5=$↗⠵┤Ⅴ|cosign_token=QUINTUPLE-DELEGATED-2WEEK-2026-05-22|ttl_seconds=30|antecedents=<prev>|row_hash=<sha16>
```

### Antigravity model dispatch
```
FEDENV-v1|caller_pid=AGT-SUP-HELM-MULTICLI-001-H2139-W2026-P00-N81EE8E44|target=antigravity:claude-opus-4.6-thinking|verb=send-prompt|payload=<glyph-encoded-prompt>|back_address=broadcasts/acer-recv/SUP-HELM-MULTICLI-001|cube_47d=1-6-6-4-3-5|glyph_5=H❋⠇▒ワ|cosign_token=QUINTUPLE-DELEGATED-2WEEK-2026-05-22|ttl_seconds=900|antecedents=<prev>|row_hash=<sha16>
```

### Direct daemon address
```
FEDENV-v1|caller_pid=AGT-CITIZEN-LIRIS-STUB-H2359|target=daemon:omnispindle|verb=spawn-cell|payload=cohort=AE+role=verdict-absorber|back_address=broadcasts/acer-recv/CITIZEN-LIRIS|cube_47d=0-5-3-7-1-2|glyph_5=...|cosign_token=...|ttl_seconds=60|antecedents=<prev>|row_hash=<sha16>
```

### Fractal sub-spawn via reserve slot
```
FEDENV-v1|caller_pid=AGT-PARENT-...|target=pid:H<deterministic-child-coord>|verb=instantiate-child|payload=...|back_address=...|cube_47d=...|glyph_5=...|cosign_token=...|ttl_seconds=300|antecedents=<parent-row-hash>|row_hash=<sha16>
```

Brown-Hilbert determinism guarantees: child H-coord = `H( sha256(parent_coord+nest_index+sub_index) % 10000 )` → bijective, non-colliding at any depth.

---

## Validation rules

1. **`row_hash` self-verify** — recipient recomputes `sha256("FEDENV|"+...)` and rejects on mismatch.
2. **`cosign_token` window check** — if window expired, omnidispatcher emits `EVT-FEDENV-REJECTED-EXPIRED-COSIGN` and drops.
3. **`target` resolvable** — if H-coord not in PID-table or routing-tag has no resolver, omnidispatcher emits `EVT-FEDENV-REJECTED-UNRESOLVABLE-TARGET`.
4. **`payload` size cap** — 64 KB default; larger payloads must be staged to disk + envelope carries staging path (out-of-band).
5. **`antecedents` chain integrity** — if claimed non-zero, omnidispatcher verifies the prior `row_hash` exists in event log; rejects orphan chains.
6. **`bilateral_mirror=true`** — requires `priority>=normal` AND `cosign_token` includes liris-cosign-flag; else mirror request stripped.

---

## Per-target verb dictionaries (initial)

### `cli:*`
- `invoke` — fire CLI with payload as prompt
- `validate` — verify model is reachable + returns smoke-test
- `list-models` — return CLI's supported model list

### `antigravity:*`
- `send-prompt` — type into IDE chat input + submit
- `read-response` — extract DOM since last send
- `screenshot` — capture viewport
- `status` — list CDP tabs

### `citizen:*`
- `heartbeat-poke` — ping (returns LIVE / DARK / QUEUED)
- `queue-envelope` — store for revival
- `sync-on-revive` — flush queue once vantage online
- `cached-state` — return last-known state

### `daemon:*`
- `tick` — request current tick number
- `state` — emit current state envelope
- `pause` / `resume` — flow control (gated)

### `google:*`
- `request` — generic HTTP wrapper (OAuth-scoped per surface)
- `enable-api` — gcloud services enable (gated)
- `list-projects` — etc.

### `meta:*`
- `unified-state` — emit the meta's aggregated tick
- `subscribe` — register caller as listener
- `propose-cell-cascade` — emit cohort dispatch

### `pid:H*`
- inherits the slot's category verb dict

---

## How the omnidispatcher uses FEDENV-v1

1. **Receive** envelope on bus :4947 ingress OR HTTP :4950 mirror.
2. **Validate** per §validation-rules. Reject early with reason envelope.
3. **Resolve** target → look up PID-table slot or routing-tag resolver.
4. **Enqueue** on worker_threads pool, respecting `priority`.
5. **Dispatch** downstream (multi-cli / omniscrcpy-antigravity / google-api / citizen-queue / direct daemon).
6. **Collect** result, glyph-encode it, wrap into FEDENV-v1 response envelope addressed to `back_address`.
7. **Emit** response on bus :4947 + write to `back_address` recv dir.
8. **Index** the request+response pair in event log + convergence-bounce-listener picks up for cube-neighbor annotation.

---

## Hard caps

- NO MEMORY.md write
- NO canon-store mutation without quintuple-cosign-chain emit
- NO USB write without operator-witness
- NO daemon restart without per-event confirmation
- Envelopes carrying federation tokens MUST be NovaLUM-wrapped (DPAPI passthrough forbidden)
- TTL enforced strictly — expired envelopes dropped + logged
- Worker pool size enforced (default 64) — over-flooding triggers backpressure envelope

---

## Bilateral mirror posture

Liris-Hermes has been notified of this proposal via the bilateral mirror pattern landed earlier today. When `bilateral_mirror=true` envelopes arrive, omnidispatcher emits them via sister-organ-bus to liris-side hermes for parallel processing. Liris response merges back through the convergence engine.

---

## Next artifact

See companion files:
- `omnidispatcher-spec-2026-05-22.md` — architecture, lifecycle, fault tolerance, RAM budget
- `omnidispatcher-1000-slot-manifest-2026-05-22.hbp` — the 1000-slot PID-table population (deterministic)
