import type Database from 'better-sqlite3';
import type { PropagationContext } from './types.js';
import { logEntry } from './types.js';
import { suppressDriftAlert } from '../drift/alert-writer.js';

/**
 * Handles an approved disposition: suppresses the drift alert,
 * updates linked risk entries if the disposition accepts risk.
 */
export function onDispositionApproved(
  db: Database.Database,
  ctx: PropagationContext,
  dispositionId: string,
): void {
  const disp = db.prepare(`
    SELECT d.*, da.id AS alert_id
    FROM dispositions d
    JOIN drift_alerts da ON d.drift_alert_id = da.id
    WHERE d.id = ?
  `).get(dispositionId) as any;

  if (!disp) return;

  logEntry(ctx, 'disposition_applied', {
    disposition_id: dispositionId,
    type: disp.disposition_type,
    alert_id: disp.alert_id,
    suppressed_until: disp.expires_at,
  });

  if (ctx.dryRun) return;

  // Suppress the drift alert
  suppressDriftAlert(
    db,
    disp.alert_id,
    dispositionId,
    disp.expires_at,
    disp.analyst_id,
  );

  // If accepted risk, update risk entry status
  if (disp.disposition_type === 'accepted_risk') {
    const risks = db.prepare(`
      SELECT r.id FROM risks r
      WHERE r.source_type = 'drift_alert' AND r.source_id = ?
    `).all(disp.alert_id) as Array<{ id: string }>;

    for (const risk of risks) {
      db.prepare(
        `UPDATE risks SET status = 'accepted', updated_at = datetime('now') WHERE id = ?`
      ).run(risk.id);
    }
  }
}
