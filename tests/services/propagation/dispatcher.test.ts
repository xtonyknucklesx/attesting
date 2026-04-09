import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, seedOrg, seedCatalog, seedImplementation, seedRisk, seedPolicy, seedAsset, seedThreat } from '../../helpers/test-db.js';
import { propagate } from '../../../src/services/propagation/dispatcher.js';
import type Database from 'better-sqlite3';
import type { Actor } from '../../../src/services/audit/logger.js';

const actor: Actor = { type: 'user' as const, id: 'test' };

describe('propagate', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  it('routes risk entityType to risk handler (no-op, returns empty log)', () => {
    const log = propagate(db, 'risk', 'nonexistent-id', 'update', actor);
    // risk handler is a no-op in current implementation, but audit entry is still written
    expect(Array.isArray(log)).toBe(true);
  });

  it('routes policy entityType to policy handler', () => {
    const policyId = seedPolicy(db, { reviewDate: '2020-01-01' });
    const prev = { content_hash: 'old-hash', status: 'active' };
    const next = { content_hash: 'new-hash', status: 'active' };
    const log = propagate(db, 'policy', policyId, 'update', actor, prev, next);
    expect(Array.isArray(log)).toBe(true);
    // Policy content hash changed, so handler fires. Review overdue -> log entry.
    expect(log.some(e => e.type === 'review_overdue')).toBe(true);
  });

  it('routes threat_input entityType to threat handler', () => {
    const threatId = seedThreat(db, { platform: 'aws', severity: 'high' });
    const log = propagate(db, 'threat_input', threatId, 'create', actor);
    expect(Array.isArray(log)).toBe(true);
  });

  it('routes implementation entityType and triggers risk recalc on status change', () => {
    const { orgId } = seedOrg(db);
    const { controlIds } = seedCatalog(db, 1);
    const implId = seedImplementation(db, orgId, controlIds[0], 'implemented');
    seedRisk(db, { controlIds, likelihood: 3, impact: 4 });

    const prev = { status: 'not-implemented' };
    const next = { status: 'implemented' };
    const log = propagate(db, 'implementation', implId, 'update', actor, prev, next);
    expect(Array.isArray(log)).toBe(true);
    // Risk recalculation should have produced a risk_update entry
    expect(log.some(e => e.type === 'risk_update')).toBe(true);
  });

  it('returns empty log for unknown entityType (no crash)', () => {
    const log = propagate(db, 'unknown_thing' as any, 'some-id', 'update', actor);
    expect(log).toEqual([]);
  });

  it('writes audit entry after handler executes', () => {
    const policyId = seedPolicy(db);
    propagate(db, 'policy', policyId, 'update', actor, { content_hash: 'a' }, { content_hash: 'a' });

    const auditRows = db.prepare(
      'SELECT * FROM audit_log WHERE entity_type = ? AND entity_id = ?'
    ).all('policy', policyId) as any[];
    expect(auditRows.length).toBeGreaterThanOrEqual(1);
    expect(auditRows[0].actor_type).toBe('user');
    expect(auditRows[0].actor_id).toBe('test');
  });

  it('does not write audit entry for unknown entityType', () => {
    propagate(db, 'unknown_thing' as any, 'some-id', 'update', actor);
    const auditRows = db.prepare(
      'SELECT * FROM audit_log WHERE entity_id = ?'
    ).all('some-id') as any[];
    expect(auditRows.length).toBe(0);
  });
});
