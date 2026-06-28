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

function writeFile(dir, name, text) {
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, text, "ascii");
  return filePath;
}

function guardrailText({ launchAuthorized = 0, runtimeAuthority = 0 } = {}) {
  return [
    "HHERM2LATCHGUARDRUN|version=unit|run=unit|guardrail_summary=1|fail_closed=1|launch=0|helper_pool_launch=0|provider_call=0|tool_calls=0|runtime_authority=0",
    "HHERM2LATCHGUARDCHECK|run=unit|check=rehearsal_receipt|pass=1|reason=two_latch_rehearsal_ok",
    "HHERM2LATCHGUARDCHECK|run=unit|check=decision_receipt|pass=1|reason=decision_still_blocked",
    "HHERM2LATCHGUARDCHECK|run=unit|check=validator_receipt|pass=1|reason=validator_confirms_blocked",
    `HHERM2LATCHGUARDOBS|ok=1|run=unit|checks=3|passed_checks=3|failed_checks=0|decision=do_not_launch_without_operator_two_latch_runtime_context|next_allowed=operator_explicit_two_latch_runtime_decision|launch_ready=0|launch_authorized=${launchAuthorized}|launch=0|helper_pool_launch=0|worker_start=0|provider_calls=0|tools_called=0|runtime_authority=${runtimeAuthority}`,
    `HHERM2LATCHGUARDBOUNDARY|live_inbox_write=0|helper_pool_launch=0|worker_start=0|provider_call=0|mcp_server_boot=0|mcp_tool_call=0|browser_action=0|google_request=0|oauth_state_change=0|secret_read=0|route_mutation=0|usb_write=0|cleanup=0|runtime_authority=${runtimeAuthority}|production_promotion=0`,
    ""
  ].join("\n");
}

(async () => {
  const {
    buildHyperbehcsHermesTwoLatchNextAgentHandoff,
    writeHyperbehcsHermesTwoLatchNextAgentHandoff
  } = await import("../tools/behcs/hyperbehcs-hermes-two-latch-next-agent-handoff.mjs");

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hyperbehcs-two-latch-handoff-"));
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "hyperbehcs-two-latch-handoff-out-"));
  const guardrail = writeFile(dir, "guardrail.hbp", guardrailText());
  const driftGuardrail = writeFile(dir, "guardrail-drift.hbp", guardrailText({
    launchAuthorized: 1,
    runtimeAuthority: 1
  }));

  const packet = buildHyperbehcsHermesTwoLatchNextAgentHandoff({
    run: "hyperbehcs-hermes-two-latch-next-agent-handoff-unit",
    generatedAt: "2026-05-16T00:00:00.000Z",
    guardrail
  });
  assert.match(packet.hbp, /^HHERM2LATCHHANDOFFRUN\|.*next_agent_handoff=1.*fail_closed=1.*launch=0.*provider_call=0.*runtime_authority=0/m);
  assert.match(packet.hbp, /^HHERM2LATCHHANDOFFINPUT\|.*input=guardrail_summary.*exists=1.*sha256=/m);
  assert.match(packet.hbp, /^HHERM2LATCHHANDOFFCHECK\|.*check=guardrail_summary.*pass=1.*guardrail_summary_ok/m);
  assert.match(packet.hbp, /^HHERM2LATCHHANDOFFCHECK\|.*check=runtime_authority_absent.*pass=1.*runtime_authority_absent/m);
  assert.match(packet.hbp, /^HHERM2LATCHHANDOFFCHECK\|.*check=continuation_not_authorization.*pass=1.*continue_text_is_not_two_latch_context/m);
  assert.match(packet.hbp, /^HHERM2LATCHHANDOFFNEXT\|.*slot=1.*directive=do_not_treat_continue_as_launch_authorization.*launch_authorized=0.*runtime_authority=0/m);
  assert.match(packet.hbp, /^HHERM2LATCHHANDOFFNEXT\|.*slot=2.*directive=fresh_operator_two_latch_context_required_for_any_real_launch.*required_latches=2.*launch_authorized=0.*runtime_authority=0/m);
  assert.match(packet.hbp, /^HHERM2LATCHHANDOFFOBS\|.*ok=1.*checks=3.*passed_checks=3.*failed_checks=0.*decision=handoff_complete_no_launch.*guardrail_decision=do_not_launch_without_operator_two_latch_runtime_context.*launch_authorized=0.*launch=0.*provider_calls=0.*runtime_authority=0/m);
  assert.match(packet.hbp, /^HHERM2LATCHHANDOFFBOUNDARY\|.*live_inbox_write=0.*helper_pool_launch=0.*worker_start=0.*provider_call=0.*cleanup=0.*runtime_authority=0.*production_promotion=0/m);
  assert.doesNotMatch(packet.hbp, /[{}\[\]"]/);
  assert.doesNotMatch(packet.hbp, new RegExp("j" + "son", "i"));
  assert.match(packet.hbi, /^HHERM2LATCHHANDOFFIDX\|/m);
  assert.equal(packet.sha256.length, 64);
  assert.equal(packet.hex.length % 2, 0);

  const failed = buildHyperbehcsHermesTwoLatchNextAgentHandoff({
    run: "hyperbehcs-hermes-two-latch-next-agent-handoff-drift-unit",
    generatedAt: "2026-05-16T00:00:00.000Z",
    guardrail: driftGuardrail
  });
  assert.match(failed.hbp, /^HHERM2LATCHHANDOFFCHECK\|.*check=runtime_authority_absent.*pass=0.*runtime_authority_drift/m);
  assert.match(failed.hbp, /^HHERM2LATCHHANDOFFCHECK\|.*check=continuation_not_authorization.*pass=0.*operator_context_drift/m);
  assert.match(failed.hbp, /^HHERM2LATCHHANDOFFOBS\|.*ok=0.*failed_checks=2.*decision=fail_closed.*next_allowed=repair_guardrail_inputs.*launch_authorized=0.*runtime_authority=0/m);

  const written = writeHyperbehcsHermesTwoLatchNextAgentHandoff({
    run: "hyperbehcs-hermes-two-latch-next-agent-handoff-unit",
    generatedAt: "2026-05-16T00:00:00.000Z",
    guardrail,
    out,
    writeLatestReport: false
  });
  assert.deepEqual(fs.readdirSync(written.base).sort(), [
    "hyperbehcs-hermes-two-latch-next-agent-handoff.hbi",
    "hyperbehcs-hermes-two-latch-next-agent-handoff.hbp",
    "hyperbehcs-hermes-two-latch-next-agent-handoff.hex",
    "hyperbehcs-hermes-two-latch-next-agent-handoff.md",
    "hyperbehcs-hermes-two-latch-next-agent-handoff.sha256"
  ]);
  const writtenRows = parseRows(fs.readFileSync(path.join(written.base, "hyperbehcs-hermes-two-latch-next-agent-handoff.hbp"), "ascii"));
  assert.equal(writtenRows.find((entry) => entry.tag === "HHERM2LATCHHANDOFFOBS").fields.get("ok"), "1");

  console.log("HHERM2LATCHHANDOFFTEST|ok=1|test=hyperbehcs-hermes-two-latch-next-agent-handoff");
})().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
