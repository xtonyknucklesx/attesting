import type Database from 'better-sqlite3';
import { createDriftAlert } from './alert-writer.js';
import { unsuppressDriftAlert } from './alert-writer.js';
import { recalculateRiskForControl } from '../propagation/risk-handlers.js';
import { createContext } from '../propagation/types.js';
import { SYSTEM_ACTOR } from '../audit/logger.js';

/**
 * Checks for evidence older than maxAgeDays with no expiry tracking.
 * The existing evidence table doesn't have expires_at, so we use
 * collected_at + a staleness threshold.
 */
export function checkEvidenceStaleness(
  db: Database.Database,
  maxAgeDays = 365,
): { stale: number; alerted: number } {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - maxAgeDays);

  const stale = db.prepare(`
    SELECT e.id, e.title, e.implementation_id, e.collected_at,
           c.control_id AS control_ref
    FROM evidence e
    LEFT JOIN implementations i ON e.implementation_id = i.id
    LEFT JOIN controls c ON i.primary_control_id = c.id
    WHERE e.collected_at IS NOT NULL
    AND e.collected_at < ?
  `).all(cutoff.toISOString()) as Array<{
    id: string; title: string; implementation_id?: string; control_ref?: string;
  }>;

  let alerted = 0;
  for (const ev of stale) {
    createDriftAlert(db, {
      alert_type: 'evidence_expired',
      severity: 'medium',
      title: `Evidence may be stale: ${ev.title}`,
      message: `Collected more than ${maxAgeDays} days ago for control ${ev.control_ref ?? 'unknown'}.`,
      source_entity_type: 'evidence',
      source_entity_id: ev.id,
    });
    alerted++;
  }

  return { stale: stale.length, alerted };
}

/**
 * Checks for policies past their review_date or next_review_date.
 */
export function checkPolicyReviews(db: Database.Database): { overdue: number } {
  const overdue = db.prepare(`
    SELECT id, title, review_date, next_review_date
    FROM policies
    WHERE status IN ('active', 'draft', 'review')
    AND (
      (review_date IS NOT NULL AND review_date < datetime('now'))
      OR (next_review_date IS NOT NULL AND next_review_date < datetime('now'))
    )
  `).all() as Array<{ id: string; title: string }>;

  for (const policy of overdue) {
    createDriftAlert(db, {
      alert_type: 'review_overdue',
      severity: 'medium',
      title: `Policy review overdue: ${policy.title}`,
      message: 'This policy has passed its scheduled review date.',
      source_entity_type: 'policy',
      source_entity_id: policy.id,
    });
  }

  return { overdue: overdue.length };
}

/**
 * Checks for risk exceptions that are expiring soon or already expired.
 */
export function checkRiskExceptionExpiry(db: Database.Database): { expired: number; expiring: number } {
  const expired = db.prepare(`
    SELECT id, risk_id FROM risk_exceptions
    WHERE status = 'active' AND expiry_date < datetime('now')
  `).all() as Array<{ id: string; risk_id: string }>;

  for (const ex of expired) {
    db.prepare(`UPDATE risk_exceptions SET status = 'expired' WHERE id = ?`).run(ex.id);
    createDriftAlert(db, {
      alert_type: 'risk_threshold',
      severity: 'high',
      title: 'Risk exception expired',
      message: `Exception for risk ${ex.risk_id} has expired and needs re-evaluation.`,
      source_entity_type: 'risk_exception',
      source_entity_id: ex.id,
    });
  }

  const expiring = db.prepare(`
    SELECT id FROM risk_exceptions
    WHERE status = 'active'
    AND expiry_date BETWEEN datetime('now') AND datetime('now', '+30 days')
  `).all();

  return { expired: expired.length, expiring: expiring.length };
}

/**
 * Checks for expiring dispositions and re-activates drift alerts.
 */
export function checkDispositionExpiry(db: Database.Database): { reactivated: number } {
  const expired = db.prepare(`
    SELECT d.id, d.drift_alert_id, d.disposition_type,
           da.title AS alert_title
    FROM dispositions d
    JOIN drift_alerts da ON d.drift_alert_id = da.id
    WHERE d.approval_status = 'approved'
    AND d.expires_at < datetime('now')
  `).all() as Array<{
    id: string; drift_alert_id: string;
    disposition_type: string; alert_title: string;
  }>;

  for (const disp of expired) {
    unsuppressDriftAlert(db, disp.drift_alert_id);
    db.prepare(
      `UPDATE dispositions SET approval_status = 'expired', updated_at = datetime('now') WHERE id = ?`
    ).run(disp.id);

    createDriftAlert(db, {
      alert_type: 'disposition_expiring',
      severity: 'medium',
      title: `Disposition expired — re-evaluate: ${disp.alert_title}`,
      message: `A "${disp.disposition_type}" disposition has expired.`,
      source_entity_type: 'disposition',
      source_entity_id: disp.id,
    });
  }

  return { reactivated: expired.length };
}

/**
 * Checks for manual intel approaching corroboration deadline.
 */
export function checkManualIntelExpiry(db: Database.Database): { archived: number; warned: number } {
  // Auto-archive expired
  const expired = db.prepare(`
    SELECT id, title FROM manual_intel
    WHERE status IN ('provisional','watching')
    AND corroboration_deadline < datetime('now')
  `).all() as Array<{ id: string; title: string }>;

  for (const intel of expired) {
    db.prepare(`
      UPDATE manual_intel
      SET status = 'archived', archived_at = datetime('now'),
          archive_reason = 'expired', updated_at = datetime('now')
      WHERE id = ?
    `).run(intel.id);
  }

  // Warn on high-severity approaching deadline
  const expiringSoon = db.prepare(`
    SELECT id, title FROM manual_intel
    WHERE status IN ('provisional','watching')
    AND severity_estimate IN ('high','critical')
    AND corroboration_deadline BETWEEN datetime('now') AND datetime('now', '+7 days')
  `).all() as Array<{ id: string; title: string }>;

  for (const intel of expiringSoon) {
    createDriftAlert(db, {
      alert_type: 'manual_intel_expiring',
      severity: 'medium',
      title: `Unverified intel expiring: ${intel.title}`,
      message: 'Decide: promote, extend deadline, or let expire.',
      source_entity_type: 'manual_intel',
      source_entity_id: intel.id,
    });
  }

  return { archived: expired.length, warned: expiringSoon.length };
}

/**
 * Full posture recalculation — recalculates risk for every
 * implemented control.
 */
export function fullPostureRecalculation(db: Database.Database): { recalculated: number } {
  const ctx = createContext(SYSTEM_ACTOR);

  const controls = db.prepare(`
    SELECT DISTINCT primary_control_id FROM implementations
    WHERE status NOT IN ('not-applicable')
  `).all() as Array<{ primary_control_id: string }>;

  for (const ctrl of controls) {
    recalculateRiskForControl(db, ctx, ctrl.primary_control_id);
  }

  return { recalculated: controls.length };
}
