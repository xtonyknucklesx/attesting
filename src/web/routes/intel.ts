import { Router } from 'express';
import { db } from '../../db/connection.js';
import { submitManualIntel, promoteManualIntel, archiveManualIntel } from '../../services/intel/manual-intel.js';
import { generateShadowImpact } from '../../services/intel/shadow-analysis.js';

export function intelRoutes(): Router {
  const router = Router();

  // ─── Threat inputs ───
  router.get('/threats', (req, res) => {
    const d = db.getDb();
    const severity = typeof req.query.severity === 'string' ? req.query.severity : '';
    const processed = req.query.processed;

    let sql = 'SELECT * FROM threat_inputs WHERE 1=1';
    const params: unknown[] = [];
    if (severity) { sql += ' AND severity = ?'; params.push(severity); }
    if (processed !== undefined) { sql += ' AND processed = ?'; params.push(processed === 'true' ? 1 : 0); }
    sql += ' ORDER BY ingested_at DESC LIMIT 100';

    res.json(d.prepare(sql).all(...params));
  });

  router.get('/threats/:id', (req, res) => {
    const d = db.getDb();
    const threat = d.prepare('SELECT * FROM threat_inputs WHERE id = ?').get(req.params.id);
    if (!threat) { res.status(404).json({ error: 'Not found' }); return; }

    const correlations = d.prepare(`
      SELECT tac.*, a.name AS asset_name, a.platform
      FROM threat_asset_correlations tac
      JOIN assets a ON tac.asset_id = a.id
      WHERE tac.threat_id = ?
    `).all(req.params.id);

    const risks = d.prepare(`
      SELECT r.id, r.risk_id, r.title, r.inherent_risk_score, r.status
      FROM threat_risk_links trl
      JOIN risks r ON trl.risk_id = r.id
      WHERE trl.threat_id = ?
    `).all(req.params.id);

    res.json({ ...(threat as object), correlations, risks });
  });

  // ─── Manual intel (whisper channel) ───
  router.get('/manual', (_req, res) => {
    const d = db.getDb();
    res.json(d.prepare(`
      SELECT mi.*, o.name AS submitted_by_name
      FROM manual_intel mi
      LEFT JOIN owners o ON mi.submitted_by = o.id
      ORDER BY
        CASE mi.severity_estimate WHEN 'critical' THEN 1 WHEN 'high' THEN 2
             WHEN 'medium' THEN 3 WHEN 'low' THEN 4 ELSE 5 END,
        mi.created_at DESC
    `).all());
  });

  router.post('/manual', (req, res) => {
    const d = db.getDb();
    try {
      const result = submitManualIntel(d, req.body);
      res.status(201).json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  router.get('/manual/:id', (req, res) => {
    const d = db.getDb();
    const intel = d.prepare('SELECT * FROM manual_intel WHERE id = ?').get(req.params.id);
    if (!intel) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(intel);
  });

  router.get('/manual/:id/shadow', (req, res) => {
    const d = db.getDb();
    try {
      const result = generateShadowImpact(d, req.params.id);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/manual/:id/promote', (req, res) => {
    const d = db.getDb();
    try {
      const result = promoteManualIntel(d, req.params.id, req.body);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/manual/:id/archive', (req, res) => {
    const d = db.getDb();
    archiveManualIntel(d, req.params.id, req.body.reason ?? 'manual');
    res.json({ archived: true });
  });

  return router;
}
