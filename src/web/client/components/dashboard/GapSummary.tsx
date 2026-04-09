import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface GapSummaryProps {
  coverageData: Array<{
    catalogShortName: string; catalogName: string; totalControls: number;
    implemented: number; notApplicable: number; mappedCoverage: number; notImplemented: number;
  }>;
}

export default function GapSummary({ coverageData }: GapSummaryProps) {
  const totalGaps = coverageData.reduce((s, c) => s + c.notImplemented, 0);
  const totalControls = coverageData.reduce((s, c) => s + c.totalControls, 0);
  const totalImplemented = coverageData.reduce((s, c) => s + c.implemented + c.notApplicable, 0);

  return (
    <div className="glass-static rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="h-4 w-4 text-amber-400" aria-hidden="true" />
        <h3 className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>Gap Summary</h3>
      </div>
      <div className="grid grid-cols-3 gap-4 mb-5" role="group" aria-label="Compliance gaps">
        <div>
          <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{totalGaps.toLocaleString()}</p>
          <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>Total gaps</p>
        </div>
        <div>
          <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{totalControls.toLocaleString()}</p>
          <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>Controls</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-green-400">{totalImplemented.toLocaleString()}</p>
          <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>Covered</p>
        </div>
      </div>
      <div className="space-y-3">
        {coverageData.filter((c) => c.notImplemented > 0).sort((a, b) => b.notImplemented - a.notImplemented).slice(0, 5).map((c) => {
          const pct = c.totalControls > 0 ? Math.round(((c.implemented + c.notApplicable) / c.totalControls) * 100) : 0;
          return (
            <div key={c.catalogShortName}>
              <div className="flex items-center justify-between text-[12px] mb-1">
                <span style={{ color: 'var(--text-secondary)' }} className="truncate">{c.catalogName}</span>
                <span className="font-medium text-rose-400 shrink-0 ml-2">{c.notImplemented} gaps</span>
              </div>
              <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--ring-track)' }}>
                <div className="h-full bg-green-400 rounded-full" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
