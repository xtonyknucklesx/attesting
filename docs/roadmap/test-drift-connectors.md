# 3D · Drift & Connector Tests

**Status:** 📋 Planned
**Framework:** vitest + in-memory better-sqlite3

## Files to Test → Test Files

| Source | Test |
|--------|------|
| `src/services/drift/checks.ts` | `tests/services/drift/checks.test.ts` |
| `src/services/drift/scheduler.ts` | `tests/services/drift/scheduler.test.ts` |
| `src/services/drift/alert-writer.ts` | `tests/services/drift/alert-writer.test.ts` |
| `src/services/connectors/base-adapter.ts` | `tests/services/connectors/base-adapter.test.ts` |
| `src/services/connectors/registry.ts` | `tests/services/connectors/registry.test.ts` |
| `src/services/connectors/adapters/cisa-kev.ts` | `tests/services/connectors/cisa-kev.test.ts` |

## Key Test Cases

**checks.ts** — each of 6 checks:
- Evidence staleness: stale evidence → alert, fresh evidence → no alert
- Policy review overdue: past review_date → alert
- Risk exception expired: past expiry_date → alert, status change
- Disposition expired: past TTL → re-fires original alert
- Manual intel deadline: overdue provisional intel → warning
- Full posture recalc: recalculates all risk scores

**base-adapter.ts:**
- Sync logging writes to `connector_sync_log`
- Upsert by `external_id` updates existing, inserts new
- Health tracking records check result and timestamp
- Error during sync → logged, doesn't crash

**cisa-kev.ts:**
- Transform maps KEV record to `threat_input` schema correctly
- Deduplication by CVE ID
- Handles missing/malformed fields gracefully

## Exit Criteria

- [ ] All 6 files have tests
- [ ] Each drift check tested with stale, fresh, and edge-case data
- [ ] CISA KEV transform verified against sample records
- [ ] `npx vitest run tests/services/drift/ tests/services/connectors/` passes
