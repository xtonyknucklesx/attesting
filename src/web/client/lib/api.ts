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

// Control params
export const getControlParams = (catalog: string, controlId: string) =>
  request<any[]>(`/catalogs/${catalog}/controls/${controlId}/params`);
export const setControlParam = (catalog: string, controlId: string, paramId: string, value: string, setBy?: string) =>
  request<{ updated: boolean }>(`/catalogs/${catalog}/controls/${controlId}/params/${paramId}`, {
    method: 'PUT', body: JSON.stringify({ value, set_by: setBy }),
  });

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

// Governance
export const getPolicies = () => request<any[]>('/governance/policies');
export const createPolicy = (data: Record<string, unknown>) =>
  request<{ id: string }>('/governance/policies', { method: 'POST', body: JSON.stringify(data) });
export const getPolicy = (id: string) => request<any>(`/governance/policies/${id}`);
export const updatePolicy = (id: string, data: Record<string, unknown>) =>
  request<any>(`/governance/policies/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deletePolicy = (id: string) =>
  request<any>(`/governance/policies/${id}`, { method: 'DELETE' });
export const linkPolicyControls = (id: string, controlIds: string[]) =>
  request<any>(`/governance/policies/${id}/controls`, { method: 'POST', body: JSON.stringify({ controlIds }) });
export const getCommittees = () => request<any[]>('/governance/committees');
export const createCommittee = (data: Record<string, unknown>) =>
  request<{ id: string }>('/governance/committees', { method: 'POST', body: JSON.stringify(data) });
export const getCommitteeMeetings = (id: string) => request<any[]>(`/governance/committees/${id}/meetings`);
export const createMeeting = (id: string, data: Record<string, unknown>) =>
  request<{ id: string }>(`/governance/committees/${id}/meetings`, { method: 'POST', body: JSON.stringify(data) });
export const getRoles = () => request<any[]>('/governance/roles');
export const createRole = (data: Record<string, unknown>) =>
  request<{ id: string }>('/governance/roles', { method: 'POST', body: JSON.stringify(data) });
export const updateRole = (id: string, data: Record<string, unknown>) =>
  request<any>(`/governance/roles/${id}`, { method: 'PUT', body: JSON.stringify(data) });

// Risk
export const getRisks = (params?: Record<string, string>) => {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return request<any[]>(`/risk/register${qs}`);
};
export const createRisk = (data: Record<string, unknown>) =>
  request<{ id: string; risk_id: string }>('/risk/register', { method: 'POST', body: JSON.stringify(data) });
export const getRisk = (id: string) => request<any>(`/risk/register/${id}`);
export const updateRisk = (id: string, data: Record<string, unknown>) =>
  request<any>(`/risk/register/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteRisk = (id: string) =>
  request<any>(`/risk/register/${id}`, { method: 'DELETE' });
export const linkRiskControls = (id: string, controlIds: string[]) =>
  request<any>(`/risk/register/${id}/controls`, { method: 'POST', body: JSON.stringify({ controlIds }) });
export const getRiskMatrix = () => request<any>('/risk/matrix');
export const getRiskExceptions = () => request<any[]>('/risk/exceptions');
export const createRiskException = (data: Record<string, unknown>) =>
  request<{ id: string }>('/risk/exceptions', { method: 'POST', body: JSON.stringify(data) });
export const getRiskDashboard = () => request<any>('/risk/dashboard');
