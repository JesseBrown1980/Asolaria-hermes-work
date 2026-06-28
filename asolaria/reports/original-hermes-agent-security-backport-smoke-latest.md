# Original Hermes Security Backport Smoke

Generated: 2026-04-25T02:54:24.431Z
Status: SECURITY_BACKPORT_QUEUE_READY_PATCHES_BLOCKED
Validation: PASS
Digest: 02b7da583b9105f1e57a3ad3efeee5fe62451b37008c02206239b02f6d6ec38d

## Summary

- Backports: 6
- Targets present: 6
- Missing targets: 0
- Patches applied: 0
- Secrets imported: 0
- Shadow writes: 0

## Backports

- api_auth_enforcement: target=src/gateway/toolAuthority.js exists=true state=queued_target_present_patch_blocked smoke=node --check src/gateway/toolAuthority.js
- path_traversal_checkpoint_guard: target=tools/c-drive-junction-migrator.js exists=true state=queued_target_present_patch_blocked smoke=node --check tools/c-drive-junction-migrator.js
- sandbox_write_shell_injection_guard: target=services/sandbox-manager exists=true state=queued_target_present_patch_blocked smoke=node --check services/sandbox-manager/server.js
- ssrf_redirect_guard: target=src/riskEngine.js exists=true state=queued_target_present_patch_blocked smoke=node --check src/riskEngine.js
- webhook_signature_validation: target=routes/hooks.js exists=true state=queued_target_present_patch_blocked smoke=node --check routes/hooks.js
- oauth_lifecycle_and_no_secret_import: target=src/connectors exists=true state=queued_target_present_patch_blocked smoke=manual_connector_secret_surface_review

## Gates

- targeted_test_required
- gac_approval_required
- operator_review_required
- rollback_plan_required
- no_secret_import
- no_shadow_file_write

## Validation

- Errors: none
- Warnings: none

## Honesty Boundary

- Queue and report only.
- No patch application.
- No secret import.
- No daemon launch.
- No shadow file edits.
