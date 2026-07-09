// Typed client for the USSD Gateway backend REST API.

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:4000';

const TOKEN_KEY = 'ussd_admin_token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  window.localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers ?? {}),
    },
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) clearToken();
    throw new ApiError(res.status, body.error ?? res.statusText, body.details);
  }
  return body as T;
}

// ---- Types ----
export type StepAction =
  | 'DIAL_USSD'
  | 'WAIT_RESPONSE'
  | 'ENTER_TEXT'
  | 'ENTER_VARIABLE'
  | 'CLICK_BUTTON'
  | 'READ_RESPONSE'
  | 'FINISH';

export interface FlowStep {
  order: number;
  action: StepAction;
  value: string;
  timeoutMs?: number;
}

export interface Flow {
  flowId: string;
  name: string;
  description: string;
  startingCode: string;
  defaultSimSlot: 1 | 2;
  variables: string[];
  steps: FlowStep[];
  active: boolean;
  bundle?: string | null;
  updatedAt?: string;
}

export interface Company {
  _id: string;
  name: string;
  code: string;
  description: string;
  active: boolean;
}

export interface Package {
  _id: string;
  company: string;
  name: string;
  description: string;
  active: boolean;
}

export interface Bundle {
  _id: string;
  package: string;
  name: string;
  price: number;
  currency: string;
  description: string;
  validity: string;
  active: boolean;
  flow?: { flowId: string; name: string } | null;
}

export type CatalogTree = (Company & {
  packages: (Package & { bundles: Bundle[] })[];
})[];

export interface DeviceSim {
  slot: number;
  carrier: string;
  number: string;
}

export interface Device {
  deviceId: string;
  name: string;
  model: string;
  androidVersion: string;
  status: 'online' | 'offline' | 'disabled';
  disabled: boolean;
  lastHeartbeatAt: string | null;
  sims: DeviceSim[];
  createdAt?: string;
}

export interface TxLog {
  at: string;
  status: string;
  message: string;
}

export interface Transaction {
  transactionId: string;
  deviceId: string;
  flowId: string;
  simSlot: 1 | 2;
  status: string;
  variablesSafe: Record<string, string>;
  response: string;
  message: string;
  attempts: number;
  durationMs: number;
  createdAt: string;
  logs: TxLog[];
}

// ---- Endpoints ----
export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; admin: { id: string; email: string; name: string } }>(
      '/api/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) },
    ),

  listDevices: () => request<{ devices: Device[] }>('/api/devices'),
  disableDevice: (id: string) => request(`/api/devices/${id}/disable`, { method: 'POST' }),
  enableDevice: (id: string) => request(`/api/devices/${id}/enable`, { method: 'POST' }),
  restartDevice: (id: string) => request(`/api/devices/${id}/restart`, { method: 'POST' }),

  listFlows: () => request<{ flows: Flow[] }>('/api/flows'),
  getFlow: (id: string) => request<{ flow: Flow }>(`/api/flows/${id}`),
  createFlow: (flow: Partial<Flow>) =>
    request<{ flow: Flow }>('/api/flows', { method: 'POST', body: JSON.stringify(flow) }),
  updateFlow: (id: string, flow: Partial<Flow>) =>
    request<{ flow: Flow }>(`/api/flows/${id}`, { method: 'PUT', body: JSON.stringify(flow) }),
  deleteFlow: (id: string) => request(`/api/flows/${id}`, { method: 'DELETE' }),

  listTransactions: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request<{ transactions: Transaction[] }>(`/api/transactions${qs ? `?${qs}` : ''}`);
  },
  getTransaction: (id: string) =>
    request<{ transaction: Transaction }>(`/api/transactions/${id}`),

  executeUssd: (payload: {
    deviceId: string;
    flowId: string;
    simCard?: 1 | 2;
    variables: Record<string, string>;
  }) =>
    request<{ transactionId: string; status: string }>('/api/ussd/execute', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // ---- Catalog ----
  getCatalogTree: () => request<{ tree: CatalogTree }>('/api/catalog/tree'),

  listCompanies: () => request<{ companies: Company[] }>('/api/catalog/companies'),
  createCompany: (data: Partial<Company>) =>
    request<{ company: Company }>('/api/catalog/companies', { method: 'POST', body: JSON.stringify(data) }),
  updateCompany: (id: string, data: Partial<Company>) =>
    request<{ company: Company }>(`/api/catalog/companies/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCompany: (id: string) => request(`/api/catalog/companies/${id}`, { method: 'DELETE' }),

  createPackage: (data: Partial<Package>) =>
    request<{ package: Package }>('/api/catalog/packages', { method: 'POST', body: JSON.stringify(data) }),
  updatePackage: (id: string, data: Partial<Package>) =>
    request<{ package: Package }>(`/api/catalog/packages/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePackage: (id: string) => request(`/api/catalog/packages/${id}`, { method: 'DELETE' }),

  listBundles: () => request<{ bundles: Bundle[] }>('/api/catalog/bundles'),
  createBundle: (data: Partial<Bundle>) =>
    request<{ bundle: Bundle }>('/api/catalog/bundles', { method: 'POST', body: JSON.stringify(data) }),
  updateBundle: (id: string, data: Partial<Bundle>) =>
    request<{ bundle: Bundle }>(`/api/catalog/bundles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteBundle: (id: string) => request(`/api/catalog/bundles/${id}`, { method: 'DELETE' }),
};
