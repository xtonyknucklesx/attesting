# 2D · Connectors Page

**Status:** 📋 Planned
**Depends on:** `/api/connectors` route (done), connector services (done)
**Pattern:** `src/web/client/components/risk/RiskPage.tsx`

## Views

- **Connector list** — cards showing: adapter type, status (healthy/degraded/error), last sync time, record count
- **Add connector form** — type dropdown (populated from AdapterRegistry), config JSON editor, schedule
- **Manual sync trigger** — button per connector with progress indicator and result summary
- **Sync log table** — history from `connector_sync_log` per connector, filterable by date/status
- **Health status** — per-connector health check with last-checked timestamp

## API Endpoints Consumed

- `GET /api/connectors` — list (includes 24h failure/sync counts)
- `POST /api/connectors` — register new connector
- `POST /api/connectors/:id/sync` — trigger sync (body: `{ full: true }` for full sync)
- `POST /api/connectors/:id/healthcheck` — run health check (POST, not GET)
- `PUT /api/connectors/:id/toggle` — enable/disable connector
- `GET /api/connectors/:id/logs` — sync history (default 20, max 100 via `?limit=`)
- `GET /api/connectors/adapters` — list available adapter types from AdapterRegistry
- `PUT /api/connectors/:id` — update config. **Route not yet exposed — needs to be added to `src/web/routes/connectors.ts`.**
- `DELETE /api/connectors/:id` — deregister. **Route not yet exposed — needs to be added to `src/web/routes/connectors.ts`.**

## Key Details

- Connector cards use color-coded status: green (healthy), amber (degraded), red (error)
- Sync button shows spinner during sync, then result: records upserted, errors, duration
- Config editor should syntax-highlight JSON and validate before submit
- Available adapter types come from AdapterRegistry — only show types that have implementations
- Delete requires confirmation (warns about losing sync history)

## Exit Criteria

- [ ] Connectors page shows registered connectors with health status
- [ ] Can add a CISA KEV connector and trigger sync from the UI
- [ ] Sync log shows history with record counts
