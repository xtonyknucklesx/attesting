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
  if (total === 0) return 'bg-gray-50 text-gray-300';
  const pct = (covered / total) * 100;
  if (pct >= 80) return 'bg-green-50 text-green-700';
  if (pct >= 40) return 'bg-amber-50 text-amber-700';
  if (pct > 0) return 'bg-rose-50 text-rose-700';
  return 'bg-gray-50 text-gray-400';
}

export default function FrameworkGrid({ data }: FrameworkGridProps) {
  if (data.length === 0) return null;

  const allFamilies = new Set<string>();
  data.forEach((fw) => fw.families.forEach((f) => allFamilies.add(f.family)));
  const families = [...allFamilies].sort().slice(0, 20);

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-200">
        <h3 className="text-[12px] font-semibold text-gray-400 uppercase tracking-wider">Coverage Heat Map</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]" role="table">
          <caption className="sr-only">Framework coverage by control family</caption>
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th scope="col" className="text-left px-4 py-2 font-medium text-gray-500 sticky left-0 bg-gray-50/50 z-10 backdrop-blur-sm">Framework</th>
              {families.map((f) => (
                <th key={f} scope="col" className="px-2 py-2 font-medium text-gray-400 text-center whitespace-nowrap">{f}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {data.map((fw, ri) => {
              const familyMap = new Map(fw.families.map((f) => [f.family, f]));
              return (
                <tr key={fw.catalogShortName} className={ri % 2 === 1 ? 'bg-gray-50/30' : ''}>
                  <td className="px-4 py-2 font-medium text-gray-700 sticky left-0 bg-white z-10 whitespace-nowrap text-[12px]">
                    {fw.catalogName.length > 25 ? fw.catalogShortName : fw.catalogName}
                  </td>
                  {families.map((f) => {
                    const fam = familyMap.get(f);
                    if (!fam) return <td key={f} className="px-2 py-2 text-center text-gray-200">—</td>;
                    const covered = fam.implemented + fam.not_applicable;
                    const pct = fam.total > 0 ? Math.round((covered / fam.total) * 100) : 0;
                    return (
                      <td key={f} className={`px-2 py-2 text-center font-medium rounded-sm ${cellColor(fam.total, covered)}`}
                        title={`${covered}/${fam.total} (${pct}%)`}
                        aria-label={`${fw.catalogShortName} ${f}: ${pct}%`}>
                        {pct > 0 ? `${pct}%` : '0'}
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
