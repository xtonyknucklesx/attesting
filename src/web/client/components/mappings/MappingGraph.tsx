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
        {/* Radial glow behind center */}
        <defs>
          <radialGradient id="center-glow">
            <stop offset="0%" stopColor="#4F46E5" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#4F46E5" stopOpacity="0" />
          </radialGradient>
        </defs>
        {nodes.length > 0 && (
          <circle cx={nodes[0].x} cy={nodes[0].y} r={100} fill="url(#center-glow)" />
        )}

        {/* Edges — quadratic bezier with subtle arc */}
        {nodes.filter((n) => !n.isRoot && n.parentId).map((node) => {
          const parent = nodes.find((p) => p.id === node.parentId);
          if (!parent) return null;
          const strokeColor = CONFIDENCE_STROKE[node.confidence] ?? '#d1d5db';
          const isHighlighted = selectedNodeId === node.id || selectedNodeId === parent.id || hoveredId === node.id;
          // Compute control point for a subtle curve
          const mx = (parent.x + node.x) / 2;
          const my = (parent.y + node.y) / 2;
          const dx = node.x - parent.x;
          const dy = node.y - parent.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          // Perpendicular offset proportional to distance (subtle arc)
          const offset = dist * 0.08;
          const nx = -dy / (dist || 1);
          const ny = dx / (dist || 1);
          const cx = mx + nx * offset;
          const cy = my + ny * offset;
          return (
            <path
              key={`edge-${node.id}`}
              d={`M ${parent.x} ${parent.y} Q ${cx} ${cy} ${node.x} ${node.y}`}
              fill="none"
              stroke={strokeColor}
              strokeWidth={isHighlighted ? 2.5 : 1.5}
              strokeDasharray={node.isTransitive ? '6 3' : 'none'}
              opacity={isHighlighted ? 1 : 0.4}
              className="transition-opacity duration-150"
            />
          );
        })}

        {/* Drop shadow filter for selected nodes */}
        <defs>
          <filter id="node-shadow" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="1" stdDeviation="3" floodColor="#4F46E5" floodOpacity="0.25" />
          </filter>
        </defs>

        {/* Nodes — staggered fade-in */}
        {nodes.map((node, idx) => {
          const status = STATUS_COLORS[node.implStatus ?? ''] ?? DEFAULT_STATUS;
          const catColor = catalogColors.get(node.catalog) ?? '#6b7280';
          const isSelected = selectedNodeId === node.id;
          const isHovered = hoveredId === node.id;
          const isFocused = focusedIndex === idx;
          const scale = isHovered ? 1.15 : 1;

          return (
            <g
              key={node.id}
              className="stagger-node cursor-pointer"
              style={{ ['--delay' as string]: `${idx * 30}ms`, transformOrigin: `${node.x}px ${node.y}px` } as React.CSSProperties}
              transform={`translate(${node.x}, ${node.y}) scale(${scale}) translate(${-node.x}, ${-node.y})`}
              onClick={(e) => { e.stopPropagation(); onNodeClick(node.id); setFocusedIndex(idx); }}
              onDoubleClick={() => onNodeNavigate(node.id)}
              onMouseEnter={() => setHoveredId(node.id)}
              onMouseLeave={() => setHoveredId(null)}
              role="button"
              aria-label={`${node.catalog}:${node.label} — ${status.label}${node.isTransitive ? ' (transitive)' : ''}`}
              tabIndex={-1}
              filter={isSelected ? 'url(#node-shadow)' : undefined}
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
                opacity={node.isTransitive ? 0.75 : 1}
              />

              {/* Catalog color dot (top-right) */}
              {!node.isRoot && (
                <circle
                  cx={node.x + node.radius * 0.65} cy={node.y - node.radius * 0.65}
                  r={3.5} fill={catColor} stroke="white" strokeWidth={1.5}
                />
              )}

              {/* Control ID label */}
              <text
                x={node.x} y={node.y + 1}
                textAnchor="middle" dominantBaseline="central"
                className="pointer-events-none select-none"
                fontSize={node.isRoot ? 11 : node.isTransitive ? 8 : 9}
                fontWeight={node.isRoot ? 700 : 500}
                fontFamily="'JetBrains Mono', ui-monospace, monospace"
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
                <g className="animate-fade-in">
                  <rect
                    x={node.x + node.radius + 10} y={node.y - 30}
                    width={Math.max(190, node.title.length * 5.2 + 24)} height={56}
                    rx={8} fill="white" stroke="#e5e7eb" strokeWidth={1}
                    filter="drop-shadow(0 2px 6px rgba(0,0,0,0.08))"
                  />
                  <text x={node.x + node.radius + 18} y={node.y - 13} fontSize={11} fontWeight={600} fill="#111827" fontFamily="Inter, sans-serif">
                    {node.title.slice(0, 38)}{node.title.length > 38 ? '…' : ''}
                  </text>
                  <text x={node.x + node.radius + 18} y={node.y + 2} fontSize={9} fill="#6b7280" fontFamily="Inter, sans-serif">
                    {node.catalog} · {node.relationship || 'root'} · {status.label}
                  </text>
                  <text x={node.x + node.radius + 18} y={node.y + 16} fontSize={9} fill="#9ca3af" fontFamily="Inter, sans-serif">
                    {node.confidence ? `Confidence: ${node.confidence}` : ''}{node.isTransitive ? ' · transitive' : ''}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>

      {/* Compact legend — top-left */}
      <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-lg px-3 py-2 text-[10px] shadow-sm" role="list" aria-label="Legend">
        <div className="flex items-center gap-3 flex-wrap">
          {[...catalogColors.entries()].map(([cat, color]) => (
            <span key={cat} className="flex items-center gap-1 text-gray-600" role="listitem">
              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} aria-hidden="true" />
              {abbrev(cat)}
            </span>
          ))}
          <span className="text-gray-300">|</span>
          {Object.entries(STATUS_COLORS).map(([, v]) => (
            <span key={v.label} className="flex items-center gap-1 text-gray-500" role="listitem">
              <span className="h-2 w-2 rounded-full border shrink-0" style={{ borderColor: v.stroke, backgroundColor: v.fill }} aria-hidden="true" />
              {v.label}
            </span>
          ))}
          <span className="flex items-center gap-1 text-gray-500" role="listitem">
            <span className="h-2 w-2 rounded-full border shrink-0" style={{ borderColor: DEFAULT_STATUS.stroke, backgroundColor: DEFAULT_STATUS.fill }} aria-hidden="true" />
            {DEFAULT_STATUS.label}
          </span>
          <span className="text-gray-300">|</span>
          <span className="flex items-center gap-1 text-gray-500" role="listitem">
            <svg width="12" height="3" aria-hidden="true"><line x1="0" y1="1.5" x2="12" y2="1.5" stroke="#6366f1" strokeWidth="1.5" /></svg>
            Direct
          </span>
          <span className="flex items-center gap-1 text-gray-500" role="listitem">
            <svg width="12" height="3" aria-hidden="true"><line x1="0" y1="1.5" x2="12" y2="1.5" stroke="#d1d5db" strokeWidth="1.5" strokeDasharray="3 2" /></svg>
            Transitive
          </span>
        </div>
      </div>

      {/* Instructions */}
      <div className="absolute top-3 right-3 text-[10px] text-gray-400">
        Click: select · Double-click: navigate · Arrow keys: move · Enter: navigate · Esc: deselect
      </div>
    </div>
  );
}
