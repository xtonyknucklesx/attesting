import { Router } from 'express';
import { db } from '../../db/connection.js';
import { resolveControl } from '../../mappers/resolver.js';

export function mappingRoutes(): Router {
  const router = Router();

  // GET /api/mappings/list?source=X&target=Y
  router.get('/list', (req, res) => {
    const database = db.getDb();
    const source = typeof req.query.source === 'string' ? req.query.source : '';
    const target = typeof req.query.target === 'string' ? req.query.target : '';
    const limit = Math.min(Number(req.query.limit) || 100, 1000);

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (source) {
      conditions.push('src_cat.short_name = ?');
      params.push(source);
    }
    if (target) {
      conditions.push('tgt_cat.short_name = ?');
      params.push(target);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const mappings = database
      .prepare(
        `SELECT cm.id, cm.relationship, cm.confidence, cm.source AS mapping_source, cm.notes,
                src.control_id AS source_control_id, src_cat.short_name AS source_catalog,
                tgt.control_id AS target_control_id, tgt_cat.short_name AS target_catalog,
                src.title AS source_title, tgt.title AS target_title
         FROM control_mappings cm
         JOIN controls src ON cm.source_control_id = src.id
         JOIN catalogs src_cat ON src.catalog_id = src_cat.id
         JOIN controls tgt ON cm.target_control_id = tgt.id
         JOIN catalogs tgt_cat ON tgt.catalog_id = tgt_cat.id
         ${where}
         ORDER BY src_cat.short_name, src.control_id
         LIMIT ?`
      )
      .all(...params, limit);

    res.json(mappings);
  });

  // GET /api/mappings/resolve/:catalogShortName/:controlId
  router.get('/resolve/:catalog/:controlId', (req, res) => {
    const database = db.getDb();
    const { catalog, controlId } = req.params;
    const depth = Number(req.query.depth) || 2;

    // Look up the control UUID
    const control = database
      .prepare(
        `SELECT c.id, c.control_id, c.title, c.description, cat.short_name AS catalog_short_name
         FROM controls c
         JOIN catalogs cat ON c.catalog_id = cat.id
         WHERE cat.short_name = ? AND c.control_id = ?`
      )
      .get(catalog, controlId) as { id: string; control_id: string; title: string; description: string; catalog_short_name: string } | undefined;

    if (!control) {
      res.status(404).json({ error: `Control "${catalog}:${controlId}" not found` });
      return;
    }

    const resolved = resolveControl(control.id, database, depth);

    // Split into direct and transitive
    const direct = resolved.filter((m) => !m.isTransitive);
    const transitive = resolved.filter((m) => m.isTransitive);

    // Enrich with implementation status
    const org = database.prepare('SELECT id FROM organizations LIMIT 1').get() as { id: string } | undefined;
    const enriched = resolved.map((m) => {
      let implStatus: string | null = null;
      if (org) {
        const impl = database
          .prepare('SELECT status FROM implementations WHERE primary_control_id = ? AND org_id = ? LIMIT 1')
          .get(m.controlId, org.id) as { status: string } | undefined;
        implStatus = impl?.status ?? null;
      }
      return { ...m, implStatus };
    });

    res.json({
      control,
      direct: enriched.filter((m) => !m.isTransitive),
      transitive: enriched.filter((m) => m.isTransitive),
    });
  });

  return router;
}
