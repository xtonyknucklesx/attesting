# 5F · CONTRIBUTING.md + Developer Guide

**Status:** 📋 Planned

## Scope

Contributor guide covering: dev setup, code conventions, PR process, architecture overview for newcomers.

## Sections

1. **Dev Setup** — clone, install, build, run tests, start dev server
2. **Code Conventions** — link to conventions in CLAUDE.md (files < 300 lines, stateless services, etc.)
3. **Architecture Overview** — propagation engine, entity graph, service layer patterns
4. **Adding a Feature** — step-by-step: model → service → route → CLI → UI → test
5. **Adding a Connector** — step-by-step: extend BaseAdapter → register → CLI → test
6. **Adding a Catalog** — how to add bundled catalogs + mappings
7. **Schema Changes** — migration file conventions, never edit schema.sql
8. **Testing** — vitest conventions, in-memory DB setup, mocking patterns
9. **PR Process** — branch naming, commit message format, CI requirements, review expectations
10. **Code of Conduct** — standard Contributor Covenant

## Files to Create

- `CONTRIBUTING.md`
- `CODE_OF_CONDUCT.md`

## Exit Criteria

- [ ] New contributor can set up dev environment from CONTRIBUTING.md alone
- [ ] Architecture section gives enough context to make a first PR
- [ ] PR process is clear and actionable
