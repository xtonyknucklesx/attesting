import Database from 'better-sqlite3';

/**
 * A resolved (direct or transitive) mapping from a source control to another control.
 */
export interface ResolvedMapping {
  /** Internal UUID of the mapped control. */
  controlId: string;
  /** Framework-native ID (e.g. "3.1.1", "A.5.1"). */
  controlNativeId: string;
  /** Short name of the catalog containing the mapped control. */
  catalogShortName: string;
  /** OSCAL relationship type. */
  relationship: string;
  /** 'high' | 'medium' | 'low' */
  confidence: string;
  /** UUIDs traversed to reach this control (empty for direct). */
  path: string[];
  /** True if reached via 2+ hops. */
  isTransitive: boolean;
  /** Human-readable intermediary for transitive mappings (e.g. "nist-800-53-r5:pm-14"). */
  via: string | null;
}

/**
 * Confidence level degradation chain.
 * Each hop degrades confidence by one step.
 */
const CONFIDENCE_ORDER: string[] = ['high', 'medium', 'low'];

/**
 * Degrades a confidence value by one hop.
 * 'high' -> 'medium', 'medium' -> 'low', 'low' stays 'low'.
 */
function degradeConfidence(confidence: string): string {
  const idx = CONFIDENCE_ORDER.indexOf(confidence);
  if (idx === -1) return 'low';
  return CONFIDENCE_ORDER[Math.min(idx + 1, CONFIDENCE_ORDER.length - 1)];
}

/**
 * Looks up direct mappings for a control UUID in both directions
 * (the control may appear as either the source or the target).
 */
interface RawMapping {
  otherControlId: string;
  otherNativeId: string;
  otherCatalog: string;
  relationship: string;
  confidence: string;
}

function getDirectMappings(
  controlUuid: string,
  db: Database.Database
): RawMapping[] {
  // Source side: this control is the source
  const asSource = db
    .prepare(
      `SELECT
         cm.target_control_id AS otherControlId,
         c.control_id         AS otherNativeId,
         cat.short_name       AS otherCatalog,
         cm.relationship,
         cm.confidence
       FROM control_mappings cm
       JOIN controls c   ON cm.target_control_id = c.id
       JOIN catalogs cat ON c.catalog_id = cat.id
       WHERE cm.source_control_id = ?`
    )
    .all(controlUuid) as RawMapping[];

  // Target side: this control is the target (reverse lookup)
  const asTarget = db
    .prepare(
      `SELECT
         cm.source_control_id AS otherControlId,
         c.control_id         AS otherNativeId,
         cat.short_name       AS otherCatalog,
         cm.relationship,
         cm.confidence
       FROM control_mappings cm
       JOIN controls c   ON cm.source_control_id = c.id
       JOIN catalogs cat ON c.catalog_id = cat.id
       WHERE cm.target_control_id = ?`
    )
    .all(controlUuid) as RawMapping[];

  return [...asSource, ...asTarget];
}

/**
 * Resolves all direct and transitive mappings for a given control UUID.
 *
 * Implements bidirectional BFS traversal up to maxDepth hops.
 * Confidence degrades by one level per transitive hop.
 *
 * @param controlUuid  Internal UUID of the control to resolve from.
 * @param db           Open better-sqlite3 database instance.
 * @param maxDepth     Maximum traversal depth (1 = direct only, 2 = one transitive hop). Default 2.
 */
export function resolveControl(
  controlUuid: string,
  db: Database.Database,
  maxDepth: number = 2
): ResolvedMapping[] {
  const results: ResolvedMapping[] = [];
  // Track visited UUIDs to prevent cycles
  const visited = new Set<string>([controlUuid]);

  // Look up human-readable ref for a control UUID
  const resolveRef = db.prepare(
    `SELECT c.control_id, cat.short_name
     FROM controls c JOIN catalogs cat ON c.catalog_id = cat.id WHERE c.id = ?`
  );

  /**
   * Recursive BFS helper.
   * @param fromUuid   UUID to expand from.
   * @param depth      Current depth (1 = direct, 2 = transitive, …).
   * @param path       UUIDs traversed so far (empty at depth 1).
   * @param parentConf Confidence from the edge leading to fromUuid (used for degradation).
   * @param viaRef     Human-readable ref of the intermediary (for depth 2+).
   */
  function expand(
    fromUuid: string,
    depth: number,
    path: string[],
    parentConf: string,
    viaRef: string | null
  ): void {
    if (depth > maxDepth) return;

    const directMappings = getDirectMappings(fromUuid, db);

    for (const mapping of directMappings) {
      if (visited.has(mapping.otherControlId)) continue;
      visited.add(mapping.otherControlId);

      const effectiveConfidence =
        depth === 1
          ? mapping.confidence
          : degradeConfidence(parentConf);

      const isTransitive = depth > 1;
      const currentPath = [...path, fromUuid];

      results.push({
        controlId: mapping.otherControlId,
        controlNativeId: mapping.otherNativeId,
        catalogShortName: mapping.otherCatalog,
        relationship: mapping.relationship,
        confidence: effectiveConfidence,
        path: isTransitive ? currentPath : [],
        isTransitive,
        via: isTransitive ? viaRef : null,
      });

      // Continue BFS — build the via ref for the next level
      if (depth < maxDepth) {
        const ref = resolveRef.get(mapping.otherControlId) as { control_id: string; short_name: string } | undefined;
        const nextVia = ref ? `${ref.short_name}:${ref.control_id}` : null;
        expand(
          mapping.otherControlId,
          depth + 1,
          currentPath,
          effectiveConfidence,
          nextVia
        );
      }
    }
  }

  expand(controlUuid, 1, [], 'high', null);

  return results;
}
