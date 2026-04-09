import { Router } from 'express';
import { db } from '../../db/connection.js';
import { generateUuid } from '../../utils/uuid.js';
import { now } from '../../utils/dates.js';

function ensureTables(d: import('better-sqlite3').Database) {
  d.exec(`
    CREATE TABLE IF NOT EXISTS risk_matrix (id TEXT PRIMARY KEY, name TEXT NOT NULL DEFAULT 'Default', likelihood_levels TEXT NOT NULL DEFAULT '["Rare","Unlikely","Possible","Likely","Almost Certain"]', impact_levels TEXT NOT NULL DEFAULT '["Negligible","Minor","Moderate","Major","Critical"]', risk_appetite TEXT DEFAULT 'moderate', appetite_threshold INTEGER DEFAULT 9, created_at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS risks (id TEXT PRIMARY KEY, risk_id TEXT NOT NULL, title TEXT NOT NULL, description TEXT, category TEXT, source TEXT, likelihood INTEGER NOT NULL, impact INTEGER NOT NULL, inherent_risk_score INTEGER, residual_likelihood INTEGER, residual_impact INTEGER, residual_risk_score INTEGER, treatment TEXT DEFAULT 'mitigate', treatment_plan TEXT, owner TEXT NOT NULL, status TEXT DEFAULT 'open', review_date TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS risk_controls (id TEXT PRIMARY KEY, risk_id TEXT NOT NULL REFERENCES risks(id) ON DELETE CASCADE, control_id TEXT NOT NULL REFERENCES controls(id) ON DELETE CASCADE, effectiveness TEXT DEFAULT 'partial', notes TEXT, UNIQUE(risk_id, control_id));
    CREATE TABLE IF NOT EXISTS risk_exceptions (id TEXT PRIMARY KEY, risk_id TEXT NOT NULL REFERENCES risks(id), control_id TEXT REFERENCES controls(id), justification TEXT NOT NULL, compensating_controls TEXT, approved_by TEXT NOT NULL, approved_date TEXT NOT NULL, expiry_date TEXT NOT NULL, status TEXT DEFAULT 'active', created_at TEXT NOT NULL DEFAULT (datetime('now')));
  `);
}

export function riskRoutes(): Router {
  const router = Router();

  // ─── Risk Register ───
  router.get('/register', (req, res) => {
    const d = db.getDb(); ensureTables(d);
    const category = typeof req.query.category === 'string' ? req.query.category : '';
    const status = typeof req.query.status === 'string' ? req.query.status : '';
    const owner = typeof req.query.owner === 'string' ? req.query.owner : '';

    let sql = `SELECT r.*, (SELECT COUNT(*) FROM risk_controls rc WHERE rc.risk_id = r.id) AS control_count FROM risks r WHERE 1=1`;
    const params: unknown[] = [];
    if (category) { sql += ' AND r.category = ?'; params.push(category); }
    if (status) { sql += ' AND r.status = ?'; params.push(status); }
    if (owner) { sql += ' AND r.owner = ?'; params.push(owner); }
    sql += ' ORDER BY r.inherent_risk_score DESC, r.risk_id';

    res.json(d.prepare(sql).all(...params));
  });

  router.post('/register', (req, res) => {
    const d = db.getDb(); ensureTables(d);
    const { risk_id: rid, title, description, category, source, likelihood, impact,
            residual_likelihood, residual_impact, treatment, treatment_plan, owner, status: st, review_date } = req.body;
    if (!title || !likelihood || !impact || !owner) {
      res.status(400).json({ error: 'title, likelihood, impact, and owner are required' }); return;
    }
    // Auto-generate risk_id if not provided
    const count = (d.prepare('SELECT COUNT(*) AS c FROM risks').get() as { c: number }).c;
    const riskId = rid || `RISK-${String(count + 1).padStart(3, '0')}`;
    const id = generateUuid();
    const ts = now();
    const iScore = Number(likelihood) * Number(impact);
    const rScore = (residual_likelihood && residual_impact) ? Number(residual_likelihood) * Number(residual_impact) : null;

    d.prepare(`INSERT INTO risks (id, risk_id, title, description, category, source, likelihood, impact,
      inherent_risk_score, residual_likelihood, residual_impact, residual_risk_score,
      treatment, treatment_plan, owner, status, review_date, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      id, riskId, title, description ?? null, category ?? null, source ?? null,
      likelihood, impact, iScore, residual_likelihood ?? null, residual_impact ?? null, rScore,
      treatment ?? 'mitigate', treatment_plan ?? null, owner, st ?? 'open', review_date ?? null, ts, ts);
    res.status(201).json({ id, risk_id: riskId });
  });

  router.get('/register/:id', (req, res) => {
    const d = db.getDb(); ensureTables(d);
    const risk = d.prepare('SELECT * FROM risks WHERE id = ?').get(req.params.id);
    if (!risk) { res.status(404).json({ error: 'Risk not found' }); return; }
    const controls = d.prepare(`
      SELECT rc.id AS link_id, rc.effectiveness, rc.notes, c.control_id, c.title, cat.short_name
      FROM risk_controls rc JOIN controls c ON rc.control_id = c.id JOIN catalogs cat ON c.catalog_id = cat.id
      WHERE rc.risk_id = ? ORDER BY cat.short_name, c.control_id
    `).all(req.params.id);
    const exceptions = d.prepare('SELECT * FROM risk_exceptions WHERE risk_id = ? ORDER BY created_at DESC')
      .all(req.params.id);
    res.json({ ...(risk as object), controls, exceptions });
  });

  router.put('/register/:id', (req, res) => {
    const d = db.getDb(); ensureTables(d);
    const fields: string[] = ['updated_at = ?']; const params: unknown[] = [now()];
    for (const k of ['title','description','category','source','likelihood','impact',
      'residual_likelihood','residual_impact','treatment','treatment_plan','owner','status','review_date']) {
      if (req.body[k] !== undefined) { fields.push(`${k} = ?`); params.push(req.body[k]); }
    }
    // Recompute scores
    if (req.body.likelihood !== undefined || req.body.impact !== undefined) {
      const existing = d.prepare('SELECT likelihood, impact FROM risks WHERE id = ?').get(req.params.id) as any;
      if (existing) {
        const l = req.body.likelihood ?? existing.likelihood;
        const i = req.body.impact ?? existing.impact;
        fields.push('inherent_risk_score = ?'); params.push(l * i);
      }
    }
    if (req.body.residual_likelihood !== undefined || req.body.residual_impact !== undefined) {
      const existing = d.prepare('SELECT residual_likelihood, residual_impact FROM risks WHERE id = ?').get(req.params.id) as any;
      if (existing) {
        const rl = req.body.residual_likelihood ?? existing.residual_likelihood;
        const ri = req.body.residual_impact ?? existing.residual_impact;
        if (rl && ri) { fields.push('residual_risk_score = ?'); params.push(rl * ri); }
      }
    }
    params.push(req.params.id);
    d.prepare(`UPDATE risks SET ${fields.join(', ')} WHERE id = ?`).run(...params);
    res.json({ id: req.params.id, updated: true });
  });

  router.delete('/register/:id', (req, res) => {
    const d = db.getDb(); ensureTables(d);
    d.prepare('DELETE FROM risks WHERE id = ?').run(req.params.id);
    res.json({ deleted: true });
  });

  router.post('/register/:id/controls', (req, res) => {
    const d = db.getDb(); ensureTables(d);
    const { controlIds, effectiveness, notes } = req.body;
    if (!Array.isArray(controlIds)) { res.status(400).json({ error: 'controlIds array required' }); return; }
    const ins = d.prepare('INSERT OR IGNORE INTO risk_controls (id, risk_id, control_id, effectiveness, notes) VALUES (?,?,?,?,?)');
    d.transaction(() => { for (const cid of controlIds) ins.run(generateUuid(), req.params.id, cid, effectiveness ?? 'partial', notes ?? null); })();
    res.json({ linked: controlIds.length });
  });

  // ─── Risk Matrix ───
  router.get('/matrix', (_req, res) => {
    const d = db.getDb(); ensureTables(d);
    let matrix = d.prepare('SELECT * FROM risk_matrix LIMIT 1').get() as any;
    if (!matrix) {
      const id = generateUuid();
      d.prepare(`INSERT INTO risk_matrix (id, name) VALUES (?, 'Default 5x5')`).run(id);
      matrix = d.prepare('SELECT * FROM risk_matrix WHERE id = ?').get(id);
    }
    // Distribution of risks across the matrix
    const risks = d.prepare('SELECT likelihood, impact, inherent_risk_score, residual_likelihood, residual_impact, residual_risk_score, status, title, risk_id FROM risks WHERE status != ?').all('closed');
    res.json({ matrix, risks });
  });

  router.put('/matrix', (req, res) => {
    const d = db.getDb(); ensureTables(d);
    const { name, likelihood_levels, impact_levels, risk_appetite, appetite_threshold } = req.body;
    const existing = d.prepare('SELECT id FROM risk_matrix LIMIT 1').get() as any;
    if (!existing) { res.status(404).json({ error: 'No matrix found' }); return; }
    const fields: string[] = []; const params: unknown[] = [];
    if (name !== undefined) { fields.push('name = ?'); params.push(name); }
    if (likelihood_levels !== undefined) { fields.push('likelihood_levels = ?'); params.push(JSON.stringify(likelihood_levels)); }
    if (impact_levels !== undefined) { fields.push('impact_levels = ?'); params.push(JSON.stringify(impact_levels)); }
    if (risk_appetite !== undefined) { fields.push('risk_appetite = ?'); params.push(risk_appetite); }
    if (appetite_threshold !== undefined) { fields.push('appetite_threshold = ?'); params.push(appetite_threshold); }
    if (fields.length > 0) {
      params.push(existing.id);
      d.prepare(`UPDATE risk_matrix SET ${fields.join(', ')} WHERE id = ?`).run(...params);
    }
    res.json({ updated: true });
  });

  // ─── Exceptions ───
  router.get('/exceptions', (_req, res) => {
    const d = db.getDb(); ensureTables(d);
    const exceptions = d.prepare(`
      SELECT e.*, r.risk_id AS risk_ref, r.title AS risk_title
      FROM risk_exceptions e JOIN risks r ON e.risk_id = r.id
      ORDER BY e.expiry_date ASC
    `).all();
    res.json(exceptions);
  });

  router.post('/exceptions', (req, res) => {
    const d = db.getDb(); ensureTables(d);
    const { risk_id, control_id, justification, compensating_controls, approved_by, approved_date, expiry_date } = req.body;
    if (!risk_id || !justification || !approved_by || !expiry_date) {
      res.status(400).json({ error: 'risk_id, justification, approved_by, expiry_date required' }); return;
    }
    const id = generateUuid();
    d.prepare(`INSERT INTO risk_exceptions (id, risk_id, control_id, justification, compensating_controls,
      approved_by, approved_date, expiry_date) VALUES (?,?,?,?,?,?,?,?)`).run(
      id, risk_id, control_id ?? null, justification, compensating_controls ?? null,
      approved_by, approved_date ?? now(), expiry_date);
    res.status(201).json({ id });
  });

  router.put('/exceptions/:id', (req, res) => {
    const d = db.getDb(); ensureTables(d);
    const fields: string[] = []; const params: unknown[] = [];
    for (const k of ['justification','compensating_controls','approved_by','expiry_date','status']) {
      if (req.body[k] !== undefined) { fields.push(`${k} = ?`); params.push(req.body[k]); }
    }
    if (fields.length === 0) { res.json({ updated: false }); return; }
    params.push(req.params.id);
    d.prepare(`UPDATE risk_exceptions SET ${fields.join(', ')} WHERE id = ?`).run(...params);
    res.json({ updated: true });
  });

  // ─── Dashboard metrics ───
  router.get('/dashboard', (_req, res) => {
    const d = db.getDb(); ensureTables(d);
    const totalOpen = (d.prepare("SELECT COUNT(*) AS c FROM risks WHERE status NOT IN ('closed')").get() as any)?.c ?? 0;
    const aboveAppetite = (d.prepare("SELECT COUNT(*) AS c FROM risks WHERE inherent_risk_score > (SELECT appetite_threshold FROM risk_matrix LIMIT 1) AND status != 'closed'").get() as any)?.c ?? 0;

    const byCategory = d.prepare("SELECT category, COUNT(*) AS count FROM risks WHERE status != 'closed' GROUP BY category ORDER BY count DESC").all();
    const byTreatment = d.prepare("SELECT treatment, COUNT(*) AS count FROM risks WHERE status != 'closed' GROUP BY treatment").all();
    const byStatus = d.prepare("SELECT status, COUNT(*) AS count FROM risks GROUP BY status").all();
    const topRisks = d.prepare("SELECT risk_id, title, inherent_risk_score, residual_risk_score, status FROM risks WHERE status != 'closed' ORDER BY inherent_risk_score DESC LIMIT 10").all();

    const activeExceptions = (d.prepare("SELECT COUNT(*) AS c FROM risk_exceptions WHERE status = 'active'").get() as any)?.c ?? 0;
    const expiringExceptions = (d.prepare("SELECT COUNT(*) AS c FROM risk_exceptions WHERE status = 'active' AND expiry_date <= date('now', '+30 days')").get() as any)?.c ?? 0;

    res.json({ totalOpen, aboveAppetite, byCategory, byTreatment, byStatus, topRisks, activeExceptions, expiringExceptions });
  });

  return router;
}
