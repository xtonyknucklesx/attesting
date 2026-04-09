import React from 'react';

interface Family {
  family: string;
  total: number;
  implemented: number;
  not_applicable: number;
}

interface FrameworkRow {
  catalogShortName: string;
  catalogName: string;
  families: Family[];
}

interface FrameworkGridProps {
  data: FrameworkRow[];
}

function cellColor(total: number, covered: number): string {
  if (total === 0) return 'bg-gray-100 text-gray-400';
  const pct = (covered / total) * 100;
  if (pct >= 80) return 'bg-green-100 text-green-800';
  if (pct >= 40) return 'bg-amber-100 text-amber-800';
  return 'bg-red-100 text-red-800';
}

export default function FrameworkGrid({ data }: FrameworkGridProps) {
  if (data.length === 0) return null;

  // Collect all unique family names across all frameworks
  const allFamilies = new Set<string>();
  data.forEach((fw) => fw.families.forEach((f) => allFamilies.add(f.family)));
  const families = [...allFamilies].sort().slice(0, 20); // limit columns

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-900">Coverage Heat Map</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs" role="table">
          <caption className="sr-only">Framework coverage by control family</caption>
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th scope="col" className="text-left px-3 py-2 font-medium text-gray-600 sticky left-0 bg-gray-50 z-10">Framework</th>
              {families.map((f) => (
                <th key={f} scope="col" className="px-2 py-2 font-medium text-gray-600 text-center whitespace-nowrap">{f}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.map((fw) => {
              const familyMap = new Map(fw.families.map((f) => [f.family, f]));
              return (
                <tr key={fw.catalogShortName} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium text-gray-900 sticky left-0 bg-white z-10 whitespace-nowrap">
                    {fw.catalogName.length > 25 ? fw.catalogShortName : fw.catalogName}
                  </td>
                  {families.map((f) => {
                    const fam = familyMap.get(f);
                    if (!fam) return <td key={f} className="px-2 py-2 text-center bg-gray-50 text-gray-300">—</td>;
                    const covered = fam.implemented + fam.not_applicable;
                    const pct = fam.total > 0 ? Math.round((covered / fam.total) * 100) : 0;
                    return (
                      <td key={f} className={`px-2 py-2 text-center font-medium ${cellColor(fam.total, covered)}`}
                        title={`${covered}/${fam.total} (${pct}%)`}
                        aria-label={`${fw.catalogShortName} ${f}: ${pct}%`}>
                        {pct}%
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
