import { Router } from 'express';
import { db } from '../../db/connection.js';
import { generateUuid } from '../../utils/uuid.js';
import { now } from '../../utils/dates.js';

export function ownerRoutes(): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json(db.getDb().prepare('SELECT * FROM owners ORDER BY name').all());
  });

  router.post('/', (req, res) => {
    const d = db.getDb();
    const { name, email, role, department, clearance_level, is_supervisor } = req.body;
    if (!name) { res.status(400).json({ error: 'name required' }); return; }
    const id = generateUuid();
    const ts = now();
    d.prepare(`
      INSERT INTO owners (id, name, email, role, department, clearance_level,
                           is_supervisor, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?)
    `).run(id, name, email ?? null, role ?? null, department ?? null,
           clearance_level ?? null, is_supervisor ? 1 : 0, ts, ts);
    res.status(201).json({ id });
  });

  router.put('/:id', (req, res) => {
    const d = db.getDb();
    const fields: string[] = ['updated_at = ?'];
    const params: unknown[] = [now()];
    for (const k of ['name','email','role','department','clearance_level','is_supervisor']) {
      if (req.body[k] !== undefined) {
        fields.push(`${k} = ?`);
        params.push(k === 'is_supervisor' ? (req.body[k] ? 1 : 0) : req.body[k]);
      }
    }
    params.push(req.params.id);
    const r = d.prepare(`UPDATE owners SET ${fields.join(', ')} WHERE id = ?`).run(...params);
    if (r.changes === 0) { res.status(404).json({ error: 'Not found' }); return; }
    res.json({ id: req.params.id, updated: true });
  });

  router.delete('/:id', (req, res) => {
    db.getDb().prepare('DELETE FROM owners WHERE id = ?').run(req.params.id);
    res.json({ deleted: true });
  });

  return router;
}
