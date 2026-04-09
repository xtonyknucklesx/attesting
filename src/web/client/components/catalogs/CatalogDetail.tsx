import React, { useState, useCallback } from 'react';
import { useApi } from '../../hooks/useApi';
import { useDebounce } from '../../hooks/useDebounce';
import { getControls, resolveMappings } from '../../lib/api';
import { Search, ChevronDown, ChevronRight, GitCompareArrows, Circle } from 'lucide-react';

const STATUS_PILL: Record<string, { label: string; className: string }> = {
  'implemented':            { label: 'Implemented', className: 'bg-green-50 text-green-700 border-green-200' },
  'partially-implemented':  { label: 'Partial', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  'planned':                { label: 'Planned', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  'not-applicable':         { label: 'N/A', className: 'bg-gray-50 text-gray-500 border-gray-200' },
  'not-implemented':        { label: 'Not Impl.', className: 'bg-rose-50 text-rose-600 border-rose-200' },
};

interface CatalogDetailProps {
  shortName: string;
  scope: string;
}

export default function CatalogDetail({ shortName, scope }: CatalogDetailProps) {
  const [searchRaw, setSearchRaw] = useState('');
  const search = useDebounce(searchRaw, 300);
  const [statusFilter, setStatusFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [mappings, setMappings] = useState<any>(null);

  const params: Record<string, string> = { limit: '100' };
  if (search) params.search = search;
  if (statusFilter) params.status = statusFilter;

  const { data, loading } = useApi(
    () => getControls(shortName, params),
    [shortName, search, statusFilter]
  );

  const handleExpand = useCallback(async (controlId: string) => {
    if (expandedId === controlId) { setExpandedId(null); setMappings(null); return; }
    setExpandedId(controlId);
    try {
      const result = await resolveMappings(shortName, controlId);
      setMappings(result);
    } catch { setMappings(null); }
  }, [expandedId, shortName]);

  return (
    <div className="flex flex-col h-full">
      {/* Search + filters */}
      <div className="flex items-center gap-3 p-4 border-b border-gray-200 bg-white">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2 h-4 w-4 text-gray-400" aria-hidden="true" />
          <label htmlFor="control-search" className="sr-only">Search controls</label>
          <input
            id="control-search" type="search" value={searchRaw}
            onChange={(e) => setSearchRaw(e.target.value)}
            placeholder="Search controls..."
            className="w-full pl-8 pr-3 py-1.5 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
          />
        </div>
        <label htmlFor="status-filter" className="sr-only">Filter by status</label>
        <select
          id="status-filter" value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-[12px] border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
        >
          <option value="">All statuses</option>
          <option value="implemented">Implemented</option>
          <option value="partially-implemented">Partial</option>
          <option value="planned">Planned</option>
          <option value="not-applicable">N/A</option>
          <option value="not-implemented">Not Implemented</option>
        </select>
        {data && <span className="text-[11px] text-gray-400 shrink-0">{data.total} controls</span>}
      </div>

      {/* Controls table */}
      <div className="flex-1 overflow-auto bg-slate-50">
        {loading ? (
          <div className="p-6 text-[13px] text-gray-400">Loading controls...</div>
        ) : (
          <table className="w-full" role="table">
            <caption className="sr-only">{shortName} controls</caption>
            <thead className="bg-white sticky top-0 z-10 border-b border-gray-200">
              <tr className="text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                <th scope="col" className="pl-4 pr-2 py-2.5 w-8"></th>
                <th scope="col" className="px-3 py-2.5 w-28">ID</th>
                <th scope="col" className="px-3 py-2.5">Title</th>
                <th scope="col" className="px-3 py-2.5 w-28">Status</th>
                <th scope="col" className="px-3 py-2.5 w-20 text-center">Mapped</th>
              </tr>
            </thead>
            <tbody>
              {data?.controls.map((ctrl: any, idx: number) => {
                const isExpanded = expandedId === ctrl.control_id;
                const badge = STATUS_PILL[ctrl.impl_status] ?? STATUS_PILL['not-implemented'];
                return (
                  <React.Fragment key={ctrl.id}>
                    <tr
                      className={`border-b border-gray-100 cursor-pointer transition-colors duration-75 ${
                        isExpanded ? 'bg-indigo-50/60' : idx % 2 === 1 ? 'bg-gray-50/40 hover:bg-gray-100/40' : 'bg-white hover:bg-gray-50'
                      }`}
                      onClick={() => handleExpand(ctrl.control_id)}
                    >
                      <td className="pl-4 pr-2 py-3">
                        <button aria-expanded={isExpanded} aria-label={`Expand ${ctrl.control_id}`} className="text-gray-400 hover:text-gray-600">
                          {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        </button>
                      </td>
                      <td className="px-3 py-3 text-[13px] font-mono font-medium text-gray-900">{ctrl.control_id}</td>
                      <td className="px-3 py-3 text-[13px] text-gray-600 truncate max-w-md">{ctrl.title}</td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${badge.className}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        {ctrl.mapping_count > 0 && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-indigo-600 font-medium">
                            <GitCompareArrows className="h-3 w-3" aria-hidden="true" />
                            {ctrl.mapping_count}
                          </span>
                        )}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={5} className="bg-white border-b border-gray-100">
                          <div className="px-6 py-4 animate-fade-in space-y-3">
                            <div>
                              <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Description</h4>
                              <p className="text-[13px] text-gray-600 leading-relaxed">{ctrl.description || 'No description'}</p>
                            </div>
                            {mappings && (mappings.direct.length > 0 || mappings.transitive.length > 0) && (
                              <div>
                                <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                                  Mappings ({mappings.direct.length} direct, {mappings.transitive.length} transitive)
                                </h4>
                                <ul className="space-y-1" role="list">
                                  {[...mappings.direct, ...mappings.transitive].slice(0, 15).map((m: any, i: number) => {
                                    const mStatus = STATUS_PILL[m.implStatus] ?? null;
                                    return (
                                      <li key={i} className="flex items-center gap-2 text-[12px]">
                                        <Circle className={`h-2 w-2 fill-current shrink-0 ${
                                          m.implStatus === 'implemented' ? 'text-green-500' :
                                          m.implStatus ? 'text-amber-500' : 'text-gray-300'
                                        }`} aria-hidden="true" />
                                        <span className="font-mono text-indigo-700 font-medium">{m.catalogShortName}:{m.controlNativeId}</span>
                                        <span className="text-gray-400">{m.relationship}</span>
                                        <span className="text-gray-300">({m.confidence})</span>
                                        {m.isTransitive && <span className="text-[10px] italic text-gray-400">transitive</span>}
                                      </li>
                                    );
                                  })}
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
