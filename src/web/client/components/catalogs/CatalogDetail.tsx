import React, { useState, useCallback } from 'react';
import { useApi } from '../../hooks/useApi';
import { useDebounce } from '../../hooks/useDebounce';
import { substituteParams } from '../../lib/params';
import { getControls, resolveMappings } from '../../lib/api';
import { Search, ChevronDown, ChevronRight, GitCompareArrows } from 'lucide-react';

const STATUS_PILL: Record<string, { label: string; cls: string }> = {
  'implemented':            { label: 'Implemented', cls: 'pill-green' },
  'partially-implemented':  { label: 'Partial', cls: 'pill-amber' },
  'planned':                { label: 'Planned', cls: 'pill-blue' },
  'not-applicable':         { label: 'N/A', cls: 'pill-gray' },
  'not-implemented':        { label: 'Not Impl.', cls: 'pill-rose' },
};

const STATUS_DOT: Record<string, string> = {
  'implemented': 'status-dot-green',
  'partially-implemented': 'status-dot-amber',
  'planned': 'status-dot-blue',
  'not-applicable': 'status-dot-gray',
};

export default function CatalogDetail({ shortName, scope }: { shortName: string; scope: string }) {
  const [searchRaw, setSearchRaw] = useState('');
  const search = useDebounce(searchRaw, 300);
  const [statusFilter, setStatusFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [mappings, setMappings] = useState<any>(null);

  const params: Record<string, string> = { limit: '100' };
  if (search) params.search = search;
  if (statusFilter) params.status = statusFilter;

  const { data, loading } = useApi(() => getControls(shortName, params), [shortName, search, statusFilter]);

  const handleExpand = useCallback(async (controlId: string) => {
    if (expandedId === controlId) { setExpandedId(null); setMappings(null); return; }
    setExpandedId(controlId);
    try { setMappings(await resolveMappings(shortName, controlId)); } catch { setMappings(null); }
  }, [expandedId, shortName]);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 p-4 glass-header">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2 h-4 w-4" style={{ color: 'var(--text-dim)' }} aria-hidden="true" />
          <label htmlFor="control-search" className="sr-only">Search controls</label>
          <input id="control-search" type="search" value={searchRaw} onChange={(e) => setSearchRaw(e.target.value)}
            placeholder="Search controls..." className="input-glass w-full pl-9" />
        </div>
        <label htmlFor="status-filter" className="sr-only">Filter by status</label>
        <select id="status-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="input-glass text-[12px]">
          <option value="">All statuses</option>
          <option value="implemented">Implemented</option>
          <option value="partially-implemented">Partial</option>
          <option value="planned">Planned</option>
          <option value="not-applicable">N/A</option>
          <option value="not-implemented">Not Implemented</option>
        </select>
        {data && <span className="text-[11px] shrink-0" style={{ color: 'var(--text-dim)' }}>{data.total} controls</span>}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-6 text-[13px]" style={{ color: 'var(--text-dim)' }}>Loading controls...</div>
        ) : (
          <table className="w-full glass-table" role="table">
            <caption className="sr-only">{shortName} controls</caption>
            <thead className="sticky top-0 z-10">
              <tr>
                <th scope="col" className="pl-4 pr-2 w-8"></th>
                <th scope="col" className="w-40">ID</th>
                <th scope="col">Title</th>
                <th scope="col" className="w-28">Status</th>
                <th scope="col" className="w-20 text-center">Mapped</th>
              </tr>
            </thead>
            <tbody>
              {data?.controls.map((ctrl: any) => {
                const isExpanded = expandedId === ctrl.control_id;
                const pill = STATUS_PILL[ctrl.impl_status] ?? STATUS_PILL['not-implemented'];
                return (
                  <React.Fragment key={ctrl.id}>
                    <tr onClick={() => handleExpand(ctrl.control_id)} className="cursor-pointer"
                      style={isExpanded ? { background: 'var(--bg-glass-active)' } : undefined}>
                      <td className="pl-4 pr-2">
                        <button aria-expanded={isExpanded} aria-label={`Expand ${ctrl.control_id}`} style={{ color: 'var(--text-dim)' }}>
                          {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        </button>
                      </td>
                      <td className="font-mono font-medium whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>{ctrl.control_id}</td>
                      <td className="truncate max-w-md">{ctrl.title}</td>
                      <td><span className={`pill ${pill.cls}`}>{pill.label}</span></td>
                      <td className="text-center">
                        {ctrl.mapping_count > 0 && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-indigo-400 font-medium">
                            <GitCompareArrows className="h-3 w-3" aria-hidden="true" />{ctrl.mapping_count}
                          </span>
                        )}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={5} style={{ background: 'var(--bg-glass)', borderBottom: '1px solid var(--border-subtle)' }}>
                          <div className="px-6 py-4 animate-fade-in space-y-3">
                            <div>
                              <h4 className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-dim)' }}>Description</h4>
                              <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{substituteParams(ctrl.description, null) || 'No description'}</p>
                            </div>
                            {mappings && (mappings.direct.length > 0 || mappings.transitive.length > 0) && (
                              <div>
                                <h4 className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-dim)' }}>
                                  Mappings ({mappings.direct.length} direct, {mappings.transitive.length} transitive)
                                </h4>
                                <ul className="space-y-1" role="list">
                                  {[...mappings.direct, ...mappings.transitive].slice(0, 15).map((m: any, i: number) => (
                                    <li key={i} className="flex items-center gap-2 text-[12px]">
                                      <span className={`status-dot ${STATUS_DOT[m.implStatus] ?? 'status-dot-rose'}`} aria-hidden="true" />
                                      <span className="font-mono text-indigo-400 font-medium">{m.catalogShortName}:{m.controlNativeId}</span>
                                      <span style={{ color: 'var(--text-dim)' }}>{m.relationship} ({m.confidence})</span>
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
