import { Router } from 'express';
import { db } from '../../db/connection.js';
import { generateUuid } from '../../utils/uuid.js';
import { now } from '../../utils/dates.js';
import { propagate } from '../../services/propagation/dispatcher.js';

export function assetRoutes(): Router {
  const router = Router();

  router.get('/', (req, res) => {
    const d = db.getDb();
    const type = typeof req.query.type === 'string' ? req.query.type : '';
    const status = typeof req.query.status === 'string' ? req.query.status : '';
    const classification = typeof req.query.classification === 'string' ? req.query.classification : '';

    let sql = 'SELECT a.*, o.name AS owner_name FROM assets a LEFT JOIN owners o ON a.owner_id = o.id WHERE 1=1';
    const params: unknown[] = [];
    if (type) { sql += ' AND a.asset_type = ?'; params.push(type); }
    if (status) { sql += ' AND a.status = ?'; params.push(status); }
    if (classification) { sql += ' AND a.data_classification = ?'; params.push(classification); }
    sql += ' ORDER BY a.name';

    res.json(d.prepare(sql).all(...params));
  });

  router.post('/', (req, res) => {
    const d = db.getDb();
    const { name, asset_type, platform, os_version, data_classification,
            boundary_id, owner_id, criticality, status: st, metadata } = req.body;
    if (!name || !asset_type) {
      res.status(400).json({ error: 'name and asset_type are required' });
      return;
    }
    const id = generateUuid();
    const ts = now();

    d.prepare(`
      INSERT INTO assets (id, name, asset_type, platform, os_version,
        data_classification, boundary_id, owner_id, criticality, status,
        metadata, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(id, name, asset_type, platform ?? null, os_version ?? null,
           data_classification ?? 'unclassified', boundary_id ?? null,
           owner_id ?? null, criticality ?? 'medium', st ?? 'active',
           metadata ? JSON.stringify(metadata) : null, ts, ts);

    res.status(201).json({ id });
  });

  router.get('/:id', (req, res) => {
    const d = db.getDb();
    const asset = d.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
    if (!asset) { res.status(404).json({ error: 'Not found' }); return; }

    const threats = d.prepare(`
      SELECT tac.match_type, tac.match_detail, tac.correlated_at,
             t.id AS threat_id, t.title, t.severity, t.cve_id
      FROM threat_asset_correlations tac
      JOIN threat_inputs t ON tac.threat_id = t.id
      WHERE tac.asset_id = ?
      ORDER BY tac.correlated_at DESC
    `).all(req.params.id);

    const risks = d.prepare(`
      SELECT r.id, r.risk_id, r.title, r.inherent_risk_score, r.status
      FROM risk_asset_links ral
      JOIN risks r ON ral.risk_id = r.id
      WHERE ral.asset_id = ?
    `).all(req.params.id);

    res.json({ ...(asset as object), threats, risks });
  });

  router.put('/:id', (req, res) => {
    const d = db.getDb();
    const prev = d.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id) as any;
    if (!prev) { res.status(404).json({ error: 'Not found' }); return; }

    const fields: string[] = ['updated_at = ?'];
    const params: unknown[] = [now()];
    for (const k of ['name','asset_type','platform','os_version','data_classification',
      'boundary_id','owner_id','criticality','status','metadata','last_scanned']) {
      if (req.body[k] !== undefined) { fields.push(`${k} = ?`); params.push(req.body[k]); }
    }
    params.push(req.params.id);
    d.prepare(`UPDATE assets SET ${fields.join(', ')} WHERE id = ?`).run(...params);

    const next = d.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
    propagate(d, 'asset', req.params.id, 'update',
      { type: 'user', id: 'api' }, prev, next);

    res.json({ id: req.params.id, updated: true });
  });

  router.delete('/:id', (req, res) => {
    const d = db.getDb();
    d.prepare('DELETE FROM assets WHERE id = ?').run(req.params.id);
    res.json({ deleted: true });
  });

  // ─── Dashboard ───
  router.get('/dashboard/summary', (_req, res) => {
    const d = db.getDb();
    const total = (d.prepare("SELECT COUNT(*) AS c FROM assets WHERE status = 'active'").get() as any)?.c ?? 0;
    const byType = d.prepare("SELECT asset_type, COUNT(*) AS count FROM assets WHERE status = 'active' GROUP BY asset_type ORDER BY count DESC").all();
    const byClassification = d.prepare("SELECT data_classification, COUNT(*) AS count FROM assets WHERE status = 'active' GROUP BY data_classification").all();
    const byCriticality = d.prepare("SELECT criticality, COUNT(*) AS count FROM assets WHERE status = 'active' GROUP BY criticality").all();
    const withThreats = (d.prepare("SELECT COUNT(DISTINCT asset_id) AS c FROM threat_asset_correlations").get() as any)?.c ?? 0;

    res.json({ total, byType, byClassification, byCriticality, withThreats });
  });

  return router;
}
