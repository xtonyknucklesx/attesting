import React, { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { getCatalogs, getControls } from '../../lib/api';
import ImplList from './ImplList';
import ImplEditor from './ImplEditor';

interface ImplWorkspaceProps {
  scope: string;
}

export default function ImplWorkspace({ scope }: ImplWorkspaceProps) {
  const [selectedCatalog, setSelectedCatalog] = useState('');
  const [selectedControl, setSelectedControl] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const { data: catalogs } = useApi(() => getCatalogs(), []);

  return (
    <div className="flex h-[calc(100vh-57px)]">
      {/* Left: Control list */}
      <div className="w-96 border-r border-gray-200 bg-white flex flex-col shrink-0">
        <div className="p-3 border-b border-gray-200 space-y-2">
          <label htmlFor="impl-catalog-filter" className="sr-only">Filter by framework</label>
          <select
            id="impl-catalog-filter"
            value={selectedCatalog}
            onChange={(e) => { setSelectedCatalog(e.target.value); setSelectedControl(null); }}
            className="w-full text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All frameworks</option>
            {catalogs?.map((c: any) => (
              <option key={c.short_name} value={c.short_name}>{c.name}</option>
            ))}
          </select>
          <label htmlFor="impl-status-filter" className="sr-only">Filter by status</label>
          <select
            id="impl-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All statuses</option>
            <option value="implemented">Implemented</option>
            <option value="partially-implemented">Partial</option>
            <option value="planned">Planned</option>
            <option value="not-applicable">N/A</option>
            <option value="not-implemented">Not Implemented</option>
          </select>
        </div>
        <ImplList
          catalog={selectedCatalog}
          statusFilter={statusFilter}
          scope={scope}
          selectedControlId={selectedControl?.id}
          onSelect={setSelectedControl}
        />
      </div>

      {/* Right: Editor */}
      <div className="flex-1 min-w-0 overflow-auto bg-gray-50">
        {selectedControl ? (
          <ImplEditor control={selectedControl} scope={scope} />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            Select a control from the list to view or edit its implementation
          </div>
        )}
      </div>
    </div>
  );
}
