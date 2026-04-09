# 2A · Assets Page

**Status:** 📋 Planned
**Depends on:** `/api/assets` route (done)
**Pattern:** `src/web/client/components/risk/RiskPage.tsx`

## Scope

React page for the asset inventory — view, create, edit, and explore asset relationships.

## Views

- **Table view** — all assets with search, filter by platform/boundary/owner, sortable columns
- **Create/edit form** — name, platform, type, owner, boundary assignment
- **Detail view** — single asset showing:
  - Linked threats (via `threat_asset_correlations`)
  - Linked risks (via `risk_asset_links`)
  - Boundary membership (via `asset_boundaries`)
  - Timeline of changes from audit log

## API Endpoints Consumed

- `GET /api/assets` — list with filters
- `POST /api/assets` — create
- `PUT /api/assets/:id` — update
- `DELETE /api/assets/:id` — delete
- `GET /api/assets/:id` — detail with relationships

## Key Details

- Platform field drives threat correlation — changes trigger `propagate(db, 'asset', id, 'update', ...)`
- Owner dropdown populated from `/api/owners`
- Boundary picker populated from existing boundaries or inline create
- Delete requires confirmation modal (cascading effects warning)

## Exit Criteria

- [ ] Assets page renders in sidebar navigation
- [ ] CRUD operations work end-to-end
- [ ] Detail view shows linked threats and risks
