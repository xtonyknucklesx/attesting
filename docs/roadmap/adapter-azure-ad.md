# 4G · Azure AD / Entra ID Adapter

**Status:** 📋 Planned · **Pattern:** `base-adapter.ts`
**Scope:** Pull users, groups, and directory roles. Map to `owners` and `assets`. Same functional scope as Okta for Microsoft environments.
**Config:** `{ "tenant_id": "...", "client_id": "...", "client_secret": "..." }`
**API:** Microsoft Graph API (`/v1.0/users`, `/v1.0/groups`, `/v1.0/applications`)
**Target tables:** `owners` (users with directory roles), `assets` (registered applications)
**Key:** OAuth2 client credentials flow. Directory roles map to owner role assignments. Enterprise applications become assets with platform `identity/azure-ad`. Paginate with `@odata.nextLink`. Disabled accounts flagged.
**Exit:** Users/groups mapped to owners, applications mapped to assets, tests pass.
