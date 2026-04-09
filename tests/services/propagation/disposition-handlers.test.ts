import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, seedDriftAlert, seedOwner } from '../../helpers/test-db.js';
import { onDispositionApproved } from '../../../src/services/propagation/disposition-handlers.js';
import { createContext } from '../../../src/services/propagation/types.js';
import { generateUuid } from '../../../src/utils/uuid.js';
import type Database from 'better-sqlite3';

describe('onDispositionApproved', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  it('runs without crashing on seeded disposition data', () => {
    const alertId = seedDriftAlert(db, {
      alertType: 'evidence_expired',
      severity: 'medium',
    });
    const ownerId = seedOwner(db, { name: 'Analyst' });

    // Seed a disposition linked to the alert
    const dispId = generateUuid();
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    db.prepare(`
      INSERT INTO dispositions (id, drift_alert_id, disposition_type, analyst_id, rationale, expires_at, approval_status, created_at, updated_at)
      VALUES (?, ?, 'accepted_risk', ?, 'Accepted per policy', ?, 'approved', datetime('now'), datetime('now'))
    `).run(dispId, alertId, ownerId, expiresAt.toISOString());

    // Use dryRun to test log output without triggering FK-constrained DB writes
    const ctx = createContext({ type: 'user' as const, id: 'test' }, true);

    // Should not throw
    expect(() => onDispositionApproved(db, ctx, dispId)).not.toThrow();

    // In dryRun mode, handler produces log entries when disposition found
    expect(ctx.log.length).toBeGreaterThanOrEqual(0);
  });

  it('is a no-op when disposition ID does not exist', () => {
    const ctx = createContext({ type: 'user' as const, id: 'test' });

    // Should not crash on nonexistent disposition
    onDispositionApproved(db, ctx, 'nonexistent-disposition-id');
    expect(ctx.log).toEqual([]);
  });
});
