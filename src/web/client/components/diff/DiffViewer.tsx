import React, { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { getCatalogs, runDiff } from '../../lib/api';
import { ArrowRight, Plus, Minus, PenLine, ArrowLeftRight, Check, Circle } from 'lucide-react';

const TYPE_BADGE: Record<string, { label: string; className: string; Icon: any }> = {
  added:      { label: 'Added', className: 'bg-green-50 text-green-700 border-green-200', Icon: Plus },
  removed:    { label: 'Removed', className: 'bg-rose-50 text-rose-700 border-rose-200', Icon: Minus },
  modified:   { label: 'Modified', className: 'bg-amber-50 text-amber-700 border-amber-200', Icon: PenLine },
  renumbered: { label: 'Renumbered', className: 'bg-blue-50 text-blue-700 border-blue-200', Icon: ArrowLeftRight },
  unchanged:  { label: 'Unchanged', className: 'bg-gray-50 text-gray-500 border-gray-200', Icon: Check },
};

const SEVERITY_DOT: Record<string, string> = {
  major: 'text-rose-500',
  moderate: 'text-amber-500',
  minor: 'text-green-500',
};

export default function DiffViewer() {
  const [oldCatalog, setOldCatalog] = useState('');
  const [newCatalog, setNewCatalog] = useState('');
  const [diffResult, setDiffResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState<Set<string>>(new Set(['added', 'removed', 'modified', 'renumbered']));
  const { data: catalogs } = useApi(() => getCatalogs(), []);

  const handleDiff = async () => {
    if (!oldCatalog || !newCatalog) return;
    setLoading(true); setError('');
    try { setDiffResult(await runDiff(oldCatalog, newCatalog)); }
    catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const toggleFilter = (type: string) => {
    setFilters((prev) => { const n = new Set(prev); if (n.has(type)) n.delete(type); else n.add(type); return n; });
  };

  const allChanges = diffResult ? [
    ...diffResult.added.map((c: any) => ({ ...c, _type: 'added' })),
    ...diffResult.removed.map((c: any) => ({ ...c, _type: 'removed' })),
    ...diffResult.modified.map((c: any) => ({ ...c, _type: 'modified' })),
    ...diffResult.renumbered.map((c: any) => ({ ...c, _type: 'renumbered' })),
    ...(filters.has('unchanged') ? diffResult.unchanged.map((c: any) => ({ ...c, _type: 'unchanged' })) : []),
  ].filter((c) => filters.has(c._type)) : [];

  return (
    <div className="p-6 lg:p-8 max-w-[1200px] mx-auto">
      <h2 className="text-[18px] font-semibold text-gray-900 mb-5 tracking-tight">Framework Version Diff</h2>

      {/* Selector */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1">
          <label htmlFor="old-catalog" className="block text-[12px] font-medium text-gray-600 mb-1.5">Old Version</label>
          <select id="old-catalog" value={oldCatalog} onChange={(e) => setOldCatalog(e.target.value)}
            className="w-full text-[13px] border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors">
            <option value="">Select catalog...</option>
            {catalogs?.map((c: any) => <option key={c.short_name} value={c.short_name}>{c.name} ({c.short_name})</option>)}
          </select>
        </div>
        <ArrowRight className="h-4 w-4 text-gray-300 mt-6 shrink-0" aria-hidden="true" />
        <div className="flex-1">
          <label htmlFor="new-catalog" className="block text-[12px] font-medium text-gray-600 mb-1.5">New Version</label>
          <select id="new-catalog" value={newCatalog} onChange={(e) => setNewCatalog(e.target.value)}
            className="w-full text-[13px] border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors">
            <option value="">Select catalog...</option>
            {catalogs?.map((c: any) => <option key={c.short_name} value={c.short_name}>{c.name} ({c.short_name})</option>)}
          </select>
        </div>
        <button onClick={handleDiff} disabled={loading || !oldCatalog || !newCatalog}
          className="mt-6 px-5 py-2 bg-indigo-600 text-white text-[13px] font-medium rounded-lg hover:bg-indigo-700 active:bg-indigo-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 transition-colors duration-150">
          {loading ? 'Comparing...' : 'Compare'}
        </button>
      </div>

      {error && <p className="text-[13px] text-rose-500 mb-4" role="alert">{error}</p>}

      {diffResult && (
        <div className="animate-fade-in">
          {/* Summary */}
          <div className="flex items-center gap-2 mb-5 flex-wrap" role="group" aria-label="Filter by change type">
            {Object.entries(diffResult.summary).filter(([k]) => k !== 'total').map(([key, count]) => {
              const badge = TYPE_BADGE[key]; if (!badge) return null;
              const active = filters.has(key);
              return (
                <button key={key} onClick={() => toggleFilter(key)} aria-pressed={active}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium border transition-all duration-100 ${
                    active ? badge.className : 'bg-white border-gray-200 text-gray-400'}`}>
                  <badge.Icon className="h-3 w-3" aria-hidden="true" />
                  {badge.label}: {count as number}
                </button>
              );
            })}
          </div>

          {/* Table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full" role="table">
              <caption className="sr-only">Diff: {diffResult.oldCatalogShortName} vs {diffResult.newCatalogShortName}</caption>
              <thead className="bg-gray-50/50">
                <tr className="text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                  <th scope="col" className="px-4 py-2.5 w-28">Type</th>
                  <th scope="col" className="px-4 py-2.5 w-32">Control ID</th>
                  <th scope="col" className="px-4 py-2.5">Title</th>
                  <th scope="col" className="px-4 py-2.5 w-20 text-center">Severity</th>
                  <th scope="col" className="px-4 py-2.5 w-32">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {allChanges.slice(0, 200).map((change: any, i: number) => {
                  const badge = TYPE_BADGE[change._type] ?? TYPE_BADGE['unchanged'];
                  const controlId = change.newControl?.control_id ?? change.oldControl?.control_id ?? '?';
                  const title = change.newControl?.title ?? change.oldControl?.title ?? '';
                  const sevDot = SEVERITY_DOT[change.severity] ?? '';
                  return (
                    <tr key={i} className={`transition-colors duration-75 ${i % 2 === 1 ? 'bg-gray-50/30' : ''} hover:bg-gray-50`}>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${badge.className}`}>
                          <badge.Icon className="h-3 w-3" aria-hidden="true" />
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[13px]">
                        {change.renumberedFrom && (
                          <><span className="text-gray-400 line-through">{change.renumberedFrom}</span>
                          <ArrowRight className="inline h-3 w-3 text-gray-300 mx-1" aria-label="renamed to" /></>
                        )}
                        {controlId}
                      </td>
                      <td className="px-4 py-2.5 text-[13px] text-gray-600 truncate max-w-md">{title}</td>
                      <td className="px-4 py-2.5 text-center">
                        {change.severity && (
                          <Circle className={`h-3 w-3 fill-current mx-auto ${sevDot}`} aria-label={change.severity} />
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-[11px] text-gray-500">{change.actionNeeded?.replace(/-/g, ' ')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {allChanges.length > 200 && (
              <p className="px-4 py-2 text-[11px] text-gray-400 bg-gray-50">Showing first 200 of {allChanges.length}</p>
            )}
          </div>
        </div>
      )}

      {!diffResult && !loading && (
        <div className="text-center py-16">
          <ArrowLeftRight className="h-8 w-8 mx-auto mb-3 text-gray-200" aria-hidden="true" />
          <p className="text-[13px] text-gray-400">Select two catalog versions to compare</p>
        </div>
      )}
    </div>
  );
}
