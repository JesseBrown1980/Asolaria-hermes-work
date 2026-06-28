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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "hyperbehcs-preview-source-"));
  for (const rel of ["inbox", "outbox", "leases", "go", "hookwall", "gnn", "logs", "access"]) {
    fs.mkdirSync(path.join(root, rel), { recursive: true });
  }
  for (let slot = 0; slot < 24; slot += 1) seedAccessPointer(root, slot);
  return root;
}

(async () => {
  const {
    buildHyperbehcsHermesWorkerPromptPreviewSweep,
    writeHyperbehcsHermesWorkerPromptPreviewSweep
  } = await import("../tools/behcs/hyperbehcs-hermes-worker-prompt-preview-sweep.mjs");

  const sourceRoot = makeSourceRoot();
  const sweepRoot = fs.mkdtempSync(path.join(os.tmpdir(), "hyperbehcs-preview-sweep-"));
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "hyperbehcs-preview-out-"));

  const packet = buildHyperbehcsHermesWorkerPromptPreviewSweep({
    run: "hyperbehcs-hermes-worker-prompt-preview-sweep-unit",
    generatedAt: "2026-05-16T00:00:00.000Z",
    sourceRoot,
    sweepRoot,
    slots: 24,
    timeoutMs: 30000
  });
  const rows = parseRows(packet.hbp);
  assert.match(packet.hbp, /^HHERMPREVIEWSWEEPRUN\|.*slots=24.*worker_execution=0.*provider_call=0.*tool_calls=0.*runtime_authority=0/m);
  assert.equal(rows.filter((entry) => entry.tag === "HHERMPREVIEWSWEEPTASK").length, 24);
  assert.equal(rows.filter((entry) => entry.tag === "HHERMPREVIEWSWEEPSLOT").length, 24);
  assert.match(packet.hbp, /^HHERMPREVIEWSWEEPSLOT\|.*slot=23.*ok=1.*subaccess=1.*access_exists=1.*access=1.*mcp=8.*hyper=6.*gates=8.*hydrate=0.*call_authority=0.*runtime_authority=0.*runtime_call=0.*ready=1/m);
  assert.match(packet.hbp, /^HHERMPREVIEWSWEEPOBS\|.*ok=1.*previewed_slots=24.*expected_slots=24.*subaccess_slots=24.*ready_access_slots=24.*failures=0.*provider_calls=0.*tools_called=0.*runtime_authority=0/m);
  assert.match(packet.hbp, /^HHERMPREVIEWSWEEPGATE\|.*mcp_tool_call=0.*worker_execution=0.*runtime_authority=0.*production_promotion=0/m);
  assert.doesNotMatch(packet.hbp, /[{}\[\]"]/);
  assert.doesNotMatch(packet.hbp, /json/i);
  assert.match(packet.hbi, /^HHERMPREVIEWSWEEPIDX\|/m);
  assert.equal(packet.sha256.length, 64);
  assert.equal(packet.hex.length % 2, 0);

  const badSourceRoot = makeSourceRoot();
  seedAccessPointer(badSourceRoot, 3, { runtimeAuthority: 1 });
  const badPacket = buildHyperbehcsHermesWorkerPromptPreviewSweep({
    run: "hyperbehcs-hermes-worker-prompt-preview-sweep-bad-unit",
    generatedAt: "2026-05-16T00:00:00.000Z",
    sourceRoot: badSourceRoot,
    sweepRoot: fs.mkdtempSync(path.join(os.tmpdir(), "hyperbehcs-preview-bad-")),
    slots: 24,
    timeoutMs: 30000
  });
  assert.match(badPacket.hbp, /^HHERMPREVIEWSWEEPSLOT\|.*slot=3.*pointer_runtime_authority=1.*ready=0/m);
  assert.match(badPacket.hbp, /^HHERMPREVIEWSWEEPOBS\|.*ok=0.*ready_access_slots=23.*failures=1/m);

  const written = writeHyperbehcsHermesWorkerPromptPreviewSweep({
    run: "hyperbehcs-hermes-worker-prompt-preview-sweep-unit",
    generatedAt: "2026-05-16T00:00:00.000Z",
    sourceRoot,
    sweepRoot: fs.mkdtempSync(path.join(os.tmpdir(), "hyperbehcs-preview-write-")),
    slots: 24,
    timeoutMs: 30000,
    out,
    writeLatestReport: false
  });
  assert.deepEqual(fs.readdirSync(written.base).sort(), [
    "hyperbehcs-hermes-worker-prompt-preview-sweep.hbi",
    "hyperbehcs-hermes-worker-prompt-preview-sweep.hbp",
    "hyperbehcs-hermes-worker-prompt-preview-sweep.hex",
    "hyperbehcs-hermes-worker-prompt-preview-sweep.md",
    "hyperbehcs-hermes-worker-prompt-preview-sweep.sha256"
  ]);

  console.log("HHERMPREVIEWSWEEPTEST|ok=1|test=hyperbehcs-hermes-worker-prompt-preview-sweep");
})().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
