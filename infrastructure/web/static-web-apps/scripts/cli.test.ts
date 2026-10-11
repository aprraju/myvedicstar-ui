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

const INDEX_HTML =
  '<!doctype html><html><head><script type="module" src="/assets/index-abc123.js"></script></head>' +
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
  buildDir({ 'index.html': INDEX_HTML, 'assets/index-abc123.js': 'export const app = () => 1;\n' });

describe('validate-build.ts', () => {
  it(
    'passes a clean production build and reports its size',
    async () => {
      const { code, output } = await runScript('validate-build.ts', [goodBuild()]);
      expect(output).toMatch(/Build validation passed: 2 files/);
      expect(code).toBe(0);
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
async function staticWebApp(stage: string, options: { dropHeader?: string } = {}): Promise<string> {
  const swa = JSON.parse(readFileSync(join(stage, 'staticwebapp.config.json'), 'utf8')) as {
    globalHeaders: Record<string, string>;
  };
  // The deployed release: fixed at "deploy" time, like the real site.
  const deployedIndex = readFileSync(join(stage, 'index.html'));
  const server = createServer((request, response) => {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname;
    for (const [name, value] of Object.entries(swa.globalHeaders)) {
      if (name !== options.dropHeader) response.setHeader(name, value);
    }
    if (path.endsWith('.map')) return response.writeHead(404).end();
    if (path.startsWith('/assets/') || extname(path)) {
      try {
        const body = readFileSync(join(stage, path));
        response.setHeader(
          'Cache-Control',
          path.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-store',
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

async function stagedSite(options: { dropHeader?: string } = {}) {
  const stage = goodBuild();
  // The site URL is only known once the server listens; render with a placeholder origin, then serve.
  const rendered = await runScript('render.ts', ['--out', stage], siteEnv('http://127.0.0.1'));
  expect(rendered.code).toBe(0);
  return { stage, siteUrl: await staticWebApp(stage, options) };
}

describe('smoke-test.ts', () => {
  it.each([
    [200, true, 0],
    [401, false, 1],
    [401, true, 1],
    [200, false, 1],
  ])(
    'checks actual GET CORS and anonymous access (status %s, header %s)',
    async (status, cors, expectedCode) => {
      const { stage, siteUrl } = await stagedSite();
      const api = createServer((request, response) => {
        if (request.method === 'OPTIONS') {
          response.setHeader('Access-Control-Allow-Origin', siteUrl);
          return response.writeHead(200).end();
        }
        const url = new URL(request.url!, 'http://localhost');
        expect(url.pathname).toBe('/api/v1/panchang/today');
        expect(Object.fromEntries(url.searchParams)).toEqual({
          latitude: '30.63',
          longitude: '-97.68',
          timeZone: 'America/Chicago',
          tradition: 'all',
          language: 'en',
        });
        expect(request.headers.origin).toBe(siteUrl);
        if (cors) response.setHeader('Access-Control-Allow-Origin', siteUrl);
        return response.writeHead(status).end('{}');
      });
      servers.push(api);
      await new Promise<void>((ready) => api.listen(0, '127.0.0.1', ready));
      const configPath = join(stage, 'config.json');
      const config = JSON.parse(readFileSync(configPath, 'utf8'));
      config.apiBaseUrl = `http://127.0.0.1:${(api.address() as AddressInfo).port}`;
      writeFileSync(configPath, JSON.stringify(config));
      const { code, output } = await runScript('smoke-test.ts', ['--site-url', siteUrl, '--staged', stage]);
      expect(output).toContain('API GET CORS allows');
      expect(output).toContain(`public today endpoint succeeds without sign-in (${status})`);
      expect(code).toBe(expectedCode);
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
