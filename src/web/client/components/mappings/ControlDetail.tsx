import React from 'react';
import { X, ExternalLink, Plus, Circle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ControlDetailProps {
  node: any;
  rootControl: any;
  allMappings: any[];
  onClose: () => void;
  onNavigate: (nodeId: string) => void;
}

const STATUS_INFO: Record<string, { dot: string; label: string; bg: string }> = {
  'implemented':            { dot: 'text-green-500', label: 'Implemented', bg: 'bg-green-50 border-green-200' },
  'partially-implemented':  { dot: 'text-amber-500', label: 'Partial', bg: 'bg-amber-50 border-amber-200' },
  'planned':                { dot: 'text-blue-500', label: 'Planned', bg: 'bg-blue-50 border-blue-200' },
  'not-applicable':         { dot: 'text-gray-400', label: 'N/A', bg: 'bg-gray-50 border-gray-200' },
};
const DEFAULT_STATUS = { dot: 'text-red-400', label: 'Not Implemented', bg: 'bg-red-50 border-red-200' };

export default function ControlDetail({ node, rootControl, allMappings, onClose, onNavigate }: ControlDetailProps) {
  const navigate = useNavigate();

  const isRoot = node.isRoot || (node.control_id === rootControl.control_id && node.catalog_short_name === rootControl.catalog_short_name);
  const controlId = node.controlNativeId ?? node.control_id;
  const catalog = node.catalogShortName ?? node.catalog_short_name;
  const catalogName = node.catalogName ?? catalog;
  const title = node.title ?? controlId;
  const description = node.description ?? '';
  const relationship = node.relationship ?? '';
  const confidence = node.confidence ?? '';
  const implStatus = node.implStatus ?? node.implStatus ?? null;
  const implStatement = node.implStatement ?? null;
  const implId = node.implId ?? null;
  const status = STATUS_INFO[implStatus ?? ''] ?? DEFAULT_STATUS;

  // Find other mappings for this control (it may appear mapped to other things)
  const otherMappings = allMappings.filter((m: any) => {
    const mId = `${m.catalogShortName}:${m.controlNativeId}`;
    const thisId = `${catalog}:${controlId}`;
    return mId !== thisId;
  });

  return (
    <aside
      className="w-80 border-l border-gray-200 bg-white flex flex-col shrink-0 overflow-y-auto"
      role="complementary"
      aria-label={`Details for ${catalog}:${controlId}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900 truncate">Control Detail</h3>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
          aria-label="Close detail panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Control identity */}
        <div>
          <p className="font-mono text-sm font-semibold text-indigo-700">{catalog}:{controlId}</p>
          <h4 className="text-sm font-medium text-gray-900 mt-1">{title}</h4>
          <p className="text-xs text-gray-500 mt-0.5">{catalogName}</p>
        </div>

        {/* Description */}
        {description && (
          <div>
            <h5 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Description</h5>
            <p className="text-xs text-gray-600 leading-relaxed">{description}</p>
          </div>
        )}

        {/* Mapping info (non-root) */}
        {!isRoot && (relationship || confidence) && (
          <div className="flex items-center gap-3">
            {relationship && (
              <div>
                <h5 className="text-[10px] font-semibold text-gray-500 uppercase">Relationship</h5>
                <p className="text-xs text-gray-900">{relationship}</p>
              </div>
            )}
            {confidence && (
              <div>
                <h5 className="text-[10px] font-semibold text-gray-500 uppercase">Confidence</h5>
                <p className={`text-xs font-medium ${
                  confidence === 'high' ? 'text-indigo-600' :
                  confidence === 'medium' ? 'text-amber-600' : 'text-gray-500'
                }`}>{confidence}</p>
              </div>
            )}
          </div>
        )}

        {/* Implementation status */}
        <div>
          <h5 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">Implementation</h5>
          <div className={`border rounded-lg p-3 ${status.bg}`}>
            <div className="flex items-center gap-2 mb-1">
              <Circle className={`h-3 w-3 fill-current ${status.dot}`} aria-hidden="true" />
              <span className="text-sm font-medium text-gray-900">{status.label}</span>
            </div>
            {implStatement && (
              <p className="text-xs text-gray-600 mt-1 leading-relaxed">{implStatement}</p>
            )}
            {!implStatement && implStatus && implStatus !== 'not-implemented' && (
              <p className="text-xs text-gray-400 italic">No statement recorded</p>
            )}
          </div>

          {/* Add implementation button */}
          {!implId && (
            <button
              onClick={() => navigate(`/implementations?catalog=${catalog}&control=${controlId}`)}
              className="mt-2 w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 rounded-md hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 border border-indigo-200"
            >
              <Plus className="h-3 w-3" aria-hidden="true" />
              Add Implementation
            </button>
          )}
        </div>

        {/* Other mappings from the resolve */}
        {otherMappings.length > 0 && (
          <div>
            <h5 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              Other Mappings in This Resolve ({otherMappings.length})
            </h5>
            <ul className="space-y-0.5 max-h-48 overflow-y-auto" role="list">
              {otherMappings.slice(0, 30).map((m: any, i: number) => {
                const mId = `${m.catalogShortName}:${m.controlNativeId}`;
                const mStatus = STATUS_INFO[m.implStatus ?? ''] ?? DEFAULT_STATUS;
                return (
                  <li key={i}>
                    <button
                      onClick={() => onNavigate(mId)}
                      className="w-full text-left flex items-center gap-1.5 px-2 py-1 rounded text-xs hover:bg-gray-50 transition-colors"
                    >
                      <Circle className={`h-2 w-2 fill-current shrink-0 ${mStatus.dot}`} aria-label={mStatus.label} />
                      <span className="font-mono text-gray-700 truncate">{mId}</span>
                      <ExternalLink className="h-2.5 w-2.5 text-gray-300 shrink-0 ml-auto" aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </aside>
  );
}
