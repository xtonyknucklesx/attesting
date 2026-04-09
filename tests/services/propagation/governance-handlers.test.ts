import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, seedPolicy } from '../../helpers/test-db.js';
import { onPolicyContentChange } from '../../../src/services/propagation/governance-handlers.js';
import { createContext } from '../../../src/services/propagation/types.js';
import type Database from 'better-sqlite3';

describe('onPolicyContentChange', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  it('creates drift alert when policy review date is in the past', () => {
    const policyId = seedPolicy(db, { reviewDate: '2020-01-01' });

    const ctx = createContext({ type: 'user' as const, id: 'test' });
    onPolicyContentChange(db, ctx, policyId);

    // Should log a review_overdue entry
    expect(ctx.log.some(e => e.type === 'review_overdue')).toBe(true);

    // Should have created a drift alert in the database
    const alerts = db.prepare(
      "SELECT * FROM drift_alerts WHERE alert_type = 'review_overdue' AND source_entity_id = ?"
    ).all(policyId) as any[];
    expect(alerts.length).toBe(1);
    expect(alerts[0].severity).toBe('medium');
  });

  it('does not create alert when policy review date is in the future', () => {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    const policyId = seedPolicy(db, { reviewDate: futureDate.toISOString().split('T')[0] });

    const ctx = createContext({ type: 'user' as const, id: 'test' });
    onPolicyContentChange(db, ctx, policyId);

    // Should NOT log a review_overdue entry
    expect(ctx.log.some(e => e.type === 'review_overdue')).toBe(false);

    // No overdue alert should exist
    const alerts = db.prepare(
      "SELECT * FROM drift_alerts WHERE alert_type = 'review_overdue' AND source_entity_id = ?"
    ).all(policyId) as any[];
    expect(alerts.length).toBe(0);
  });

  it('does not crash when policy has no review date', () => {
    const policyId = seedPolicy(db);

    const ctx = createContext({ type: 'user' as const, id: 'test' });
    onPolicyContentChange(db, ctx, policyId);

    // No overdue alert since review date is null
    expect(ctx.log.some(e => e.type === 'review_overdue')).toBe(false);
  });

  it('does not crash when policy ID does not exist', () => {
    const ctx = createContext({ type: 'user' as const, id: 'test' });
    onPolicyContentChange(db, ctx, 'nonexistent-policy-id');
    expect(ctx.log).toEqual([]);
  });
});
