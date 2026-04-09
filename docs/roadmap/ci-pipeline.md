# 5D · GitHub Actions CI Pipeline

**Status:** 📋 Planned

## Scope

Automated CI on every PR and push to main: build, test, lint, catalog integrity, OSCAL validation.

## Workflow File

`.github/workflows/ci.yml`

## Jobs

1. **build** — `npm ci && npm run build` on Node 20
2. **test** — `npm run test` (vitest)
3. **lint** — `npx tsc --noEmit` (type checking)
4. **catalog-integrity** — `npx tsx scripts/ci-catalog-integrity.ts` (verify bundled catalogs)
5. **oscal-validate** — `npx tsx scripts/ci-oscal-validate.ts` (validate OSCAL outputs)

## Matrix

- Node versions: 20, 22
- OS: ubuntu-latest

## Branch Protection

- Require CI pass before merge
- Require at least 1 review

## Exit Criteria

- [ ] CI runs on every PR
- [ ] All 5 jobs pass on clean main
- [ ] Badge in README shows build status
