import React, { useState, Suspense, lazy, createContext, useContext } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import Toasts from './components/layout/Toasts';
import { useToast, type Toast } from './hooks/useToast';

// Lazy-loaded route components
const Dashboard = lazy(() => import('./components/dashboard/Dashboard'));
const CatalogList = lazy(() => import('./components/catalogs/CatalogList'));
const MappingExplorer = lazy(() => import('./components/mappings/MappingExplorer'));
const ImplWorkspace = lazy(() => import('./components/implementations/ImplWorkspace'));
const DiffViewer = lazy(() => import('./components/diff/DiffViewer'));
const ExportCenter = lazy(() => import('./components/exports/ExportCenter'));

// Toast context
interface ToastCtx { add: (msg: string, type?: 'success' | 'error') => void }
const ToastContext = createContext<ToastCtx>({ add: () => {} });
export const useToastContext = () => useContext(ToastContext);

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="h-5 w-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function App() {
  const [scope, setScope] = useState('');
  const { toasts, add, dismiss } = useToast();
  const location = useLocation();

  return (
    <ToastContext.Provider value={{ add }}>
      <div className="flex min-h-screen bg-slate-50">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-indigo-600 focus:text-white focus:px-4 focus:py-2 focus:rounded">
          Skip to content
        </a>
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Header scope={scope} onScopeChange={setScope} />
          <main id="main-content" className="flex-1 overflow-auto" role="main">
            <div key={location.pathname} className="animate-fade-in">
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/" element={<Dashboard scope={scope} />} />
                  <Route path="/catalogs" element={<CatalogList scope={scope} />} />
                  <Route path="/catalogs/:shortName" element={<CatalogList scope={scope} />} />
                  <Route path="/mappings" element={<MappingExplorer />} />
                  <Route path="/implementations" element={<ImplWorkspace scope={scope} />} />
                  <Route path="/diff" element={<DiffViewer />} />
                  <Route path="/export" element={<ExportCenter scope={scope} />} />
                </Routes>
              </Suspense>
            </div>
          </main>
        </div>
        <Toasts toasts={toasts} onDismiss={dismiss} />
      </div>
    </ToastContext.Provider>
  );
}
