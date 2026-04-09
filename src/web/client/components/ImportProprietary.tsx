import { useState, useCallback } from 'react';

interface PreviewControl {
  control_id: string;
  title: string;
  description?: string;
  family?: string;
}

interface MappingPreview {
  imported_control_id: string;
  maps_to_catalog: string;
  maps_to_control_id: string;
  maps_to_title: string;
  relationship: string;
}

interface ImportPreviewData {
  format: string;
  detection: { format: string; confidence: string; reason: string };
  catalog_name: string;
  catalog_short_name: string;
  controls: PreviewControl[];
  control_count: number;
  mappings: MappingPreview[];
  mapping_count: number;
  warnings: string[];
  would_overwrite: boolean;
  _upload_path: string;
  _original_name: string;
}

interface ImportResult {
  catalog_id: string;
  controls_imported: number;
  mappings_resolved: number;
  warnings: string[];
}

type Step = 'upload' | 'preview' | 'importing' | 'done';

export default function ImportProprietary() {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [formatOverride, setFormatOverride] = useState('');
  const [overwrite, setOverwrite] = useState(false);
  const [preview, setPreview] = useState<ImportPreviewData | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const handleUpload = useCallback(async () => {
    if (!file) return;
    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      const url = formatOverride
        ? `/api/import/preview?format=${formatOverride}`
        : '/api/import/preview';

      const res = await fetch(url, { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Upload failed');
        return;
      }
      setPreview(data);
      setStep('preview');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [file, formatOverride]);

  const handleConfirm = useCallback(async () => {
    if (!preview) return;
    setStep('importing');
    setError('');

    try {
      const res = await fetch('/api/import/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          upload_path: preview._upload_path,
          original_name: preview._original_name,
          format: formatOverride || undefined,
          overwrite,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Import failed');
        setStep('preview');
        return;
      }
      setResult(data);
      setStep('done');
    } catch (e: any) {
      setError(e.message);
      setStep('preview');
    }
  }, [preview, formatOverride, overwrite]);

  const reset = () => {
    setStep('upload');
    setFile(null);
    setPreview(null);
    setResult(null);
    setError('');
    setFormatOverride('');
    setOverwrite(false);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-2">Import Proprietary Catalog</h2>
      <p className="text-gray-500 mb-6">
        Import licensed frameworks like SIG Full or ISO 27001. Files are stored locally and never leave your system.
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8">
          <div className="text-center">
            <label className="cursor-pointer">
              <div className="mb-4">
                <span className="text-4xl">📁</span>
              </div>
              <span className="text-lg font-medium text-blue-600 hover:text-blue-700">
                {file ? file.name : 'Choose a file or drag it here'}
              </span>
              <input
                type="file"
                className="hidden"
                accept=".xlsx,.json,.csv"
                onChange={e => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          <div className="mt-6 flex items-center gap-4 justify-center">
            <select
              value={formatOverride}
              onChange={e => setFormatOverride(e.target.value)}
              className="border rounded px-3 py-2 text-sm"
            >
              <option value="">Auto-detect format</option>
              <option value="sig-xlsx">SIG Questionnaire (.xlsx)</option>
              <option value="iso27001-xlsx">ISO 27001 Annex A (.xlsx)</option>
              <option value="oscal-json">OSCAL Catalog (.json)</option>
              <option value="csv-generic">Generic CSV (.csv)</option>
            </select>

            <button
              onClick={handleUpload}
              disabled={!file || loading}
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Analyzing...' : 'Preview Import'}
            </button>
          </div>

          <p className="text-xs text-gray-400 text-center mt-4">
            Accepted: .xlsx (SIG, ISO 27001), .json (OSCAL), .csv — 10 MB max
          </p>
        </div>
      )}

      {/* Step 2: Preview */}
      {step === 'preview' && preview && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-500">Catalog:</span> <strong>{preview.catalog_name}</strong></div>
              <div><span className="text-gray-500">Format:</span> {preview.format} ({preview.detection.confidence})</div>
              <div><span className="text-gray-500">Controls:</span> <strong>{preview.control_count}</strong></div>
              <div><span className="text-gray-500">Mappings:</span> <strong>{preview.mapping_count}</strong> found</div>
            </div>
            {(preview as any).scan && (
              <p className="text-xs text-green-600 mt-2">
                ✓ Passed {(preview as any).scan.checks_passed.length} security checks ({((preview as any).scan.file_size / 1024).toFixed(0)} KB)
              </p>
            )}
          </div>

          {/* Warnings */}
          {preview.warnings.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 px-4 py-3 rounded">
              {preview.warnings.map((w, i) => <p key={i} className="text-sm text-yellow-700">⚠ {w}</p>)}
            </div>
          )}

          {preview.would_overwrite && (
            <div className="bg-amber-50 border border-amber-200 px-4 py-3 rounded flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-amber-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={overwrite}
                  onChange={e => setOverwrite(e.target.checked)}
                />
                Overwrite existing catalog "{preview.catalog_short_name}"
              </label>
            </div>
          )}

          {/* Controls preview */}
          <div>
            <h3 className="font-semibold mb-2">Controls ({preview.control_count})</h3>
            <div className="border rounded overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-2">ID</th>
                    <th className="text-left px-3 py-2">Title</th>
                    <th className="text-left px-3 py-2">Family</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.controls.slice(0, 20).map((c, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-1.5 font-mono text-xs">{c.control_id}</td>
                      <td className="px-3 py-1.5">{c.title.substring(0, 80)}</td>
                      <td className="px-3 py-1.5 text-gray-500">{c.family ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.control_count > 20 && (
                <p className="text-xs text-gray-400 px-3 py-2 bg-gray-50">
                  ... and {preview.control_count - 20} more controls
                </p>
              )}
            </div>
          </div>

          {/* Mappings preview */}
          {preview.mappings.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Cross-Framework Mappings ({preview.mapping_count})</h3>
              <div className="border rounded overflow-hidden text-sm">
                {preview.mappings.slice(0, 10).map((m, i) => (
                  <div key={i} className="border-t px-3 py-1.5 flex gap-2">
                    <span className="font-mono text-xs">{m.imported_control_id}</span>
                    <span className="text-gray-400">→</span>
                    <span className="font-mono text-xs">{m.maps_to_catalog}:{m.maps_to_control_id}</span>
                    <span className="text-gray-500 ml-auto">{m.relationship}</span>
                  </div>
                ))}
                {preview.mappings.length > 10 && (
                  <p className="text-xs text-gray-400 px-3 py-2 bg-gray-50">
                    ... and {preview.mappings.length - 10} more mappings
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleConfirm}
              disabled={preview.would_overwrite && !overwrite}
              className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 disabled:opacity-50"
            >
              Confirm Import
            </button>
            <button onClick={reset} className="border px-6 py-2 rounded hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Importing */}
      {step === 'importing' && (
        <div className="text-center py-12">
          <p className="text-lg">Importing controls...</p>
        </div>
      )}

      {/* Step 4: Done */}
      {step === 'done' && result && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-green-800 mb-3">Import Complete</h3>
          <div className="space-y-1 text-sm">
            <p><strong>{result.controls_imported}</strong> controls imported</p>
            <p><strong>{result.mappings_resolved}</strong> cross-framework mappings auto-resolved</p>
            <p className="text-gray-500">Catalog ID: {result.catalog_id}</p>
          </div>
          {result.warnings.length > 0 && (
            <div className="mt-3">
              {result.warnings.map((w, i) => <p key={i} className="text-sm text-yellow-700">⚠ {w}</p>)}
            </div>
          )}
          <button onClick={reset} className="mt-4 border px-4 py-2 rounded hover:bg-white">
            Import Another
          </button>
        </div>
      )}
    </div>
  );
}
