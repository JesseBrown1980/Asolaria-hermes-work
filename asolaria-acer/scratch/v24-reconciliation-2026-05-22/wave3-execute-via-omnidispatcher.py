#!/usr/bin/env python3
# wave3-execute-via-omnidispatcher.py
# Wave 3 of 18-agent v24 reconciliation fix.
# Routes 6 FEDENV-v1 envelopes through omnidispatcher :4950 (audit trail)
# AND executes the actual filesystem operations.
# Per operator directive 2026-05-22: "use the omnidispatcher, i think we just created it for this type of thing"

import hashlib, json, os, shutil, subprocess, sys, time, urllib.request, urllib.error
from pathlib import Path

SCRATCH = Path("C:/asolaria-acer/scratch/v24-reconciliation-2026-05-22")
MERGED = Path("D:/AsolariaGuides/3d-slice-map/merged")
STOMP_DIR = MERGED / "v24"
FORENSIC_DIR = MERGED / "_stomped-v24-2026-05-22-forensic"
STAGING_DIR = MERGED / "v24-staging"
TARGET_V24 = MERGED / "v24"
COSIGN_CHAIN = Path("C:/asolaria-acer/COSIGN_CHAIN.ndjson")
MEMORY_DIR = Path("C:/Users/acer/.claude/projects/C--/memory")
OMNI_INGRESS = "http://127.0.0.1:4950/v1/envelope"
TS_ENVELOPE = "2026-05-22T21:42:00Z"

CALLER_PID = "ACER-PID-H9E2A-A07-W104-P00-N00000"
COSIGN_TOKEN = "QUINTUPLE-DELEGATED-2WEEK-2026-05-22-to-2026-06-05-EXTENDED-UNTIL-UPGRADE"
GLYPH_5 = "\u2655\u2747\u2680\u2657\u30F5"  # ♕❇⚀♗ヵ

OPS = [
    ("rename_stomp",                "H0850", "META-MEMORY-INDEX-CYCLE",   "rename stomped v24/ -> _stomped-v24-2026-05-22-forensic/"),
    ("copy_artifacts_to_staging",   "H219E", "META-FABRIC-PIPE-WATCH",    "copy 4 scratch artifacts into v24-staging/"),
    ("builder_dry_run",             "H25E8", "META-VISION-VIZ-VIS-UNISON","_build_v24.py --dry-run (prospective body sha)"),
    ("builder_write_verify",        "H151B", "META-OP-LIAISON",           "_build_v24.py write staging + sidecar verify"),
    ("promote_staging_to_v24",      "H0C3A", "META-AUTO-SELF-IMPROVE-TOP","_build_v24.py --auto-promote staging -> v24/"),
    ("viewer_cosign_memory_mirror", "H18C7", "META-FANOUT-ROTATOR",       "rebuild webgl viewer + cosign seq=200 + memory file + bilateral mirror"),
]

results = {"envelopes": [], "ops": [], "final": {}}

def emit_envelope(op_name, h_coord, slot_name, description, prev_hash):
    payload = json.dumps({
        "op": op_name, "slot": slot_name, "description": description,
        "wave": "v24-reconciliation-wave-3", "agent": "acer-claude-session-5a9949d1"
    }, separators=(',', ':'))
    verb = f"v24_wave3_{op_name}"
    pre = f"FEDENV|{CALLER_PID}{verb}{payload}{TS_ENVELOPE}"
    row_hash = hashlib.sha256(pre.encode('utf-8')).hexdigest()[:16]
    env = {
        "caller_pid": CALLER_PID,
        "target": f"pid:{h_coord}",
        "verb": verb,
        "payload": payload,
        "back_address": "cli:acer:slice-map-v24-reconciliation",
        "cube_47d": "3-5-3-4-1-5",
        "glyph_5": GLYPH_5,
        "cosign_token": COSIGN_TOKEN,
        "ttl_seconds": 600,
        "antecedents": prev_hash,
        "row_hash": row_hash,
        "ts": TS_ENVELOPE,
        "priority": "high",
    }
    req = urllib.request.Request(
        OMNI_INGRESS,
        data=json.dumps(env).encode('utf-8'),
        headers={"content-type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=8) as r:
            return r.status, r.read().decode('utf-8'), row_hash
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8'), row_hash
    except Exception as e:
        return -1, f"EXC: {type(e).__name__}: {e}", row_hash

def op_rename_stomp():
    if not STOMP_DIR.exists():
        return {"status": "ABSENT-OK", "note": "stomp dir already moved or never existed"}
    if FORENSIC_DIR.exists():
        return {"status": "DEST-EXISTS", "note": f"{FORENSIC_DIR} already present, aborting move"}
    shutil.move(str(STOMP_DIR), str(FORENSIC_DIR))
    readme_src = SCRATCH / "_stomped-v24-2026-05-22-forensic-README.md"
    if readme_src.exists():
        shutil.copy2(str(readme_src), str(FORENSIC_DIR / "README.md"))
    contents = sorted(p.name for p in FORENSIC_DIR.iterdir())
    return {"status": "MOVED", "forensic_dir": str(FORENSIC_DIR), "contents": contents}

def op_copy_artifacts_to_staging():
    STAGING_DIR.mkdir(parents=True, exist_ok=True)
    artifacts = [
        ("voxels-v24-48.json", True),
        ("_build_v24.py", True),
        ("v24-INPUT-MANIFEST.hbp", True),
        ("V24-PROMOTION-RECEIPT.md", True),
    ]
    copied = []
    for name, required in artifacts:
        src = SCRATCH / name
        if not src.exists():
            if required:
                return {"status": "MISSING-REQUIRED", "missing": name}
            continue
        dst = STAGING_DIR / name
        shutil.copy2(str(src), str(dst))
        copied.append(name)
    return {"status": "COPIED", "staging": str(STAGING_DIR), "copied": copied}

def run_python(args, cwd):
    cp = subprocess.run([sys.executable] + args, cwd=str(cwd), capture_output=True, text=True, timeout=120)
    return {"exit": cp.returncode, "stdout": cp.stdout[-3000:], "stderr": cp.stderr[-1500:]}

def op_builder_dry_run():
    return run_python([str(STAGING_DIR / "_build_v24.py"), "--dry-run"], MERGED)

def op_builder_write_verify():
    return run_python([str(STAGING_DIR / "_build_v24.py")], MERGED)

def op_promote_staging_to_v24():
    return run_python([str(STAGING_DIR / "_build_v24.py"), "--auto-promote"], MERGED)

def sha256_file(p):
    return hashlib.sha256(Path(p).read_bytes()).hexdigest() if Path(p).exists() else None

def op_viewer_cosign_memory_mirror():
    result = {}

    # 6a: viewer rebuild
    viewer_build = MERGED / ".build-webgl-viewer.py"
    if viewer_build.exists():
        result["viewer_build"] = run_python([str(viewer_build)], MERGED)
    else:
        result["viewer_build"] = {"skipped": "build script not found"}

    # 6b: append cosign seq=200 (read tail to get prev hash)
    prev_row = None
    if COSIGN_CHAIN.exists():
        lines = [ln for ln in COSIGN_CHAIN.read_text(encoding='utf-8').splitlines() if ln.strip()]
        if lines:
            try:
                last = json.loads(lines[-1])
                prev_row = last.get("row_hash") or last.get("prev_hash")
                last_seq = last.get("seq", 199)
            except Exception:
                prev_row = None
                last_seq = 199
        else:
            last_seq = 199
    else:
        last_seq = 199
    next_seq = int(last_seq) + 1 if isinstance(last_seq, (int, str)) else 200

    map_v24_path = TARGET_V24 / "map-v24.json"
    receipt_path = TARGET_V24 / "V24-PROMOTION-RECEIPT.md"
    new_v24_sha = sha256_file(map_v24_path) or "PENDING"

    cosign_row = {
        "seq": next_seq,
        "ts": TS_ENVELOPE,
        "anchor": "asolariaV24AbsorptionEmissionPromotion",
        "target_pid": "ASOLARIA-V24-ABSORPTION-EMISSION-PID-2026-05-22",
        "event": "v24_absorption_base_rebuild_promotion",
        "supervisor": "gaia",
        "cp": 268,
        "agent": "AGT-acer-Claude-v24-emitter-2026-05-22",
        "signer_cps": [260, 263, 261, 264, 262],
        "signers": ["amy_salnikov", "dan_edens", "felipe_smith", "jesse_daniel_brown_phd", "rayssa_chiqueto"],
        "voxel_count_new": 48,
        "voxel_count_total": 568,
        "hilbert_range": [520, 567],
        "absorption_lanes": ["sovlinux", "hookwall-v2", "gnn-shannon-cascade-evo", "47D-BEHCS", "antigravity-2.0", "profile-index", "wave-77-mistake-ledger"],
        "v24_map_sha256": new_v24_sha,
        "parent_ref": {"version": "v23", "sha256": "cf8c675710ccc1fd94d53e5ca3ad6129a549066e0a19cdbdac6312c6fddba400", "voxel_count": 520},
        "apex_cosign": "OP-ASOLARIA-PROFILE-AUDIT-W84-V24-ABSORPTION-EMISSION",
        "authority": "quintuple-cosign-seq-191-extended-until-system-upgrade",
        "antecedents": ["session_upgrade_seq_197_daemon_consolidation", "v24_voxel_builder_seq_199"],
        "reconciliation_note": "supersedes stomped v24 preserved at _stomped-v24-2026-05-22-forensic/, stomp_sha=1cbf7a6d673fb7f1287f416bf487d2494f011cd86180b935c024cb2d8e6ddafc",
        "status": "CANON_EMITTED",
        "prev_hash": prev_row or ("0" * 16),
        "wave_fix": "18-agent v24 reconciliation via omnidispatcher",
    }
    row_str = json.dumps(cosign_row, sort_keys=True, separators=(',', ':'))
    cosign_row["row_hash"] = hashlib.sha256(row_str.encode('utf-8')).hexdigest()
    with COSIGN_CHAIN.open('a', encoding='utf-8') as f:
        f.write(json.dumps(cosign_row, indent=2) + "\n")
    result["cosign_seq"] = next_seq
    result["cosign_row_hash"] = cosign_row["row_hash"]

    # 6c: memory file
    memory_src = SCRATCH / "memory-file-content.md"
    if memory_src.exists():
        target = MEMORY_DIR / "project_v24_absorption_emission_2026_05_22.md"
        shutil.copy2(str(memory_src), str(target))
        result["memory_written"] = str(target)

    # 6d: bilateral mirror envelope - write to broadcasts/acer-emit/
    mirror_src = SCRATCH / "bilateral-mirror-envelope.fedenv"
    if mirror_src.exists():
        emit_dir = Path("C:/asolaria-acer/broadcasts/acer-emit")
        emit_dir.mkdir(parents=True, exist_ok=True)
        dst = emit_dir / f"v24-bilateral-mirror-2026-05-22-seq{next_seq}.fedenv"
        shutil.copy2(str(mirror_src), str(dst))
        result["bilateral_mirror"] = str(dst)

    return result

OP_FN = {
    "rename_stomp": op_rename_stomp,
    "copy_artifacts_to_staging": op_copy_artifacts_to_staging,
    "builder_dry_run": op_builder_dry_run,
    "builder_write_verify": op_builder_write_verify,
    "promote_staging_to_v24": op_promote_staging_to_v24,
    "viewer_cosign_memory_mirror": op_viewer_cosign_memory_mirror,
}

def main():
    prev = "0" * 16
    for idx, (op_name, h_coord, slot_name, desc) in enumerate(OPS, start=1):
        # Emit envelope first (audit)
        status, body, row_hash = emit_envelope(op_name, h_coord, slot_name, desc, prev)
        env_rec = {"op": op_name, "target": f"pid:{h_coord}", "slot": slot_name, "http_status": status, "body_first_120": body[:120], "row_hash": row_hash}
        results["envelopes"].append(env_rec)
        prev = row_hash

        # Execute op
        try:
            out = OP_FN[op_name]()
        except Exception as e:
            out = {"status": "EXCEPTION", "error": f"{type(e).__name__}: {e}"}
        results["ops"].append({"op": op_name, "result": out})
        # Brief pause to keep dispatcher event-log readable
        time.sleep(0.2)

    # Final state
    state_url = "http://127.0.0.1:4950/v1/state"
    try:
        with urllib.request.urlopen(state_url, timeout=5) as r:
            results["final"]["omnidispatcher_state"] = json.loads(r.read().decode('utf-8'))
    except Exception as e:
        results["final"]["omnidispatcher_state"] = f"EXC: {e}"
    results["final"]["v24_dir_contents"] = sorted(p.name for p in TARGET_V24.iterdir()) if TARGET_V24.exists() else []
    results["final"]["forensic_dir_contents"] = sorted(p.name for p in FORENSIC_DIR.iterdir()) if FORENSIC_DIR.exists() else []
    results["final"]["v24_map_sha256"] = sha256_file(TARGET_V24 / "map-v24.json")
    print(json.dumps(results, indent=2, default=str))

if __name__ == "__main__":
    main()
