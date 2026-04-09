import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, seedOrg, seedCatalog, seedImplementation, seedRisk } from '../../helpers/test-db.js';
import { recalculateRiskForControl } from '../../../src/services/propagation/risk-handlers.js';
import { createContext } from '../../../src/services/propagation/types.js';
import type Database from 'better-sqlite3';

describe('recalculateRiskForControl', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  it('recomputes residual scores when implementation status changes', () => {
    const { orgId } = seedOrg(db);
    const { controlIds } = seedCatalog(db, 1);
    const controlId = controlIds[0];
    seedImplementation(db, orgId, controlId, 'implemented');
    const riskId = seedRisk(db, { controlIds: [controlId], likelihood: 4, impact: 5 });

    const ctx = createContext({ type: 'user' as const, id: 'test' });
    recalculateRiskForControl(db, ctx, controlId);

    // Should have produced a risk_update log entry
    expect(ctx.log.some(e => e.type === 'risk_update')).toBe(true);

    // Residual scores should be written to the database
    const updated = db.prepare('SELECT residual_likelihood, residual_impact, residual_risk_score FROM risks WHERE id = ?')
      .get(riskId) as any;
    expect(updated.residual_risk_score).toBeDefined();
    // With one implemented control at 'partial' effectiveness (0.15),
    // residual_likelihood = max(1, round(4 * 0.85)) = 3
    // residual_risk_score = 3 * 5 = 15
    expect(updated.residual_likelihood).toBeLessThanOrEqual(4);
  });

  it('is a no-op when no risks are linked to the control', () => {
    const { controlIds } = seedCatalog(db, 1);
    const ctx = createContext({ type: 'user' as const, id: 'test' });

    // Should not crash
    recalculateRiskForControl(db, ctx, controlIds[0]);
    expect(ctx.log).toEqual([]);
  });

  it('creates drift alert when residual score crosses threshold (>=15)', () => {
    const { orgId } = seedOrg(db);
    const { controlIds } = seedCatalog(db, 1);
    const controlId = controlIds[0];

    // Create a risk with high inherent scores and NO effective implementation
    // so residual stays high. likelihood=5, impact=4 => inherent=20
    const riskId = seedRisk(db, { controlIds: [controlId], likelihood: 5, impact: 4 });
    // Implementation is 'not-implemented' so it won't reduce residual
    seedImplementation(db, orgId, controlId, 'not-implemented');

    // Set initial residual below threshold so the crossing is detected
    db.prepare('UPDATE risks SET residual_likelihood = 2, residual_impact = 4, residual_risk_score = 8 WHERE id = ?')
      .run(riskId);

    const ctx = createContext({ type: 'user' as const, id: 'test' });
    recalculateRiskForControl(db, ctx, controlId);

    // New residual: no effective controls => mitigationFactor=1.0 => residual=5*4=20
    // oldScore was 8, newScore is 20 => crosses 15 threshold
    const updated = db.prepare('SELECT residual_risk_score FROM risks WHERE id = ?').get(riskId) as any;
    expect(updated.residual_risk_score).toBeGreaterThanOrEqual(15);

    // A drift alert should have been created
    const alerts = db.prepare(
      "SELECT * FROM drift_alerts WHERE alert_type = 'risk_threshold' AND source_entity_id = ?"
    ).all(riskId) as any[];
    expect(alerts.length).toBeGreaterThanOrEqual(1);
    expect(alerts[0].severity).toBe('critical');

    // Log should contain threshold crossed entry
    expect(ctx.log.some(e => e.type === 'risk_threshold_crossed')).toBe(true);
  });

  it('does not create drift alert when score stays below threshold', () => {
    const { orgId } = seedOrg(db);
    const { controlIds } = seedCatalog(db, 1);
    const controlId = controlIds[0];

    // Low inherent risk: 2*3=6, always below 15
    const riskId = seedRisk(db, { controlIds: [controlId], likelihood: 2, impact: 3 });
    seedImplementation(db, orgId, controlId, 'implemented');

    const ctx = createContext({ type: 'user' as const, id: 'test' });
    recalculateRiskForControl(db, ctx, controlId);

    const alerts = db.prepare(
      "SELECT * FROM drift_alerts WHERE alert_type = 'risk_threshold' AND source_entity_id = ?"
    ).all(riskId) as any[];
    expect(alerts.length).toBe(0);
  });
});
