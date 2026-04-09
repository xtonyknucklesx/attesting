import type Database from 'better-sqlite3';
import { shadowPropagate } from '../propagation/dispatcher.js';
import { platformMatches } from '../propagation/matchers.js';

/**
 * Generates a shadow impact analysis for a piece of manual intel.
 * Runs the propagation engine in dry-run mode to show what would
 * happen if this intel were confirmed.
 */
export function generateShadowImpact(db: Database.Database, manualIntelId: string): ShadowReport {
  const intel = db.prepare('SELECT * FROM manual_intel WHERE id = ?').get(manualIntelId) as any;
  if (!intel) throw new Error(`Manual intel ${manualIntelId} not found`);

  const platforms = safeParseArray(intel.affected_platforms_est);
  const controlsEst = safeParseArray(intel.affected_controls_est);

  // Run dry-run propagation
  const result = shadowPropagate(db, 'threat_input', manualIntelId, {
    affected_platforms: intel.affected_platforms_est,
    ttps: '[]',
    severity: intel.severity_estimate,
  });

  const assetsAtRisk = identifyAssetsAtRisk(db, platforms);

  return {
    summary: buildSummary(result, assetsAtRisk.length),
    assets_at_risk: assetsAtRisk,
    controls_to_review: identifyControlsToReview(db, controlsEst),
    risk_score_deltas: result.risks_affected.map(r => ({
      risk_id: r.risk_id as string,
      risk_title: r.risk_title as string,
      current_residual: (r.previous_residual as number) ?? null,
      projected_residual: r.new_residual as number,
      delta: ((r.new_residual as number) ?? 0) - ((r.previous_residual as number) ?? 0),
    })),
    alerts_would_fire: result.alerts_would_fire.length,
    frameworks_affected: identifyFrameworkImpact(db, controlsEst),
  };
}

export interface ShadowReport {
  summary: string;
  assets_at_risk: Array<{ id: string; name: string; platform?: string }>;
  controls_to_review: Array<{
    control_id: string;
    implementation_id: string;
    current_status: string;
    owner?: string;
  }>;
  risk_score_deltas: Array<{
    risk_id: string;
    risk_title: string;
    current_residual: number | null;
    projected_residual: number;
    delta: number;
  }>;
  alerts_would_fire: number;
  frameworks_affected: string[];
}

function identifyAssetsAtRisk(
  db: Database.Database,
  platforms: string[],
): Array<{ id: string; name: string; platform?: string }> {
  if (platforms.length === 0) return [];

  const assets = db.prepare(
    `SELECT id, name, platform FROM assets WHERE status = 'active' AND platform IS NOT NULL`
  ).all() as Array<{ id: string; name: string; platform: string }>;

  return assets.filter(a => platformMatches(a.platform, platforms));
}

function identifyControlsToReview(
  db: Database.Database,
  controlIds: string[],
): Array<{ control_id: string; implementation_id: string; current_status: string; owner?: string }> {
  if (controlIds.length === 0) return [];

  const results: Array<{ control_id: string; implementation_id: string; current_status: string; owner?: string }> = [];
  for (const cid of controlIds) {
    const impls = db.prepare(`
      SELECT i.id, c.control_id, i.status, i.responsible_person
      FROM implementations i
      JOIN controls c ON i.primary_control_id = c.id
      WHERE c.control_id = ?
    `).all(cid) as Array<{ id: string; control_id: string; status: string; responsible_person?: string }>;

    for (const impl of impls) {
      results.push({
        control_id: impl.control_id,
        implementation_id: impl.id,
        current_status: impl.status,
        owner: impl.responsible_person,
      });
    }
  }
  return results;
}

function identifyFrameworkImpact(db: Database.Database, controlIds: string[]): string[] {
  if (controlIds.length === 0) return [];
  const frameworks = new Set<string>();

  for (const cid of controlIds) {
    const catalogs = db.prepare(`
      SELECT DISTINCT cat.short_name
      FROM controls c JOIN catalogs cat ON c.catalog_id = cat.id
      WHERE c.control_id = ?
    `).all(cid) as Array<{ short_name: string }>;

    catalogs.forEach(c => frameworks.add(c.short_name));
  }
  return [...frameworks];
}

function buildSummary(result: any, assetCount: number): string {
  const parts: string[] = [];
  if (assetCount > 0) parts.push(`${assetCount} asset${assetCount > 1 ? 's' : ''} potentially exposed`);
  if (result.controls_affected.length > 0) parts.push(`${result.controls_affected.length} control(s) to review`);
  if (result.risks_affected.length > 0) parts.push(`${result.risks_affected.length} risk score(s) would change`);
  if (result.alerts_would_fire.length > 0) parts.push(`${result.alerts_would_fire.length} alert(s) would fire`);

  return parts.length > 0
    ? `If confirmed: ${parts.join(', ')}.`
    : 'Minimal expected impact based on current inventory and posture.';
}

function safeParseArray(json: string | null | undefined): string[] {
  if (!json) return [];
  try { return JSON.parse(json); }
  catch { return []; }
}
