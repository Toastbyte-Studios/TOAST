/**
 * @format
 */

import {
  DEFAULT_FETCH_TIMEOUT_MS,
  FetchTimeoutError,
  fetchWithTimeout,
} from '../src/utils/fetchWithTimeout';

/** Creates an AbortError-shaped error matching what fetch rejects with. */
function abortError(): Error {
  const err = new Error('Aborted');
  err.name = 'AbortError';
  return err;
}

/**
 * Mock fetch that never resolves on its own, but rejects with an AbortError
 * when the provided signal aborts — mirroring real fetch behavior for a
 * stalled connection.
 */
function stalledFetch(): jest.Mock {
  return jest.fn((_url: string, init?: RequestInit) => {
    // Real fetch rejects synchronously when handed an already-aborted signal.
    if (init?.signal?.aborted) {
      return Promise.reject(abortError());
    }
    return new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(abortError()));
    });
  });
}

describe('fetchWithTimeout', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    global.fetch = originalFetch;
  });

  it('resolves with the response when fetch completes before the timeout', async () => {
    const fakeResponse = { ok: true, status: 200 } as Response;
    global.fetch = jest.fn().mockResolvedValue(fakeResponse);

    const result = await fetchWithTimeout('https://example.com/data');

    expect(result).toBe(fakeResponse);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.com/data',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    // The timeout timer must be cleared after settlement.
    expect(jest.getTimerCount()).toBe(0);
  });

  it('rejects with FetchTimeoutError when the request stalls past the timeout', async () => {
    global.fetch = stalledFetch();

    const promise = fetchWithTimeout('https://example.com/slow', {}, 5000);
    // Start the assertion and advance time together so the rejection
    // handler is attached before the timer fires.
    await Promise.all([
      expect(promise).rejects.toThrow(FetchTimeoutError),
      jest.advanceTimersByTimeAsync(5000),
    ]);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('uses DEFAULT_FETCH_TIMEOUT_MS when no timeout is provided', async () => {
    global.fetch = stalledFetch();

    const promise = fetchWithTimeout('https://example.com/slow');

    // One millisecond before the default timeout: still pending.
    await jest.advanceTimersByTimeAsync(DEFAULT_FETCH_TIMEOUT_MS - 1);
    expect(jest.getTimerCount()).toBe(1);

    await Promise.all([
      expect(promise).rejects.toThrow(
        `Request timed out after ${DEFAULT_FETCH_TIMEOUT_MS}ms`,
      ),
      jest.advanceTimersByTimeAsync(1),
    ]);
  });

  it('rethrows the original abort error when the caller aborts (not a timeout)', async () => {
    global.fetch = stalledFetch();
    const controller = new AbortController();

    const promise = fetchWithTimeout(
      'https://example.com/slow',
      { signal: controller.signal },
      5000,
    );
    controller.abort();

    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
    // A caller abort must not be reported as a timeout.
    await expect(promise).rejects.not.toBeInstanceOf(FetchTimeoutError);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('aborts immediately when given an already-aborted signal', async () => {
    global.fetch = stalledFetch();
    const controller = new AbortController();
    controller.abort();

    await expect(
      fetchWithTimeout('https://example.com/slow', {
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(jest.getTimerCount()).toBe(0);
  });

  it('passes through non-abort network errors unchanged', async () => {
    const networkError = new TypeError('Network request failed');
    global.fetch = jest.fn().mockRejectedValue(networkError);

    await expect(fetchWithTimeout('https://example.com/down')).rejects.toBe(
      networkError,
    );
    expect(jest.getTimerCount()).toBe(0);
  });
});
