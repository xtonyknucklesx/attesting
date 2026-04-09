import React, { useState, useEffect } from 'react';
import { useApi } from '../../hooks/useApi';
import { useToastContext } from '../../App';
import { getImplementations, createImplementation, updateImplementation, resolveMappings, getControlParams, setControlParam } from '../../lib/api';
import { Save, GitCompareArrows, Clock, Settings2 } from 'lucide-react';

const STATUSES = [
  { value: 'implemented', label: 'Implemented' },
  { value: 'partially-implemented', label: 'Partially Implemented' },
  { value: 'planned', label: 'Planned' },
  { value: 'alternative', label: 'Alternative' },
  { value: 'not-applicable', label: 'Not Applicable' },
  { value: 'not-implemented', label: 'Not Implemented' },
];
const RESP_TYPES = [
  { value: 'provider', label: 'Provider' }, { value: 'customer', label: 'Customer' },
  { value: 'shared', label: 'Shared' }, { value: 'inherited', label: 'Inherited' },
];

function timeAgo(d: string): string {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'just now'; const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`; return `${Math.floor(m / 60)}h ago`;
}

export default function ImplEditor({ control, scope }: { control: any; scope: string }) {
  const { add: toast } = useToastContext();
  const cat = control.catalogShortName ?? control.catalog_short_name ?? '';
  const cid = control.control_id;
  const isSig = cat.startsWith('sig-');

  const [status, setStatus] = useState('not-implemented');
  const [statement, setStatement] = useState('');
  const [role, setRole] = useState('');
  const [person, setPerson] = useState('');
  const [respType, setRespType] = useState('provider');
  const [sigResp, setSigResp] = useState('');
  const [saving, setSaving] = useState(false);
  const [implId, setImplId] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  const { data: implData } = useApi(() => getImplementations({ catalog: cat, limit: '500' }), [cat]);

  useEffect(() => {
    const e = implData?.implementations?.find((i: any) => i.control_id === cid);
    if (e) { setImplId(e.id); setStatus(e.status); setStatement(e.statement || ''); setRole(e.responsible_role || ''); setPerson(e.responsible_person || ''); setRespType(e.responsibility_type || 'provider'); setSigResp(e.sig_response || ''); setLastSaved(e.updated_at); }
    else { setImplId(null); setStatus('not-implemented'); setStatement(''); setRole(''); setPerson(''); setRespType('provider'); setSigResp(''); setLastSaved(null); }
  }, [cid, implData]);

  const { data: mapData } = useApi(
    () => cat && cid ? resolveMappings(cat, cid) : Promise.resolve({ control: null, direct: [], transitive: [] }),
    [cat, cid]
  );

  // Control parameters
  const { data: paramData, refetch: refetchParams } = useApi(
    () => cat && cid ? getControlParams(cat, cid) : Promise.resolve([]),
    [cat, cid]
  );
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [savingParam, setSavingParam] = useState<string | null>(null);

  useEffect(() => {
    if (paramData) {
      const vals: Record<string, string> = {};
      for (const p of paramData) { if (p.value) vals[p.param_id] = p.value; }
      setParamValues(vals);
    }
  }, [paramData]);

  const handleParamSave = async (paramId: string) => {
    setSavingParam(paramId);
    try {
      await setControlParam(cat, cid, paramId, paramValues[paramId] ?? '');
      toast('Parameter saved', 'success');
      refetchParams();
    } catch (err: any) { toast(err.message || 'Failed', 'error'); }
    finally { setSavingParam(null); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (implId) await updateImplementation(implId, { status, statement, responsibleRole: role, responsiblePerson: person, responsibilityType: respType, sigResponse: isSig ? sigResp : undefined });
      else { const r = await createImplementation({ controlId: cid, catalogShortName: cat, scopeName: scope || undefined, status, statement, responsibleRole: role, responsiblePerson: person, responsibilityType: respType, sigResponse: isSig ? sigResp : undefined }); setImplId(r.id); }
      setLastSaved(new Date().toISOString());
      toast('Implementation saved', 'success');
    } catch (err: any) { toast(err.message || 'Save failed', 'error'); }
    finally { setSaving(false); }
  };

  return (
    <div className="p-6 max-w-3xl animate-fade-in">
      <div className="mb-6">
        <span className="text-[13px] font-mono font-semibold text-indigo-400">{cat}:{cid}</span>
        <h3 className="text-[16px] font-semibold leading-snug mt-1" style={{ color: 'var(--text-primary)' }}>{control.title ?? control.control_title}</h3>
        <p className="text-[13px] mt-2 leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>{control.description ?? control.control_description ?? ''}</p>
      </div>

      {/* Organization-defined parameters */}
      {paramData && paramData.length > 0 && (
        <div className="mb-6">
          <h4 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-dim)' }}>
            <Settings2 className="h-3.5 w-3.5" aria-hidden="true" />
            Organization-Defined Parameters ({paramData.length})
          </h4>
          <div className="space-y-3">
            {paramData.map((p: any) => (
              <div key={p.param_id} className="rounded-lg p-3" style={{ background: 'var(--bg-glass-strong)', border: '1px solid var(--border-subtle)' }}>
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <label htmlFor={`param-${p.param_id}`} className="text-[12px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                    {p.label || p.param_id}
                  </label>
                  <span className="text-[10px] font-mono shrink-0" style={{ color: 'var(--text-dim)' }}>{p.param_id}</span>
                </div>
                {p.description && (
                  <p className="text-[11px] mb-2 leading-relaxed" style={{ color: 'var(--text-dim)' }}>{p.description}</p>
                )}
                <div className="flex items-center gap-2">
                  <input
                    id={`param-${p.param_id}`}
                    value={paramValues[p.param_id] ?? ''}
                    onChange={(e) => setParamValues((prev) => ({ ...prev, [p.param_id]: e.target.value }))}
                    placeholder={p.default_value || 'Enter value...'}
                    className="input-glass flex-1 text-[12px]"
                  />
                  <button
                    onClick={() => handleParamSave(p.param_id)}
                    disabled={savingParam === p.param_id}
                    className="px-2.5 py-1.5 text-[11px] font-medium text-indigo-400 rounded-lg transition-colors"
                    style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}
                  >
                    {savingParam === p.param_id ? '...' : 'Set'}
                  </button>
                </div>
                {p.value && p.set_at && (
                  <p className="text-[10px] mt-1" style={{ color: 'var(--text-dim)' }}>
                    Set{p.set_by ? ` by ${p.set_by}` : ''} on {new Date(p.set_at).toLocaleDateString()}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="impl-status" className="block text-[12px] font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Status *</label>
            <select id="impl-status" value={status} onChange={(e) => setStatus(e.target.value)} className="input-glass w-full" aria-required="true">
              {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="resp-type" className="block text-[12px] font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Responsibility</label>
            <select id="resp-type" value={respType} onChange={(e) => setRespType(e.target.value)} className="input-glass w-full">
              {RESP_TYPES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
        </div>

        {isSig && (
          <div>
            <label htmlFor="sig-response" className="block text-[12px] font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>SIG Response</label>
            <select id="sig-response" value={sigResp} onChange={(e) => setSigResp(e.target.value)} className="input-glass w-full">
              <option value="">—</option><option value="Yes">Yes</option><option value="No">No</option><option value="N/A">N/A</option>
            </select>
          </div>
        )}

        <div>
          <label htmlFor="impl-statement" className="block text-[12px] font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Implementation Statement</label>
          <textarea id="impl-statement" value={statement} onChange={(e) => setStatement(e.target.value)} rows={8}
            className="input-glass w-full resize-y leading-relaxed" style={{ borderRadius: 12 }}
            placeholder="Describe how this control is implemented..." />
          <p className="text-[11px] mt-1" style={{ color: 'var(--text-dim)' }}>{statement.length} characters</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="resp-role" className="block text-[12px] font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Responsible Role</label>
            <input id="resp-role" value={role} onChange={(e) => setRole(e.target.value)} className="input-glass w-full" placeholder="e.g., Security Engineer" />
          </div>
          <div>
            <label htmlFor="resp-person" className="block text-[12px] font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Responsible Person</label>
            <input id="resp-person" value={person} onChange={(e) => setPerson(e.target.value)} className="input-glass w-full" placeholder="e.g., Jane Smith" />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button onClick={handleSave} disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-[13px] font-medium rounded-xl hover:bg-indigo-500 active:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 transition-colors duration-150 shadow-lg shadow-indigo-600/20">
            <Save className="h-3.5 w-3.5" aria-hidden="true" />{saving ? 'Saving...' : 'Save'}
          </button>
          {lastSaved && (
            <span className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--text-dim)' }}>
              <Clock className="h-3 w-3" aria-hidden="true" />Saved {timeAgo(lastSaved)}
            </span>
          )}
        </div>
      </div>

      {/* Mapping preview */}
      {mapData && (mapData.direct.length > 0 || mapData.transitive.length > 0) && (
        <div className="mt-8 pt-6" style={{ borderTop: '1px solid var(--border-glass)' }}>
          <div className="flex items-center gap-2 mb-3">
            <GitCompareArrows className="h-4 w-4 text-indigo-400" aria-hidden="true" />
            <h4 className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>Mapping Coverage</h4>
          </div>
          <p className="text-[12px] mb-3" style={{ color: 'var(--text-tertiary)' }}>
            Covers {mapData.direct.length + mapData.transitive.length} controls via mappings:
          </p>
          <ul className="space-y-1" role="list">
            {[...mapData.direct, ...mapData.transitive].slice(0, 20).map((m: any, i: number) => (
              <li key={i} className="flex items-center gap-2 text-[12px]">
                <span className="font-mono px-1.5 py-0.5 rounded text-indigo-400" style={{ background: 'var(--bg-glass-strong)' }}>
                  {m.catalogShortName}:{m.controlNativeId}
                </span>
                <span style={{ color: 'var(--text-dim)' }}>{m.relationship} ({m.confidence}{m.isTransitive ? ', transitive' : ''})</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
