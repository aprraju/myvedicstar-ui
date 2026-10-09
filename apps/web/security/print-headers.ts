/**
 * Prints the security headers for a deployed environment, derived from that environment's config.json:
 *   npm run security:headers -w @myvedicstar/web -- path/to/config.json
 * Feed the output into the CDN / Azure Front Door rule set (docs/deployment/web-static-hosting.md).
 */
import { readFileSync } from 'node:fs';

import { externalOrigins, parseAppConfig } from '@myvedicstar/config';

import { buildSecurityHeaders } from './headers.ts';

const path = process.argv[2] ?? 'public/config.json';
const result = parseAppConfig(JSON.parse(readFileSync(path, 'utf8')));
if (!result.ok) {
  console.error(`Invalid config ${path}:\n  ${result.issues.join('\n  ')}`);
  process.exit(1);
}

const { config } = result;
const headers = buildSecurityHeaders({
  connectSrc: externalOrigins(config),
  hsts: config.environment !== 'local',
  upgradeInsecureRequests: config.environment !== 'local',
});
console.log(JSON.stringify(headers, null, 2));
