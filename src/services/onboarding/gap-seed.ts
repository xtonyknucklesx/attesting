import type Database from 'better-sqlite3';
import { generateUuid } from '../../utils/uuid.js';

/**
 * Auto-generates initial risks from framework gap analysis.
 * Finds control families with zero implementations and creates
 * a risk entry for each uncovered family.
 */
export function seedRisksFromGaps(
  db: Database.Database,
  catalogShortNames: string[],
): string[] {
  const riskIds: string[] = [];

  for (const shortName of catalogShortNames) {
    const catalog = db.prepare(
      'SELECT id, name FROM catalogs WHERE short_name = ?'
    ).get(shortName) as { id: string; name: string } | undefined;

    if (!catalog) continue;

    // Find control families with no implementations
    const families = db.prepare(`
      SELECT COALESCE(c.sig_control_family, c.metadata, 'General') AS family,
             COUNT(*) AS total_controls,
             SUM(CASE WHEN i.id IS NOT NULL THEN 1 ELSE 0 END) AS implemented
      FROM controls c
      LEFT JOIN implementations i ON i.primary_control_id = c.id
        AND i.status IN ('implemented', 'partially-implemented')
      WHERE c.catalog_id = ?
      GROUP BY family
      HAVING implemented = 0 AND total_controls > 0
    `).all(catalog.id) as Array<{ family: string; total_controls: number }>;

    for (const fam of families) {
      const familyName = fam.family === '{}' ? 'General' : fam.family;
      const count = (db.prepare('SELECT COUNT(*) AS c FROM risks').get() as { c: number }).c;
      const riskRef = `RISK-${String(count + riskIds.length + 1).padStart(3, '0')}`;
      const id = generateUuid();

      db.prepare(`
        INSERT INTO risks (id, risk_id, title, description, category, source,
          likelihood, impact, inherent_risk_score, treatment, owner, status,
          source_type, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'compliance', ?, 3, 3, 9, 'mitigate', 'Unassigned', 'open',
          'control_gap', datetime('now'), datetime('now'))
      `).run(
        id, riskRef,
        `Uncovered control family: ${familyName}`,
        `${fam.total_controls} controls in ${familyName} (${catalog.name}) have no implementation statements.`,
        `gap-analysis:${shortName}`,
      );

      riskIds.push(id);
    }
  }

  return riskIds;
}
