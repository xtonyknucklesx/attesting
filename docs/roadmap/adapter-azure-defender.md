# 4I · Azure Defender Adapter

**Status:** 📋 Planned · **Pattern:** `base-adapter.ts`
**Scope:** Pull security alerts and recommendations from Microsoft Defender for Cloud. Map to `controls` and `risks`.
**Config:** `{ "tenant_id": "...", "client_id": "...", "client_secret": "...", "subscription_id": "..." }`
**API:** Azure Security Center REST API (`/providers/Microsoft.Security/alerts`, `/providers/Microsoft.Security/assessments`)
**Target tables:** `risks` (active alerts), `evidence` (healthy assessments), `assets` (Azure resource IDs)
**Key:** Alerts → risks with severity from alert severity field. Assessments with `status.code=Healthy` → evidence. Unhealthy assessments → control gaps. Resource IDs become assets with platform `azure/<resource-type>`. OAuth2 client credentials via Microsoft Identity Platform.
**Exit:** Alerts mapped to risks, assessments to evidence/gaps, Azure resources as assets, tests pass.
