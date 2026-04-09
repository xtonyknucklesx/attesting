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

// Assets
export const getAssets = (params?: Record<string, string>) => {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return request<any[]>(`/assets${qs}`);
};
export const getAsset = (id: string) => request<any>(`/assets/${id}`);
export const createAsset = (data: Record<string, unknown>) =>
  request<{ id: string }>('/assets', { method: 'POST', body: JSON.stringify(data) });
export const updateAsset = (id: string, data: Record<string, unknown>) =>
  request<any>(`/assets/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteAsset = (id: string) =>
  request<any>(`/assets/${id}`, { method: 'DELETE' });

// Intel
export const getThreats = (params?: Record<string, string>) => {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return request<any[]>(`/intel/threats${qs}`);
};
export const getThreat = (id: string) => request<any>(`/intel/threats/${id}`);
export const getManualIntel = () => request<any[]>('/intel/manual');
export const submitManualIntel = (data: Record<string, unknown>) =>
  request<any>('/intel/manual', { method: 'POST', body: JSON.stringify(data) });
export const getShadowImpact = (id: string) => request<any>(`/intel/manual/${id}/shadow`);
export const promoteIntel = (id: string, data?: Record<string, unknown>) =>
  request<any>(`/intel/manual/${id}/promote`, { method: 'POST', body: JSON.stringify(data ?? {}) });

// Drift
export const getDriftAlerts = (params?: Record<string, string>) => {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return request<any[]>(`/drift/alerts${qs}`);
};
export const getDriftAlert = (id: string) => request<any>(`/drift/alerts/${id}`);
export const getDriftDashboard = () => request<any>('/drift/dashboard');
export const submitDisposition = (data: Record<string, unknown>) =>
  request<any>('/drift/dispositions', { method: 'POST', body: JSON.stringify(data) });
export const commitDisposition = (data: Record<string, unknown>) =>
  request<any>('/drift/dispositions/commit', { method: 'POST', body: JSON.stringify(data) });
export const getPendingDispositions = () => request<any[]>('/drift/dispositions/pending');

// Connectors
export const getConnectors = () => request<any[]>('/connectors');
export const createConnector = (data: Record<string, unknown>) =>
  request<{ id: string }>('/connectors', { method: 'POST', body: JSON.stringify(data) });
export const triggerSync = (id: string, full = false) =>
  request<any>(`/connectors/${id}/sync`, { method: 'POST', body: JSON.stringify({ full }) });
export const getConnectorLogs = (id: string, limit = 20) =>
  request<any[]>(`/connectors/${id}/logs?limit=${limit}`);
export const runHealthcheck = (id: string) =>
  request<any>(`/connectors/${id}/healthcheck`, { method: 'POST' });
export const getAdapters = () => request<string[]>('/connectors/adapters');

// Owners (shared)
export const getOwners = () => request<any[]>('/owners');
