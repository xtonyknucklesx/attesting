import React, { useEffect, useState } from 'react';
import { Building2 } from 'lucide-react';
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
    <header className="flex items-center justify-between px-6 py-2.5 bg-white border-b border-gray-200" role="banner">
      <div className="flex items-center gap-2.5">
        <div className="flex items-center justify-center h-7 w-7 rounded-md bg-gray-100">
          <Building2 className="h-3.5 w-3.5 text-gray-500" aria-hidden="true" />
        </div>
        <h1 className="text-[14px] font-semibold text-gray-900 tracking-tight">{orgName}</h1>
      </div>
      <div className="flex items-center gap-3">
        <label htmlFor="scope-select" className="sr-only">Scope</label>
        <select
          id="scope-select"
          value={scope}
          onChange={(e) => onScopeChange(e.target.value)}
          className="text-[12px] border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
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
