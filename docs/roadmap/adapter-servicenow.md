# 4C · ServiceNow Adapter

**Status:** 📋 Planned · **Pattern:** `base-adapter.ts`
**Scope:** Pull incidents and change requests. Map to evidence or risk events.
**Config:** `{ "instance": "...", "client_id": "...", "client_secret": "..." }`
**API:** Table API (`/api/now/table/incident`, `/api/now/table/change_request`)
**Target tables:** `evidence` (resolved incidents as proof of control), `risks` (open incidents as risk indicators)
**Exit:** Transform correct, paginated sync works, tests pass.
