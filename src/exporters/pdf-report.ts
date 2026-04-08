/**
 * PDF Compliance Report Exporter
 *
 * Generates a plain-text PDF compliance summary report using PDFKit.
 * Layout is intentionally simple (no tables or complex formatting) to
 * maximise compatibility across PDF viewers.
 *
 * Sections:
 *   1. Cover page — org name, scope, date, report title
 *   2. Coverage summary — per-catalog counts (same data as `impl status`)
 *   3. Implementation list — control_id, status, first 200 chars of statement
 */

import * as fs from 'fs';
import * as path from 'path';
import Database from 'better-sqlite3';
import PDFDocument from 'pdfkit';
import { calculateCoverage } from '../mappers/coverage.js';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Exports a PDF compliance summary report.
 *
 * @param scopeName         Optional scope name filter.
 * @param catalogShortNames Catalog short names to include (all if empty).
 * @param outputPath        File path for the output PDF.
 * @param db                Open database instance.
 */
export function exportPdfReport(
  scopeName: string | undefined,
  catalogShortNames: string[],
  outputPath: string,
  db: Database.Database
): { pages: number } {
  // -------------------------------------------------------------------------
  // Fetch data
  // -------------------------------------------------------------------------
  interface OrgRow { name: string }
  const org = db
    .prepare('SELECT name FROM organizations LIMIT 1')
    .get() as OrgRow | undefined;
  const orgName = org?.name ?? 'Unknown Organization';

  // Scope ID (optional)
  let scopeId: string | null = null;
  if (scopeName) {
    const scopeRow = db
      .prepare('SELECT id FROM scopes WHERE name = ? LIMIT 1')
      .get(scopeName) as { id: string } | undefined;
    if (scopeRow) scopeId = scopeRow.id;
  }

  // Coverage summary
  const coverage = calculateCoverage(
    (db.prepare('SELECT id FROM organizations LIMIT 1').get() as { id: string } | undefined)?.id ?? '',
    scopeId,
    db
  );

  // Filter coverage by requested catalogs
  const filteredCoverage = catalogShortNames.length > 0
    ? coverage.filter((c) => catalogShortNames.includes(c.catalogShortName))
    : coverage;

  // Implementation rows per catalog
  interface ImplRow {
    catalogShortName: string;
    control_id: string;
    status: string;
    statement: string;
  }

  const catalogFilter =
    filteredCoverage.length > 0
      ? `AND cat.short_name IN (${filteredCoverage.map(() => '?').join(', ')})`
      : '';

  const scopeFilter = scopeId ? `AND (i.scope_id = ? OR i.scope_id IS NULL)` : '';

  const sql = `
    SELECT
      cat.short_name AS catalogShortName,
      c.control_id,
      i.status,
      i.statement
    FROM implementations i
    JOIN controls c   ON i.primary_control_id = c.id
    JOIN catalogs cat ON c.catalog_id = cat.id
    ${filteredCoverage.length > 0 ? `WHERE 1=1 ${catalogFilter} ${scopeFilter}` : scopeFilter ? `WHERE 1=1 ${scopeFilter}` : ''}
    ORDER BY cat.short_name, c.sort_order, c.control_id
  `;

  const queryParams: (string | null)[] = [
    ...filteredCoverage.map((c) => c.catalogShortName),
    ...(scopeId ? [scopeId] : []),
  ];

  const implRows = db.prepare(sql).all(...queryParams) as ImplRow[];

  // Group implementations by catalog
  const implsByCatalog = new Map<string, ImplRow[]>();
  for (const row of implRows) {
    const list = implsByCatalog.get(row.catalogShortName) ?? [];
    list.push(row);
    implsByCatalog.set(row.catalogShortName, list);
  }

  // -------------------------------------------------------------------------
  // Build PDF
  // -------------------------------------------------------------------------
  const resolvedPath = path.resolve(outputPath);
  const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
  const stream = fs.createWriteStream(resolvedPath);
  doc.pipe(stream);

  let pageCount = 1;

  // -- Cover page -----------------------------------------------------------
  doc.fontSize(24).font('Helvetica-Bold').text('Compliance Summary Report', {
    align: 'center',
  });
  doc.moveDown(1);
  doc.fontSize(14).font('Helvetica').text(`Organization: ${orgName}`, { align: 'center' });
  if (scopeName) {
    doc.text(`Scope: ${scopeName}`, { align: 'center' });
  }
  doc.text(`Date: ${new Date().toLocaleDateString()}`, { align: 'center' });
  doc.moveDown(2);
  doc.fontSize(12).text(
    `This report summarizes the control implementation status across ${filteredCoverage.length} catalog(s).`,
    { align: 'center' }
  );

  // -- Coverage Summary section ---------------------------------------------
  doc.addPage();
  pageCount++;

  doc.fontSize(18).font('Helvetica-Bold').text('Coverage Summary');
  doc.moveDown(0.5);
  doc.fontSize(10).font('Helvetica');

  if (filteredCoverage.length === 0) {
    doc.text('No coverage data available.');
  } else {
    for (const cat of filteredCoverage) {
      doc
        .font('Helvetica-Bold')
        .text(cat.catalogName, { continued: false })
        .font('Helvetica')
        .text(
          `  Total: ${cat.totalControls}  |  Implemented: ${cat.implemented}  |  ` +
          `Partial: ${cat.partial}  |  N/A: ${cat.notApplicable}  |  ` +
          `Not Implemented: ${cat.notImplemented}  |  Coverage: ${cat.coveragePct}%`
        );
      doc.moveDown(0.3);
    }
  }

  // -- Implementation list section ------------------------------------------
  for (const [catalogShortName, impls] of implsByCatalog) {
    doc.addPage();
    pageCount++;

    const catName =
      filteredCoverage.find((c) => c.catalogShortName === catalogShortName)
        ?.catalogName ?? catalogShortName;

    doc.fontSize(16).font('Helvetica-Bold').text(`Implementations — ${catName}`);
    doc.moveDown(0.5);

    for (const impl of impls) {
      doc.fontSize(10).font('Helvetica-Bold').text(`[${impl.control_id}]  ${impl.status}`, {
        continued: false,
      });
      doc
        .font('Helvetica')
        .fontSize(9)
        .text(impl.statement.slice(0, 200) + (impl.statement.length > 200 ? '...' : ''));
      doc.moveDown(0.4);
    }
  }

  doc.end();

  // PDFKit is synchronous in terms of page counting — we return the count we tracked
  return { pages: pageCount };
}
