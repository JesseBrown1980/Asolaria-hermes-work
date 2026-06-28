const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

function runNode(args) {
  const result = spawnSync("node", args, {
    cwd: path.resolve(__dirname, ".."),
    encoding: "utf8",
    shell: false,
    timeout: 30000,
    windowsHide: true
  });
  assert.equal(result.status, 0, `${args.join(" ")}\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}

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

(() => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "hyperbehcs-worker-access-context-"));
  for (const rel of ["inbox", "outbox", "leases", "go", "hookwall", "gnn", "logs", "access"]) {
    fs.mkdirSync(path.join(root, rel), { recursive: true });
  }
  const taskPrompt = "HHERMTESTPROMPT|goal=preview_access_context";
  fs.writeFileSync(path.join(root, "inbox", "helper-05.hbp"), [
    `HHERMTASK|task_id=worker-access-context-unit|command=/Goal|runtime=codex|provider=codex|pid=HHERM-PID-05|allow_provider=0|allow_tools=0|prompt_hex=${Buffer.from(taskPrompt, "utf8").toString("hex")}`
  ].join("\n") + "\n", "ascii");
  fs.writeFileSync(path.join(root, "access", "helper-05.hbp"), [
    "HHERMHELPERACCESS|run=unit|slot=5|helper=helper-05|access_prompt=access/hyperbehcs-hermes-mcp-access-pack.prompt.hbp|sha256=abc|access=1|mcp=8|hyper=6|gates=8|call_authority=0|runtime_authority=0",
    ...Array.from({ length: 8 }, (_, index) => `HHERMHELPERACCESSGATE|slot=5|gate_slot=${index}|gate=gate_${index}|state=blocked|pass=0`),
    ""
  ].join("\n"), "ascii");

  const status = runNode([
    ".\\tools\\behcs\\hyperbehcs-hermes-spindle-worker.mjs",
    "--status",
    "--slot",
    "5",
    "--spindle-root",
    root,
    "--runtime",
    "codex"
  ]);
  assert.match(status, /^HHERMWORKSTATUS\|.*slot=5.*access_exists=1.*access_pointer_exists=1.*runtime_call=0/m);
  assert.doesNotMatch(status, /[{}\[\]"]/);
  assert.doesNotMatch(status, /json/i);

  const preview = runNode([
    ".\\tools\\behcs\\hyperbehcs-hermes-spindle-worker.mjs",
    "--preview-prompt",
    "--slot",
    "5",
    "--spindle-root",
    root,
    "--runtime",
    "codex"
  ]);
  const row = parseRows(preview).find((entry) => entry.tag === "HHERMWORKPROMPT");
  assert.ok(row, preview);
  assert.equal(row.fields.get("ok"), "1");
  assert.equal(row.fields.get("task_id"), "worker-access-context-unit");
  assert.equal(row.fields.get("subaccess"), "1");
  assert.equal(row.fields.get("access_exists"), "1");
  assert.equal(row.fields.get("access"), "1");
  assert.equal(row.fields.get("mcp"), "8");
  assert.equal(row.fields.get("hyper"), "6");
  assert.equal(row.fields.get("gates"), "8");
  assert.equal(row.fields.get("hydrate"), "0");
  assert.equal(row.fields.get("call_authority"), "0");
  assert.equal(row.fields.get("runtime_authority"), "0");
  assert.equal(row.fields.get("runtime_call"), "0");
  assert.doesNotMatch(preview, /[{}\[\]"]/);
  assert.doesNotMatch(preview, /json/i);

  console.log("HHERMWORKACCESSTEST|ok=1|test=hyperbehcs-hermes-spindle-worker-access-context");
})();
