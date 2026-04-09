import React, { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { getCatalogs } from '../../lib/api';
import ImplList from './ImplList';
import ImplEditor from './ImplEditor';

export default function ImplWorkspace({ scope }: { scope: string }) {
  const [selectedCatalog, setSelectedCatalog] = useState('');
  const [selectedControl, setSelectedControl] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const { data: catalogs } = useApi(() => getCatalogs(), []);

  return (
    <div className="flex h-[calc(100vh-49px)]">
      {/* Left panel */}
      <div className="w-96 glass-panel flex flex-col shrink-0" style={{ borderRadius: 0, borderRight: '1px solid var(--border-glass)' }}>
        <div className="p-3 space-y-2" style={{ borderBottom: '1px solid var(--border-glass)' }}>
          <label htmlFor="impl-catalog-filter" className="sr-only">Filter by framework</label>
          <select id="impl-catalog-filter" value={selectedCatalog}
            onChange={(e) => { setSelectedCatalog(e.target.value); setSelectedControl(null); }}
            className="input-glass w-full text-[12px]">
            <option value="">All frameworks</option>
            {catalogs?.map((c: any) => <option key={c.short_name} value={c.short_name}>{c.name}</option>)}
          </select>
          <label htmlFor="impl-status-filter" className="sr-only">Filter by status</label>
          <select id="impl-status-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="input-glass w-full text-[12px]">
            <option value="">All statuses</option>
            <option value="implemented">Implemented</option>
            <option value="partially-implemented">Partial</option>
            <option value="planned">Planned</option>
            <option value="not-applicable">N/A</option>
            <option value="not-implemented">Not Implemented</option>
          </select>
        </div>
        <ImplList catalog={selectedCatalog} statusFilter={statusFilter} scope={scope}
          selectedControlId={selectedControl?.id} onSelect={setSelectedControl} />
      </div>
      {/* Right panel */}
      <div className="flex-1 min-w-0 overflow-auto">
        {selectedControl ? (
          <ImplEditor control={selectedControl} scope={scope} />
        ) : (
          <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-dim)' }}>
            <p className="text-[13px]">Select a control to view or edit its implementation</p>
          </div>
        )}
      </div>
    </div>
  );
}
