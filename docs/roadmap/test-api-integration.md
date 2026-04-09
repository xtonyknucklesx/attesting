# 3E · API Integration Tests

**Status:** 📋 Planned
**Framework:** vitest + supertest + in-memory better-sqlite3

## Scope

End-to-end tests for each API route group. Tests run against the Express app with an in-memory database.

## Test Files to Create

| Route Group | Test |
|-------------|------|
| `/api/catalogs` | `tests/web/routes/catalogs.test.ts` |
| `/api/risk` | `tests/web/routes/risk.test.ts` |
| `/api/intel` | `tests/web/routes/intel.test.ts` |
| `/api/drift` | `tests/web/routes/drift.test.ts` |
| `/api/assets` | `tests/web/routes/assets.test.ts` |
| `/api/connectors` | `tests/web/routes/connectors.test.ts` |
| `/api/governance` | `tests/web/routes/governance.test.ts` |
| `/api/import` | `tests/web/routes/import.test.ts` |

## Shared Test Setup

Create `tests/web/test-app.ts` — factory that builds Express app with in-memory DB, applies schema + migrations, returns `{ app, db }`.

## Key Test Patterns

For each route group:
- **GET list** — returns 200 with array, respects query filters
- **POST create** — returns 201 with ID, validates required fields, returns 400 on missing
- **GET by ID** — returns 200 with full object, 404 for missing
- **PUT update** — returns 200, partial updates work, recomputes derived fields
- **DELETE** — returns 200, subsequent GET returns 404
- **Propagation side effects** — write endpoints trigger propagation (verify audit log entries)
- **Error responses** — invalid input returns 400 with descriptive error

## Import Route Tests

- Upload valid CSV → preview returns controls + mappings
- Upload malicious file → 400 with scan rejection reason
- Upload oversized file → 413 or 400
- Confirm with valid upload_path → 201 with import result
- Confirm with path traversal attempt → 400

## Exit Criteria

- [ ] All route groups have integration tests
- [ ] Tests use shared in-memory DB setup
- [ ] Propagation side effects verified on write endpoints
- [ ] Error cases covered (400, 404, invalid input)
- [ ] `npx vitest run tests/web/routes/` passes
