import { Router } from 'express';
import { db } from '../../db/connection.js';
import { generateUuid } from '../../utils/uuid.js';
import { now } from '../../utils/dates.js';

export function implementationRoutes(): Router {
  const router = Router();

  // GET /api/implementations?scope=X&catalog=Y&status=Z&limit=N&offset=N
  router.get('/', (req, res) => {
    const database = db.getDb();
    const scope = typeof req.query.scope === 'string' ? req.query.scope : '';
    const catalog = typeof req.query.catalog === 'string' ? req.query.catalog : '';
    const status = typeof req.query.status === 'string' ? req.query.status : '';
    const limit = Math.min(Number(req.query.limit) || 50, 500);
    const offset = Number(req.query.offset) || 0;

    const org = database.prepare('SELECT id FROM organizations LIMIT 1').get() as { id: string } | undefined;
    if (!org) {
      res.json({ implementations: [], total: 0 });
      return;
    }

    const conditions: string[] = ['i.org_id = ?'];
    const params: unknown[] = [org.id];

    if (scope) {
      conditions.push('s.name = ?');
      params.push(scope);
    }
    if (catalog) {
      conditions.push('cat.short_name = ?');
      params.push(catalog);
    }
    if (status) {
      conditions.push('i.status = ?');
      params.push(status);
    }

    const where = conditions.join(' AND ');

    const countRow = database
      .prepare(
        `SELECT COUNT(*) as total FROM implementations i
         JOIN controls c ON i.primary_control_id = c.id
         JOIN catalogs cat ON c.catalog_id = cat.id
         LEFT JOIN scopes s ON i.scope_id = s.id
         WHERE ${where}`
      )
      .get(...params) as { total: number };

    const implementations = database
      .prepare(
        `SELECT i.id, i.status, i.statement, i.responsible_role, i.responsible_person,
                i.responsibility_type, i.responsibility_note,
                i.sig_response, i.sig_additional_info, i.sig_scoring,
                i.created_at, i.updated_at,
                c.control_id, c.title AS control_title, c.description AS control_description,
                cat.short_name AS catalog_short_name, cat.name AS catalog_name,
                s.name AS scope_name
         FROM implementations i
         JOIN controls c ON i.primary_control_id = c.id
         JOIN catalogs cat ON c.catalog_id = cat.id
         LEFT JOIN scopes s ON i.scope_id = s.id
         WHERE ${where}
         ORDER BY i.updated_at DESC
         LIMIT ? OFFSET ?`
      )
      .all(...params, limit, offset);

    res.json({ implementations, total: countRow.total, limit, offset });
  });

  // POST /api/implementations
  router.post('/', (req, res) => {
    const database = db.getDb();
    const { controlId, catalogShortName, scopeName, status: implStatus, statement,
            responsibleRole, responsiblePerson, responsibilityType, responsibilityNote,
            sigResponse, sigAdditionalInfo, sigScoring } = req.body;

    if (!controlId || !catalogShortName) {
      res.status(400).json({ error: 'controlId and catalogShortName are required' });
      return;
    }

    const org = database.prepare('SELECT id FROM organizations LIMIT 1').get() as { id: string } | undefined;
    if (!org) {
      res.status(400).json({ error: 'No organization found' });
      return;
    }

    // Resolve control UUID
    const control = database
      .prepare(
        `SELECT c.id FROM controls c JOIN catalogs cat ON c.catalog_id = cat.id
         WHERE cat.short_name = ? AND c.control_id = ?`
      )
      .get(catalogShortName, controlId) as { id: string } | undefined;

    if (!control) {
      res.status(404).json({ error: `Control "${catalogShortName}:${controlId}" not found` });
      return;
    }

    // Resolve scope
    let scopeId: string | null = null;
    if (scopeName) {
      const scope = database
        .prepare('SELECT id FROM scopes WHERE name = ?')
        .get(scopeName) as { id: string } | undefined;
      scopeId = scope?.id ?? null;
    }

    const id = generateUuid();
    const timestamp = now();

    database
      .prepare(
        `INSERT INTO implementations
           (id, org_id, scope_id, primary_control_id, status, statement,
            responsible_role, responsible_person, responsibility_type, responsibility_note,
            sig_response, sig_additional_info, sig_scoring, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(id, org.id, scopeId, control.id, implStatus || 'not-implemented',
        statement || '', responsibleRole ?? null, responsiblePerson ?? null,
        responsibilityType ?? 'provider', responsibilityNote ?? null,
        sigResponse ?? null, sigAdditionalInfo ?? null, sigScoring ?? null,
        timestamp, timestamp);

    res.status(201).json({ id, created: true });
  });

  // PUT /api/implementations/:id
  router.put('/:id', (req, res) => {
    const database = db.getDb();
    const { id } = req.params;
    const { status: implStatus, statement, responsibleRole, responsiblePerson,
            responsibilityType, responsibilityNote, sigResponse, sigAdditionalInfo, sigScoring } = req.body;

    const existing = database.prepare('SELECT id FROM implementations WHERE id = ?').get(id);
    if (!existing) {
      res.status(404).json({ error: 'Implementation not found' });
      return;
    }

    const fields: string[] = ['updated_at = ?'];
    const params: unknown[] = [now()];

    if (implStatus !== undefined) { fields.push('status = ?'); params.push(implStatus); }
    if (statement !== undefined) { fields.push('statement = ?'); params.push(statement); }
    if (responsibleRole !== undefined) { fields.push('responsible_role = ?'); params.push(responsibleRole); }
    if (responsiblePerson !== undefined) { fields.push('responsible_person = ?'); params.push(responsiblePerson); }
    if (responsibilityType !== undefined) { fields.push('responsibility_type = ?'); params.push(responsibilityType); }
    if (responsibilityNote !== undefined) { fields.push('responsibility_note = ?'); params.push(responsibilityNote); }
    if (sigResponse !== undefined) { fields.push('sig_response = ?'); params.push(sigResponse); }
    if (sigAdditionalInfo !== undefined) { fields.push('sig_additional_info = ?'); params.push(sigAdditionalInfo); }
    if (sigScoring !== undefined) { fields.push('sig_scoring = ?'); params.push(sigScoring); }

    params.push(id);
    database.prepare(`UPDATE implementations SET ${fields.join(', ')} WHERE id = ?`).run(...params);

    res.json({ id, updated: true });
  });

  // GET /api/implementations/recent — last 10 changes
  router.get('/recent', (_req, res) => {
    const database = db.getDb();
    const org = database.prepare('SELECT id FROM organizations LIMIT 1').get() as { id: string } | undefined;
    if (!org) { res.json([]); return; }

    const recent = database
      .prepare(
        `SELECT i.id, i.status, i.statement, i.updated_at,
                c.control_id, cat.short_name AS catalog_short_name
         FROM implementations i
         JOIN controls c ON i.primary_control_id = c.id
         JOIN catalogs cat ON c.catalog_id = cat.id
         WHERE i.org_id = ?
         ORDER BY i.updated_at DESC LIMIT 10`
      )
      .all(org.id);

    res.json(recent);
  });

  return router;
}
