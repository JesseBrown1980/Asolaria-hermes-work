# Original Hermes Security Targeted Tests

Generated: 2026-04-25T02:54:32.114Z
Status: SECURITY_TARGETED_TESTS_PASS_PATCHES_BLOCKED
Validation: PASS
Digest: da5b7f4d8f5972fae85c66dc3010162530e23801196f9f05b737b96de74f893d

## Command Checks

- api_auth_enforcement: pass (node --check src/gateway/toolAuthority.js, shell=false, 118ms)
- path_traversal_checkpoint_guard: pass (node --check tools/c-drive-junction-migrator.js, shell=false, 124ms)
- sandbox_write_shell_injection_guard: pass (node --check services/sandbox-manager/server.js, shell=false, 109ms)
- ssrf_redirect_guard: pass (node --check src/riskEngine.js, shell=false, 106ms)
- webhook_signature_validation: pass (node --check routes/hooks.js, shell=false, 104ms)

## Connector Surface Review

- Connector files reviewed: 47
- Files with env refs: 37
- Files with vault refs: 17
- Files with auth terms: 44
- Status: review_only

## Honesty Boundary

- Shellless command execution only.
- Syntax/review tests only.
- No patch application.
- No provider calls.
- No secret values read or printed.
- No daemon launch.
- No shadow file edits.
