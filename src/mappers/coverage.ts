import Database from 'better-sqlite3';

/**
 * Coverage summary for a single catalog within a scope.
 */
export interface CoverageResult {
  catalogShortName: string;
  catalogName: string;
  totalControls: number;
  implemented: number;
  partial: number;
  notApplicable: number;
  notImplemented: number;
  /** Mapped coverage: controls not directly implemented but mapped to an implemented control. */
  mappedCoverage: number;
  /** Primary coverage: (implemented + not-applicable) / total * 100 */
  coveragePct: number;
  /** Effective coverage including mapped: (implemented + not-applicable + mapped) / total * 100 */
  effectivePct: number;
}

/**
 * Calculates implementation coverage across all catalogs for a given
 * organization and optional scope.
 *
 * For each control in each catalog:
 *  1. Direct implementation → counts as implemented/partial/na/not-impl
 *  2. No direct impl, but mapped to a control that IS implemented → mapped coverage
 *  3. Neither → not implemented
 *
 * Coverage %  = (implemented + not-applicable) / total * 100
 * Effective % = (implemented + not-applicable + mapped) / total * 100
 *
 * @param orgId    UUID of the organization.
 * @param scopeId  UUID of the scope, or null for org-wide.
 * @param db       Open better-sqlite3 database instance.
 */
export function calculateCoverage(
  orgId: string,
  scopeId: string | null,
  db: Database.Database
): CoverageResult[] {
  // Build the query — scope filter is applied conditionally
  const scopeFilter = scopeId
    ? 'AND (i.scope_id = @scopeId OR i.scope_id IS NULL)'
    : '';

  const scopeFilterMapped = scopeId
    ? 'AND (mi.scope_id = @scopeId OR mi.scope_id IS NULL)'
    : '';

  // Step 1: Get direct coverage per catalog (same as before)
  const directSql = `
    SELECT
      cat.short_name AS catalogShortName,
      cat.name       AS catalogName,
      COUNT(DISTINCT c.id) AS totalControls,
      COUNT(DISTINCT CASE WHEN i.status = 'implemented' THEN c.id END) AS implemented,
      COUNT(DISTINCT CASE WHEN i.status = 'partially-implemented' THEN c.id END) AS partial,
      COUNT(DISTINCT CASE WHEN i.status = 'not-applicable' THEN c.id END) AS notApplicable,
      COUNT(DISTINCT CASE WHEN i.status = 'not-implemented' OR i.id IS NULL THEN c.id END) AS notImplemented,
      ROUND(
        100.0 * COUNT(DISTINCT CASE WHEN i.status IN ('implemented', 'not-applicable') THEN c.id END)
        / NULLIF(COUNT(DISTINCT c.id), 0),
        1
      ) AS coveragePct
    FROM controls c
    JOIN catalogs cat ON c.catalog_id = cat.id
    LEFT JOIN implementations i
      ON i.primary_control_id = c.id
      AND i.org_id = @orgId
      ${scopeFilter}
    GROUP BY cat.short_name, cat.name
    ORDER BY cat.name
  `;

  interface DirectRow {
    catalogShortName: string;
    catalogName: string;
    totalControls: number;
    implemented: number;
    partial: number;
    notApplicable: number;
    notImplemented: number;
    coveragePct: number | null;
  }

  const directRows = db.prepare(directSql).all({ orgId, scopeId: scopeId ?? null }) as DirectRow[];

  // Step 2: Find mapped coverage — controls that have no direct implementation
  // but are mapped (via control_mappings) to a control that IS implemented.
  //
  // A control gets mapped coverage if:
  //   - It has no implementation row with status in (implemented, not-applicable, partially-implemented)
  //   - It is the target of a control_mapping where the source control IS implemented
  //   - OR it is the source of a control_mapping where the target control IS implemented
  const mappedSql = `
    SELECT
      cat.short_name AS catalogShortName,
      COUNT(DISTINCT c.id) AS mappedCount
    FROM controls c
    JOIN catalogs cat ON c.catalog_id = cat.id
    WHERE
      -- No direct implementation that counts as covered
      c.id NOT IN (
        SELECT i.primary_control_id
        FROM implementations i
        WHERE i.org_id = @orgId
          AND i.status IN ('implemented', 'not-applicable', 'partially-implemented')
          ${scopeFilter}
      )
      -- But has a mapping to a control that IS implemented
      AND (
        -- This control is the TARGET of a mapping from an implemented control
        c.id IN (
          SELECT cm.target_control_id
          FROM control_mappings cm
          JOIN implementations mi
            ON mi.primary_control_id = cm.source_control_id
            AND mi.org_id = @orgId
            AND mi.status = 'implemented'
            ${scopeFilterMapped}
        )
        OR
        -- This control is the SOURCE of a mapping to an implemented control
        c.id IN (
          SELECT cm.source_control_id
          FROM control_mappings cm
          JOIN implementations mi
            ON mi.primary_control_id = cm.target_control_id
            AND mi.org_id = @orgId
            AND mi.status = 'implemented'
            ${scopeFilterMapped}
        )
      )
    GROUP BY cat.short_name
  `;

  interface MappedRow {
    catalogShortName: string;
    mappedCount: number;
  }

  const mappedRows = db.prepare(mappedSql).all({ orgId, scopeId: scopeId ?? null }) as MappedRow[];
  const mappedByCatalog = new Map(mappedRows.map((r) => [r.catalogShortName, r.mappedCount]));

  return directRows.map((r) => {
    const mapped = mappedByCatalog.get(r.catalogShortName) ?? 0;
    const directCoverage = r.coveragePct ?? 0;
    const effectivePct = r.totalControls > 0
      ? Math.round(1000 * (r.implemented + r.notApplicable + mapped) / r.totalControls) / 10
      : 0;

    return {
      catalogShortName: r.catalogShortName,
      catalogName: r.catalogName,
      totalControls: r.totalControls,
      implemented: r.implemented,
      partial: r.partial,
      notApplicable: r.notApplicable,
      notImplemented: r.notImplemented - mapped, // mapped controls are no longer "not implemented"
      mappedCoverage: mapped,
      coveragePct: directCoverage,
      effectivePct,
    };
  });
}
