const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function parseRows(text) {
  return String(text || "").split(/\r?\n/).filter(Boolean).map((line) => {
    const parts = line.split("|");
    const tag = parts.shift();
    const fields = new Map();
    for (const part of parts) {
      const pivot = part.indexOf("=");
      if (pivot > 0) fields.set(part.slice(0, pivot), part.slice(pivot + 1));
    }
    return { tag, fields, line };
  });
}

function seedAccessPointer(root, slot, overrides = {}) {
  const helper = `helper-${String(slot).padStart(2, "0")}`;
  const access = overrides.access ?? 1;
  const mcp = overrides.mcp ?? 8;
  const hyper = overrides.hyper ?? 6;
  const gates = overrides.gates ?? 8;
  const callAuthority = overrides.callAuthority ?? 0;
  const runtimeAuthority = overrides.runtimeAuthority ?? 0;
  fs.writeFileSync(path.join(root, "access", `${helper}.hbp`), [
    `HHERMHELPERACCESS|run=unit|slot=${slot}|helper=${helper}|access_prompt=access/pack.hbp|sha256=abc|access=${access}|mcp=${mcp}|hyper=${hyper}|gates=${gates}|call_authority=${callAuthority}|runtime_authority=${runtimeAuthority}`,
    ...Array.from({ length: 8 }, (_, index) => `HHERMHELPERACCESSGATE|slot=${slot}|gate_slot=${index}|gate=gate_${index}|state=blocked|pass=0`),
    ""
  ].join("\n"), "ascii");
}

function makeSourceRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "hyperbehcs-dry-source-"));
  for (const rel of ["inbox", "outbox", "leases", "go", "hookwall", "gnn", "logs", "access"]) {
    fs.mkdirSync(path.join(root, rel), { recursive: true });
  }
  for (let slot = 0; slot < 24; slot += 1) seedAccessPointer(root, slot);
  return root;
}

(async () => {
  const {
    buildHyperbehcsHermesWorkerDryRunSweep,
    writeHyperbehcsHermesWorkerDryRunSweep
  } = await import("../tools/behcs/hyperbehcs-hermes-worker-dry-run-sweep.mjs");

  const sourceRoot = makeSourceRoot();
  const dryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "hyperbehcs-dry-sweep-"));
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "hyperbehcs-dry-out-"));

  const packet = buildHyperbehcsHermesWorkerDryRunSweep({
    run: "hyperbehcs-hermes-worker-dry-run-sweep-unit",
    generatedAt: "2026-05-16T00:00:00.000Z",
    sourceRoot,
    dryRoot,
    slots: 24,
    timeoutMs: 30000
  });
  const rows = parseRows(packet.hbp);
  assert.match(packet.hbp, /^HHERMDRYSWEEPRUN\|.*slots=24.*dry_run=1.*provider_call=0.*tool_calls=0.*runtime_authority=0/m);
  assert.equal(rows.filter((entry) => entry.tag === "HHERMDRYSWEEPTASK").length, 24);
  assert.equal(rows.filter((entry) => entry.tag === "HHERMDRYSWEEPSLOT").length, 24);
  assert.match(packet.hbp, /^HHERMDRYSWEEPSLOT\|.*slot=23.*ok=1.*work_done=1.*outbox=1.*result_state=dry_run.*hook_spawn=1.*hook_complete=1.*gnn=1.*gnn_state=dry_run.*log=1.*lease_released=1.*lease_exists=0.*access_copied=1.*provider_call=0.*tool_calls=0.*runtime_authority=0.*ready=1/m);
  assert.match(packet.hbp, /^HHERMDRYSWEEPOBS\|.*ok=1.*completed_slots=24.*expected_slots=24.*outbox_receipts=24.*hook_spawn_receipts=24.*hook_complete_receipts=24.*gnn_receipts=24.*released_leases=24.*failures=0.*provider_calls=0.*tools_called=0.*runtime_authority=0/m);
  assert.match(packet.hbp, /^HHERMDRYSWEEPGATE\|.*mcp_tool_call=0.*provider_call=0.*runtime_authority=0.*production_promotion=0/m);
  assert.doesNotMatch(packet.hbp, /[{}\[\]"]/);
  assert.doesNotMatch(packet.hbp, /json/i);
  assert.match(packet.hbi, /^HHERMDRYSWEEPIDX\|/m);
  assert.equal(packet.sha256.length, 64);
  assert.equal(packet.hex.length % 2, 0);

  const badSourceRoot = makeSourceRoot();
  seedAccessPointer(badSourceRoot, 6, { callAuthority: 1 });
  const badPacket = buildHyperbehcsHermesWorkerDryRunSweep({
    run: "hyperbehcs-hermes-worker-dry-run-sweep-bad-unit",
    generatedAt: "2026-05-16T00:00:00.000Z",
    sourceRoot: badSourceRoot,
    dryRoot: fs.mkdtempSync(path.join(os.tmpdir(), "hyperbehcs-dry-bad-")),
    slots: 24,
    timeoutMs: 30000
  });
  assert.match(badPacket.hbp, /^HHERMDRYSWEEPSLOT\|.*slot=6.*pointer_call_authority=1.*ready=0/m);
  assert.match(badPacket.hbp, /^HHERMDRYSWEEPOBS\|.*ok=0.*completed_slots=23.*failures=1/m);

  const written = writeHyperbehcsHermesWorkerDryRunSweep({
    run: "hyperbehcs-hermes-worker-dry-run-sweep-unit",
    generatedAt: "2026-05-16T00:00:00.000Z",
    sourceRoot,
    dryRoot: fs.mkdtempSync(path.join(os.tmpdir(), "hyperbehcs-dry-write-")),
    slots: 24,
    timeoutMs: 30000,
    out,
    writeLatestReport: false
  });
  assert.deepEqual(fs.readdirSync(written.base).sort(), [
    "hyperbehcs-hermes-worker-dry-run-sweep.hbi",
    "hyperbehcs-hermes-worker-dry-run-sweep.hbp",
    "hyperbehcs-hermes-worker-dry-run-sweep.hex",
    "hyperbehcs-hermes-worker-dry-run-sweep.md",
    "hyperbehcs-hermes-worker-dry-run-sweep.sha256"
  ]);

  console.log("HHERMDRYSWEEPTEST|ok=1|test=hyperbehcs-hermes-worker-dry-run-sweep");
})().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
