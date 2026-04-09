import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, seedAsset, seedThreat } from '../../helpers/test-db.js';
import { onThreatIngested } from '../../../src/services/propagation/threat-handlers.js';
import { createContext } from '../../../src/services/propagation/types.js';
import type Database from 'better-sqlite3';

describe('onThreatIngested', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  it('creates asset correlations when threat platform matches an asset', () => {
    const assetId = seedAsset(db, { platform: 'aws', name: 'Prod Server' });
    const threatId = seedThreat(db, { platform: 'aws', severity: 'high' });

    const ctx = createContext({ type: 'user' as const, id: 'test' });
    onThreatIngested(db, ctx, threatId);

    // Should have created a threat_asset_correlation row
    const correlations = db.prepare(
      'SELECT * FROM threat_asset_correlations WHERE threat_id = ? AND asset_id = ?'
    ).all(threatId, assetId) as any[];
    expect(correlations.length).toBe(1);
    expect(correlations[0].match_type).toBe('platform');

    // Log should show asset_exposed
    expect(ctx.log.some(e => e.type === 'asset_exposed')).toBe(true);
  });

  it('runs without error when no assets match the threat platform', () => {
    const threatId = seedThreat(db, { platform: 'obscure-platform', severity: 'medium' });

    const ctx = createContext({ type: 'user' as const, id: 'test' });
    // Should not crash even with no matching assets
    onThreatIngested(db, ctx, threatId);

    const correlations = db.prepare(
      'SELECT * FROM threat_asset_correlations WHERE threat_id = ?'
    ).all(threatId) as any[];
    expect(correlations.length).toBe(0);
  });

  it('does not crash when threat ID does not exist', () => {
    const ctx = createContext({ type: 'user' as const, id: 'test' });
    // Non-existent threat -- should return early without error
    onThreatIngested(db, ctx, 'nonexistent-threat-id');
    expect(ctx.log).toEqual([]);
  });

  it('creates a risk entry when assets are matched', () => {
    seedAsset(db, { platform: 'aws', name: 'Web Server' });
    const threatId = seedThreat(db, { platform: 'aws', severity: 'critical' });

    const ctx = createContext({ type: 'user' as const, id: 'test' });
    onThreatIngested(db, ctx, threatId);

    // Should have created a risk from the threat
    expect(ctx.log.some(e => e.type === 'risk_created')).toBe(true);

    // Threat should be marked as processed
    const threat = db.prepare('SELECT processed FROM threat_inputs WHERE id = ?').get(threatId) as any;
    expect(threat.processed).toBe(1);
  });
});
