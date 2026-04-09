import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, seedManualIntel, seedAsset } from '../../helpers/test-db.js';
import { generateShadowImpact } from '../../../src/services/intel/shadow-analysis.js';
import type Database from 'better-sqlite3';

describe('shadow-analysis', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  it('returns a ShadowReport with all expected fields', () => {
    const intelId = seedManualIntel(db, {
      severity: 'high',
      platforms: ['aws'],
    });

    const report = generateShadowImpact(db, intelId);

    expect(report).toHaveProperty('summary');
    expect(report).toHaveProperty('assets_at_risk');
    expect(report).toHaveProperty('controls_to_review');
    expect(report).toHaveProperty('risk_score_deltas');
    expect(report).toHaveProperty('alerts_would_fire');
    expect(report).toHaveProperty('frameworks_affected');
    expect(typeof report.summary).toBe('string');
    expect(Array.isArray(report.assets_at_risk)).toBe(true);
    expect(Array.isArray(report.controls_to_review)).toBe(true);
    expect(Array.isArray(report.risk_score_deltas)).toBe(true);
    expect(typeof report.alerts_would_fire).toBe('number');
    expect(Array.isArray(report.frameworks_affected)).toBe(true);
  });

  it('returns empty arrays and minimal impact when no matching assets exist', () => {
    const intelId = seedManualIntel(db, {
      severity: 'medium',
      platforms: ['obscure-platform'],
    });

    const report = generateShadowImpact(db, intelId);

    expect(report.assets_at_risk).toHaveLength(0);
    expect(report.summary).toContain('Minimal expected impact');
  });

  it('populates assets_at_risk when a matching asset exists', () => {
    // Seed an asset on the same platform as the intel
    seedAsset(db, { platform: 'aws', name: 'Production API Server' });

    const intelId = seedManualIntel(db, {
      severity: 'high',
      platforms: ['aws'],
    });

    const report = generateShadowImpact(db, intelId);

    expect(report.assets_at_risk.length).toBeGreaterThanOrEqual(1);
    expect(report.assets_at_risk[0].name).toBe('Production API Server');
    expect(report.assets_at_risk[0].platform).toBe('aws');
  });

  it('does NOT write to the database (read-only analysis)', () => {
    seedAsset(db, { platform: 'aws' });
    const intelId = seedManualIntel(db, {
      severity: 'high',
      platforms: ['aws'],
    });

    // Count rows before
    const alertsBefore = (db.prepare('SELECT COUNT(*) as c FROM drift_alerts').get() as any).c;
    const threatsBefore = (db.prepare('SELECT COUNT(*) as c FROM threat_inputs').get() as any).c;

    generateShadowImpact(db, intelId);

    // Count rows after — should be unchanged
    const alertsAfter = (db.prepare('SELECT COUNT(*) as c FROM drift_alerts').get() as any).c;
    const threatsAfter = (db.prepare('SELECT COUNT(*) as c FROM threat_inputs').get() as any).c;

    expect(alertsAfter).toBe(alertsBefore);
    expect(threatsAfter).toBe(threatsBefore);
  });

  it('throws when manual intel ID does not exist', () => {
    expect(() => generateShadowImpact(db, 'nonexistent-id')).toThrow();
  });
});
