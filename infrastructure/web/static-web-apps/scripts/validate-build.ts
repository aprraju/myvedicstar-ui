/**
 * Production build gate for the web SPA. Runs in CI after `npm run web:build` and again on the staged content right
 * before every deployment.
 *
 *   tsx validate-build.ts [dist-dir=apps/web/dist] [--staged]
 *
 * Fails when the build:
 * - is missing index.html or its hashed entry assets;
 * - contains inline <script> blocks, eval/new Function (the CSP forbids both) or public source maps;
 * - contains anything that looks like a secret (private keys, storage keys, SAS tokens, client secrets);
 * - has environment-specific values baked in (the same artifact must be promotable to every environment);
 * - exceeds the JavaScript size budget (gzip).
 * With --staged it also requires the per-environment config.json and staticwebapp.config.json.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parseArgs } from 'node:util';
import { gzipSync } from 'node:zlib';

import { publicPageMetadata } from '../../../../apps/web/src/shared/seo/page-metadata.ts';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { staged: { type: 'boolean', default: false } },
});
const dist = positionals[0] ?? 'apps/web/dist';

/** Gzipped JavaScript budgets in KiB; raise deliberately, in review, when a feature needs it. */
const ENTRY_BUDGET_KIB = Number(process.env.MVS_BUDGET_ENTRY_KIB ?? 150);
const TOTAL_BUDGET_KIB = Number(process.env.MVS_BUDGET_TOTAL_KIB ?? 400);

const SECRET_PATTERNS: [string, RegExp][] = [
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/],
  ['storage account key', /AccountKey=[A-Za-z0-9+/=]{20,}/],
  ['shared access key', /SharedAccessKey=[A-Za-z0-9+/=]{20,}/],
  ['SAS token', /[?&]sig=[A-Za-z0-9%+/=]{20,}/],
  ['client secret', /client_secret["']?\s*[:=]\s*["'][A-Za-z0-9~._-]{20,}["']/i],
  ['Entra client secret value', /\b[A-Za-z0-9_~.-]{3}\dQ~[A-Za-z0-9_~.-]{31,34}\b/],
  ['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{36,}\b/],
];

/**
 * Values that only make sense in one environment; they must come from config.json, never the bundle. Libraries use
 * `http://localhost` (no port) as a URL-parsing base, so only URLs with a port count.
 */
const ENVIRONMENT_PATTERNS: [string, RegExp][] = [
  ['localhost URL', /https?:\/\/(?:localhost|127\.0\.0\.1):\d+/],
  ['Entra External ID authority', /[a-z0-9-]+\.ciamlogin\.com/i],
  ['Static Web Apps host', /[a-z0-9-]+\.azurestaticapps\.net/i],
  [
    'Application Insights endpoint',
    /[a-z0-9-]+\.applicationinsights\.azure\.com|InstrumentationKey=[0-9a-f]{8}-/i,
  ],
  ['Azure API host', /[a-z0-9-]+\.(?:azurewebsites\.net|azure-api\.net|azurecontainerapps\.io)/i],
];

const failures: string[] = [];
const fail = (message: string) => failures.push(message);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

let files: string[] = [];
try {
  files = walk(dist);
} catch {
  console.error(`No build at ${dist} (run npm run web:build)`);
  process.exit(1);
}
const rel = (path: string) => relative(dist, path).replaceAll('\\', '/');
const textFile = /\.(?:html|js|mjs|css|json|svg|txt|xml|webmanifest)$/;

// index.html: present, external module scripts only, references assets that exist.
const indexPath = join(dist, 'index.html');
let indexHtml = '';
try {
  indexHtml = readFileSync(indexPath, 'utf8');
} catch {
  fail('index.html is missing');
}
for (const match of indexHtml.matchAll(/<script\b([^>]*)>/gi)) {
  const attrs = match[1] ?? '';
  // A typed JSON-LD block is data, not executable script: CSP allows it and the head contract needs it.
  if (!/\bsrc=/.test(attrs) && !/type="application\/ld\+json"/i.test(attrs))
    fail('index.html contains an inline <script> (blocked by the CSP)');
}
for (const match of indexHtml.matchAll(/(?:src|href)="\/(assets\/[^"]+)"/g)) {
  if (!files.some((file) => rel(file) === match[1])) fail(`index.html references missing ${match[1]}`);
}
if (/\son[a-z]+=/i.test(indexHtml)) fail('index.html contains an inline event handler (blocked by the CSP)');

// Un-staged build: the shell has no per-page head contract yet (render.ts writes it per page at deploy time). The
// canonical/description checks below therefore belong to the staged gate only.

/**
 * Pre-rendered public pages (SEO-3A): each must exist, carry the head contract, and contain real body text — that is the
 * whole point, so a missing or hollow page fails the build rather than shipping silently.
 *
 * Staged content only. The raw Vite build (`apps/web/dist`) holds just the shell; render.ts creates these files during
 * the deployment staging step, so requiring them of the un-staged build would reject a perfectly good artifact.
 */
for (const meta of values.staged ? publicPageMetadata : []) {
  const name = meta.path === '/' ? 'index.html' : `${meta.path.replace(/^\//, '')}/index.html`;
  let html: string;
  try {
    html = readFileSync(join(dist, name), 'utf8');
  } catch {
    fail(`pre-rendered page ${name} is missing`);
    continue;
  }
  if (!/<h1[^>]*>\s*\S/i.test(html)) fail(`${name}: no non-empty <h1>`);
  if (!/<link[^>]+rel="canonical"[^>]+href="https:\/\/[^"]+"/i.test(html))
    fail(`${name}: no absolute canonical link`);
  if (!/<meta[^>]+name="description"[^>]+content="[^"]{20,}"/i.test(html))
    fail(`${name}: no page description`);
  if (!/<div id="root">[\s\S]*<main[\s\S]*<p>/i.test(html)) fail(`${name}: #root has no page body text`);
  // Only a typed JSON-LD block may be inline; the CSP has no 'unsafe-inline' for script.
  for (const match of html.matchAll(/<script\b([^>]*)>/gi)) {
    const attrs = match[1] ?? '';
    if (!/type="application\/ld\+json"/i.test(attrs) && !/\bsrc=/.test(attrs))
      fail(`${name}: inline <script> (blocked by the CSP)`);
  }
}

// 404.html: a real document with no script (served for unknown paths), and its stylesheet must exist.
try {
  const notFoundHtml = readFileSync(join(dist, '404.html'), 'utf8');
  if (/<script\b/i.test(notFoundHtml))
    fail('404.html contains a <script> (it must render without JavaScript)');
  if (!/<meta\s+name="robots"\s+content="noindex"/i.test(notFoundHtml))
    fail('404.html must declare <meta name="robots" content="noindex">');
  for (const match of notFoundHtml.matchAll(/href="\/(assets\/[^"]+\.css)"/g)) {
    if (!files.some((file) => rel(file) === match[1])) fail(`404.html references missing ${match[1]}`);
  }
} catch {
  if (values.staged) fail('404.html is missing from the staged content');
}

const deployingSourceMaps = files.filter((file) => file.endsWith('.map'));
if (values.staged && deployingSourceMaps.length)
  fail(`source maps would be published: ${deployingSourceMaps.map(rel).join(', ')}`);

let totalGzip = 0;
let entryGzip = 0;
const entryScript = /<script[^>]+src="\/(assets\/[^"]+\.js)"/.exec(indexHtml)?.[1];

for (const file of files) {
  const name = rel(file);
  if (!textFile.test(name)) continue;
  const content = readFileSync(file, 'utf8');
  for (const [label, pattern] of SECRET_PATTERNS) {
    if (pattern.test(content)) fail(`${name}: looks like it contains a ${label}`);
  }
  // config.json is the one place environment values belong (staged deployments only).
  if (name !== 'config.json' && name !== 'staticwebapp.config.json') {
    for (const [label, pattern] of ENVIRONMENT_PATTERNS) {
      if (pattern.test(content))
        fail(`${name}: contains a hard-coded ${label}; move it to runtime configuration`);
    }
  }
  if (/\.m?js$/.test(name)) {
    if (/\bnew Function\(|[^a-zA-Z_.$]eval\(/.test(content))
      fail(`${name}: uses eval/new Function (blocked by the CSP)`);
    if (/\/\/# sourceMappingURL=/.test(content)) fail(`${name}: references a public source map`);
    const size = gzipSync(content).length;
    totalGzip += size;
    if (name === entryScript) entryGzip = size;
  }
}

const kib = (bytes: number) => Math.round((bytes / 1024) * 10) / 10;
if (!entryScript) fail('index.html does not load a hashed entry script from /assets/');
if (kib(entryGzip) > ENTRY_BUDGET_KIB)
  fail(`entry script is ${kib(entryGzip)} KiB gzip (budget ${ENTRY_BUDGET_KIB})`);
if (kib(totalGzip) > TOTAL_BUDGET_KIB)
  fail(`JavaScript totals ${kib(totalGzip)} KiB gzip (budget ${TOTAL_BUDGET_KIB})`);

if (values.staged) {
  for (const required of ['config.json', 'staticwebapp.config.json', '404.html']) {
    if (!files.some((file) => rel(file) === required)) fail(`${required} is missing from the staged content`);
  }
}

if (failures.length) {
  console.error(`Build validation failed (${dist}):\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log(
  `Build validation passed: ${files.length} files, entry ${kib(entryGzip)} KiB gzip, JavaScript ${kib(totalGzip)} KiB gzip.`,
);
