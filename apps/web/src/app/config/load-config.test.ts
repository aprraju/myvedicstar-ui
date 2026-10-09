import { describe, expect, it, vi } from 'vitest';

import { ConfigLoadError, loadRuntimeConfig } from './load-config';

const respond = (body: unknown, status = 200) =>
  vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(body), { status }));

describe('loadRuntimeConfig', () => {
  it('loads and validates /config.json without caching', async () => {
    const fetchImpl = respond({ environment: 'production', apiBaseUrl: 'https://api.example.com' });
    const config = await loadRuntimeConfig(fetchImpl);
    expect(config.apiBaseUrl).toBe('https://api.example.com');
    expect(fetchImpl).toHaveBeenCalledWith('/config.json', expect.objectContaining({ cache: 'no-store' }));
  });

  it('rejects invalid configuration', async () => {
    await expect(
      loadRuntimeConfig(respond({ environment: 'production', apiBaseUrl: 'http://x.example' })),
    ).rejects.toBeInstanceOf(ConfigLoadError);
  });

  it('rejects a missing config file', async () => {
    await expect(loadRuntimeConfig(respond({}, 404))).rejects.toBeInstanceOf(ConfigLoadError);
  });
});
