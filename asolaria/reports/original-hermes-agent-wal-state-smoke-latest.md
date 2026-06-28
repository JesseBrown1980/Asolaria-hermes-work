# Original Hermes WAL State Smoke

Generated: 2026-04-25T02:54:24.232Z
Status: WAL_STATE_MANIFEST_READY_MIGRATION_BLOCKED
Validation: PASS
Digest: 1f91dba1077bf0cf8f906c0a422a5d9d3957fc5bb8e55717982f4b228e4be378

## Summary

- Stores: 5
- JSON rewrite stores: 4
- Append-only stores: 1
- Temp siblings: 7
- Migration writes: 0
- Data deletes: 0
- Secrets imported: 0

## Stores

- agent_sessions: mode=json_atomic_rewrite exists=true bytes=24857 temp=7 risk=json_store_without_explicit_wal|stale_temp_siblings_present
- task_ledger: mode=json_atomic_rewrite exists=true bytes=1630204 temp=0 risk=json_store_without_explicit_wal
- mistake_ledger: mode=ndjson_append exists=true bytes=1782522 temp=0 risk=source_mentions_secret_terms_verify_no_state_rows
- memory: mode=json_store exists=true bytes=189833 temp=0 risk=json_store_without_explicit_wal|source_mentions_secret_terms_verify_no_state_rows
- notebook: mode=json_store exists=true bytes=276792 temp=0 risk=json_store_without_explicit_wal|source_mentions_secret_terms_verify_no_state_rows

## Gates

- manifest_first
- no_store_migration_until_smoke
- single_writer_or_sqlite_wal_required
- stale_temp_cleanup_requires_operator_review
- secret_material_forbidden_in_state_rows

## Validation

- Errors: none
- Warnings: stale_temp_siblings_present_cleanup_blocked

## Honesty Boundary

- Manifest and review queues only.
- No store migration.
- No temp file deletion.
- No secret import.
- No daemon launch.
- No shadow file edits.
