import { Router } from 'express';
import { db } from '../../db/connection.js';

export function watchRoutes(): Router {
  const router = Router();

  // GET /api/watches — list all watched sources
  router.get('/', (_req, res) => {
    const database = db.getDb();

    // Ensure table exists
    database.exec(`
      CREATE TABLE IF NOT EXISTS catalog_watches (
        id TEXT PRIMARY KEY,
        catalog_short_name TEXT NOT NULL,
        source_url TEXT NOT NULL,
        source_format TEXT NOT NULL DEFAULT 'oscal',
        last_hash TEXT,
        last_checked_at TEXT,
        last_changed_at TEXT,
        auto_download INTEGER DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    const watches = database
      .prepare('SELECT * FROM catalog_watches ORDER BY catalog_short_name')
      .all();

    res.json(watches);
  });

  return router;
}
