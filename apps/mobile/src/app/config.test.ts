import { readMobileConfig } from './config';

describe('readMobileConfig', () => {
  it('defaults to the local API for local development', () => {
    const result = readMobileConfig({});
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.config.environment).toBe('local');
  });

  it('requires an HTTPS API URL for deployed environments', () => {
    expect(readMobileConfig({ EXPO_PUBLIC_ENVIRONMENT: 'production' }).ok).toBe(false);
    expect(
      readMobileConfig({
        EXPO_PUBLIC_ENVIRONMENT: 'production',
        EXPO_PUBLIC_API_BASE_URL: 'http://api.example.com',
      }).ok,
    ).toBe(false);
    const ok = readMobileConfig({
      EXPO_PUBLIC_ENVIRONMENT: 'production',
      EXPO_PUBLIC_API_BASE_URL: 'https://api.example.com',
      EXPO_PUBLIC_FEATURE_FLAGS: '{"goodTime":true}',
    });
    expect(ok.ok && ok.config.featureFlags.goodTime).toBe(true);
  });

  it('reports malformed feature flags', () => {
    expect(readMobileConfig({ EXPO_PUBLIC_FEATURE_FLAGS: '{oops' })).toEqual({
      ok: false,
      issues: ['featureFlags: EXPO_PUBLIC_FEATURE_FLAGS is not valid JSON'],
    });
  });
});
