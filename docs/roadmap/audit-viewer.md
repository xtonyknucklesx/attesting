# 7D · Audit Log Viewer

**Status:** 💡 Future
**Depends on:** Audit service (done), `/api/audit` route (done)

## Scope

Web UI page for browsing, filtering, and exporting the immutable audit trail.

## Views

- **Timeline view** — chronological feed of all audit entries with entity type icons
- **Filters** — entity type, action, actor, date range, entity ID search
- **Detail panel** — single entry showing full prev/next state diff (JSON diff view)
- **Export** — download filtered results as CSV or JSON

## API Enhancements

- Add pagination to `GET /api/audit` (offset + limit)
- Add `?entity_type=`, `?action=`, `?actor=`, `?from=`, `?to=` query filters
- Add `GET /api/audit/export?format=csv` endpoint

## Key Details

- Diff view highlights changed fields between prev and next state
- Actor shown with type badge (user, system, connector)
- Entries are immutable — no edit or delete in UI
- Large result sets paginated (50 per page default)

## Exit Criteria

- [ ] Audit page renders with filterable timeline
- [ ] Diff view shows prev→next changes clearly
- [ ] CSV/JSON export works for filtered results
