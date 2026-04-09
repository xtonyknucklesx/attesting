import React, { useMemo, useRef, useEffect, useState } from 'react';

interface MappingGraphProps {
  data: {
    control: { control_id: string; catalog_short_name: string; title: string; implStatus?: string | null };
    direct: any[];
    transitive: any[];
  };
  selectedNodeId: string | null;
  onNodeClick: (nodeId: string) => void;
  onNodeNavigate: (nodeId: string) => void;
}

interface GraphNode {
  id: string;
  label: string;
  catalog: string;
  catalogName: string;
  x: number;
  y: number;
  radius: number;
  isRoot: boolean;
  isTransitive: boolean;
  implStatus: string | null;
  relationship: string;
  confidence: string;
  title: string;
  /** ID of the direct-mapping parent (for transitive edge routing) */
  parentId: string | null;
}

const STATUS_COLORS: Record<string, { fill: string; stroke: string; label: string }> = {
  'implemented':            { fill: '#dcfce7', stroke: '#22c55e', label: 'Implemented' },
  'partially-implemented':  { fill: '#fef3c7', stroke: '#f59e0b', label: 'Partial' },
  'planned':                { fill: '#dbeafe', stroke: '#3b82f6', label: 'Planned' },
  'not-applicable':         { fill: '#f3f4f6', stroke: '#9ca3af', label: 'N/A' },
};
const DEFAULT_STATUS = { fill: '#fee2e2', stroke: '#ef4444', label: 'Not Impl.' };

// One color per unique catalog
const CATALOG_PALETTE = [
  '#4F46E5', '#0891b2', '#7c3aed', '#db2777', '#ea580c',
  '#16a34a', '#ca8a04', '#2563eb', '#9333ea', '#dc2626',
];

const CONFIDENCE_STROKE: Record<string, string> = {
  high: '#6366f1',
  medium: '#f59e0b',
  low: '#d1d5db',
};

function abbrev(catalog: string): string {
  return catalog
    .replace('nist-800-53-r5', '800-53')
    .replace('nist-800-171-r3', '800-171')
    .replace('nist-csf-2.0', 'CSF 2')
    .replace('iso-27001-2022', 'ISO 27001')
    .replace('cmmc-2.0', 'CMMC')
    .replace('sig-lite-2026', 'SIG Lite');
}

export default function MappingGraph({ data, selectedNodeId, onNodeClick, onNodeNavigate }: MappingGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 800, height: 600 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  // Resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setDims({ width: e.contentRect.width, height: e.contentRect.height });
    });
    ro.observe(el);
    setDims({ width: el.clientWidth, height: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // Build nodes with radial layout
  const { nodes, catalogColors } = useMemo(() => {
    const cx = dims.width / 2;
    const cy = dims.height / 2;
    const innerR = Math.min(dims.width, dims.height) * 0.22;
    const outerR = Math.min(dims.width, dims.height) * 0.4;

    const catalogColorMap = new Map<string, string>();
    const assignColor = (cat: string) => {
      if (!catalogColorMap.has(cat)) catalogColorMap.set(cat, CATALOG_PALETTE[catalogColorMap.size % CATALOG_PALETTE.length]);
      return catalogColorMap.get(cat)!;
    };

    // Root
    assignColor(data.control.catalog_short_name);
    const rootId = `${data.control.catalog_short_name}:${data.control.control_id}`;
    const result: GraphNode[] = [{
      id: rootId,
      label: data.control.control_id,
      catalog: data.control.catalog_short_name,
      catalogName: abbrev(data.control.catalog_short_name),
      x: cx, y: cy,
      radius: 20,
      isRoot: true, isTransitive: false,
      implStatus: data.control.implStatus ?? null,
      relationship: '', confidence: '',
      title: data.control.title,
      parentId: null,
    }];

    const nodeSet = new Set([rootId]);

    // Direct mappings — inner ring
    const directCount = data.direct.length;
    data.direct.forEach((m: any, i: number) => {
      const nodeId = `${m.catalogShortName}:${m.controlNativeId}`;
      if (nodeSet.has(nodeId)) return;
      nodeSet.add(nodeId);
      assignColor(m.catalogShortName);

      const angle = (i / Math.max(directCount, 1)) * 2 * Math.PI - Math.PI / 2;
      result.push({
        id: nodeId,
        label: m.controlNativeId,
        catalog: m.catalogShortName,
        catalogName: abbrev(m.catalogShortName),
        x: cx + innerR * Math.cos(angle),
        y: cy + innerR * Math.sin(angle),
        radius: 14,
        isRoot: false, isTransitive: false,
        implStatus: m.implStatus,
        relationship: m.relationship,
        confidence: m.confidence,
        title: m.title ?? m.controlNativeId,
        parentId: rootId,
      });
    });

    // Transitive mappings — outer ring, positioned near their direct parent
    // Group transitive by their path's first hop to cluster them
    const transitiveByParent = new Map<string, any[]>();
    for (const m of data.transitive) {
      // The first UUID in m.path after the root is the direct parent
      // We match on catalogShortName:controlNativeId of the direct node
      // For simplicity, position near the direct node that shares the same catalog
      const parentNode = result.find((n) =>
        !n.isRoot && !n.isTransitive && n.catalog === m.catalogShortName
      );
      const parentKey = parentNode?.id ?? rootId;
      if (!transitiveByParent.has(parentKey)) transitiveByParent.set(parentKey, []);
      transitiveByParent.get(parentKey)!.push(m);
    }

    transitiveByParent.forEach((transItems, parentKey) => {
      const parent = result.find((n) => n.id === parentKey);
      if (!parent) return;
      const baseAngle = Math.atan2(parent.y - cy, parent.x - cx);

      transItems.forEach((m: any, ti: number) => {
        const nodeId = `${m.catalogShortName}:${m.controlNativeId}`;
        if (nodeSet.has(nodeId)) return;
        nodeSet.add(nodeId);
        assignColor(m.catalogShortName);

        const spread = Math.PI * 0.15;
        const angleOffset = (ti - (transItems.length - 1) / 2) * spread;
        const angle = baseAngle + angleOffset;

        result.push({
          id: nodeId,
          label: m.controlNativeId,
          catalog: m.catalogShortName,
          catalogName: abbrev(m.catalogShortName),
          x: cx + outerR * Math.cos(angle),
          y: cy + outerR * Math.sin(angle),
          radius: 10,
          isRoot: false, isTransitive: true,
          implStatus: m.implStatus,
          relationship: m.relationship,
          confidence: m.confidence,
          title: m.title ?? m.controlNativeId,
          parentId: parentKey,
        });
      });
    });

    return { nodes: result, catalogColors: catalogColorMap };
  }, [data, dims]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const next = (focusedIndex + 1) % nodes.length;
      setFocusedIndex(next);
      onNodeClick(nodes[next].id);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = (focusedIndex - 1 + nodes.length) % nodes.length;
      setFocusedIndex(prev);
      onNodeClick(nodes[prev].id);
    } else if (e.key === 'Enter' && focusedIndex >= 0) {
      onNodeNavigate(nodes[focusedIndex].id);
    } else if (e.key === 'Escape') {
      setFocusedIndex(-1);
      onNodeClick('');
    }
  };

  return (
    <div ref={containerRef} className="relative w-full h-full bg-gray-50" role="application" aria-label="Mapping graph visualization">
      <svg
        width={dims.width}
        height={dims.height}
        className="w-full h-full"
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="img"
        aria-label={`Mapping graph for ${data.control.catalog_short_name}:${data.control.control_id}: ${data.direct.length} direct, ${data.transitive.length} transitive`}
      >
        {/* Edges */}
        {nodes.filter((n) => !n.isRoot && n.parentId).map((node) => {
          const parent = nodes.find((p) => p.id === node.parentId);
          if (!parent) return null;
          const strokeColor = CONFIDENCE_STROKE[node.confidence] ?? '#d1d5db';
          const isHighlighted = selectedNodeId === node.id || selectedNodeId === parent.id || hoveredId === node.id;
          return (
            <line
              key={`edge-${node.id}`}
              x1={parent.x} y1={parent.y}
              x2={node.x} y2={node.y}
              stroke={strokeColor}
              strokeWidth={isHighlighted ? 2.5 : 1.5}
              strokeDasharray={node.isTransitive ? '6 3' : 'none'}
              opacity={isHighlighted ? 1 : 0.5}
              className="transition-opacity"
            />
          );
        })}

        {/* Nodes */}
        {nodes.map((node, idx) => {
          const status = STATUS_COLORS[node.implStatus ?? ''] ?? DEFAULT_STATUS;
          const catColor = catalogColors.get(node.catalog) ?? '#6b7280';
          const isSelected = selectedNodeId === node.id;
          const isHovered = hoveredId === node.id;
          const isFocused = focusedIndex === idx;

          return (
            <g
              key={node.id}
              className="cursor-pointer"
              onClick={(e) => { e.stopPropagation(); onNodeClick(node.id); setFocusedIndex(idx); }}
              onDoubleClick={() => onNodeNavigate(node.id)}
              onMouseEnter={() => setHoveredId(node.id)}
              onMouseLeave={() => setHoveredId(null)}
              role="button"
              aria-label={`${node.catalog}:${node.label} — ${status.label}${node.isTransitive ? ' (transitive)' : ''}`}
              tabIndex={-1}
            >
              {/* Selection ring */}
              {(isSelected || isFocused) && (
                <circle cx={node.x} cy={node.y} r={node.radius + 4} fill="none" stroke="#4F46E5" strokeWidth={2} strokeDasharray={isFocused && !isSelected ? '3 2' : 'none'} />
              )}

              {/* Impl status ring */}
              <circle
                cx={node.x} cy={node.y} r={node.radius}
                fill={node.isRoot ? '#eef2ff' : status.fill}
                stroke={node.isRoot ? '#4F46E5' : status.stroke}
                strokeWidth={node.isRoot ? 3 : 2}
                opacity={node.isTransitive ? 0.8 : 1}
              />

              {/* Catalog color dot (top-right) */}
              {!node.isRoot && (
                <circle
                  cx={node.x + node.radius * 0.65} cy={node.y - node.radius * 0.65}
                  r={4} fill={catColor} stroke="white" strokeWidth={1.5}
                />
              )}

              {/* Control ID label */}
              <text
                x={node.x} y={node.y + 1}
                textAnchor="middle" dominantBaseline="central"
                className="pointer-events-none select-none"
                fontSize={node.isRoot ? 11 : node.isTransitive ? 8 : 9}
                fontWeight={node.isRoot ? 700 : 500}
                fontFamily="ui-monospace, monospace"
                fill="#111827"
              >
                {node.label}
              </text>

              {/* Catalog abbreviation below */}
              <text
                x={node.x} y={node.y + node.radius + 12}
                textAnchor="middle"
                className="pointer-events-none select-none"
                fontSize={node.isRoot ? 10 : 8}
                fill="#6b7280"
                fontFamily="Inter, system-ui, sans-serif"
              >
                {node.catalogName}
              </text>

              {/* Hover tooltip */}
              {isHovered && !isSelected && (
                <g>
                  <rect
                    x={node.x + node.radius + 8} y={node.y - 28}
                    width={Math.max(180, node.title.length * 5.5 + 20)} height={52}
                    rx={6} fill="white" stroke="#e5e7eb" strokeWidth={1}
                    filter="drop-shadow(0 1px 2px rgba(0,0,0,0.1))"
                  />
                  <text x={node.x + node.radius + 16} y={node.y - 12} fontSize={11} fontWeight={600} fill="#111827" fontFamily="Inter, sans-serif">
                    {node.title.slice(0, 40)}{node.title.length > 40 ? '…' : ''}
                  </text>
                  <text x={node.x + node.radius + 16} y={node.y + 2} fontSize={9} fill="#6b7280" fontFamily="Inter, sans-serif">
                    {node.catalog} · {node.relationship || 'root'} · {status.label}
                  </text>
                  <text x={node.x + node.radius + 16} y={node.y + 15} fontSize={9} fill="#9ca3af" fontFamily="Inter, sans-serif">
                    {node.confidence ? `Confidence: ${node.confidence}` : ''}{node.isTransitive ? ' · transitive' : ''}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>

      {/* Framework legend */}
      <div className="absolute bottom-4 left-4 bg-white border border-gray-200 rounded-lg p-3 text-xs space-y-1.5 shadow-sm" role="list" aria-label="Framework legend">
        <p className="font-semibold text-gray-700 text-[10px] uppercase tracking-wider mb-1">Frameworks</p>
        {[...catalogColors.entries()].map(([cat, color]) => (
          <div key={cat} className="flex items-center gap-2" role="listitem">
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} aria-hidden="true" />
            <span className="text-gray-600">{abbrev(cat)}</span>
          </div>
        ))}
        <div className="border-t border-gray-100 pt-1.5 mt-1.5 space-y-1">
          <p className="font-semibold text-gray-700 text-[10px] uppercase tracking-wider">Status</p>
          {Object.entries(STATUS_COLORS).map(([, v]) => (
            <div key={v.label} className="flex items-center gap-2" role="listitem">
              <span className="h-2.5 w-2.5 rounded-full border-2 shrink-0" style={{ borderColor: v.stroke, backgroundColor: v.fill }} aria-hidden="true" />
              <span className="text-gray-600">{v.label}</span>
            </div>
          ))}
          <div className="flex items-center gap-2" role="listitem">
            <span className="h-2.5 w-2.5 rounded-full border-2 shrink-0" style={{ borderColor: DEFAULT_STATUS.stroke, backgroundColor: DEFAULT_STATUS.fill }} aria-hidden="true" />
            <span className="text-gray-600">{DEFAULT_STATUS.label}</span>
          </div>
        </div>
        <div className="border-t border-gray-100 pt-1.5 mt-1.5 space-y-1">
          <p className="font-semibold text-gray-700 text-[10px] uppercase tracking-wider">Lines</p>
          <div className="flex items-center gap-2" role="listitem">
            <svg width="16" height="4" aria-hidden="true"><line x1="0" y1="2" x2="16" y2="2" stroke="#6366f1" strokeWidth="2" /></svg>
            <span className="text-gray-600">Direct (high)</span>
          </div>
          <div className="flex items-center gap-2" role="listitem">
            <svg width="16" height="4" aria-hidden="true"><line x1="0" y1="2" x2="16" y2="2" stroke="#d1d5db" strokeWidth="1.5" strokeDasharray="4 2" /></svg>
            <span className="text-gray-600">Transitive</span>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="absolute top-3 right-3 text-[10px] text-gray-400">
        Click: select · Double-click: navigate · Arrow keys: move · Enter: navigate · Esc: deselect
      </div>
    </div>
  );
}
