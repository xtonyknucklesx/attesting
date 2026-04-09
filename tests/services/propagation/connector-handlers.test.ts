import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, seedConnector } from '../../helpers/test-db.js';
import { onConnectorStateChange } from '../../../src/services/propagation/connector-handlers.js';
import { createContext } from '../../../src/services/propagation/types.js';
import { generateUuid } from '../../../src/utils/uuid.js';
import type Database from 'better-sqlite3';

describe('onConnectorStateChange', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  it('runs without crashing when sync status is not failed', () => {
    const connectorId = seedConnector(db);

    const ctx = createContext({ type: 'user' as const, id: 'test' });
    const next = { last_sync_status: 'success', name: 'Test Connector' };

    // Non-failure state should be a no-op
    onConnectorStateChange(db, ctx, connectorId, next);
    expect(ctx.log.length).toBe(0);
  });

  it('runs without crashing on failed status with no prior failures', () => {
    const connectorId = seedConnector(db);

    const ctx = createContext({ type: 'user' as const, id: 'test' });
    const next = { last_sync_status: 'failed', name: 'Test Connector', last_sync_error: 'timeout' };

    // Fewer than 3 failures in the last hour, so no alert
    onConnectorStateChange(db, ctx, connectorId, next);
    expect(ctx.log.length).toBe(0);
  });

  it('creates drift alert after 3+ failures in the last hour', () => {
    const connectorId = seedConnector(db);

    // Seed 3 failed sync log entries within the last hour
    const insertLog = db.prepare(`
      INSERT INTO connector_sync_log (id, connector_id, started_at, status, sync_type, trigger)
      VALUES (?, ?, datetime('now'), 'failed', 'full', 'scheduled')
    `);
    for (let i = 0; i < 3; i++) {
      insertLog.run(generateUuid(), connectorId);
    }

    const ctx = createContext({ type: 'user' as const, id: 'test' });
    const next = { last_sync_status: 'failed', name: 'Test Connector', last_sync_error: 'connection refused' };

    onConnectorStateChange(db, ctx, connectorId, next);

    // Should log connector_failing
    expect(ctx.log.some(e => e.type === 'connector_failing')).toBe(true);

    // Should have created a drift alert
    const alerts = db.prepare(
      "SELECT * FROM drift_alerts WHERE alert_type = 'connector_failure' AND source_entity_id = ?"
    ).all(connectorId) as any[];
    expect(alerts.length).toBe(1);
    expect(alerts[0].severity).toBe('high');
  });
});
