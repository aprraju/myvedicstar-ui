# Deployment readiness: Profile, Settings and authentication

Verified on October 13, 2026. Profile and Settings changes exist in both `myvedicstar-ui` and the sibling `myvedicstar` backend. Backend implementation follows `.github/copilot-instructions.md`: controllers delegate to public Business facades, persistence stays in Data, and Graph/GeoNames interactions use Integration boundaries.

The web and native applications provide Profile, Settings, and Logout navigation. Account identity uses the existing minimal userinfo response, with display name and email on separate lines. Profile updates preserve the existing user table; changed names retain durable backend Graph synchronization status. The manual retry control is removed from the UI. Settings use the `myvedicstarsettings` schema, account-scoped defaults and saved locations, and explicit Save. Temporary selections do not overwrite defaults. Deleting the default location clears the stored default atomically.

## Verification

| Check                                                      | Result                                                                             |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Frontend shared packages, web, native and deployment tests | 682 passed                                                                         |
| Web component tests                                        | 229 passed, included above                                                         |
| Native component tests                                     | 41 passed, included above                                                          |
| MyVedicStar solution                                       | 182 passed; PostgreSQL tests enabled                                               |
| Shared-host route and authentication tests                 | 28 passed                                                                          |
| MyVedicDay solution regression tests                       | 637 passed, including 23 shared cache tests                                        |
| Backend deployment and migration contracts                 | Passed with fake Azure commands; no Azure changes                                  |
| Published Release backend smoke                            | Passed: public probes; application and documentation routes require authentication |
| Location proxy checks                                      | Passed; mocked GeoNames                                                            |
| Web production build and staged production configuration   | Passed; JavaScript 233.8 KiB gzip                                                  |
| Packaged Authorize + Settings SQL migrations               | Applied twice successfully to a disposable PostgreSQL database                     |
| Type checking, formatting, ESLint and unused-code checks   | Passed                                                                             |

The full browser suite passed: 91 passed and 5 intentionally skipped. Results are recorded in `.verification/e2e-final-auth.log` and `.verification/e2e-rerun-auth.log` (83 passed initially; all eight corrected cases passed on rerun). Five mobile-browser PKCE cases intentionally skip because that flow is covered by the desktop project. Native tests do not establish installation on physical Android/iOS devices.

Local test logs and staged builds are ignored under `.verification/`; backend TRX files are under each test project's `TestResults/` folder. Database checks use an isolated local cluster and disposable databases, separate from the installed PostgreSQL service.

## Production rollout

1. Build the migration artifact with `deploy/scripts/build-migrator.ps1` in `myvedicstar`. It now packages both Authorize and Settings contexts with separate migration histories. Run it through the existing migration job before activating the new API revision. Keep startup migrations disabled in production and apply the updated bootstrap grants for `myvedicstarsettings` through the existing migration identity.
2. Configure backend-only `Integrations__MicrosoftGraph__Enabled`, `TenantId`, and the selected credential mode. The default remains disabled until valid tenant consent and credentials are configured. Use managed identity when it has the required tenant access, or store the application credential through the existing backend secret mechanism. No secret belongs in the UI environment file. Until Graph is configured, profile saves retain pending name synchronization in backend state.
3. Publish the shared API and staged SPA using the existing deployment tooling. Production runtime endpoint mappings include Profile, Settings, saved locations, and address lookup. Apply the infrastructure plan from `myvedicstar-infra` so both API prefixes validate JWTs for every application operation and remove previously anonymous operations. Authenticated catch-all GET/POST/PUT/PATCH/DELETE operations cover account and location routes. Address suggestions carry the existing access token through APIM.
4. Run the existing live smoke command against the deployed site. Verify a real account can save/read defaults across devices, that the userinfo name/email remain correct after refresh, and that a name edit completes Graph synchronization in the actual External ID tenant.

No production deployment, live database migration, tenant permission change, or live Graph profile mutation was performed. Automated readiness does not verify the deployed APIM configuration or production Graph consent.

## Follow-up corrections

Settings and the header now fit 320/375/640-pixel screens with saved locations loaded. Explicit Save immediately updates the shared tradition/location state, header, and calculation requests; clearing the location default restores the existing fallback. Profile address suggestion selection fills country, state, city, and postal code while preserving street fields. The manual name-sync retry control is removed from web and native screens.

All application requests now require a signed-in access token, including Today and every location lookup. Both API hosts protect controller routes, Swagger and OpenAPI; operational health/readiness probes remain accessible. APIM validates JWTs unconditionally for both API prefixes, and the Terraform module rejects anonymous-operation configurations. Signed-out web and native home pages hide the Today card and location controls and make no application API calls. Register controls are removed from the shared header (including auth/callback) and native sign-in screens. These source changes require publishing the UI/API and applying the reviewed infrastructure plan; no deployment or Terraform apply was run.

The public site currently links to `/favicon.svg`, which returns HTTP 200. No application source constructs the reported nested External ID favicon URL; the initiating request remains unconfirmed.

Follow-up verification passed: 10 Profile/Settings web tests, 48 API-client tests, 65 header/provider regression tests, two native Settings tests, and six browser checks including narrow layouts and saved defaults in the header. Guest `/?sid=...` navigation has a no-API regression case; the reported localhost HTTPS error text is still unknown.

## Post-deployment smoke correction

The supplied full failure log establishes the cause: an unauthenticated Today request returned HTTP 200,
while the security gate correctly required 401. That deployment had an authorization mismatch; retrying a
200 response or accepting it would not fix the requirement. The source Today controller requires authorization,
and the APIM policy validates JWTs unconditionally with anonymous operations disabled.

A subsequent read-only check of production returned 401 with the required CORS header and passed the full
smoke test (`.verification/auth-mismatch-live.log`). Two transient network retries occurred before that
successful response, independently confirming the usefulness of the bounded retry handling. The supplied
log does not identify whether the earlier 200 originated from an outdated gateway policy, backend release,
or another serving layer.

Roll out the backend and APIM authorization changes before the web deployment. Keep the smoke requirement
at 401; do not disable it or accept 200. Confirm the missing-token check on the deployed API before retrying
a web release.

Smoke requests now use bounded 10-second timeouts and retry network errors, 429, and 5xx responses up to three
times. Permanent HTTP failures and security/authentication assertions still fail. Exhausted retries identify
the endpoint without logging query values. The workflow retains a verification-only smoke artifact and the
deployment wrapper annotates failed checks explicitly. A stubbed upload test verified failure exit status,
annotations, retained output, and rollback guidance without Azure calls.

Verification logs for this correction are under `.verification/smoke-fix-*`: all 52 deployment tests, all 630
application/shared frontend tests, and 91 browser cases passed (five intentional PKCE skips). One browser
worker failed before starting a test; that case passed with one worker. Deployment CLI tests require local
subprocess/OS access: the restricted run failed to launch those scripts, and the unrestricted rerun passed.
The final complete `npm run check` passed with the required subprocess access; its log is
`.verification/smoke-fix-final-check.log`. The unused-code check also passed. The production deployment
command passed its dry run. No upload or infrastructure apply was performed by
this correction; the existing live release also passed the updated smoke script.
