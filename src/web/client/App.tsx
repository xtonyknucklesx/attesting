import React, { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import Dashboard from './components/dashboard/Dashboard';
import CatalogList from './components/catalogs/CatalogList';
import MappingExplorer from './components/mappings/MappingExplorer';
import ImplWorkspace from './components/implementations/ImplWorkspace';
import DiffViewer from './components/diff/DiffViewer';
import ExportCenter from './components/exports/ExportCenter';

export default function App() {
  const [scope, setScope] = useState('');

  return (
    <div className="flex min-h-screen">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-indigo-600 focus:text-white focus:px-4 focus:py-2 focus:rounded">
        Skip to content
      </a>
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header scope={scope} onScopeChange={setScope} />
        <main id="main-content" className="flex-1 overflow-auto" role="main">
          <Routes>
            <Route path="/" element={<Dashboard scope={scope} />} />
            <Route path="/catalogs" element={<CatalogList scope={scope} />} />
            <Route path="/catalogs/:shortName" element={<CatalogList scope={scope} />} />
            <Route path="/mappings" element={<MappingExplorer />} />
            <Route path="/implementations" element={<ImplWorkspace scope={scope} />} />
            <Route path="/diff" element={<DiffViewer />} />
            <Route path="/export" element={<ExportCenter scope={scope} />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
