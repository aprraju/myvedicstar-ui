/**
 * Writes the per-environment files into a staged copy of the build:
 *   config.json               runtime configuration (validated)
 *   staticwebapp.config.json  Azure Static Web Apps routing, caching and security headers
 *
 *   tsx render.ts --out <staged-dist-dir> [--expect-environment production]
 *
 * Reads MVS_* variables from the process environment (see runtime-config.ts). Exits non-zero, naming every problem
 * (never echoing values), when the configuration is incomplete or invalid.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import { renderRuntimeConfig } from './runtime-config.ts';
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

writeFileSync(join(values.out, 'config.json'), `${JSON.stringify(result.raw, null, 2)}\n`);
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
