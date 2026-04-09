import React, { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { useToastContext } from '../../App';
import { getConnectors, createConnector, triggerSync, getConnectorLogs, runHealthcheck, getAdapters } from '../../lib/api';
import { Plus, Plug, RefreshCw, Activity, Clock } from 'lucide-react';

const HEALTH_PILL: Record<string, string> = {
  healthy: 'pill-green', ok: 'pill-green', degraded: 'pill-amber', error: 'pill-rose', unknown: 'pill-gray',
};

export default function ConnectorsPage() {
  const { add: toast } = useToastContext();
  const { data: connectors, loading, refetch } = useApi(() => getConnectors(), []);
  const [showForm, setShowForm] = useState(false);
  const [logId, setLogId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', adapter_class: '', connector_type: 'threat_feed' });

  const handleCreate = async () => {
    if (!form.name || !form.adapter_class) return;
    await createConnector(form);
    toast('Connector registered', 'success');
    setShowForm(false);
    setForm({ name: '', adapter_class: '', connector_type: 'threat_feed' });
    refetch();
  };

  const handleSync = async (id: string) => {
    setSyncing(id);
    try {
      const result = await triggerSync(id);
      toast(`Sync complete: ${JSON.stringify(result.stats ?? {})}`, 'success');
      refetch();
    } catch (e: any) {
      toast(e.message, 'error');
    }
    setSyncing(null);
  };

  const handleHealth = async (id: string) => {
    try {
      const result = await runHealthcheck(id);
      toast(`Health: ${result.status}`, result.status === 'healthy' || result.status === 'ok' ? 'success' : 'error');
      refetch();
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1200px] mx-auto">
      <h2 className="text-[18px] font-semibold tracking-tight mb-5" style={{ color: 'var(--text-primary)' }}>
        <Plug className="h-5 w-5 inline mr-2 text-indigo-400" />Connectors
      </h2>

      <div className="flex items-center justify-between mb-4">
        <span className="text-[12px]" style={{ color: 'var(--text-dim)' }}>{connectors?.length ?? 0} connectors</span>
        <button onClick={() => setShowForm(!showForm)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-[12px] font-medium rounded-xl hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-600/20">
          <Plus className="h-3.5 w-3.5" /> Add Connector
        </button>
      </div>

      {showForm && <AddConnectorForm form={form} setForm={setForm} onCreate={handleCreate} onCancel={() => setShowForm(false)} />}
      {logId && <SyncLogPanel id={logId} onClose={() => setLogId(null)} />}

      {loading ? <div className="text-[13px]" style={{ color: 'var(--text-dim)' }}>Loading...</div> : (
        <div className="space-y-3">
          {(connectors ?? []).length === 0 ? (
            <div className="glass-static rounded-xl p-8 text-center" style={{ color: 'var(--text-dim)' }}>No connectors registered</div>
          ) : connectors?.map((c: any) => (
            <div key={c.id} className="glass-static rounded-xl p-5">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>{c.name}</span>
                  <span className="text-[11px] font-mono ml-2" style={{ color: 'var(--text-dim)' }}>{c.adapter_class}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`pill ${HEALTH_PILL[c.health_status] ?? 'pill-gray'}`}>{c.health_status}</span>
                  <span className={`pill ${c.is_enabled ? 'pill-green' : 'pill-gray'}`}>{c.is_enabled ? 'enabled' : 'disabled'}</span>
                </div>
              </div>
              <div className="flex items-center gap-4 text-[11px]" style={{ color: 'var(--text-dim)' }}>
                <span>Sync: {c.sync_mode}</span>
                <span>Last: {c.last_synced_at ?? 'never'}</span>
                <span>24h syncs: {c.syncs_24h ?? 0}</span>
                <span>24h failures: {c.failures_24h ?? 0}</span>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => handleSync(c.id)} disabled={syncing === c.id}
                  className="glass-btn px-3 py-1 rounded-lg text-[11px] inline-flex items-center gap-1.5 text-indigo-400">
                  <RefreshCw className={`h-3 w-3 ${syncing === c.id ? 'animate-spin' : ''}`} />
                  {syncing === c.id ? 'Syncing...' : 'Sync'}
                </button>
                <button onClick={() => handleHealth(c.id)}
                  className="glass-btn px-3 py-1 rounded-lg text-[11px] inline-flex items-center gap-1.5 text-green-400">
                  <Activity className="h-3 w-3" /> Health
                </button>
                <button onClick={() => setLogId(logId === c.id ? null : c.id)}
                  className="glass-btn px-3 py-1 rounded-lg text-[11px] inline-flex items-center gap-1.5" style={{ color: 'var(--text-dim)' }}>
                  <Clock className="h-3 w-3" /> Logs
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AddConnectorForm({ form, setForm, onCreate, onCancel }: any) {
  const { data: adapters } = useApi(() => getAdapters(), []);

  return (
    <div className="glass-static rounded-xl p-5 mb-4 animate-fade-in space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Connector name" className="input-glass" />
        <select value={form.adapter_class} onChange={e => setForm({ ...form, adapter_class: e.target.value })} className="input-glass">
          <option value="">Select adapter...</option>
          {(adapters ?? []).map((a: string) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
      <div className="flex gap-2">
        <button onClick={onCreate} className="px-4 py-1.5 bg-indigo-600 text-white text-[12px] font-medium rounded-xl hover:bg-indigo-500 transition-colors">Register</button>
        <button onClick={onCancel} className="glass-btn px-4 py-1.5 rounded-xl text-[12px]" style={{ color: 'var(--text-dim)' }}>Cancel</button>
      </div>
    </div>
  );
}

function SyncLogPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: logs, loading } = useApi(() => getConnectorLogs(id), [id]);

  return (
    <div className="glass-static rounded-xl p-5 mb-4 animate-fade-in" style={{ borderLeft: '3px solid #818cf8' }}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>Sync Log</h4>
        <button onClick={onClose} className="glass-btn px-2 py-1 rounded text-[11px]" style={{ color: 'var(--text-dim)' }}>Close</button>
      </div>
      {loading ? <div className="text-[12px]" style={{ color: 'var(--text-dim)' }}>Loading...</div> : (
        <div className="space-y-1">
          {(logs ?? []).length === 0 ? <p className="text-[12px]" style={{ color: 'var(--text-dim)' }}>No sync history</p> : logs?.map((l: any, i: number) => (
            <div key={i} className="flex items-center justify-between text-[11px]" style={{ color: 'var(--text-secondary)' }}>
              <span className={`pill ${l.status === 'success' ? 'pill-green' : 'pill-rose'}`}>{l.status}</span>
              <span>{l.records_processed ?? 0} records</span>
              <span>{l.duration_ms ? `${l.duration_ms}ms` : '—'}</span>
              <span style={{ color: 'var(--text-dim)' }}>{l.started_at}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
