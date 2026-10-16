import { createHash } from 'node:crypto';

import type { Page, Route } from '@playwright/test';

import { expect, FIXED_NOW, test, withSavedLocation } from './fixtures';

/**
 * The complete OAuth 2.0 authorization code + PKCE flow against a simulated Microsoft Entra External ID tenant, with
 * the real identity code (oidc-client-ts) running in the real app under the production CSP. Each protocol step is
 * asserted on the wire: authorize request, PKCE verifier/challenge, code exchange, bearer tokens on API calls,
 * refresh-token renewal and end-session logout. No real credentials or tenants are involved.
 */

/** Must match E2E_AUTHORITY_ORIGIN in vite.config.ts (allowed by the preview CSP). */
const E2E_AUTHORITY = 'https://myvedicstar-e2e.ciamlogin.com';
const TENANT = 'e2e-tenant';
const ISSUER = `${E2E_AUTHORITY}/${TENANT}/v2.0`;
const CLIENT_ID = 'e2e-web-client';
const API_SCOPE = 'api://e2e-api/access_as_user';

const base64url = (input: Buffer | string) => Buffer.from(input).toString('base64url');

/** Unsigned test ID token (the browser never validates signatures; the API validates access tokens). */
function idToken(nonce?: string, loginHint?: string) {
  const now = Math.floor(FIXED_NOW.getTime() / 1000);
  const claims = {
    iss: ISSUER,
    aud: CLIENT_ID,
    sub: 'user-1',
    name: 'Asha',
    iat: now,
    exp: now + 3600,
    nonce,
    // Entra's optional `login_hint` claim (configured on the app registration).
    ...(loginHint ? { login_hint: loginHint } : {}),
  };
  return `${base64url(JSON.stringify({ alg: 'none', typ: 'JWT' }))}.${base64url(JSON.stringify(claims))}.sig`;
}

interface EntraRecord {
  authorize: URLSearchParams[];
  token: URLSearchParams[];
  endSession: URLSearchParams[];
}

/**
 * Simulated tenant: discovery, /authorize (redirects back with a code), /token (authorization_code and refresh_token
 * grants, verifying PKCE) and /logout. `accessTokenLifetime` lets a test force refresh-token renewal.
 */
async function simulateEntra(
  page: Page,
  baseURL: string,
  { accessTokenLifetime = 3600, loginHint }: { accessTokenLifetime?: number; loginHint?: string } = {},
) {
  const record: EntraRecord = { authorize: [], token: [], endSession: [] };
  let issued = 0;
  const cors = { 'Access-Control-Allow-Origin': baseURL };

  await page.route('**/config.json', async (route) => {
    const response = await route.fetch();
    const config = (await response.json()) as Record<string, unknown>;
    await route.fulfill({
      response,
      json: {
        ...config,
        environment: 'test',
        auth: {
          mode: 'entra-external-id',
          authority: `${E2E_AUTHORITY}/`,
          tenantId: TENANT,
          clientId: CLIENT_ID,
          apiScopes: [API_SCOPE],
          redirectUri: `${baseURL}/auth/callback`,
          postLogoutRedirectUri: `${baseURL}/`,
        },
      },
    });
  });

  await page.route(`${E2E_AUTHORITY}/**`, async (route: Route) => {
    const url = new URL(route.request().url());
    if (url.pathname === `/${TENANT}/v2.0/.well-known/openid-configuration`) {
      return route.fulfill({
        headers: cors,
        json: {
          issuer: ISSUER,
          authorization_endpoint: `${E2E_AUTHORITY}/${TENANT}/oauth2/v2.0/authorize`,
          token_endpoint: `${E2E_AUTHORITY}/${TENANT}/oauth2/v2.0/token`,
          end_session_endpoint: `${E2E_AUTHORITY}/${TENANT}/oauth2/v2.0/logout`,
          jwks_uri: `${E2E_AUTHORITY}/${TENANT}/discovery/v2.0/keys`,
          response_types_supported: ['code'],
          code_challenge_methods_supported: ['S256'],
        },
      });
    }
    if (url.pathname.endsWith('/oauth2/v2.0/authorize')) {
      record.authorize.push(url.searchParams);
      const callback = new URL(url.searchParams.get('redirect_uri')!);
      callback.searchParams.set('code', 'auth-code-1');
      callback.searchParams.set('state', url.searchParams.get('state')!);
      return route.fulfill({ status: 302, headers: { Location: callback.toString() } });
    }
    if (url.pathname.endsWith('/oauth2/v2.0/token')) {
      const body = new URLSearchParams(route.request().postData() ?? '');
      record.token.push(body);
      const challenge = record.authorize.at(-1)?.get('code_challenge');
      const verifier = body.get('code_verifier') ?? '';
      const pkceOk = base64url(createHash('sha256').update(verifier).digest()) === challenge;
      if (
        body.get('grant_type') === 'authorization_code' &&
        (body.get('code') !== 'auth-code-1' || !pkceOk)
      ) {
        return route.fulfill({ status: 400, headers: cors, json: { error: 'invalid_grant' } });
      }
      issued += 1;
      return route.fulfill({
        headers: cors,
        json: {
          token_type: 'Bearer',
          scope: `openid profile offline_access ${API_SCOPE}`,
          access_token: `access-${issued}`,
          refresh_token: `refresh-${issued}`,
          id_token: idToken(record.authorize.at(-1)?.get('nonce') ?? undefined, loginHint),
          expires_in: issued === 1 ? accessTokenLifetime : 3600,
        },
      });
    }
    if (url.pathname.endsWith('/oauth2/v2.0/logout')) {
      record.endSession.push(url.searchParams);
      return route.fulfill({
        status: 302,
        headers: { Location: url.searchParams.get('post_logout_redirect_uri') ?? `${baseURL}/` },
      });
    }
    return route.fulfill({ status: 404, headers: cors, body: '' });
  });

  return record;
}

/** Text of every value in local or session storage. */
const browserStorage = (page: Page, kind: 'local' | 'session') =>
  page.evaluate((which) => {
    const store = which === 'local' ? window.localStorage : window.sessionStorage;
    return Object.keys(store)
      .map((key) => store.getItem(key) ?? '')
      .join('\n');
  }, kind);

test.describe('Entra External ID: authorization code + PKCE', () => {
  test.beforeEach(({ page }, testInfo) => {
    // Header buttons differ on phones (menu); the protocol is identical, so run on the desktop project only.
    test.skip(testInfo.project.name !== 'desktop-chromium');
    void page;
  });

  test('Login: PKCE S256 authorize request, verified code exchange, Home, session kept on refresh', async ({
    page,
    baseURL,
  }) => {
    const entra = await simulateEntra(page, baseURL!);
    await page.goto('/');
    await page.getByRole('banner').getByRole('button', { name: 'Login' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'September 2026' })).toBeVisible();
    await expect(page).toHaveURL(/\/calendar$/);

    const authorize = entra.authorize[0]!;
    expect(authorize.get('response_type')).toBe('code');
    expect(authorize.get('client_id')).toBe(CLIENT_ID);
    expect(authorize.get('redirect_uri')).toBe(`${baseURL}/auth/callback`);
    expect(authorize.get('code_challenge_method')).toBe('S256');
    expect(authorize.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(authorize.get('state')).toBeTruthy();
    expect(authorize.get('scope')?.split(' ')).toEqual(
      expect.arrayContaining(['openid', 'profile', 'offline_access', API_SCOPE]),
    );
    expect(authorize.get('prompt')).toBeNull();

    const exchange = entra.token[0]!;
    expect(exchange.get('grant_type')).toBe('authorization_code');
    expect(exchange.get('code')).toBe('auth-code-1');
    expect(exchange.get('redirect_uri')).toBe(`${baseURL}/auth/callback`);
    expect(exchange.get('client_id')).toBe(CLIENT_ID);
    expect(exchange.get('code_verifier')).toMatch(/^[A-Za-z0-9._~-]{43,128}$/);
    expect(exchange.has('client_secret')).toBe(false); // public client

    // Tokens are tab-scoped (sessionStorage), never in localStorage; the one-redirect PKCE record is cleaned up.
    const local = await browserStorage(page, 'local');
    expect(local).not.toContain('access-1');
    expect(local).not.toContain('refresh-1');
    expect(await browserStorage(page, 'session')).not.toContain(exchange.get('code_verifier')!);

    // A page refresh keeps the user signed in without another trip to Entra.
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'September 2026' })).toBeVisible();
    await expect(page.getByRole('banner').getByRole('button', { name: 'Open account menu' })).toBeVisible();
    await expect(page.getByRole('banner').getByRole('button', { name: 'Login' })).toHaveCount(0);
    expect(entra.authorize).toHaveLength(1);
  });

  test('does not offer Register on public pages or an authentication callback error', async ({
    page,
    baseURL,
  }) => {
    await simulateEntra(page, baseURL!);
    await page.goto('/about');
    await expect(page.getByRole('button', { name: 'Register', exact: true })).toHaveCount(0);
    await page.goto('/auth/callback?error=access_denied');
    await expect(page.getByRole('button', { name: 'Register', exact: true })).toHaveCount(0);
  });

  for (const [endpoint, rejectedEndpoint] of [
    ['auth/login', '**/api/v1/auth/login*'],
    ['panchang/month', '**/api/v1/panchang/month/**'],
  ] as const) {
    test(`a rejected ${endpoint} token stops login redirects until an explicit retry`, async ({
      page,
      baseURL,
    }) => {
      const entra = await simulateEntra(page, baseURL!);
      await withSavedLocation(page);
      await page.route(rejectedEndpoint, (route) =>
        route.fulfill({ status: 401, json: { title: 'Unauthorized' } }),
      );
      await page.goto('/calendar');
      // The sign-in round trip (code exchange) comes first, then the page's API request is rejected.
      await expect(page.getByRole('alert')).toContainText("We couldn't sign you in", { timeout: 15_000 });
      await expect(page).toHaveURL(/\/auth\/callback\?signin_error=failed/);
      expect(entra.authorize).toHaveLength(1);
      expect(entra.token).toHaveLength(1);
      await page.unroute(rejectedEndpoint);
      await page.getByRole('button', { name: 'Try again' }).click();
      await expect(page).toHaveURL(/\/calendar$/);
      await expect(page.getByRole('heading', { level: 1, name: 'September 2026' })).toBeVisible();
      expect(entra.authorize).toHaveLength(2);
    });
  }

  test('API calls carry the access token; an expiring token is renewed with the refresh token', async ({
    page,
    baseURL,
  }) => {
    // First access token expires in 30 s (< the 60 s renewal margin), so the next API call must refresh it.
    const entra = await simulateEntra(page, baseURL!, { accessTokenLifetime: 30 });
    await withSavedLocation(page);
    const authorization: string[] = [];
    // Every application API call (Find a Good Time's month data can serve Home's Panchang from the cache, so Home
    // need not request /panchang/today again).
    page.on('request', (request) => {
      if (request.url().includes('/api/v1/') && request.headers()['authorization'])
        authorization.push(request.headers()['authorization']!);
    });

    await page.goto('/good-time'); // protected: straight to Entra, back to /good-time
    await expect(page.getByRole('heading', { level: 1, name: 'Find a Good Time' })).toBeVisible({
      timeout: 15_000,
    });
    expect(entra.authorize[0]!.get('code_challenge_method')).toBe('S256');

    await page.getByRole('banner').getByRole('link', { name: 'Home', exact: true }).click(); // in-app: session kept
    await expect(page).toHaveURL(/\/calendar$/);
    await expect(page.getByRole('heading', { level: 1, name: 'September 2026' })).toBeVisible();

    const refresh = entra.token.find((body) => body.get('grant_type') === 'refresh_token');
    expect(refresh?.get('refresh_token')).toBe('refresh-1');
    expect(refresh?.get('client_id')).toBe(CLIENT_ID);
    expect(authorization).toContain('Bearer access-2');
    expect(authorization).not.toContain('Bearer access-1');
  });

  test('Logout is silent (no Entra page) and the next Login asks for credentials, on wide and phone windows', async ({
    page,
    baseURL,
  }) => {
    const entra = await simulateEntra(page, baseURL!, { loginHint: 'opaque-login-hint' });
    await page.goto('/');
    await page.getByRole('banner').getByRole('button', { name: 'Login' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'September 2026' })).toBeVisible();
    expect(entra.authorize[0]!.get('prompt')).toBeNull();

    await page.getByRole('banner').getByRole('button', { name: 'Open account menu' }).click();
    await page.getByRole('banner').getByRole('button', { name: 'Log out' }).click();
    await expect(page).toHaveURL(`${baseURL}/`);
    await expect(page.getByRole('banner').getByRole('button', { name: 'Login' })).toBeVisible();
    // Never sent to Entra's end-session page ("Pick an account", "Hang on a moment… sign you out").
    expect(entra.endSession).toHaveLength(0);

    // The next sign-in asks for credentials instead of reusing the Entra session.
    await page.goto('/settings');
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
    expect(entra.authorize[1]!.get('prompt')).toBe('login');

    // Phones: Log out from the "Your Account" sheet behaves the same.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('banner').getByRole('button', { name: 'Your account' }).click();
    await page.getByRole('dialog', { name: 'Your Account' }).getByRole('button', { name: 'Log out' }).click();
    await expect(page).toHaveURL(`${baseURL}/`);
    await expect(page.getByRole('banner').getByRole('button', { name: 'Login' })).toBeVisible();
    expect(entra.endSession).toHaveLength(0);
    await page.getByRole('button', { name: 'Login / Sign Up' }).click();
    await expect(page).toHaveURL(/\/calendar$/);
    expect(entra.authorize[2]!.get('prompt')).toBe('login');
  });

  test('a cancelled sign-in shows a friendly error with Try again (no provider text)', async ({
    page,
    baseURL,
  }) => {
    await simulateEntra(page, baseURL!);
    await page.route(`${E2E_AUTHORITY}/**/oauth2/v2.0/authorize*`, async (route) => {
      const url = new URL(route.request().url());
      const callback = new URL(url.searchParams.get('redirect_uri')!);
      callback.searchParams.set('error', 'access_denied');
      callback.searchParams.set('error_description', 'AADSTS50000: <b>user cancelled</b>');
      callback.searchParams.set('state', url.searchParams.get('state')!);
      await route.fulfill({ status: 302, headers: { Location: callback.toString() } });
    });
    await page.goto('/');
    await page.getByRole('banner').getByRole('button', { name: 'Login' }).click();
    await expect(page.getByRole('alert')).toHaveText(
      'Sign-in was cancelled. You can try again when you are ready.',
    );
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
    await expect(page.locator('body')).not.toContainText('AADSTS');
    await expect(page).not.toHaveURL(/code=|error_description/);
  });
});
