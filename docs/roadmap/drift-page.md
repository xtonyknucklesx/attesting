# 2C · Drift Page

**Status:** 📋 Planned
**Depends on:** `/api/drift` route (done), disposition services (done)
**Pattern:** `src/web/client/components/risk/RiskPage.tsx`

## Views

- **Dashboard header** — drift alert counts by type and severity (cards/badges)
- **Alert table** — filterable by type, status, severity, date range
- **Disposition workflow** — inline panel: type natural-language response → see NLP classification preview → submit → approval status
- **Tasks list** — auto-generated `disposition_tasks` with status tracking
- **Alert detail** — single alert with full context (source entity, affected controls, disposition history)

## API Endpoints Consumed

- `GET /api/drift/alerts` — list with filters (status: active/resolved/suppressed, severity)
- `GET /api/drift/alerts/:id` — detail with disposition history
- `POST /api/drift/alerts/:id/resolve` — manually resolve alert
- `GET /api/drift/dashboard` — summary counts (active, bySeverity, byType, pendingApprovals)
- `POST /api/drift/dispositions` — submit disposition text for NLP processing (requires drift_alert_id, analyst_id, text)
- `POST /api/drift/dispositions/commit` — commit a processed disposition to the database
- `POST /api/drift/dispositions/:id/approve` — supervisor approval
- `POST /api/drift/dispositions/:id/reject` — supervisor rejection
- `GET /api/drift/dispositions/pending` — list dispositions awaiting approval
- `GET /api/drift/tasks` — list disposition tasks. **Route not yet exposed — needs to be added to `src/web/routes/drift.ts`.** Table `disposition_tasks` exists.
- `PUT /api/drift/tasks/:id` — update task status. **Route not yet exposed — needs to be added to `src/web/routes/drift.ts`.**

## Key Details

- Disposition input is a textarea — user types natural language rationale
- Before submit, show NLP classification preview: detected type, extracted entities, tasks that will be generated
- Approval routing shown inline: "self-approved" (green) or "pending supervisor" (amber)
- Disposition TTL shown with expiry countdown
- Tasks are actionable — status can be toggled (open → in_progress → complete)

## Exit Criteria

- [ ] Dashboard shows alert counts by type/severity
- [ ] Disposition workflow: type rationale → see classification → submit → see approval status
- [ ] Tasks list updates when dispositions generate new tasks
