import React from 'react';

interface Family { family: string; total: number; implemented: number; not_applicable: number; }
interface FrameworkRow { catalogShortName: string; catalogName: string; families: Family[]; }

function cellStyle(total: number, covered: number): React.CSSProperties {
  if (total === 0) return { color: 'var(--text-dim)' };
  const pct = (covered / total) * 100;
  if (pct >= 80) return { background: 'rgba(74,222,128,0.12)', color: '#4ade80' };
  if (pct >= 40) return { background: 'rgba(251,191,36,0.12)', color: '#fbbf24' };
  if (pct > 0) return { background: 'rgba(251,113,133,0.1)', color: '#fb7185' };
  return { color: 'var(--text-dim)' };
}

export default function FrameworkGrid({ data }: { data: FrameworkRow[] }) {
  if (data.length === 0) return null;
  const allFamilies = new Set<string>();
  data.forEach((fw) => fw.families.forEach((f) => allFamilies.add(f.family)));
  const families = [...allFamilies].sort().slice(0, 20);

  return (
    <div className="glass-static rounded-2xl overflow-hidden">
      <div className="px-5 py-3" style={{ borderBottom: '1px solid var(--border-glass)' }}>
        <h3 className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>Coverage Heat Map</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]" role="table">
          <caption className="sr-only">Framework coverage by control family</caption>
          <thead>
            <tr style={{ background: 'var(--bg-glass-strong)', borderBottom: '1px solid var(--border-subtle)' }}>
              <th scope="col" className="text-left px-4 py-2.5 font-medium sticky left-0 z-10" style={{ color: 'var(--text-tertiary)', background: 'var(--bg-glass-strong)' }}>Framework</th>
              {families.map((f) => (
                <th key={f} scope="col" className="px-2 py-2.5 font-medium text-center whitespace-nowrap" style={{ color: 'var(--text-dim)' }}>{f}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((fw, ri) => {
              const familyMap = new Map(fw.families.map((f) => [f.family, f]));
              return (
                <tr key={fw.catalogShortName} style={{ background: ri % 2 === 1 ? 'var(--row-even)' : 'transparent', borderBottom: '1px solid var(--border-subtle)' }}>
                  <td className="px-4 py-2 font-medium sticky left-0 z-10 whitespace-nowrap text-[12px]" style={{ color: 'var(--text-secondary)', background: ri % 2 === 1 ? 'var(--row-even)' : 'var(--bg-body)' }}>
                    {fw.catalogName.length > 25 ? fw.catalogShortName : fw.catalogName}
                  </td>
                  {families.map((f) => {
                    const fam = familyMap.get(f);
                    if (!fam) return <td key={f} className="px-2 py-2 text-center" style={{ color: 'var(--text-dim)' }}>—</td>;
                    const covered = fam.implemented + fam.not_applicable;
                    const pct = fam.total > 0 ? Math.round((covered / fam.total) * 100) : 0;
                    return (
                      <td key={f} className="px-2 py-2 text-center font-medium rounded-sm" style={cellStyle(fam.total, covered)}
                        title={`${covered}/${fam.total} (${pct}%)`} aria-label={`${fw.catalogShortName} ${f}: ${pct}%`}>
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
