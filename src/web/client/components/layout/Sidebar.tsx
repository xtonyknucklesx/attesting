import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Library, GitCompareArrows, FileEdit,
  ArrowLeftRight, Download, Shield
} from 'lucide-react';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/catalogs', label: 'Frameworks', icon: Library },
  { to: '/mappings', label: 'Mappings', icon: GitCompareArrows },
  { to: '/implementations', label: 'Implementations', icon: FileEdit },
  { to: '/diff', label: 'Diff Viewer', icon: ArrowLeftRight },
  { to: '/export', label: 'Export', icon: Download },
];

export default function Sidebar() {
  return (
    <aside className="flex flex-col w-60 bg-white border-r border-gray-200 h-screen sticky top-0" role="navigation" aria-label="Main navigation">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-200">
        <Shield className="h-6 w-6 text-indigo-600" aria-hidden="true" />
        <span className="font-semibold text-lg text-gray-900">Crosswalk</span>
      </div>
      <nav className="flex-1 py-3">
        <ul className="space-y-0.5 px-2" role="list">
          {navItems.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`
                }
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="px-5 py-3 border-t border-gray-200 text-xs text-gray-400">
        Crosswalk v0.1.0
      </div>
    </aside>
  );
}
