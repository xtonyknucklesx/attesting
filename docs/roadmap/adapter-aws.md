# 4H · AWS Security Hub Adapter

**Status:** 📋 Planned · **Pattern:** `base-adapter.ts`
**Scope:** Pull security findings and compliance check results. Map to `controls` (compliance status) and `risks` (active findings).
**Config:** `{ "region": "...", "access_key_id": "...", "secret_access_key": "...", "role_arn": "..." }`
**API:** AWS Security Hub API (`GetFindings`, `GetInsights`, `DescribeStandards`)
**Target tables:** `risks` (active HIGH/CRITICAL findings), `evidence` (PASSED checks as compliance evidence), `assets` (resource ARNs)
**Key:** Findings map to risks with severity from `Severity.Normalized` (0-100 → 1-5). Compliance checks that pass become evidence. Resource ARNs become assets with platform `aws/<service>`. Filter by `RecordState=ACTIVE`. Support assume-role for cross-account.
**Exit:** Findings mapped to risks, compliance results mapped to evidence, ARNs as assets, tests pass.
