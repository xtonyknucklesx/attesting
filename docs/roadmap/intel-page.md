# 2B · Intel Page

**Status:** 📋 Planned
**Depends on:** `/api/intel` route (done), intel services (done)
**Pattern:** `src/web/client/components/risk/RiskPage.tsx`

## Views

- **Threat feed table** — all `threat_inputs` with source/platform/severity/date filters
- **Manual intel submission form** — title, description, platform, CVEs, indicators
- **Shadow impact preview panel** — shows what would change if intel is confirmed (risks, controls, assets)
- **Detail view** — single intel entry with corroboration status, linked risks, linked assets
- **Promotion action** — button to promote provisional → confirmed with confirmation dialog

## API Endpoints Consumed

- `GET /api/intel/threats` — list threat inputs (with severity/processed filters)
- `GET /api/intel/threats/:id` — threat detail with asset correlations and linked risks
- `GET /api/intel/manual` — list manual intel entries
- `POST /api/intel/manual` — submit manual intel
- `GET /api/intel/manual/:id/shadow` — shadow impact analysis
- `POST /api/intel/manual/:id/promote` — promote to confirmed
- `POST /api/intel/manual/:id/archive` — archive with reason
- `POST /api/intel/corroborate` — trigger auto-corroboration. **Route not yet exposed — needs to be added to `src/web/routes/intel.ts`.** Service function `checkAutoCorroboration()` exists in `src/services/intel/auto-corroboration.ts`.

## Key Details

- Submission form sets status to `provisional` and immediately shows shadow impact
- Shadow panel displays: alerts that would fire, risks affected, controls affected, assets exposed
- Promotion triggers full `propagate()` — page should refresh related data after
- Corroboration button runs check across all provisional intel and reports matches
- Status badges: provisional (yellow), confirmed (green), rejected (red)

## Exit Criteria

- [ ] Intel page renders with threat feed table
- [ ] Manual submission → shadow preview → promote workflow works
- [ ] Corroboration results display inline
