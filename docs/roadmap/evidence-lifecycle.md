# 8E · Evidence Lifecycle Management

**Status:** 💡 Future
**Depends on:** Evidence table (done), drift checks (done)

## Scope

Full lifecycle tracking for evidence artifacts: collection, review, approval, renewal, and archival.

## Evidence States

`draft` → `submitted` → `reviewed` → `approved` → `active` → `expiring` → `expired` → `archived`

## Features

1. **Evidence collection queue** — controls needing evidence, grouped by owner
2. **Upload + metadata** — file upload with type, description, reviewer, renewal period
3. **Review workflow** — reviewer approves or rejects with comments
4. **Renewal reminders** — configurable lead time before expiry (30/60/90 days)
5. **Version history** — previous versions retained when evidence is renewed
6. **Bulk renewal** — select multiple evidence items and extend expiry dates

## Implementation

- **Migration:** Add columns to `evidence`: `status`, `reviewer_id`, `reviewed_at`, `version`, `previous_version_id`, `renewal_period_days`
- **Service:** `src/services/evidence/lifecycle.ts`
- **API:** Extend `/api/implementations/:id/evidence` with lifecycle endpoints
- **Drift check:** Existing evidence staleness check transitions state to `expiring`/`expired`

## Exit Criteria

- [ ] Evidence flows through all lifecycle states
- [ ] Renewal reminders fire at configured lead times
- [ ] Version history shows previous evidence for same control
