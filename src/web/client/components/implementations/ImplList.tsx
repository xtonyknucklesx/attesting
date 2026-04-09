import React from 'react';
import { useApi } from '../../hooks/useApi';
import { getImplementations, getControls } from '../../lib/api';

const STATUS_DOT_CLASS: Record<string, string> = {
  'implemented': 'status-dot-green',
  'partially-implemented': 'status-dot-amber',
  'planned': 'status-dot-blue',
  'not-applicable': 'status-dot-gray',
  'not-implemented': 'status-dot-rose',
};

interface ImplListProps {
  catalog: string; statusFilter: string; scope: string;
  selectedControlId: string | null; onSelect: (control: any) => void;
}

export default function ImplList({ catalog, statusFilter, scope, selectedControlId, onSelect }: ImplListProps) {
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

  if (loading) return <div className="p-4 text-[12px]" style={{ color: 'var(--text-dim)' }}>Loading...</div>;
  const items = catalog ? (data as any)?.controls ?? [] : (data as any)?.implementations ?? [];
  if (items.length === 0) return <div className="p-4 text-[12px]" style={{ color: 'var(--text-dim)' }}>No controls found</div>;

  return (
    <div className="flex-1 overflow-y-auto" role="listbox" aria-label="Controls">
      {items.map((item: any) => {
        const status = item.impl_status ?? item.status ?? 'not-implemented';
        const isSelected = item.id === selectedControlId;
        const dotCls = STATUS_DOT_CLASS[status] ?? 'status-dot-rose';
        return (
          <button key={item.id} role="option" aria-selected={isSelected}
            onClick={() => onSelect({ ...item, catalogShortName: item.catalog_short_name ?? catalog })}
            className="w-full text-left px-4 py-2.5 transition-colors duration-75"
            style={{
              borderBottom: '1px solid var(--border-subtle)',
              background: isSelected ? 'var(--bg-glass-active)' : 'transparent',
              borderLeft: isSelected ? '2px solid #818cf8' : '2px solid transparent',
            }}
            onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--row-hover)'; }}
            onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
          >
            <div className="flex items-center gap-2.5">
              <span className={`status-dot ${dotCls}`} role="img" aria-label={status} />
              <span className="text-[13px] font-mono font-medium" style={{ color: 'var(--text-primary)' }}>{item.control_id}</span>
            </div>
            <p className="text-[11px] mt-0.5 truncate ml-[18px]" style={{ color: 'var(--text-dim)' }}>
              {item.title ?? item.control_title}
            </p>
          </button>
        );
      })}
    </div>
  );
}
