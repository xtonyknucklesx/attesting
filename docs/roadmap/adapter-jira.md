# 4D · Jira Adapter

**Status:** 📋 Planned · **Pattern:** `base-adapter.ts`
**Scope:** Sync Jira issues referenced in dispositions. Link to `disposition_tasks`. Bidirectional: push task status back to Jira.
**Config:** `{ "base_url": "...", "email": "...", "api_token": "...", "project_key": "..." }`
**API:** Jira REST API v3 (`/rest/api/3/search`, `/rest/api/3/issue`)
**Target tables:** `disposition_tasks` (link by Jira ticket ID extracted by entity-extractor)
**Key:** Entity extractor already identifies `PROJ-123` patterns in disposition rationale — adapter resolves them to real Jira issues and syncs status.
**Exit:** Jira issues linked to disposition tasks, status sync works, tests pass.
