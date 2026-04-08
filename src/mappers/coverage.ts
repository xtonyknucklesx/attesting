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
  coveragePct: number;
}

/**
 * Calculates implementation coverage across all catalogs for a given
 * organization and optional scope.
 *
 * Coverage % = (implemented + not-applicable) / total_controls * 100
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

  const sql = `
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

  interface RawRow {
    catalogShortName: string;
    catalogName: string;
    totalControls: number;
    implemented: number;
    partial: number;
    notApplicable: number;
    notImplemented: number;
    coveragePct: number | null;
  }

  const rows = db.prepare(sql).all({ orgId, scopeId: scopeId ?? null }) as RawRow[];

  return rows.map((r) => ({
    catalogShortName: r.catalogShortName,
    catalogName: r.catalogName,
    totalControls: r.totalControls,
    implemented: r.implemented,
    partial: r.partial,
    notApplicable: r.notApplicable,
    notImplemented: r.notImplemented,
    coveragePct: r.coveragePct ?? 0,
  }));
}
