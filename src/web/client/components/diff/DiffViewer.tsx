import React, { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { getCatalogs, runDiff } from '../../lib/api';
import { ArrowRight, Plus, Minus, PenLine, ArrowLeftRight, Check } from 'lucide-react';

const TYPE_BADGE: Record<string, { label: string; cls: string; Icon: any }> = {
  added:      { label: 'Added', cls: 'pill-green', Icon: Plus },
  removed:    { label: 'Removed', cls: 'pill-rose', Icon: Minus },
  modified:   { label: 'Modified', cls: 'pill-amber', Icon: PenLine },
  renumbered: { label: 'Renumbered', cls: 'pill-blue', Icon: ArrowLeftRight },
  unchanged:  { label: 'Unchanged', cls: 'pill-gray', Icon: Check },
};

const SEV_DOT: Record<string, string> = { major: 'status-dot-rose', moderate: 'status-dot-amber', minor: 'status-dot-green' };

export default function DiffViewer() {
  const [oldCat, setOldCat] = useState('');
  const [newCat, setNewCat] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState<Set<string>>(new Set(['added', 'removed', 'modified', 'renumbered']));
  const { data: catalogs } = useApi(() => getCatalogs(), []);

  const handleDiff = async () => {
    if (!oldCat || !newCat) return;
    setLoading(true); setError('');
    try { setResult(await runDiff(oldCat, newCat)); } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };

  const toggle = (t: string) => setFilters(p => { const n = new Set(p); n.has(t) ? n.delete(t) : n.add(t); return n; });

  const changes = result ? [
    ...result.added.map((c: any) => ({ ...c, _t: 'added' })),
    ...result.removed.map((c: any) => ({ ...c, _t: 'removed' })),
    ...result.modified.map((c: any) => ({ ...c, _t: 'modified' })),
    ...result.renumbered.map((c: any) => ({ ...c, _t: 'renumbered' })),
    ...(filters.has('unchanged') ? result.unchanged.map((c: any) => ({ ...c, _t: 'unchanged' })) : []),
  ].filter(c => filters.has(c._t)) : [];

  return (
    <div className="p-6 lg:p-8 max-w-[1200px] mx-auto">
      <h2 className="text-[18px] font-semibold tracking-tight mb-5" style={{ color: 'var(--text-primary)' }}>Framework Version Diff</h2>

      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1">
          <label htmlFor="old-cat" className="block text-[12px] font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Old Version</label>
          <select id="old-cat" value={oldCat} onChange={e => setOldCat(e.target.value)} className="input-glass w-full">
            <option value="">Select catalog...</option>
            {catalogs?.map((c: any) => <option key={c.short_name} value={c.short_name}>{c.name} ({c.short_name})</option>)}
          </select>
        </div>
        <ArrowRight className="h-4 w-4 mt-6 shrink-0" style={{ color: 'var(--text-dim)' }} aria-hidden="true" />
        <div className="flex-1">
          <label htmlFor="new-cat" className="block text-[12px] font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>New Version</label>
          <select id="new-cat" value={newCat} onChange={e => setNewCat(e.target.value)} className="input-glass w-full">
            <option value="">Select catalog...</option>
            {catalogs?.map((c: any) => <option key={c.short_name} value={c.short_name}>{c.name} ({c.short_name})</option>)}
          </select>
        </div>
        <button onClick={handleDiff} disabled={loading || !oldCat || !newCat}
          className="mt-6 px-5 py-2 bg-indigo-600 text-white text-[13px] font-medium rounded-xl hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 transition-colors shadow-lg shadow-indigo-600/20">
          {loading ? 'Comparing...' : 'Compare'}
        </button>
      </div>

      {error && <p className="text-[13px] text-rose-400 mb-4" role="alert">{error}</p>}

      {result && (
        <div className="animate-fade-in">
          <div className="flex items-center gap-2 mb-5 flex-wrap" role="group" aria-label="Change type filters">
            {Object.entries(result.summary).filter(([k]) => k !== 'total').map(([key, count]) => {
              const b = TYPE_BADGE[key]; if (!b) return null;
              const on = filters.has(key);
              return (
                <button key={key} onClick={() => toggle(key)} aria-pressed={on}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all duration-100 ${on ? 'pill ' + b.cls : 'glass-btn'}`}
                  style={on ? undefined : { color: 'var(--text-dim)' }}>
                  <b.Icon className="h-3 w-3" aria-hidden="true" />{b.label}: {count as number}
                </button>
              );
            })}
          </div>

          <div className="glass-static rounded-2xl overflow-hidden">
            <table className="w-full glass-table" role="table">
              <caption className="sr-only">Diff results</caption>
              <thead><tr>
                <th scope="col" className="w-28">Type</th>
                <th scope="col" className="w-36">Control ID</th>
                <th scope="col">Title</th>
                <th scope="col" className="w-16 text-center">Severity</th>
                <th scope="col" className="w-32">Action</th>
              </tr></thead>
              <tbody>
                {changes.slice(0, 200).map((c: any, i: number) => {
                  const b = TYPE_BADGE[c._t] ?? TYPE_BADGE['unchanged'];
                  const cid = c.newControl?.control_id ?? c.oldControl?.control_id ?? '?';
                  const title = c.newControl?.title ?? c.oldControl?.title ?? '';
                  return (
                    <tr key={i}>
                      <td><span className={`pill ${b.cls}`}><b.Icon className="h-3 w-3" aria-hidden="true" />{b.label}</span></td>
                      <td className="font-mono" style={{ color: 'var(--text-primary)' }}>
                        {c.renumberedFrom && <><span style={{ color: 'var(--text-dim)', textDecoration: 'line-through' }}>{c.renumberedFrom}</span><ArrowRight className="inline h-3 w-3 mx-1" style={{ color: 'var(--text-dim)' }} aria-label="to" /></>}
                        {cid}
                      </td>
                      <td className="truncate max-w-md">{title}</td>
                      <td className="text-center">{c.severity && <span className={`status-dot mx-auto ${SEV_DOT[c.severity] ?? ''}`} aria-label={c.severity} />}</td>
                      <td style={{ color: 'var(--text-dim)' }}>{c.actionNeeded?.replace(/-/g, ' ')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {changes.length > 200 && <p className="px-4 py-2 text-[11px]" style={{ color: 'var(--text-dim)', background: 'var(--bg-glass-strong)' }}>Showing first 200 of {changes.length}</p>}
          </div>
        </div>
      )}

      {!result && !loading && (
        <div className="text-center py-16">
          <ArrowLeftRight className="h-8 w-8 mx-auto mb-3 text-indigo-400/20" aria-hidden="true" />
          <p className="text-[13px]" style={{ color: 'var(--text-dim)' }}>Select two catalog versions to compare</p>
        </div>
      )}
    </div>
  );
}
