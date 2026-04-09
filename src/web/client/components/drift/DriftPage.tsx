import React, { useState } from 'react';
import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { useToastContext } from '../../App';
import { getDriftAlerts, getDriftDashboard, submitDisposition, commitDisposition, getPendingDispositions } from '../../lib/api';
import { Shield, BarChart3, Bell, CheckCircle } from 'lucide-react';

const TABS = [
  { to: '/drift/dashboard', label: 'Dashboard' },
  { to: '/drift/alerts', label: 'Alerts' },
  { to: '/drift/approvals', label: 'Approvals' },
];

const SEV_PILL: Record<string, string> = {
  critical: 'pill-rose', high: 'pill-amber', medium: 'pill-blue', low: 'pill-green',
};

export default function DriftPage() {
  return (
    <div className="p-6 lg:p-8 max-w-[1200px] mx-auto">
      <h2 className="text-[18px] font-semibold tracking-tight mb-5" style={{ color: 'var(--text-primary)' }}>
        <Shield className="h-5 w-5 inline mr-2 text-indigo-400" />Drift Detection
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
        <Route index element={<Navigate to="/drift/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardTab />} />
        <Route path="alerts" element={<AlertsTab />} />
        <Route path="approvals" element={<ApprovalsTab />} />
      </Routes>
    </div>
  );
}

function DashboardTab() {
  const { data, loading } = useApi(() => getDriftDashboard(), []);

  if (loading || !data) return <div className="text-[13px]" style={{ color: 'var(--text-dim)' }}>Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-static rounded-xl px-5 py-4">
          <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{data.active}</p>
          <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>Active alerts</p>
        </div>
        <div className="glass-static rounded-xl px-5 py-4">
          <p className="text-2xl font-bold text-amber-400">{data.pendingApprovals}</p>
          <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>Pending approvals</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-static rounded-xl p-5">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-dim)' }}>By Severity</h4>
          <div className="space-y-2">
            {(data.bySeverity ?? []).map((s: any) => (
              <div key={s.severity} className="flex items-center justify-between">
                <span className={`pill ${SEV_PILL[s.severity] ?? 'pill-gray'}`}>{s.severity}</span>
                <span className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>{s.count}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="glass-static rounded-xl p-5">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-dim)' }}>By Type</h4>
          <div className="space-y-2">
            {(data.byType ?? []).map((t: any) => (
              <div key={t.alert_type} className="flex items-center justify-between">
                <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>{t.alert_type}</span>
                <span className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>{t.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function AlertsTab() {
  const { add: toast } = useToastContext();
  const [statusFilter, setStatusFilter] = useState('active');
  const [sevFilter, setSevFilter] = useState('');
  const { data: alerts, loading, refetch } = useApi(
    () => getDriftAlerts({ status: statusFilter, ...(sevFilter ? { severity: sevFilter } : {}) }),
    [statusFilter, sevFilter]
  );
  const [disposeId, setDisposeId] = useState<string | null>(null);
  const [dispText, setDispText] = useState('');
  const [dispResult, setDispResult] = useState<any>(null);

  const handleDispose = async () => {
    if (!dispText.trim() || !disposeId) return;
    const result = await submitDisposition({ drift_alert_id: disposeId, analyst_id: 'web-user', text: dispText });
    setDispResult(result);
  };

  const handleCommit = async () => {
    if (!dispResult?.disposition) return;
    await commitDisposition(dispResult.disposition);
    toast('Disposition committed', 'success');
    setDisposeId(null); setDispText(''); setDispResult(null);
    refetch();
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <h3 className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
          <Bell className="h-4 w-4 inline mr-1.5 text-amber-400" />Drift Alerts ({alerts?.length ?? 0})
        </h3>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input-glass text-[11px] py-1">
          {['active', 'resolved', 'suppressed', 'all'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={sevFilter} onChange={e => setSevFilter(e.target.value)} className="input-glass text-[11px] py-1">
          <option value="">All severities</option>
          {['critical', 'high', 'medium', 'low'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Disposition panel */}
      {disposeId && (
        <div className="glass-static rounded-xl p-5 mb-4 animate-fade-in" style={{ borderLeft: '3px solid #818cf8' }}>
          <h4 className="text-[13px] font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Disposition</h4>
          <textarea value={dispText} onChange={e => setDispText(e.target.value)} placeholder="Describe your rationale in natural language..." className="input-glass w-full mb-3" rows={3} style={{ borderRadius: 10 }} />
          {dispResult && (
            <div className="mb-3 p-3 rounded-lg text-[12px]" style={{ background: 'var(--bg-glass)', color: 'var(--text-secondary)' }}>
              <p><strong>Type:</strong> {dispResult.disposition?.disposition_type}</p>
              <p><strong>Confidence:</strong> {((dispResult.disposition?.nlp_confidence ?? 0) * 100).toFixed(0)}%</p>
              <p><strong>Approval:</strong> {dispResult.disposition?.requires_approval ? 'Requires supervisor' : 'Self-approved'}</p>
              {dispResult.disposition?.auto_tasks?.length > 0 && <p><strong>Tasks:</strong> {dispResult.disposition.auto_tasks.length} will be created</p>}
            </div>
          )}
          <div className="flex gap-2">
            {!dispResult ? (
              <button onClick={handleDispose} className="px-4 py-1.5 bg-indigo-600 text-white text-[12px] font-medium rounded-xl hover:bg-indigo-500 transition-colors">Classify</button>
            ) : (
              <button onClick={handleCommit} className="px-4 py-1.5 bg-green-600 text-white text-[12px] font-medium rounded-xl hover:bg-green-500 transition-colors">Commit</button>
            )}
            <button onClick={() => { setDisposeId(null); setDispText(''); setDispResult(null); }} className="glass-btn px-4 py-1.5 rounded-xl text-[12px]" style={{ color: 'var(--text-dim)' }}>Cancel</button>
          </div>
        </div>
      )}

      {loading ? <div className="text-[13px]" style={{ color: 'var(--text-dim)' }}>Loading...</div> : (
        <div className="glass-static rounded-xl overflow-hidden">
          <table className="w-full glass-table">
            <thead><tr>
              <th className="w-24">Severity</th><th>Title</th><th className="w-32">Type</th>
              <th className="w-36">Detected</th><th className="w-20">Action</th>
            </tr></thead>
            <tbody>
              {(alerts ?? []).length === 0 ? (
                <tr><td colSpan={5} className="text-center py-6" style={{ color: 'var(--text-dim)' }}>No alerts</td></tr>
              ) : alerts?.map((a: any) => (
                <tr key={a.id}>
                  <td><span className={`pill ${SEV_PILL[a.severity] ?? 'pill-gray'}`}>{a.severity}</span></td>
                  <td style={{ color: 'var(--text-primary)' }}>{a.title}</td>
                  <td className="text-[11px]">{a.alert_type}</td>
                  <td className="text-[11px]">{a.detected_at}</td>
                  <td>
                    <button onClick={() => { setDisposeId(a.id); setDispResult(null); setDispText(''); }} className="glass-btn px-2 py-1 rounded text-[11px] text-indigo-400">Dispose</button>
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

function ApprovalsTab() {
  const { data: pending, loading } = useApi(() => getPendingDispositions(), []);

  return (
    <div>
      <h3 className="text-[13px] font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
        <CheckCircle className="h-4 w-4 inline mr-1.5 text-amber-400" />Pending Approvals ({pending?.length ?? 0})
      </h3>

      {loading ? <div className="text-[13px]" style={{ color: 'var(--text-dim)' }}>Loading...</div> : (
        <div className="glass-static rounded-xl overflow-hidden">
          <table className="w-full glass-table">
            <thead><tr>
              <th className="w-24">Severity</th><th>Alert</th><th className="w-28">Type</th>
              <th className="w-28">Analyst</th><th className="w-24">Status</th>
            </tr></thead>
            <tbody>
              {(pending ?? []).length === 0 ? (
                <tr><td colSpan={5} className="text-center py-6" style={{ color: 'var(--text-dim)' }}>No pending approvals</td></tr>
              ) : pending?.map((d: any) => (
                <tr key={d.id}>
                  <td><span className={`pill ${SEV_PILL[d.alert_severity] ?? 'pill-gray'}`}>{d.alert_severity}</span></td>
                  <td style={{ color: 'var(--text-primary)' }}>{d.alert_title}</td>
                  <td>{d.disposition_type}</td>
                  <td>{d.analyst_name ?? '—'}</td>
                  <td><span className="pill pill-amber">pending</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
