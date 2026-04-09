import { Router } from 'express';
import { db } from '../../db/connection.js';
import { calculateCoverage } from '../../mappers/coverage.js';

export function coverageRoutes(): Router {
  const router = Router();

  // GET /api/coverage — coverage for all catalogs
  // GET /api/coverage/:scopeName — coverage for a specific scope
  router.get('/', handleCoverage);
  router.get('/:scopeName', handleCoverage);

  function handleCoverage(req: any, res: any) {
    const database = db.getDb();
    const scopeName = req.params.scopeName as string | undefined;

    const org = database
      .prepare('SELECT id FROM organizations LIMIT 1')
      .get() as { id: string } | undefined;

    if (!org) {
      res.json([]);
      return;
    }

    let scopeId: string | null = null;
    if (scopeName) {
      const scope = database
        .prepare('SELECT id FROM scopes WHERE name = ?')
        .get(scopeName) as { id: string } | undefined;
      if (!scope) {
        res.status(404).json({ error: `Scope "${scopeName}" not found` });
        return;
      }
      scopeId = scope.id;
    }

    const coverage = calculateCoverage(org.id, scopeId, database);

    // Enrich with control family breakdown for framework grid
    const enriched = coverage.map((c) => {
      const families = database
        .prepare(
          `SELECT
             COALESCE(c.sig_risk_domain, SUBSTR(c.control_id, 1, 2)) AS family,
             COUNT(DISTINCT c.id) AS total,
             COUNT(DISTINCT CASE WHEN i.status = 'implemented' THEN c.id END) AS implemented,
             COUNT(DISTINCT CASE WHEN i.status = 'not-applicable' THEN c.id END) AS not_applicable
           FROM controls c
           JOIN catalogs cat ON c.catalog_id = cat.id
           LEFT JOIN implementations i ON i.primary_control_id = c.id AND i.org_id = ?
           WHERE cat.short_name = ?
           GROUP BY family
           ORDER BY family`
        )
        .all(org.id, c.catalogShortName);

      return { ...c, families };
    });

    res.json(enriched);
  }

  return router;
}
