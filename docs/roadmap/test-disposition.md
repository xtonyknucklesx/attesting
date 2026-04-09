# 3B · Disposition Pipeline Tests

**Status:** 📋 Planned
**Framework:** vitest

## Files to Test → Test Files

| Source | Test |
|--------|------|
| `src/services/disposition/classifier.ts` | `tests/services/disposition/classifier.test.ts` |
| `src/services/disposition/entity-extractor.ts` | `tests/services/disposition/entity-extractor.test.ts` |
| `src/services/disposition/task-generator.ts` | `tests/services/disposition/task-generator.test.ts` |
| `src/services/disposition/approval.ts` | `tests/services/disposition/approval.test.ts` |

## Key Test Cases

**classifier.ts** — all 6 types plus edge cases:
- "We accept this risk" → `accepted_risk`
- "This is by design" → `by_design`
- "We have a compensating control" → `compensating_control`
- "Deferring to next quarter" → `deferred`
- "This is a false positive" → `false_positive`
- "Not applicable to our environment" → `not_applicable`
- Ambiguous input → lowest-confidence match or unknown
- Empty input → error/unknown

**entity-extractor.ts:**
- Extracts MCAT item references
- Extracts NIST 800-53 control IDs (e.g., AC-2, SI-4)
- Extracts CMMC practice IDs
- Extracts NISPOM section references
- Extracts Jira ticket IDs (e.g., PROJ-123)
- Extracts temporal references ("next quarter", "by end of month")
- Multiple entities in single rationale

**task-generator.ts:**
- "hasn't been updated yet" → policy update task
- "need to implement" → implementation task
- "waiting for vendor" → vendor follow-up task
- No actionable phrases → no tasks generated

**approval.ts:**
- High-risk disposition → routes to supervisor
- Low-risk disposition → self-approved
- All dispositions get TTL assigned
- Expired TTL → re-fires alert

## Exit Criteria

- [ ] All 4 disposition service files have tests
- [ ] Classifier covers all 6 types + ambiguous/empty
- [ ] Entity extractor covers all entity types
- [ ] `npx vitest run tests/services/disposition/` passes
