import { Router } from 'express';
import { db } from '../../db/connection.js';

export function catalogRoutes(): Router {
  const router = Router();

  // GET /api/catalogs — list all catalogs
  router.get('/', (_req, res) => {
    const database = db.getDb();
    const catalogs = database
      .prepare(
        `SELECT id, name, short_name, version, publisher, source_format, total_controls, created_at
         FROM catalogs ORDER BY name`
      )
      .all();
    res.json(catalogs);
  });

  // GET /api/catalogs/:shortName — catalog with controls
  router.get('/:shortName', (req, res) => {
    const database = db.getDb();
    const catalog = database
      .prepare('SELECT * FROM catalogs WHERE short_name = ?')
      .get(req.params.shortName);

    if (!catalog) {
      res.status(404).json({ error: `Catalog "${req.params.shortName}" not found` });
      return;
    }

    res.json(catalog);
  });

  // GET /api/catalogs/:shortName/controls — paginated controls
  router.get('/:shortName/controls', (req, res) => {
    const database = db.getDb();
    const { shortName } = req.params;
    const limit = Math.min(Number(req.query.limit) || 50, 500);
    const offset = Number(req.query.offset) || 0;
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const status = typeof req.query.status === 'string' ? req.query.status : '';

    const catalog = database
      .prepare('SELECT id FROM catalogs WHERE short_name = ?')
      .get(shortName) as { id: string } | undefined;

    if (!catalog) {
      res.status(404).json({ error: `Catalog "${shortName}" not found` });
      return;
    }

    // Get org for implementation status
    const org = database
      .prepare('SELECT id FROM organizations LIMIT 1')
      .get() as { id: string } | undefined;

    let sql: string;
    const params: unknown[] = [];

    if (search) {
      // FTS5 search
      sql = `
        SELECT c.id, c.control_id, c.title, c.description, c.metadata,
               c.sig_risk_domain, c.sig_control_family, c.sort_order,
               i.status AS impl_status,
               (SELECT COUNT(*) FROM control_mappings cm
                WHERE cm.source_control_id = c.id OR cm.target_control_id = c.id) AS mapping_count
        FROM controls c
        JOIN controls_fts fts ON c.rowid = fts.rowid
        LEFT JOIN implementations i ON i.primary_control_id = c.id ${org ? "AND i.org_id = '" + org.id + "'" : ''}
        WHERE c.catalog_id = ? AND controls_fts MATCH ?
      `;
      params.push(catalog.id, search);
    } else {
      sql = `
        SELECT c.id, c.control_id, c.title, c.description, c.metadata,
               c.sig_risk_domain, c.sig_control_family, c.sort_order,
               i.status AS impl_status,
               (SELECT COUNT(*) FROM control_mappings cm
                WHERE cm.source_control_id = c.id OR cm.target_control_id = c.id) AS mapping_count
        FROM controls c
        LEFT JOIN implementations i ON i.primary_control_id = c.id ${org ? "AND i.org_id = '" + org.id + "'" : ''}
        WHERE c.catalog_id = ?
      `;
      params.push(catalog.id);
    }

    if (status) {
      if (status === 'not-implemented') {
        sql += ' AND (i.status IS NULL OR i.status = ?)';
        params.push(status);
      } else {
        sql += ' AND i.status = ?';
        params.push(status);
      }
    }

    // Count total
    const countSql = `SELECT COUNT(*) as total FROM (${sql})`;
    const totalRow = database.prepare(countSql).get(...params) as { total: number };

    sql += ' ORDER BY c.sort_order, c.control_id LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const controls = database.prepare(sql).all(...params);

    res.json({
      controls,
      total: totalRow.total,
      limit,
      offset,
    });
  });

  return router;
}
