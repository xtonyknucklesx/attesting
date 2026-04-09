import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Circle } from 'lucide-react';

interface ResolveViewProps {
  data: {
    control: { control_id: string; catalog_short_name: string; title: string; description: string; implStatus?: string | null };
    direct: any[];
    transitive: any[];
  };
  onNodeClick: (nodeId: string) => void;
  onNavigate: (nodeId: string) => void;
}

const STATUS_INFO: Record<string, { dot: string; label: string }> = {
  'implemented':            { dot: 'text-green-500', label: 'Implemented' },
  'partially-implemented':  { dot: 'text-amber-500', label: 'Partial' },
  'planned':                { dot: 'text-blue-500', label: 'Planned' },
  'not-applicable':         { dot: 'text-gray-400', label: 'N/A' },
};
const DEFAULT_DOT = { dot: 'text-red-400', label: 'Not Impl.' };

const CONFIDENCE_TAG: Record<string, string> = {
  high: 'text-indigo-600 bg-indigo-50',
  medium: 'text-amber-600 bg-amber-50',
  low: 'text-gray-500 bg-gray-100',
};

export default function ResolveView({ data, onNodeClick, onNavigate }: ResolveViewProps) {
  // Group transitive by the direct mapping they relate to
  // Use catalog matching as heuristic (same as graph)
  const directNodes = data.direct;
  const transitiveNodes = data.transitive;

  // For each direct node, find transitive nodes from the same target catalog
  const transitiveByDirectCatalog = new Map<string, any[]>();
  const usedTransitive = new Set<number>();

  for (const d of directNodes) {
    const key = d.catalogShortName;
    if (!transitiveByDirectCatalog.has(key)) transitiveByDirectCatalog.set(key, []);
  }

  transitiveNodes.forEach((t: any, idx: number) => {
    const cat = t.catalogShortName;
    if (transitiveByDirectCatalog.has(cat)) {
      transitiveByDirectCatalog.get(cat)!.push(t);
      usedTransitive.add(idx);
    }
  });

  // Remaining transitive nodes not matched to a direct catalog
  const unmatched = transitiveNodes.filter((_: any, i: number) => !usedTransitive.has(i));

  const rootId = `${data.control.catalog_short_name}:${data.control.control_id}`;
  const rootStatus = STATUS_INFO[data.control.implStatus ?? ''] ?? DEFAULT_DOT;

  return (
    <div className="p-6 max-w-3xl font-mono text-sm" role="tree" aria-label="Mapping resolve tree">
      {/* Root */}
      <div
        className="flex items-center gap-2 py-1 cursor-pointer hover:bg-indigo-50 rounded px-2 -mx-2"
        role="treeitem"
        aria-expanded="true"
        onClick={() => onNodeClick(rootId)}
        onDoubleClick={() => onNavigate(rootId)}
      >
        <Circle className={`h-3 w-3 fill-current ${rootStatus.dot}`} aria-label={rootStatus.label} />
        <span className="font-bold text-indigo-700">{data.control.catalog_short_name}:{data.control.control_id}</span>
        <span className="text-gray-500 font-sans text-xs truncate">{data.control.title}</span>
      </div>

      {/* Direct branches */}
      <ul className="ml-2 border-l border-gray-200" role="group">
        {directNodes.map((m: any, i: number) => {
          const nodeId = `${m.catalogShortName}:${m.controlNativeId}`;
          const children = transitiveByDirectCatalog.get(m.catalogShortName) ?? [];
          return (
            <TreeBranch
              key={nodeId}
              node={m}
              nodeId={nodeId}
              children={children.filter((c: any) => `${c.catalogShortName}:${c.controlNativeId}` !== nodeId)}
              isLast={i === directNodes.length - 1 && unmatched.length === 0}
              onNodeClick={onNodeClick}
              onNavigate={onNavigate}
            />
          );
        })}
        {unmatched.map((m: any, i: number) => {
          const nodeId = `${m.catalogShortName}:${m.controlNativeId}`;
          return (
            <TreeBranch
              key={nodeId}
              node={m}
              nodeId={nodeId}
              children={[]}
              isLast={i === unmatched.length - 1}
              onNodeClick={onNodeClick}
              onNavigate={onNavigate}
            />
          );
        })}
      </ul>

      {data.direct.length === 0 && data.transitive.length === 0 && (
        <p className="text-gray-400 font-sans ml-6 mt-2">No mappings found for this control.</p>
      )}

      {/* Summary */}
      <div className="mt-6 pt-4 border-t border-gray-200 font-sans text-xs text-gray-500">
        {data.direct.length} direct mapping{data.direct.length !== 1 ? 's' : ''}, {data.transitive.length} transitive
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tree branch (direct node with optional transitive children)
// ---------------------------------------------------------------------------

function TreeBranch({ node, nodeId, children, isLast, onNodeClick, onNavigate }: {
  node: any;
  nodeId: string;
  children: any[];
  isLast: boolean;
  onNodeClick: (id: string) => void;
  onNavigate: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const status = STATUS_INFO[node.implStatus ?? ''] ?? DEFAULT_DOT;
  const confClass = CONFIDENCE_TAG[node.confidence] ?? CONFIDENCE_TAG.low;
  const hasChildren = children.length > 0;

  return (
    <li className="relative" role="treeitem" aria-expanded={hasChildren ? expanded : undefined}>
      {/* Connector */}
      <span className="absolute left-0 top-0 h-4 w-4 border-b border-gray-200" style={{ borderLeft: 'none' }} aria-hidden="true" />

      <div className="flex items-center gap-1.5 py-1 ml-4">
        {/* Expand/collapse toggle */}
        {hasChildren ? (
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="p-0.5 text-gray-400 hover:text-gray-600 shrink-0"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        ) : (
          <span className="w-4 shrink-0" aria-hidden="true" />
        )}

        {/* Status dot */}
        <Circle className={`h-2.5 w-2.5 fill-current shrink-0 ${status.dot}`} aria-label={status.label} />

        {/* Control ID — clickable */}
        <button
          className="text-indigo-700 hover:text-indigo-900 hover:underline font-medium"
          onClick={() => onNodeClick(nodeId)}
          onDoubleClick={() => onNavigate(nodeId)}
        >
          {nodeId}
        </button>

        {/* Relationship */}
        <span className="text-gray-400 text-xs font-sans">{node.relationship}</span>

        {/* Confidence badge */}
        <span className={`px-1 py-0.5 rounded text-[10px] font-sans font-medium ${confClass}`}>
          {node.confidence}
        </span>

        {/* Transitive indicator */}
        {node.isTransitive && (
          <span className="text-[10px] text-gray-400 font-sans italic">transitive</span>
        )}
      </div>

      {/* Children (transitive) */}
      {hasChildren && expanded && (
        <ul className="ml-6 border-l border-gray-100" role="group">
          {children.map((child: any, ci: number) => {
            const childId = `${child.catalogShortName}:${child.controlNativeId}`;
            const childStatus = STATUS_INFO[child.implStatus ?? ''] ?? DEFAULT_DOT;
            const childConf = CONFIDENCE_TAG[child.confidence] ?? CONFIDENCE_TAG.low;
            return (
              <li key={childId} className="relative" role="treeitem">
                <span className="absolute left-0 top-0 h-4 w-4 border-b border-gray-100" aria-hidden="true" />
                <div className="flex items-center gap-1.5 py-1 ml-4">
                  <span className="w-4 shrink-0" aria-hidden="true" />
                  <Circle className={`h-2 w-2 fill-current shrink-0 ${childStatus.dot}`} aria-label={childStatus.label} />
                  <button
                    className="text-gray-600 hover:text-indigo-700 hover:underline"
                    onClick={() => onNodeClick(childId)}
                    onDoubleClick={() => onNavigate(childId)}
                  >
                    {childId}
                  </button>
                  <span className="text-gray-400 text-xs font-sans">{child.relationship}</span>
                  <span className={`px-1 py-0.5 rounded text-[10px] font-sans font-medium ${childConf}`}>
                    {child.confidence}
                  </span>
                  <span className="text-[10px] text-gray-400 font-sans italic">transitive</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}
