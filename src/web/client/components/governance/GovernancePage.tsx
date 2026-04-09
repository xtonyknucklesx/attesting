import React, { useState } from 'react';
import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { useToastContext } from '../../App';
import {
  getPolicies, createPolicy,
  getCommittees, createCommittee, getCommitteeMeetings,
  getRoles, createRole
} from '../../lib/api';
import { Plus, ScrollText, Users, UserCheck, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';

const TABS = [
  { to: '/governance/policies', label: 'Policies' },
  { to: '/governance/committees', label: 'Committees' },
  { to: '/governance/roles', label: 'Roles' },
];

const POLICY_STATUS: Record<string, { cls: string; label: string }> = {
  draft: { cls: 'pill-gray', label: 'Draft' },
  review: { cls: 'pill-blue', label: 'In Review' },
  approved: { cls: 'pill-green', label: 'Approved' },
  expired: { cls: 'pill-rose', label: 'Expired' },
  retired: { cls: 'pill-gray', label: 'Retired' },
};

export default function GovernancePage() {
  return (
    <div className="p-6 lg:p-8 max-w-[1200px] mx-auto">
      <h2 className="text-[18px] font-semibold tracking-tight mb-5" style={{ color: 'var(--text-primary)' }}>Governance</h2>

      <div className="flex gap-1 mb-6" role="tablist">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end
            className={({ isActive }) =>
              `px-4 py-1.5 rounded-lg text-[13px] font-medium transition-all`
            }
            style={({ isActive }) => ({
              background: isActive ? 'var(--bg-glass-active)' : 'transparent',
              color: isActive ? '#818cf8' : 'var(--text-tertiary)',
              border: isActive ? '1px solid rgba(129,140,248,0.3)' : '1px solid transparent',
            })}
          >
            {t.label}
          </NavLink>
        ))}
      </div>

      <Routes>
        <Route index element={<Navigate to="/governance/policies" replace />} />
        <Route path="policies" element={<PoliciesTab />} />
        <Route path="committees" element={<CommitteesTab />} />
        <Route path="roles" element={<RolesTab />} />
      </Routes>
    </div>
  );
}

// ─── Policies Tab ───
function PoliciesTab() {
  const { add: toast } = useToastContext();
  const { data: policies, loading, refetch } = useApi(() => getPolicies(), []);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', policy_type: 'policy', status: 'draft', owner: '', review_date: '' });

  const dueForReview = policies?.filter((p: any) => {
    if (!p.review_date) return false;
    const diff = new Date(p.review_date).getTime() - Date.now();
    return diff < 30 * 86400000 && diff > -365 * 86400000;
  }) ?? [];

  const expired = policies?.filter((p: any) => p.status === 'expired' || (p.expiry_date && new Date(p.expiry_date) < new Date())) ?? [];

  const handleCreate = async () => {
    if (!form.title) return;
    await createPolicy(form);
    toast('Policy created', 'success');
    setShowForm(false);
    setForm({ title: '', description: '', policy_type: 'policy', status: 'draft', owner: '', review_date: '' });
    refetch();
  };

  return (
    <div>
      {dueForReview.length > 0 && (
        <div className="glass-static rounded-xl p-4 mb-4 flex items-center gap-3" style={{ borderLeft: '3px solid #fbbf24' }}>
          <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />
          <span className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>{dueForReview.length} {dueForReview.length === 1 ? 'policy' : 'policies'} due for review</span>
        </div>
      )}
      {expired.length > 0 && (
        <div className="glass-static rounded-xl p-4 mb-4 flex items-center gap-3" style={{ borderLeft: '3px solid #fb7185' }}>
          <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
          <span className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>{expired.length} expired</span>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
          <ScrollText className="h-4 w-4 inline mr-1.5 text-indigo-400" aria-hidden="true" />Policies ({policies?.length ?? 0})
        </h3>
        <button onClick={() => setShowForm(!showForm)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-[12px] font-medium rounded-xl hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-600/20">
          <Plus className="h-3.5 w-3.5" /> Add Policy
        </button>
      </div>

      {showForm && (
        <div className="glass-static rounded-xl p-5 mb-4 animate-fade-in space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Policy title" className="input-glass" />
            <input value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} placeholder="Owner (e.g., CISO)" className="input-glass" />
          </div>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" className="input-glass w-full" rows={2} style={{ borderRadius: 10 }} />
          <div className="grid grid-cols-3 gap-3">
            <select value={form.policy_type} onChange={(e) => setForm({ ...form, policy_type: e.target.value })} className="input-glass">
              <option value="policy">Policy</option><option value="standard">Standard</option><option value="procedure">Procedure</option><option value="guideline">Guideline</option>
            </select>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="input-glass">
              <option value="draft">Draft</option><option value="review">In Review</option><option value="approved">Approved</option>
            </select>
            <input type="date" value={form.review_date} onChange={(e) => setForm({ ...form, review_date: e.target.value })} className="input-glass" />
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
              <th>Title</th><th className="w-24">Type</th><th className="w-24">Status</th>
              <th className="w-28">Owner</th><th className="w-28">Review Date</th><th className="w-20 text-center">Controls</th>
            </tr></thead>
            <tbody>
              {policies?.map((p: any) => {
                const st = POLICY_STATUS[p.status] ?? POLICY_STATUS.draft;
                return (
                  <tr key={p.id}>
                    <td className="font-medium" style={{ color: 'var(--text-primary)' }}>{p.title}</td>
                    <td className="capitalize">{p.policy_type}</td>
                    <td><span className={`pill ${st.cls}`}>{st.label}</span></td>
                    <td>{p.owner ?? '—'}</td>
                    <td>{p.review_date ?? '—'}</td>
                    <td className="text-center">{p.control_count}</td>
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

// ─── Committees Tab ───
function CommitteesTab() {
  const { add: toast } = useToastContext();
  const { data: committees, loading, refetch } = useApi(() => getCommittees(), []);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', meeting_frequency: 'monthly', chair: '' });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [meetings, setMeetings] = useState<any[]>([]);

  const handleCreate = async () => {
    if (!form.name) return;
    await createCommittee(form);
    toast('Committee created', 'success');
    setShowForm(false); setForm({ name: '', meeting_frequency: 'monthly', chair: '' }); refetch();
  };

  const handleExpand = async (id: string) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    setMeetings(await getCommitteeMeetings(id));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
          <Users className="h-4 w-4 inline mr-1.5 text-indigo-400" />Committees ({committees?.length ?? 0})
        </h3>
        <button onClick={() => setShowForm(!showForm)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-[12px] font-medium rounded-xl hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-600/20">
          <Plus className="h-3.5 w-3.5" /> Add Committee
        </button>
      </div>

      {showForm && (
        <div className="glass-static rounded-xl p-5 mb-4 animate-fade-in space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Committee name" className="input-glass" />
            <select value={form.meeting_frequency} onChange={(e) => setForm({ ...form, meeting_frequency: e.target.value })} className="input-glass">
              <option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="annual">Annual</option>
            </select>
            <input value={form.chair} onChange={(e) => setForm({ ...form, chair: e.target.value })} placeholder="Chair" className="input-glass" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} className="px-4 py-1.5 bg-indigo-600 text-white text-[12px] font-medium rounded-xl hover:bg-indigo-500 transition-colors">Create</button>
            <button onClick={() => setShowForm(false)} className="glass-btn px-4 py-1.5 rounded-xl text-[12px]" style={{ color: 'var(--text-dim)' }}>Cancel</button>
          </div>
        </div>
      )}

      {loading ? <div className="text-[13px]" style={{ color: 'var(--text-dim)' }}>Loading...</div> : (
        <div className="space-y-3">
          {committees?.map((c: any) => (
            <div key={c.id} className="glass-static rounded-xl overflow-hidden">
              <button onClick={() => handleExpand(c.id)} className="w-full text-left px-5 py-3 flex items-center justify-between">
                <div>
                  <span className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>{c.name}</span>
                  <span className="text-[11px] ml-3" style={{ color: 'var(--text-dim)' }}>{c.meeting_frequency} · {c.meeting_count} meetings</span>
                </div>
                {expandedId === c.id ? <ChevronDown className="h-4 w-4" style={{ color: 'var(--text-dim)' }} /> : <ChevronRight className="h-4 w-4" style={{ color: 'var(--text-dim)' }} />}
              </button>
              {expandedId === c.id && (
                <div className="px-5 pb-4 animate-fade-in" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  {meetings.length === 0 ? (
                    <p className="text-[12px] py-2" style={{ color: 'var(--text-dim)' }}>No meetings recorded</p>
                  ) : (
                    <div className="space-y-2 pt-3">
                      {meetings.map((m: any) => (
                        <div key={m.id} className="flex items-center gap-3 text-[12px]">
                          <span className={`pill ${m.status === 'completed' ? 'pill-green' : m.status === 'cancelled' ? 'pill-rose' : 'pill-blue'}`}>{m.status}</span>
                          <span style={{ color: 'var(--text-secondary)' }}>{m.meeting_date}</span>
                          {m.agenda && <span style={{ color: 'var(--text-dim)' }} className="truncate">{m.agenda}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Roles Tab ───
function RolesTab() {
  const { add: toast } = useToastContext();
  const { data: roles, loading, refetch } = useApi(() => getRoles(), []);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ role_title: '', current_holder: '', regulatory_requirement: '', backup_holder: '' });

  const vacant = roles?.filter((r: any) => !r.current_holder) ?? [];

  const handleCreate = async () => {
    if (!form.role_title) return;
    await createRole(form);
    toast('Role created', 'success');
    setShowForm(false); setForm({ role_title: '', current_holder: '', regulatory_requirement: '', backup_holder: '' }); refetch();
  };

  return (
    <div>
      {vacant.length > 0 && (
        <div className="glass-static rounded-xl p-4 mb-4 flex items-center gap-3" style={{ borderLeft: '3px solid #fb7185' }}>
          <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
          <span className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>{vacant.length} vacant {vacant.length === 1 ? 'role' : 'roles'}</span>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
          <UserCheck className="h-4 w-4 inline mr-1.5 text-indigo-400" />Key Roles ({roles?.length ?? 0})
        </h3>
        <button onClick={() => setShowForm(!showForm)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-[12px] font-medium rounded-xl hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-600/20">
          <Plus className="h-3.5 w-3.5" /> Add Role
        </button>
      </div>

      {showForm && (
        <div className="glass-static rounded-xl p-5 mb-4 animate-fade-in space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input value={form.role_title} onChange={(e) => setForm({ ...form, role_title: e.target.value })} placeholder="Role title (e.g., FSO, CISO)" className="input-glass" />
            <input value={form.current_holder} onChange={(e) => setForm({ ...form, current_holder: e.target.value })} placeholder="Current holder" className="input-glass" />
            <input value={form.regulatory_requirement} onChange={(e) => setForm({ ...form, regulatory_requirement: e.target.value })} placeholder="Regulatory requirement" className="input-glass" />
            <input value={form.backup_holder} onChange={(e) => setForm({ ...form, backup_holder: e.target.value })} placeholder="Backup holder" className="input-glass" />
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
              <th>Role</th><th className="w-32">Holder</th><th className="w-32">Backup</th>
              <th className="w-28">Appointed</th><th>Regulatory Req.</th>
            </tr></thead>
            <tbody>
              {roles?.map((r: any) => (
                <tr key={r.id}>
                  <td className="font-medium" style={{ color: 'var(--text-primary)' }}>{r.role_title}</td>
                  <td>{r.current_holder ? <span style={{ color: 'var(--text-secondary)' }}>{r.current_holder}</span> : <span className="pill pill-rose">Vacant</span>}</td>
                  <td style={{ color: 'var(--text-dim)' }}>{r.backup_holder ?? '—'}</td>
                  <td style={{ color: 'var(--text-dim)' }}>{r.appointed_date ?? '—'}</td>
                  <td className="text-[11px]" style={{ color: 'var(--text-dim)' }}>{r.regulatory_requirement ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
