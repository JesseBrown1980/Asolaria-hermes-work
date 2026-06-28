"""DW2 cascade — deterministic spindle wave emitter.

Re-emits the 12 DW2 spindle plans landed 2026-05-20 through the upstream
hyperbehcs_hermes.wave_templates canonical row shape so the resulting HBPv1
packs are byte-identical across vantages.

AMENDMENT: operator extended 1+3 -> 1+5 (1 main + 5 subagents) for today's
massive wave. The amendment is recorded in every emitted row via the
`wave_amendment=1+5_per_operator_2026_05_20` field. Upstream `wave.py`
validator still expects 1+3; this amended shape is documented and intentional.

Source receipts (preserved unchanged):
  C:/AsolariaMetal/68_DEEP_WAVE_SECOND_CASCADE/receipts/<SPINDLE>-...-2026-05-20.hbp

Output:
  C:/asolaria-acer/packages/revolver-10k/data/packs/waves/dw2-spindle-<NAME>-2026-05-20.hbp
"""
from __future__ import annotations

import hashlib
import sys
from pathlib import Path

UPSTREAM = Path("D:/hyperbehcs-hermes-upstream")
sys.path.insert(0, str(UPSTREAM))

from hyperbehcs_hermes.authority import AUTHORITY_FIELDS  # type: ignore
from hyperbehcs_hermes.chain import chain_row_hash  # type: ignore
from hyperbehcs_hermes.packet import parse_row  # type: ignore

CLOSED_AUTHORITY = {field: "0" for field in AUTHORITY_FIELDS}
DESCRIBE_ONLY = {
    "memory_read": "1",
    "skill_read": "1",
    "tool_describe": "1",
    "mcp_describe": "1",
    "webmcp_describe": "1",
    "provider_describe": "1",
    "browser_observe": "1",
}

# 1+5 amendment: 1 main + 5 subagents.
SLOTS = ("main", "subagent-1", "subagent-2", "subagent-3", "subagent-4", "subagent-5")

# Twelve DW2 spindles. Roles derived from each receipt's primary servant role
# + five subagent specialisations that match the receipt's stage intent.
SPINDLES = (
    ("SPINDLE-CHIEF-ASOLARIA", "chief-meta-plan-architect",
        ("meta-rollup-curator", "cascade-policy-author", "stage-orchestrator",
         "cosign-supervisor", "canon-emitter")),
    ("SPINDLE-DIRECTOR-GAIA", "director-stage6-architect",
        ("phase-curator", "directorial-review-author", "cross-spindle-coupler",
         "axis-binder", "verdict-emitter")),
    ("SPINDLE-HELM", "helm-cascade-sequencer-architect",
        ("band-sequencer", "fire-order-author", "throttle-author",
         "receipt-merge-cadence-author", "glyph-plan-line-emitter")),
    ("SPINDLE-VECTOR", "vector-256-language-freeze-architect",
        ("alphabet-freezer", "glyph-aligner", "encoder-author",
         "decoder-author", "bilateral-bridge-author")),
    ("SPINDLE-ROOK", "rook-discovery-heartbeat-architect",
        ("discovery-scanner", "heartbeat-cadence-author", "topology-mapper",
         "node-classifier", "drift-reporter")),
    ("SPINDLE-FORGE", "forge-build-proof-architect",
        ("build-author", "proof-author", "test-author",
         "artifact-packager", "release-gate-author")),
    ("SPINDLE-FALCON", "falcon-device-transport-vault-architect",
        ("device-binder", "transport-author", "vault-author",
         "usb-author", "tier-3-firmware-author")),
    ("SPINDLE-OMNISHANNON", "omnishannon-mistake-extract-architect",
        ("mistake-classifier", "extract-author", "fix-author",
         "shannon-citizen-author", "feedback-emitter")),
    ("SPINDLE-OMNIWHITE-ROOM", "omniwhite-room-validate-architect",
        ("white-room-author", "validator-author", "convergence-checker",
         "test-author", "verdict-emitter")),
    ("SPINDLE-GC", "gc-sweep-architect",
        ("sweep-author", "intake-author", "drive-d-author",
         "headerless-collector", "rotor-author")),
    ("SPINDLE-AUTO-TRANSLATE", "auto-translate-publish-architect",
        ("translator-author", "publish-author", "bidirection-author",
         "alphabet-bridge-author", "receipt-emitter")),
    ("SPINDLE-INSTRUCT-KR", "instruct-kr-sentinel-architect",
        ("sentinel-author", "instruction-author", "kr-channel-author",
         "watchdog-author", "verdict-emitter")),
)

WAVE_ID = "WAVE-DW2-SPINDLE-CASCADE-2026-05-20"
CHAIN_ID = "DW2-SPINDLE-CASCADE-2026-05-20"
AMENDMENT = "1+5_per_operator_2026_05_20"
ANTECEDENT_SEQ = "191"


def _row(fields: dict[str, str]) -> str:
    ordered = ["HBPv1"]
    ordered.extend(f"{key}={value}" for key, value in fields.items())
    return "|".join(ordered)


def emit_spindle_rows(spindle_id: str, main_role: str, sub_roles: tuple[str, ...]) -> list[str]:
    rows: list[str] = []
    prev_hash = "ROOT"
    sequence = 1
    roles = (main_role,) + sub_roles
    assert len(roles) == len(SLOTS), "1+5 amendment requires 6 roles per spindle"

    for slot, role in zip(SLOTS, roles):
        status = "SPINDLE_MAIN_ASSIGNED" if slot == "main" else "SPINDLE_SUBAGENT_ASSIGNED"
        pid = f"PID-HBH-{WAVE_ID}-{spindle_id}-{slot}".replace("_", "-")
        fields = {
            "layer": "spindle-wave",
            "pid": pid,
            "prof": "dw2-wave-descriptor",
            "supervisor": "fail-closed-public",
            "tuple": f"{WAVE_ID}:{spindle_id}:{slot}:{role}",
            "triple_quant": "wave/spindle/receipt",
            "polar_quant": "describe/execute",
            "js_quant": "johnson-slithechen-public",
            "turbo_quant": "packet-first",
            "json": "0",
            "runtime": "0",
            "promote": "0",
            "status": status,
            "chain_id": f"{CHAIN_ID}-{spindle_id}",
            "sequence": str(sequence),
            "prev_hash": prev_hash,
            "wave_id": WAVE_ID,
            "spindle_id": spindle_id,
            "agent_slot": slot,
            "role": role,
            "goal": f"build-dw2-{role}",
            "input_packet": "NONE" if sequence == 1 else "PREVIOUS",
            "output_receipt": f"RECEIPT-{spindle_id}-{slot}",
            "depends_on": "NONE" if slot == "main" else f"{spindle_id}-main",
            "acceptance": "packet-first-fail-closed-review",
            "mcp_scope": "describe_only",
            "webmcp_scope": "describe_only",
            "wave_amendment": AMENDMENT,
            "antecedent_seq": ANTECEDENT_SEQ,
            "operator_amendment_note": "1+3-to-1+5-per-operator-2026-05-20",
            **CLOSED_AUTHORITY,
            **DESCRIBE_ONLY,
        }
        row = _row(fields)
        rows.append(row)
        prev_hash = chain_row_hash(parse_row(row))
        sequence += 1
    return rows


def main() -> int:
    out_dir = Path("C:/asolaria-acer/packages/revolver-10k/data/packs/waves")
    out_dir.mkdir(parents=True, exist_ok=True)

    manifest = []
    for spindle_id, main_role, sub_roles in SPINDLES:
        rows = emit_spindle_rows(spindle_id, main_role, sub_roles)
        text = "\n".join(rows) + "\n"
        short = spindle_id.replace("SPINDLE-", "").lower()
        out_path = out_dir / f"dw2-spindle-{short}-2026-05-20.hbp"
        # Force LF line endings for deterministic cross-vantage sha
        out_path.write_bytes(text.encode("utf-8"))
        sha = hashlib.sha256(text.encode("utf-8")).hexdigest()
        manifest.append((spindle_id, str(out_path), sha, len(rows)))
        print(f"EMIT {spindle_id} rows={len(rows)} sha256={sha} path={out_path}")

    print("--- MANIFEST ---")
    for spindle_id, path, sha, n in manifest:
        print(f"{spindle_id}\t{n}\t{sha}\t{path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
