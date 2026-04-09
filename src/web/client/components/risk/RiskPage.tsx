import React, { useState } from 'react';
import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { useToastContext } from '../../App';
import { getRisks, createRisk, getRiskMatrix, getRiskExceptions, createRiskException, getRiskDashboard } from '../../lib/api';
import { Plus, AlertTriangle, Grid3x3, ShieldAlert, BarChart3, AlertCircle } from 'lucide-react';

const TABS = [
  { to: '/risk/register', label: 'Register' },
  { to: '/risk/matrix', label: 'Matrix' },
  { to: '/risk/exceptions', label: 'Exceptions' },
  { to: '/risk/dashboard', label: 'Dashboard' },
];

function scoreColor(score: number | null): string {
  if (!score) return 'var(--text-dim)';
  if (score <= 4) return '#4ade80';
  if (score <= 9) return '#fbbf24';
  if (score <= 15) return '#fb923c';
  return '#fb7185';
}

function scoreBg(score: number | null): string {
  if (!score) return 'transparent';
  if (score <= 4) return 'rgba(74,222,128,0.12)';
  if (score <= 9) return 'rgba(251,191,36,0.12)';
  if (score <= 15) return 'rgba(251,147,60,0.12)';
  return 'rgba(251,113,133,0.12)';
}

const CAT_PILL: Record<string, string> = {
  operational: 'pill-blue', compliance: 'pill-amber', strategic: 'pill-gray',
  financial: 'pill-green', reputational: 'pill-rose', technical: 'pill-blue',
};

export default function RiskPage() {
  return (
    <div className="p-6 lg:p-8 max-w-[1200px] mx-auto">
      <h2 className="text-[18px] font-semibold tracking-tight mb-5" style={{ color: 'var(--text-primary)' }}>Risk Management</h2>
      <div className="flex gap-1 mb-6" role="tablist">
        {TABS.map((t) => (
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
        <Route index element={<Navigate to="/risk/register" replace />} />
        <Route path="register" element={<RegisterTab />} />
        <Route path="matrix" element={<MatrixTab />} />
        <Route path="exceptions" element={<ExceptionsTab />} />
        <Route path="dashboard" element={<DashboardTab />} />
      </Routes>
    </div>
  );
}

// ─── Register ───
function RegisterTab() {
  const { add: toast } = useToastContext();
  const [catFilter, setCatFilter] = useState('');
  const [stFilter, setStFilter] = useState('');
  const { data: risks, loading, refetch } = useApi(() => getRisks({
    ...(catFilter ? { category: catFilter } : {}),
    ...(stFilter ? { status: stFilter } : {}),
  }), [catFilter, stFilter]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', category: 'operational', likelihood: '3', impact: '3', owner: '', treatment: 'mitigate' });

  const handleCreate = async () => {
    if (!form.title || !form.owner) return;
    await createRisk({ ...form, likelihood: Number(form.likelihood), impact: Number(form.impact) });
    toast('Risk created', 'success');
    setShowForm(false); setForm({ title: '', description: '', category: 'operational', likelihood: '3', impact: '3', owner: '', treatment: 'mitigate' }); refetch();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
            <ShieldAlert className="h-4 w-4 inline mr-1.5 text-indigo-400" />Risk Register ({risks?.length ?? 0})
          </h3>
          <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className="input-glass text-[11px] py-1">
            <option value="">All categories</option>
            {['operational','compliance','strategic','financial','reputational','technical'].map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={stFilter} onChange={(e) => setStFilter(e.target.value)} className="input-glass text-[11px] py-1">
            <option value="">All statuses</option>
            {['open','mitigating','accepted','closed','transferred'].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-[12px] font-medium rounded-xl hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-600/20">
          <Plus className="h-3.5 w-3.5" /> Add Risk
        </button>
      </div>

      {showForm && (
        <div className="glass-static rounded-xl p-5 mb-4 animate-fade-in space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Risk title" className="input-glass" />
            <input value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} placeholder="Owner" className="input-glass" />
          </div>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" className="input-glass w-full" rows={2} style={{ borderRadius: 10 }} />
          <div className="grid grid-cols-4 gap-3">
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input-glass">
              {['operational','compliance','strategic','financial','reputational','technical'].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={form.likelihood} onChange={(e) => setForm({ ...form, likelihood: e.target.value })} className="input-glass">
              {[1,2,3,4,5].map((n) => <option key={n} value={n}>Likelihood: {n}</option>)}
            </select>
            <select value={form.impact} onChange={(e) => setForm({ ...form, impact: e.target.value })} className="input-glass">
              {[1,2,3,4,5].map((n) => <option key={n} value={n}>Impact: {n}</option>)}
            </select>
            <select value={form.treatment} onChange={(e) => setForm({ ...form, treatment: e.target.value })} className="input-glass">
              {['mitigate','accept','transfer','avoid'].map((t) => <option key={t} value={t}>{t}</option>)}
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
              <th className="w-24">ID</th><th>Title</th><th className="w-24">Category</th>
              <th className="w-20 text-center">Inherent</th><th className="w-20 text-center">Residual</th>
              <th className="w-24">Treatment</th><th className="w-28">Owner</th><th className="w-24">Status</th>
            </tr></thead>
            <tbody>
              {risks?.map((r: any) => (
                <tr key={r.id}>
                  <td className="font-mono font-medium" style={{ color: 'var(--text-primary)' }}>{r.risk_id}</td>
                  <td style={{ color: 'var(--text-primary)' }}>{r.title}</td>
                  <td><span className={`pill ${CAT_PILL[r.category] ?? 'pill-gray'}`}>{r.category}</span></td>
                  <td className="text-center font-semibold" style={{ color: scoreColor(r.inherent_risk_score), background: scoreBg(r.inherent_risk_score) }}>{r.inherent_risk_score ?? '—'}</td>
                  <td className="text-center font-semibold" style={{ color: scoreColor(r.residual_risk_score), background: scoreBg(r.residual_risk_score) }}>{r.residual_risk_score ?? '—'}</td>
                  <td className="capitalize">{r.treatment}</td>
                  <td>{r.owner}</td>
                  <td><span className={`pill ${r.status === 'closed' ? 'pill-green' : r.status === 'accepted' ? 'pill-amber' : 'pill-blue'}`}>{r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Matrix ───
function MatrixTab() {
  const { data, loading } = useApi(() => getRiskMatrix(), []);
  const [view, setView] = useState<'inherent' | 'residual'>('inherent');

  if (loading || !data) return <div className="text-[13px]" style={{ color: 'var(--text-dim)' }}>Loading...</div>;

  const { matrix, risks } = data;
  const likLevels: string[] = JSON.parse(matrix.likelihood_levels);
  const impLevels: string[] = JSON.parse(matrix.impact_levels);

  // Build grid: count risks at each (likelihood, impact)
  const grid: number[][] = Array.from({ length: 5 }, () => Array(5).fill(0));
  for (const r of risks) {
    const l = view === 'inherent' ? r.likelihood : (r.residual_likelihood ?? r.likelihood);
    const i = view === 'inherent' ? r.impact : (r.residual_impact ?? r.impact);
    if (l >= 1 && l <= 5 && i >= 1 && i <= 5) grid[l - 1][i - 1]++;
  }

  function cellBg(l: number, i: number): string {
    const score = (l + 1) * (i + 1);
    if (score <= 4) return 'rgba(74,222,128,0.15)';
    if (score <= 9) return 'rgba(251,191,36,0.15)';
    if (score <= 15) return 'rgba(251,147,60,0.2)';
    return 'rgba(251,113,133,0.2)';
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
          <Grid3x3 className="h-4 w-4 inline mr-1.5 text-indigo-400" />5×5 Risk Matrix
        </h3>
        <div className="flex items-center gap-1 rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-glass)' }}>
          <button onClick={() => setView('inherent')} className={`px-3 py-1 text-[11px] font-medium ${view === 'inherent' ? 'glass-btn-active' : 'glass-btn'}`}>Inherent</button>
          <button onClick={() => setView('residual')} className={`px-3 py-1 text-[11px] font-medium ${view === 'residual' ? 'glass-btn-active' : 'glass-btn'}`}>Residual</button>
        </div>
      </div>

      <div className="glass-static rounded-xl p-5">
        <div className="flex">
          {/* Y-axis label */}
          <div className="flex flex-col justify-between mr-3 py-1" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
            <span className="text-[10px] font-medium rotate-180" style={{ color: 'var(--text-dim)' }}>Likelihood →</span>
          </div>
          <div className="flex-1">
            {/* Grid — rows are likelihood (5=top, 1=bottom) */}
            <div className="space-y-1">
              {[4, 3, 2, 1, 0].map((li) => (
                <div key={li} className="flex gap-1">
                  <div className="w-24 flex items-center text-[10px] shrink-0" style={{ color: 'var(--text-dim)' }}>{likLevels[li]}</div>
                  {[0, 1, 2, 3, 4].map((ii) => {
                    const count = grid[li][ii];
                    const score = (li + 1) * (ii + 1);
                    const aboveThreshold = score > (matrix.appetite_threshold ?? 9);
                    return (
                      <div key={ii} className="flex-1 aspect-square rounded-lg flex flex-col items-center justify-center text-[11px] font-medium relative"
                        style={{ background: cellBg(li, ii), color: 'var(--text-primary)', border: aboveThreshold ? '1px solid rgba(251,113,133,0.4)' : '1px solid var(--border-subtle)' }}>
                        {count > 0 && <span className="text-[16px] font-bold">{count}</span>}
                        <span className="text-[9px]" style={{ color: 'var(--text-dim)' }}>{score}</span>
                      </div>
                    );
                  })}
                </div>
              ))}
              {/* X-axis labels */}
              <div className="flex gap-1 mt-1">
                <div className="w-24 shrink-0" />
                {impLevels.map((l, i) => (
                  <div key={i} className="flex-1 text-center text-[10px]" style={{ color: 'var(--text-dim)' }}>{l}</div>
                ))}
              </div>
              <div className="text-center text-[10px] mt-1" style={{ color: 'var(--text-dim)' }}>Impact →</div>
            </div>
          </div>
        </div>
        <div className="mt-4 text-[11px] flex items-center gap-2" style={{ color: 'var(--text-dim)' }}>
          <span className="h-3 w-3 rounded border" style={{ borderColor: 'rgba(251,113,133,0.4)', background: 'rgba(251,113,133,0.1)' }} />
          Above risk appetite threshold ({matrix.appetite_threshold})
        </div>
      </div>
    </div>
  );
}

// ─── Exceptions ───
function ExceptionsTab() {
  const { data: exceptions, loading } = useApi(() => getRiskExceptions(), []);

  const expiringSoon = exceptions?.filter((e: any) => {
    const diff = new Date(e.expiry_date).getTime() - Date.now();
    return e.status === 'active' && diff < 30 * 86400000 && diff > 0;
  }) ?? [];

  return (
    <div>
      {expiringSoon.length > 0 && (
        <div className="glass-static rounded-xl p-4 mb-4 flex items-center gap-3" style={{ borderLeft: '3px solid #fbbf24' }}>
          <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />
          <span className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>{expiringSoon.length} {expiringSoon.length === 1 ? 'exception' : 'exceptions'} expiring within 30 days</span>
        </div>
      )}

      {loading ? <div className="text-[13px]" style={{ color: 'var(--text-dim)' }}>Loading...</div> : (
        <div className="glass-static rounded-xl overflow-hidden">
          <table className="w-full glass-table">
            <thead><tr>
              <th>Risk</th><th>Justification</th><th className="w-28">Approved By</th>
              <th className="w-28">Expiry</th><th className="w-24">Status</th>
            </tr></thead>
            <tbody>
              {(exceptions ?? []).length === 0 ? (
                <tr><td colSpan={5} className="text-center py-6" style={{ color: 'var(--text-dim)' }}>No risk exceptions</td></tr>
              ) : exceptions?.map((e: any) => {
                const isExpiring = new Date(e.expiry_date).getTime() - Date.now() < 30 * 86400000;
                return (
                  <tr key={e.id}>
                    <td className="font-medium" style={{ color: 'var(--text-primary)' }}>{e.risk_title} ({e.risk_ref})</td>
                    <td className="truncate max-w-xs">{e.justification}</td>
                    <td>{e.approved_by}</td>
                    <td style={{ color: isExpiring ? '#fbbf24' : 'var(--text-secondary)' }}>{e.expiry_date}</td>
                    <td><span className={`pill ${e.status === 'active' ? (isExpiring ? 'pill-amber' : 'pill-green') : e.status === 'expired' ? 'pill-rose' : 'pill-gray'}`}>{e.status}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Dashboard ───
function DashboardTab() {
  const { data, loading } = useApi(() => getRiskDashboard(), []);

  if (loading || !data) return <div className="text-[13px]" style={{ color: 'var(--text-dim)' }}>Loading...</div>;

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-static rounded-xl px-5 py-4">
          <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{data.totalOpen}</p>
          <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>Open risks</p>
        </div>
        <div className="glass-static rounded-xl px-5 py-4">
          <p className="text-2xl font-bold text-rose-400">{data.aboveAppetite}</p>
          <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>Above appetite</p>
        </div>
        <div className="glass-static rounded-xl px-5 py-4">
          <p className="text-2xl font-bold text-amber-400">{data.activeExceptions}</p>
          <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>Active exceptions</p>
        </div>
        <div className="glass-static rounded-xl px-5 py-4">
          <p className="text-2xl font-bold text-rose-400">{data.expiringExceptions}</p>
          <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>Expiring soon</p>
        </div>
      </div>

      {/* By category + by treatment */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-static rounded-xl p-5">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-dim)' }}>Risks by Category</h4>
          <div className="space-y-2">
            {data.byCategory.map((c: any) => (
              <div key={c.category} className="flex items-center justify-between">
                <span className="text-[12px] capitalize" style={{ color: 'var(--text-secondary)' }}>{c.category ?? 'uncategorized'}</span>
                <span className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>{c.count}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="glass-static rounded-xl p-5">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-dim)' }}>Treatment Breakdown</h4>
          <div className="space-y-2">
            {data.byTreatment.map((t: any) => (
              <div key={t.treatment} className="flex items-center justify-between">
                <span className="text-[12px] capitalize" style={{ color: 'var(--text-secondary)' }}>{t.treatment}</span>
                <span className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>{t.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top risks */}
      <div className="glass-static rounded-xl p-5">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-dim)' }}>
          <BarChart3 className="h-3.5 w-3.5 inline mr-1.5" />Top Risks by Inherent Score
        </h4>
        <div className="space-y-2">
          {data.topRisks.map((r: any) => (
            <div key={r.risk_id} className="flex items-center gap-3">
              <span className="text-[13px] font-mono font-medium w-20 shrink-0" style={{ color: 'var(--text-primary)' }}>{r.risk_id}</span>
              <div className="flex-1">
                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--ring-track)' }}>
                  <div className="h-full rounded-full" style={{ width: `${(r.inherent_risk_score / 25) * 100}%`, backgroundColor: scoreColor(r.inherent_risk_score) }} />
                </div>
              </div>
              <span className="text-[12px] font-semibold w-8 text-right" style={{ color: scoreColor(r.inherent_risk_score) }}>{r.inherent_risk_score}</span>
              <span className="text-[11px] truncate max-w-[200px]" style={{ color: 'var(--text-dim)' }}>{r.title}</span>
            </div>
          ))}
          {data.topRisks.length === 0 && <p className="text-[12px]" style={{ color: 'var(--text-dim)' }}>No open risks</p>}
        </div>
      </div>
    </div>
  );
}
