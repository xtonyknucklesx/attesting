import React from 'react';
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
}

export default function CoverageCard({
  shortName, name, totalControls, implemented, notApplicable,
  mappedCoverage, coveragePct, effectivePct
}: CoverageCardProps) {
  const navigate = useNavigate();
  const covered = implemented + notApplicable;
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (coveragePct / 100) * circumference;

  return (
    <button
      onClick={() => navigate(`/catalogs/${shortName}`)}
      className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-sm transition-shadow text-left w-full focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
      aria-label={`${name}: ${coveragePct}% coverage, ${covered} of ${totalControls} controls covered`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 truncate">{name}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{shortName}</p>
        </div>
        <div className="relative shrink-0 ml-3" aria-hidden="true">
          <svg width="84" height="84" viewBox="0 0 84 84" role="img" aria-label={`${coveragePct}% complete`}>
            <circle cx="42" cy="42" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="6" />
            <circle
              cx="42" cy="42" r={radius} fill="none"
              stroke={coveragePct >= 80 ? '#22c55e' : coveragePct >= 40 ? '#f59e0b' : '#ef4444'}
              strokeWidth="6" strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              transform="rotate(-90 42 42)"
              className="transition-all duration-500"
              style={{ transitionProperty: 'stroke-dashoffset' }}
            />
            <text x="42" y="42" textAnchor="middle" dominantBaseline="central"
              className="text-sm font-semibold" fill="#111827" fontSize="14">
              {coveragePct}%
            </text>
          </svg>
        </div>
      </div>
      <div className="space-y-1.5" role="group" aria-label="Coverage details">
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">Implemented</span>
          <span className="font-medium text-gray-900" aria-label={`${implemented} of ${totalControls}`}>
            {implemented}/{totalControls}
          </span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">N/A</span>
          <span className="font-medium text-gray-700">{notApplicable}</span>
        </div>
        {mappedCoverage > 0 && (
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Mapped</span>
            <span className="font-medium text-blue-600">{mappedCoverage}</span>
          </div>
        )}
        {effectivePct !== coveragePct && effectivePct > 0 && (
          <div className="flex justify-between text-xs pt-1 border-t border-gray-100">
            <span className="text-gray-500">Effective</span>
            <span className="font-medium text-indigo-600">{effectivePct}%</span>
          </div>
        )}
      </div>
    </button>
  );
}
