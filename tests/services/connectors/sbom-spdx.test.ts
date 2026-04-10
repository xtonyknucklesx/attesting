import { describe, it, expect } from 'vitest';
import { parseSpdxPackages } from '../../../src/services/connectors/adapters/sbom-spdx.js';

const SAMPLE_SPDX = {
  spdxVersion: 'SPDX-2.3',
  name: 'my-app',
  packages: [
    {
      name: 'express',
      versionInfo: '4.18.2',
      downloadLocation: 'https://registry.npmjs.org/express/-/express-4.18.2.tgz',
      externalRefs: [
        { referenceCategory: 'PACKAGE-MANAGER', referenceType: 'purl', referenceLocator: 'pkg:npm/express@4.18.2' },
      ],
    },
    {
      name: 'debug',
      versionInfo: '4.3.4',
      downloadLocation: 'https://registry.npmjs.org/debug/-/debug-4.3.4.tgz',
      supplier: 'TJ Holowaychuk',
    },
  ],
};

describe('SPDX SBOM', () => {
  describe('parseSpdxPackages', () => {
    it('extracts packages from SPDX JSON', () => {
      const packages = parseSpdxPackages(JSON.stringify(SAMPLE_SPDX));
      expect(packages).toHaveLength(2);
      expect(packages[0].name).toBe('express');
      expect(packages[0].version).toBe('4.18.2');
      expect(packages[0].purl).toBe('pkg:npm/express@4.18.2');
      expect(packages[1].supplier).toBe('TJ Holowaychuk');
      expect(packages[1].purl).toBeUndefined();
    });

    it('returns empty for doc with no packages', () => {
      const doc = { spdxVersion: 'SPDX-2.3' };
      expect(parseSpdxPackages(JSON.stringify(doc))).toEqual([]);
    });
  });
});
