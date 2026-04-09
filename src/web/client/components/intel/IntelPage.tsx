import React, { useState } from 'react';
import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { useToastContext } from '../../App';
import { getThreats, getManualIntel, submitManualIntel, getShadowImpact, promoteIntel } from '../../lib/api';
import { Radio, FileWarning, Zap, Eye } from 'lucide-react';

const TABS = [
  { to: '/intel/threats', label: 'Threat Feed' },
  { to: '/intel/manual', label: 'Manual Intel' },
];

const SEV_PILL: Record<string, string> = {
  critical: 'pill-rose', high: 'pill-amber', medium: 'pill-blue', low: 'pill-green', info: 'pill-gray',
};

export default function IntelPage() {
  return (
    <div className="p-6 lg:p-8 max-w-[1200px] mx-auto">
      <h2 className="text-[18px] font-semibold tracking-tight mb-5" style={{ color: 'var(--text-primary)' }}>
        <Radio className="h-5 w-5 inline mr-2 text-indigo-400" />Threat Intelligence
      </h2>
      <div className="flex gap-1 mb-6" role="tablist">
        {TABS.map(t => (
          <NavLink key={t.to} to={t.to} end
            className="px-4 py-1.5 rounded-lg text-[13px] font-medium transition-all"
            style={({ isActive }) => ({
              background: isActive ? 'var(--bg-glass-active)' : 'transparent',
              color: isActive ? '#818cf8' : 'var(--text-tertiary)',
              border: isActive ? '1px solid rgba(129,140,248,0.3)' : '1px solid transparent',
            })}>{t.label}</NavLink>
        ))}
      </div>
      <Routes>
        <Route index element={<Navigate to="/intel/threats" replace />} />
        <Route path="threats" element={<ThreatsTab />} />
        <Route path="manual" element={<ManualTab />} />
      </Routes>
    </div>
  );
}

function ThreatsTab() {
  const [sevFilter, setSevFilter] = useState('');
  const { data: threats, loading } = useApi(
    () => getThreats(sevFilter ? { severity: sevFilter } : {}), [sevFilter]
  );

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <h3 className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
          <FileWarning className="h-4 w-4 inline mr-1.5 text-amber-400" />Threat Inputs ({threats?.length ?? 0})
        </h3>
        <select value={sevFilter} onChange={e => setSevFilter(e.target.value)} className="input-glass text-[11px] py-1">
          <option value="">All severities</option>
          {['critical', 'high', 'medium', 'low', 'info'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {loading ? <div className="text-[13px]" style={{ color: 'var(--text-dim)' }}>Loading...</div> : (
        <div className="glass-static rounded-xl overflow-hidden">
          <table className="w-full glass-table">
            <thead><tr>
              <th className="w-24">Severity</th><th>Title</th><th className="w-28">Channel</th>
              <th className="w-24">Type</th><th className="w-28">CVE</th><th className="w-36">Ingested</th>
            </tr></thead>
            <tbody>
              {(threats ?? []).length === 0 ? (
                <tr><td colSpan={6} className="text-center py-6" style={{ color: 'var(--text-dim)' }}>No threats found</td></tr>
              ) : threats?.map((t: any) => (
                <tr key={t.id}>
                  <td><span className={`pill ${SEV_PILL[t.severity] ?? 'pill-gray'}`}>{t.severity}</span></td>
                  <td style={{ color: 'var(--text-primary)' }}>{t.title}</td>
                  <td className="font-mono text-[11px]">{t.channel}</td>
                  <td>{t.threat_type}</td>
                  <td className="font-mono text-[11px]">{t.cve_id ?? '—'}</td>
                  <td className="text-[11px]">{t.ingested_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ManualTab() {
  const { add: toast } = useToastContext();
  const { data: intel, loading, refetch } = useApi(() => getManualIntel(), []);
  const [showForm, setShowForm] = useState(false);
  const [shadowId, setShadowId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', description: '', severityEstimate: 'medium', intelType: 'threat' });

  const handleSubmit = async () => {
    if (!form.title || !form.description) return;
    await submitManualIntel(form);
    toast('Intel submitted as provisional', 'success');
    setShowForm(false);
    setForm({ title: '', description: '', severityEstimate: 'medium', intelType: 'threat' });
    refetch();
  };

  const handlePromote = async (id: string) => {
    if (!confirm('Promote this intel to a confirmed threat? This triggers full propagation.')) return;
    await promoteIntel(id);
    toast('Intel promoted', 'success');
    refetch();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
          <Zap className="h-4 w-4 inline mr-1.5 text-indigo-400" />Manual Intel ({intel?.length ?? 0})
        </h3>
        <button onClick={() => setShowForm(!showForm)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-[12px] font-medium rounded-xl hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-600/20">
          Submit Intel
        </button>
      </div>

      {showForm && (
        <div className="glass-static rounded-xl p-5 mb-4 animate-fade-in space-y-3">
          <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Intel title" className="input-glass w-full" />
          <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Description" className="input-glass w-full" rows={3} style={{ borderRadius: 10 }} />
          <div className="grid grid-cols-2 gap-3">
            <select value={form.severityEstimate} onChange={e => setForm({ ...form, severityEstimate: e.target.value })} className="input-glass">
              {['critical', 'high', 'medium', 'low', 'info'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={form.intelType} onChange={e => setForm({ ...form, intelType: e.target.value })} className="input-glass">
              {['threat', 'vulnerability', 'campaign', 'regulatory'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSubmit} className="px-4 py-1.5 bg-indigo-600 text-white text-[12px] font-medium rounded-xl hover:bg-indigo-500 transition-colors">Submit</button>
            <button onClick={() => setShowForm(false)} className="glass-btn px-4 py-1.5 rounded-xl text-[12px]" style={{ color: 'var(--text-dim)' }}>Cancel</button>
          </div>
        </div>
      )}

      {shadowId && <ShadowPanel id={shadowId} onClose={() => setShadowId(null)} />}

      {loading ? <div className="text-[13px]" style={{ color: 'var(--text-dim)' }}>Loading...</div> : (
        <div className="glass-static rounded-xl overflow-hidden">
          <table className="w-full glass-table">
            <thead><tr>
              <th className="w-24">Severity</th><th>Title</th><th className="w-24">Status</th>
              <th className="w-28">Confidence</th><th className="w-36">Deadline</th><th className="w-24">Actions</th>
            </tr></thead>
            <tbody>
              {(intel ?? []).length === 0 ? (
                <tr><td colSpan={6} className="text-center py-6" style={{ color: 'var(--text-dim)' }}>No manual intel</td></tr>
              ) : intel?.map((i: any) => (
                <tr key={i.id}>
                  <td><span className={`pill ${SEV_PILL[i.severity_estimate] ?? 'pill-gray'}`}>{i.severity_estimate}</span></td>
                  <td style={{ color: 'var(--text-primary)' }}>{i.title}</td>
                  <td><span className={`pill ${i.status === 'provisional' ? 'pill-amber' : i.status === 'promoted' ? 'pill-green' : 'pill-gray'}`}>{i.status}</span></td>
                  <td>{i.confidence_level}</td>
                  <td className="text-[11px]">{i.corroboration_deadline?.split('T')[0] ?? '—'}</td>
                  <td className="flex gap-1">
                    <button onClick={() => setShadowId(i.id)} className="glass-btn p-1 rounded" title="Shadow impact">
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    {(i.status === 'provisional' || i.status === 'watching') && (
                      <button onClick={() => handlePromote(i.id)} className="glass-btn p-1 rounded text-green-400" title="Promote">
                        <Zap className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ShadowPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: shadow, loading } = useApi(() => getShadowImpact(id), [id]);

  return (
    <div className="glass-static rounded-xl p-5 mb-4 animate-fade-in" style={{ borderLeft: '3px solid #818cf8' }}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>Shadow Impact Analysis</h4>
        <button onClick={onClose} className="glass-btn px-2 py-1 rounded text-[11px]" style={{ color: 'var(--text-dim)' }}>Close</button>
      </div>
      {loading ? <div className="text-[12px]" style={{ color: 'var(--text-dim)' }}>Analyzing...</div> : shadow && (
        <div className="space-y-2 text-[12px]" style={{ color: 'var(--text-secondary)' }}>
          <p className="font-medium">{shadow.summary}</p>
          {shadow.assets_at_risk?.length > 0 && <p>Assets at risk: {shadow.assets_at_risk.map((a: any) => a.name).join(', ')}</p>}
          {shadow.controls_to_review?.length > 0 && <p>Controls to review: {shadow.controls_to_review.map((c: any) => c.control_id).join(', ')}</p>}
          {shadow.frameworks_affected?.length > 0 && <p>Frameworks affected: {shadow.frameworks_affected.join(', ')}</p>}
          <p>Alerts that would fire: {shadow.alerts_would_fire}</p>
        </div>
      )}
    </div>
  );
}
