import type Database from 'better-sqlite3';
import type { PropagationContext } from './types.js';
import { logEntry } from './types.js';
import { createDriftAlert } from '../drift/alert-writer.js';

/**
 * Detects repeated connector sync failures and fires alerts.
 */
export function onConnectorStateChange(
  db: Database.Database,
  ctx: PropagationContext,
  connectorId: string,
  next: any,
): void {
  if (next?.last_sync_status !== 'failed') return;

  const failCount = db.prepare(`
    SELECT COUNT(*) AS cnt FROM connector_sync_log
    WHERE connector_id = ? AND status = 'failed'
    AND started_at > datetime('now', '-1 hour')
  `).get(connectorId) as { cnt: number };

  if (failCount.cnt < 3) return;

  logEntry(ctx, 'connector_failing', {
    connector_id: connectorId,
    failures_1h: failCount.cnt,
  });

  if (!ctx.dryRun) {
    createDriftAlert(db, {
      alert_type: 'connector_failure',
      severity: 'high',
      title: `Connector failing repeatedly: ${next.name ?? connectorId}`,
      message: `${failCount.cnt} failures in the last hour. Error: ${next.last_sync_error ?? 'unknown'}`,
      source_entity_type: 'connector',
      source_entity_id: connectorId,
    });
  }
}
