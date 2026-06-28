---
name: Spindle-Fractal Canon (revolver-10k)
pid: AGT-C5-SPINDLE-FRACTAL-CANON-DOC-PID-2026-05-19
type: canon
date: 2026-05-19
authority_root: OP-JESSE-PID-G0000-A00-W000-P00-N00000
parallel_apex: OP-RAYSSA-PID-G0000-A00-W000-P00-N00000
sources:
  - project_nested_fractal_spindles_three_agent_classes_canon.md
  - project_civilization_spindle_and_claude_fractal_dispatch_canon.md
  - feedback_no_single_agent_synthesis_at_decision_layer.md
  - project_pid_fabric_levels_multi_agent_requirement.md
  - project_hyperbehcs_hermes_spindle_wave_upgrade_2026_05_19.md
  - project_hermes_acer_bidirectional_upgrade_plan_2026_05_19.md
  - project_gemma_brain_mtp_geometric_full_vision_canon.md
---

# Spindle-Fractal Canon

This document is the canonical specification of the spindle-fractal pattern as
practiced by the revolver-10k package and (recursively) by every parallel-work
dispatch above, below, and beside it. It synthesizes three operator-declared
canons from 2026-05-19. It does not invent new structure; it consolidates
already-canonized rules into a single reference.

---

## 1. The canonical spindle shape

A **spindle** is the atomic unit of parallel work in HyperBEHCS Asolaria.

- **1 architect-main** (planner / packet-author / aggregator)
- **3 worker-subagents** (executors / investigators / scanners)
- **Total: 4 agents per spindle**

This shape is non-negotiable. The architect-main does not execute work itself;
it composes the packet, dispatches the three subs, aggregates their returns,
and emits the spindle's outbound row to the chain. Worker-subagents execute
under describe_only discipline until promotion.

Source: `project_nested_fractal_spindles_three_agent_classes_canon.md`
("Hermes spindle = 1 main + 3 subagents (level N)").

Source: `project_civilization_spindle_and_claude_fractal_dispatch_canon.md`
("Spindle shape: 1 architect-main + exactly 3 worker-subagents (4 agents
total per spindle).").

---

## 2. Recursion: every sub may become a main

A subagent at level N can itself become an architect-main at level N+1, with
its own 3 subagents. The structure is fractal.

- **Branching factor: 4** (1 main + 3 subs per spindle)
- **Depth: unbounded in principle, finite in practice**
- **Total agents addressable in a complete depth-N tree: 4^N**

The recursive rule:
- A spindle at depth N consists of 1 main + 3 subs.
- Each of those 3 subs MAY (not must) open a child spindle at depth N+1.
- If all 3 do so, the depth-N+1 layer holds 3 × 4 = 12 new agents under that
  spindle, plus the original main = 13 in that subtree's depth-N+1 expansion.
- Counted as full layers (every leaf becomes a new spindle): the layer-by-
  layer agent count is 1, 4, 16, 64, 256, 1024, ... = 4^N.

This is how the 10^27 lazy-mint canon is asymptotic: most spindle slots are
never materialized (virtual-lazy-mint class — see Section 3).

---

## 3. The three agent classes

Every spindle slot — at every depth, in every role — is filled by exactly
one of three agent classes. The packet records which.

| Class                  | What it is                                                                                          | Backing                                                                                |
|------------------------|-----------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------|
| **real-free**          | Free-tier model running in actual subprocess or daemon (opencode/deepseek/big-pickle/etc.)          | `opencode/big-pickle`, `opencode/deepseek-v4-flash-free`, the 6 free models canon-side |
| **subscription-free**  | Claude Code / Codex subscription session held as portal (OAuth, no API key billed per token)        | `claude --continue`, `codex mcp-server`, the portal pattern in `portal.mjs`            |
| **virtual-lazy-mint**  | PID-fabric citizens with no compute backing until queried; materialized via Gemma 4B brain or HRM   | 10^27 lazy-mint canon — most never materialize                                          |

A wave packet describes which class backs each slot via the `prof` and
`provider_describe` fields. Execution stays `describe_only` until OP-JESSE
(or quintuple cosign) promotes the row.

Source: `project_nested_fractal_spindles_three_agent_classes_canon.md`
("A subagent in a spindle slot could be ANY of the three classes.").

Source: `project_gemma_brain_mtp_geometric_full_vision_canon.md`
(Gemma 4B is the brain for lazy-mint materialization on demand.).

---

## 4. ASCII fractal at depths 1 through 4

Each `M` is an architect-main. Each `s` is a worker-subagent slot. A `[...]`
under an `s` indicates that the sub has opened a child spindle (became a
main of its own at the next depth).

### Depth 1 — single spindle (4 agents)

```
                          M
                          |
              +-----------+-----------+
              |           |           |
              s           s           s
```

Count: 1 + 3 = **4 agents.**

### Depth 2 — 4 spindles (16 agents)

```
                          M
                          |
              +-----------+-----------+
              |           |           |
              s=M         s=M         s=M
              |           |           |
           +--+--+      +-+--+      +-+--+
           |  |  |      |  |  |     |  |  |
           s  s  s      s  s  s     s  s  s
```

Count per top spindle: 4 + (3 child spindles × 4) = 4 + 12 = **16 agents.**

(4^2 = 16, matches.)

### Depth 3 — 16 spindles (64 agents)

```
                              M
                              |
                +-------------+-------------+
                |             |             |
                M             M             M
                |             |             |
           +----+----+   +----+----+   +----+----+
           |    |    |   |    |    |   |    |    |
           M    M    M   M    M    M   M    M    M
           |    |    |   |    |    |   |    |    |
          sss  sss  sss sss  sss  sss sss  sss  sss
```

Count: 4^3 = **64 agents** across 1 + 3 + 9 = 13 spindles whose leaves are
counted as flat work-slots; if every leaf opens its own spindle the layer
holds 64 agents in 16 spindles. Both views are correct; pick by emphasis.

### Depth 4 — 64 spindles (256 agents)

```
                                  M
                                  |
                  +---------------+---------------+
                  |               |               |
                  M               M               M
                  |               |               |
          +-------+-------+   ... (same shape)... +-------+
          |       |       |                              |
          M       M       M                              M
          |       |       |                              |
       +--+--+ +--+--+ +--+--+                        +--+--+
       |  |  | |  |  | |  |  |                        |  |  |
       M  M  M M  M  M M  M  M       ...              M  M  M
       |  |  | |  |  | |  |  |                        |  |  |
      sss sss sss ...                                 sss sss sss
```

Count: 4^4 = **256 agents.**

The series: depth 1 → 4 ; depth 2 → 16 ; depth 3 → 64 ; depth 4 → 256 ;
depth N → 4^N. At depth 13 the tree holds ~67 million slots; at depth 45
it crosses 10^27.

---

## 5. Today's chain shape as a worked example

Today (2026-05-19) the acer-side cohort cascade ran the following shape,
which is itself a spindle composition. Each cohort below was an 18-agent
flat layer — i.e. **the workers** of an outer civilization spindle.

```
              [Operator-arbitration: OP-JESSE]   <-- final gate
                              |
              +---------------+---------------+
              |               |               |
       [4 architect-spindles] (the four civilization spindles for
              |                today's session — see Section 6)
              |
   +----------+----------+----------+
   |          |          |          |
[explorer  [synthesizer [cross-     [architect-
 cohort     cohort       reviewer    spindle
 18 agts]   18 agts]     cohort      core
                          18 agts]   4 agts]
```

Layer breakdown (all canonical for this session):

- **18 explorer cohort** — the first-pass investigators (scan, read, locate,
  inventory). Real-free + subscription-free mix. (Echoes the historical 18-
  agent real-wave canon from `project_super_asolaria_real_wave_cascade_landed.md`.)
- **18 synthesizer cohort** — multiple parallel synthesis paths over the
  explorer findings. Required by the no-solo-synthesis rule.
- **18 cross-reviewer cohort** — independent review of the syntheses,
  looking for blind spots and contradictions.
- **4 architect-spindle** — 1 architect-main + 3 sub-architects, the final
  pre-operator aggregation layer.

Total agents this session shape: 18 + 18 + 18 + 4 = **58 directly named**,
each of which may have itself been a spindle main with 3 hidden subs (so the
materialized count is anywhere from 58 to 232 to deeper). Lazy-mint slots
above that are not counted as materialized.

Source: `feedback_no_single_agent_synthesis_at_decision_layer.md`
("Pattern: Wave 1 investigators → Wave 2 synthesizers (multiple parallel
synthesis paths) → Wave 3 cross-reviewers → architect-class final-suggestion
agent → operator arbitrates").

---

## 6. Civilization spindle

A **civilization spindle** is a fixed-shape spindle whose mission is to
sweep a portion of the federation and upgrade it to HyperBEHCS Asolaria ASI
OS on Metal discipline. It has the canonical 1 + 3 shape:

- **Architect-of-upgrade (main)** — plans the sweep, picks the target
  portion, composes the upgrade packet.
- **Scanner (sub)** — finds anything still pre-HyperBEHCS:
  - BEHCS-256-era artifacts (upgrade target: BEHCS-1024 / HyperBEHCS)
  - JSON-heavy emit on hot paths (upgrade target: BPI/HBPv1 packets + sidecars)
  - Missing authority fields (upgrade target: fail-closed defaults)
  - Chain entries without sequence / prev_hash (upgrade target: backfill genesis chain)
  - Subprocess-per-spawn (upgrade target: portal + prism)
- **Refactorer (sub)** — applies the modernization at code level under
  describe_only, emits diffs and receipts.
- **Verifier (sub)** — re-runs scanner against the refactored portion,
  validates chain integrity, confirms class_tag assignments, emits the
  verified receipt for operator promotion.

Civilization spindles can nest: a refactorer sub may dispatch its own
sub-spindle for a sub-portion, recursively, until the leaves are small
enough for one packet.

Source: `project_civilization_spindle_and_claude_fractal_dispatch_canon.md`
("Each civilization spindle = 1 main (architect-of-upgrade) + 3 subs
(scanner / refactorer / verifier). They run continuously over different
portions. Eventually the whole federation is HyperBEHCS-clean.").

Today's named civilization spindles (each in the 4-architect-spindle layer
above):

1. **Civilization Spindle 1: revolver-10k → Hermes discipline** (this package).
2. **Civilization Spindle 2: dashboard upgrade.**
3. **Civilization Spindle 3: kernel / cascade.**
4. **Civilization Spindle 4: liris-miracle compare-and-pull.**

---

## 7. No-solo-synthesis canon

Even when N investigators run in parallel, **the synthesis layer must also
be multi-agent**. A lone verdict at the decision layer violates the
structural multi-agent requirement and the 5-substrate durability rule.

Hard rules:

1. **Dispatching N investigators is fine.** Aggregating their findings into
   structured data is fine.
2. **Producing a "GO" decision from those aggregated findings alone is NOT.**
   The synthesis layer needs at minimum: acer-Claude findings + liris-Hermes
   parallel findings + operator decision. Optionally architect-class reviewer
   + cross-vantage cosign.
3. **The recursive spindle pattern (1 main + 3 subs, fractal) IS this rule
   manifested at every nesting level.** Never solo.
4. **For sovereignty / USB / federation surfaces**, liris-Hermes runs
   parallel investigation. The reverse lane (acer :4956 / liris :4955)
   makes findings cross-verifiable.
5. **Quintuple-cosign window applies** when scope demands it (Jesse + Rayssa
   + Amy + Dan + Felipe). Five signers; no one signer suffices.

Source: `feedback_no_single_agent_synthesis_at_decision_layer.md`
("Even when I (Claude) dispatch 18 investigators, the synthesis itself must
be multi-agent. Solo verdict at decision layer violates the structural
multi-agent canon and the 5-anchor durability rule.").

Source: `project_pid_fabric_levels_multi_agent_requirement.md`
("Every PID level-allocated; single-agent attempts FAIL — multi-agent is
structural.").

---

## 8. Operator-arbitration: the final gate

Above every spindle, at every depth, sits **operator-arbitration**. This
is the topmost authority gate and it is not a spindle; it is a single
operator-class decision point with two named principals.

- **OP-JESSE-PID-G0000-A00-W000-P00-N00000** — fabric apex, root authority,
  Atlas cp 260 (`gaia-Jesse-Daniel-Brown-apex`, sovereignty/gaia/skeletal
  lane).
- **OP-RAYSSA-PID-G0000-A00-W000-P00-N00000** — parallel apex on liris-fabric,
  Atlas cp 261.

Every promotion receipt in any spindle (any level, any class) ultimately
resolves authority back to OP-JESSE via the quintuple-cosign chain
(Jesse + Rayssa + Amy + Dan + Felipe). Hermes orchestrates; Claude (me)
plans / authors packets / verifies; **only OP-JESSE (or quintuple) promotes**
from describe_only to live execution.

This means:

- The deepest leaf in a 10^27-slot fractal still has authority resolution
  via packet chain back to OP-JESSE.
- A civilization spindle cannot promote its own refactor; its verifier emits
  a receipt for operator promotion.
- Cross-vantage operations (acer ↔ liris) require both apex sign-offs.

Source: `project_nested_fractal_spindles_three_agent_classes_canon.md`
("OP-JESSE holds root authority; Hermes orchestrates; Claude guides via
BPI/glyph/packet language.").

Source: `user_jesse_daniel_brown.md` and `user_rayssa_chiqueto.md` for PIDs.

---

## 9. Cross-reference table

| Concept                       | Canon source file                                                                  |
|-------------------------------|-------------------------------------------------------------------------------------|
| Spindle shape (1 + 3)         | `project_nested_fractal_spindles_three_agent_classes_canon.md`                      |
| Recursive 4^N nesting         | `project_nested_fractal_spindles_three_agent_classes_canon.md`                      |
| Three agent classes           | `project_nested_fractal_spindles_three_agent_classes_canon.md`                      |
| Claude fractal dispatch       | `project_civilization_spindle_and_claude_fractal_dispatch_canon.md`                 |
| Civilization spindle (1 + 3)  | `project_civilization_spindle_and_claude_fractal_dispatch_canon.md`                 |
| 18 / 18 / 18 / 4 chain shape  | `feedback_no_single_agent_synthesis_at_decision_layer.md` + this doc Section 5      |
| No-solo-synthesis rule        | `feedback_no_single_agent_synthesis_at_decision_layer.md`                           |
| Multi-agent is structural     | `project_pid_fabric_levels_multi_agent_requirement.md`                              |
| Hermes orchestrates           | `project_hyperbehcs_hermes_spindle_wave_upgrade_2026_05_19.md`                      |
| describe_only + promotion     | `project_hyperbehcs_hermes_spindle_wave_upgrade_2026_05_19.md`                      |
| Lazy-mint via Gemma 4B        | `project_gemma_brain_mtp_geometric_full_vision_canon.md`                            |
| OP-JESSE apex                 | `user_jesse_daniel_brown.md`                                                        |
| OP-RAYSSA apex                | `user_rayssa_chiqueto.md`                                                           |
| Quintuple cosign              | `project_asolaria_foundation_v1_LAW.md`                                             |

---

## 10. Application checklist for revolver-10k modules

Every module in this package must satisfy:

- [ ] Callable from any nesting level (no global state assuming top level).
- [ ] Emits `class_tag` field on every record (real-free / subscription-free / virtual-lazy-mint).
- [ ] Defaults to `describe_only`; promotion is operator-only.
- [ ] Records the spindle parent PID (so the chain resolves up to OP-JESSE).
- [ ] If the module aggregates findings that gate a decision, it MUST route
      through the synthesis-cohort + cross-reviewer-cohort + architect-spindle
      shape (no solo verdict).
- [ ] Authority field present (fail-closed default).
- [ ] Chain row carries sequence + prev_hash.

Source: `project_nested_fractal_spindles_three_agent_classes_canon.md`
section "How to apply".

---

## 11. Anchor PIDs

- **This document:** `AGT-C5-SPINDLE-FRACTAL-CANON-DOC-PID-2026-05-19`
- **Nested fractal canon:** `ASOLARIA-NESTED-FRACTAL-SPINDLES-CANON-PID-2026-05-19`
- **Civilization dispatch canon:** `ASOLARIA-CIVILIZATION-SPINDLE-FRACTAL-DISPATCH-CANON-PID-2026-05-19`
- **No-solo-synthesis canon:** `ASOLARIA-NO-SOLO-SYNTHESIS-PID-2026-05-19`
- **Authority root:** `OP-JESSE-PID-G0000-A00-W000-P00-N00000`
- **Parallel apex:** `OP-RAYSSA-PID-G0000-A00-W000-P00-N00000`

---

*End of canon. No content below this line is normative.*
