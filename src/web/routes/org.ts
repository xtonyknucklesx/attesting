import { Router } from 'express';
import { db } from '../../db/connection.js';

export function orgRoutes(): Router {
  const router = Router();

  // GET /api/org — org profile + scopes
  router.get('/', (_req, res) => {
    const database = db.getDb();

    const org = database
      .prepare('SELECT id, name, description, cage_code, created_at FROM organizations LIMIT 1')
      .get();

    const scopes = database
      .prepare('SELECT id, name, description, scope_type, created_at FROM scopes ORDER BY name')
      .all();

    res.json({ org: org ?? null, scopes });
  });

  return router;
}
