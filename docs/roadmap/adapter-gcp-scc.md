# 4J · GCP Security Command Center Adapter

**Status:** 📋 Planned · **Pattern:** `base-adapter.ts`
**Scope:** Pull findings and assets from GCP Security Command Center. Map to `controls` and `risks`.
**Config:** `{ "project_id": "...", "organization_id": "...", "credentials_path": "..." }`
**API:** SCC API v2 (`organizations/{id}/sources/-/findings`, `organizations/{id}/assets`)
**Target tables:** `risks` (active findings), `evidence` (resolved findings as remediation proof), `assets` (GCP resource names)
**Key:** Findings → risks with severity from `finding.severity`. `state=ACTIVE` → risk, `state=INACTIVE` → evidence of remediation. Resource names become assets with platform `gcp/<resource-type>`. Service account authentication via key file. Paginate with `pageToken`.
**Exit:** Findings mapped to risks/evidence, GCP resources as assets, tests pass.
