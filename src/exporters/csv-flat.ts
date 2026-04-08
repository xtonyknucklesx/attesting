/**
 * Flat CSV Exporter
 *
 * Generates a flat CSV export of all implementation statements, optionally
 * including cross-framework control mappings for each control.
 *
 * Output columns:
 *   catalog, control_id, title, status, sig_response, statement,
 *   responsible_role, responsibility_type, mapped_controls
 */

import * as fs from 'fs';
import * as path from 'path';
import Database from 'better-sqlite3';
import { resolveControl } from '../mappers/resolver.js';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Exports a flat CSV of all implementations for a scope.
 *
 * @param scopeName       Scope name filter, or undefined for all scopes.
 * @param includeMappings When true, adds a pipe-separated mapped_controls column.
 * @param outputPath      File path for the output CSV.
 * @param db              Open database instance.
 */
export function exportCsvFlat(
  scopeName: string | undefined,
  includeMappings: boolean,
  outputPath: string,
  db: Database.Database
): { rows: number } {
  interface ImplRow {
    catalog: string;
    control_id: string;
    control_uuid: string;
    title: string;
    status: string;
    sig_response: string | null;
    statement: string;
    responsible_role: string | null;
    responsibility_type: string;
  }

  const scopeFilter = scopeName
    ? `AND (s.name = ? OR i.scope_id IS NULL)`
    : '';

  const sql = `
    SELECT
      cat.short_name       AS catalog,
      c.control_id,
      c.id                 AS control_uuid,
      c.title,
      i.status,
      i.sig_response,
      i.statement,
      i.responsible_role,
      i.responsibility_type
    FROM implementations i
    JOIN controls c   ON i.primary_control_id = c.id
    JOIN catalogs cat ON c.catalog_id = cat.id
    LEFT JOIN scopes s ON i.scope_id = s.id
    ${scopeFilter}
    ORDER BY cat.short_name, c.sort_order, c.control_id
  `;

  const queryParams: string[] = scopeName ? [scopeName] : [];
  const rows = db.prepare(sql).all(...queryParams) as ImplRow[];

  // CSV header
  const header = [
    'catalog',
    'control_id',
    'title',
    'status',
    'sig_response',
    'statement',
    'responsible_role',
    'responsibility_type',
    'mapped_controls',
  ];

  const csvLines: string[] = [header.join(',')];

  for (const row of rows) {
    // Resolve mapped controls if requested
    let mappedControls = '';
    if (includeMappings) {
      const resolved = resolveControl(row.control_uuid, db);
      mappedControls = resolved
        .map((m) => `${m.catalogShortName}:${m.controlNativeId}`)
        .join('|');
    }

    const cells = [
      csvEscape(row.catalog),
      csvEscape(row.control_id),
      csvEscape(row.title),
      csvEscape(row.status),
      csvEscape(row.sig_response ?? ''),
      csvEscape(row.statement),
      csvEscape(row.responsible_role ?? ''),
      csvEscape(row.responsibility_type),
      csvEscape(mappedControls),
    ];

    csvLines.push(cells.join(','));
  }

  const resolvedPath = path.resolve(outputPath);
  fs.writeFileSync(resolvedPath, csvLines.join('\n'), 'utf-8');

  return { rows: rows.length };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Escapes a value for CSV output.
 * Wraps the value in double-quotes if it contains commas, quotes, or newlines.
 */
function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
