import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface GapSummaryProps {
  coverageData: Array<{
    catalogShortName: string;
    catalogName: string;
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
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden="true" />
        <h3 className="text-[13px] font-semibold text-gray-900">Gap Summary</h3>
      </div>
      <div className="grid grid-cols-3 gap-4 mb-5" role="group" aria-label="Compliance gaps">
        <div>
          <p className="text-2xl font-bold text-gray-900">{totalGaps.toLocaleString()}</p>
          <p className="text-[11px] text-gray-500">Total gaps</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{totalControls.toLocaleString()}</p>
          <p className="text-[11px] text-gray-500">Controls</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-green-600">{totalImplemented.toLocaleString()}</p>
          <p className="text-[11px] text-gray-500">Covered</p>
        </div>
      </div>
      {coverageData.length > 0 && (
        <div className="space-y-2.5">
          {coverageData
            .filter((c) => c.notImplemented > 0)
            .sort((a, b) => b.notImplemented - a.notImplemented)
            .slice(0, 5)
            .map((c) => {
              const pct = c.totalControls > 0 ? Math.round(((c.implemented + c.notApplicable) / c.totalControls) * 100) : 0;
              return (
                <div key={c.catalogShortName}>
                  <div className="flex items-center justify-between text-[12px] mb-1">
                    <span className="text-gray-600 truncate">{c.catalogName}</span>
                    <span className="font-medium text-rose-600 shrink-0 ml-2">{c.notImplemented} gaps</span>
                  </div>
                  <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-green-400 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
