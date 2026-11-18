/**
 * HTTP client wrapper around N/https for external integrations.
 *
 * Provides retry logic, timeout handling, structured error reporting,
 * and request/response logging.
 */
import * as https from 'N/https';
import { IntegrationConfig } from '../types';
import { IntegrationError } from './errors';
import { Logger } from './logger';

interface HttpResponse<T = unknown> {
  statusCode: number;
  body: T;
  headers: Record<string, string>;
}

const DEFAULT_RETRY_COUNT = 3;
const RETRYABLE_STATUS_CODES = [408, 429, 500, 502, 503, 504];

/**
 * HTTP GET with retry and structured error handling.
 */
export function get<T = unknown>(
  config: IntegrationConfig,
  path: string,
  queryParams?: Record<string, string>
): HttpResponse<T> {
  const url = buildUrl(config.endpoint, path, queryParams);
  return executeWithRetry<T>(config, () =>
    https.get({
      url,
      headers: buildHeaders(config),
    })
  );
}

/**
 * HTTP POST with retry and structured error handling.
 */
export function post<T = unknown>(
  config: IntegrationConfig,
  path: string,
  body: unknown
): HttpResponse<T> {
  const url = buildUrl(config.endpoint, path);
  return executeWithRetry<T>(config, () =>
    https.post({
      url,
      headers: buildHeaders(config),
      body: JSON.stringify(body),
    })
  );
}

/**
 * HTTP PUT with retry and structured error handling.
 */
export function put<T = unknown>(
  config: IntegrationConfig,
  path: string,
  body: unknown
): HttpResponse<T> {
  const url = buildUrl(config.endpoint, path);
  return executeWithRetry<T>(config, () =>
    https.put({
      url,
      headers: buildHeaders(config),
      body: JSON.stringify(body),
    })
  );
}

// ─── Internal ────────────────────────────────────────────────────

function buildUrl(
  base: string,
  path: string,
  params?: Record<string, string>
): string {
  let url = `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
  if (params) {
    const qs = Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    url += `?${qs}`;
  }
  return url;
}

function buildHeaders(config: IntegrationConfig): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...config.headers,
  };
  if (config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`;
  }
  return headers;
}

function executeWithRetry<T>(
  config: IntegrationConfig,
  fn: () => https.ClientResponse
): HttpResponse<T> {
  const maxAttempts = config.retryCount ?? DEFAULT_RETRY_COUNT;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = fn();
      const statusCode = response.code;

      if (statusCode >= 200 && statusCode < 300) {
        return {
          statusCode,
          body: JSON.parse(response.body) as T,
          headers: response.headers,
        };
      }

      if (RETRYABLE_STATUS_CODES.includes(statusCode) && attempt < maxAttempts) {
        Logger.audit('HTTP retry', {
          attempt: String(attempt),
          statusCode: String(statusCode),
        } as unknown as string);
        continue;
      }

      throw new IntegrationError(
        `HTTP ${statusCode} response`,
        statusCode,
        response.body
      );
    } catch (e) {
      lastError = e as Error;
      if (attempt >= maxAttempts) break;
      Logger.audit('HTTP request error, retrying', {
        attempt: String(attempt),
        error: (e as Error).message,
      } as unknown as string);
    }
  }

  throw lastError ?? new IntegrationError('Unknown HTTP error');
}
