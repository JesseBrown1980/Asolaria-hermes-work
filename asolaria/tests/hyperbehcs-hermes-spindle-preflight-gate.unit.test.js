const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const SCRIPT = path.join(ROOT, "tools", "behcs", "Start-HyperBEHCS-HermesSpindle.ps1");

function runPs(args) {
  return spawnSync("powershell", ["-ExecutionPolicy", "Bypass", "-File", SCRIPT, ...args], {
    cwd: ROOT,
    encoding: "utf8",
    shell: false,
    timeout: 30000,
    windowsHide: true
  });
}

function writePreflight(dir, name, ok) {
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, [
    `HHERMREALPREFLIGHTOBS|ok=${ok ? 1 : 0}|passed_gates=${ok ? 8 : 7}|failed_gates=${ok ? 0 : 1}|expected_gates=8|preflight_only=1|launch=0|provider_calls=0|tools_called=0|runtime_authority=0`,
    "HHERMREALPREFLIGHTBOUNDARY|mcp_server_boot=0|mcp_tool_call=0|browser_action=0|google_request=0|oauth_state_change=0|secret_read=0|route_mutation=0|usb_write=0|provider_call=0|helper_pool_launch=0|runtime_authority=0|production_promotion=0",
    ""
  ].join("\n"), "ascii");
  return filePath;
}

(() => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "hyperbehcs-spindle-preflight-"));
  const root = path.join(temp, "spindle-root");
  const passGate = writePreflight(temp, "pass.hbp", true);
  const failGate = writePreflight(temp, "fail.hbp", false);
  const missingGate = path.join(temp, "missing.hbp");

  const status = runPs([
    "-Mode", "status",
    "-Runtime", "codex",
    "-CodexModel", "gpt-5.5",
    "-SpindleRoot", root,
    "-PreflightGate", passGate
  ]);
  assert.equal(status.status, 0, `${status.stdout}\n${status.stderr}`);
  assert.match(status.stdout, /^HHERMSPINDLESTATUS\|.*mode=status.*runtime=codex/m);
  assert.match(status.stdout, /^HHERMSPINDLEPREFLIGHT\|.*required=0.*provided=1.*pass=1.*reason=real_batch_preflight_pass.*launch=0.*provider_calls=0.*runtime_authority=0.*helper_pool_launch=0/m);
  assert.match(status.stdout, /^HHERMSPINDLEGATE\|.*gate=real_batch_preflight.*provided=0.*pass=0/m);
  assert.doesNotMatch(status.stdout, /^HHERMSPINDLEPOOL\|/m);
  assert.doesNotMatch(status.stdout, /^HHERMSPINDLESUM\|/m);
  assert.doesNotMatch(status.stdout, /[{}\[\]"]/);
  assert.doesNotMatch(status.stdout, /json/i);

  const missing = runPs([
    "-Mode", "pool",
    "-Count", "1",
    "-Runtime", "codex",
    "-CodexModel", "gpt-5.5",
    "-SpindleRoot", root,
    "-ConfirmLaunch", "RUN_HERMES_SPINDLE",
    "-PreflightGate", missingGate
  ]);
  assert.equal(missing.status, 1, `${missing.stdout}\n${missing.stderr}`);
  assert.match(missing.stdout, /^HHERMSPINDLEPREFLIGHT\|.*required=1.*provided=1.*pass=0.*reason=real_batch_preflight_not_found/m);
  assert.match(missing.stdout, /^HHERMSPINDLEERR\|.*reason=real_batch_preflight_required.*preflight_reason=real_batch_preflight_not_found/m);
  assert.doesNotMatch(missing.stdout, /^HHERMSPINDLEPOOL\|/m);

  const failed = runPs([
    "-Mode", "pool",
    "-Count", "1",
    "-Runtime", "codex",
    "-CodexModel", "gpt-5.5",
    "-SpindleRoot", root,
    "-ConfirmLaunch", "RUN_HERMES_SPINDLE",
    "-PreflightGate", failGate
  ]);
  assert.equal(failed.status, 1, `${failed.stdout}\n${failed.stderr}`);
  assert.match(failed.stdout, /^HHERMSPINDLEPREFLIGHT\|.*required=1.*provided=1.*pass=0.*reason=real_batch_preflight_failed/m);
  assert.match(failed.stdout, /^HHERMSPINDLEERR\|.*reason=real_batch_preflight_required.*preflight_reason=real_batch_preflight_failed/m);
  assert.doesNotMatch(failed.stdout, /^HHERMSPINDLEPOOL\|/m);
  assert.doesNotMatch(failed.stdout, /[{}\[\]"]/);
  assert.doesNotMatch(failed.stdout, /json/i);

  const latchMissing = runPs([
    "-Mode", "pool",
    "-Count", "1",
    "-Runtime", "codex",
    "-CodexModel", "gpt-5.5",
    "-SpindleRoot", root,
    "-ConfirmLaunch", "RUN_HERMES_SPINDLE",
    "-PreflightGate", passGate
  ]);
  assert.equal(latchMissing.status, 1, `${latchMissing.stdout}\n${latchMissing.stderr}`);
  assert.match(latchMissing.stdout, /^HHERMSPINDLEPREFLIGHT\|.*required=1.*provided=1.*pass=1.*reason=real_batch_preflight_pass/m);
  assert.match(latchMissing.stdout, /^HHERMSPINDLEGATE\|.*gate=real_batch_preflight.*provided=0.*pass=0/m);
  assert.match(latchMissing.stdout, /^HHERMSPINDLEERR\|.*reason=real_batch_preflight_token_required/m);
  assert.doesNotMatch(latchMissing.stdout, /^HHERMSPINDLEPOOL\|/m);

  console.log("HHERMSPINDLEPREFLIGHTTEST|ok=1|test=hyperbehcs-hermes-spindle-preflight-gate");
})();
