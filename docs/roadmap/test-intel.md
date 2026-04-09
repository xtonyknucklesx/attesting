# 3C · Intel Service Tests

**Status:** 📋 Planned
**Framework:** vitest + in-memory better-sqlite3

## Files to Test → Test Files

| Source | Test |
|--------|------|
| `src/services/intel/manual-intel.ts` | `tests/services/intel/manual-intel.test.ts` |
| `src/services/intel/shadow-analysis.ts` | `tests/services/intel/shadow-analysis.test.ts` |
| `src/services/intel/auto-corroboration.ts` | `tests/services/intel/auto-corroboration.test.ts` |

## Key Test Cases

**manual-intel.ts:**
- Submit creates row with `status: 'provisional'`
- Promote changes status to `confirmed` and creates `threat_input`
- Promote triggers `propagate()` with correct entity type
- Double-promote is idempotent or errors gracefully
- Reject sets status to `rejected`

**shadow-analysis.ts:**
- `generateShadowImpact()` returns impact without DB writes
- Impact includes: alerts that would fire, risks affected, controls affected, assets exposed
- Empty impact when no matching assets/controls exist

**auto-corroboration.ts:**
- Exact CVE match → corroborates
- Platform overlap match → corroborates
- Title similarity match (fuzzy) → corroborates with lower confidence
- No match → remains provisional
- Already confirmed intel → skipped
- Multiple provisional entries, some match, some don't

## Exit Criteria

- [ ] All 3 intel service files have tests
- [ ] Auto-corroboration covers all match types + no-match
- [ ] Shadow analysis verified to produce no side effects
- [ ] `npx vitest run tests/services/intel/` passes
