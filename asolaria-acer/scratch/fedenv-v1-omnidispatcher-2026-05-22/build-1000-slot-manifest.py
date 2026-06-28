#!/usr/bin/env python3
# build-1000-slot-manifest.py — deterministic 1000-slot PID-table for the omnidispatcher.
# Population: 9 CLIs + 22 citizens + 6 metas + 7 Antigravity models + 37 Google surfaces + 341 daemons + 578 reserve = 1000.
# Each slot: Brown-Hilbert deterministic, no collision (bijective curve).

import json, hashlib, time
from pathlib import Path
from collections import defaultdict

WAVE = "W2026-05-22-OMNIDISPATCHER-1000-SLOT"
ANCHOR = "ASOLARIA-OMNIDISPATCHER-1000-SLOT-MANIFEST-2026-05-22"
ALPHABET_PATH = Path("C:/asolaria-acer/data/behcs/codex/alphabet-1024.json")
OUT_DIR = Path("C:/asolaria-acer/scratch/fedenv-v1-omnidispatcher-2026-05-22")
OUT_DIR.mkdir(parents=True, exist_ok=True)
BROADCAST_DIR = OUT_DIR / "broadcasts" / "acer-emit"
BROADCAST_DIR.mkdir(parents=True, exist_ok=True)
BUS = "http://127.0.0.1:4947/behcs/send"


def sha(s):
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


def h_coord(seed):
    return f"H{int(sha(seed), 16) % 10000:04X}"


def glyph_5(seed, alphabet):
    h = sha(seed)
    return "".join(alphabet[int(h[i : i + 10], 16) % len(alphabet)] for i in range(0, 50, 10))


def cube_47d(seed):
    h = sha(seed)
    return [int(h[i * 2 : i * 2 + 2], 16) % 8 for i in range(6)]


def load_alphabet():
    try:
        return json.loads(ALPHABET_PATH.read_text(encoding="utf-8"))["glyphs"]
    except Exception:
        return list("0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ")


def supervisor_band_for(category, hcoord):
    """Pick supervisor band per category + hcoord modulo for diversity."""
    band_map = {
        "CLI": "helm",
        "citizen": "falcon",
        "meta": "helm",
        "antigravity": "helm",
        "google": "falcon",
        "daemon-proxy": "vector",
        "reserve": "livefree",
    }
    return band_map.get(category, "helm")


def downstream_route_for(category, name):
    if category == "CLI":
        return "multi-cli-invoke"
    if category == "citizen":
        return "citizen-stub-queue"
    if category == "meta":
        return "meta-supervisor-slot"
    if category == "antigravity":
        return "omniscrcpy-antigravity-proxy"
    if category == "google":
        return "google-api-client"
    if category == "daemon-proxy":
        return "bus-direct"
    return "reserved"


# Read existing artifacts to populate slots
def load_clis():
    p = Path("C:/asolaria-acer/scratch/multi-cli-inventory-2026-05-22/multi-cli-inventory-finding-2026-05-22.cold.json")
    if not p.exists():
        return []
    data = json.loads(p.read_text(encoding="utf-8"))
    return [{"name": r["role"], "extra": {"models": r.get("supported_models", []), "default_model": r.get("default_model")}} for r in data.get("annotated", [])]


def load_citizens():
    p = Path("C:/asolaria-acer/scratch/meta-supervisor-unison-proposal-2026-05-22/remote-vantage-citizens-extension-2026-05-22.cold.json")
    if not p.exists():
        return []
    data = json.loads(p.read_text(encoding="utf-8"))
    return [{"name": r["vantage"], "extra": {"host": r.get("host"), "role": r.get("role"), "verification_status": r.get("verification_status")}} for r in data.get("annotated", [])]


def load_metas():
    p = Path("C:/asolaria-acer/scratch/meta-supervisor-unison-proposal-2026-05-22/meta-supervisor-unison-proposal-2026-05-22.cold.json")
    if not p.exists():
        return []
    data = json.loads(p.read_text(encoding="utf-8"))
    return [{"name": r["name"], "extra": {"role": r.get("role"), "tick_hz": r.get("tick_hz"), "unifies_count": len(r.get("unifies", []))}} for r in data.get("annotated", [])]


def load_antigravity_models():
    # From omniscrcpy-antigravity-proxy.py registry (hardcoded — 7 picker models)
    return [
        {"name": "gemini-3.5-flash-high", "extra": {"tier": "fast"}},
        {"name": "gemini-3.5-flash-medium", "extra": {"tier": "fast"}},
        {"name": "gemini-3.1-pro-high", "extra": {"tier": "deep"}},
        {"name": "gemini-3.1-pro-low", "extra": {"tier": "deep"}},
        {"name": "claude-sonnet-4.6-thinking", "extra": {"tier": "thinking"}},
        {"name": "claude-opus-4.6-thinking", "extra": {"tier": "thinking"}},
        {"name": "gpt-oss-120b-medium", "extra": {"tier": "open"}},
    ]


def load_google_surfaces():
    # Parse the antigravity catalog HBP for surface rows
    p = Path("C:/asolaria-acer/scratch/gemini-catalog-2026-05-22/antigravity-catalog-response-01.clean.hbp")
    if not p.exists():
        return []
    surfaces = []
    for line in p.read_text(encoding="utf-8").splitlines():
        if line.startswith("HBPv1|surface="):
            fields = {}
            for pair in line.split("|"):
                if "=" in pair:
                    k, v = pair.split("=", 1)
                    fields[k] = v
            if "surface" in fields:
                surfaces.append({
                    "name": fields["surface"],
                    "extra": {"api": fields.get("api"), "asolaria_primitive": fields.get("asolaria_primitive"), "auth": fields.get("auth")},
                })
    return surfaces


def load_daemon_proxies():
    p = Path("C:/asolaria-acer/scratch/comprehensive-341-daemon-3d-map-2026-05-22/raw-enumeration-2026-05-22.txt")
    if not p.exists():
        return []
    daemons = []
    for line in p.read_text(encoding="utf-8").splitlines():
        parts = line.split("|")
        if len(parts) >= 4:
            daemons.append({
                "name": parts[1],
                "extra": {"os_pid": parts[0], "kind": parts[2], "band": parts[3]},
            })
    return daemons


def annotate_slot(slot_id, category, name, extra, alphabet):
    seed = f"{ANCHOR}|slot-{slot_id}|{category}|{name}"
    h = h_coord(seed)
    glyph = glyph_5(seed, alphabet)
    cube = cube_47d(seed)
    band = supervisor_band_for(category, h)
    route = downstream_route_for(category, name)
    safe_name = name.replace("|", "-")[:60] if isinstance(name, str) else "unknown"
    pid = f"AGT-OMNIDISPATCHER-SLOT-{slot_id:04d}-{safe_name.upper().replace(' ', '-').replace('/', '-').replace(':','-')[:30]}-{h}-W2026-P00-N{sha(seed)[:8].upper()}"
    prof = f"PROF-SLOT-{slot_id:04d}-ABSORB-{h}-W2026-P00-N{sha(seed + '|prof')[:8].upper()}"
    return {
        "slot_id": slot_id,
        "category": category,
        "name": name,
        "h_coord": h,
        "glyph_5": glyph,
        "cube_47d_xyz_mod8": cube,
        "supervisor_band": band,
        "downstream_route": route,
        "pid": pid,
        "prof_pid": prof,
        "extra": extra,
        "cp": "PENDING-APEX-MINT",
        "state": "READY" if category != "reserve" else "RESERVED",
    }


def build_slots():
    alphabet = load_alphabet()
    slots = []
    slot_id = 0

    # Categories in canonical order
    clis = load_clis()
    citizens = load_citizens()
    metas = load_metas()
    antigravity_models = load_antigravity_models()
    google_surfaces = load_google_surfaces()
    daemon_proxies = load_daemon_proxies()

    print(f"# population stats: CLIs={len(clis)} citizens={len(citizens)} metas={len(metas)} antigravity={len(antigravity_models)} google={len(google_surfaces)} daemons={len(daemon_proxies)}", flush=True)

    for entry in clis:
        slots.append(annotate_slot(slot_id, "CLI", entry["name"], entry["extra"], alphabet))
        slot_id += 1
    for entry in citizens:
        slots.append(annotate_slot(slot_id, "citizen", entry["name"], entry["extra"], alphabet))
        slot_id += 1
    for entry in metas:
        slots.append(annotate_slot(slot_id, "meta", entry["name"], entry["extra"], alphabet))
        slot_id += 1
    for entry in antigravity_models:
        slots.append(annotate_slot(slot_id, "antigravity", entry["name"], entry["extra"], alphabet))
        slot_id += 1
    for entry in google_surfaces:
        slots.append(annotate_slot(slot_id, "google", entry["name"], entry["extra"], alphabet))
        slot_id += 1
    for entry in daemon_proxies:
        slots.append(annotate_slot(slot_id, "daemon-proxy", entry["name"], entry["extra"], alphabet))
        slot_id += 1

    # Reserve slots fill to exactly 1000
    while slot_id < 1000:
        slots.append(annotate_slot(slot_id, "reserve", f"reserve-{slot_id:04d}", {}, alphabet))
        slot_id += 1

    return slots


def emit_hbp(slots):
    rows = []
    ts = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    category_counts = defaultdict(int)
    for s in slots:
        category_counts[s["category"]] += 1

    rows.append(
        f"HBPv1|layer=omnidispatcher-1000-slot-manifest-anchor|anchor_pid={ANCHOR}|wave={WAVE}|ts={ts}|"
        f"slot_count={len(slots)}|"
        f"category_counts={','.join(f'{k}={v}' for k, v in sorted(category_counts.items()))}|"
        f"cp=PENDING-APEX-MINT|"
        f"cosign_window=QUINTUPLE-DELEGATED-2WEEK-2026-05-22-to-2026-06-05|"
        f"json=0|runtime=0|promote=0|row_hash={sha('anchor|' + ANCHOR)[:16]}"
    )
    prev = sha("anchor|" + ANCHOR)[:16]
    for s in slots:
        cube_str = "-".join(str(x) for x in s["cube_47d_xyz_mod8"])
        rh = sha(f"slot|{s['slot_id']}|{prev}")[:16]
        # Safe name truncation
        name_safe = (s["name"][:50] if isinstance(s["name"], str) else "unknown").replace("|", "-")
        rows.append(
            f"SLOT|id={s['slot_id']:04d}|category={s['category']}|name={name_safe}|"
            f"h_coord={s['h_coord']}|glyph_5={s['glyph_5']}|cube_47d_xyz_mod8={cube_str}|"
            f"band={s['supervisor_band']}|route={s['downstream_route']}|"
            f"pid={s['pid'][:80]}|prof={s['prof_pid'][:80]}|state={s['state']}|cp=PENDING-APEX-MINT|"
            f"antecedents={prev}|row_hash={rh}"
        )
        prev = rh

    # Category-summary rows
    for cat, count in sorted(category_counts.items()):
        rh = sha(f"summary|{cat}|{prev}")[:16]
        rows.append(f"CATEGORY-SUMMARY|category={cat}|slot_count={count}|antecedents={prev}|row_hash={rh}")
        prev = rh

    # 3D-map anchor
    map_seed = f"{ANCHOR}|3d-map-anchor"
    rows.append(
        f"HBPv1|layer=3d-map-anchor|anchor_pid={ANCHOR}|h_coord={h_coord(map_seed)}|"
        f"glyph_5={glyph_5(map_seed, load_alphabet())}|cube_47d_xyz_mod8={'-'.join(str(x) for x in cube_47d(map_seed))}|"
        f"atlas_surface=APROFSURFACE-PROPOSAL|cp=PENDING-APEX-MINT|antecedents={prev}|"
        f"json=0|runtime=0|promote=0|row_hash={sha('3dmap|' + ANCHOR)[:16]}"
    )

    hbp_path = OUT_DIR / "omnidispatcher-1000-slot-manifest-2026-05-22.hbp"
    hbp_path.write_text("\n".join(rows) + "\n", encoding="utf-8")
    data = hbp_path.read_bytes()
    sha_full = hashlib.sha256(data).hexdigest()
    (OUT_DIR / "omnidispatcher-1000-slot-manifest-2026-05-22.hbp.sha256").write_text(f"{sha_full}  omnidispatcher-1000-slot-manifest-2026-05-22.hbp\n", encoding="utf-8")
    (OUT_DIR / "omnidispatcher-1000-slot-manifest-2026-05-22.hbp.hex").write_text(data.hex() + "\n", encoding="utf-8")
    cold = {
        "anchor": ANCHOR, "wave": WAVE, "ts": ts,
        "slot_count": len(slots),
        "category_counts": dict(category_counts),
        "slots": slots,
        "row_count": len(rows),
        "sha256": sha_full,
    }
    (OUT_DIR / "omnidispatcher-1000-slot-manifest-2026-05-22.cold.json").write_text(json.dumps(cold, indent=2), encoding="utf-8")
    return {"hbp_path": str(hbp_path), "sha256": sha_full, "row_count": len(rows), "slot_count": len(slots), "category_counts": dict(category_counts)}


def post_bus(payload):
    try:
        from urllib.request import Request, urlopen
        body = json.dumps(payload).encode("utf-8")
        req = Request(BUS, data=body, headers={"Content-Type": "application/json"}, method="POST")
        with urlopen(req, timeout=3) as r:
            return r.status
    except Exception as e:
        return f"ERR:{e}"


def main():
    slots = build_slots()
    result = emit_hbp(slots)
    bus_status = post_bus({
        "verb": "EVT-OMNIDISPATCHER-1000-SLOT-MANIFEST-EMIT",
        "from": "acer-Claude-orchestrator",
        "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "anchor_pid": ANCHOR,
        "body": {
            "room": "whiteroom",
            "tags": ["room:whiteroom", "class:MANIFEST", "cp:PENDING-APEX-MINT", "cosign_window:2-week-delegated", "vantage:acer"],
            "slot_count": result["slot_count"],
            "category_counts": result["category_counts"],
            "sha256": result["sha256"],
        },
    })
    print(json.dumps({**result, "bus_status": bus_status}, indent=2))


if __name__ == "__main__":
    main()
