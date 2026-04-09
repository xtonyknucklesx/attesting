import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, seedDriftAlert, seedOwner } from '../../helpers/test-db.js';
import {
  createDriftAlert,
  resolveDriftAlert,
  suppressDriftAlert,
  unsuppressDriftAlert,
} from '../../../src/services/drift/alert-writer.js';
import { generateUuid } from '../../../src/utils/uuid.js';
import type Database from 'better-sqlite3';

describe('alert-writer', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  describe('createDriftAlert', () => {
    it('creates a new drift alert row and returns its ID', () => {
      const sourceId = generateUuid();
      const alertId = createDriftAlert(db, {
        alert_type: 'evidence_expired',
        severity: 'medium',
        title: 'Evidence stale',
        message: 'Evidence is older than 365 days.',
        source_entity_type: 'evidence',
        source_entity_id: sourceId,
      });

      expect(alertId).toBeDefined();
      expect(typeof alertId).toBe('string');

      const row = db.prepare('SELECT * FROM drift_alerts WHERE id = ?').get(alertId) as any;
      expect(row).toBeDefined();
      expect(row.alert_type).toBe('evidence_expired');
      expect(row.severity).toBe('medium');
      expect(row.title).toBe('Evidence stale');
    });

    it('deduplicates alerts with the same type and source, returning existing ID', () => {
      const sourceId = generateUuid();
      const input = {
        alert_type: 'evidence_expired' as const,
        severity: 'medium' as const,
        title: 'Evidence stale',
        message: 'Stale evidence.',
        source_entity_type: 'evidence',
        source_entity_id: sourceId,
      };

      const firstId = createDriftAlert(db, input);
      const secondId = createDriftAlert(db, input);

      expect(secondId).toBe(firstId);

      // Verify only one row exists for this source
      const count = (db.prepare(
        'SELECT COUNT(*) as c FROM drift_alerts WHERE source_entity_id = ?'
      ).get(sourceId) as any).c;
      expect(count).toBe(1);
    });
  });

  describe('resolveDriftAlert', () => {
    it('sets resolved_at on the alert', () => {
      const alertId = seedDriftAlert(db);

      resolveDriftAlert(db, alertId, 'test-user');

      const row = db.prepare('SELECT * FROM drift_alerts WHERE id = ?').get(alertId) as any;
      expect(row.resolved_at).toBeDefined();
      expect(row.resolved_by).toBe('test-user');
    });
  });

  describe('suppressDriftAlert', () => {
    it('sets suppressed_until and disposition_id', () => {
      const ownerId = seedOwner(db);
      const alertId = seedDriftAlert(db);
      const dispositionId = generateUuid();
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 90);

      suppressDriftAlert(db, alertId, dispositionId, futureDate.toISOString(), ownerId);

      const row = db.prepare('SELECT * FROM drift_alerts WHERE id = ?').get(alertId) as any;
      expect(row.suppressed_until).toBeDefined();
      expect(row.disposition_id).toBe(dispositionId);
      expect(row.acknowledged_by).toBe(ownerId);
    });
  });

  describe('unsuppressDriftAlert', () => {
    it('clears suppressed_until, resolved_at, and disposition_id', () => {
      const ownerId = seedOwner(db);
      const alertId = seedDriftAlert(db);
      const dispositionId = generateUuid();

      // First suppress it
      suppressDriftAlert(db, alertId, dispositionId, '2099-01-01T00:00:00Z', ownerId);
      // Then unsuppress
      unsuppressDriftAlert(db, alertId);

      const row = db.prepare('SELECT * FROM drift_alerts WHERE id = ?').get(alertId) as any;
      expect(row.suppressed_until).toBeNull();
      expect(row.resolved_at).toBeNull();
      expect(row.disposition_id).toBeNull();
    });
  });
});
