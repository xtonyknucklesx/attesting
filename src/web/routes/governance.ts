import { Router } from 'express';
import { db } from '../../db/connection.js';
import { generateUuid } from '../../utils/uuid.js';
import { now } from '../../utils/dates.js';

function ensureTables(d: import('better-sqlite3').Database) {
  d.exec(`
    CREATE TABLE IF NOT EXISTS policies (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT, policy_type TEXT DEFAULT 'policy', status TEXT DEFAULT 'draft', version TEXT, owner TEXT, approver TEXT, approved_date TEXT, effective_date TEXT, review_date TEXT, expiry_date TEXT, review_frequency_days INTEGER DEFAULT 365, document_path TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS policy_controls (id TEXT PRIMARY KEY, policy_id TEXT NOT NULL REFERENCES policies(id) ON DELETE CASCADE, control_id TEXT NOT NULL REFERENCES controls(id) ON DELETE CASCADE, notes TEXT, UNIQUE(policy_id, control_id));
    CREATE TABLE IF NOT EXISTS committees (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, meeting_frequency TEXT, chair TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS committee_meetings (id TEXT PRIMARY KEY, committee_id TEXT NOT NULL REFERENCES committees(id) ON DELETE CASCADE, meeting_date TEXT NOT NULL, attendees TEXT, agenda TEXT, minutes TEXT, action_items TEXT, status TEXT DEFAULT 'scheduled', created_at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS roles_register (id TEXT PRIMARY KEY, role_title TEXT NOT NULL, description TEXT, current_holder TEXT, appointed_date TEXT, appointment_authority TEXT, backup_holder TEXT, regulatory_requirement TEXT, replacement_timeline TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
  `);
}

export function governanceRoutes(): Router {
  const router = Router();

  // ─── Policies ───
  router.get('/policies', (_req, res) => {
    const d = db.getDb(); ensureTables(d);
    const policies = d.prepare(`
      SELECT p.*, (SELECT COUNT(*) FROM policy_controls pc WHERE pc.policy_id = p.id) AS control_count
      FROM policies p ORDER BY p.updated_at DESC
    `).all();
    res.json(policies);
  });

  router.post('/policies', (req, res) => {
    const d = db.getDb(); ensureTables(d);
    const { title, description, policy_type, status: st, version, owner, approver,
            approved_date, effective_date, review_date, expiry_date, review_frequency_days, document_path } = req.body;
    if (!title) { res.status(400).json({ error: 'title is required' }); return; }
    const id = generateUuid();
    const ts = now();
    d.prepare(`INSERT INTO policies (id, title, description, policy_type, status, version, owner, approver,
      approved_date, effective_date, review_date, expiry_date, review_frequency_days, document_path, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      id, title, description ?? null, policy_type ?? 'policy', st ?? 'draft', version ?? null,
      owner ?? null, approver ?? null, approved_date ?? null, effective_date ?? null,
      review_date ?? null, expiry_date ?? null, review_frequency_days ?? 365, document_path ?? null, ts, ts);
    res.status(201).json({ id });
  });

  router.get('/policies/:id', (req, res) => {
    const d = db.getDb(); ensureTables(d);
    const policy = d.prepare('SELECT * FROM policies WHERE id = ?').get(req.params.id);
    if (!policy) { res.status(404).json({ error: 'Policy not found' }); return; }
    const controls = d.prepare(`
      SELECT pc.id AS link_id, pc.notes, c.control_id, c.title, cat.short_name AS catalog_short_name
      FROM policy_controls pc JOIN controls c ON pc.control_id = c.id JOIN catalogs cat ON c.catalog_id = cat.id
      WHERE pc.policy_id = ? ORDER BY cat.short_name, c.control_id
    `).all(req.params.id);
    res.json({ ...(policy as object), controls });
  });

  router.put('/policies/:id', (req, res) => {
    const d = db.getDb(); ensureTables(d);
    const fields: string[] = ['updated_at = ?']; const params: unknown[] = [now()];
    for (const k of ['title','description','policy_type','status','version','owner','approver',
      'approved_date','effective_date','review_date','expiry_date','review_frequency_days','document_path']) {
      if (req.body[k] !== undefined) { fields.push(`${k} = ?`); params.push(req.body[k]); }
    }
    params.push(req.params.id);
    const r = d.prepare(`UPDATE policies SET ${fields.join(', ')} WHERE id = ?`).run(...params);
    if (r.changes === 0) { res.status(404).json({ error: 'Policy not found' }); return; }
    res.json({ id: req.params.id, updated: true });
  });

  router.delete('/policies/:id', (req, res) => {
    const d = db.getDb(); ensureTables(d);
    d.prepare('DELETE FROM policies WHERE id = ?').run(req.params.id);
    res.json({ deleted: true });
  });

  router.post('/policies/:id/controls', (req, res) => {
    const d = db.getDb(); ensureTables(d);
    const { controlIds, notes } = req.body;
    if (!Array.isArray(controlIds)) { res.status(400).json({ error: 'controlIds array required' }); return; }
    const ins = d.prepare('INSERT OR IGNORE INTO policy_controls (id, policy_id, control_id, notes) VALUES (?,?,?,?)');
    const run = d.transaction(() => {
      for (const cid of controlIds) ins.run(generateUuid(), req.params.id, cid, notes ?? null);
    });
    run();
    res.json({ linked: controlIds.length });
  });

  // ─── Committees ───
  router.get('/committees', (_req, res) => {
    const d = db.getDb(); ensureTables(d);
    const committees = d.prepare(`
      SELECT c.*, (SELECT COUNT(*) FROM committee_meetings m WHERE m.committee_id = c.id) AS meeting_count,
        (SELECT m.meeting_date FROM committee_meetings m WHERE m.committee_id = c.id AND m.status = 'scheduled' ORDER BY m.meeting_date ASC LIMIT 1) AS next_meeting
      FROM committees c ORDER BY c.name
    `).all();
    res.json(committees);
  });

  router.post('/committees', (req, res) => {
    const d = db.getDb(); ensureTables(d);
    const { name, description, meeting_frequency, chair } = req.body;
    if (!name) { res.status(400).json({ error: 'name required' }); return; }
    const id = generateUuid();
    d.prepare('INSERT INTO committees (id, name, description, meeting_frequency, chair) VALUES (?,?,?,?,?)')
      .run(id, name, description ?? null, meeting_frequency ?? null, chair ?? null);
    res.status(201).json({ id });
  });

  router.get('/committees/:id/meetings', (req, res) => {
    const d = db.getDb(); ensureTables(d);
    const meetings = d.prepare('SELECT * FROM committee_meetings WHERE committee_id = ? ORDER BY meeting_date DESC')
      .all(req.params.id);
    res.json(meetings);
  });

  router.post('/committees/:id/meetings', (req, res) => {
    const d = db.getDb(); ensureTables(d);
    const { meeting_date, attendees, agenda, minutes, action_items, status: st } = req.body;
    if (!meeting_date) { res.status(400).json({ error: 'meeting_date required' }); return; }
    const id = generateUuid();
    d.prepare('INSERT INTO committee_meetings (id, committee_id, meeting_date, attendees, agenda, minutes, action_items, status) VALUES (?,?,?,?,?,?,?,?)')
      .run(id, req.params.id, meeting_date, attendees ? JSON.stringify(attendees) : null,
        agenda ?? null, minutes ?? null, action_items ? JSON.stringify(action_items) : null, st ?? 'scheduled');
    res.status(201).json({ id });
  });

  // ─── Roles ───
  router.get('/roles', (_req, res) => {
    const d = db.getDb(); ensureTables(d);
    res.json(d.prepare('SELECT * FROM roles_register ORDER BY role_title').all());
  });

  router.post('/roles', (req, res) => {
    const d = db.getDb(); ensureTables(d);
    const { role_title, description, current_holder, appointed_date, appointment_authority,
            backup_holder, regulatory_requirement, replacement_timeline } = req.body;
    if (!role_title) { res.status(400).json({ error: 'role_title required' }); return; }
    const id = generateUuid();
    const ts = now();
    d.prepare(`INSERT INTO roles_register (id, role_title, description, current_holder, appointed_date,
      appointment_authority, backup_holder, regulatory_requirement, replacement_timeline, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(
      id, role_title, description ?? null, current_holder ?? null, appointed_date ?? null,
      appointment_authority ?? null, backup_holder ?? null, regulatory_requirement ?? null,
      replacement_timeline ?? null, ts, ts);
    res.status(201).json({ id });
  });

  router.put('/roles/:id', (req, res) => {
    const d = db.getDb(); ensureTables(d);
    const fields: string[] = ['updated_at = ?']; const params: unknown[] = [now()];
    for (const k of ['role_title','description','current_holder','appointed_date',
      'appointment_authority','backup_holder','regulatory_requirement','replacement_timeline']) {
      if (req.body[k] !== undefined) { fields.push(`${k} = ?`); params.push(req.body[k]); }
    }
    params.push(req.params.id);
    d.prepare(`UPDATE roles_register SET ${fields.join(', ')} WHERE id = ?`).run(...params);
    res.json({ id: req.params.id, updated: true });
  });

  return router;
}
