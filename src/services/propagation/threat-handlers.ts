import type Database from 'better-sqlite3';
import type { PropagationContext } from './types.js';
import { logEntry } from './types.js';
import { platformMatches, mapTTPsToControls } from './matchers.js';
import { createRiskFromThreat } from './risk-handlers.js';
import { generateUuid } from '../../utils/uuid.js';

/**
 * Processes a newly ingested threat input:
 * 1. Correlates against asset inventory by platform
 * 2. Maps TTPs to control families
 * 3. Checks control implementation status for affected assets
 * 4. Creates or escalates risk entries
 */
export function onThreatIngested(
  db: Database.Database,
  ctx: PropagationContext,
  threatId: string,
): void {
  const threat = db.prepare('SELECT * FROM threat_inputs WHERE id = ?').get(threatId) as any;
  if (!threat) return;

  const platforms = safeParseArray(threat.affected_platforms);
  const ttps = safeParseArray(threat.ttps);

  // Step 1: Correlate against assets
  const matchedAssets = correlateAssets(db, ctx, threatId, platforms);

  // Step 2: Map TTPs to controls
  const controlFamilies = mapTTPsToControls(ttps);

  // Step 3: Check control gaps for matched assets
  for (const controlId of controlFamilies) {
    for (const asset of matchedAssets) {
      checkControlGap(db, ctx, controlId, asset, threat.title);
    }
  }

  // Step 4: Create risk if assets matched
  if (matchedAssets.length > 0) {
    const severityMap: Record<string, number> = {
      critical: 5, high: 4, medium: 3, low: 2, info: 1,
    };
    const likelihood = severityMap[threat.severity] ?? 3;
    const impact = Math.min(5, Math.max(3, matchedAssets.length));

    const riskId = createRiskFromThreat(db, ctx, {
      title: `Active threat: ${threat.title}`,
      description: threat.description,
      likelihood,
      impact,
      threatId,
    });

    if (riskId && !ctx.dryRun) {
      // Link risk to assets
      const linkAsset = db.prepare(
        'INSERT OR IGNORE INTO risk_asset_links (risk_id, asset_id) VALUES (?, ?)'
      );
      for (const a of matchedAssets) linkAsset.run(riskId, a.id);

      // Link threat to risk
      db.prepare(
        'INSERT OR IGNORE INTO threat_risk_links (threat_id, risk_id) VALUES (?, ?)'
      ).run(threatId, riskId);

      // Mark processed
      db.prepare(
        `UPDATE threat_inputs SET processed = 1, processed_at = datetime('now') WHERE id = ?`
      ).run(threatId);
    }
  }
}

function correlateAssets(
  db: Database.Database,
  ctx: PropagationContext,
  threatId: string,
  platforms: string[],
): Array<{ id: string; name: string; platform: string }> {
  if (platforms.length === 0) return [];

  const assets = db.prepare(
    `SELECT id, name, platform FROM assets WHERE status = 'active' AND platform IS NOT NULL`
  ).all() as Array<{ id: string; name: string; platform: string }>;

  const matched: typeof assets = [];

  for (const asset of assets) {
    if (platformMatches(asset.platform, platforms)) {
      matched.push(asset);

      logEntry(ctx, 'asset_exposed', {
        asset_id: asset.id,
        asset_name: asset.name,
        threat_id: threatId,
        match_type: 'platform',
      });

      if (!ctx.dryRun) {
        db.prepare(`
          INSERT OR IGNORE INTO threat_asset_correlations
          (threat_id, asset_id, match_type, match_detail)
          VALUES (?, ?, 'platform', ?)
        `).run(threatId, asset.id, `${asset.platform} matched`);
      }
    }
  }

  return matched;
}

function checkControlGap(
  db: Database.Database,
  ctx: PropagationContext,
  controlFamily: string,
  asset: { id: string; name: string },
  threatTitle: string,
): void {
  // Find implementations for this control family that scope to this asset
  // Since we don't have a direct impl↔asset junction yet, check by org-wide impls
  const impl = db.prepare(`
    SELECT i.id, i.status, c.control_id
    FROM implementations i
    JOIN controls c ON i.primary_control_id = c.id
    WHERE c.control_id LIKE ? || '%'
    AND i.status NOT IN ('implemented')
    LIMIT 1
  `).get(controlFamily) as { id: string; status: string; control_id: string } | undefined;

  if (impl) {
    logEntry(ctx, 'control_gap_threat', {
      control_id: impl.control_id,
      asset_id: asset.id,
      asset_name: asset.name,
      threat_title: threatTitle,
      implementation_status: impl.status,
    });
  }
}

function safeParseArray(json: string | null | undefined): string[] {
  if (!json) return [];
  try { return JSON.parse(json); }
  catch { return []; }
}
