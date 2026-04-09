import React, { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { useToastContext } from '../../App';
import { getAssets, getAsset, createAsset, deleteAsset } from '../../lib/api';
import { Plus, Server, ArrowLeft, Trash2, AlertTriangle, ShieldAlert } from 'lucide-react';

export default function AssetsPage() {
  const { add: toast } = useToastContext();
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const { data: assets, loading, refetch } = useApi(
    () => getAssets({ ...(typeFilter ? { type: typeFilter } : {}), ...(statusFilter ? { status: statusFilter } : {}) }),
    [typeFilter, statusFilter]
  );
  const [showForm, setShowForm] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', asset_type: 'server', platform: '', criticality: 'medium' });

  const handleCreate = async () => {
    if (!form.name) return;
    await createAsset(form);
    toast('Asset created', 'success');
    setShowForm(false);
    setForm({ name: '', asset_type: 'server', platform: '', criticality: 'medium' });
    refetch();
  };

  if (detail) return <AssetDetail id={detail} onBack={() => { setDetail(null); refetch(); }} />;

  return (
    <div className="p-6 lg:p-8 max-w-[1200px] mx-auto">
      <h2 className="text-[18px] font-semibold tracking-tight mb-5" style={{ color: 'var(--text-primary)' }}>
        <Server className="h-5 w-5 inline mr-2 text-indigo-400" />Asset Inventory
      </h2>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="input-glass text-[11px] py-1">
            <option value="">All types</option>
            {['server', 'workstation', 'network', 'application', 'database', 'cloud', 'mobile', 'iot'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input-glass text-[11px] py-1">
            <option value="">All statuses</option>
            {['active', 'decommissioned', 'maintenance'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <span className="text-[12px]" style={{ color: 'var(--text-dim)' }}>{assets?.length ?? 0} assets</span>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-[12px] font-medium rounded-xl hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-600/20">
          <Plus className="h-3.5 w-3.5" /> Add Asset
        </button>
      </div>

      {showForm && (
        <div className="glass-static rounded-xl p-5 mb-4 animate-fade-in space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Asset name" className="input-glass" />
            <input value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} placeholder="Platform (e.g. aws, linux)" className="input-glass" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <select value={form.asset_type} onChange={(e) => setForm({ ...form, asset_type: e.target.value })} className="input-glass">
              {['server', 'workstation', 'network', 'application', 'database', 'cloud', 'mobile', 'iot'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={form.criticality} onChange={(e) => setForm({ ...form, criticality: e.target.value })} className="input-glass">
              {['low', 'medium', 'high', 'critical'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} className="px-4 py-1.5 bg-indigo-600 text-white text-[12px] font-medium rounded-xl hover:bg-indigo-500 transition-colors">Create</button>
            <button onClick={() => setShowForm(false)} className="glass-btn px-4 py-1.5 rounded-xl text-[12px]" style={{ color: 'var(--text-dim)' }}>Cancel</button>
          </div>
        </div>
      )}

      {loading ? <div className="text-[13px]" style={{ color: 'var(--text-dim)' }}>Loading...</div> : (
        <div className="glass-static rounded-xl overflow-hidden">
          <table className="w-full glass-table">
            <thead><tr>
              <th>Name</th><th className="w-24">Type</th><th className="w-28">Platform</th>
              <th className="w-24">Criticality</th><th className="w-28">Owner</th><th className="w-20">Status</th>
            </tr></thead>
            <tbody>
              {(assets ?? []).length === 0 ? (
                <tr><td colSpan={6} className="text-center py-6" style={{ color: 'var(--text-dim)' }}>No assets found</td></tr>
              ) : assets?.map((a: any) => (
                <tr key={a.id} className="cursor-pointer hover:bg-white/5" onClick={() => setDetail(a.id)}>
                  <td className="font-medium" style={{ color: 'var(--text-primary)' }}>{a.name}</td>
                  <td>{a.asset_type}</td>
                  <td className="font-mono text-[11px]">{a.platform ?? '—'}</td>
                  <td><span className={`pill ${a.criticality === 'critical' ? 'pill-rose' : a.criticality === 'high' ? 'pill-amber' : 'pill-blue'}`}>{a.criticality}</span></td>
                  <td>{a.owner_name ?? '—'}</td>
                  <td><span className={`pill ${a.status === 'active' ? 'pill-green' : 'pill-gray'}`}>{a.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AssetDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const { add: toast } = useToastContext();
  const { data, loading } = useApi(() => getAsset(id), [id]);

  const handleDelete = async () => {
    if (!confirm('Delete this asset? This will remove all linked correlations.')) return;
    await deleteAsset(id);
    toast('Asset deleted', 'success');
    onBack();
  };

  if (loading || !data) return <div className="p-6 text-[13px]" style={{ color: 'var(--text-dim)' }}>Loading...</div>;

  return (
    <div className="p-6 lg:p-8 max-w-[1200px] mx-auto">
      <button onClick={onBack} className="glass-btn px-3 py-1.5 rounded-xl text-[12px] mb-4 inline-flex items-center gap-1.5" style={{ color: 'var(--text-dim)' }}>
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </button>

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-[18px] font-semibold" style={{ color: 'var(--text-primary)' }}>{data.name}</h2>
        <button onClick={handleDelete} className="glass-btn px-3 py-1.5 rounded-xl text-[12px] text-rose-400 inline-flex items-center gap-1.5">
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="glass-static rounded-xl px-4 py-3">
          <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>Type</p>
          <p className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>{data.asset_type}</p>
        </div>
        <div className="glass-static rounded-xl px-4 py-3">
          <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>Platform</p>
          <p className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>{data.platform ?? '—'}</p>
        </div>
        <div className="glass-static rounded-xl px-4 py-3">
          <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>Criticality</p>
          <p className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>{data.criticality}</p>
        </div>
        <div className="glass-static rounded-xl px-4 py-3">
          <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>Status</p>
          <p className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>{data.status}</p>
        </div>
      </div>

      {/* Threats */}
      <div className="glass-static rounded-xl p-5 mb-4">
        <h3 className="text-[13px] font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
          <AlertTriangle className="h-4 w-4 inline mr-1.5 text-amber-400" />Linked Threats ({data.threats?.length ?? 0})
        </h3>
        {(data.threats ?? []).length === 0 ? (
          <p className="text-[12px]" style={{ color: 'var(--text-dim)' }}>No threat correlations</p>
        ) : (
          <div className="space-y-2">
            {data.threats.map((t: any) => (
              <div key={t.threat_id} className="flex items-center justify-between">
                <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                  <span className={`pill ${t.severity === 'critical' ? 'pill-rose' : t.severity === 'high' ? 'pill-amber' : 'pill-blue'}`}>{t.severity}</span>
                  {' '}{t.title} {t.cve_id && <span className="font-mono text-[10px]">({t.cve_id})</span>}
                </span>
                <span className="text-[10px]" style={{ color: 'var(--text-dim)' }}>{t.match_type}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Risks */}
      <div className="glass-static rounded-xl p-5">
        <h3 className="text-[13px] font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
          <ShieldAlert className="h-4 w-4 inline mr-1.5 text-rose-400" />Linked Risks ({data.risks?.length ?? 0})
        </h3>
        {(data.risks ?? []).length === 0 ? (
          <p className="text-[12px]" style={{ color: 'var(--text-dim)' }}>No linked risks</p>
        ) : (
          <div className="space-y-2">
            {data.risks.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between">
                <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                  <span className="font-mono font-medium">{r.risk_id}</span> {r.title}
                </span>
                <span className={`pill ${r.status === 'open' ? 'pill-amber' : 'pill-green'}`}>{r.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
