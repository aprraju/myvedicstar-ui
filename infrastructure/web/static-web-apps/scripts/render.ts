/**
 * Writes the per-environment files into a staged copy of the build:
 *   config.json               runtime configuration (validated)
 *   staticwebapp.config.json  Azure Static Web Apps routing, caching and security headers
 *   404.html                  pre-rendered not-found document served with HTTP 404 for unknown paths
 *   sitemap.xml               the ten public pages
 *   robots.txt                the same policy, pointing at this deployment's sitemap
 *   llms.txt                  plain-text summary for AI crawlers
 *
 *   tsx render.ts --out <staged-dist-dir> [--expect-environment production]
 *
 * Reads MVS_* variables from the process environment (see runtime-config.ts). Exits non-zero, naming every problem
 * (never echoing values), when the configuration is incomplete or invalid.
 */
import { readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import { NOT_FOUND_FILE, renderNotFoundPage } from './not-found-page.ts';
import { renderRuntimeConfig } from './runtime-config.ts';
import { renderLlmsTxt, renderRobots, renderSitemap } from './sitemap.ts';
import { buildStaticWebAppConfig } from './static-web-app-config.ts';

const { values } = parseArgs({
  options: { out: { type: 'string' }, 'expect-environment': { type: 'string' } },
});
if (!values.out) {
  console.error('Usage: render.ts --out <dir> [--expect-environment <name>]');
  process.exit(2);
}

const result = renderRuntimeConfig(process.env);
if (!result.ok) {
  console.error(`Runtime configuration is invalid:\n  ${result.issues.join('\n  ')}`);
  process.exit(1);
}
const expected = values['expect-environment'];
if (expected && result.config.environment !== expected) {
  console.error(
    `MVS_ENVIRONMENT is "${result.config.environment}" but this deployment targets "${expected}".`,
  );
  process.exit(1);
}

/** The hashed stylesheet Vite emitted for the not-found document (`assets/not-found-<hash>.css`). */
function findNotFoundStylesheet(out: string): string {
  const assets = join(out, 'assets');
  const match = readdirSync(assets).find((name) => /^not-found-.*\.css$/.test(name));
  if (!match) throw new Error(`No not-found stylesheet in ${assets} (run npm run web:build first)`);
  return `/assets/${match}`;
}

writeFileSync(join(values.out, 'config.json'), `${JSON.stringify(result.raw, null, 2)}\n`);
writeFileSync(join(values.out, 'sitemap.xml'), renderSitemap(result.siteUrl));
writeFileSync(join(values.out, 'robots.txt'), renderRobots(result.siteUrl));
writeFileSync(join(values.out, 'llms.txt'), renderLlmsTxt(result.siteUrl));
writeFileSync(
  join(values.out, NOT_FOUND_FILE),
  renderNotFoundPage({ stylesheetHref: findNotFoundStylesheet(values.out) }),
);
writeFileSync(
  join(values.out, 'staticwebapp.config.json'),
  `${JSON.stringify(buildStaticWebAppConfig(result.config), null, 2)}\n`,
);

const { config } = result;
console.log(`Rendered ${config.environment} configuration for ${result.siteUrl}`);
console.log(`  API            ${config.apiBaseUrl}`);
console.log(`  Sign-in        ${config.auth.mode}`);
console.log(
  `  Telemetry      ${config.telemetry.enabled ? `on (sample ${config.telemetry.sampleRate})` : 'off'}`,
);
const flags = Object.entries(config.featureFlags).filter(([, on]) => on);
console.log(`  Feature flags  ${flags.map(([name]) => name).join(', ') || 'none'}`);
