# 4F · Okta Adapter

**Status:** 📋 Planned · **Pattern:** `base-adapter.ts`
**Scope:** Pull users, groups, and app assignments. Map to `owners` and `assets`.
**Config:** `{ "domain": "...", "api_token": "..." }`
**API:** Okta Management API (`/api/v1/users`, `/api/v1/groups`, `/api/v1/apps`)
**Target tables:** `owners` (users with roles), `assets` (applications as identity-layer assets)
**Key:** Users become owners with role inferred from group membership. Applications become assets with platform `identity/okta`. Deactivated users flagged for review. Paginate with `Link` header.
**Exit:** Users mapped to owners, apps mapped to assets, deactivated users flagged, tests pass.
