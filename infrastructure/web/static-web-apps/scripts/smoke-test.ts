/**
 * Post-deployment verification of one environment, against the content that was just deployed:
 *
 *   tsx smoke-test.ts --site-url https://www.example.com --staged <staged-dir> [--skip-cors] [--timeout-s 300]
 *
 * Waits until the edge serves the new release (index.html and config.json identical to the staged copies), then checks:
 * - HTTPS: HTTP redirects to HTTPS and HSTS is sent;
 * - security headers: the CSP and other headers equal staticwebapp.config.json's globalHeaders;
 * - caching: hashed assets immutable, config.json and HTML revalidated; source maps not served;
 * - SPA routing: a deep link returns the app with HTTP 200;
 * - backend CORS: the API answers a preflight from this site's origin;
 * - sign-in: the Entra External ID OpenID configuration is reachable for the configured authority.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import { entraIssuer, parseAppConfig } from '@myvedicstar/config';

const { values } = parseArgs({
  options: {
    'site-url': { type: 'string' },
    staged: { type: 'string' },
    'skip-cors': { type: 'boolean', default: false },
    'timeout-s': { type: 'string', default: '300' },
  },
});
const siteUrl = values['site-url']?.replace(/\/+$/, '');
const staged = values.staged;
if (!siteUrl || !staged) {
  console.error(
    'Usage: smoke-test.ts --site-url <https://host> --staged <dir> [--skip-cors] [--timeout-s 300]',
  );
  process.exit(2);
}

const stagedIndex = readFileSync(join(staged, 'index.html'), 'utf8');
const stagedConfig = JSON.parse(readFileSync(join(staged, 'config.json'), 'utf8')) as unknown;
const swaConfig = JSON.parse(readFileSync(join(staged, 'staticwebapp.config.json'), 'utf8')) as {
  globalHeaders: Record<string, string>;
};
const parsed = parseAppConfig(stagedConfig);
if (!parsed.ok) {
  console.error(`Staged config.json is invalid:\n  ${parsed.issues.join('\n  ')}`);
  process.exit(1);
}
const config = parsed.config;

const failures: string[] = [];
const check = (ok: boolean, message: string) => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${message}`);
  if (!ok) failures.push(message);
};

async function get(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${siteUrl}${path}`, { redirect: 'manual', cache: 'no-store', ...init });
}

// 1. Wait for the new release to be served (Static Web Apps propagates content to its edge within a few minutes).
const deadline = Date.now() + Number(values['timeout-s']) * 1000;
let live = false;
let lastProblem = '';
while (Date.now() < deadline) {
  try {
    const [index, runtime] = await Promise.all([get('/'), get(`/config.json?smoke=${Date.now()}`)]);
    const indexText = await index.text();
    const runtimeJson = runtime.ok ? ((await runtime.json()) as unknown) : undefined;
    if (
      index.status === 200 &&
      indexText === stagedIndex &&
      JSON.stringify(runtimeJson) === JSON.stringify(stagedConfig)
    ) {
      live = true;
      break;
    }
    lastProblem = `index ${index.status}${indexText === stagedIndex ? '' : ' (previous release)'}, config.json ${runtime.status}`;
  } catch (error) {
    lastProblem = error instanceof Error ? error.message : String(error);
  }
  await new Promise((resolve) => setTimeout(resolve, 10_000));
}
console.log(`Smoke test ${siteUrl}`);
check(
  live,
  `new release is live (index.html and config.json match the deployment)${live ? '' : `: ${lastProblem}`}`,
);
// After network calls the script sets process.exitCode and ends normally: process.exit() with fetch connections still
// open can crash Node on Windows instead of returning the exit code.
if (live) {
  await runChecks(siteUrl);
} else {
  console.error('Smoke test failed: the deployed content never became visible.');
  process.exitCode = 1;
}

async function runChecks(siteUrl: string): Promise<void> {
  // 2. HTTPS.
  const site = new URL(siteUrl);
  if (site.protocol === 'https:') {
    try {
      const insecure = await fetch(`http://${site.host}/`, { redirect: 'manual' });
      const location = insecure.headers.get('location') ?? '';
      check(
        [301, 302, 307, 308].includes(insecure.status) && location.startsWith('https://'),
        `HTTP redirects to HTTPS (${insecure.status})`,
      );
    } catch {
      check(true, 'HTTP not served (connection refused), HTTPS only');
    }
  }

  // 3. Security headers on the document.
  const home = await get('/');
  for (const [name, expected] of Object.entries(swaConfig.globalHeaders)) {
    check(home.headers.get(name) === expected, `${name} header`);
  }

  // 4. Caching, source maps and SPA routing.
  const entry = /<script[^>]+src="(\/assets\/[^"]+\.js)"/.exec(stagedIndex)?.[1];
  if (entry) {
    const asset = await get(entry);
    check(asset.status === 200, `entry script ${entry} served`);
    check(
      /immutable/.test(asset.headers.get('cache-control') ?? ''),
      'hashed assets are cached as immutable',
    );
    const map = await get(`${entry}.map`);
    check(map.status === 404, `source map not public (${map.status})`);
  }
  const runtime = await get('/config.json');
  check(/no-store|no-cache/.test(runtime.headers.get('cache-control') ?? ''), 'config.json is not cached');
  check(/no-cache|no-store/.test(home.headers.get('cache-control') ?? ''), 'index.html is revalidated');
  const deepLink = await get('/calendar');
  check(
    deepLink.status === 200 && (await deepLink.text()) === stagedIndex,
    `deep link /calendar serves the app (${deepLink.status})`,
  );

  // 5. Backend CORS for this origin.
  if (!values['skip-cors']) {
    // A public, parameterless endpoint: the preflight must succeed before any sign-in.
    const apiUrl = `${config.apiBaseUrl.replace(/\/+$/, '')}${config.endpoints.traditions}`;
    try {
      const preflight = await fetch(apiUrl, {
        method: 'OPTIONS',
        headers: {
          Origin: site.origin,
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'authorization,x-correlation-id',
        },
      });
      const allowed = preflight.headers.get('access-control-allow-origin');
      check(
        allowed === site.origin || allowed === '*',
        `API CORS allows ${site.origin} (got ${allowed ?? 'none'})`,
      );
    } catch (error) {
      check(
        false,
        `API reachable for CORS preflight (${error instanceof Error ? error.message : String(error)})`,
      );
    }
  }

  // 6. Sign-in configuration.
  if (config.auth.mode === 'entra-external-id') {
    const discovery = `${entraIssuer(config.auth)}/.well-known/openid-configuration`;
    try {
      const response = await fetch(discovery);
      check(response.ok, `Entra External ID discovery document reachable (${response.status})`);
    } catch (error) {
      check(false, `Entra External ID discovery (${error instanceof Error ? error.message : String(error)})`);
    }
  }

  if (failures.length) {
    console.error(`Smoke test failed (${failures.length}):\n  ${failures.join('\n  ')}`);
    process.exitCode = 1;
    return;
  }
  console.log('Smoke test passed.');
}
