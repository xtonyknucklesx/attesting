import React from 'react';
import { ChevronRight } from 'lucide-react';

interface ResolveViewProps {
  data: {
    control: { control_id: string; catalog_short_name: string; title: string; description: string };
    direct: any[];
    transitive: any[];
  };
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  'implemented': { label: 'Impl', className: 'bg-green-100 text-green-700' },
  'partially-implemented': { label: 'Partial', className: 'bg-amber-100 text-amber-700' },
  'planned': { label: 'Planned', className: 'bg-blue-100 text-blue-700' },
  'not-applicable': { label: 'N/A', className: 'bg-gray-100 text-gray-600' },
  'not-implemented': { label: 'Not Impl', className: 'bg-red-100 text-red-700' },
};

export default function ResolveView({ data }: ResolveViewProps) {
  return (
    <div className="p-6 max-w-3xl">
      <h3 className="text-lg font-semibold text-gray-900 mb-1">
        {data.control.catalog_short_name}:{data.control.control_id}
      </h3>
      <p className="text-sm text-gray-600 mb-4">{data.control.title}</p>
      {data.control.description && (
        <p className="text-xs text-gray-500 mb-6 leading-relaxed">{data.control.description}</p>
      )}

      {/* Direct mappings */}
      {data.direct.length > 0 && (
        <section aria-label="Direct mappings">
          <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-2">
            Direct Mappings ({data.direct.length})
          </h4>
          <ul className="space-y-1 mb-6" role="list">
            {data.direct.map((m: any, i: number) => (
              <li key={i} className="flex items-center gap-2 py-1.5 px-3 rounded hover:bg-gray-50 text-sm">
                <ChevronRight className="h-3 w-3 text-indigo-400 shrink-0" aria-hidden="true" />
                <span className="font-mono text-indigo-700 font-medium">{m.catalogShortName}:{m.controlNativeId}</span>
                <span className="text-gray-400 text-xs">{m.relationship}</span>
                <span className="text-gray-300 text-xs">({m.confidence})</span>
                {m.implStatus && (
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    STATUS_BADGE[m.implStatus]?.className ?? ''
                  }`}>
                    {STATUS_BADGE[m.implStatus]?.label ?? m.implStatus}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Transitive mappings */}
      {data.transitive.length > 0 && (
        <section aria-label="Transitive mappings">
          <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-2">
            Transitive Mappings ({data.transitive.length})
          </h4>
          <ul className="space-y-1" role="list">
            {data.transitive.map((m: any, i: number) => (
              <li key={i} className="flex items-center gap-2 py-1.5 px-3 rounded hover:bg-gray-50 text-sm">
                <span className="text-gray-300 text-xs ml-3" aria-hidden="true">└─</span>
                <span className="font-mono text-gray-600">{m.catalogShortName}:{m.controlNativeId}</span>
                <span className="text-gray-400 text-xs">{m.relationship}</span>
                <span className="text-gray-300 text-xs">({m.confidence})</span>
                {m.implStatus && (
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    STATUS_BADGE[m.implStatus]?.className ?? ''
                  }`}>
                    {STATUS_BADGE[m.implStatus]?.label ?? m.implStatus}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.direct.length === 0 && data.transitive.length === 0 && (
        <p className="text-sm text-gray-400">No mappings found for this control.</p>
      )}
    </div>
  );
}
