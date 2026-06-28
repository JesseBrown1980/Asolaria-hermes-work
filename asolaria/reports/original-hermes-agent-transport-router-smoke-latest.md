# Original Hermes Transport Router Smoke

Generated: 2026-04-25T02:54:22.974Z
Status: TRANSPORT_ROUTER_CONTRACT_STAGED_NO_SECRET_IMPORT_NO_DISPATCH
Validation: PASS
Digest: 364c3128c2d946de5b16cf0de3982eb132e8d398c9abea7112cf933acef43abc

## Providers

- openai: configured=true enabled=true style=openai_responses error=none
- kimi: configured=false enabled=true style=openai_chat_completions error=missing_config
- cursor: configured=true enabled=true style=openai_responses error=none
- antigravity: configured=true enabled=true style=openai_responses error=none

## Workers

- opencode: dispatchable=true direct=true trust=unknown
- local_codex: dispatchable=true direct=true trust=unknown
- claude_max: dispatchable=true direct=true trust=unknown
- abacus: dispatchable=true direct=true trust=unknown
- symphony: dispatchable=true direct=true trust=unknown

## Route Matrix

- Provider transports: 3
- Worker transports: 5
- Cognitive engine transports: 3

## Policy

- Provider secret import: false
- Provider secret exposure: false
- Dispatch now: false
- Gateway launch: false
- Provider calls: false

## Validation

- Errors: none
- Warnings: kimi:missing_config

## Honesty Boundary

- Read-only route matrix and report only.
- No provider secret import or exposure.
- No worker dispatch.
- No external provider call.
- No gateway launch.
- No upstream Hermes runtime execution.
- No shadow file edits.
