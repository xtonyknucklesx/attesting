import type Database from 'better-sqlite3';
import { generateUuid } from '../../utils/uuid.js';

export interface SbomComponent {
  name: string;
  version?: string;
  purl?: string;
  type?: string;
  supplier?: string;
  downloadLocation?: string;
}

/**
 * Maps an SBOM component to an asset row and inserts it.
 * Returns the asset ID.
 */
export function upsertComponentAsAsset(
  db: Database.Database,
  component: SbomComponent,
  parentName?: string,
): string {
  const displayName = component.version
    ? `${component.name}@${component.version}`
    : component.name;

  const platform = `software/${component.type ?? 'library'}`;
  const externalId = component.purl ?? displayName;

  // Deduplicate by external_id
  const existing = db.prepare(
    "SELECT id FROM assets WHERE external_id = ? AND external_source = 'sbom'"
  ).get(externalId) as { id: string } | undefined;

  if (existing) {
    db.prepare(`
      UPDATE assets SET name = ?, platform = ?, updated_at = datetime('now') WHERE id = ?
    `).run(displayName, platform, existing.id);
    return existing.id;
  }

  const id = generateUuid();
  db.prepare(`
    INSERT INTO assets (id, name, asset_type, platform, status,
      external_id, external_source, metadata, created_at, updated_at)
    VALUES (?, ?, 'application', ?, 'active', ?, 'sbom', ?, datetime('now'), datetime('now'))
  `).run(
    id, displayName, platform, externalId,
    JSON.stringify({
      purl: component.purl ?? null,
      supplier: component.supplier ?? null,
      parent: parentName ?? null,
      download: component.downloadLocation ?? null,
    }),
  );

  return id;
}

/**
 * After importing SBOM components as assets, cross-reference
 * against existing threat feeds (NVD, CISA KEV) to create correlations.
 */
export function correlateComponentsWithThreats(
  db: Database.Database,
  assetIds: string[],
): { correlations: number; risks: number } {
  let correlations = 0;
  let risks = 0;

  for (const assetId of assetIds) {
    const asset = db.prepare('SELECT name, platform FROM assets WHERE id = ?').get(assetId) as any;
    if (!asset) continue;

    // Match by product name against threat_inputs affected_products
    const threats = db.prepare(`
      SELECT id, title, severity FROM threat_inputs
      WHERE affected_products LIKE ? AND processed = 0
    `).all(`%${asset.name.split('@')[0]}%`) as Array<{ id: string; title: string; severity: string }>;

    for (const threat of threats) {
      const exists = db.prepare(
        'SELECT 1 FROM threat_asset_correlations WHERE threat_id = ? AND asset_id = ?'
      ).get(threat.id, assetId);

      if (!exists) {
        db.prepare(`
          INSERT INTO threat_asset_correlations (id, threat_id, asset_id, match_type, match_detail)
          VALUES (?, ?, ?, 'sbom_component', ?)
        `).run(generateUuid(), threat.id, assetId, `Component name match: ${asset.name}`);
        correlations++;
      }
    }
  }

  return { correlations, risks };
}
