import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../../helpers/test-db.js';
import { parseCycloneDxComponents } from '../../../src/services/connectors/adapters/sbom-cyclonedx.js';
import { upsertComponentAsAsset } from '../../../src/services/import/sbom-common.js';
import type Database from 'better-sqlite3';

const SAMPLE_BOM = {
  bomFormat: 'CycloneDX',
  specVersion: '1.5',
  metadata: { component: { name: 'my-app', version: '1.0.0' } },
  components: [
    { type: 'library', name: 'express', version: '4.18.2', purl: 'pkg:npm/express@4.18.2' },
    { type: 'library', name: 'lodash', version: '4.17.21', purl: 'pkg:npm/lodash@4.17.21', supplier: { name: 'Lodash Team' } },
    { type: 'framework', name: 'react', version: '18.2.0' },
  ],
};

describe('CycloneDX SBOM', () => {
  describe('parseCycloneDxComponents', () => {
    it('extracts components from CycloneDX JSON', () => {
      const components = parseCycloneDxComponents(JSON.stringify(SAMPLE_BOM));
      expect(components).toHaveLength(3);
      expect(components[0].name).toBe('express');
      expect(components[0].version).toBe('4.18.2');
      expect(components[0].purl).toBe('pkg:npm/express@4.18.2');
      expect(components[1].supplier).toBe('Lodash Team');
      expect(components[2].type).toBe('framework');
    });

    it('returns empty array for BOM with no components', () => {
      const bom = { bomFormat: 'CycloneDX', specVersion: '1.5' };
      expect(parseCycloneDxComponents(JSON.stringify(bom))).toEqual([]);
    });
  });

  describe('upsertComponentAsAsset', () => {
    let db: Database.Database;

    beforeEach(() => {
      db = createTestDb();
    });

    it('creates asset from component', () => {
      const id = upsertComponentAsAsset(db, {
        name: 'express',
        version: '4.18.2',
        purl: 'pkg:npm/express@4.18.2',
        type: 'library',
      }, 'my-app');

      const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(id) as any;
      expect(asset.name).toBe('express@4.18.2');
      expect(asset.platform).toBe('software/library');
      expect(asset.external_source).toBe('sbom');
      expect(JSON.parse(asset.metadata).parent).toBe('my-app');
    });

    it('deduplicates by external_id', () => {
      const id1 = upsertComponentAsAsset(db, { name: 'lodash', version: '4.17.21', purl: 'pkg:npm/lodash@4.17.21' });
      const id2 = upsertComponentAsAsset(db, { name: 'lodash', version: '4.17.21', purl: 'pkg:npm/lodash@4.17.21' });
      expect(id2).toBe(id1);
    });
  });
});
