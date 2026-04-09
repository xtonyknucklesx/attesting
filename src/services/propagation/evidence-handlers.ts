import type Database from 'better-sqlite3';
import type { PropagationContext } from './types.js';
import { logEntry } from './types.js';
import { createDriftAlert } from '../drift/alert-writer.js';
import { recalculateRiskForControl } from './risk-handlers.js';

/**
 * Handles evidence state changes: expiry detection, last-evidence
 * checks, and downstream risk recalculation.
 */
export function onEvidenceChange(
  db: Database.Database,
  ctx: PropagationContext,
  evidenceId: string,
  prev: any,
  next: any,
): void {
  // Evidence expired or marked expired
  const isExpired =
    next?.evidence_type === 'expired' ||  // evidence table uses evidence_type
    (next?.collected_at && isStale(next.collected_at, 365));

  if (!isExpired) return;

  const evidence = db.prepare(`
    SELECT e.id, e.title, e.implementation_id,
           c.control_id AS control_ref
    FROM evidence e
    LEFT JOIN implementations i ON e.implementation_id = i.id
    LEFT JOIN controls c ON i.primary_control_id = c.id
    WHERE e.id = ?
  `).get(evidenceId) as {
    id: string; title: string; implementation_id?: string; control_ref?: string;
  } | undefined;

  if (!evidence?.implementation_id) return;

  logEntry(ctx, 'evidence_expired', {
    evidence_id: evidenceId,
    control_id: evidence.control_ref,
    title: evidence.title,
  });

  if (!ctx.dryRun) {
    createDriftAlert(db, {
      alert_type: 'evidence_expired',
      severity: 'medium',
      title: `Evidence expired: ${evidence.title}`,
      message: `Evidence for control ${evidence.control_ref ?? 'unknown'} is stale.`,
      source_entity_type: 'evidence',
      source_entity_id: evidenceId,
      affected_entities: JSON.stringify([
        { type: 'implementation', id: evidence.implementation_id },
      ]),
    });
  }

  // Check if this was the last evidence for the implementation
  const remaining = db.prepare(`
    SELECT COUNT(*) AS cnt FROM evidence
    WHERE implementation_id = ? AND id != ?
  `).get(evidence.implementation_id, evidenceId) as { cnt: number };

  if (remaining.cnt === 0 && !ctx.dryRun) {
    createDriftAlert(db, {
      alert_type: 'control_gap',
      severity: 'high',
      title: `Control has no evidence: ${evidence.control_ref}`,
      message: 'All evidence for this control has expired or been removed.',
      source_entity_type: 'implementation',
      source_entity_id: evidence.implementation_id,
    });
  }

  // Recalculate risk for the affected control
  const impl = db.prepare(
    'SELECT primary_control_id FROM implementations WHERE id = ?'
  ).get(evidence.implementation_id) as { primary_control_id: string } | undefined;
  if (impl) {
    recalculateRiskForControl(db, ctx, impl.primary_control_id);
  }
}

function isStale(collectedAt: string, maxAgeDays: number): boolean {
  const collected = new Date(collectedAt);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - maxAgeDays);
  return collected < cutoff;
}
