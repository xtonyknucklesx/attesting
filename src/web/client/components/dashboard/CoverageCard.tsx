import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface CoverageCardProps {
  shortName: string;
  name: string;
  totalControls: number;
  implemented: number;
  notApplicable: number;
  mappedCoverage: number;
  coveragePct: number;
  effectivePct: number;
  accentColor: string;
  index: number;
}

export default function CoverageCard({
  shortName, name, totalControls, implemented, notApplicable,
  mappedCoverage, coveragePct, effectivePct, accentColor, index
}: CoverageCardProps) {
  const navigate = useNavigate();
  const covered = implemented + notApplicable;
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const target = circumference - (coveragePct / 100) * circumference;
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), 100 + index * 60);
    return () => clearTimeout(timer);
  }, [index]);

  const ringColor = coveragePct >= 80 ? '#4ade80' : coveragePct >= 40 ? '#fbbf24' : '#fb7185';
  const ringGlow = coveragePct >= 80 ? 'var(--glow-green)' : coveragePct >= 40 ? 'var(--glow-amber)' : 'var(--glow-rose)';
  const barPct = totalControls > 0 ? (covered / totalControls) * 100 : 0;

  return (
    <button
      onClick={() => navigate(`/catalogs/${shortName}`)}
      className="glass p-5 text-left w-full focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-transparent"
      style={{ borderLeftColor: accentColor, borderLeftWidth: 2 }}
      aria-label={`${name}: ${coveragePct}% coverage, ${covered} of ${totalControls} controls covered`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="min-w-0 pr-3">
          <h3 className="text-[13px] font-semibold leading-tight line-clamp-2" style={{ color: 'var(--text-primary)' }}>{name}</h3>
          <p className="text-[11px] mt-0.5 font-mono" style={{ color: 'var(--text-dim)' }}>{shortName}</p>
        </div>
        <div className="relative shrink-0" aria-hidden="true">
          <svg width="74" height="74" viewBox="0 0 74 74">
            <circle cx="37" cy="37" r={radius} fill="none" stroke="var(--ring-track)" strokeWidth="5" />
            <circle
              cx="37" cy="37" r={radius} fill="none"
              stroke={ringColor}
              strokeWidth="5" strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={animated ? target : circumference}
              transform="rotate(-90 37 37)"
              style={{
                transition: 'stroke-dashoffset 700ms ease-out',
                filter: `drop-shadow(${ringGlow})`,
              }}
            />
            <text x="37" y="37" textAnchor="middle" dominantBaseline="central"
              fontSize="13" fontWeight="600" fill="var(--text-primary)" fontFamily="Inter, sans-serif">
              {coveragePct}%
            </text>
          </svg>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 rounded-full mb-3 overflow-hidden" style={{ background: 'var(--ring-track)' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: animated ? `${barPct}%` : '0%', backgroundColor: ringColor }}
        />
      </div>

      <div className="space-y-1.5" role="group" aria-label="Coverage details">
        <div className="flex justify-between text-[12px]">
          <span style={{ color: 'var(--text-tertiary)' }}>Implemented</span>
          <span style={{ color: 'var(--text-primary)' }} className="font-medium">
            {implemented}<span style={{ color: 'var(--text-dim)' }}>/{totalControls}</span>
          </span>
        </div>
        {notApplicable > 0 && (
          <div className="flex justify-between text-[12px]">
            <span style={{ color: 'var(--text-tertiary)' }}>N/A</span>
            <span style={{ color: 'var(--text-tertiary)' }} className="font-medium">{notApplicable}</span>
          </div>
        )}
        {mappedCoverage > 0 && (
          <div className="flex justify-between text-[12px]">
            <span style={{ color: 'var(--text-tertiary)' }}>Mapped</span>
            <span className="font-medium text-indigo-400">{mappedCoverage}</span>
          </div>
        )}
        {effectivePct !== coveragePct && effectivePct > 0 && (
          <div className="flex justify-between text-[12px] pt-1.5" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <span style={{ color: 'var(--text-tertiary)' }}>Effective</span>
            <span className="font-medium text-indigo-400">{effectivePct}%</span>
          </div>
        )}
      </div>
    </button>
  );
}
