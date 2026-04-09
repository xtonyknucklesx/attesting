# 10D · Policy Document Management

**Status:** 💡 Future
**Depends on:** Policy tables (done), propagation handlers (done)

## Scope

Full policy lifecycle: drafting, review, approval, publication, versioning, and retirement. Extends existing policy tables with document management capabilities.

## Features

1. **Draft editor** — rich text or markdown editor for policy content
2. **Review workflow** — assign reviewers, collect comments, track approval chain
3. **Version control** — each published version retained, diff between versions
4. **Publication** — approved policies become active, supersede previous versions
5. **Retirement** — retired policies trigger propagation (drift alerts for dependent controls)
6. **Template library** — starter templates for common policy types (access control, incident response, etc.)
7. **Attestation tracking** — record who has read/acknowledged each policy

## Implementation

- **Migration:** `policy_versions` table, `policy_reviews` table, `policy_attestations` table
- **Service:** `src/services/policy/lifecycle.ts`, `src/services/policy/versioning.ts`
- **API:** Extend `/api/governance/policies` with version/review/attestation endpoints
- **Propagation:** Already handled — policy content_hash change triggers drift detection

## Exit Criteria

- [ ] Policies flow through draft → review → approved → published
- [ ] Version history with diffs
- [ ] Retirement triggers propagation correctly
