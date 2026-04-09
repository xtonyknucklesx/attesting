import React, { useState, useCallback } from 'react';
import { Search, GitCompareArrows, ArrowRight } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { getMappingSummary, resolveMappings } from '../../lib/api';
import MappingGraph from './MappingGraph';
import ResolveView from './ResolveView';
import ControlDetail from './ControlDetail';

const STATUS_DOT: Record<string, string> = {
  'implemented': 'bg-green-500',
  'partially-implemented': 'bg-amber-500',
  'planned': 'bg-blue-500',
  'not-applicable': 'bg-gray-400',
};

export default function MappingExplorer() {
  const [search, setSearch] = useState('');
  const [resolveData, setResolveData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showTextView, setShowTextView] = useState(false);
  const [selectedNode, setSelectedNode] = useState<any>(null);

  const { data: summary } = useApi(() => getMappingSummary(), []);

  const doResolve = useCallback(async (catalog: string, controlId: string) => {
    setLoading(true);
    setError('');
    setSelectedNode(null);
    try {
      const result = await resolveMappings(catalog.trim(), controlId.trim(), 3);
      setResolveData(result);
      setSearch(`${catalog}:${controlId}`);
    } catch (err: any) {
      setError(err.message);
      setResolveData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = useCallback(() => {
    if (!search.includes(':')) {
      setError('Format: catalog:control_id (e.g., sig-lite-2026:A.1)');
      return;
    }
    const [catalog, controlId] = search.split(':', 2);
    doResolve(catalog, controlId);
  }, [search, doResolve]);

  const handleNodeClick = useCallback((nodeId: string) => {
    if (!resolveData) return;
    // Find the node data in direct/transitive
    const allNodes = [...resolveData.direct, ...resolveData.transitive];
    const node = allNodes.find((m: any) =>
      `${m.catalogShortName}:${m.controlNativeId}` === nodeId
    );
    if (node) {
      setSelectedNode(node);
    } else if (nodeId === `${resolveData.control.catalog_short_name}:${resolveData.control.control_id}`) {
      setSelectedNode({ ...resolveData.control, isRoot: true });
    }
  }, [resolveData]);

  const handleNodeNavigate = useCallback((nodeId: string) => {
    const [catalog, controlId] = nodeId.split(':', 2);
    if (catalog && controlId) {
      doResolve(catalog, controlId);
    }
  }, [doResolve]);

  return (
    <div className="flex h-[calc(100vh-57px)]">
      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Search bar */}
        <div className="flex items-center gap-3 p-4 border-b border-gray-200 bg-white">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2.5 top-2 h-4 w-4 text-gray-400" aria-hidden="true" />
            <label htmlFor="mapping-search" className="sr-only">Search control (catalog:control_id)</label>
            <input
              id="mapping-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="sig-lite-2026:A.1"
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={loading}
            className="px-4 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {loading ? 'Resolving...' : 'Resolve'}
          </button>
          {resolveData && (
            <div className="flex items-center border border-gray-200 rounded-md overflow-hidden">
              <button
                onClick={() => setShowTextView(false)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${!showTextView ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                aria-pressed={!showTextView}
              >
                Graph
              </button>
              <button
                onClick={() => setShowTextView(true)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${showTextView ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                aria-pressed={showTextView}
              >
                Text
              </button>
            </div>
          )}
          {error && <span className="text-sm text-red-500" role="alert">{error}</span>}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {!resolveData ? (
            <SummaryView summary={summary} onResolve={doResolve} />
          ) : showTextView ? (
            <ResolveView data={resolveData} onNodeClick={handleNodeClick} onNavigate={handleNodeNavigate} />
          ) : (
            <MappingGraph data={resolveData} selectedNodeId={selectedNode ? `${selectedNode.catalogShortName ?? selectedNode.catalog_short_name}:${selectedNode.controlNativeId ?? selectedNode.control_id}` : null} onNodeClick={handleNodeClick} onNodeNavigate={handleNodeNavigate} />
          )}
        </div>
      </div>

      {/* Right detail panel */}
      {selectedNode && resolveData && (
        <ControlDetail
          node={selectedNode}
          rootControl={resolveData.control}
          allMappings={[...resolveData.direct, ...resolveData.transitive]}
          onClose={() => setSelectedNode(null)}
          onNavigate={handleNodeNavigate}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Default summary view
// ---------------------------------------------------------------------------

function SummaryView({ summary, onResolve }: { summary: any; onResolve: (cat: string, id: string) => void }) {
  if (!summary) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        Loading mapping summary...
      </div>
    );
  }

  if (summary.total === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        <div className="text-center">
          <GitCompareArrows className="h-8 w-8 mx-auto mb-2 text-gray-300" aria-hidden="true" />
          <p>No mappings yet</p>
          <p className="text-xs mt-1">Run <code className="bg-gray-100 px-1 rounded">crosswalk mapping auto-link</code> to generate cross-framework mappings</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-2xl font-bold text-indigo-600">{summary.total}</p>
          <p className="text-xs text-gray-500">Total mappings</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-2xl font-bold text-gray-900">{summary.sourceControls.length}</p>
          <p className="text-xs text-gray-500">Source controls</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-2xl font-bold text-gray-900">{summary.byTarget.length}</p>
          <p className="text-xs text-gray-500">Target frameworks</p>
        </div>
      </div>

      {/* Target breakdown */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-3">Mappings by Target Framework</h3>
        <div className="space-y-2">
          {summary.byTarget.map((t: any) => {
            const pct = summary.total > 0 ? Math.round((t.count / summary.total) * 100) : 0;
            return (
              <div key={t.short_name} className="flex items-center gap-3">
                <span className="text-xs text-gray-600 w-40 truncate">{t.short_name}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${t.name}: ${t.count} mappings`}>
                  <div className="bg-indigo-500 rounded-full h-2 transition-all" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs font-medium text-gray-900 w-10 text-right">{t.count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Source controls table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wider">Source Controls — Click to Explore</h3>
        </div>
        <div className="max-h-[400px] overflow-y-auto">
          <table className="w-full" role="table">
            <caption className="sr-only">Source controls with mapping counts</caption>
            <thead className="bg-gray-50 sticky top-0">
              <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <th scope="col" className="px-4 py-2 w-8"></th>
                <th scope="col" className="px-4 py-2 w-36">Control</th>
                <th scope="col" className="px-4 py-2">Title</th>
                <th scope="col" className="px-4 py-2 w-24 text-right">Mappings</th>
                <th scope="col" className="px-4 py-2 w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {summary.sourceControls.map((sc: any) => {
                const dot = STATUS_DOT[sc.impl_status] ?? 'bg-red-500';
                return (
                  <tr
                    key={`${sc.catalog_short_name}:${sc.control_id}`}
                    className="hover:bg-indigo-50 cursor-pointer transition-colors"
                    onClick={() => onResolve(sc.catalog_short_name, sc.control_id)}
                    role="row"
                  >
                    <td className="px-4 py-2">
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${dot}`}
                        role="img"
                        aria-label={sc.impl_status ?? 'not implemented'}
                      />
                    </td>
                    <td className="px-4 py-2 font-mono text-sm font-medium text-indigo-700">
                      {sc.catalog_short_name}:{sc.control_id}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600 truncate max-w-sm">{sc.title}</td>
                    <td className="px-4 py-2 text-sm font-medium text-gray-900 text-right">{sc.mapping_count}</td>
                    <td className="px-4 py-2">
                      <ArrowRight className="h-3.5 w-3.5 text-gray-300" aria-hidden="true" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
