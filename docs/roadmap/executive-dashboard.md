# 8B · Executive Dashboard

**Status:** 💡 Future
**Depends on:** 8A (Compliance Scoring)

## Scope

High-level posture summary for leadership. Single page showing organizational risk and compliance health at a glance.

## Widgets

1. **Overall compliance score** — gauge/donut chart, color-coded (green/amber/red)
2. **Score by framework** — bar chart comparing scores across catalogs
3. **Risk heat map** — 5×5 matrix with risk counts per cell (from existing risk matrix)
4. **Top 10 risks** — sorted by inherent score, showing trend arrows
5. **Drift alert summary** — counts by severity, trend over time
6. **Evidence health** — percentage fresh vs stale vs expired
7. **Exception expiry timeline** — upcoming expirations in next 30/60/90 days
8. **Compliance trend** — line chart showing score over time per catalog

## API Endpoint

`GET /api/dashboard/executive` — aggregates all widget data in one call.

## Key Details

- All data derived from existing tables — no new data collection
- Refresh on page load, no polling (manual refresh button)
- Printable layout for board meeting handouts (CSS print styles)
- Date range selector for trend widgets

## Exit Criteria

- [ ] Dashboard renders all 8 widgets
- [ ] Data is accurate against underlying tables
- [ ] Print view produces clean one-page summary
