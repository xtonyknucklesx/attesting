import type Database from 'better-sqlite3';
import type { PropagationContext } from './types.js';
import { logEntry } from './types.js';
import { createDriftAlert } from '../drift/alert-writer.js';

/**
 * Recalculates residual risk scores for all risks mitigated by
 * a given control. Called when an implementation status changes
 * or evidence expires.
 */
export function recalculateRiskForControl(
  db: Database.Database,
  ctx: PropagationContext,
  controlId: string, // controls.id (internal UUID)
): void {
  // Find risks linked to this control via risk_controls
  const risks = db.prepare(`
    SELECT r.id, r.risk_id, r.title, r.likelihood, r.impact,
           r.residual_likelihood, r.residual_impact
    FROM risks r
    JOIN risk_controls rc ON rc.risk_id = r.id
    WHERE rc.control_id = ?
    AND r.status NOT IN ('closed')
  `).all(controlId) as Array<{
    id: string; risk_id: string; title: string;
    likelihood: number; impact: number;
    residual_likelihood: number | null; residual_impact: number | null;
  }>;

  for (const risk of risks) {
    // Get all mitigating controls for this risk
    const controls = db.prepare(`
      SELECT rc.effectiveness,
             i.status AS impl_status
      FROM risk_controls rc
      LEFT JOIN implementations i ON i.primary_control_id = rc.control_id
      WHERE rc.risk_id = ?
    `).all(risk.id) as Array<{
      effectiveness: string; impl_status: string | null;
    }>;

    const effectiveControls = controls.filter(c =>
      c.impl_status === 'implemented' || c.impl_status === 'partially-implemented'
    );

    // Calculate mitigation factor
    const effWeights: Record<string, number> = {
      full: 0.3, partial: 0.15, minimal: 0.05, unknown: 0.1,
    };
    let mitigationFactor = 1.0;
    for (const ctrl of effectiveControls) {
      mitigationFactor *= (1 - (effWeights[ctrl.effectiveness] ?? 0.1));
    }

    const newResidualLikelihood = Math.max(1, Math.round(risk.likelihood * mitigationFactor));
    const newResidualImpact = risk.impact;
    const newScore = newResidualLikelihood * newResidualImpact;
    const oldScore = (risk.residual_likelihood ?? risk.likelihood)
                   * (risk.residual_impact ?? risk.impact);

    if (!ctx.dryRun) {
      db.prepare(`
        UPDATE risks
        SET residual_likelihood = ?,
            residual_impact = ?,
            residual_risk_score = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `).run(newResidualLikelihood, newResidualImpact, newScore, risk.id);
    }

    logEntry(ctx, 'risk_update', {
      risk_id: risk.id,
      risk_ref: risk.risk_id,
      risk_title: risk.title,
      previous_residual: oldScore,
      new_residual: newScore,
      effective_controls: effectiveControls.length,
      total_controls: controls.length,
    });

    // Fire alert if score crossed critical threshold
    if (newScore >= 15 && oldScore < 15) {
      if (!ctx.dryRun) {
        createDriftAlert(db, {
          alert_type: 'risk_threshold',
          severity: 'critical',
          title: `Risk crossed critical threshold: ${risk.title}`,
          message: `Residual risk score is now ${newScore} (was ${oldScore})`,
          source_entity_type: 'risk',
          source_entity_id: risk.id,
        });
      }
      logEntry(ctx, 'risk_threshold_crossed', { risk_id: risk.id, score: newScore });
    }
  }
}

/**
 * Creates a risk entry from a processed threat input.
 * Returns the new risk's internal ID.
 */
export function createRiskFromThreat(
  db: Database.Database,
  ctx: PropagationContext,
  data: {
    title: string;
    description?: string;
    likelihood: number;
    impact: number;
    threatId: string;
    owner?: string;
  },
): string | null {
  if (ctx.dryRun) {
    logEntry(ctx, 'risk_would_create', data);
    return null;
  }

  const { generateUuid } = require('../../utils/uuid.js');
  const count = (db.prepare('SELECT COUNT(*) AS c FROM risks').get() as { c: number }).c;
  const riskRef = `RISK-${String(count + 1).padStart(3, '0')}`;
  const id = generateUuid();
  const score = data.likelihood * data.impact;

  db.prepare(`
    INSERT INTO risks (id, risk_id, title, description, category, source,
                       likelihood, impact, inherent_risk_score,
                       treatment, owner, status, source_type, source_id,
                       created_at, updated_at)
    VALUES (?, ?, ?, ?, 'security', 'threat_intel', ?, ?, ?, 'mitigate', ?,
            'open', 'threat_input', ?, datetime('now'), datetime('now'))
  `).run(id, riskRef, data.title, data.description ?? null,
         data.likelihood, data.impact, score,
         data.owner ?? 'Unassigned', data.threatId);

  logEntry(ctx, 'risk_created', { risk_id: id, risk_ref: riskRef, score });
  return id;
}
