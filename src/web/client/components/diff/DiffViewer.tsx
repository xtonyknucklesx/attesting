import React, { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { getCatalogs, runDiff } from '../../lib/api';
import { ArrowRight, Plus, Minus, PenLine, ArrowLeftRight, Check } from 'lucide-react';
import DOMPurify from 'dompurify';

const TYPE_BADGE: Record<string, { label: string; className: string; Icon: any }> = {
  added: { label: 'Added', className: 'bg-green-100 text-green-700', Icon: Plus },
  removed: { label: 'Removed', className: 'bg-red-100 text-red-700', Icon: Minus },
  modified: { label: 'Modified', className: 'bg-amber-100 text-amber-700', Icon: PenLine },
  renumbered: { label: 'Renumbered', className: 'bg-blue-100 text-blue-700', Icon: ArrowLeftRight },
  unchanged: { label: 'Unchanged', className: 'bg-gray-100 text-gray-500', Icon: Check },
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
    setLoading(true);
    setError('');
    try {
      const result = await runDiff(oldCatalog, newCatalog);
      setDiffResult(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleFilter = (type: string) => {
    setFilters((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const allChanges = diffResult ? [
    ...diffResult.added.map((c: any) => ({ ...c, _type: 'added' })),
    ...diffResult.removed.map((c: any) => ({ ...c, _type: 'removed' })),
    ...diffResult.modified.map((c: any) => ({ ...c, _type: 'modified' })),
    ...diffResult.renumbered.map((c: any) => ({ ...c, _type: 'renumbered' })),
    ...(filters.has('unchanged') ? diffResult.unchanged.map((c: any) => ({ ...c, _type: 'unchanged' })) : []),
  ].filter((c) => filters.has(c._type)) : [];

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Framework Version Diff</h2>

      {/* Selector */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1">
          <label htmlFor="old-catalog" className="block text-xs font-medium text-gray-600 mb-1">Old Version</label>
          <select
            id="old-catalog"
            value={oldCatalog}
            onChange={(e) => setOldCatalog(e.target.value)}
            className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Select catalog...</option>
            {catalogs?.map((c: any) => (
              <option key={c.short_name} value={c.short_name}>{c.name} ({c.short_name})</option>
            ))}
          </select>
        </div>
        <ArrowRight className="h-5 w-5 text-gray-400 mt-5 shrink-0" aria-hidden="true" />
        <div className="flex-1">
          <label htmlFor="new-catalog" className="block text-xs font-medium text-gray-600 mb-1">New Version</label>
          <select
            id="new-catalog"
            value={newCatalog}
            onChange={(e) => setNewCatalog(e.target.value)}
            className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Select catalog...</option>
            {catalogs?.map((c: any) => (
              <option key={c.short_name} value={c.short_name}>{c.name} ({c.short_name})</option>
            ))}
          </select>
        </div>
        <button
          onClick={handleDiff}
          disabled={loading || !oldCatalog || !newCatalog}
          className="mt-5 px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {loading ? 'Comparing...' : 'Compare'}
        </button>
      </div>

      {error && <p className="text-sm text-red-500 mb-4" role="alert">{error}</p>}

      {diffResult && (
        <>
          {/* Summary bar */}
          <div className="flex items-center gap-2 mb-4 flex-wrap" role="group" aria-label="Filter by change type">
            {Object.entries(diffResult.summary)
              .filter(([key]) => key !== 'total')
              .map(([key, count]) => {
                const badge = TYPE_BADGE[key];
                if (!badge) return null;
                const active = filters.has(key);
                return (
                  <button
                    key={key}
                    onClick={() => toggleFilter(key)}
                    aria-pressed={active}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      active ? badge.className + ' border-transparent' : 'bg-white border-gray-200 text-gray-400'
                    }`}
                  >
                    <badge.Icon className="h-3 w-3" aria-hidden="true" />
                    {badge.label}: {count as number}
                  </button>
                );
              })}
          </div>

          {/* Change table */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full" role="table">
              <caption className="sr-only">Diff results: {diffResult.oldCatalogShortName} vs {diffResult.newCatalogShortName}</caption>
              <thead className="bg-gray-50">
                <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <th scope="col" className="px-4 py-2 w-28">Type</th>
                  <th scope="col" className="px-4 py-2 w-32">Control ID</th>
                  <th scope="col" className="px-4 py-2">Title</th>
                  <th scope="col" className="px-4 py-2 w-24">Severity</th>
                  <th scope="col" className="px-4 py-2 w-32">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {allChanges.slice(0, 200).map((change: any, i: number) => {
                  const badge = TYPE_BADGE[change._type] ?? TYPE_BADGE['unchanged'];
                  const controlId = change.newControl?.control_id ?? change.oldControl?.control_id ?? '?';
                  const title = change.newControl?.title ?? change.oldControl?.title ?? '';
                  return (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${badge.className}`}>
                          <badge.Icon className="h-3 w-3" aria-hidden="true" />
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-sm">
                        {change.renumberedFrom && (
                          <span className="text-gray-400 line-through mr-1">{change.renumberedFrom}</span>
                        )}
                        {change.renumberedFrom && <ArrowRight className="inline h-3 w-3 text-gray-400 mr-1" aria-label="renamed to" />}
                        {controlId}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-gray-700 truncate max-w-md">{title}</td>
                      <td className="px-4 py-2.5 text-xs">
                        {change.severity && (
                          <span className={`px-1.5 py-0.5 rounded ${
                            change.severity === 'major' ? 'bg-red-100 text-red-700' :
                            change.severity === 'moderate' ? 'bg-amber-100 text-amber-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {change.severity}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-500">{change.actionNeeded?.replace(/-/g, ' ')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {allChanges.length > 200 && (
              <p className="px-4 py-2 text-xs text-gray-400 bg-gray-50">
                Showing first 200 of {allChanges.length} changes
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
