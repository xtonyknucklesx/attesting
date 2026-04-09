import { Router } from 'express';
import { db } from '../../db/connection.js';
import { resolveDriftAlert } from '../../services/drift/alert-writer.js';
import {
  processDispositionInput,
  commitDisposition,
  approveDisposition,
  rejectDisposition,
} from '../../services/disposition/approval.js';

export function driftRoutes(): Router {
  const router = Router();

  // ─── Drift alerts ───
  router.get('/alerts', (req, res) => {
    const d = db.getDb();
    const status = typeof req.query.status === 'string' ? req.query.status : 'active';
    const severity = typeof req.query.severity === 'string' ? req.query.severity : '';

    let sql: string;
    const params: unknown[] = [];

    if (status === 'active') {
      sql = `SELECT * FROM drift_alerts
             WHERE resolved_at IS NULL
             AND (suppressed_until IS NULL OR suppressed_until < datetime('now'))`;
    } else if (status === 'resolved') {
      sql = 'SELECT * FROM drift_alerts WHERE resolved_at IS NOT NULL';
    } else if (status === 'suppressed') {
      sql = `SELECT * FROM drift_alerts WHERE suppressed_until IS NOT NULL AND suppressed_until >= datetime('now')`;
    } else {
      sql = 'SELECT * FROM drift_alerts WHERE 1=1';
    }

    if (severity) { sql += ' AND severity = ?'; params.push(severity); }
    sql += ` ORDER BY
      CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2
           WHEN 'medium' THEN 3 WHEN 'low' THEN 4 ELSE 5 END,
      detected_at DESC`;

    res.json(d.prepare(sql).all(...params));
  });

  router.get('/alerts/:id', (req, res) => {
    const d = db.getDb();
    const alert = d.prepare('SELECT * FROM drift_alerts WHERE id = ?').get(req.params.id);
    if (!alert) { res.status(404).json({ error: 'Not found' }); return; }

    const dispositions = d.prepare(`
      SELECT d.*, o.name AS analyst_name, s.name AS supervisor_name
      FROM dispositions d
      LEFT JOIN owners o ON d.analyst_id = o.id
      LEFT JOIN owners s ON d.supervisor_id = s.id
      WHERE d.drift_alert_id = ?
      ORDER BY d.created_at DESC
    `).all(req.params.id);

    res.json({ ...(alert as object), dispositions });
  });

  router.post('/alerts/:id/resolve', (req, res) => {
    const d = db.getDb();
    const { resolved_by, note } = req.body;
    resolveDriftAlert(d, req.params.id, resolved_by ?? 'manual', note);
    res.json({ resolved: true });
  });

  // ─── Dashboard stats ───
  router.get('/dashboard', (_req, res) => {
    const d = db.getDb();

    const active = (d.prepare(`
      SELECT COUNT(*) AS c FROM drift_alerts
      WHERE resolved_at IS NULL
      AND (suppressed_until IS NULL OR suppressed_until < datetime('now'))
    `).get() as any)?.c ?? 0;

    const bySeverity = d.prepare(`
      SELECT severity, COUNT(*) AS count FROM drift_alerts
      WHERE resolved_at IS NULL
      AND (suppressed_until IS NULL OR suppressed_until < datetime('now'))
      GROUP BY severity
    `).all();

    const byType = d.prepare(`
      SELECT alert_type, COUNT(*) AS count FROM drift_alerts
      WHERE resolved_at IS NULL
      AND (suppressed_until IS NULL OR suppressed_until < datetime('now'))
      GROUP BY alert_type ORDER BY count DESC
    `).all();

    const pendingApprovals = (d.prepare(`
      SELECT COUNT(*) AS c FROM dispositions WHERE approval_status = 'pending'
    `).get() as any)?.c ?? 0;

    res.json({ active, bySeverity, byType, pendingApprovals });
  });

  // ─── Dispositions ───
  router.post('/dispositions', (req, res) => {
    const d = db.getDb();
    const { drift_alert_id, analyst_id, text } = req.body;
    if (!drift_alert_id || !analyst_id || !text) {
      res.status(400).json({ error: 'drift_alert_id, analyst_id, and text are required' });
      return;
    }

    try {
      const processed = processDispositionInput(d, drift_alert_id, analyst_id, text);
      res.json(processed);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/dispositions/commit', (req, res) => {
    const d = db.getDb();
    try {
      const result = commitDisposition(d, req.body);
      res.status(201).json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/dispositions/:id/approve', (req, res) => {
    const d = db.getDb();
    try {
      approveDisposition(d, req.params.id, req.body.supervisor_id, req.body.note);
      res.json({ approved: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/dispositions/:id/reject', (req, res) => {
    const d = db.getDb();
    try {
      rejectDisposition(d, req.params.id, req.body.supervisor_id, req.body.note);
      res.json({ rejected: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  router.get('/dispositions/pending', (_req, res) => {
    const d = db.getDb();
    res.json(d.prepare(`
      SELECT d.*, da.title AS alert_title, da.severity AS alert_severity,
             o.name AS analyst_name
      FROM dispositions d
      JOIN drift_alerts da ON d.drift_alert_id = da.id
      LEFT JOIN owners o ON d.analyst_id = o.id
      WHERE d.approval_status = 'pending'
      ORDER BY da.severity, d.created_at DESC
    `).all());
  });

  return router;
}
