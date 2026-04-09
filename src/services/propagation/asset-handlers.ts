import type Database from 'better-sqlite3';
import type { PropagationContext } from './types.js';
import { logEntry } from './types.js';
import { createDriftAlert } from '../drift/alert-writer.js';
import { platformMatches } from './matchers.js';

/**
 * Handles asset state changes: platform drift triggers threat
 * re-correlation, classification changes trigger coverage review,
 * decommission triggers scope cleanup.
 */
export function onAssetChange(
  db: Database.Database,
  ctx: PropagationContext,
  assetId: string,
  prev: any,
  next: any,
): void {
  if (prev?.platform !== next?.platform) {
    reCorrelateThreats(db, ctx, assetId, next?.platform);
  }

  if (prev?.data_classification !== next?.data_classification) {
    logEntry(ctx, 'classification_change', {
      asset_id: assetId,
      from: prev?.data_classification,
      to: next?.data_classification,
    });

    if (!ctx.dryRun) {
      createDriftAlert(db, {
        alert_type: 'asset_drift',
        severity: 'high',
        title: `Asset classification changed: ${next?.name}`,
        message: `Changed from '${prev?.data_classification}' to '${next?.data_classification}'. Review control coverage.`,
        source_entity_type: 'asset',
        source_entity_id: assetId,
      });
    }
  }

  if (next?.status === 'decommissioned' && prev?.status !== 'decommissioned') {
    logEntry(ctx, 'asset_decommissioned', { asset_id: assetId, name: next?.name });
  }
}

/**
 * Re-runs threat correlation for an asset whose platform changed.
 */
function reCorrelateThreats(
  db: Database.Database,
  ctx: PropagationContext,
  assetId: string,
  platform: string | null,
): void {
  if (!platform) return;

  const threats = db.prepare(
    `SELECT id, title, affected_platforms FROM threat_inputs WHERE processed = 1`
  ).all() as Array<{ id: string; title: string; affected_platforms: string }>;

  for (const threat of threats) {
    let platforms: string[];
    try { platforms = JSON.parse(threat.affected_platforms || '[]'); }
    catch { continue; }

    if (platformMatches(platform, platforms)) {
      logEntry(ctx, 'asset_exposed', {
        asset_id: assetId,
        threat_id: threat.id,
        threat_title: threat.title,
        match_type: 'platform',
      });

      if (!ctx.dryRun) {
        db.prepare(`
          INSERT OR IGNORE INTO threat_asset_correlations
          (threat_id, asset_id, match_type, match_detail)
          VALUES (?, ?, 'platform', ?)
        `).run(threat.id, assetId, `Platform re-correlation: ${platform}`);
      }
    }
  }
}
