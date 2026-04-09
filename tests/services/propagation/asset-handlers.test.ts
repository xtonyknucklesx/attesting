import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, seedAsset } from '../../helpers/test-db.js';
import { onAssetChange } from '../../../src/services/propagation/asset-handlers.js';
import { createContext } from '../../../src/services/propagation/types.js';
import type Database from 'better-sqlite3';

describe('onAssetChange', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  it('runs without crashing on seeded asset data', () => {
    const assetId = seedAsset(db, { platform: 'aws', name: 'Prod DB' });

    const ctx = createContext({ type: 'user' as const, id: 'test' });
    const prev = { platform: 'aws', status: 'active', name: 'Prod DB' };
    const next = { platform: 'aws', status: 'active', name: 'Prod DB' };

    // No changes, should be a no-op
    onAssetChange(db, ctx, assetId, prev, next);
    expect(ctx.log.length).toBe(0);
  });

  it('logs classification change when data_classification changes', () => {
    const assetId = seedAsset(db, { platform: 'aws', name: 'Data Store' });

    const ctx = createContext({ type: 'user' as const, id: 'test' });
    const prev = { data_classification: 'internal', platform: 'aws' };
    const next = { data_classification: 'confidential', platform: 'aws', name: 'Data Store' };

    onAssetChange(db, ctx, assetId, prev, next);

    expect(ctx.log.some(e => e.type === 'classification_change')).toBe(true);

    // Should create a drift alert
    const alerts = db.prepare(
      "SELECT * FROM drift_alerts WHERE alert_type = 'asset_drift' AND source_entity_id = ?"
    ).all(assetId) as any[];
    expect(alerts.length).toBe(1);
  });

  it('logs decommission when status changes to decommissioned', () => {
    const assetId = seedAsset(db, { platform: 'aws', name: 'Old Server' });

    const ctx = createContext({ type: 'user' as const, id: 'test' });
    const prev = { status: 'active', platform: 'aws' };
    const next = { status: 'decommissioned', platform: 'aws', name: 'Old Server' };

    onAssetChange(db, ctx, assetId, prev, next);

    expect(ctx.log.some(e => e.type === 'asset_decommissioned')).toBe(true);
  });
});
