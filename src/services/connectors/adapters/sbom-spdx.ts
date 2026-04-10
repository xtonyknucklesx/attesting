import type Database from 'better-sqlite3';
import fs from 'fs';
import { upsertComponentAsAsset, correlateComponentsWithThreats } from '../../import/sbom-common.js';
import type { SbomComponent } from '../../import/sbom-common.js';

export interface SpdxDocument {
  spdxVersion: string;
  name?: string;
  packages?: SpdxPackage[];
}

interface SpdxPackage {
  name: string;
  versionInfo?: string;
  downloadLocation?: string;
  supplier?: string;
  externalRefs?: Array<{
    referenceCategory: string;
    referenceType: string;
    referenceLocator: string;
  }>;
}

/**
 * Parse an SPDX JSON file and import packages as assets.
 */
export function importSpdx(
  db: Database.Database,
  filePath: string,
): { components: number; assets_created: number; correlations: number } {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as SpdxDocument;

  if (!raw.spdxVersion) {
    throw new Error('Not a valid SPDX document (missing spdxVersion)');
  }

  const packages = raw.packages ?? [];
  const assetIds: string[] = [];

  for (const pkg of packages) {
    const purl = pkg.externalRefs?.find(
      r => r.referenceType === 'purl'
    )?.referenceLocator;

    const mapped: SbomComponent = {
      name: pkg.name,
      version: pkg.versionInfo,
      purl,
      type: 'library',
      supplier: pkg.supplier,
      downloadLocation: pkg.downloadLocation,
    };

    const assetId = upsertComponentAsAsset(db, mapped, raw.name);
    assetIds.push(assetId);
  }

  const { correlations } = correlateComponentsWithThreats(db, assetIds);

  return {
    components: packages.length,
    assets_created: assetIds.length,
    correlations,
  };
}

/**
 * Parse SPDX from a JSON string (for API/connector use).
 */
export function parseSpdxPackages(json: string): SbomComponent[] {
  const raw = JSON.parse(json) as SpdxDocument;
  return (raw.packages ?? []).map(pkg => ({
    name: pkg.name,
    version: pkg.versionInfo,
    purl: pkg.externalRefs?.find(r => r.referenceType === 'purl')?.referenceLocator,
    type: 'library',
    supplier: pkg.supplier,
    downloadLocation: pkg.downloadLocation,
  }));
}
