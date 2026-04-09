import React from 'react';
import { useApi } from '../../hooks/useApi';
import { getCoverage } from '../../lib/api';
import CoverageCard from './CoverageCard';
import GapSummary from './GapSummary';
import RecentActivity from './RecentActivity';
import FrameworkGrid from './FrameworkGrid';

interface DashboardProps {
  scope: string;
}

export default function Dashboard({ scope }: DashboardProps) {
  const { data: coverage, loading } = useApi(
    () => getCoverage(scope || undefined),
    [scope]
  );

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      <h2 className="sr-only">Dashboard</h2>

      {/* Coverage Cards */}
      <section aria-label="Framework coverage">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-lg p-5 h-48 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-2/3 mb-3" />
                <div className="h-20 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        ) : coverage && coverage.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {coverage.map((c: any) => (
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
              />
            ))}
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
            <p className="text-gray-500 text-sm">No catalogs imported yet. Import a framework to get started.</p>
            <code className="text-xs text-gray-400 mt-2 block">crosswalk catalog import --format oscal --file ...</code>
          </div>
        )}
      </section>

      {/* Gap Summary + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section aria-label="Gap summary">
          {coverage && <GapSummary coverageData={coverage} />}
        </section>
        <section aria-label="Recent activity">
          <RecentActivity />
        </section>
      </div>

      {/* Framework Grid */}
      {coverage && coverage.length > 0 && (
        <section aria-label="Coverage heat map">
          <FrameworkGrid data={coverage} />
        </section>
      )}
    </div>
  );
}
