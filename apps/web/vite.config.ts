/// <reference types="vitest/config" />
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

import basicSsl from '@vitejs/plugin-basic-ssl';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

import { buildContentSecurityPolicy, buildSecurityHeaders } from './security/headers.ts';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

/** Local API origin used by preview/E2E. Must match public/config.json; E2E fixtures answer it, nothing real runs. */
const LOCAL_API_ORIGIN = 'http://localhost:5275';
/**
 * Dev server proxy targets (developer machine only; never part of a build). Override when the backends run elsewhere:
 * `MVS_DEV_API_ORIGIN=http://localhost:5000 npm run web:dev`.
 */
const DEV_API_ORIGIN = process.env.MVS_DEV_API_ORIGIN ?? 'http://localhost:5289';
/** Auth is hosted with Star and Day by default; an explicit override supports separate development services. */
const DEV_AUTH_API_ORIGIN = process.env.MVS_DEV_AUTH_API_ORIGIN ?? DEV_API_ORIGIN;
/**
 * Simulated Entra External ID authority used only by the E2E sign-in test (e2e/entra-pkce.spec.ts); Playwright answers
 * every request to it, nothing real lives there. Must match E2E_AUTHORITY in that spec.
 */
const E2E_AUTHORITY_ORIGIN = 'https://myvedicstar-e2e.ciamlogin.com';

/**
 * Development only: Vite injects the React Fast Refresh preamble and every stylesheet as inline <script>/<style>
 * elements. A random nonce per dev-server start, stamped on those elements by Vite (`html.cspNonce`) and allowed by the
 * dev CSP, keeps the policy free of 'unsafe-inline'. Production builds contain no inline code and use no nonce.
 */
const DEV_CSP_NONCE = randomBytes(16).toString('base64');

/**
 * Locally trusted dev certificate made with mkcert (`.certs/`, gitignored — see docs/security/entra-setup.md). When it is
 * present the dev server uses it, so the browser shows a normal padlock for https://localhost:5173; otherwise a
 * self-signed certificate is generated (encrypted, but the browser says "Not secure").
 */
const DEV_CERT = new URL('./.certs/localhost.pem', import.meta.url);
const DEV_CERT_KEY = new URL('./.certs/localhost-key.pem', import.meta.url);
const hasTrustedDevCert = existsSync(DEV_CERT) && existsSync(DEV_CERT_KEY);

/**
 * Dev server only:
 * - serves `infrastructure/web/config/config.<mode>.json` as `/config.json` when it exists
 *   (`npm run web:dev` → mode `development` → config.development.json; `vite --mode local` → public/config.json);
 * - sends the same Content-Security-Policy as production, derived from that config (API and identity authority
 *   origins), plus the dev-only HMR WebSocket (wss) and per-start nonce.
 * Builds are unaffected: deployments write the environment's config.json next to index.html.
 */
function environmentConfig(mode: string): Plugin {
  const file = new URL(`../../infrastructure/web/config/config.${mode}.json`, import.meta.url);
  const configFile = existsSync(file) ? file : new URL('./public/config.json', import.meta.url);
  const readConfig = () => readJson(configFile);
  return {
    name: 'myvedicstar:environment-config',
    apply: 'serve',
    configureServer(server) {
      const port = server.config.server.port ?? 5173;
      const nonce = `'nonce-${DEV_CSP_NONCE}'`;
      // Rebuilt per request so edits to the environment config (e.g. the authority) apply without a restart.
      server.middlewares.use((_req, res, next) => {
        const csp = buildContentSecurityPolicy({
          connectSrc: [...configOrigins(readConfig()), `wss://localhost:${port}`],
          scriptSrc: [nonce],
          styleSrc: [nonce],
          upgradeInsecureRequests: false,
        });
        res.setHeader('Content-Security-Policy', csp);
        next();
      });
      if (!existsSync(file)) return;
      server.config.logger.info(`  runtime config: infrastructure/web/config/config.${mode}.json`);
      server.middlewares.use('/config.json', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        res.end(readFileSync(file, 'utf8'));
      });
    },
  };
}

function readJson(file: URL): Record<string, unknown> {
  return JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
}

/** Origins the SPA calls for a runtime config: the API and, when sign-in is configured, the identity authority. */
function configOrigins(raw: Record<string, unknown>): string[] {
  const config = raw as { apiBaseUrl?: string; auth?: { authority?: string } };
  return [config.apiBaseUrl, config.auth?.authority].flatMap((url) => {
    try {
      return url ? [new URL(url).origin] : [];
    } catch {
      return []; // unfilled placeholder: startup validation reports it
    }
  });
}

export default defineConfig(({ mode, command, isPreview }) => ({
  plugins: [
    react(),
    environmentConfig(mode),
    // Dev server over HTTPS (https://localhost:5173), so sign-in redirects, secure cookies and Web Crypto behave as in
    // production: the trusted mkcert certificate when present, otherwise a self-signed one. Preview/E2E stay on
    // http://localhost:4173.
    ...(command === 'serve' && !isPreview && !hasTrustedDevCert
      ? [basicSsl({ name: 'myvedicstar-dev', domains: ['localhost'] })]
      : []),
  ],
  ...(command === 'serve' ? { html: { cspNonce: DEV_CSP_NONCE } } : {}),
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_ID__: JSON.stringify(process.env.BUILD_ID ?? 'local'),
  },
  build: {
    target: 'es2022',
    sourcemap: 'hidden',
    // Never inline assets as data: URIs into JS/CSS; keeps CSP simple and caching effective.
    assetsInlineLimit: 0,
    modulePreload: { polyfill: false },
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            // Zod and src/zod-config.ts share one chunk so jitless mode is on before any chunk can create a schema;
            // otherwise Zod's caught `new Function` probe is reported as a CSP (no `unsafe-eval`) violation.
            { name: 'zod', test: /[\\/]node_modules[\\/]zod[\\/]|[\\/]src[\\/]zod-config\.ts$/ },
          ],
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    // Dev server only: `vite preview` would otherwise inherit server.https, but preview/E2E must stay on HTTP.
    ...(command === 'serve' && !isPreview && hasTrustedDevCert
      ? { https: { cert: readFileSync(DEV_CERT), key: readFileSync(DEV_CERT_KEY) } }
      : {}),
    // The page is https://localhost:5173 but the shared API is http://localhost:5289, whose development CORS list allows
    // only http origins. Proxying /api keeps API calls same-origin (no CORS, no mixed content) without changing the
    // backend; config.development.json therefore uses apiBaseUrl https://localhost:5173/api/v1.
    proxy: {
      // Sign-in completion and user profile. Listed first to support an explicit separate-auth target override.
      // It does not answer CORS preflights, so the browser must call it same-origin. `secure: false` only skips
      // verifying its local ASP.NET development certificate, on the dev server.
      '/api/v1/auth': { target: DEV_AUTH_API_ORIGIN, changeOrigin: true, secure: false },
      '/api': { target: DEV_API_ORIGIN, changeOrigin: true },
    },
  },
  preview: {
    port: 4173,
    strictPort: true,
    // Production security headers, so E2E tests fail on any CSP violation.
    headers: buildSecurityHeaders({
      connectSrc: [LOCAL_API_ORIGIN, E2E_AUTHORITY_ORIGIN],
      hsts: false,
      upgradeInsecureRequests: false,
    }),
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: { modules: { classNameStrategy: 'non-scoped' } },
    restoreMocks: true,
    // Page tests load lazy route chunks and run axe scans; when every workspace's tests run in parallel (npm test at
    // the root) they can exceed the 5 s default. Passing assertions still complete immediately.
    testTimeout: 20_000,
  },
}));
