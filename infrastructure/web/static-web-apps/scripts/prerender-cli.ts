/**
 * Pre-renders the public pages into a built web artifact (SEO-3A).
 *
 *   tsx prerender-cli.ts [dist-dir=apps/web/dist]
 *
 * Runs as its own build step, between `web:build` and `web:validate-build`, so the artifact CI validates is the artifact
 * that deploys. `render.ts` calls the same functions during deployment staging.
 *
 * The canonical origin is the public www site, never `location.origin`: canonical and Open Graph URLs must be absolute
 * and stable regardless of how the artifact is served.
 */
import { readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import { NOT_FOUND_FILE, renderNotFoundPage } from './not-found-page.ts';
import { prerenderPublicPages } from './prerender.ts';

const { positionals } = parseArgs({ allowPositionals: true });
const dist = positionals[0] ?? 'apps/web/dist';
const SITE_URL = process.env.SITE_URL ?? 'https://www.myvedicstar.com';

/** The not-found stylesheet comes from the build (a hashed asset), never a hardcoded name. */
function findNotFoundStylesheet(out: string): string {
  const assets = join(out, 'assets');
  const match = readdirSync(assets).find((name) => /^not-found-.*\.css$/.test(name));
  if (!match) throw new Error(`No not-found stylesheet in ${assets} (run the web build first)`);
  return `/assets/${match}`;
}

try {
  const { files } = prerenderPublicPages(dist, SITE_URL);
  // The 404 document belongs to the same artifact: unknown paths must ship a real page, not the shell.
  writeFileSync(
    join(dist, NOT_FOUND_FILE),
    renderNotFoundPage({ stylesheetHref: findNotFoundStylesheet(dist) }),
  );
  console.log(`Pre-rendered ${files.length} public pages into ${dist} (${SITE_URL})`);
} catch (error) {
  console.error(
    `Pre-render failed for ${dist}:\n  ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
}
