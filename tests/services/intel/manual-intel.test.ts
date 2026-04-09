import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, seedManualIntel } from '../../helpers/test-db.js';
import { submitManualIntel, promoteManualIntel, archiveManualIntel } from '../../../src/services/intel/manual-intel.js';
import type Database from 'better-sqlite3';

describe('manual-intel', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  describe('submitManualIntel', () => {
    it('creates row with status provisional and returns shadow impact', () => {
      const result = submitManualIntel(db, {
        title: 'New zero-day in cloud provider',
        description: 'Reports of an unpatched RCE in cloud infrastructure.',
        severityEstimate: 'high',
        intelType: 'threat',
        affectedPlatformsEst: ['aws'],
        affectedControlsEst: [],
        corroborationDeadlineDays: 14,
      });

      expect(result.id).toBeDefined();
      expect(result.status).toBe('provisional');
      expect(result.corroboration_deadline).toBeDefined();
      expect(result.shadow_impact).toBeDefined();

      // Verify the row exists in the database
      const row = db.prepare('SELECT * FROM manual_intel WHERE id = ?').get(result.id) as any;
      expect(row).toBeDefined();
      expect(row.status).toBe('provisional');
      expect(row.title).toBe('New zero-day in cloud provider');
      expect(row.severity_estimate).toBe('high');
    });

    it('uses default corroboration deadline of 30 days when not specified', () => {
      const result = submitManualIntel(db, {
        title: 'Some intel',
        description: 'Desc',
      });

      const deadline = new Date(result.corroboration_deadline);
      const now = new Date();
      const diffDays = Math.round((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      // Should be approximately 30 days from now
      expect(diffDays).toBeGreaterThanOrEqual(29);
      expect(diffDays).toBeLessThanOrEqual(31);
    });
  });

  describe('promoteManualIntel', () => {
    it('changes status to promoted and creates threat_input row', () => {
      const intelId = seedManualIntel(db, {
        status: 'provisional',
        severity: 'high',
        platforms: ['aws'],
      });

      const result = promoteManualIntel(db, intelId, {
        corroboratedBy: 'analyst-1',
        cveId: 'CVE-2024-9999',
      });

      expect(result.threat_id).toBeDefined();
      expect(result.propagation_log).toBeDefined();
      expect(Array.isArray(result.propagation_log)).toBe(true);

      // Verify manual_intel status changed
      const intel = db.prepare('SELECT * FROM manual_intel WHERE id = ?').get(intelId) as any;
      expect(intel.status).toBe('promoted');
      expect(intel.promoted_to_threat_id).toBe(result.threat_id);

      // Verify threat_input was created
      const threat = db.prepare('SELECT * FROM threat_inputs WHERE id = ?').get(result.threat_id) as any;
      expect(threat).toBeDefined();
      expect(threat.channel).toBe('manual');
      expect(threat.cve_id).toBe('CVE-2024-9999');
    });

    it('throws error when trying to promote already promoted intel', () => {
      const intelId = seedManualIntel(db, { status: 'provisional' });
      promoteManualIntel(db, intelId);

      expect(() => promoteManualIntel(db, intelId)).toThrowError(
        'Cannot promote intel in status: promoted',
      );
    });

    it('allows promoting intel in watching status', () => {
      const intelId = seedManualIntel(db, { status: 'watching' });

      const result = promoteManualIntel(db, intelId);
      expect(result.threat_id).toBeDefined();

      const intel = db.prepare('SELECT * FROM manual_intel WHERE id = ?').get(intelId) as any;
      expect(intel.status).toBe('promoted');
    });
  });

  describe('archiveManualIntel', () => {
    it('sets status to archived with reason', () => {
      const intelId = seedManualIntel(db, { status: 'provisional' });

      archiveManualIntel(db, intelId, 'no_corroboration');

      const intel = db.prepare('SELECT * FROM manual_intel WHERE id = ?').get(intelId) as any;
      expect(intel.status).toBe('archived');
      expect(intel.archive_reason).toBe('no_corroboration');
      expect(intel.archived_at).toBeDefined();
    });

    it('uses default reason of expired', () => {
      const intelId = seedManualIntel(db, { status: 'provisional' });

      archiveManualIntel(db, intelId);

      const intel = db.prepare('SELECT * FROM manual_intel WHERE id = ?').get(intelId) as any;
      expect(intel.archive_reason).toBe('expired');
    });
  });
});
