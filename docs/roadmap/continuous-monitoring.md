# 8D · Continuous Monitoring Dashboard

**Status:** 💡 Future
**Depends on:** Drift scheduler (done), connectors (done), 8A (Compliance Scoring)

## Scope

Real-time operational dashboard showing live compliance posture, active alerts, connector health, and recent changes.

## Widgets

1. **Alert feed** — live stream of drift alerts, newest first, filterable by type/severity
2. **Connector status panel** — all connectors with health badges and last-sync times
3. **Control coverage gaps** — controls without evidence or with expired evidence
4. **Recent changes** — last 50 audit log entries (entity changes across the platform)
5. **Scheduler status** — next run times for all 6 drift checks
6. **Risk movement** — risks that changed score in the last 7/30 days

## Key Details

- Auto-refresh every 60 seconds (configurable, toggleable)
- Color-coded severity throughout: green/amber/red
- Click-through from any widget item to its detail view
- Time range selector for historical widgets

## API

- `GET /api/dashboard/monitoring` — aggregated monitoring data
- Reuses existing endpoints for detail drill-down

## Exit Criteria

- [ ] Dashboard renders all 6 widgets with live data
- [ ] Auto-refresh works without full page reload
- [ ] Alert feed shows new items as they arrive
