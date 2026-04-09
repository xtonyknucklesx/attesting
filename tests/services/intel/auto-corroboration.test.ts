import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, seedThreat, seedManualIntel } from '../../helpers/test-db.js';
import { checkAutoCorroboration } from '../../../src/services/intel/auto-corroboration.js';
import type Database from 'better-sqlite3';

describe('auto-corroboration', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  it('returns CorroborationMatch array', () => {
    const threatId = seedThreat(db, { platform: 'aws', cveId: 'CVE-2024-1234' });
    seedManualIntel(db, { status: 'provisional', platforms: ['aws'] });

    const matches = checkAutoCorroboration(db, threatId);

    expect(Array.isArray(matches)).toBe(true);
  });

  it('matches on CVE when threat cve_id appears in intel description', () => {
    // Seed manual intel with CVE in description
    const intelId = seedManualIntel(db, {
      status: 'provisional',
      platforms: [],
    });
    // Update description to include the CVE
    db.prepare('UPDATE manual_intel SET description = ? WHERE id = ?')
      .run('Possible exploitation of CVE-2024-1234 in the wild', intelId);

    const threatId = seedThreat(db, { cveId: 'CVE-2024-1234' });

    const matches = checkAutoCorroboration(db, threatId);

    expect(matches.length).toBeGreaterThanOrEqual(1);
    const match = matches.find(m => m.manual_intel_id === intelId);
    expect(match).toBeDefined();
    expect(match!.match_reasons).toContain('cve_match');
  });

  it('matches on platform overlap', () => {
    seedManualIntel(db, {
      status: 'provisional',
      platforms: ['aws'],
      title: 'AWS issue',
    });

    const threatId = seedThreat(db, { platform: 'aws' });

    const matches = checkAutoCorroboration(db, threatId);

    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(matches[0].match_reasons).toContain('platform_overlap');
  });

  it('returns empty array when no platforms or CVEs overlap', () => {
    seedManualIntel(db, {
      status: 'provisional',
      platforms: ['azure'],
      title: 'Azure specific issue',
    });

    const threatId = seedThreat(db, { platform: 'gcp', title: 'GCP vulnerability' });

    const matches = checkAutoCorroboration(db, threatId);

    expect(matches).toHaveLength(0);
  });

  it('skips intel that is not in provisional or watching status', () => {
    // Seed promoted intel — should be skipped
    seedManualIntel(db, {
      status: 'promoted',
      platforms: ['aws'],
    });

    // Seed archived intel — should also be skipped
    seedManualIntel(db, {
      status: 'archived',
      platforms: ['aws'],
    });

    const threatId = seedThreat(db, { platform: 'aws' });

    const matches = checkAutoCorroboration(db, threatId);

    expect(matches).toHaveLength(0);
  });

  it('returns empty array for nonexistent threat', () => {
    const matches = checkAutoCorroboration(db, 'nonexistent-id');
    expect(matches).toHaveLength(0);
  });
});
