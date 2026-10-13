# Deployment readiness ï¿½ Profile and Settings

Verified on October 13, 2026. Profile and Settings changes exist in both `myvedicstar-ui` and the sibling `myvedicstar` backend. Backend implementation follows `.github/copilot-instructions.md`: controllers delegate to public Business facades, persistence stays in Data, and Graph/GeoNames interactions use Integration boundaries.

The web and native applications provide Profile, Settings, and Logout navigation. Account identity uses the existing minimal userinfo response, with display name and email on separate lines. Profile updates preserve the existing user table; changed names have durable Graph synchronization status and retry. Settings use the `myvedicstarsettings` schema, account-scoped defaults and saved locations, and explicit Save. Temporary selections do not overwrite defaults. Deleting the default location clears the stored default atomically.

## Verification

| Check                                                      | Result                                                         |
| ---------------------------------------------------------- | -------------------------------------------------------------- |
| Frontend shared packages, web, native and deployment tests | 666 passed                                                     |
| Web component tests                                        | 228 passed, included above                                     |
| Native component tests                                     | 40 passed, included above                                      |
| MyVedicStar solution                                       | 176 passed; PostgreSQL tests enabled                           |
| Additional profile PostgreSQL tests                        | 4 passed                                                       |
| Shared-host route and authentication tests                 | 14 passed                                                      |
| MyVedicDay solution regression tests                       | 637 passed, including 23 shared cache tests                    |
| Backend deployment and migration contracts                 | Passed with fake Azure commands; no Azure changes              |
| Published Release backend smoke                            | Passed: readiness, OpenAPI routes and authentication           |
| Location proxy checks                                      | Passed; mocked GeoNames                                        |
| Web production build and staged production configuration   | Passed; JavaScript 234.4 KiB gzip                              |
| Packaged Authorize + Settings SQL migrations               | Applied twice successfully to a disposable PostgreSQL database |
| Type checking, formatting, ESLint and unused-code checks   | Passed                                                         |

The full browser suite passed: 95 passed and 5 intentionally skipped. Results are recorded in `.verification/e2e-final.log`. Five mobile-browser PKCE cases intentionally skip because that flow is covered by the desktop project. Native tests do not establish installation on physical Android/iOS devices.

Local test logs and staged builds are ignored under `.verification/`; backend TRX files are under each test project's `TestResults/` folder. Database checks use an isolated local cluster and disposable databases, separate from the installed PostgreSQL service.

## Production rollout

1. Build the migration artifact with `deploy/scripts/build-migrator.ps1` in `myvedicstar`. It now packages both Authorize and Settings contexts with separate migration histories. Run it through the existing migration job before activating the new API revision. Keep startup migrations disabled in production and apply the updated bootstrap grants for `myvedicstarsettings` through the existing migration identity.
2. Configure backend-only `Integrations__MicrosoftGraph__Enabled`, `TenantId`, and the selected credential mode. The default remains disabled until valid tenant consent and credentials are configured. Use managed identity when it has the required tenant access, or store the application credential through the existing backend secret mechanism. No secret belongs in the UI environment file. Until Graph is configured, profile saves retain pending name synchronization for retry.
3. Publish the shared API and staged SPA using the existing deployment tooling. Production runtime endpoint mappings include Profile, Settings, saved locations, and address lookup. The checked-in APIM module already defines authenticated catch-all GET/POST/PUT/PATCH/DELETE operations, so these account routes require no new Azure resource. Address suggestions carry the existing access token through APIM.
4. Run the existing live smoke command against the deployed site. Verify a real account can save/read defaults across devices, that the userinfo name/email remain correct after refresh, and that a name edit completes Graph synchronization in the actual External ID tenant.

No production deployment, live database migration, tenant permission change, or live Graph profile mutation was performed. Automated readiness does not verify the deployed APIM configuration or production Graph consent.
