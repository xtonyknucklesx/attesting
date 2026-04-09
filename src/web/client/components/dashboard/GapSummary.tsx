import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface GapSummaryProps {
  coverageData: Array<{
    catalogShortName: string;
    totalControls: number;
    implemented: number;
    notApplicable: number;
    mappedCoverage: number;
    notImplemented: number;
  }>;
}

export default function GapSummary({ coverageData }: GapSummaryProps) {
  const totalGaps = coverageData.reduce((sum, c) => sum + c.notImplemented, 0);
  const totalControls = coverageData.reduce((sum, c) => sum + c.totalControls, 0);
  const totalImplemented = coverageData.reduce((sum, c) => sum + c.implemented + c.notApplicable, 0);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-gray-900">Gap Summary</h2>
      </div>
      <div className="grid grid-cols-3 gap-4" role="group" aria-label="Compliance gaps overview">
        <div>
          <p className="text-2xl font-bold text-gray-900">{totalGaps}</p>
          <p className="text-xs text-gray-500">Total gaps</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{totalControls}</p>
          <p className="text-xs text-gray-500">Total controls</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-green-600">{totalImplemented}</p>
          <p className="text-xs text-gray-500">Covered</p>
        </div>
      </div>
      {coverageData.length > 0 && (
        <div className="mt-4 space-y-2">
          {coverageData
            .filter((c) => c.notImplemented > 0)
            .sort((a, b) => b.notImplemented - a.notImplemented)
            .slice(0, 5)
            .map((c) => (
              <div key={c.catalogShortName} className="flex items-center justify-between text-xs">
                <span className="text-gray-600 truncate">{c.catalogShortName}</span>
                <span className="font-medium text-red-600 shrink-0 ml-2">
                  {c.notImplemented} gap{c.notImplemented !== 1 ? 's' : ''}
                </span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
