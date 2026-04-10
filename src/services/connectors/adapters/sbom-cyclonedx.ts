import type Database from 'better-sqlite3';
import fs from 'fs';
import { upsertComponentAsAsset, correlateComponentsWithThreats } from '../../import/sbom-common.js';
import type { SbomComponent } from '../../import/sbom-common.js';

export interface CycloneDxBom {
  bomFormat: string;
  specVersion: string;
  metadata?: { component?: { name: string; version?: string } };
  components?: CycloneDxComponent[];
}

interface CycloneDxComponent {
  type: string;
  name: string;
  version?: string;
  purl?: string;
  supplier?: { name: string };
}

/**
 * Parse a CycloneDX JSON SBOM file and import components as assets.
 */
export function importCycloneDx(
  db: Database.Database,
  filePath: string,
): { components: number; assets_created: number; correlations: number } {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as CycloneDxBom;

  if (raw.bomFormat !== 'CycloneDX') {
    throw new Error(`Not a CycloneDX BOM (bomFormat: ${raw.bomFormat})`);
  }

  const parentName = raw.metadata?.component?.name;
  const components = raw.components ?? [];
  const assetIds: string[] = [];

  for (const comp of components) {
    const mapped: SbomComponent = {
      name: comp.name,
      version: comp.version,
      purl: comp.purl,
      type: comp.type,
      supplier: comp.supplier?.name,
    };

    const assetId = upsertComponentAsAsset(db, mapped, parentName);
    assetIds.push(assetId);
  }

  const { correlations } = correlateComponentsWithThreats(db, assetIds);

  return {
    components: components.length,
    assets_created: assetIds.length,
    correlations,
  };
}

/**
 * Parse CycloneDX from a JSON string (for API/connector use).
 */
export function parseCycloneDxComponents(json: string): SbomComponent[] {
  const raw = JSON.parse(json) as CycloneDxBom;
  return (raw.components ?? []).map(comp => ({
    name: comp.name,
    version: comp.version,
    purl: comp.purl,
    type: comp.type,
    supplier: comp.supplier?.name,
  }));
}
