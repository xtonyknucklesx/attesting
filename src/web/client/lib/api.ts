const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// Org
export const getOrg = () => request<{ org: any; scopes: any[] }>('/org');

// Catalogs
export const getCatalogs = () => request<any[]>('/catalogs');
export const getCatalog = (shortName: string) => request<any>(`/catalogs/${shortName}`);
export const getControls = (shortName: string, params?: Record<string, string>) => {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return request<{ controls: any[]; total: number; limit: number; offset: number }>(
    `/catalogs/${shortName}/controls${qs}`
  );
};

// Coverage
export const getCoverage = (scopeName?: string) =>
  request<any[]>(scopeName ? `/coverage/${encodeURIComponent(scopeName)}` : '/coverage');

// Mappings
export const getMappingSummary = () =>
  request<{ total: number; byTarget: any[]; sourceControls: any[] }>('/mappings/summary');
export const resolveMappings = (catalog: string, controlId: string, depth?: number) =>
  request<{ control: any; direct: any[]; transitive: any[] }>(
    `/mappings/resolve/${catalog}/${controlId}${depth ? `?depth=${depth}` : ''}`
  );
export const listMappings = (params?: Record<string, string>) => {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return request<any[]>(`/mappings/list${qs}`);
};

// Implementations
export const getImplementations = (params?: Record<string, string>) => {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return request<{ implementations: any[]; total: number }>(`/implementations${qs}`);
};
export const getRecentImplementations = () => request<any[]>('/implementations/recent');
export const createImplementation = (data: Record<string, unknown>) =>
  request<{ id: string }>('/implementations', { method: 'POST', body: JSON.stringify(data) });
export const updateImplementation = (id: string, data: Record<string, unknown>) =>
  request<{ id: string }>(`/implementations/${id}`, { method: 'PUT', body: JSON.stringify(data) });

// Diff
export const runDiff = (oldCatalog: string, newCatalog: string) =>
  request<any>('/diff', { method: 'POST', body: JSON.stringify({ old: oldCatalog, new: newCatalog }) });

// Export
export const runExport = (format: string, catalog?: string, scope?: string) =>
  request<any>('/export', { method: 'POST', body: JSON.stringify({ format, catalog, scope }) });

// Watches
export const getWatches = () => request<any[]>('/watches');
