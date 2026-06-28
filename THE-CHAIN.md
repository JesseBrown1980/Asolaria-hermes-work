# THE CHAIN — from the collision discipline back to the running Hermes fleet

The repos updated this session are not separate notes — they are one chain. Read **backwards** (newest
update → the running fleet): each link is a law or mechanism the link below it obeys, and the **Hermes
fleet in this repo is where all of them become a running thing.**

```
 [5] waves & cascades   ── collision DISCIPLINE (avoid in execution, cause in search)
        │  governs how addresses behave
        ▼
 [4] algorithms         ── the SERVICE-MULTIPLICATION ALGORITHM (replicate S → N×M reductions)
        │  formalises the scaling
        ▼
 [3] reductions         ── the PRINCIPLE: multiplying a service multiplies the PRISM reductions
        │  why scaling pays
        ▼
 [2] full-works emitter ── the SOURCE: 200ns revolver PID emitter + multi-emitter (24→10k spindles)
        │  produces the PID signals
        ▼
 [1] omni-dispatcher    ── the ROUTER: FEDENV envelopes → 1000-slot table → worker_threads
        │  delivers the signals
        ▼
 [0] THIS REPO (Hermes) ── the FLEET: 24× HERMES-SPINDLE-PID + sup-hermes-spindle-dispatcher
                            (registered first-class citizen) + the agent + absorption + Host-8
                            runtime + the 10k/20k/100k kernel fleets — where it all RUNS
```

## Walking it backwards

### [5] `Asolaria-waves-and-cascades-avoiding-collsions-and-causing-them` — the collision discipline
Two regimes. **Avoid** (execution lanes): collision-free *by construction* — brown-hilbert
space-filling (never self-intersects) × prime branching (coprime/CRT, `D#=prime(n)³`, 5th/7th) ×
rule-of-three ternary subdivision × sha16-chained PIDs × port.port.port nesting × rename-before-load;
backstop `CATEGORY_PRECEDENCE`; birthday bound at 10^9030. **Cause** (search lanes): cascade waves into
a *separate* region on purpose → interference = compute → converge to the PRISM many→1.
→ *This is why the fleet's billions of spindle ops never collide, and how a wave search finds answers.*

### [4] `Algorithms-of-Asolaria` — the algorithm
`SERVICE-MULTIPLICATION-ALGORITHM.md`: take a service `S = emit → loop → PRISM-reduce`; replicate it
across `N` emitter-threads and `M` spindles (24→10k); the rename seam makes each replica free → `N×M`
independent reduction streams. Reduction-scaling **by replication**, not by tuning the reducer.
→ *This is the formal rule the spindle fleet is grown by.*

### [3] `what-is-asolaria---how-do-we-get-reductions-in-everything` — the principle
`MULTI-EMITTER-SERVICE-MULTIPLICATION.md`: the PRISM step (`planPrismRoute`, reverse_gain GNN) is a
many→1 reduction per cycle. One emitter = one reduction stream; `N×M` replicas = `N×M` parallel PRISM
reductions — for free. **Not 1 signal → 1 reduction; many signals → many reductions.**
→ *This is why multiplying the Hermes spindles is worth doing: it multiplies the reductions.*

### [2] `Asolaria-the-full-works-200-nanoseconds-agent-emitter-plus-` — the source
The **200ns revolver PID emitter** (`PIDChainRevolver.next()` / `sha16(seed)`, ~5M PID/s, MEASURED) +
the full `asolaria-loop` cycle (revolver → rename-free → agent → HOOKWALL → PRISM → GC, ×100k) + the
**multi-emitter** design (divide threads + multiply service → ~1.16 trillion agents/sec, OPERATOR-CANON).
→ *This is what emits the PID signals the Hermes dispatcher consumes.*

### [1] `omni-dispatcher` — the router
Consumes FEDENV-v1 envelopes (HTTP :4950 / bus :4947 / pid-inboxes) → `resolveTarget` → 4-lane queue →
48 worker_threads → response on bus. It only *routes* — the emitter [2] is its source. `EMITTER.md`
there documents the pairing.
→ *This is the registered Hermes spindle dispatcher's routing core.*

### [0] `Asolaria-hermes-work` (this repo) — the fleet, where it runs
All of the above is instantiated here: **24× `agt-HERMES-SPINDLE-PID-NN`** + **24× `agt-BASIN-SPINDLE`**
+ the dispatcher as a **registered first-class citizen** (`sup-hermes-spindle-dispatcher-e08300d7e4a33186`)
+ the self-improving agent (learning loop) + the formal nous-hermes absorption + the Host-8 Rust
`agent_runtime` + the 10k/20k/100k kernel fleets & stubbed rooms. The emitter [2] feeds the dispatcher
[1] which materialises these spindles; they obey the reduction principle [3]/algorithm [4] and the
collision discipline [5]. **The chain ends here because here it stops being a mechanism and starts being
a fleet.**

---
Status: source/docs only; gated / E=0 / describe-only (no fire, no cutover without operator authority).
Each repo in the chain carries a `CHAIN.md` pointer back to this terminus.
