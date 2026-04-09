import React, { useState, useEffect } from 'react';
import { useApi } from '../../hooks/useApi';
import { useToastContext } from '../../App';
import { getImplementations, createImplementation, updateImplementation, resolveMappings } from '../../lib/api';
import { Save, GitCompareArrows, Clock } from 'lucide-react';

interface ImplEditorProps {
  control: any;
  scope: string;
}

const STATUSES = [
  { value: 'implemented', label: 'Implemented' },
  { value: 'partially-implemented', label: 'Partially Implemented' },
  { value: 'planned', label: 'Planned' },
  { value: 'alternative', label: 'Alternative' },
  { value: 'not-applicable', label: 'Not Applicable' },
  { value: 'not-implemented', label: 'Not Implemented' },
];

const RESP_TYPES = [
  { value: 'provider', label: 'Provider' },
  { value: 'customer', label: 'Customer' },
  { value: 'shared', label: 'Shared' },
  { value: 'inherited', label: 'Inherited' },
];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

export default function ImplEditor({ control, scope }: ImplEditorProps) {
  const { add: toast } = useToastContext();
  const catalogShortName = control.catalogShortName ?? control.catalog_short_name ?? '';
  const controlId = control.control_id;
  const isSig = catalogShortName.startsWith('sig-');

  const [status, setStatus] = useState('not-implemented');
  const [statement, setStatement] = useState('');
  const [responsibleRole, setResponsibleRole] = useState('');
  const [responsiblePerson, setResponsiblePerson] = useState('');
  const [responsibilityType, setResponsibilityType] = useState('provider');
  const [sigResponse, setSigResponse] = useState('');
  const [saving, setSaving] = useState(false);
  const [implId, setImplId] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  const { data: implData } = useApi(
    () => getImplementations({ catalog: catalogShortName, limit: '500' }),
    [catalogShortName]
  );

  useEffect(() => {
    const existing = implData?.implementations?.find(
      (i: any) => i.control_id === controlId
    );
    if (existing) {
      setImplId(existing.id);
      setStatus(existing.status);
      setStatement(existing.statement || '');
      setResponsibleRole(existing.responsible_role || '');
      setResponsiblePerson(existing.responsible_person || '');
      setResponsibilityType(existing.responsibility_type || 'provider');
      setSigResponse(existing.sig_response || '');
      setLastSaved(existing.updated_at);
    } else {
      setImplId(null);
      setStatus('not-implemented');
      setStatement('');
      setResponsibleRole('');
      setResponsiblePerson('');
      setResponsibilityType('provider');
      setSigResponse('');
      setLastSaved(null);
    }
  }, [controlId, implData]);

  const { data: mappingData } = useApi(
    () => catalogShortName && controlId ? resolveMappings(catalogShortName, controlId) : Promise.resolve({ control: null, direct: [], transitive: [] }),
    [catalogShortName, controlId]
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      if (implId) {
        await updateImplementation(implId, {
          status, statement, responsibleRole, responsiblePerson,
          responsibilityType, sigResponse: isSig ? sigResponse : undefined,
        });
      } else {
        const result = await createImplementation({
          controlId, catalogShortName, scopeName: scope || undefined,
          status, statement, responsibleRole, responsiblePerson,
          responsibilityType, sigResponse: isSig ? sigResponse : undefined,
        });
        setImplId(result.id);
      }
      setLastSaved(new Date().toISOString());
      toast('Implementation saved', 'success');
    } catch (err: any) {
      toast(err.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl animate-fade-in">
      {/* Control reference */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[13px] font-mono font-semibold text-indigo-600">{catalogShortName}:{controlId}</span>
        </div>
        <h3 className="text-[16px] font-semibold text-gray-900 leading-snug">{control.title ?? control.control_title}</h3>
        <p className="text-[13px] text-gray-500 mt-2 leading-relaxed">
          {control.description ?? control.control_description ?? 'No description available'}
        </p>
      </div>

      {/* Editor */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="impl-status" className="block text-[12px] font-medium text-gray-700 mb-1.5">
              Status <span className="text-rose-500" aria-hidden="true">*</span>
            </label>
            <select id="impl-status" value={status} onChange={(e) => setStatus(e.target.value)} aria-required="true"
              className="w-full text-[13px] border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors">
              {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="resp-type" className="block text-[12px] font-medium text-gray-700 mb-1.5">Responsibility</label>
            <select id="resp-type" value={responsibilityType} onChange={(e) => setResponsibilityType(e.target.value)}
              className="w-full text-[13px] border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors">
              {RESP_TYPES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
        </div>

        {isSig && (
          <div>
            <label htmlFor="sig-response" className="block text-[12px] font-medium text-gray-700 mb-1.5">SIG Response</label>
            <select id="sig-response" value={sigResponse} onChange={(e) => setSigResponse(e.target.value)}
              className="w-full text-[13px] border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors">
              <option value="">—</option>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
              <option value="N/A">N/A</option>
            </select>
          </div>
        )}

        <div>
          <label htmlFor="impl-statement" className="block text-[12px] font-medium text-gray-700 mb-1.5">
            Implementation Statement
          </label>
          <textarea
            id="impl-statement" value={statement} onChange={(e) => setStatement(e.target.value)}
            rows={8}
            className="w-full text-[13px] border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 resize-y transition-colors leading-relaxed"
            placeholder="Describe how this control is implemented..."
          />
          <p className="text-[11px] text-gray-400 mt-1">{statement.length} characters</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="resp-role" className="block text-[12px] font-medium text-gray-700 mb-1.5">Responsible Role</label>
            <input id="resp-role" value={responsibleRole} onChange={(e) => setResponsibleRole(e.target.value)}
              className="w-full text-[13px] border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
              placeholder="e.g., Security Engineer" />
          </div>
          <div>
            <label htmlFor="resp-person" className="block text-[12px] font-medium text-gray-700 mb-1.5">Responsible Person</label>
            <input id="resp-person" value={responsiblePerson} onChange={(e) => setResponsiblePerson(e.target.value)}
              className="w-full text-[13px] border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
              placeholder="e.g., Jane Smith" />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button onClick={handleSave} disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-[13px] font-medium rounded-lg hover:bg-indigo-700 active:bg-indigo-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 transition-colors duration-150">
            <Save className="h-3.5 w-3.5" aria-hidden="true" />
            {saving ? 'Saving...' : 'Save'}
          </button>
          {lastSaved && (
            <span className="flex items-center gap-1.5 text-[11px] text-gray-400">
              <Clock className="h-3 w-3" aria-hidden="true" />
              Saved {timeAgo(lastSaved)}
            </span>
          )}
        </div>
      </div>

      {/* Mapping preview */}
      {mappingData && (mappingData.direct.length > 0 || mappingData.transitive.length > 0) && (
        <div className="mt-8 border-t border-gray-200 pt-6">
          <div className="flex items-center gap-2 mb-3">
            <GitCompareArrows className="h-4 w-4 text-indigo-500" aria-hidden="true" />
            <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              Mapping Coverage Preview
            </h4>
          </div>
          <p className="text-[12px] text-gray-500 mb-3">
            This implementation covers {mappingData.direct.length + mappingData.transitive.length} controls via cross-framework mappings:
          </p>
          <ul className="space-y-1" role="list">
            {[...mappingData.direct, ...mappingData.transitive].slice(0, 20).map((m: any, i: number) => (
              <li key={i} className="flex items-center gap-2 text-[12px]">
                <span className="font-mono bg-gray-50 px-1.5 py-0.5 rounded text-gray-700 border border-gray-100">
                  {m.catalogShortName}:{m.controlNativeId}
                </span>
                <span className="text-gray-400">{m.relationship} ({m.confidence}{m.isTransitive ? ', transitive' : ''})</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
