# Web deployment — Azure Static Web Apps

Deployment automation for the My Vedic Star web SPA. Application source lives in `apps/web`; everything that knows
about Azure, URLs and identities lives here.

```text
push to main ─► Web workflow: lint · typecheck · tests · build once · validate · E2E ─► web-dist artifact
                                                                                         │
             Web deploy workflow (GitHub environment "production", Azure OIDC) ◄─────────┘
             validate ─► render config.json + staticwebapp.config.json ─► upload ─► smoke test
```

The bundle contains no URLs, IDs or environment names (`validate-build.ts` fails the pipeline if any appear). At
startup the app loads `/config.json`, validates it (`packages/config`) and exposes it through `useServices().config`.

## Production

| Item              | Value                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------- |
| Site              | https://ashy-forest-0c732690f.1.azurestaticapps.net                                               |
| Static Web App    | `stapp-myvedicstar-prod` · `rg-myvedicstar-prod-edge-eus2` · hub subscription (Terraform-managed) |
| API               | APIM `apim-myvedicstar-prod-xw4t` (CORS allows the site origin)                                   |
| Sign-in           | Entra External ID `myvedicstarexternal`, SPA client `828e1ce9-…` (redirect URI registered)        |
| Telemetry         | `appi-myvedicstar-prod`                                                                           |
| Settings          | [`environments/production.env`](environments/production.env) (public values, committed)           |
| Deploy identity   | App registration `myvedicstar-ui` (GitHub OIDC, environment `production`)                         |
| Deploy permission | Custom role **MyVedicStar Static Web App Deployer** on the Static Web App only                    |

The Static Web App, APIM, App Insights and Entra registrations are owned by `myvedicstar-infra` (Terraform). This
pipeline only deploys content. `bicep/` and `scripts/provision.sh` are for creating a new environment outside that
Terraform; do not run them against production.

## Settings

`environments/<environment>.env` holds the deployment target and the runtime configuration. Everything in it is
**public** (the `MVS_*` values are served to browsers). Never add secrets: unknown `MVS_*` names are rejected, the
schema is strict, connection strings with keys are refused and the bundle is scanned for secret patterns.

A non-empty GitHub variable with the same name overrides the file without a commit (e.g. `MVS_FEATURE_FLAGS`,
`MVS_TELEMETRY_SAMPLE_RATE`); `.github/workflows/web-deploy.yml` lists the overridable names.

| Variable                                               | Notes                                                                        |
| ------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `AZURE_STATIC_WEB_APP_NAME`, `AZURE_RESOURCE_GROUP`    | Deployment target (not sent to browsers)                                     |
| `AZURE_STATIC_WEB_APP_SUBSCRIPTION_ID`                 | Subscription of the Static Web App (hub)                                     |
| `MVS_ENVIRONMENT`, `MVS_SITE_URL`                      | `production`; the public origin (HTTPS)                                      |
| `MVS_API_BASE_URL`                                     | APIM gateway origin                                                          |
| `MVS_API_ENDPOINT_PREFIX`                              | Route prefixed to every endpoint (APIM `/<api path>/v1` + backend `/api/v1`) |
| `MVS_API_ENDPOINTS`                                    | JSON overrides for endpoints served by another API (e.g. `authUserInfo`)     |
| `MVS_AUTH_*`                                           | Entra External ID authority, tenant, SPA client ID, API client ID            |
| `MVS_FEATURE_FLAGS`                                    | Comma separated flags to enable                                              |
| `MVS_TELEMETRY_*`, `MVS_APPINSIGHTS_CONNECTION_STRING` | Browser telemetry; the ingestion origin is added to the CSP automatically    |

All variables: `scripts/runtime-config.ts` (`RUNTIME_CONFIG_VARIABLES`).

## GitHub configuration

Repository (or `production` environment) variables:

| Variable          | Value                                                                      |
| ----------------- | -------------------------------------------------------------------------- |
| `AZURE_CLIENT_ID` | `ffebf3da-84ff-4d18-b1f9-6d4f1470067d` (app registration `myvedicstar-ui`) |
| `AZURE_TENANT_ID` | `edebf69e-344b-4b2e-b5ab-98080c7bf8fa` (workforce tenant)                  |

No secrets are needed. Recommended: Settings → Environments → `production` → required reviewers and "Deployment
branches: main" (the environment is created automatically by the first run).

Azure side (already configured):

- Federated credential `github-myvedicstar-ui-production` on `myvedicstar-ui`:
  `repo:aprraju/myvedicstar-ui:environment:production`, issuer `https://token.actions.githubusercontent.com`.
- Role assignment: **MyVedicStar Static Web App Deployer** (`Microsoft.Web/staticSites/read`,
  `Microsoft.Web/staticSites/listSecrets/action`) on `stapp-myvedicstar-prod`. The pipeline reads the deployment
  token at deploy time; nothing long-lived is stored in GitHub.

## Deploying

- **Automatic:** every push to `main` that touches the web app runs the Web workflow; after all checks pass, the same
  artifact is deployed to production.
- **Redeploy / rollback:** Actions → **Web deploy** → Run workflow → run ID of a successful **Web** run (builds are
  kept 90 days). The build is redeployed with the current settings file.
- **Settings-only change:** edit `environments/production.env` (or set a GitHub variable override) and redeploy the
  current build as above — no rebuild.
- **From a workstation** (Git Bash, signed in with `az login`):

  ```bash
  npm ci && npm run web:build
  npm run web:deploy -- --environment production \
    --env-file infrastructure/web/static-web-apps/environments/production.env --dry-run   # validate only
  ```

  Options: `--dist <dir>`, `--dry-run`, `--skip-smoke-test`, `--skip-cors-check`.

## Failure handling

| Failure                     | Effect                                                           | Action                                                                   |
| --------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Settings / build validation | Nothing deployed; every problem listed                           | Fix the setting or code; re-run                                          |
| Azure sign-in               | Nothing deployed                                                 | Check `AZURE_CLIENT_ID` / `AZURE_TENANT_ID` and the federated credential |
| Upload                      | Retried 3× (not for a rejected token); old release keeps serving | Re-run the job                                                           |
| Smoke test                  | New release live but unverified; job fails                       | Investigate, or roll back (above)                                        |

The smoke test checks: new release live, HTTP→HTTPS, security headers, caching, hidden source maps, deep links, APIM
CORS preflight from the site origin, and the Entra External ID discovery document.

## Hosting behaviour (generated staticwebapp.config.json)

- HTTPS only with HSTS; CSP without `unsafe-inline`/`unsafe-eval`, `connect-src` limited to APIM, the Entra authority
  and App Insights ingestion; `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP, CORP. Source of truth:
  `apps/web/security/headers.ts`.
- `/assets/*` immutable for a year; HTML revalidated; `/config.json` never cached.
- Deep links return `index.html` with 200; missing assets return real 404s; source maps are never published.
- Built-in Static Web Apps sign-in routes (`/.auth/login/*`) are closed.
