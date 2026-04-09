import type Database from 'better-sqlite3';
import { keywordOverlap } from '../propagation/matchers.js';
import { updateIntelConfidence } from './manual-intel.js';

export interface CorroborationMatch {
  manual_intel_id: string;
  manual_intel_title: string;
  threat_id: string;
  threat_title: string;
  match_reasons: string[];
}

/**
 * Checks whether a newly ingested threat feed entry corroborates
 * any provisional manual intel. Called after each threat feed sync.
 */
export function checkAutoCorroboration(
  db: Database.Database,
  newThreatId: string,
): CorroborationMatch[] {
  const threat = db.prepare('SELECT * FROM threat_inputs WHERE id = ?').get(newThreatId) as any;
  if (!threat) return [];

  const provisional = db.prepare(`
    SELECT * FROM manual_intel WHERE status IN ('provisional', 'watching')
  `).all() as any[];

  const threatPlatforms = safeParseArray(threat.affected_platforms);
  const matches: CorroborationMatch[] = [];

  for (const intel of provisional) {
    const reasons: string[] = [];
    const intelPlatforms = safeParseArray(intel.affected_platforms_est);

    // Platform overlap
    if (intelPlatforms.some((ip: string) =>
      threatPlatforms.some((tp: string) => {
        const a = ip.toLowerCase();
        const b = tp.toLowerCase();
        return a.includes(b) || b.includes(a);
      })
    )) {
      reasons.push('platform_overlap');
    }

    // CVE match
    if (threat.cve_id && intel.description?.includes(threat.cve_id)) {
      reasons.push('cve_match');
    }

    // Title similarity
    if (keywordOverlap(intel.title, threat.title) > 0.3) {
      reasons.push('title_similarity');
    }

    if (reasons.length > 0) {
      matches.push({
        manual_intel_id: intel.id,
        manual_intel_title: intel.title,
        threat_id: newThreatId,
        threat_title: threat.title,
        match_reasons: reasons,
      });

      updateIntelConfidence(db, intel.id, 'high');
    }
  }

  return matches;
}

function safeParseArray(json: string | null | undefined): string[] {
  if (!json) return [];
  try { return JSON.parse(json); }
  catch { return []; }
}
