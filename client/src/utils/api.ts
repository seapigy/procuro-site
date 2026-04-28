/**
 * API Utility Functions
 * Centralized API URL management using environment variables
 */

/**
 * Get the base API URL from environment variable
 * Falls back to empty string for relative paths (works with Vite proxy in dev)
 */
export function getApiUrl(): string {
  return import.meta.env.VITE_API_URL || '';
}

/**
 * Build a full API endpoint URL
 * @param endpoint - API endpoint path (e.g., '/api/items')
 * @returns Full URL with base API URL
 */
export function apiUrl(endpoint: string): string {
  const baseUrl = getApiUrl();
  // Remove leading slash from endpoint if present to avoid double slashes
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  
  if (baseUrl) {
    // Remove trailing slash from baseUrl if present
    const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    return `${cleanBaseUrl}${cleanEndpoint}`;
  }
  
  // Return relative path (works with Vite proxy in development)
  return cleanEndpoint;
}

const TEST_USER_STORAGE_KEY = 'testUserEmail';

/** Get headers to send with API requests (e.g. X-Test-User-Email when testing multi-tenant). */
export function getApiHeaders(): Record<string, string> {
  try {
    const email = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(TEST_USER_STORAGE_KEY) : null;
    if (email) return { 'X-Test-User-Email': email };
  } catch {
    // ignore
  }
  return {};
}

/** Set the test user email for "View as" (TEST_MODE). Clears when passed null/empty. */
export function setTestUserEmail(email: string | null): void {
  try {
    if (email) sessionStorage.setItem(TEST_USER_STORAGE_KEY, email);
    else sessionStorage.removeItem(TEST_USER_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Fetch with API base URL and test headers. Use this for all /api calls so "View as" works in TEST_MODE. */
export function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  const testHeaders = getApiHeaders();
  Object.entries(testHeaders).forEach(([k, v]) => headers.set(k, v));
  return fetch(input, { ...init, headers, credentials: 'include' });
}

/**
 * Same as apiFetch but aborts after `timeoutMs` to avoid infinite spinners when the API is down
 * or embedded browsers fail to complete the request (e.g. Cursor Simple Browser + Vite proxy).
 */
export function apiFetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const merged: RequestInit = { ...init, signal: controller.signal };
  return apiFetch(input, merged).finally(() => clearTimeout(timer));
}

