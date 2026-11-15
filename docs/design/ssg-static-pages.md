# Design — SSG / prerender for the ten public pages (myvedicstar-ui#7, SEO-3A)

Status: **DESIGN CONFIRMATION — approved approach, no implementation in this note.**
Date: 2026-11-15 · Repo: \`aprraju/myvedicstar-ui\`
Owner decision: A1 resolved — SSG/prerender approved. Unblocks SEO-3A AC1–AC3 and the
"server HTML" clauses of SEO-4/5/6/8.

---

## 1. Approach — confirmed, with one correction

**Confirmed: a build-time static render script, not a framework swap.**

Do **not** adopt vite-plugin-ssr / Vike. Vike takes over routing, the entry point
and the hydration contract, which would rewrite a router, app shell, i18n and
auth stack that already pass their tests — for ten static pages. That is the
largest possible change for the smallest possible gain.

**Reuse what exists**, because it is already the right shape:

| Existing asset                                                         | Reused as                                                                                                                                                                         |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| \`infrastructure/web/static-web-apps/scripts/render.ts\`               | extended: the one place that already writes per-deployment files into the staged dist (\`sitemap.xml\`, \`robots.txt\`, \`llms.txt\`, \`404.html\`, \`staticwebapp.config.json\`) |
| \`scripts/not-found-page.ts\`                                          | the working pattern: build a complete HTML document, link the hashed stylesheet, no JavaScript                                                                                    |
| \`apps/web/src/shared/seo/page-metadata.ts\`                           | the only source of title/description; already imported by \`sitemap.ts\`                                                                                                          |
| \`apps/web/src/features/content/markdown.tsx\` \`parseMarkdown\`       | parses the seven legal/policy Markdown files today; reuse for text extraction                                                                                                     |
| \`apps/web/src/shared/routing/served-routes.ts\` \`PUBLIC_PAGE_PATHS\` | the route list; already drives both the SWA config and the 404 document                                                                                                           |
| \`scripts/validate-build.ts\`                                          | extended to assert the new HTML files                                                                                                                                             |

**Correction to the brief:** it is _not_ a React render. \`main.tsx\` boots the app
client-side and every page is a lazily loaded chunk behind auth-aware providers;
there is no server entry to call. The script therefore emits **the same document
contract the app produces in the browser** (title, meta, canonical, OG, JSON-LD,
H1 + body text) without React — using the shared metadata module and the shared
Markdown parser. No new runtime dependency, no headless browser, no SSR bundle.

The real page HTML (header, footer, full component styling) still comes from the
SPA after hydration. What ships pre-rendered is what crawlers and
JavaScript-disabled clients need. This satisfies SEO-3A AC1–AC3 as written
("server response contains title, description, canonical, OG, JSON-LD and the
page's H1 and text"); it does not attempt to ship the full visual layout
pre-rendered, which nothing in the ACs requires.

---

## 2. Sources and discovery

**Markdown lives at \`apps/web/src/content/pages/\*.md\`** (7 files today), imported
\`?raw\` by \`features/content/documents.ts\`. \`/#\` heading 1 is the page title.

Coverage of the ten public pages:

| Route                                                                                                      | Source of body text                                                                                                                                                              |
| ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| \`/about\`, \`/how-it-works\`, \`/privacy\`, \`/terms\`, \`/disclaimer\`, \`/cookies\`, \`/accessibility\` | the matching \`.md\` file (7 of 10)                                                                                                                                              |
| \`/\`, \`/contact\`, \`/help\`                                                                             | no Markdown today — prerender a short factual lead paragraph from the metadata registry contact/help copy; **do not invent marketing copy** (a content decision, raised as OQ-1) |

**Discovery is data-driven, never a hardcoded list**:

1. iterate \`PUBLIC_PAGE_PATHS\` from \`served-routes.ts\` (10 entries);
2. look up each path in \`publicPageMetadata\` (\`pageMetadataFor(path)\`) for title + description;
3. resolve the Markdown file from a small explicit map (route → \`documents\` key), which
   mirrors the existing \`documents.ts\` keys;
4. fail the build if any public path has no metadata, no body source, or a Markdown
   file whose H1 disagrees with the page metadata title's subject (a warning, not fatal,
   because titles are SEO-tuned and H1 is editorial).

---

## 3. Output document contract

For each of the ten routes write \`<route>/index.html\` (and \`index.html\` for \`/\`):

\`\`\`html
<!doctype html>
<html lang="en" dir="ltr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>{page.title} · My Vedic Star</title>            <!-- matches SiteLayout's format -->
    <meta name="description" content="{page.description}" />
    <link rel="canonical" href="{siteUrl}{path == '/' ? '/' : path}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="My Vedic Star" />
    <meta property="og:title" content="{page.title}" />
    <meta property="og:description" content="{page.description}" />
    <meta property="og:url" content="{canonical}" />
    <meta property="og:image" content="{siteUrl}/og-image.png" />   <!-- only if the asset exists; see OQ-2 -->
    <meta name="twitter:card" content="summary_large_image" />
    <script type="application/ld+json">{JSON-LD from StructuredData rules}</script>
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <!-- plus the same theme-color / color-scheme tags as index.html -->
  </head>
  <body>
    <noscript>My Vedic Star needs JavaScript to show your Panchang.</noscript>
    <div id="root">
      <main id="main-content">
        <h1>{H1 from the Markdown, or the page title}</h1>
        <p>…</p>  <!-- the page's text: paragraphs, h2, lists -->
      </main>
    </div>
    <script type="module" src="/assets/index-{hash}.js" crossorigin></script>
  </body>
</html>
\`\`\`

Rules:

- **The script tag and the \`assets/index-\*.js\` name come from the built \`index.html\`**
  (read it, inject into the shell) — never hardcoded, or a hashed-chunk rename
  silently produces a page that never hydrates.
- **CSS:** link the same hashed entry stylesheet the build produced, so text is
  legible before hydration. No inline styles, no \`<style>\` block (CSP).
- **No inline script anywhere** — \`validate-build.ts\` already forbids it, and the
  CSP has no \`'unsafe-inline'\`.
- **JSON-LD:** reuse \`apps/web/src/shared/seo/StructuredData.tsx\` values; the script
  must emit the same object the app does for the page (Organization + WebSite on \`/\`,
  WebPage elsewhere), serialised once. Keep it a plain \`application/ld+json\` block —
  permitted by CSP, and \`validate-build.ts\` must be taught to allow exactly this one
  script type.

### 3.1 Hydration without mismatch

The prerendered \`#root\` content is **throwaway scaffolding**, not hydrate input:

- \`main.tsx\` calls \`bootstrap(container)\` → \`createRoot(...).render(...)\` (client
  render, not \`hydrateRoot\`). React creates a fresh tree and discards the existing
  children, so no markup comparison happens and no mismatch is possible.
- **Requirement:** \`bootstrap\` must keep using \`createRoot\`. If anyone switches to
  \`hydrateRoot\`, the scaffolding must be byte-identical to React output — this
  design forbids that switch for these files.
- **Visual flicker:** the prerendered text may be unstyled-list-like for one frame.
  Mitigations: link the built stylesheet in the head (already required), keep the
  prerendered markup to plain semantic elements styled by the same global CSS, and
  wrap it in \`<div id="root">\` so first paint matches the container's box.
- \`<noscript>\` content stays as today; it is honest for a JS-required app.

---

## 4. noindex lock — /calendar, /festivals, /good-time

These three are **gated** (\`GATED_PATHS\` in \`served-routes.ts\`) and **must not** be
prerendered. Rules, in order of enforcement:

1. **Not generated.** The script iterates \`PUBLIC_PAGE_PATHS\` only. \`GATED_PATHS\`
   must never be added to that array (it is a \`const\` tuple; add a test that
   asserts the two sets are disjoint).
2. **Not in the sitemap.** \`renderSitemap\` already maps \`publicPageMetadata\`, which
   contains only the ten. Add a test asserting no gated path appears in
   \`sitemap.xml\` output.
3. **Explicit noindex at the edge.** Add to \`buildStaticWebAppConfig\` a route rule
   for each gated path (and \`/calendar/*\` prefix) setting
   \`X-Robots-Tag: noindex, nofollow\`. Today **no noindex exists anywhere** in the
   web app — this is a gap to close, not something to preserve.
4. **No self-referential canonical.** The SPA must not emit a \`<link rel="canonical">\`
   for a gated path. Add a guard in the metadata applier: canonical is written only
   for paths in \`publicPageMetadata\`.
5. **Serve the shell with 200, but unindexable.** Gated routes keep the existing
   \`navigationFallback\`/SPA route rewrite (they are not 404s), with the
   \`X-Robots-Tag\` header from rule 3.

---

## 5. Acceptance test — proving "server HTML"

The claim is _content without JavaScript_, so the test must not run JavaScript:

\`\`\`bash

# 1. Content is in the first response, no JS execution.

curl -s https://www.myvedicstar.com/about | grep -qi '<h1>About Us</h1>'
curl -s https://www.myvedicstar.com/about | grep -qi 'name="description"'
curl -s https://www.myvedicstar.com/about | grep -qi 'rel="canonical"'
curl -s https://www.myvedicstar.com/about | grep -qi 'application/ld+json'

# 2. Same, for every one of the ten.

for p in / /about /how-it-works /contact /help /privacy /terms /disclaimer /cookies /accessibility; do
curl -s "https://www.myvedicstar.com$p" | grep -q '<h1' || { echo "MISSING H1 $p"; exit 1; }
done

# 3. noindex lock holds.

curl -sI https://www.myvedicstar.com/calendar | grep -qi 'x-robots-tag: noindex'
curl -s https://www.myvedicstar.com/sitemap.xml | grep -c '<loc>' # expect 10
curl -s https://www.myvedicstar.com/sitemap.xml | grep -qiE 'calendar|festivals|good-time' && exit 1
\`\`\`

Plus an automated variant in \`smoke-http.ts\` (runs at deploy): for each public path,
assert HTTP 200, \`content-type: text/html\`, the \`<h1>\` present, and the canonical
equal to \`siteUrl + path\` — using plain HTTP fetch, never a browser.

Manual proof for a human: open DevTools → disable JavaScript → load \`/about\` → the
heading and body text are visible.

---

## 6. What will break, and what to change

| #   | Interaction                                                      | Risk                                                                                                                                         | Change required                                                                                                                                                                                                                                |
| --- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | \`navigationFallback\` rewrites unknown paths to \`/index.html\` | **High.** A SPA fallback that rewrites \`/about\` would shadow the prerendered \`/about/index.html\` and return the shell (200, no content). | Keep the existing explicit \`routes\` entries for \`PUBLIC_PAGE_PATHS\` but **remove the \`rewrite: '/index.html'\`** for them — SWA serves the real file at that path automatically. Only gated routes keep the rewrite.                      |
| 2   | \`responseOverrides.404\`                                        | Low. Real files bypass the 404 override.                                                                                                     | None; verify \`/404.html\` still serves for unknown paths.                                                                                                                                                                                     |
| 3   | SWA serves \`/about\` from \`about/index.html\`                  | Medium. SWA maps \`/about\` → \`about/index.html\` only when the file exists; trailing-slash requests \`/about/\` also resolve.              | Confirm both \`/about\` and \`/about/\` return the prerendered document; canonical must be the non-slash form.                                                                                                                                 |
| 4   | \`Cache-Control\` per route                                      | Medium. Prerendered HTML changing per deploy must revalidate.                                                                                | The existing \`/*\` → \`no-cache\` rule covers them; do not add an immutable rule for HTML.                                                                                                                                                    |
| 5   | \`validate-build.ts\` inline-script ban                          | **Blocks the build** if JSON-LD is treated as inline script.                                                                                 | Allow \`application/ld+json\` explicitly; keep HTML generation inside the staging step (post-Vite), as \`404.html\` already is.                                                                                                                |
| 6   | Artifact size / file count                                       | Low. Ten small HTML files.                                                                                                                   | None; check \`TOTAL_BUDGET_KIB\` is unaffected (HTML is not JS).                                                                                                                                                                               |
| 7   | \`?raw\` Markdown imports in the staging script                  | Medium. The script runs under \`tsx\`, outside Vite, so \`?raw\` does not work.                                                              | Read the \`.md\` files with \`readFileSync\` from \`apps/web/src/content/pages/\` — do not import \`documents.ts\`. Reuse \`parseMarkdown\` only if it is import-safe outside the bundler (it is a pure function; verify no JSX import chain). |
| 8   | \`SiteLayout\` sets \`document.title\` after hydration           | Low. It may overwrite the prerendered title with the i18n-derived title.                                                                     | Confirm \`pages.*.title\` i18n values equal \`page.title\` from the registry, or make \`SiteLayout\` prefer the registry value for public paths. Otherwise the browser title flickers.                                                         |
| 9   | HSTS + \`upgrade-insecure-requests\`                             | None.                                                                                                                                        | No change.                                                                                                                                                                                                                                     |
| 10  | SWA custom-domain \`www\` only                                   | None.                                                                                                                                        | Canonical must use \`siteUrl\` from runtime config (www), never \`location.origin\`.                                                                                                                                                           |

---

## 7. Implementation brief (hand to ui-developer)

1. **New** \`infrastructure/web/static-web-apps/scripts/prerender.ts\`: for each \`PUBLIC_PAGE_PATHS\`, compose the document from \`pageMetadataFor(path)\` + Markdown body (read via \`readFileSync\` from \`content/pages/\`, parsed with \`parseMarkdown\`), injecting the built \`assets/index-*.js\` and entry stylesheet from the dist. Write \`<path>/index.html\`. Fail the build on any missing metadata, missing body source or missing asset.
2. **Wire it** into \`render.ts\` (same staging step as \`404.html\`), so \`deploy.sh\` and CI get it with no new step; add \`--skip-prerender\` only for local debugging.
3. **Fix \`static-web-app-config.ts\`**: \`PUBLIC_PAGE_PATHS\` route rules drop \`rewrite: '/index.html'\`; gated routes keep it and gain \`X-Robots-Tag: noindex, nofollow\`.
4. **Tests**: extend \`validate-build.ts\` (allow \`application/ld+json\`, assert each prerendered file exists and contains \`<h1\`, canonical, description), \`smoke-http.ts\` (deploy-time per-path assertions from §5), and add the disjointness/sitemap tests from §4. Update \`sitemap.test.ts\` if it asserts the old rewrite config.
5. **No framework change, no new dependency, no Terraform, no prod mutation.** Branch → PR → review; merge only with the §5 curl evidence pasted in the PR.

## 8. Open questions (do not block the design)

- **OQ-1** Body copy for \`/\`, \`/contact\`, \`/help\` (no Markdown today): approve short factual leads, or accept metadata-only bodies.
- **OQ-2** \`og:image\`: only emit if a real \`/og-image.png\` exists and is in the CSP \`img-src 'self'\` path — otherwise omit the tag rather than ship a 404 image.
- **OQ-3** \`/help\` content: is it a document page or a UI page? It sits in \`PUBLIC_PAGE_PATHS\` but is not in the Markdown set.
