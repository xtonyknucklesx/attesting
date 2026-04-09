import type Database from 'better-sqlite3';
import { generateUuid } from '../../utils/uuid.js';
import { propagate } from '../propagation/dispatcher.js';
import { SYSTEM_ACTOR } from '../audit/logger.js';
import { generateShadowImpact } from './shadow-analysis.js';

export interface SubmitIntelInput {
  title: string;
  description: string;
  sourceDescription?: string;
  submittedBy?: string;
  intelType?: string;
  severityEstimate?: string;
  affectedPlatformsEst?: string[];
  affectedControlsEst?: string[];
  corroborationDeadlineDays?: number;
  corroborationSources?: string[];
}

/**
 * Submit new manual intelligence. Immediately runs shadow impact analysis.
 */
export function submitManualIntel(
  db: Database.Database,
  input: SubmitIntelInput,
): { id: string; status: string; corroboration_deadline: string; shadow_impact: any } {
  const id = generateUuid();
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + (input.corroborationDeadlineDays ?? 30));

  db.prepare(`
    INSERT INTO manual_intel (
      id, title, description, source_description, submitted_by,
      confidence_level, intel_type, severity_estimate,
      affected_platforms_est, affected_controls_est,
      corroboration_deadline, corroboration_sources, status
    ) VALUES (?, ?, ?, ?, ?, 'unverified', ?, ?, ?, ?, ?, ?, 'provisional')
  `).run(
    id, input.title, input.description,
    input.sourceDescription ?? null,
    input.submittedBy ?? null,
    input.intelType ?? 'threat',
    input.severityEstimate ?? 'medium',
    JSON.stringify(input.affectedPlatformsEst ?? []),
    JSON.stringify(input.affectedControlsEst ?? []),
    deadline.toISOString(),
    JSON.stringify(input.corroborationSources ?? []),
  );

  const shadow = generateShadowImpact(db, id);
  db.prepare(`
    UPDATE manual_intel
    SET shadow_impact_snapshot = ?, shadow_generated_at = datetime('now')
    WHERE id = ?
  `).run(JSON.stringify(shadow), id);

  return { id, status: 'provisional', corroboration_deadline: deadline.toISOString(), shadow_impact: shadow };
}

/**
 * Promote manual intel to a confirmed threat input,
 * triggering full propagation through the risk module.
 */
export function promoteManualIntel(
  db: Database.Database,
  manualIntelId: string,
  opts: { corroboratedBy?: string; cveId?: string; sourceRef?: string; ttps?: string[] } = {},
): { threat_id: string; propagation_log: any[] } {
  const intel = db.prepare('SELECT * FROM manual_intel WHERE id = ?').get(manualIntelId) as any;
  if (!intel) throw new Error(`Manual intel ${manualIntelId} not found`);
  if (intel.status !== 'provisional' && intel.status !== 'watching') {
    throw new Error(`Cannot promote intel in status: ${intel.status}`);
  }

  const threatId = generateUuid();
  db.prepare(`
    INSERT INTO threat_inputs (
      id, channel, threat_type, title, description, severity,
      cve_id, source_ref, affected_platforms, affected_products,
      ttps, is_corroborated, corroborated_at, corroborated_by
    ) VALUES (?, 'manual', ?, ?, ?, ?, ?, ?, ?, '[]', ?, 1, datetime('now'), ?)
  `).run(
    threatId,
    intel.intel_type === 'vulnerability' ? 'vulnerability' : 'advisory',
    intel.title, intel.description, intel.severity_estimate,
    opts.cveId ?? null,
    opts.sourceRef ?? intel.source_description,
    intel.affected_platforms_est,
    JSON.stringify(opts.ttps ?? []),
    opts.corroboratedBy ?? 'manual_confirmation',
  );

  db.prepare(`
    UPDATE manual_intel
    SET status = 'promoted', confidence_level = 'confirmed',
        promoted_to_threat_id = ?, promoted_at = datetime('now'),
        updated_at = datetime('now')
    WHERE id = ?
  `).run(threatId, manualIntelId);

  const log = propagate(db, 'threat_input', threatId, 'create', SYSTEM_ACTOR);
  return { threat_id: threatId, propagation_log: log };
}

/**
 * Archive manual intel that wasn't corroborated.
 */
export function archiveManualIntel(
  db: Database.Database,
  manualIntelId: string,
  reason = 'expired',
): void {
  db.prepare(`
    UPDATE manual_intel
    SET status = 'archived', archived_at = datetime('now'),
        archive_reason = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(reason, manualIntelId);
}

/**
 * Update confidence level and regenerate shadow impact.
 */
export function updateIntelConfidence(
  db: Database.Database,
  manualIntelId: string,
  newLevel: string,
): any {
  db.prepare(`
    UPDATE manual_intel
    SET confidence_level = ?,
        status = CASE WHEN ? IN ('medium','high') THEN 'watching' ELSE status END,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(newLevel, newLevel, manualIntelId);

  const shadow = generateShadowImpact(db, manualIntelId);
  db.prepare(`
    UPDATE manual_intel SET shadow_impact_snapshot = ?, shadow_generated_at = datetime('now') WHERE id = ?
  `).run(JSON.stringify(shadow), manualIntelId);

  return shadow;
}
