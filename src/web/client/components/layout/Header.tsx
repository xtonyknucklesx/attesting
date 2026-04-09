import React, { useEffect, useState } from 'react';
import { getOrg } from '../../lib/api';

interface HeaderProps {
  scope: string;
  onScopeChange: (scope: string) => void;
}

export default function Header({ scope, onScopeChange }: HeaderProps) {
  const [orgName, setOrgName] = useState('');
  const [scopes, setScopes] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    getOrg().then(({ org, scopes: s }) => {
      setOrgName(org?.name ?? 'Crosswalk');
      setScopes(s);
    }).catch(() => {});
  }, []);

  return (
    <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200" role="banner">
      <h1 className="text-lg font-semibold text-gray-900">{orgName}</h1>
      <div className="flex items-center gap-3">
        <label htmlFor="scope-select" className="sr-only">Scope</label>
        <select
          id="scope-select"
          value={scope}
          onChange={(e) => onScopeChange(e.target.value)}
          className="text-sm border border-gray-300 rounded-md px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          aria-label="Select scope"
        >
          <option value="">All scopes</option>
          {scopes.map((s) => (
            <option key={s.id} value={s.name}>{s.name}</option>
          ))}
        </select>
      </div>
    </header>
  );
}
