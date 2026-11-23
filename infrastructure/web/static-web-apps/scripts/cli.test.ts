/**
 * End-to-end tests of the deployment command-line tools, run as real processes (as deploy.sh runs them):
 * validate-build.ts (production build gate), render.ts (per-environment files) and smoke-test.ts (post-deploy checks,
 * against a local server that behaves like Azure Static Web Apps).
 */
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

const SCRIPTS = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPTS, '../../../..');
const TIMEOUT = 60_000;

// Mirrors a real Vite build: the entry stylesheet is linked and the module script carries crossorigin.
const INDEX_HTML =
  '<!doctype html><html><head><link rel="stylesheet" crossorigin href="/assets/index-def456.css">' +
  '<script type="module" crossorigin src="/assets/index-abc123.js"></script></head>' +
  '<body><div id="root"></div></body></html>';

function runScript(script: string, args: string[], env: Record<string, string> = {}) {
  return new Promise<{ code: number | null; output: string }>((done) => {
    const child = spawn(process.execPath, ['--import', 'tsx', join(SCRIPTS, script), ...args], {
      cwd: REPO_ROOT,
      env: { PATH: process.env.PATH ?? '', SYSTEMROOT: process.env.SYSTEMROOT ?? '', ...env },
    });
    let output = '';
    child.stdout.on('data', (chunk: Buffer) => (output += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (output += chunk.toString()));
    child.on('close', (code) => done({ code, output }));
  });
}

const temporary: string[] = [];
function buildDir(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'mvs-build-'));
  temporary.push(dir);
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, name)), { recursive: true });
    writeFileSync(join(dir, name), content);
  }
  return dir;
}

const servers: Server[] = [];
afterEach(() => {
  for (const dir of temporary.splice(0)) rmSync(dir, { recursive: true, force: true });
  for (const server of servers.splice(0)) server.close();
});

const goodBuild = () =>
  buildDir({
    // The raw Vite build: the shell only. Pre-rendered pages appear at deploy staging, so the un-staged gate must not
    // require them (validate-build asserts them only with --staged).
    'index.html': INDEX_HTML,
    'assets/index-abc123.js': 'export const app = () => 1;\n',
    // The entry stylesheet index.html links, and the not-found stylesheet 404.html links.
    'assets/index-def456.css': '.app{display:grid}\n',
    'assets/not-found-def456.css': '.not-found-main{display:grid}\n',
  });

describe('validate-build.ts', () => {
  it(
    'passes a clean production build and reports its size',
    async () => {
      const { code, output } = await runScript('validate-build.ts', [goodBuild()]);
      // index.html + entry script + entry stylesheet + not-found stylesheet.
      expect(output).toMatch(/Build validation passed: 4 files/);
      expect(code).toBe(0);
    },
    TIMEOUT,
  );

  it(
    'requires the pre-rendered public pages in staged content',
    async () => {
      // A staged tree: the shell plus the generated files, but WITHOUT the pre-rendered pages.
      const build = goodBuild();
      writeFileSync(join(build, 'config.json'), '{}');
      writeFileSync(join(build, 'staticwebapp.config.json'), '{}');
      writeFileSync(
        join(build, '404.html'),
        '<html><head><meta name="robots" content="noindex"></head></html>',
      );
      // --expect-prerendered is the bare-build mode: pages required, staging config not.
      const { code, output } = await runScript('validate-build.ts', [build, '--expect-prerendered']);
      expect(code).toBe(1);
      expect(output).toContain('pre-rendered page about/index.html is missing');
      expect(output).toContain('index.html: no absolute canonical link');
    },
    TIMEOUT,
  );

  it.each([
    [
      'an inline script',
      { 'index.html': INDEX_HTML.replace('</head>', '<script>alert(1)</script></head>') },
      /inline <script>/,
    ],
    ['eval', { 'assets/index-abc123.js': 'export const run = (s) => eval(s);' }, /eval\/new Function/],
    [
      'a storage account key',
      { 'assets/index-abc123.js': `const c = "AccountKey=${'a'.repeat(40)}";` },
      /storage account key/,
    ],
    ['a private key', { 'assets/extra.js': '-----BEGIN PRIVATE KEY-----' }, /private key/],
    [
      'a hard-coded localhost API',
      { 'assets/index-abc123.js': 'fetch("http://localhost:5275/api/v1")' },
      /localhost URL/,
    ],
    [
      'an Entra authority',
      { 'assets/index-abc123.js': 'const a = "https://mvs.ciamlogin.com/";' },
      /Entra External ID authority/,
    ],
    [
      'a public source map reference',
      { 'assets/index-abc123.js': 'x();\n//# sourceMappingURL=index.js.map' },
      /public source map/,
    ],
    [
      'a missing entry asset',
      { 'assets/index-abc123.js': undefined },
      /references missing assets\/index-abc123\.js/,
    ],
  ])(
    'fails a build containing %s, naming the problem',
    async (_, overrides, message) => {
      // An override of `undefined` removes that file from the build.
      const merged = { 'index.html': INDEX_HTML, 'assets/index-abc123.js': 'ok();', ...overrides };
      const files = Object.fromEntries(
        Object.entries(merged).filter((entry): entry is [string, string] => entry[1] !== undefined),
      );
      const { code, output } = await runScript('validate-build.ts', [buildDir(files)]);
      expect(code).toBe(1);
      expect(output).toMatch(message);
    },
    TIMEOUT,
  );

  it(
    'requires the generated files and no source maps in staged content',
    async () => {
      const dir = buildDir({
        'index.html': INDEX_HTML,
        'assets/index-abc123.js': 'ok();',
        'assets/index-abc123.js.map': '{}',
      });
      const { code, output } = await runScript('validate-build.ts', [dir, '--staged']);
      expect(code).toBe(1);
      expect(output).toMatch(/source maps would be published/);
      expect(output).toMatch(/config\.json is missing/);
      expect(output).toMatch(/staticwebapp\.config\.json is missing/);
    },
    TIMEOUT,
  );

  it(
    'enforces the JavaScript size budget',
    async () => {
      // ~8 KiB of incompressible JavaScript against a 1 KiB budget.
      const payload = Array.from({ length: 2000 }, (_, i) => ((i * 2654435761) >>> 0).toString(36)).join(',');
      const dir = buildDir({
        'index.html': INDEX_HTML,
        'assets/index-abc123.js': `export const d = [${payload}];`,
      });
      const { code, output } = await runScript('validate-build.ts', [dir], { MVS_BUDGET_TOTAL_KIB: '1' });
      expect(code).toBe(1);
      expect(output).toMatch(/JavaScript totals [\d.]+ KiB gzip \(budget 1\)/);
    },
    TIMEOUT,
  );
});

const siteEnv = (siteUrl: string): Record<string, string> => ({
  MVS_ENVIRONMENT: 'test',
  MVS_SITE_URL: siteUrl,
  MVS_API_BASE_URL: 'https://api.myvedicstar.example/api/v1',
});

describe('render.ts', () => {
  it(
    'writes config.json and staticwebapp.config.json for the environment',
    async () => {
      const out = goodBuild();
      const { code, output } = await runScript(
        'render.ts',
        ['--out', out, '--expect-environment', 'test'],
        siteEnv('https://test.myvedicstar.example'),
      );
      expect(code).toBe(0);
      expect(output).toMatch(/Rendered test configuration for https:\/\/test\.myvedicstar\.example/);
      expect(JSON.parse(readFileSync(join(out, 'config.json'), 'utf8'))).toMatchObject({
        environment: 'test',
        apiBaseUrl: 'https://api.myvedicstar.example/api/v1',
      });
      const swa = JSON.parse(readFileSync(join(out, 'staticwebapp.config.json'), 'utf8'));
      expect(swa.globalHeaders['Content-Security-Policy']).toContain('https://api.myvedicstar.example');
    },
    TIMEOUT,
  );

  it(
    'refuses a configuration for a different environment than the deployment target',
    async () => {
      const { code, output } = await runScript(
        'render.ts',
        ['--out', goodBuild(), '--expect-environment', 'production'],
        siteEnv('https://test.myvedicstar.example'),
      );
      expect(code).toBe(1);
      expect(output).toMatch(/MVS_ENVIRONMENT is "test" but this deployment targets "production"/);
    },
    TIMEOUT,
  );

  it(
    'lists every problem without echoing values',
    async () => {
      const { code, output } = await runScript('render.ts', ['--out', goodBuild()], {
        MVS_ENVIRONMENT: 'production',
        MVS_SITE_URL: 'https://www.myvedicstar.example',
        MVS_API_BASE_URL: 'http://insecure.example/api/v1',
        MVS_AUTH_CLIENT_SECRET: 'super-secret-value',
      });
      expect(code).toBe(1);
      expect(output).toMatch(/MVS_AUTH_CLIENT_SECRET: unknown variable/);
      expect(output).toMatch(/apiBaseUrl must use HTTPS/);
      expect(output).not.toContain('super-secret-value');
    },
    TIMEOUT,
  );
});

/** Serves staged content the way Azure Static Web Apps does with the generated staticwebapp.config.json. */
type SiteOptions = { dropHeader?: string; assetStatuses?: number[]; immutableAfter?: number };

async function staticWebApp(stage: string, options: SiteOptions = {}): Promise<string> {
  const swa = JSON.parse(readFileSync(join(stage, 'staticwebapp.config.json'), 'utf8')) as {
    globalHeaders: Record<string, string>;
  };
  // The deployed release: fixed at "deploy" time, like the real site.
  const deployedIndex = readFileSync(join(stage, 'index.html'));
  let assetRequests = 0;
  const server = createServer((request, response) => {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname;
    for (const [name, value] of Object.entries(swa.globalHeaders)) {
      if (name !== options.dropHeader) response.setHeader(name, value);
    }
    if (path.endsWith('.map')) return response.writeHead(404).end();
    if (path.startsWith('/assets/')) {
      const attempt = assetRequests++;
      const status = options.assetStatuses?.[Math.min(attempt, options.assetStatuses.length - 1)] ?? 200;
      if (status !== 200) return response.writeHead(status).end();
    }
    if (path.startsWith('/assets/') || extname(path)) {
      try {
        const body = readFileSync(join(stage, path));
        response.setHeader(
          'Cache-Control',
          path.startsWith('/assets/') && assetRequests > (options.immutableAfter ?? 0)
            ? 'public, max-age=31536000, immutable'
            : 'no-store',
        );
        return response.writeHead(200).end(body);
      } catch {
        return response.writeHead(404).end();
      }
    }
    response.setHeader('Cache-Control', 'no-cache');
    response.setHeader('Content-Type', 'text/html');
    return response.writeHead(200).end(deployedIndex);
  });
  servers.push(server);
  await new Promise<void>((ready) => server.listen(0, '127.0.0.1', ready));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

async function stagedSite(options: SiteOptions = {}) {
  const stage = goodBuild();
  // The site URL is only known once the server listens; render with a placeholder origin, then serve.
  const rendered = await runScript('render.ts', ['--out', stage], siteEnv('http://127.0.0.1'));
  expect(rendered.code).toBe(0);
  return { stage, siteUrl: await staticWebApp(stage, options) };
}

describe('smoke-test.ts', () => {
  it(
    'waits for entry script and immutable caching after HTML has propagated',
    async () => {
      const { stage, siteUrl } = await stagedSite({ assetStatuses: [404, 200], immutableAfter: 2 });
      const { code, output } = await runScript('smoke-test.ts', [
        '--site-url',
        siteUrl,
        '--staged',
        stage,
        '--skip-cors',
        '--timeout-s',
        '40',
      ]);
      expect(output).toContain('waiting for release assets');
      expect(output).toContain('HTTP 404');
      expect(output).toContain('Cache-Control no-store');
      expect(output).toContain('Smoke test passed.');
      expect(code).toBe(0);
    },
    TIMEOUT,
  );

  it.each([
    { assetStatuses: [404], problem: 'HTTP 404' },
    { immutableAfter: 100, problem: 'Cache-Control no-store' },
  ])(
    'fails when entry assets never become ready: $problem',
    async (options) => {
      const { stage, siteUrl } = await stagedSite(options);
      const { code, output } = await runScript('smoke-test.ts', [
        '--site-url',
        siteUrl,
        '--staged',
        stage,
        '--skip-cors',
        '--timeout-s',
        '1',
      ]);
      expect(code).toBe(1);
      expect(output).toContain(options.problem);
      expect(output).toContain('the deployed content never became visible');
    },
    TIMEOUT,
  );

  it.each([
    [200, true, 1],
    [401, false, 1],
    [401, true, 0],
    [200, false, 1],
  ])(
    'checks actual GET CORS and required authentication (status %s, header %s)',
    async (status, cors, expectedCode) => {
      const { stage, siteUrl } = await stagedSite();
      const requests: { method: string | undefined; url: URL; origin: string | undefined }[] = [];
      const api = createServer((request, response) => {
        requests.push({
          method: request.method,
          url: new URL(request.url!, 'http://localhost'),
          origin: request.headers.origin,
        });
        if (request.method === 'OPTIONS') {
          response.setHeader('Access-Control-Allow-Origin', siteUrl);
          return response.writeHead(200).end();
        }
        if (cors) response.setHeader('Access-Control-Allow-Origin', siteUrl);
        return response.writeHead(status).end('{}');
      });
      servers.push(api);
      await new Promise<void>((ready) => api.listen(0, '127.0.0.1', ready));
      const configPath = join(stage, 'config.json');
      const config = JSON.parse(readFileSync(configPath, 'utf8'));
      config.apiBaseUrl = `http://127.0.0.1:${(api.address() as AddressInfo).port}`;
      writeFileSync(configPath, JSON.stringify(config));
      const { code, output } = await runScript('smoke-test.ts', ['--site-url', siteUrl, '--staged', stage], {
        // The CORS-on-401 assertion is temporarily skippable (myvedicstar-infra#7); these cases assert it still RUNS.
        SMOKE_SKIP_CORS_401: '',
      });
      // Attribute the outcome to the CORS check specifically. The exit code alone cannot tell a CORS failure from
      // the authentication failure that follows it, so a mutation to either one would look identical here.
      const corsLine = output
        .split('\n')
        .find((line) => line.includes('API GET CORS allows'))
        ?.trim();
      expect(corsLine).toBeDefined();
      if (cors) {
        // Pass path: the header came off the wire and was accepted.
        expect(corsLine).toMatch(/^ok +API GET CORS allows/);
        expect(corsLine).toContain(`got ${siteUrl}`);
      } else {
        // Fail path: the assertion must reject this response on its own, naming what it actually saw.
        expect(corsLine).toMatch(/^FAIL API GET CORS allows/);
        expect(corsLine).toContain('got none');
      }
      expect(output).toContain(`application API rejects requests without a token (${status})`);
      expect(code).toBe(expectedCode);
      expect(requests.map((request) => request.method)).toEqual(['OPTIONS', 'GET']);
      for (const request of requests) {
        expect(request.url.pathname).toBe('/panchang/today');
        expect(Object.fromEntries(request.url.searchParams)).toEqual({
          latitude: '30.63',
          longitude: '-97.68',
          timeZone: 'America/Chicago',
          tradition: 'all',
          language: 'en',
        });
        expect(request.origin).toBe(siteUrl);
      }
    },
    TIMEOUT,
  );

  it(
    'skips ONLY the CORS-on-401 assertion when asked, and says so loudly',
    async () => {
      const { stage, siteUrl } = await stagedSite();
      // APIM answers 401 without Access-Control-Allow-Origin (myvedicstar-infra#7): the assertion fails, but the
      // authentication check right after it must still run and pass.
      const api = createServer((request, response) => {
        if (request.method === 'OPTIONS') {
          response.setHeader('Access-Control-Allow-Origin', siteUrl);
          return response.writeHead(200).end();
        }
        return response.writeHead(401).end('{}');
      });
      servers.push(api);
      await new Promise<void>((ready) => api.listen(0, '127.0.0.1', ready));
      const configPath = join(stage, 'config.json');
      const config = JSON.parse(readFileSync(configPath, 'utf8'));
      config.apiBaseUrl = `http://127.0.0.1:${(api.address() as AddressInfo).port}`;
      writeFileSync(configPath, JSON.stringify(config));

      const { code, output } = await runScript('smoke-test.ts', ['--site-url', siteUrl, '--staged', stage], {
        SMOKE_SKIP_CORS_401: 'true',
      });

      // The skip must be visibly a skip, never a silent pass. The exact wording is pinned: "NOT RUN and NOT VERIFIED"
      // is the phrase that stops a skip being read as a pass, so a reword that softens it has to fail here.
      expect(output).toContain('!! SKIPPED:');
      expect(output).toContain('was NOT RUN and NOT VERIFIED');
      expect(output).toContain('myvedicstar-infra#7');
      // The assertion's own PASS line must not appear: the only mention of its name is the SKIPPED warning, so a
      // skipped check can never be read as green.
      expect(output).not.toContain('PASS: API GET CORS allows');
      expect(output).not.toContain(`API GET CORS allows ${siteUrl} (status`);

      // Everything else still runs: the 401 auth check passes, and the release verifies.
      expect(output).toContain('application API rejects requests without a token (401)');
      expect(code).toBe(0);
    },
    TIMEOUT,
  );

  it(
    'runs the CORS-on-401 assertion by default',
    async () => {
      const { stage, siteUrl } = await stagedSite();
      const api = createServer((request, response) => {
        if (request.method === 'OPTIONS') {
          response.setHeader('Access-Control-Allow-Origin', siteUrl);
          return response.writeHead(200).end();
        }
        return response.writeHead(401).end('{}'); // no CORS header, as APIM does today
      });
      servers.push(api);
      await new Promise<void>((ready) => api.listen(0, '127.0.0.1', ready));
      const configPath = join(stage, 'config.json');
      const config = JSON.parse(readFileSync(configPath, 'utf8'));
      config.apiBaseUrl = `http://127.0.0.1:${(api.address() as AddressInfo).port}`;
      writeFileSync(configPath, JSON.stringify(config));

      // No env flag: the default must be to RUN the check, so fixing infra#7 restores it with no code change.
      const { code, output } = await runScript('smoke-test.ts', ['--site-url', siteUrl, '--staged', stage], {
        SMOKE_SKIP_CORS_401: '',
      });
      expect(output).toContain('API GET CORS allows');
      expect(output).not.toContain('!! SKIPPED:');
      expect(code).toBe(1);
    },
    TIMEOUT,
  );

  it(
    'verifies a correctly deployed release',
    async () => {
      const { stage, siteUrl } = await stagedSite();
      const { code, output } = await runScript('smoke-test.ts', [
        '--site-url',
        siteUrl,
        '--staged',
        stage,
        '--skip-cors',
      ]);
      expect(output).toMatch(/ok {3}new release is live/);
      expect(output).toMatch(/ok {3}Content-Security-Policy header/);
      expect(output).toMatch(/ok {3}hashed assets are cached as immutable/);
      expect(output).toMatch(/ok {3}source map not public \(404\)/);
      expect(output).toMatch(/ok {3}deep link \/calendar serves the app \(200\)/);
      expect(output).toMatch(/Smoke test passed\./);
      expect(code).toBe(0);
    },
    TIMEOUT,
  );

  it(
    'fails, naming the check, when a security header is missing',
    async () => {
      const { stage, siteUrl } = await stagedSite({ dropHeader: 'Content-Security-Policy' });
      const { code, output } = await runScript('smoke-test.ts', [
        '--site-url',
        siteUrl,
        '--staged',
        stage,
        '--skip-cors',
      ]);
      expect(code).toBe(1);
      expect(output).toMatch(/FAIL Content-Security-Policy header/);
    },
    TIMEOUT,
  );

  it(
    'fails when the new release never becomes visible',
    async () => {
      const { stage, siteUrl } = await stagedSite();
      writeFileSync(join(stage, 'index.html'), INDEX_HTML.replace('abc123', 'newer'));
      const { code, output } = await runScript('smoke-test.ts', [
        '--site-url',
        siteUrl,
        '--staged',
        stage,
        '--skip-cors',
        '--timeout-s',
        '1',
      ]);
      expect(code).toBe(1);
      expect(output).toMatch(/the deployed content never became visible/);
    },
    TIMEOUT,
  );
});
