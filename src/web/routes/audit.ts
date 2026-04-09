import { Router } from 'express';
import { db } from '../../db/connection.js';

export function auditRoutes(): Router {
  const router = Router();

  router.get('/', (req, res) => {
    const d = db.getDb();
    const entity_type = typeof req.query.entity_type === 'string' ? req.query.entity_type : '';
    const entity_id = typeof req.query.entity_id === 'string' ? req.query.entity_id : '';
    const action = typeof req.query.action === 'string' ? req.query.action : '';
    const limit = Math.min(500, Number(req.query.limit) || 50);

    let sql = 'SELECT * FROM audit_log WHERE 1=1';
    const params: unknown[] = [];
    if (entity_type) { sql += ' AND entity_type = ?'; params.push(entity_type); }
    if (entity_id) { sql += ' AND entity_id = ?'; params.push(entity_id); }
    if (action) { sql += ' AND action = ?'; params.push(action); }
    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    res.json(d.prepare(sql).all(...params));
  });

  router.get('/entity/:type/:id', (req, res) => {
    const d = db.getDb();
    res.json(d.prepare(
      'SELECT * FROM audit_log WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC LIMIT 100'
    ).all(req.params.type, req.params.id));
  });

  return router;
}
