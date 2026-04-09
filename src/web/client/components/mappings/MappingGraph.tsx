import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';

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

interface GNode {
  id: string;
  label: string;
  catalog: string;
  x: number;
  y: number;
  w: number;       // pill width
  h: number;       // pill height
  isRoot: boolean;
  isTransitive: boolean;
  implStatus: string | null;
  relationship: string;
  confidence: string;
  title: string;
  via: string | null;
  parentId: string | null;
}

const STATUS: Record<string, { fill: string; stroke: string; label: string }> = {
  'implemented':            { fill: 'rgba(74,222,128,0.18)', stroke: '#4ade80', label: 'Implemented' },
  'partially-implemented':  { fill: 'rgba(251,191,36,0.18)', stroke: '#fbbf24', label: 'Partial' },
  'planned':                { fill: 'rgba(96,165,250,0.18)', stroke: '#60a5fa', label: 'Planned' },
  'not-applicable':         { fill: 'rgba(100,116,139,0.12)', stroke: '#64748b', label: 'N/A' },
};
const DEF_STATUS = { fill: 'rgba(251,113,133,0.14)', stroke: '#fb7185', label: 'Not Impl.' };

const CAT_COLORS = ['#818cf8','#22d3ee','#a78bfa','#f472b6','#fb923c','#4ade80','#facc15','#60a5fa','#c084fc','#f87171'];
const CONF_STROKE: Record<string, string> = { high: '#6366f1', medium: '#f59e0b', low: 'rgba(255,255,255,0.12)' };

const MIN_INNER_R = 200;
const TRANS_OFFSET = 90;
const NODE_GAP = 16;
const PADDING = 90;

function abbrev(c: string): string {
  return c.replace('nist-800-53-r5','800-53').replace('nist-800-171-r3','800-171')
    .replace('nist-csf-2.0','CSF 2').replace('iso-27001-2022','ISO 27001')
    .replace('cmmc-2.0','CMMC').replace('sig-lite-2026','SIG Lite');
}

/** Pill width = text width + padding */
function pillW(label: string, isRoot: boolean): number {
  const charW = isRoot ? 8.5 : 7;
  return Math.max(label.length * charW + 24, isRoot ? 80 : 50);
}

export default function MappingGraph({ data, selectedNodeId, onNodeClick, onNodeNavigate }: MappingGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cSize, setCSize] = useState({ width: 800, height: 600 });
  const [hoveredNode, setHoveredNode] = useState<GNode | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [focusIdx, setFocusIdx] = useState(-1);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const [hiddenCats, setHiddenCats] = useState<Set<string>>(new Set());
  const [hideTrans, setHideTrans] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((e) => { for (const en of e) setCSize({ width: en.contentRect.width, height: en.contentRect.height }); });
    ro.observe(el); setCSize({ width: el.clientWidth, height: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  useEffect(() => { setTransform({ x: 0, y: 0, scale: 1 }); setHiddenCats(new Set()); setHideTrans(false); }, [data]);

  const { nodes, catColors, viewBox, fwCounts } = useMemo(() => {
    const colorMap = new Map<string, string>();
    const assign = (c: string) => { if (!colorMap.has(c)) colorMap.set(c, CAT_COLORS[colorMap.size % CAT_COLORS.length]); return colorMap.get(c)!; };

    assign(data.control.catalog_short_name);
    const rootId = `${data.control.catalog_short_name}:${data.control.control_id}`;
    const rootW = pillW(data.control.control_id, true);
    const result: GNode[] = [{
      id: rootId, label: data.control.control_id, catalog: data.control.catalog_short_name,
      x: 0, y: 0, w: rootW, h: 34,
      isRoot: true, isTransitive: false, implStatus: data.control.implStatus ?? null,
      relationship: '', confidence: '', title: data.control.title, via: null, parentId: null,
    }];
    const nodeSet = new Set([rootId]);

    // Framework counts
    const fwc = new Map<string, { direct: number; transitive: number }>();
    for (const m of data.direct) { assign(m.catalogShortName); const c = m.catalogShortName; if (!fwc.has(c)) fwc.set(c, { direct: 0, transitive: 0 }); fwc.get(c)!.direct++; }
    for (const m of data.transitive) { assign(m.catalogShortName); const c = m.catalogShortName; if (!fwc.has(c)) fwc.set(c, { direct: 0, transitive: 0 }); fwc.get(c)!.transitive++; }

    // ── Compute inner ring radius dynamically ──
    // Total angular width needed = sum of pill widths + gaps
    let totalArcWidth = 0;
    for (const m of data.direct) {
      const w = pillW(m.controlNativeId, false);
      totalArcWidth += w + NODE_GAP;
    }
    const requiredCircumference = totalArcWidth;
    const requiredR = requiredCircumference / (2 * Math.PI);
    const innerR = Math.max(MIN_INNER_R, requiredR);

    // ── Group direct by framework for arc segmentation ──
    const directByCat = new Map<string, any[]>();
    for (const m of data.direct) {
      const c = m.catalogShortName;
      if (!directByCat.has(c)) directByCat.set(c, []);
      directByCat.get(c)!.push(m);
    }

    const totalDirect = data.direct.length;
    let angleOff = -Math.PI / 2;

    for (const [cat, items] of directByCat) {
      const span = (items.length / Math.max(totalDirect, 1)) * 2 * Math.PI;
      const start = angleOff;

      items.forEach((m: any, i: number) => {
        const nid = `${m.catalogShortName}:${m.controlNativeId}`;
        if (nodeSet.has(nid)) return;
        nodeSet.add(nid);
        const angle = items.length === 1
          ? (start + span / 2)
          : start + ((i + 0.5) / items.length) * span;
        const w = pillW(m.controlNativeId, false);

        result.push({
          id: nid, label: m.controlNativeId, catalog: m.catalogShortName,
          x: innerR * Math.cos(angle), y: innerR * Math.sin(angle),
          w, h: 28,
          isRoot: false, isTransitive: false, implStatus: m.implStatus,
          relationship: m.relationship, confidence: m.confidence,
          title: m.title ?? m.controlNativeId, via: null, parentId: rootId,
        });
      });
      angleOff += span;
    }

    // ── Transitive: clustered fan behind parent direct node ──
    // Group by via (intermediary direct node)
    const transByParent = new Map<string, any[]>();
    for (const m of data.transitive) {
      let parentId = m.via ?? null;
      // Verify parent exists as a direct node
      if (parentId && !result.find((n) => n.id === parentId && !n.isRoot && !n.isTransitive)) {
        // Fallback: find any direct node from same catalog
        const fallback = result.find((n) => !n.isRoot && !n.isTransitive && n.catalog === m.catalogShortName);
        parentId = fallback?.id ?? rootId;
      }
      if (!parentId) parentId = rootId;
      if (!transByParent.has(parentId)) transByParent.set(parentId, []);
      transByParent.get(parentId)!.push(m);
    }

    for (const [pid, items] of transByParent) {
      const parent = result.find((n) => n.id === pid);
      if (!parent) continue;
      const baseAngle = Math.atan2(parent.y, parent.x); // angle from center to parent

      items.forEach((m: any, ti: number) => {
        const nid = `${m.catalogShortName}:${m.controlNativeId}`;
        if (nodeSet.has(nid)) return;
        nodeSet.add(nid);

        // Fan spread: ±15° per child, centered on parent angle
        const fanSpread = 0.18; // radians between children
        const angleOffset = (ti - (items.length - 1) / 2) * fanSpread;
        const angle = baseAngle + angleOffset;
        const dist = Math.hypot(parent.x, parent.y) + TRANS_OFFSET;
        const w = pillW(m.controlNativeId, false);

        result.push({
          id: nid, label: m.controlNativeId, catalog: m.catalogShortName,
          x: dist * Math.cos(angle), y: dist * Math.sin(angle),
          w, h: 22,
          isRoot: false, isTransitive: true, implStatus: m.implStatus,
          relationship: m.relationship, confidence: m.confidence,
          title: m.title ?? m.controlNativeId, via: m.via ?? null,
          parentId: pid,
        });
      });
    }

    // viewBox
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of result) {
      minX = Math.min(minX, n.x - n.w / 2 - PADDING);
      minY = Math.min(minY, n.y - n.h / 2 - PADDING);
      maxX = Math.max(maxX, n.x + n.w / 2 + PADDING);
      maxY = Math.max(maxY, n.y + n.h / 2 + PADDING);
    }
    return { nodes: result, catColors: colorMap, viewBox: `${minX} ${minY} ${maxX - minX} ${maxY - minY}`, fwCounts: fwc };
  }, [data]);

  // Filtering
  const visible = useMemo(() =>
    nodes.filter((n) => n.isRoot || (!hiddenCats.has(n.catalog) && (!hideTrans || !n.isTransitive))),
    [nodes, hiddenCats, hideTrans]
  );
  const visIds = useMemo(() => new Set(visible.map((n) => n.id)), [visible]);

  // Zoom/pan
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setTransform((p) => ({ ...p, scale: Math.max(0.25, Math.min(3.5, p.scale * (e.deltaY > 0 ? 0.9 : 1.1))) }));
  }, []);
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    isPanning.current = true;
    panStart.current = { x: e.clientX, y: e.clientY, tx: transform.x, ty: transform.y };
  }, [transform]);
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
    if (!isPanning.current) return;
    setTransform((p) => ({ ...p, x: panStart.current.tx + (e.clientX - panStart.current.x), y: panStart.current.ty + (e.clientY - panStart.current.y) }));
  }, []);
  const handleMouseUp = useCallback(() => { isPanning.current = false; }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault(); const n = (focusIdx + 1) % visible.length; setFocusIdx(n); onNodeClick(visible[n].id);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault(); const n = (focusIdx - 1 + visible.length) % visible.length; setFocusIdx(n); onNodeClick(visible[n].id);
    } else if (e.key === 'Enter' && focusIdx >= 0) { onNodeNavigate(visible[focusIdx].id); }
    else if (e.key === 'Escape') { setFocusIdx(-1); onNodeClick(''); }
  };

  const toggleCat = (c: string) => setHiddenCats((p) => { const n = new Set(p); n.has(c) ? n.delete(c) : n.add(c); return n; });

  // Tooltip container ref (for positioning)
  const graphContainerRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={containerRef} className="relative w-full h-full flex flex-col" role="application" aria-label="Mapping graph">
      {/* Filter bar */}
      <div className="glass-header flex items-center gap-2 px-4 py-2 flex-wrap z-20 relative" role="toolbar" aria-label="Filters">
        {[...fwCounts.entries()].map(([cat, cnt]) => {
          const color = catColors.get(cat) ?? '#6b7280';
          const on = !hiddenCats.has(cat);
          return (
            <button key={cat} onClick={() => toggleCat(cat)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all duration-100"
              style={{
                background: on ? `${color}18` : 'var(--bg-glass)',
                border: `1px solid ${on ? `${color}40` : 'var(--border-glass)'}`,
                color: on ? color : 'var(--text-dim)', opacity: on ? 1 : 0.5,
              }}
              aria-pressed={on}>
              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: on ? color : 'var(--text-dim)' }} aria-hidden="true" />
              {abbrev(cat)} ({cnt.direct + cnt.transitive})
            </button>
          );
        })}
        <span style={{ color: 'var(--border-glass)' }} aria-hidden="true">|</span>
        <button onClick={() => setHideTrans(!hideTrans)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all"
          style={{
            background: hideTrans ? 'var(--bg-glass-active)' : 'var(--bg-glass)',
            border: `1px solid ${hideTrans ? 'rgba(129,140,248,0.3)' : 'var(--border-glass)'}`,
            color: hideTrans ? '#818cf8' : 'var(--text-dim)',
          }}
          aria-pressed={hideTrans}>{hideTrans ? 'Direct only' : 'Show all'}</button>
        <span className="ml-auto text-[10px]" style={{ color: 'var(--text-dim)' }}>{visible.length - 1} nodes</span>
      </div>

      {/* SVG + tooltip overlay */}
      <div ref={graphContainerRef} className="flex-1 relative" style={{ cursor: isPanning.current ? 'grabbing' : 'grab' }}>
        <svg
          width={cSize.width} height={cSize.height - 42}
          viewBox={viewBox} className="w-full h-full"
          onWheel={handleWheel} onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}
          onMouseLeave={() => { handleMouseUp(); setHoveredNode(null); }}
          onKeyDown={handleKeyDown} tabIndex={0}
          role="img" aria-label={`${data.direct.length} direct, ${data.transitive.length} transitive mappings`}
        >
          <defs>
            <radialGradient id="cg"><stop offset="0%" stopColor="#4F46E5" stopOpacity="0.08" /><stop offset="100%" stopColor="#4F46E5" stopOpacity="0" /></radialGradient>
            <filter id="ns" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="1" stdDeviation="4" floodColor="#4F46E5" floodOpacity="0.3" /></filter>
            <filter id="lg" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            <filter id="rootGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          <g transform={`translate(${transform.x},${transform.y}) scale(${transform.scale})`}>
            <circle cx={0} cy={0} r={180} fill="url(#cg)" />

            {/* Edges — with hover hit areas, chain highlighting, glow */}
            {visible.filter((n) => !n.isRoot && n.parentId).map((node) => {
              const parent = nodes.find((p) => p.id === node.parentId);
              if (!parent || !visIds.has(parent.id)) return null;
              const sc = CONF_STROKE[node.confidence] ?? CONF_STROKE.low;

              // Chain highlighting: highlight when hovering this node, its parent,
              // or any descendant that chains through this node
              const activeId = hoveredNode?.id ?? selectedNodeId;
              const isDirectHit = activeId === node.id || activeId === parent.id;
              const activeNode = activeId ? nodes.find((n) => n.id === activeId) : null;
              const isChainHit = activeNode?.parentId === node.id;
              const hl = isDirectHit || isChainHit;

              const mx = (parent.x + node.x) / 2, my = (parent.y + node.y) / 2;
              const dx = node.x - parent.x, dy = node.y - parent.y;
              const d = Math.hypot(dx, dy) || 1;
              const cpx = mx + (-dy / d) * d * 0.06, cpy = my + (dx / d) * d * 0.06;
              const pathD = `M ${parent.x} ${parent.y} Q ${cpx} ${cpy} ${node.x} ${node.y}`;

              return (
                <g key={`e-${node.id}`}>
                  {/* Invisible wider hit area for hover */}
                  <path d={pathD} fill="none" stroke="transparent" strokeWidth={14}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredNode(node)}
                    onMouseLeave={() => setHoveredNode(null)} />
                  {/* Visible edge */}
                  <path d={pathD} fill="none"
                    stroke={hl ? (CONF_STROKE[node.confidence] ?? '#6366f1') : sc}
                    strokeWidth={node.isTransitive ? (hl ? 2.2 : 0.6) : (hl ? 2.5 : 1.3)}
                    strokeDasharray={node.isTransitive ? '5 3' : 'none'}
                    opacity={node.isTransitive ? (hl ? 0.85 : 0.12) : (hl ? 0.9 : 0.3)}
                    className="pointer-events-none transition-all duration-150" />
                  {/* Glow on highlighted edges (both direct and transitive) */}
                  {hl && (
                    <path d={pathD} fill="none"
                      stroke={CONF_STROKE[node.confidence] ?? '#6366f1'}
                      strokeWidth={node.isTransitive ? 5 : 6}
                      strokeDasharray={node.isTransitive ? '5 3' : 'none'}
                      opacity={node.isTransitive ? 0.15 : 0.12}
                      className="pointer-events-none" />
                  )}
                </g>
              );
            })}

            {/* Nodes — pill shapes */}
            {visible.map((node, idx) => {
              const st = STATUS[node.implStatus ?? ''] ?? DEF_STATUS;
              const catColor = catColors.get(node.catalog) ?? '#6b7280';
              const isSel = selectedNodeId === node.id;
              const isHov = hoveredNode?.id === node.id;
              const isFoc = focusIdx === idx;
              const scale = isHov ? 1.06 : 1;
              const rx = node.h / 2; // pill radius
              const opacity = node.isTransitive ? 0.5 : 1;
              const borderW = node.isRoot ? 2.5 : node.isTransitive ? 1 : 1.8;
              const fontSize = node.isRoot ? 14 : node.isTransitive ? 10 : 11;

              return (
                <g key={node.id} className="stagger-node"
                  style={{ ['--delay' as string]: `${idx * 20}ms` } as React.CSSProperties}
                  onClick={(e) => { e.stopPropagation(); onNodeClick(node.id); setFocusIdx(idx); }}
                  onDoubleClick={() => onNodeNavigate(node.id)}
                  onMouseEnter={() => setHoveredNode(node)}
                  onMouseLeave={() => setHoveredNode(null)}
                  role="button"
                  aria-label={`${node.catalog}:${node.label} — ${st.label}${node.isTransitive ? ` via ${node.via}` : ''}`}
                  tabIndex={-1} cursor="pointer" opacity={opacity}
                >
                  <g transform={`translate(${node.x},${node.y}) scale(${scale}) translate(${-node.x},${-node.y})`}
                    filter={isSel ? 'url(#ns)' : node.isRoot ? 'url(#rootGlow)' : undefined}>

                    {/* Selection ring */}
                    {(isSel || isFoc) && (
                      <rect x={node.x - node.w / 2 - 4} y={node.y - node.h / 2 - 4}
                        width={node.w + 8} height={node.h + 8}
                        rx={rx + 4} fill="none" stroke="#818cf8" strokeWidth={2}
                        strokeDasharray={isFoc && !isSel ? '4 3' : 'none'} />
                    )}

                    {/* Pill background — tinted with framework color */}
                    <rect x={node.x - node.w / 2} y={node.y - node.h / 2}
                      width={node.w} height={node.h} rx={rx}
                      fill={node.isRoot ? 'rgba(79,70,229,0.15)' : st.fill}
                      stroke={node.isRoot ? '#818cf8' : st.stroke}
                      strokeWidth={borderW} />

                    {/* Catalog color indicator dot (top-right corner) */}
                    {!node.isRoot && (
                      <circle
                        cx={node.x + node.w / 2 - 6} cy={node.y - node.h / 2 + 6}
                        r={3} fill={catColor} opacity={0.9} />
                    )}

                    {/* Control ID text */}
                    <text x={node.x} y={node.y + 1}
                      textAnchor="middle" dominantBaseline="central"
                      fontSize={fontSize} fontWeight={node.isRoot ? 700 : 600}
                      fontFamily="'JetBrains Mono', ui-monospace, monospace"
                      fill="var(--text-primary)" className="pointer-events-none select-none">
                      {node.label}
                    </text>
                  </g>
                </g>
              );
            })}
          </g>
        </svg>

        {/* ── HTML tooltip overlay — always on top ── */}
        {hoveredNode && !isPanning.current && (
          <div
            className="animate-fade-in pointer-events-none"
            style={{
              position: 'absolute',
              left: mousePos.x - (graphContainerRef.current?.getBoundingClientRect().left ?? 0) + 16,
              top: mousePos.y - (graphContainerRef.current?.getBoundingClientRect().top ?? 0) - 20,
              zIndex: 50,
              background: 'rgba(17, 17, 27, 0.95)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 8,
              padding: 12,
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
              maxWidth: 340,
              minWidth: 200,
            }}
            role="tooltip"
          >
            <p style={{ color: '#f1f5f9', fontWeight: 500, fontSize: 13, margin: 0, lineHeight: 1.3 }}>
              {hoveredNode.title || hoveredNode.label}
            </p>
            <p style={{ color: '#94a3b8', fontSize: 11, margin: '6px 0 0', lineHeight: 1.4 }}>
              {abbrev(hoveredNode.catalog)}
            </p>
            {hoveredNode.relationship && (
              <p style={{ color: '#94a3b8', fontSize: 11, margin: '3px 0 0' }}>
                {hoveredNode.relationship} · {hoveredNode.confidence} confidence
              </p>
            )}
            <p style={{ color: '#64748b', fontSize: 11, margin: '3px 0 0' }}>
              {hoveredNode.isTransitive
                ? `Transitive via ${hoveredNode.via ?? '?'}`
                : hoveredNode.isRoot ? 'Source control' : 'Direct mapping'}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                backgroundColor: (STATUS[hoveredNode.implStatus ?? ''] ?? DEF_STATUS).stroke,
                boxShadow: `0 0 6px ${(STATUS[hoveredNode.implStatus ?? ''] ?? DEF_STATUS).stroke}60`,
                flexShrink: 0,
              }} />
              <span style={{ color: '#cbd5e1', fontSize: 11 }}>
                {(STATUS[hoveredNode.implStatus ?? ''] ?? DEF_STATUS).label}
              </span>
            </div>
          </div>
        )}

        <div className="absolute bottom-3 right-3 text-[10px]" style={{ color: 'var(--text-dim)' }}>
          Scroll: zoom · Drag: pan · Click: select · Double-click: navigate
        </div>
      </div>
    </div>
  );
}
