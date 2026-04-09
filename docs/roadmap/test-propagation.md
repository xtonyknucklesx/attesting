# 3A · Propagation Engine Tests

**Status:** 📋 Planned
**Framework:** vitest + in-memory better-sqlite3

## Scope

Unit tests for all propagation handler files in `src/services/propagation/`.

## Files to Test → Test Files to Create

| Source | Test |
|--------|------|
| `dispatcher.ts` | `tests/services/propagation/dispatcher.test.ts` |
| `governance-handlers.ts` | `tests/services/propagation/governance-handlers.test.ts` |
| `risk-handlers.ts` | `tests/services/propagation/risk-handlers.test.ts` |
| `threat-handlers.ts` | `tests/services/propagation/threat-handlers.test.ts` |
| `evidence-handlers.ts` | `tests/services/propagation/evidence-handlers.test.ts` |
| `asset-handlers.ts` | `tests/services/propagation/asset-handlers.test.ts` |
| `disposition-handlers.ts` | `tests/services/propagation/disposition-handlers.test.ts` |
| `connector-handlers.ts` | `tests/services/propagation/connector-handlers.test.ts` |

## Key Test Cases

**dispatcher.ts:**
- Routes to correct handler by entityType
- Returns propagation log entries
- Writes audit entry after handler runs
- Unknown entityType is a no-op (no crash)

**governance-handlers.ts:**
- Policy content change → creates drift alerts for linked implementations
- Policy section change → recascades to implementations
- Policy retired → flags all linked controls as orphaned

**risk-handlers.ts:**
- `recalculateRiskForControl` recomputes after implementation status change
- No-op when no risks linked to the control

**threat-handlers.ts:**
- Threat ingested → correlates against assets by platform
- Threat with CVE → maps to NIST control families
- No matching assets → still logs, no risk created

**evidence-handlers.ts:**
- Evidence expired → control gap alert created
- Evidence with remaining evidence → no gap alert
- Evidence deleted → rechecks control coverage

**asset-handlers.ts:**
- Platform changed → re-correlates against all active threats
- New correlations create risk entries

**disposition-handlers.ts:**
- Approved disposition → suppresses drift alert with TTL
- TTL expiry → alert reactivates

**shadowPropagate:**
- Returns impact analysis without writing to DB
- Same handler logic runs but context is read-only

## Exit Criteria

- [ ] All handler files have corresponding test files
- [ ] Each handler has ≥3 test cases (happy path, edge case, no-op)
- [ ] `shadowPropagate` verified to produce no side effects
- [ ] `npx vitest run tests/services/propagation/` passes
