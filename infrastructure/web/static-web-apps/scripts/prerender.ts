/**
 * Pre-renders the ten public content pages into real static HTML at build time (SEO-3A, design:
 * docs/design/ssg-static-pages.md).
 *
 * Why: the SPA ships one 1.4 KB shell for every URL, so a crawler that does not run JavaScript sees no content. Each
 * public page now gets `<path>/index.html` carrying its head contract (title, description, canonical, OG tags) and the
 * page's text inside `#root`.
 *
 * The markup inside `#root` is scaffolding, not hydration input: `bootstrap` uses `createRoot`, which discards it and
 * draws a fresh tree, so no mismatch is possible. Never switch these routes to `hydrateRoot`.
 *
 * Everything is data-driven: paths come from `served-routes.ts`, copy from the page-metadata registry, and the script
 * and stylesheet hashes from the build's own `index.html`. Nothing is hardcoded, so a changed chunk name cannot produce
 * a page that never hydrates.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { parseMarkdown } from '../../../../apps/web/src/features/content/markdown-parser.ts';
import { PUBLIC_PAGE_PATHS } from '../../../../apps/web/src/shared/routing/served-routes.ts';
import { publicPageMetadata } from '../../../../apps/web/src/shared/seo/page-metadata.ts';

const SITE_NAME = 'My Vedic Star';
const CONTENT_DIR = 'apps/web/src/content/pages';

/**
 * Route → Markdown file under `content/pages/`. Mirrors the keys in `features/content/documents.ts`, which cannot be
 * imported here: it uses `?raw` imports that only the bundler understands.
 */
const CONTENT_SOURCES: Record<string, string> = {
  '/about': 'about-us.md',
  '/how-it-works': 'how-it-works.md',
  '/privacy': 'privacy-policy.md',
  '/terms': 'terms-of-use.md',
  '/disclaimer': 'disclaimer.md',
  '/cookies': 'cookie-policy.md',
  '/accessibility': 'accessibility.md',
};

/**
 * Pages with no Markdown source. Their body is the page description from the registry — factual copy already reviewed
 * for that page — rather than invented marketing text (design OQ-1/OQ-3).
 */
const LEAD_ONLY_PATHS = new Set(['/', '/contact', '/help']);

class PrerenderError extends Error {}

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** `**bold**` / `*italic*` → tags; the text itself is always escaped first. */
function inline(text: string): string {
  return escapeHtml(text)
    .split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
    .map((part) => {
      if (part.startsWith('**') && part.endsWith('**')) return `<strong>${part.slice(2, -2)}</strong>`;
      if (part.startsWith('*') && part.endsWith('*') && part.length > 2)
        return `<em>${part.slice(1, -1)}</em>`;
      return part;
    })
    .join('');
}

interface PageBody {
  h1: string;
  html: string;
}

/** Body markup for one route: the Markdown document when one exists, otherwise the registry description as a lead. */
function pageBody(path: string, description: string): PageBody {
  const file = CONTENT_SOURCES[path];
  if (!file) {
    if (!LEAD_ONLY_PATHS.has(path)) throw new PrerenderError(`No body source for public page ${path}`);
    return { h1: '', html: `<p>${escapeHtml(description)}</p>` };
  }

  const sourcePath = join(CONTENT_DIR, file);
  if (!existsSync(sourcePath)) throw new PrerenderError(`Missing Markdown source ${sourcePath} for ${path}`);

  const blocks = parseMarkdown(readFileSync(sourcePath, 'utf8'));
  const heading = blocks.find((block) => block.type === 'heading' && block.level === 1);
  const h1 = heading && heading.type === 'heading' ? heading.text : '';
  if (!h1) throw new PrerenderError(`${sourcePath} has no level-1 heading to use as the page H1`);

  const html = blocks
    .filter((block) => !(block.type === 'heading' && block.level === 1))
    .map((block) => {
      if (block.type === 'heading') {
        const tag = `h${block.level}`;
        return `<${tag}>${inline(block.text)}</${tag}>`;
      }
      if (block.type === 'list') {
        return `<ul>${block.items.map((item) => `<li>${inline(item)}</li>`).join('')}</ul>`;
      }
      return `<p>${inline(block.text)}</p>`;
    })
    .join('\n        ');

  return { h1, html };
}

/** The build's own entry script and stylesheet, read from the emitted `index.html` — never hardcoded. */
function readBuildAssets(dist: string): { script: string; stylesheet: string | null } {
  const indexPath = join(dist, 'index.html');
  if (!existsSync(indexPath))
    throw new PrerenderError(`No build at ${indexPath} (run npm run web:build first)`);
  const indexHtml = readFileSync(indexPath, 'utf8');

  // Attribute order is not guaranteed (Vite emits cross|src vs src|crossorigin), so match the src attribute itself.
  const scriptMatch = /<script\b[^>]*\bsrc="(\/assets\/[^"]+\.js)"[^>]*>/.exec(indexHtml);
  if (!scriptMatch?.[1])
    throw new PrerenderError('index.html does not load a hashed entry script from /assets/');

  const styleMatch = /<link\b(?=[^>]*\brel="stylesheet")[^>]*\bhref="(\/assets\/[^"]+\.css)"[^>]*>/.exec(
    indexHtml,
  );
  if (!styleMatch?.[1])
    throw new PrerenderError('index.html does not link a hashed stylesheet from /assets/');
  for (const asset of [scriptMatch[1], styleMatch[1]]) {
    if (!existsSync(join(dist, asset.replace(/^\//, ''))))
      throw new PrerenderError(`index.html references ${asset}, which is not in the build`);
  }
  return { script: scriptMatch[1], stylesheet: styleMatch[1] };
}

/**
 * JSON-LD for one page: Organization + WebSite on the homepage (the same entities the SPA writes there), and a WebPage
 * elsewhere describing the page itself. Serialised once as a plain `application/ld+json` block.
 */
function pageStructuredData(options: {
  path: string;
  title: string;
  description: string;
  canonical: string;
  siteUrl: string;
}): string {
  const { path, title, description, canonical, siteUrl } = options;
  const origin = siteUrl.replace(/\/+$/, '');
  const graph =
    path === '/'
      ? [
          {
            '@type': 'Organization',
            '@id': `${origin}/#organization`,
            name: SITE_NAME,
            url: `${origin}/`,
            logo: `${origin}/favicon.svg`,
          },
          {
            '@type': 'WebSite',
            '@id': `${origin}/#website`,
            name: SITE_NAME,
            url: `${origin}/`,
            inLanguage: 'en',
            publisher: { '@id': `${origin}/#organization` },
            description,
          },
        ]
      : [
          {
            '@type': 'WebPage',
            '@id': `${canonical}#webpage`,
            url: canonical,
            name: `${title} · ${SITE_NAME}`,
            description,
            inLanguage: 'en',
            isPartOf: { '@id': `${origin}/#website` },
          },
        ];
  // '<' must not appear raw inside a <script> block.
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c');
}

/** One prerendered document. Pure: same inputs, same bytes. */
export function renderPage(options: {
  path: string;
  title: string;
  description: string;
  siteUrl: string;
  script: string;
  stylesheet: string;
}): string {
  const { path, title, description, siteUrl, script, stylesheet } = options;
  const canonical = new URL(path, siteUrl).href;
  const body = pageBody(path, description);
  const h1 = body.h1 || title;
  const structuredData = pageStructuredData({ path, title, description, canonical, siteUrl });
  return `<!doctype html>
<html lang="en" dir="ltr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>${escapeHtml(title)} · ${SITE_NAME}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${escapeHtml(canonical)}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${SITE_NAME}" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(canonical)}" />
    <meta name="color-scheme" content="light dark" />
    <meta name="theme-color" content="#FBFAF7" media="(prefers-color-scheme: light)" />
    <meta name="theme-color" content="#13151A" media="(prefers-color-scheme: dark)" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="${escapeHtml(stylesheet)}" />
    <script type="application/ld+json">${structuredData}</script>
    <script type="module" crossorigin src="${escapeHtml(script)}"></script>
  </head>
  <body>
    <noscript>My Vedic Star needs JavaScript to show your Panchang.</noscript>
    <div id="root">
      <main id="main-content">
        <h1>${escapeHtml(h1)}</h1>
        ${body.html}
      </main>
    </div>
  </body>
</html>
`;
}

export interface PrerenderResult {
  /** Absolute file paths written. */
  files: string[];
}

/**
 * Writes `<path>/index.html` for every public page into `out`. Fails loudly rather than skipping: a public page with no
 * metadata or no body source is a build error, not a silently missing page.
 */
export function prerenderPublicPages(out: string, siteUrl: string): PrerenderResult {
  const { script, stylesheet } = readBuildAssets(out);
  if (!stylesheet) throw new PrerenderError('No stylesheet in the build');

  // The build's own index.html is the source of the script/stylesheet tags. Read it before writing anything, so a
  // re-run over an already pre-rendered tree cannot read a page as the shell.
  const assets = { script, stylesheet };

  const publicPaths = new Set<string>(PUBLIC_PAGE_PATHS);
  const files: string[] = [];
  for (const meta of publicPageMetadata) {
    if (!publicPaths.has(meta.path))
      throw new PrerenderError(`${meta.path} has metadata but is not a public route`);
    const html = renderPage({
      path: meta.path,
      title: meta.title,
      description: meta.description,
      siteUrl,
      script: assets.script,
      stylesheet: assets.stylesheet,
    });
    // '/' writes to index.html; every other route to <path>/index.html.
    const target =
      meta.path === '/' ? join(out, 'index.html') : join(out, meta.path.replace(/^\//, ''), 'index.html');
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, html);
    files.push(target);
  }

  const missing = PUBLIC_PAGE_PATHS.filter((path) => !publicPageMetadata.some((meta) => meta.path === path));
  if (missing.length) throw new PrerenderError(`Public routes with no page metadata: ${missing.join(', ')}`);
  return { files };
}
