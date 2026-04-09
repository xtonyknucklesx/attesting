import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { getCatalogs } from '../../lib/api';
import CatalogDetail from './CatalogDetail';
import { Library, Search } from 'lucide-react';

interface CatalogListProps { scope: string; }

export default function CatalogList({ scope }: CatalogListProps) {
  const { shortName: urlShortName } = useParams<{ shortName?: string }>();
  const [selectedCatalog, setSelectedCatalog] = useState<string>(urlShortName || '');
  const [search, setSearch] = useState('');
  const { data: catalogs, loading } = useApi(() => getCatalogs(), []);

  const filtered = catalogs?.filter((c: any) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.short_name.toLowerCase().includes(search.toLowerCase())
  );

  React.useEffect(() => {
    if (!selectedCatalog && filtered && filtered.length > 0) setSelectedCatalog(filtered[0].short_name);
  }, [filtered, selectedCatalog]);

  React.useEffect(() => { if (urlShortName) setSelectedCatalog(urlShortName); }, [urlShortName]);

  return (
    <div className="flex h-[calc(100vh-49px)]">
      {/* Left panel */}
      <div className="w-72 glass-panel flex flex-col shrink-0" style={{ borderRadius: 0, borderRight: '1px solid var(--border-glass)' }}>
        <div className="p-3" style={{ borderBottom: '1px solid var(--border-glass)' }}>
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-4 w-4" style={{ color: 'var(--text-dim)' }} aria-hidden="true" />
            <label htmlFor="catalog-search" className="sr-only">Search frameworks</label>
            <input id="catalog-search" type="search" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search frameworks..." className="input-glass w-full pl-8" />
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto" aria-label="Framework list">
          {loading ? <div className="p-4 text-[12px]" style={{ color: 'var(--text-dim)' }}>Loading...</div> : (
            <ul role="listbox" aria-label="Frameworks">
              {filtered?.map((cat: any) => (
                <li key={cat.short_name} role="option" aria-selected={selectedCatalog === cat.short_name}>
                  <button onClick={() => setSelectedCatalog(cat.short_name)}
                    className="w-full text-left px-4 py-3 transition-colors duration-75"
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      background: selectedCatalog === cat.short_name ? 'var(--bg-glass-active)' : 'transparent',
                      borderLeft: selectedCatalog === cat.short_name ? '2px solid #818cf8' : '2px solid transparent',
                    }}
                    onMouseEnter={e => { if (selectedCatalog !== cat.short_name) e.currentTarget.style.background = 'var(--row-hover)'; }}
                    onMouseLeave={e => { if (selectedCatalog !== cat.short_name) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div className="flex items-center gap-2">
                      <Library className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--text-dim)' }} aria-hidden="true" />
                      <span className="text-[13px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>{cat.name}</span>
                    </div>
                    <div className="flex items-center justify-between mt-1 ml-5">
                      <span className="text-[11px] font-mono" style={{ color: 'var(--text-dim)' }}>{cat.short_name}</span>
                      <span className="text-[11px]" style={{ color: 'var(--text-dim)' }}>{cat.total_controls}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </nav>
      </div>
      {/* Main */}
      <div className="flex-1 min-w-0">
        {selectedCatalog ? <CatalogDetail shortName={selectedCatalog} scope={scope} /> : (
          <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-dim)' }}>
            <p className="text-[13px]">Select a framework to view its controls</p>
          </div>
        )}
      </div>
    </div>
  );
}
