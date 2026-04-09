import React, { useState, useCallback } from 'react';
import { Search } from 'lucide-react';
import { resolveMappings } from '../../lib/api';
import MappingGraph from './MappingGraph';
import ResolveView from './ResolveView';

export default function MappingExplorer() {
  const [search, setSearch] = useState('');
  const [resolveData, setResolveData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showTextView, setShowTextView] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!search.includes(':')) {
      setError('Format: catalog:control_id (e.g., sig-lite-2026:A.1)');
      return;
    }
    const [catalog, controlId] = search.split(':', 2);
    setLoading(true);
    setError('');
    try {
      const result = await resolveMappings(catalog.trim(), controlId.trim(), 3);
      setResolveData(result);
    } catch (err: any) {
      setError(err.message);
      setResolveData(null);
    } finally {
      setLoading(false);
    }
  }, [search]);

  return (
    <div className="flex h-[calc(100vh-57px)]">
      {/* Main: Graph */}
      <div className="flex-1 flex flex-col min-w-0">
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
          <button
            onClick={() => setShowTextView(!showTextView)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-pressed={showTextView}
          >
            {showTextView ? 'Graph' : 'Text'}
          </button>
          {error && <span className="text-sm text-red-500" role="alert">{error}</span>}
        </div>

        <div className="flex-1 overflow-auto">
          {!resolveData ? (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
              <div className="text-center">
                <p>Enter a control reference to explore its mappings</p>
                <p className="text-xs mt-1">Example: sig-lite-2026:A.1 or nist-800-53-r5:ac-1</p>
              </div>
            </div>
          ) : showTextView ? (
            <ResolveView data={resolveData} />
          ) : (
            <MappingGraph data={resolveData} />
          )}
        </div>
      </div>
    </div>
  );
}
