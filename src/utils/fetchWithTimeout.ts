/**
 * Network fetch with an enforced timeout.
 *
 * React Native's `fetch` has no built-in request timeout: on a marginal
 * connection (one bar of signal at a trailhead) a request can open a TCP
 * connection and then stall indefinitely, leaving the UI in a permanent
 * loading state. This helper lets call sites enforce a bounded wait so stalled
 * requests fail fast and callers can fall back to cached data.
 *
 * See https://github.com/Toastbyte-Studios/TOAST/issues/343
 */

/** Default timeout applied to network requests, in milliseconds. */
export const DEFAULT_FETCH_TIMEOUT_MS = 15000;

/**
 * Error thrown when a request exceeds its timeout. Callers can use
 * `instanceof FetchTimeoutError` to distinguish a timeout from other
 * network failures (e.g. to show a "slow connection" message vs a
 * generic error).
 */
export class FetchTimeoutError extends Error {
  constructor(url: string, timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms: ${url}`);
    this.name = 'FetchTimeoutError';
  }
}

/**
 * Timeout-enabled wrapper around `fetch` for URL string requests that aborts
 * when no response has been received within `timeoutMs`.
 *
 * - On timeout, rejects with {@link FetchTimeoutError}.
 * - A caller-provided `options.signal` is respected: if the caller aborts,
 *   the request is aborted and the original abort error is rethrown
 *   (not converted to a `FetchTimeoutError`).
 * - All other errors (network failures, etc.) are rethrown unchanged.
 * - The internal timer is always cleared, on success and failure alike.
 *
 * @param url - The URL to fetch.
 * @param options - Standard `fetch` options. `signal` is supported.
 * @param timeoutMs - Timeout in milliseconds (default {@link DEFAULT_FETCH_TIMEOUT_MS}).
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  // Chain a caller-provided signal onto our controller so either source
  // (caller abort or timeout) cancels the underlying request.
  const callerSignal = options.signal;
  const onCallerAbort = () => controller.abort();
  if (callerSignal) {
    if (callerSignal.aborted) {
      controller.abort();
    } else {
      callerSignal.addEventListener('abort', onCallerAbort);
    }
  }

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    // `fetch` rejects with an AbortError whenever our controller aborts.
    // If the abort came from the timeout (not the caller), surface a
    // descriptive FetchTimeoutError instead of a generic AbortError.
    if (controller.signal.aborted && !callerSignal?.aborted) {
      throw new FetchTimeoutError(url, timeoutMs);
    }
    throw error;
  } finally {
    clearTimeout(timer);
    callerSignal?.removeEventListener('abort', onCallerAbort);
  }
}
