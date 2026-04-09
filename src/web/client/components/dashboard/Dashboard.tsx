import React from 'react';
import { useApi } from '../../hooks/useApi';
import { getCoverage, getMappingSummary } from '../../lib/api';
import { Library, Layers, FileEdit, GitCompareArrows } from 'lucide-react';
import CoverageCard from './CoverageCard';
import GapSummary from './GapSummary';
import RecentActivity from './RecentActivity';
import FrameworkGrid from './FrameworkGrid';

interface DashboardProps {
  scope: string;
}

const ACCENT_COLORS = [
  '#4F46E5', '#0891b2', '#7c3aed', '#db2777', '#ea580c',
  '#16a34a', '#ca8a04', '#2563eb', '#9333ea', '#dc2626',
];

export default function Dashboard({ scope }: DashboardProps) {
  const { data: coverage, loading } = useApi(
    () => getCoverage(scope || undefined),
    [scope]
  );
  const { data: mappingSummary } = useApi(() => getMappingSummary(), []);

  // Sort: has implementations first, then by total controls desc
  const sortedCoverage = coverage
    ? [...coverage].sort((a, b) => {
        const aHasImpl = a.implemented > 0 || a.notApplicable > 0 ? 1 : 0;
        const bHasImpl = b.implemented > 0 || b.notApplicable > 0 ? 1 : 0;
        if (bHasImpl !== aHasImpl) return bHasImpl - aHasImpl;
        return b.totalControls - a.totalControls;
      })
    : [];

  const totalFrameworks = coverage?.length ?? 0;
  const totalControls = coverage?.reduce((s: number, c: any) => s + c.totalControls, 0) ?? 0;
  const totalImpl = coverage?.reduce((s: number, c: any) => s + c.implemented, 0) ?? 0;
  const totalMappings = mappingSummary?.total ?? 0;

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-8">
      <h2 className="sr-only">Dashboard</h2>

      {/* Quick stats */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4" aria-label="Quick stats">
        {[
          { label: 'Frameworks', value: totalFrameworks, icon: Library, color: 'text-indigo-600' },
          { label: 'Controls', value: totalControls, icon: Layers, color: 'text-cyan-600' },
          { label: 'Implemented', value: totalImpl, icon: FileEdit, color: 'text-green-600' },
          { label: 'Mappings', value: totalMappings, icon: GitCompareArrows, color: 'text-purple-600' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white border border-gray-200 rounded-xl px-5 py-4 flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-gray-50 ${color}`}>
              <Icon className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xl font-semibold text-gray-900 leading-none">{value.toLocaleString()}</p>
              <p className="text-[11px] text-gray-500 mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Coverage cards */}
      <section aria-label="Framework coverage">
        <h3 className="text-[12px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Framework Coverage</h3>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-xl p-5 h-48 animate-pulse">
                <div className="h-3 bg-gray-100 rounded w-2/3 mb-4" />
                <div className="h-16 bg-gray-50 rounded" />
              </div>
            ))}
          </div>
        ) : sortedCoverage.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sortedCoverage.map((c: any, i: number) => (
              <CoverageCard
                key={c.catalogShortName}
                shortName={c.catalogShortName}
                name={c.catalogName}
                totalControls={c.totalControls}
                implemented={c.implemented}
                notApplicable={c.notApplicable}
                mappedCoverage={c.mappedCoverage}
                coveragePct={c.coveragePct}
                effectivePct={c.effectivePct}
                accentColor={ACCENT_COLORS[i % ACCENT_COLORS.length]}
                index={i}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
            <Library className="h-8 w-8 mx-auto mb-3 text-gray-300" aria-hidden="true" />
            <p className="text-gray-500 text-[13px]">No catalogs imported yet</p>
            <code className="text-[11px] text-gray-400 mt-2 block font-mono">crosswalk catalog import --format oscal --file ...</code>
          </div>
        )}
      </section>

      {/* Gap summary + recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section aria-label="Gap summary">
          {coverage && <GapSummary coverageData={coverage} />}
        </section>
        <section aria-label="Recent activity">
          <RecentActivity />
        </section>
      </div>

      {/* Framework grid */}
      {coverage && coverage.length > 0 && (
        <section aria-label="Coverage heat map">
          <FrameworkGrid data={coverage} />
        </section>
      )}
    </div>
  );
}
