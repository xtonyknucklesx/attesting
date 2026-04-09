# 4E · Splunk Adapter

**Status:** 📋 Planned · **Pattern:** `base-adapter.ts`
**Scope:** Pull notable events and correlation search results. Transform to `threat_inputs` or `evidence`.
**Config:** `{ "base_url": "...", "token": "...", "saved_search": "..." }`
**API:** Splunk REST API (`/services/search/jobs`, `/services/saved/searches`)
**Target tables:** `threat_inputs` (notable events with threat indicators), `evidence` (log-based proof of control operation)
**Key:** Architecture decision — pull (scheduled saved search) vs push (webhook via HEC). Default to pull. Webhook support as future enhancement.
**Exit:** Notable events transformed to threat_inputs, saved search results mapped, tests pass.
