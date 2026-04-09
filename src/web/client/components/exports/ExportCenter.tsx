import React, { useState } from 'react';
import { runExport, getCatalogs } from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { FileSpreadsheet, FileJson, FileText, Download, Check, Loader2 } from 'lucide-react';

interface ExportFormat {
  id: string;
  name: string;
  description: string;
  icon: any;
  needsCatalog?: boolean;
}

const FORMATS: ExportFormat[] = [
  { id: 'sig', name: 'SIG Questionnaire', description: 'Shared Assessments SIG response workbook (.xlsx)', icon: FileSpreadsheet, needsCatalog: true },
  { id: 'oscal', name: 'OSCAL JSON', description: 'OSCAL Component Definition for automated compliance', icon: FileJson },
  { id: 'soa', name: 'ISO 27001 SOA', description: 'Statement of Applicability workbook (.xlsx)', icon: FileSpreadsheet },
  { id: 'csv', name: 'CSV Export', description: 'Flat CSV with all implementations and mappings', icon: FileText },
];

interface ExportCenterProps {
  scope: string;
}

export default function ExportCenter({ scope }: ExportCenterProps) {
  const [exporting, setExporting] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, { filename: string; outputPath: string }>>({});
  const [error, setError] = useState('');
  const [selectedCatalog, setSelectedCatalog] = useState('');
  const { data: catalogs } = useApi(() => getCatalogs(), []);

  const handleExport = async (format: ExportFormat) => {
    setExporting(format.id);
    setError('');
    try {
      const result = await runExport(
        format.id,
        format.needsCatalog ? selectedCatalog : undefined,
        scope || undefined
      );
      setResults((prev) => ({ ...prev, [format.id]: result }));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="p-6 max-w-[1000px] mx-auto">
      <h2 className="text-lg font-semibold text-gray-900 mb-2">Export Center</h2>
      <p className="text-sm text-gray-500 mb-6">Generate compliance exports in any format. Files are saved to ~/.crosswalk/exports/</p>

      {error && <p className="text-sm text-red-500 mb-4" role="alert">{error}</p>}

      {/* Catalog selector for formats that need it */}
      <div className="mb-6">
        <label htmlFor="export-catalog" className="block text-xs font-medium text-gray-600 mb-1">
          Target Catalog (for SIG export)
        </label>
        <select
          id="export-catalog"
          value={selectedCatalog}
          onChange={(e) => setSelectedCatalog(e.target.value)}
          className="w-full max-w-xs text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Auto-detect</option>
          {catalogs?.map((c: any) => (
            <option key={c.short_name} value={c.short_name}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Format cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {FORMATS.map((format) => {
          const Icon = format.icon;
          const isExporting = exporting === format.id;
          const result = results[format.id];
          return (
            <div key={format.id} className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-sm transition-shadow">
              <div className="flex items-start gap-3 mb-3">
                <div className="p-2 bg-indigo-50 rounded-lg" aria-hidden="true">
                  <Icon className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">{format.name}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{format.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleExport(format)}
                  disabled={isExporting}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
                  aria-live="polite"
                >
                  {isExporting ? (
                    <><Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> Exporting...</>
                  ) : (
                    <><Download className="h-3 w-3" aria-hidden="true" /> Export</>
                  )}
                </button>
                {result && (
                  <a
                    href={`/api/export/download/${encodeURIComponent(result.filename)}`}
                    className="inline-flex items-center gap-1 text-xs text-green-600 hover:text-green-700"
                    download
                  >
                    <Check className="h-3 w-3" aria-hidden="true" />
                    {result.filename}
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
