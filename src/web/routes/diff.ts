import { Router } from 'express';
import { db } from '../../db/connection.js';
import { diffCatalogs } from '../../mappers/diff.js';

export function diffRoutes(): Router {
  const router = Router();

  // POST /api/diff — run a diff between two catalogs
  router.post('/', (req, res) => {
    const database = db.getDb();
    const { old: oldShortName, new: newShortName } = req.body;

    if (!oldShortName || !newShortName) {
      res.status(400).json({ error: '"old" and "new" catalog short names are required' });
      return;
    }

    // Validate both exist
    for (const sn of [oldShortName, newShortName]) {
      const cat = database.prepare('SELECT id FROM catalogs WHERE short_name = ?').get(sn);
      if (!cat) {
        res.status(404).json({ error: `Catalog "${sn}" not found` });
        return;
      }
    }

    const org = database
      .prepare('SELECT id FROM organizations LIMIT 1')
      .get() as { id: string } | undefined;

    const result = diffCatalogs(oldShortName, newShortName, database, org?.id);

    res.json(result);
  });

  return router;
}
