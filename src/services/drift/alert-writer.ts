import type Database from 'better-sqlite3';
import type { DriftAlertInput } from '../../models/drift-alert.js';
import { generateUuid } from '../../utils/uuid.js';

/**
 * Creates a drift alert if one doesn't already exist for the same
 * type + source entity. Returns the alert ID (new or existing).
 */
export function createDriftAlert(
  db: Database.Database,
  input: DriftAlertInput,
): string {
  // Deduplicate: skip if an unresolved, unsuppressed alert already exists
  const existing = db.prepare(`
    SELECT id FROM drift_alerts
    WHERE alert_type = ? AND source_entity_type = ? AND source_entity_id = ?
    AND resolved_at IS NULL
    AND (suppressed_until IS NULL OR suppressed_until < datetime('now'))
  `).get(input.alert_type, input.source_entity_type, input.source_entity_id) as
    { id: string } | undefined;

  if (existing) return existing.id;

  const id = generateUuid();
  db.prepare(`
    INSERT INTO drift_alerts (id, alert_type, severity, title, message,
                              source_entity_type, source_entity_id, affected_entities)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.alert_type,
    input.severity,
    input.title,
    input.message ?? null,
    input.source_entity_type,
    input.source_entity_id,
    input.affected_entities ?? null,
  );

  return id;
}

/** Resolve a drift alert (manually or by system). */
export function resolveDriftAlert(
  db: Database.Database,
  alertId: string,
  resolvedBy: string,
  note?: string,
  auto = false,
): void {
  db.prepare(`
    UPDATE drift_alerts
    SET resolved_at = datetime('now'),
        resolved_by = ?,
        auto_resolved = ?,
        resolution_note = ?
    WHERE id = ?
  `).run(resolvedBy, auto ? 1 : 0, note ?? null, alertId);
}

/** Suppress a drift alert until a given date via disposition. */
export function suppressDriftAlert(
  db: Database.Database,
  alertId: string,
  dispositionId: string,
  suppressUntil: string,
  acknowledgedBy: string,
): void {
  db.prepare(`
    UPDATE drift_alerts
    SET suppressed_until = ?,
        disposition_id = ?,
        acknowledged_at = COALESCE(acknowledged_at, datetime('now')),
        acknowledged_by = ?
    WHERE id = ?
  `).run(suppressUntil, dispositionId, acknowledgedBy, alertId);
}

/** Re-activate a previously suppressed drift alert. */
export function unsuppressDriftAlert(
  db: Database.Database,
  alertId: string,
): void {
  db.prepare(`
    UPDATE drift_alerts
    SET suppressed_until = NULL,
        resolved_at = NULL,
        disposition_id = NULL
    WHERE id = ?
  `).run(alertId);
}
