import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { getCatalogs } from '../../lib/api';
import CatalogDetail from './CatalogDetail';
import { Library, Search } from 'lucide-react';

interface CatalogListProps {
  scope: string;
}

export default function CatalogList({ scope }: CatalogListProps) {
  const { shortName: urlShortName } = useParams<{ shortName?: string }>();
  const [selectedCatalog, setSelectedCatalog] = useState<string>(urlShortName || '');
  const [search, setSearch] = useState('');
  const { data: catalogs, loading } = useApi(() => getCatalogs(), []);

  const filtered = catalogs?.filter((c: any) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.short_name.toLowerCase().includes(search.toLowerCase())
  );

  // Auto-select first catalog if none selected
  React.useEffect(() => {
    if (!selectedCatalog && filtered && filtered.length > 0) {
      setSelectedCatalog(filtered[0].short_name);
    }
  }, [filtered, selectedCatalog]);

  React.useEffect(() => {
    if (urlShortName) setSelectedCatalog(urlShortName);
  }, [urlShortName]);

  return (
    <div className="flex h-[calc(100vh-57px)]">
      {/* Left panel — catalog list */}
      <div className="w-72 border-r border-gray-200 bg-white flex flex-col shrink-0">
        <div className="p-3 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-4 w-4 text-gray-400" aria-hidden="true" />
            <label htmlFor="catalog-search" className="sr-only">Search frameworks</label>
            <input
              id="catalog-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search frameworks..."
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto" aria-label="Framework list">
          {loading ? (
            <div className="p-4 text-xs text-gray-400">Loading...</div>
          ) : (
            <ul role="listbox" aria-label="Frameworks">
              {filtered?.map((cat: any) => (
                <li key={cat.short_name} role="option" aria-selected={selectedCatalog === cat.short_name}>
                  <button
                    onClick={() => setSelectedCatalog(cat.short_name)}
                    className={`w-full text-left px-4 py-3 border-b border-gray-100 transition-colors ${
                      selectedCatalog === cat.short_name
                        ? 'bg-indigo-50 border-l-2 border-l-indigo-600'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Library className="h-3.5 w-3.5 text-gray-400 shrink-0" aria-hidden="true" />
                      <span className="text-sm font-medium text-gray-900 truncate">{cat.name}</span>
                    </div>
                    <div className="flex items-center justify-between mt-1 ml-5.5">
                      <span className="text-xs text-gray-500">{cat.short_name}</span>
                      <span className="text-xs text-gray-400">{cat.total_controls} controls</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </nav>
      </div>

      {/* Main panel — controls */}
      <div className="flex-1 min-w-0">
        {selectedCatalog ? (
          <CatalogDetail shortName={selectedCatalog} scope={scope} />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            Select a framework to view its controls
          </div>
        )}
      </div>
    </div>
  );
}
