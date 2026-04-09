import React, { useState } from 'react';
import { runExport, getCatalogs } from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { useToastContext } from '../../App';
import { FileSpreadsheet, FileJson, FileText, Download, Check, Loader2 } from 'lucide-react';

const FORMATS = [
  { id: 'sig', name: 'SIG Questionnaire', desc: 'Shared Assessments SIG response (.xlsx)', icon: FileSpreadsheet, needsCatalog: true },
  { id: 'oscal', name: 'OSCAL JSON', desc: 'OSCAL Component Definition for automation', icon: FileJson },
  { id: 'soa', name: 'ISO 27001 SOA', desc: 'Statement of Applicability (.xlsx)', icon: FileSpreadsheet },
  { id: 'csv', name: 'CSV Export', desc: 'Flat CSV with implementations and mappings', icon: FileText },
];

export default function ExportCenter({ scope }: { scope: string }) {
  const { add: toast } = useToastContext();
  const [exporting, setExporting] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, { filename: string }>>({});
  const [selectedCatalog, setSelectedCatalog] = useState('');
  const { data: catalogs } = useApi(() => getCatalogs(), []);

  const doExport = async (fmt: typeof FORMATS[0]) => {
    setExporting(fmt.id);
    try {
      const r = await runExport(fmt.id, fmt.needsCatalog ? selectedCatalog : undefined, scope || undefined);
      setResults(p => ({ ...p, [fmt.id]: r }));
      toast(`${fmt.name} exported`, 'success');
    } catch (e: any) { toast(e.message || 'Export failed', 'error'); }
    finally { setExporting(null); }
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1000px] mx-auto">
      <h2 className="text-[18px] font-semibold tracking-tight mb-1" style={{ color: 'var(--text-primary)' }}>Export Center</h2>
      <p className="text-[13px] mb-6" style={{ color: 'var(--text-tertiary)' }}>Generate compliance exports in any format</p>

      <div className="mb-6">
        <label htmlFor="export-catalog" className="block text-[12px] font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Target Catalog</label>
        <select id="export-catalog" value={selectedCatalog} onChange={e => setSelectedCatalog(e.target.value)} className="input-glass w-full max-w-xs">
          <option value="">Auto-detect</option>
          {catalogs?.map((c: any) => <option key={c.short_name} value={c.short_name}>{c.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {FORMATS.map(fmt => {
          const Icon = fmt.icon;
          const isExp = exporting === fmt.id;
          const res = results[fmt.id];
          return (
            <div key={fmt.id} className="glass p-5">
              <div className="flex items-start gap-3 mb-4">
                <div className="p-2.5 rounded-xl" style={{ background: 'var(--bg-glass-strong)', boxShadow: 'var(--glow-indigo)' }}>
                  <Icon className="h-5 w-5 text-indigo-400" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>{fmt.name}</h3>
                  <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{fmt.desc}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => doExport(fmt)} disabled={!!exporting}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 text-white text-[12px] font-medium rounded-xl hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 transition-colors shadow-lg shadow-indigo-600/20"
                  aria-live="polite">
                  {isExp ? <><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Exporting...</> : <><Download className="h-3.5 w-3.5" aria-hidden="true" /> Export</>}
                </button>
                {res && (
                  <a href={`/api/export/download/${encodeURIComponent(res.filename)}`} className="inline-flex items-center gap-1 text-[12px] text-green-400 hover:text-green-300 font-medium" download>
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />{res.filename}
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
