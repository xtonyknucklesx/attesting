import React, { useState, useCallback } from 'react';
import { useApi } from '../../hooks/useApi';
import { getControls, resolveMappings } from '../../lib/api';
import { Search, ChevronDown, ChevronRight, GitCompareArrows } from 'lucide-react';

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  'implemented': { label: 'Implemented', className: 'bg-green-100 text-green-700' },
  'partially-implemented': { label: 'Partial', className: 'bg-amber-100 text-amber-700' },
  'planned': { label: 'Planned', className: 'bg-blue-100 text-blue-700' },
  'not-applicable': { label: 'N/A', className: 'bg-gray-100 text-gray-600' },
  'not-implemented': { label: 'Not Impl.', className: 'bg-red-100 text-red-700' },
};

interface CatalogDetailProps {
  shortName: string;
  scope: string;
}

export default function CatalogDetail({ shortName, scope }: CatalogDetailProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [mappings, setMappings] = useState<any>(null);

  const params: Record<string, string> = { limit: '100' };
  if (search) params.search = search;
  if (statusFilter) params.status = statusFilter;

  const { data, loading, refetch } = useApi(
    () => getControls(shortName, params),
    [shortName, search, statusFilter]
  );

  const handleExpand = useCallback(async (controlId: string) => {
    if (expandedId === controlId) {
      setExpandedId(null);
      setMappings(null);
      return;
    }
    setExpandedId(controlId);
    try {
      const result = await resolveMappings(shortName, controlId);
      setMappings(result);
    } catch {
      setMappings(null);
    }
  }, [expandedId, shortName]);

  return (
    <div className="flex flex-col h-full">
      {/* Search + filters */}
      <div className="flex items-center gap-3 p-4 border-b border-gray-200 bg-white">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2 h-4 w-4 text-gray-400" aria-hidden="true" />
          <label htmlFor="control-search" className="sr-only">Search controls</label>
          <input
            id="control-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search controls..."
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <label htmlFor="status-filter" className="sr-only">Filter by status</label>
        <select
          id="status-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-sm border border-gray-300 rounded-md px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All statuses</option>
          <option value="implemented">Implemented</option>
          <option value="partially-implemented">Partial</option>
          <option value="planned">Planned</option>
          <option value="not-applicable">N/A</option>
          <option value="not-implemented">Not Implemented</option>
        </select>
        {data && (
          <span className="text-xs text-gray-500 shrink-0">{data.total} controls</span>
        )}
      </div>

      {/* Controls table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-6 text-sm text-gray-400">Loading controls...</div>
        ) : (
          <table className="w-full" role="table">
            <caption className="sr-only">{shortName} controls</caption>
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <th scope="col" className="pl-4 pr-2 py-2 w-8"></th>
                <th scope="col" className="px-3 py-2 w-28">ID</th>
                <th scope="col" className="px-3 py-2">Title</th>
                <th scope="col" className="px-3 py-2 w-28">Status</th>
                <th scope="col" className="px-3 py-2 w-20 text-center">Mapped</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data?.controls.map((ctrl: any) => {
                const isExpanded = expandedId === ctrl.control_id;
                const badge = STATUS_BADGE[ctrl.impl_status] ?? STATUS_BADGE['not-implemented'];
                return (
                  <React.Fragment key={ctrl.id}>
                    <tr
                      className={`hover:bg-gray-50 cursor-pointer ${isExpanded ? 'bg-indigo-50' : ''}`}
                      onClick={() => handleExpand(ctrl.control_id)}
                      role="row"
                    >
                      <td className="pl-4 pr-2 py-2.5">
                        <button
                          aria-expanded={isExpanded}
                          aria-label={`Expand ${ctrl.control_id}`}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 text-sm font-mono font-medium text-gray-900">{ctrl.control_id}</td>
                      <td className="px-3 py-2.5 text-sm text-gray-700 truncate max-w-md">{ctrl.title}</td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${badge.className}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {ctrl.mapping_count > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs text-indigo-600">
                            <GitCompareArrows className="h-3 w-3" aria-hidden="true" />
                            {ctrl.mapping_count}
                          </span>
                        )}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={5} className="bg-gray-50 px-6 py-4">
                          <div className="space-y-3 text-sm">
                            <div>
                              <h4 className="font-medium text-gray-900 text-xs uppercase tracking-wider mb-1">Description</h4>
                              <p className="text-gray-600 text-sm leading-relaxed">{ctrl.description || 'No description'}</p>
                            </div>
                            {mappings && mappings.direct.length > 0 && (
                              <div>
                                <h4 className="font-medium text-gray-900 text-xs uppercase tracking-wider mb-1">
                                  Mappings ({mappings.direct.length} direct, {mappings.transitive.length} transitive)
                                </h4>
                                <ul className="space-y-1" role="list">
                                  {[...mappings.direct, ...mappings.transitive].slice(0, 15).map((m: any, i: number) => (
                                    <li key={i} className="flex items-center gap-2 text-xs">
                                      <span className={`px-1.5 py-0.5 rounded font-mono ${
                                        m.isTransitive ? 'bg-gray-100 text-gray-600' : 'bg-indigo-100 text-indigo-700'
                                      }`}>
                                        {m.catalogShortName}:{m.controlNativeId}
                                      </span>
                                      <span className="text-gray-400">{m.relationship} ({m.confidence})</span>
                                      {m.implStatus && (
                                        <span className={`px-1 py-0.5 rounded text-[10px] ${
                                          STATUS_BADGE[m.implStatus]?.className ?? ''
                                        }`}>
                                          {STATUS_BADGE[m.implStatus]?.label ?? m.implStatus}
                                        </span>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
