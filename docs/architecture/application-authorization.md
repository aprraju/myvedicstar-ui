# Application authorization

Decision: October 13, 2026.

Every application endpoint in VedicStar and VedicDay requires an authenticated caller with the API scope.
APIM validates issuer, audience and required claims for both API prefixes; anonymous operation configurations
are rejected. Health and readiness remain anonymous for operational Container App probes.

The shared API client obtains a bearer token for every application request and fails before fetching when no
token is available. Guest web/native home pages are informational, without Today cards or API-backed selectors.
Settings and saved-location queries are scoped to the signed-in identity. Swagger and OpenAPI require authorization.
Register buttons are removed from public navigation and callback pages; Login uses the hosted identity provider.

Verification covers missing-token rejection, authenticated route access, zero guest requests, login/refresh/logout,
responsive account pages, APIM configuration validation, and smoke checks against the published API artifact.
Deployment must coordinate the UI, backend and APIM policy. This decision supersedes earlier anonymous Today
and location-lookup contracts.
