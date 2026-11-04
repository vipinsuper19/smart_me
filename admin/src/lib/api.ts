import type { AdminAuthResponse, AdminSession } from './types';

const DEFAULT_API_URL = 'http://localhost:3001/api/v1';
const SESSION_STORAGE_KEY = 'smartme.admin.session';
const SESSION_EVENT = 'smartme:admin-session';

export function getApiBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL).replace(/\/+$/, '');
}

interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  body?: BodyInit | null;
  json?: unknown;
  skipAuth?: boolean;
  retryOnUnauthorized?: boolean;
}

/* -------------------------------------------------------------------------- */
/* Admin session storage                                                      */
/* -------------------------------------------------------------------------- */

export function readAdminSession(): AdminSession | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as AdminSession;
    if (!parsed?.admin?.id || !parsed?.tokens?.accessToken) {
      return null;
    }
    return parsed;
  } catch {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
}

export function writeAdminSession(session: AdminSession): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  window.dispatchEvent(new CustomEvent<AdminSession>(SESSION_EVENT, { detail: session }));
}

export function clearAdminSession(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(SESSION_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent<null>(SESSION_EVENT, { detail: null }));
}

export function subscribeAdminSession(
  listener: (session: AdminSession | null) => void,
): () => void {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const handleCustomEvent = (event: Event) => {
    listener((event as CustomEvent<AdminSession | null>).detail);
  };
  const handleStorage = (event: StorageEvent) => {
    if (event.key === SESSION_STORAGE_KEY) {
      listener(readAdminSession());
    }
  };

  window.addEventListener(SESSION_EVENT, handleCustomEvent);
  window.addEventListener('storage', handleStorage);
  return () => {
    window.removeEventListener(SESSION_EVENT, handleCustomEvent);
    window.removeEventListener('storage', handleStorage);
  };
}

/* -------------------------------------------------------------------------- */
/* Refresh handling                                                           */
/* -------------------------------------------------------------------------- */

let refreshInFlight: Promise<AdminSession | null> | null = null;

async function refreshAdminSession(): Promise<AdminSession | null> {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    const current = readAdminSession();
    if (!current?.tokens.refreshToken) {
      return null;
    }

    try {
      const response = await fetch(`${getApiBaseUrl()}/admin/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: current.tokens.refreshToken }),
      });

      if (!response.ok) {
        return null;
      }

      const payload = (await response.json()) as AdminAuthResponse;
      const next: AdminSession = { admin: payload.admin, tokens: payload.tokens };
      writeAdminSession(next);
      return next;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

/* -------------------------------------------------------------------------- */
/* Fetch wrapper                                                              */
/* -------------------------------------------------------------------------- */

function parseBody(body: ApiErrorBody | unknown): {
  code: string;
  message: string;
  details?: unknown;
} {
  if (body && typeof body === 'object' && 'error' in body) {
    const error = (body as ApiErrorBody).error;
    if (error) {
      return {
        code: error.code ?? 'REQUEST_FAILED',
        message: error.message ?? 'The request failed.',
        details: error.details,
      };
    }
  }

  return { code: 'REQUEST_FAILED', message: 'The request failed.' };
}

async function readResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
}

export async function apiFetch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const {
    json,
    skipAuth = false,
    retryOnUnauthorized = true,
    headers: initialHeaders,
    ...init
  } = options;

  const send = async (): Promise<Response> => {
    const headers = new Headers(initialHeaders);
    if (json !== undefined && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const session = skipAuth ? null : readAdminSession();
    if (session && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${session.tokens.accessToken}`);
    }

    return fetch(`${getApiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`, {
      ...init,
      headers,
      body: json !== undefined ? JSON.stringify(json) : init.body,
    });
  };

  let response = await send();

  if (response.status === 401 && !skipAuth && retryOnUnauthorized) {
    const refreshed = await refreshAdminSession();
    if (!refreshed) {
      clearAdminSession();
      throw new ApiError(
        401,
        'SESSION_EXPIRED',
        'Your admin session has expired. Please sign in again.',
      );
    }
    response = await send();
  }

  if (!response.ok) {
    let parsed: unknown = null;
    try {
      const text = await response.text();
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }
    const error = parseBody(parsed);
    throw new ApiError(response.status, error.code, error.message, error.details);
  }

  return readResponse<T>(response);
}

export function buildQuery(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Something went wrong. Please try again.';
}
