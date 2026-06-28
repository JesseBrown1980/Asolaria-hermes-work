const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function sha256(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
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

function writeFile(dir, name, text) {
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, text, "ascii");
  return filePath;
}

function guardrailText() {
  return [
    "HHERM2LATCHGUARDRUN|version=unit|run=unit|guardrail_summary=1|fail_closed=1|launch=0|helper_pool_launch=0|provider_call=0|tool_calls=0|runtime_authority=0",
    "HHERM2LATCHGUARDCHECK|run=unit|check=rehearsal_receipt|pass=1|reason=two_latch_rehearsal_ok",
    "HHERM2LATCHGUARDCHECK|run=unit|check=decision_receipt|pass=1|reason=decision_still_blocked",
    "HHERM2LATCHGUARDCHECK|run=unit|check=validator_receipt|pass=1|reason=validator_confirms_blocked",
    "HHERM2LATCHGUARDOBS|ok=1|run=unit|checks=3|passed_checks=3|failed_checks=0|decision=do_not_launch_without_operator_two_latch_runtime_context|next_allowed=operator_explicit_two_latch_runtime_decision|launch_ready=0|launch_authorized=0|launch=0|helper_pool_launch=0|worker_start=0|provider_calls=0|tools_called=0|runtime_authority=0",
    "HHERM2LATCHGUARDBOUNDARY|live_inbox_write=0|helper_pool_launch=0|worker_start=0|provider_call=0|mcp_server_boot=0|mcp_tool_call=0|browser_action=0|google_request=0|oauth_state_change=0|secret_read=0|route_mutation=0|usb_write=0|cleanup=0|runtime_authority=0|production_promotion=0",
    ""
  ].join("\n");
}

function handoffText({ guardrail, launchAuthorized = 0, runtimeAuthority = 0 } = {}) {
  const guardrailSha = sha256(fs.readFileSync(guardrail, "ascii"));
  const guardrailPath = guardrail.replace(/\\/g, "/");
  return [
    "HHERM2LATCHHANDOFFRUN|version=unit|run=unit|next_agent_handoff=1|fail_closed=1|launch=0|helper_pool_launch=0|provider_call=0|tool_calls=0|runtime_authority=0",
    `HHERM2LATCHHANDOFFINPUT|run=unit|input=guardrail_summary|path=${guardrailPath}|exists=1|bytes=1|sha256=${guardrailSha}`,
    "HHERM2LATCHHANDOFFCHECK|run=unit|check=guardrail_summary|pass=1|reason=guardrail_summary_ok",
    "HHERM2LATCHHANDOFFCHECK|run=unit|check=runtime_authority_absent|pass=1|reason=runtime_authority_absent",
    "HHERM2LATCHHANDOFFCHECK|run=unit|check=continuation_not_authorization|pass=1|reason=continue_text_is_not_two_latch_context",
    `HHERM2LATCHHANDOFFNEXT|run=unit|slot=0|agent=next_agent_any_kind|directive=verify_guardrail_summary_before_runtime_action|required_guardrail_sha256=${guardrailSha}|launch_authorized=0|runtime_authority=0`,
    "HHERM2LATCHHANDOFFNEXT|run=unit|slot=1|agent=next_agent_any_kind|directive=do_not_treat_continue_as_launch_authorization|next_allowed=operator_explicit_two_latch_runtime_decision|launch_authorized=0|runtime_authority=0",
    "HHERM2LATCHHANDOFFNEXT|run=unit|slot=2|agent=next_agent_any_kind|directive=fresh_operator_two_latch_context_required_for_any_real_launch|required_latches=2|launch_authorized=0|runtime_authority=0",
    `HHERM2LATCHHANDOFFOBS|ok=1|run=unit|checks=3|passed_checks=3|failed_checks=0|decision=handoff_complete_no_launch|guardrail_decision=do_not_launch_without_operator_two_latch_runtime_context|next_allowed=operator_explicit_two_latch_runtime_decision|launch_ready=0|launch_authorized=${launchAuthorized}|launch=0|helper_pool_launch=0|worker_start=0|provider_calls=0|tools_called=0|runtime_authority=${runtimeAuthority}`,
    `HHERM2LATCHHANDOFFBOUNDARY|live_inbox_write=0|helper_pool_launch=0|worker_start=0|provider_call=0|mcp_server_boot=0|mcp_tool_call=0|browser_action=0|google_request=0|oauth_state_change=0|secret_read=0|route_mutation=0|usb_write=0|cleanup=0|runtime_authority=${runtimeAuthority}|production_promotion=0`,
    ""
  ].join("\n");
}

(async () => {
  const {
    buildHyperbehcsHermesTwoLatchNextAgentHandoffValidator,
    writeHyperbehcsHermesTwoLatchNextAgentHandoffValidator
  } = await import("../tools/behcs/hyperbehcs-hermes-two-latch-next-agent-handoff-validator.mjs");

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hyperbehcs-two-latch-handoff-validator-"));
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "hyperbehcs-two-latch-handoff-validator-out-"));
  const guardrail = writeFile(dir, "guardrail.hbp", guardrailText());
  const handoff = writeFile(dir, "handoff.hbp", handoffText({ guardrail }));
  const driftHandoff = writeFile(dir, "handoff-drift.hbp", handoffText({
    guardrail,
    launchAuthorized: 1,
    runtimeAuthority: 1
  }));

  const packet = buildHyperbehcsHermesTwoLatchNextAgentHandoffValidator({
    run: "hyperbehcs-hermes-two-latch-next-agent-handoff-validator-unit",
    generatedAt: "2026-05-16T00:00:00.000Z",
    handoff
  });
  assert.match(packet.hbp, /^HHERM2LATCHHANDOFFVALRUN\|.*validator=1.*fail_closed=1.*launch=0.*provider_call=0.*runtime_authority=0/m);
  assert.match(packet.hbp, /^HHERM2LATCHHANDOFFVALINPUT\|.*input=next_agent_handoff.*exists=1.*sha256=/m);
  assert.match(packet.hbp, /^HHERM2LATCHHANDOFFVALREF\|.*input=guardrail_summary.*exists=1.*pass=1/m);
  assert.match(packet.hbp, /^HHERM2LATCHHANDOFFVALCHECK\|.*check=handoff_shape.*pass=1.*handoff_shape_ok/m);
  assert.match(packet.hbp, /^HHERM2LATCHHANDOFFVALCHECK\|.*check=handoff_observation.*pass=1.*handoff_observation_ok/m);
  assert.match(packet.hbp, /^HHERM2LATCHHANDOFFVALCHECK\|.*check=handoff_boundary.*pass=1.*handoff_boundary_zero_authority/m);
  assert.match(packet.hbp, /^HHERM2LATCHHANDOFFVALCHECK\|.*check=handoff_directives.*pass=1.*handoff_directives_ok/m);
  assert.match(packet.hbp, /^HHERM2LATCHHANDOFFVALCHECK\|.*check=guardrail_sha_readback.*pass=1.*guardrail_sha_readback_ok/m);
  assert.match(packet.hbp, /^HHERM2LATCHHANDOFFVALOBS\|.*ok=1.*checks=6.*passed_checks=6.*failed_checks=0.*decision=validated_handoff_no_launch.*handoff_decision=handoff_complete_no_launch.*launch_authorized=0.*launch=0.*provider_calls=0.*runtime_authority=0/m);
  assert.match(packet.hbp, /^HHERM2LATCHHANDOFFVALBOUNDARY\|.*helper_pool_launch=0.*provider_call=0.*cleanup=0.*runtime_authority=0.*next_allowed=operator_explicit_two_latch_runtime_decision/m);
  assert.doesNotMatch(packet.hbp, /[{}\[\]"]/);
  assert.doesNotMatch(packet.hbp, new RegExp("j" + "son", "i"));
  assert.match(packet.hbi, /^HHERM2LATCHHANDOFFVALIDX\|/m);
  assert.equal(packet.sha256.length, 64);
  assert.equal(packet.hex.length % 2, 0);

  const failed = buildHyperbehcsHermesTwoLatchNextAgentHandoffValidator({
    run: "hyperbehcs-hermes-two-latch-next-agent-handoff-validator-drift-unit",
    generatedAt: "2026-05-16T00:00:00.000Z",
    handoff: driftHandoff
  });
  assert.match(failed.hbp, /^HHERM2LATCHHANDOFFVALCHECK\|.*check=handoff_observation.*pass=0.*handoff_observation_drift/m);
  assert.match(failed.hbp, /^HHERM2LATCHHANDOFFVALCHECK\|.*check=handoff_boundary.*pass=0.*handoff_boundary_drift/m);
  assert.match(failed.hbp, /^HHERM2LATCHHANDOFFVALOBS\|.*ok=0.*failed_checks=2.*decision=fail_closed.*next_allowed=repair_handoff_inputs.*launch_authorized=0.*runtime_authority=0/m);

  const written = writeHyperbehcsHermesTwoLatchNextAgentHandoffValidator({
    run: "hyperbehcs-hermes-two-latch-next-agent-handoff-validator-unit",
    generatedAt: "2026-05-16T00:00:00.000Z",
    handoff,
    out,
    writeLatestReport: false
  });
  assert.deepEqual(fs.readdirSync(written.base).sort(), [
    "hyperbehcs-hermes-two-latch-next-agent-handoff-validator.hbi",
    "hyperbehcs-hermes-two-latch-next-agent-handoff-validator.hbp",
    "hyperbehcs-hermes-two-latch-next-agent-handoff-validator.hex",
    "hyperbehcs-hermes-two-latch-next-agent-handoff-validator.md",
    "hyperbehcs-hermes-two-latch-next-agent-handoff-validator.sha256"
  ]);
  const writtenRows = parseRows(fs.readFileSync(path.join(written.base, "hyperbehcs-hermes-two-latch-next-agent-handoff-validator.hbp"), "ascii"));
  assert.equal(writtenRows.find((entry) => entry.tag === "HHERM2LATCHHANDOFFVALOBS").fields.get("ok"), "1");

  console.log("HHERM2LATCHHANDOFFVALTEST|ok=1|test=hyperbehcs-hermes-two-latch-next-agent-handoff-validator");
})().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
