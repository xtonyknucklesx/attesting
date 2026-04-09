import { Router } from 'express';
import { db } from '../../db/connection.js';
import { generateUuid } from '../../utils/uuid.js';
import { now } from '../../utils/dates.js';
import { AdapterRegistry } from '../../services/connectors/registry.js';

const registry = new AdapterRegistry();

export function connectorRoutes(): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    const d = db.getDb();
    res.json(d.prepare(`
      SELECT c.*,
        (SELECT COUNT(*) FROM connector_sync_log csl
         WHERE csl.connector_id = c.id AND csl.status = 'failed'
         AND csl.started_at > datetime('now', '-24 hours')) AS failures_24h,
        (SELECT COUNT(*) FROM connector_sync_log csl
         WHERE csl.connector_id = c.id
         AND csl.started_at > datetime('now', '-24 hours')) AS syncs_24h
      FROM connectors c ORDER BY c.name
    `).all());
  });

  router.post('/', (req, res) => {
    const d = db.getDb();
    const { name, connector_type, direction, target_module, adapter_class,
            config, auth_method, sync_mode, sync_interval } = req.body;
    if (!name || !connector_type || !adapter_class) {
      res.status(400).json({ error: 'name, connector_type, adapter_class required' });
      return;
    }

    const id = generateUuid();
    const ts = now();
    d.prepare(`
      INSERT INTO connectors (id, name, connector_type, direction, target_module,
        adapter_class, config, auth_method, sync_mode, sync_interval,
        is_enabled, health_status, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,1,'unknown',?,?)
    `).run(id, name, connector_type, direction ?? 'inbound',
           target_module ?? 'multi', adapter_class,
           config ? JSON.stringify(config) : null,
           auth_method ?? 'api_key', sync_mode ?? 'manual',
           sync_interval ?? null, ts, ts);
    res.status(201).json({ id });
  });

  router.post('/:id/sync', async (req, res) => {
    const d = db.getDb();
    const connector = d.prepare('SELECT * FROM connectors WHERE id = ?').get(req.params.id) as any;
    if (!connector) { res.status(404).json({ error: 'Not found' }); return; }

    try {
      const adapter = registry.create(d, connector);
      const syncType = req.body.full ? 'full' : 'incremental';
      const stats = await adapter.sync(syncType as any);
      res.json({ status: 'success', stats });
    } catch (err: any) {
      res.status(500).json({ status: 'failed', error: err.message });
    }
  });

  router.post('/:id/healthcheck', async (req, res) => {
    const d = db.getDb();
    const connector = d.prepare('SELECT * FROM connectors WHERE id = ?').get(req.params.id) as any;
    if (!connector) { res.status(404).json({ error: 'Not found' }); return; }

    try {
      const adapter = registry.create(d, connector);
      const result = await adapter.healthcheck();
      res.json(result);
    } catch (err: any) {
      res.json({ status: 'error', error: err.message });
    }
  });

  router.put('/:id/toggle', (req, res) => {
    const d = db.getDb();
    const connector = d.prepare('SELECT is_enabled FROM connectors WHERE id = ?').get(req.params.id) as any;
    if (!connector) { res.status(404).json({ error: 'Not found' }); return; }
    const newState = connector.is_enabled ? 0 : 1;
    d.prepare('UPDATE connectors SET is_enabled = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(newState, req.params.id);
    res.json({ is_enabled: !!newState });
  });

  router.get('/:id/logs', (req, res) => {
    const d = db.getDb();
    const limit = Math.min(100, Number(req.query.limit) || 20);
    res.json(d.prepare(
      'SELECT * FROM connector_sync_log WHERE connector_id = ? ORDER BY started_at DESC LIMIT ?'
    ).all(req.params.id, limit));
  });

  router.get('/adapters', (_req, res) => {
    res.json(registry.list());
  });

  return router;
}
