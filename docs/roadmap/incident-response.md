# 10F · Incident Response Integration

**Status:** 💡 Future

## Scope

Track security incidents and link them to the GRC graph. Incidents become risk evidence, trigger control reviews, and satisfy IR framework requirements.

## Features

1. **Incident registry** — log incidents with severity, category, timeline, affected assets
2. **Playbook templates** — predefined response steps for common incident types
3. **Asset linkage** — incidents linked to affected assets → risk recalculation
4. **Control effectiveness review** — after incident closure, flag controls that should have prevented it
5. **Lessons learned** — post-incident review creates improvement items (implementation updates, policy changes)
6. **Evidence generation** — incident response documentation auto-creates evidence for IR-* controls
7. **Metrics** — MTTD, MTTR, incident frequency, category distribution

## Implementation

- **Migration:** `incidents` table, `incident_assets` junction, `incident_playbooks` table, `incident_timeline` table
- **Service:** `src/services/incidents/tracker.ts`, `src/services/incidents/metrics.ts`
- **Propagation:** Incident creation triggers risk recalculation for affected assets
- **API:** `/api/incidents`
- **UI:** Incident management page with timeline view

## Key Details

- Incident severity maps to risk impact for automatic risk score adjustment
- Playbooks reference specific controls — completing a playbook step creates evidence
- Post-incident review can auto-generate POA&M items for control improvements

## Exit Criteria

- [ ] Incidents logged with full timeline
- [ ] Affected assets linked and risk recalculated
- [ ] Post-incident review generates improvement items
- [ ] IR-* controls receive evidence from incident handling
