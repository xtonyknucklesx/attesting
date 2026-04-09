import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTestDb, seedOrg, seedCatalog, seedImplementation,
  seedPolicy, seedAsset,
} from '../../helpers/test-db.js';
import {
  checkEvidenceStaleness,
  checkPolicyReviews,
  checkRiskExceptionExpiry,
  checkDispositionExpiry,
  checkManualIntelExpiry,
  fullPostureRecalculation,
} from '../../../src/services/drift/checks.js';
import type Database from 'better-sqlite3';

describe('drift checks', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  describe('checkEvidenceStaleness', () => {
    it('returns stale: 0, alerted: 0 when no stale evidence exists', () => {
      const result = checkEvidenceStaleness(db);
      expect(result.stale).toBe(0);
      expect(result.alerted).toBe(0);
    });
  });

  describe('checkPolicyReviews', () => {
    it('detects overdue policy with a past review date', () => {
      seedPolicy(db, { reviewDate: '2020-01-01', status: 'active' });

      const result = checkPolicyReviews(db);
      expect(result.overdue).toBe(1);
    });

    it('returns overdue: 0 when policy review date is in the future', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      seedPolicy(db, { reviewDate: futureDate.toISOString(), status: 'active' });

      const result = checkPolicyReviews(db);
      expect(result.overdue).toBe(0);
    });
  });

  describe('checkRiskExceptionExpiry', () => {
    it('returns expired: 0, expiring: 0 when no exceptions exist', () => {
      const result = checkRiskExceptionExpiry(db);
      expect(result.expired).toBe(0);
      expect(result.expiring).toBe(0);
    });
  });

  describe('checkDispositionExpiry', () => {
    it('returns reactivated: 0 when no dispositions exist', () => {
      const result = checkDispositionExpiry(db);
      expect(result.reactivated).toBe(0);
    });
  });

  describe('checkManualIntelExpiry', () => {
    it('returns archived: 0, warned: 0 when no expired intel exists', () => {
      const result = checkManualIntelExpiry(db);
      expect(result.archived).toBe(0);
      expect(result.warned).toBe(0);
    });
  });

  describe('fullPostureRecalculation', () => {
    it('recalculates risk for seeded implementations', () => {
      const { orgId } = seedOrg(db);
      const { controlIds } = seedCatalog(db, 2);
      seedImplementation(db, orgId, controlIds[0], 'implemented');
      seedImplementation(db, orgId, controlIds[1], 'partial');

      const result = fullPostureRecalculation(db);

      // Two distinct primary_control_ids should be recalculated
      expect(result.recalculated).toBe(2);
    });

    it('returns recalculated: 0 when no implementations exist', () => {
      const result = fullPostureRecalculation(db);
      expect(result.recalculated).toBe(0);
    });
  });
});
