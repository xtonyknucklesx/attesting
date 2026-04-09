# 10E · Training & Awareness Tracking

**Status:** 💡 Future

## Scope

Track security training assignments, completions, and compliance. Many frameworks (NIST, CMMC, HIPAA) require evidence of security awareness training.

## Features

1. **Training catalog** — define training courses (title, description, frequency, target audience)
2. **Assignment engine** — assign by role, department, or individual. Auto-assign on hire date.
3. **Completion tracking** — mark complete with date, certificate upload as evidence
4. **Overdue alerts** — drift check for overdue training → creates drift alert
5. **Evidence linkage** — completed training auto-creates evidence for relevant controls (AT-* family)
6. **Reporting** — completion rates by department, overdue counts, trend over time

## Implementation

- **Migration:** `training_courses` table, `training_assignments` table (user_id, course_id, due_date, completed_at, evidence_id)
- **Service:** `src/services/training/tracker.ts`
- **Drift check:** Add training overdue check to drift scheduler
- **API:** `/api/training/courses`, `/api/training/assignments`
- **UI:** Training management page with assignment matrix

## Exit Criteria

- [ ] Training assigned and tracked
- [ ] Overdue training fires drift alerts
- [ ] Completions auto-create evidence for AT-* controls
