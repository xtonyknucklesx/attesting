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
    <aside className="flex flex-col w-56 bg-gray-100 border-r border-gray-200 h-screen sticky top-0" role="navigation" aria-label="Main navigation">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-gray-200">
        <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-indigo-600">
          <Shield className="h-4 w-4 text-white" aria-hidden="true" />
        </div>
        <span className="font-semibold text-[15px] tracking-tight text-gray-900">Crosswalk</span>
      </div>
      <nav className="flex-1 py-2">
        <ul className="space-y-0.5 px-2" role="list">
          {navItems.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-[7px] rounded-lg text-[13px] font-medium transition-colors duration-100 ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700 border-l-2 border-indigo-600 pl-[10px]'
                      : 'text-gray-600 hover:bg-gray-200/60 hover:text-gray-900'
                  }`
                }
              >
                <Icon className="h-[15px] w-[15px] shrink-0" aria-hidden="true" />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="px-5 py-3 border-t border-gray-200 text-[11px] text-gray-400 tracking-wide">
        v0.1.0
      </div>
    </aside>
  );
}
