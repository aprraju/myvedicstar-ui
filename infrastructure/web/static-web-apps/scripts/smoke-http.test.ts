import { describe, expect, it, vi } from 'vitest';

import { fetchForSmoke } from './smoke-http';

const url = 'https://example.test/';
const wait = async () => undefined;

describe('smoke HTTP requests', () => {
  it('recovers from transient network errors without changing the authentication response', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValue(new Response(null, { status: 401 }));
    expect((await fetchForSmoke(url, {}, { fetchImpl, wait })).status).toBe(401);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it.each([429, 502, 503])('retries transient HTTP %s and releases the response body', async (status) => {
    const response = new Response('temporary failure', { status });
    const cancel = vi.spyOn(response.body!, 'cancel');
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(response).mockResolvedValue(new Response());
    expect((await fetchForSmoke(url, {}, { fetchImpl, wait })).status).toBe(200);
    expect(cancel).toHaveBeenCalledOnce();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it.each([200, 401, 403, 404])('does not retry HTTP %s', async (status) => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status }));
    expect((await fetchForSmoke(url, {}, { fetchImpl, wait })).status).toBe(status);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('bounds repeated network failures', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('fetch failed'));
    await expect(fetchForSmoke(url, {}, { fetchImpl, wait })).rejects.toThrow('fetch failed');
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('times out hung requests and stops after the retry limit', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init!.signal!.addEventListener('abort', () => reject(init!.signal!.reason), { once: true });
        }),
    );
    await expect(fetchForSmoke(url, {}, { fetchImpl, wait, timeoutMs: 10 })).rejects.toThrow();
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('preserves caller cancellation without retrying', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(controller.signal.reason);
    await expect(fetchForSmoke(url, { signal: controller.signal }, { fetchImpl, wait })).rejects.toThrow();
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});
