'use client';

/**
 * The admin panel's HTTP client. Every mutating call carries the
 * double-submit CSRF token, and a 401 triggers exactly one silent refresh
 * before the caller sees a failure.
 */

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]!) : null;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let refreshing: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  refreshing ??= fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin' })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

export async function api<T = unknown>(
  path: string,
  init: RequestInit & { json?: unknown; retry?: boolean } = {},
): Promise<T> {
  const { json, retry = true, ...rest } = init;
  const method = (rest.method ?? (json ? 'POST' : 'GET')).toUpperCase();

  const headers = new Headers(rest.headers);
  if (json !== undefined && !(json instanceof FormData)) headers.set('content-type', 'application/json');
  if (method !== 'GET' && method !== 'HEAD') {
    const csrf = readCookie('he_csrf');
    if (csrf) headers.set('x-csrf-token', csrf);
  }

  const response = await fetch(path, {
    ...rest,
    method,
    headers,
    credentials: 'same-origin',
    body:
      json instanceof FormData
        ? json
        : json !== undefined
          ? JSON.stringify(json)
          : rest.body,
  });

  if (response.status === 401 && retry) {
    if (await refreshSession()) return api<T>(path, { ...init, retry: false });
    window.location.href = `/admin/login?next=${encodeURIComponent(window.location.pathname)}`;
    throw new ApiError('Session expired.', 401);
  }

  if (response.status === 204) return undefined as T;

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      (payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
        ? payload.error
        : null) ?? `Request failed (${response.status}).`;
    throw new ApiError(message, response.status, (payload as { details?: unknown } | null)?.details);
  }

  return payload as T;
}

export const fetcher = <T>(path: string) => api<T>(path);
