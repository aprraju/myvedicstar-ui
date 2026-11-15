/**
 * Renders `404.html` for a deployment. Azure Static Web Apps serves that file, with HTTP 404, for any path the SPA
 * router does not own (see `navigationFallback` + `responseOverrides` in static-web-app-config.ts), so an unknown URL
 * is a real 404 with a real not-found document instead of the app shell at 200.
 *
 * The document is self-contained: no script tag, no environment values, and a single hashed stylesheet from
 * `/assets/`. The 404 page needs no JavaScript, so it renders even when a crawler does not run any.
 */
import { NOT_FOUND_FILE } from '../../../../apps/web/src/shared/routing/served-routes.ts';
import { en } from '../../../../packages/localization/src/catalogs/en.ts';

const messages = en.pages.notFound;
const SITE_NAME = en.app.name;

const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function renderNotFoundPage(options: { stylesheetHref: string }): string {
  const title = messages.title;
  const body = messages.body;
  return `<!doctype html>
<html lang="en" dir="ltr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="color-scheme" content="light dark" />
    <meta name="robots" content="noindex" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="${escapeHtml(options.stylesheetHref)}" />
    <title>${escapeHtml(title)} · ${escapeHtml(SITE_NAME)}</title>
  </head>
  <body>
    <main class="not-found-main" aria-labelledby="not-found-title">
      <h1 id="not-found-title" class="not-found-title">${escapeHtml(title)}</h1>
      <p class="not-found-body">${escapeHtml(body)}</p>
      <a class="not-found-action" href="/">${escapeHtml(messages.action)}</a>
    </main>
  </body>
</html>
`;
}

export { NOT_FOUND_FILE };
