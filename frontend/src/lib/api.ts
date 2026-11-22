// API Client
// Centralized fetch wrapper for backend communication

import { apiUrl } from './config';
import { notifySessionExpired } from './session-events';

class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ApiErrorResponse {
  error: string;
  message: string;
  details?: unknown;
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${apiUrl}${endpoint}`;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // For cookie-based sessions
  });

  const data: unknown = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorData = data as ApiErrorResponse;
    if (response.status === 401) {
      // Authentication is gone (expired or revoked session). Give the auth
      // context a chance to redirect the user to /login (spec F-09).
      notifySessionExpired();
    }
    throw new ApiError(
      response.status,
      errorData.error ?? 'UNKNOWN_ERROR',
      errorData.message ?? 'An error occurred',
      errorData.details
    );
  }

  return data as T;
}

export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint, { method: 'GET' }),
  post: <T>(endpoint: string, body: unknown) =>
    request<T>(endpoint, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(endpoint: string, body: unknown) =>
    request<T>(endpoint, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(endpoint: string, body: unknown) =>
    request<T>(endpoint, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(endpoint: string) =>
    request<T>(endpoint, { method: 'DELETE' }),
};

export { ApiError };

// Error code returned when the session user must change their password before
// any other authenticated endpoint can be used (auth middleware).
export const PASSWORD_CHANGE_REQUIRED = 'PASSWORD_CHANGE_REQUIRED';

export function isPasswordChangeRequired(err: unknown): boolean {
  return err instanceof ApiError && err.code === PASSWORD_CHANGE_REQUIRED;
}

// Health check
export async function checkHealth(): Promise<{
  status: string;
  timestamp: string;
  environment: string;
}> {
  return api.get('/health');
}