import React, { useEffect, useRef, useState } from 'react';
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
  const ringRef = useRef<SVGCircleElement>(null);
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    // Trigger ring animation on mount
    const timer = setTimeout(() => setAnimated(true), 100 + index * 60);
    return () => clearTimeout(timer);
  }, [index]);

  const ringColor = coveragePct >= 80 ? '#22c55e' : coveragePct >= 40 ? '#f59e0b' : '#f43f5e';
  const barPct = totalControls > 0 ? (covered / totalControls) * 100 : 0;

  return (
    <button
      onClick={() => navigate(`/catalogs/${shortName}`)}
      className="bg-white border border-gray-200 rounded-xl p-5 card-hover text-left w-full focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 relative overflow-hidden"
      style={{ borderLeftColor: accentColor, borderLeftWidth: 3 }}
      aria-label={`${name}: ${coveragePct}% coverage, ${covered} of ${totalControls} controls covered`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="min-w-0 pr-3">
          <h3 className="text-[13px] font-semibold text-gray-900 leading-tight truncate">{name}</h3>
          <p className="text-[11px] text-gray-400 mt-0.5 font-mono">{shortName}</p>
        </div>
        <div className="relative shrink-0" aria-hidden="true">
          <svg width="74" height="74" viewBox="0 0 74 74">
            <circle cx="37" cy="37" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="5" />
            <circle
              ref={ringRef}
              cx="37" cy="37" r={radius} fill="none"
              stroke={ringColor}
              strokeWidth="5" strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={animated ? target : circumference}
              transform="rotate(-90 37 37)"
              style={{
                transition: 'stroke-dashoffset 600ms ease-out',
                ['--ring-circumference' as string]: circumference,
                ['--ring-target' as string]: target,
              }}
            />
            <text x="37" y="37" textAnchor="middle" dominantBaseline="central"
              fontSize="13" fontWeight="600" fill="#111827" fontFamily="Inter, sans-serif">
              {coveragePct}%
            </text>
          </svg>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-gray-100 rounded-full mb-3 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: animated ? `${barPct}%` : '0%', backgroundColor: ringColor }}
        />
      </div>

      <div className="space-y-1" role="group" aria-label="Coverage details">
        <div className="flex justify-between text-[12px]">
          <span className="text-gray-500">Implemented</span>
          <span className="font-medium text-gray-900">{implemented}<span className="text-gray-400">/{totalControls}</span></span>
        </div>
        {notApplicable > 0 && (
          <div className="flex justify-between text-[12px]">
            <span className="text-gray-500">N/A</span>
            <span className="font-medium text-gray-500">{notApplicable}</span>
          </div>
        )}
        {mappedCoverage > 0 && (
          <div className="flex justify-between text-[12px]">
            <span className="text-gray-500">Mapped</span>
            <span className="font-medium text-indigo-600">{mappedCoverage}</span>
          </div>
        )}
        {effectivePct !== coveragePct && effectivePct > 0 && (
          <div className="flex justify-between text-[12px] pt-1 border-t border-gray-100">
            <span className="text-gray-500">Effective</span>
            <span className="font-medium text-indigo-600">{effectivePct}%</span>
          </div>
        )}
      </div>
    </button>
  );
}
