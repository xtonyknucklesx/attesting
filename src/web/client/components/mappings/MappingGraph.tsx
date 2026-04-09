import React, { useRef, useEffect, useState, useCallback } from 'react';

interface MappingGraphProps {
  data: {
    control: { control_id: string; catalog_short_name: string; title: string };
    direct: any[];
    transitive: any[];
  };
}

interface GraphNode {
  id: string;
  label: string;
  catalog: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  isRoot: boolean;
  isTransitive: boolean;
  implStatus: string | null;
}

interface GraphEdge {
  source: string;
  target: string;
  relationship: string;
  confidence: string;
}

const STATUS_COLORS: Record<string, string> = {
  'implemented': '#22c55e',
  'partially-implemented': '#f59e0b',
  'planned': '#3b82f6',
  'not-applicable': '#9ca3af',
  'not-implemented': '#ef4444',
};

const CATALOG_COLORS = [
  '#4F46E5', '#0891b2', '#7c3aed', '#db2777', '#ea580c',
  '#16a34a', '#ca8a04', '#dc2626', '#2563eb', '#9333ea',
];

export default function MappingGraph({ data }: MappingGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const nodesRef = useRef<GraphNode[]>([]);
  const edgesRef = useRef<GraphEdge[]>([]);
  const animRef = useRef<number>(0);

  // Build graph data
  useEffect(() => {
    const allMappings = [...data.direct, ...data.transitive];
    const catalogs = new Map<string, number>();

    // Assign catalog colors
    const getCatalogColor = (cat: string) => {
      if (!catalogs.has(cat)) catalogs.set(cat, catalogs.size);
      return CATALOG_COLORS[catalogs.get(cat)! % CATALOG_COLORS.length];
    };

    const cx = dimensions.width / 2;
    const cy = dimensions.height / 2;

    // Root node
    const nodes: GraphNode[] = [{
      id: `${data.control.catalog_short_name}:${data.control.control_id}`,
      label: data.control.control_id,
      catalog: data.control.catalog_short_name,
      x: cx, y: cy, vx: 0, vy: 0,
      isRoot: true, isTransitive: false, implStatus: null,
    }];

    const edges: GraphEdge[] = [];
    const nodeSet = new Set([nodes[0].id]);

    // Add mapped nodes in a circle around root
    const radius = Math.min(dimensions.width, dimensions.height) * 0.3;
    allMappings.forEach((m, i) => {
      const nodeId = `${m.catalogShortName}:${m.controlNativeId}`;
      if (nodeSet.has(nodeId)) return;
      nodeSet.add(nodeId);

      const angle = (i / allMappings.length) * 2 * Math.PI - Math.PI / 2;
      const r = m.isTransitive ? radius * 1.4 : radius;
      nodes.push({
        id: nodeId,
        label: m.controlNativeId,
        catalog: m.catalogShortName,
        x: cx + r * Math.cos(angle) + (Math.random() - 0.5) * 30,
        y: cy + r * Math.sin(angle) + (Math.random() - 0.5) * 30,
        vx: 0, vy: 0,
        isRoot: false,
        isTransitive: m.isTransitive,
        implStatus: m.implStatus,
      });

      // Edge from root for direct, from path for transitive
      const sourceId = m.isTransitive && m.path?.length > 0
        ? null // skip complex paths for simplicity
        : nodes[0].id;
      if (sourceId) {
        edges.push({
          source: sourceId,
          target: nodeId,
          relationship: m.relationship,
          confidence: m.confidence,
        });
      }
    });

    nodesRef.current = nodes;
    edgesRef.current = edges;

    // Simple force simulation
    let frame = 0;
    const simulate = () => {
      const ns = nodesRef.current;
      const dampening = 0.92;

      for (let iter = 0; iter < 3; iter++) {
        // Repulsion between all nodes
        for (let i = 0; i < ns.length; i++) {
          for (let j = i + 1; j < ns.length; j++) {
            const dx = ns[j].x - ns[i].x;
            const dy = ns[j].y - ns[i].y;
            const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
            const force = 2000 / (dist * dist);
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            ns[i].vx -= fx; ns[i].vy -= fy;
            ns[j].vx += fx; ns[j].vy += fy;
          }
        }

        // Attraction along edges
        for (const edge of edgesRef.current) {
          const s = ns.find((n) => n.id === edge.source);
          const t = ns.find((n) => n.id === edge.target);
          if (!s || !t) continue;
          const dx = t.x - s.x;
          const dy = t.y - s.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const targetDist = 150;
          const force = (dist - targetDist) * 0.005;
          const fx = (dx / Math.max(dist, 1)) * force;
          const fy = (dy / Math.max(dist, 1)) * force;
          s.vx += fx; s.vy += fy;
          t.vx -= fx; t.vy -= fy;
        }

        // Center gravity
        for (const n of ns) {
          n.vx += (cx - n.x) * 0.001;
          n.vy += (cy - n.y) * 0.001;
        }

        // Apply velocities
        for (const n of ns) {
          if (n.isRoot) { n.x = cx; n.y = cy; continue; }
          n.vx *= dampening;
          n.vy *= dampening;
          n.x += n.vx;
          n.y += n.vy;
          // Bounds
          n.x = Math.max(40, Math.min(dimensions.width - 40, n.x));
          n.y = Math.max(40, Math.min(dimensions.height - 40, n.y));
        }
      }

      draw();
      frame++;
      if (frame < 200) {
        animRef.current = requestAnimationFrame(simulate);
      }
    };

    animRef.current = requestAnimationFrame(simulate);
    return () => cancelAnimationFrame(animRef.current);
  }, [data, dimensions]);

  // Resize observer
  useEffect(() => {
    const el = canvasRef.current?.parentElement;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    ro.observe(el);
    setDimensions({ width: el.clientWidth, height: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = dimensions.width * dpr;
    canvas.height = dimensions.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, dimensions.width, dimensions.height);

    // Draw edges
    for (const edge of edgesRef.current) {
      const s = nodesRef.current.find((n) => n.id === edge.source);
      const t = nodesRef.current.find((n) => n.id === edge.target);
      if (!s || !t) continue;

      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(t.x, t.y);
      ctx.strokeStyle = edge.relationship === 'equivalent' ? '#6366f1' : '#d1d5db';
      ctx.lineWidth = edge.confidence === 'high' ? 2 : edge.confidence === 'medium' ? 1.5 : 1;
      if (edge.relationship !== 'equivalent') ctx.setLineDash([4, 4]);
      else ctx.setLineDash([]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw nodes
    for (const node of nodesRef.current) {
      const isSelected = selectedNode === node.id;
      const radius = node.isRoot ? 12 : 8;

      // Node circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = node.implStatus
        ? (STATUS_COLORS[node.implStatus] ?? '#ef4444')
        : (node.isRoot ? '#4F46E5' : '#d1d5db');
      ctx.fill();

      if (isSelected || node.isRoot) {
        ctx.strokeStyle = '#111827';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Label
      ctx.font = node.isRoot ? 'bold 11px Inter, sans-serif' : '10px Inter, sans-serif';
      ctx.fillStyle = '#111827';
      ctx.textAlign = 'center';
      ctx.fillText(node.label, node.x, node.y + radius + 12);

      // Catalog label (smaller)
      ctx.font = '9px Inter, sans-serif';
      ctx.fillStyle = '#9ca3af';
      ctx.fillText(node.catalog, node.x, node.y + radius + 22);
    }
  }, [dimensions, selectedNode]);

  // Click handling
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    for (const node of nodesRef.current) {
      const dx = node.x - x;
      const dy = node.y - y;
      if (dx * dx + dy * dy < 200) {
        setSelectedNode(node.id);
        draw();
        return;
      }
    }
    setSelectedNode(null);
  }, [draw]);

  return (
    <div className="relative w-full h-full bg-gray-50">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ width: dimensions.width, height: dimensions.height }}
        onClick={handleClick}
        role="img"
        aria-label={`Mapping graph for ${data.control.catalog_short_name}:${data.control.control_id} showing ${data.direct.length} direct and ${data.transitive.length} transitive mappings`}
      />
      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white border border-gray-200 rounded-lg p-3 text-xs space-y-1 shadow-sm" aria-label="Graph legend">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-green-500" aria-hidden="true" /> Implemented
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500" aria-hidden="true" /> Partial
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500" aria-hidden="true" /> Not Impl.
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-gray-300" aria-hidden="true" /> Unknown
        </div>
        <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
          <span className="w-4 border-t-2 border-indigo-500" aria-hidden="true" /> Equivalent
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 border-t-2 border-dashed border-gray-400" aria-hidden="true" /> Related
        </div>
      </div>
    </div>
  );
}
