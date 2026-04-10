import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, seedConnector } from '../../helpers/test-db.js';
import { cvssToSeverity } from '../../../src/services/connectors/adapters/nvd.js';
import type Database from 'better-sqlite3';

describe('NVD Adapter', () => {
  describe('cvssToSeverity', () => {
    it('maps 9.0+ to critical', () => {
      expect(cvssToSeverity(9.8)).toBe('critical');
      expect(cvssToSeverity(10.0)).toBe('critical');
      expect(cvssToSeverity(9.0)).toBe('critical');
    });

    it('maps 7.0-8.9 to high', () => {
      expect(cvssToSeverity(7.0)).toBe('high');
      expect(cvssToSeverity(8.9)).toBe('high');
    });

    it('maps 4.0-6.9 to medium', () => {
      expect(cvssToSeverity(4.0)).toBe('medium');
      expect(cvssToSeverity(6.9)).toBe('medium');
    });

    it('maps 0-3.9 to low', () => {
      expect(cvssToSeverity(0)).toBe('low');
      expect(cvssToSeverity(3.9)).toBe('low');
    });

    it('maps null to medium', () => {
      expect(cvssToSeverity(null)).toBe('medium');
    });
  });

  describe('NVDAdapter transform', () => {
    let db: Database.Database;

    beforeEach(() => {
      db = createTestDb();
    });

    it('can be instantiated from registry', async () => {
      const connId = seedConnector(db, { adapterClass: 'NVDAdapter' });
      const { AdapterRegistry } = await import('../../../src/services/connectors/registry.js');
      const registry = new AdapterRegistry();
      const connector = db.prepare('SELECT * FROM connectors WHERE id = ?').get(connId) as any;
      const adapter = registry.create(db, connector);
      expect(adapter).toBeDefined();
    });

    it('transforms a CVE record correctly', async () => {
      const connId = seedConnector(db, { adapterClass: 'NVDAdapter' });
      const { NVDAdapter } = await import('../../../src/services/connectors/adapters/nvd.js');
      const adapter = new NVDAdapter(db, connId, {});

      const cve = {
        id: 'CVE-2024-1234',
        descriptions: [{ lang: 'en', value: 'A test vulnerability in test software' }],
        metrics: {
          cvssMetricV31: [{
            cvssData: { baseScore: 9.1 },
          }],
        },
        configurations: [{
          nodes: [{
            cpeMatch: [{ criteria: 'cpe:2.3:a:testvendor:testproduct:1.0:*:*:*:*:*:*:*' }],
          }],
        }],
      };

      const result = adapter.transform(cve);
      expect(result._table).toBe('threat_inputs');
      expect(result.external_id).toBe('CVE-2024-1234');
      expect(result.cve_id).toBe('CVE-2024-1234');
      expect(result.channel).toBe('nvd');
      expect(result.severity).toBe('critical');
      expect(result.cvss_score).toBe(9.1);
      expect(result.title).toContain('CVE-2024-1234');
      expect(JSON.parse(result.affected_platforms)).toContain('testvendor');
      expect(JSON.parse(result.affected_products)).toContain('testproduct');
    });

    it('handles missing CVSS data gracefully', async () => {
      const connId = seedConnector(db, { adapterClass: 'NVDAdapter' });
      const { NVDAdapter } = await import('../../../src/services/connectors/adapters/nvd.js');
      const adapter = new NVDAdapter(db, connId, {});

      const cve = {
        id: 'CVE-2024-0000',
        descriptions: [{ lang: 'en', value: 'No CVSS data' }],
        metrics: {},
      };

      const result = adapter.transform(cve);
      expect(result.severity).toBe('medium');
      expect(result.cvss_score).toBeNull();
    });
  });
});
