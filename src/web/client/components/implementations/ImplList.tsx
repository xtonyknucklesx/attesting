import React from 'react';
import { useApi } from '../../hooks/useApi';
import { getImplementations, getControls } from '../../lib/api';

const STATUS_DOT: Record<string, string> = {
  'implemented': 'bg-green-500',
  'partially-implemented': 'bg-amber-500',
  'planned': 'bg-blue-500',
  'not-applicable': 'bg-gray-400',
  'not-implemented': 'bg-red-500',
};

interface ImplListProps {
  catalog: string;
  statusFilter: string;
  scope: string;
  selectedControlId: string | null;
  onSelect: (control: any) => void;
}

export default function ImplList({ catalog, statusFilter, scope, selectedControlId, onSelect }: ImplListProps) {
  // If catalog is selected, show controls from that catalog with impl status
  const params: Record<string, string> = { limit: '200' };
  if (statusFilter) params.status = statusFilter;
  if (scope) params.scope = scope;
  if (catalog) params.catalog = catalog;

  const { data, loading } = useApi(
    () => catalog
      ? getControls(catalog, { limit: '200', ...(statusFilter ? { status: statusFilter } : {}) })
      : getImplementations(params),
    [catalog, statusFilter, scope]
  );

  if (loading) return <div className="p-4 text-xs text-gray-400">Loading...</div>;

  const items = catalog
    ? (data as any)?.controls ?? []
    : (data as any)?.implementations ?? [];

  if (items.length === 0) {
    return <div className="p-4 text-xs text-gray-400">No controls found</div>;
  }

  return (
    <div className="flex-1 overflow-y-auto" role="listbox" aria-label="Controls">
      {items.map((item: any) => {
        const controlId = item.control_id;
        const status = item.impl_status ?? item.status ?? 'not-implemented';
        const isSelected = item.id === selectedControlId;
        const dot = STATUS_DOT[status] ?? STATUS_DOT['not-implemented'];

        return (
          <button
            key={item.id}
            role="option"
            aria-selected={isSelected}
            onClick={() => onSelect({
              ...item,
              catalogShortName: item.catalog_short_name ?? catalog,
            })}
            className={`w-full text-left px-4 py-2.5 border-b border-gray-100 transition-colors ${
              isSelected ? 'bg-indigo-50 border-l-2 border-l-indigo-600' : 'hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full shrink-0 ${dot}`}
                role="img" aria-label={status} />
              <span className="text-sm font-mono font-medium text-gray-900">{controlId}</span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5 truncate ml-4">
              {item.title ?? item.control_title}
            </p>
          </button>
        );
      })}
    </div>
  );
}
