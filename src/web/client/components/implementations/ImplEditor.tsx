import React, { useState, useEffect } from 'react';
import { useApi } from '../../hooks/useApi';
import { getImplementations, createImplementation, updateImplementation, resolveMappings } from '../../lib/api';
import { Save, GitCompareArrows } from 'lucide-react';

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

export default function ImplEditor({ control, scope }: ImplEditorProps) {
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
  const [saved, setSaved] = useState(false);
  const [implId, setImplId] = useState<string | null>(null);

  // Load existing implementation
  const { data: implData, refetch } = useApi(
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
    } else {
      setImplId(null);
      setStatus('not-implemented');
      setStatement('');
      setResponsibleRole('');
      setResponsiblePerson('');
      setResponsibilityType('provider');
      setSigResponse('');
    }
    setSaved(false);
  }, [controlId, implData]);

  // Live mapping preview
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
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl">
      {/* Control reference */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-mono font-semibold text-indigo-600">{catalogShortName}:{controlId}</span>
        </div>
        <h3 className="text-lg font-semibold text-gray-900">{control.title ?? control.control_title}</h3>
        <p className="text-sm text-gray-600 mt-2 leading-relaxed">
          {control.description ?? control.control_description ?? 'No description available'}
        </p>
      </div>

      {/* Editor form */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="impl-status" className="block text-xs font-medium text-gray-700 mb-1">
              Status <span aria-hidden="true" className="text-red-500">*</span>
            </label>
            <select
              id="impl-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              aria-required="true"
              className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="resp-type" className="block text-xs font-medium text-gray-700 mb-1">Responsibility</label>
            <select
              id="resp-type"
              value={responsibilityType}
              onChange={(e) => setResponsibilityType(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {RESP_TYPES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
        </div>

        {isSig && (
          <div>
            <label htmlFor="sig-response" className="block text-xs font-medium text-gray-700 mb-1">SIG Response</label>
            <select
              id="sig-response"
              value={sigResponse}
              onChange={(e) => setSigResponse(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">—</option>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
              <option value="N/A">N/A</option>
            </select>
          </div>
        )}

        <div>
          <label htmlFor="impl-statement" className="block text-xs font-medium text-gray-700 mb-1">
            Implementation Statement
          </label>
          <textarea
            id="impl-statement"
            value={statement}
            onChange={(e) => setStatement(e.target.value)}
            rows={6}
            className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
            placeholder="Describe how this control is implemented..."
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="resp-role" className="block text-xs font-medium text-gray-700 mb-1">Responsible Role</label>
            <input
              id="resp-role"
              value={responsibleRole}
              onChange={(e) => setResponsibleRole(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g., Security Engineer"
            />
          </div>
          <div>
            <label htmlFor="resp-person" className="block text-xs font-medium text-gray-700 mb-1">Responsible Person</label>
            <input
              id="resp-person"
              value={responsiblePerson}
              onChange={(e) => setResponsiblePerson(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g., Jane Smith"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            {saving ? 'Saving...' : 'Save'}
          </button>
          {saved && (
            <span className="text-sm text-green-600" role="status" aria-live="polite">Saved</span>
          )}
        </div>
      </div>

      {/* Live mapping preview */}
      {mappingData && (mappingData.direct.length > 0 || mappingData.transitive.length > 0) && (
        <div className="mt-8 border-t border-gray-200 pt-6">
          <div className="flex items-center gap-2 mb-3">
            <GitCompareArrows className="h-4 w-4 text-indigo-500" aria-hidden="true" />
            <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wider">
              Mapping Coverage Preview
            </h4>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            This implementation will also cover these controls via cross-framework mappings:
          </p>
          <ul className="space-y-1" role="list">
            {[...mappingData.direct, ...mappingData.transitive].slice(0, 20).map((m: any, i: number) => (
              <li key={i} className="flex items-center gap-2 text-xs">
                <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">
                  {m.catalogShortName}:{m.controlNativeId}
                </span>
                <span className="text-gray-400">
                  {m.relationship} ({m.confidence}{m.isTransitive ? ', transitive' : ''})
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
