const BASE_URL = '';

interface RequestOptions {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
  params?: Record<string, string | number | boolean | undefined>;
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {}, params } = options;

  let url = `${BASE_URL}${path}`;
  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.set(key, String(value));
      }
    }
    const queryString = searchParams.toString();
    if (queryString) url += `?${queryString}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  const config: RequestInit = {
    method,
    credentials: 'include',
    signal: controller.signal,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };

  if (body && method !== 'GET') {
    config.body = JSON.stringify(body);
  }

  let response!: Response;
  try {
    response = await fetch(url, config);
  } finally {
    clearTimeout(timeoutId);
  }

  if (response.status === 401) {
    window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    throw new Error('Unauthorized');
  }

  if (response.status === 403) {
    throw new Error('Forbidden: Access denied');
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: response.statusText }));
    const error = new Error(errorData.error || errorData.message || `Request failed: ${response.status}`);
    (error as any).status = response.status;
    (error as any).data = errorData;
    throw error;
  }

  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return undefined as unknown as T;
  }
  return response.json();
}

export const api = {
  get: <T>(path: string, params?: Record<string, any>) =>
    request<T>(path, { params }),

  post: <T>(path: string, body?: any) =>
    request<T>(path, { method: 'POST', body }),

  put: <T>(path: string, body?: any) =>
    request<T>(path, { method: 'PUT', body }),

  patch: <T>(path: string, body?: any) =>
    request<T>(path, { method: 'PATCH', body }),

  delete: <T>(path: string) =>
    request<T>(path, { method: 'DELETE' }),
};

export type { PaginatedResponse };
