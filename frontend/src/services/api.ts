const API_BASE = '/api/v1';

export async function apiRequest(endpoint: string, options: { method?: string; token?: string; body?: any; isFormData?: boolean } = {}) {
  const headers: Record<string, string> = {};

  if (!options.isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: options.method || 'GET',
    headers,
    body: options.isFormData ? options.body : (options.body ? JSON.stringify(options.body) : undefined),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || data.message || `Request failed with status ${res.status}`);
  }

  return data;
}
