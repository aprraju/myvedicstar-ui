#!/usr/bin/env bash
# Deploys one already-built web SPA artifact (apps/web/dist) to an Azure Static Web App for one environment.
# The same build artifact is deployed unchanged to every environment; only config.json and
# staticwebapp.config.json are generated per environment, from MVS_* variables.
#
# Usage (from the repository root):
#   infrastructure/web/static-web-apps/scripts/deploy.sh --environment production \
#     [--dist apps/web/dist] [--env-file infrastructure/web/static-web-apps/environments/production.env] \
#     [--skip-smoke-test] [--skip-cors-check] [--dry-run]
#
# Deployment target (one of):
#   AZURE_STATIC_WEB_APP_NAME + AZURE_RESOURCE_GROUP [+ AZURE_STATIC_WEB_APP_SUBSCRIPTION_ID]
#                         token fetched with the signed-in Azure CLI identity (CI: OIDC)
#   SWA_DEPLOYMENT_TOKEN  deployment token (fallback; keep it in a secret store)
# Settings: environments/<env>.env; a non-empty environment variable of the same name overrides the file.
#
# Steps: validate artifact → render + validate environment config → stage → deploy (with retries) → smoke test.
# Any failure stops the deployment with a non-zero exit code; nothing is deployed if validation fails.
set -Eeuo pipefail
# Git Bash on Windows rewrites environment values that look like Unix paths before starting node/az, which would turn
# the URL path MVS_API_ENDPOINT_PREFIX=/myvedicday/... into a file path. MVS_* values are never file paths. No effect
# on Linux runners.
export MSYS2_ENV_CONV_EXCL="MVS_${MSYS2_ENV_CONV_EXCL:+;$MSYS2_ENV_CONV_EXCL}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SWA_CLI_VERSION="2.0.10"
DEPLOY_ATTEMPTS=3

ENVIRONMENT=""
DIST="apps/web/dist"
ENV_FILE=""
SMOKE_TEST=true
CORS_CHECK=true
DRY_RUN=false

usage() { awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "${BASH_SOURCE[0]}"; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --environment) ENVIRONMENT="${2:?}"; shift 2 ;;
    --dist) DIST="${2:?}"; shift 2 ;;
    --env-file) ENV_FILE="${2:?}"; shift 2 ;;
    --skip-smoke-test) SMOKE_TEST=false; shift ;;
    --skip-cors-check) CORS_CHECK=false; shift ;;
    --dry-run) DRY_RUN=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
done

CURRENT_STEP="startup"
SMOKE_LOG=""
in_ci() { [[ "${GITHUB_ACTIONS:-}" == "true" ]]; }
step() {
  CURRENT_STEP="$1"
  if in_ci; then echo "::group::$1"; else echo; echo "==> $1"; fi
}
end_step() { if in_ci; then echo "::endgroup::"; fi; }
on_error() {
  local code=$?
  if in_ci; then echo "::endgroup::"; echo "::error title=Web deployment failed::${ENVIRONMENT:-?}: ${CURRENT_STEP}"; fi
  echo >&2
  echo "Deployment to '${ENVIRONMENT:-?}' FAILED during: ${CURRENT_STEP} (exit ${code})." >&2
  case "$CURRENT_STEP" in
    Smoke*) if [[ -n "$SMOKE_LOG" && -f "$SMOKE_LOG" ]]; then
              while IFS= read -r problem; do
                if in_ci; then echo "::error title=Smoke verification::$problem"; else echo "$problem" >&2; fi
              done < <(grep -E '^  FAIL|^Smoke test failed' "$SMOKE_LOG" || true)
            fi
            echo "The new release IS deployed but did not verify. Roll back by redeploying the last good build:" >&2
            echo "  GitHub → Actions → 'Web' → Run workflow (main, artifact run ID of the last good run)." >&2 ;;
    Deploy*) echo "The previous release is still being served (Static Web Apps switches content atomically)." >&2 ;;
    *) echo "Nothing was deployed." >&2 ;;
  esac
  exit "$code"
}
trap on_error ERR

[[ -n "$ENVIRONMENT" ]] || { echo "--environment is required" >&2; usage >&2; exit 2; }
[[ "$ENVIRONMENT" =~ ^(development|test|uat|staging|production)$ ]] || { echo "Unsupported environment: $ENVIRONMENT" >&2; exit 2; }

# Loads KEY=VALUE settings without executing the file. A non-empty variable already in the environment (e.g. a GitHub
# variable) wins over the file; blank ones (unset GitHub variables expand to '') take the file's value.
load_env_file() {
  local line key value
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"
    [[ "$line" =~ ^[[:space:]]*([A-Z_][A-Z0-9_]*)=(.*)$ ]] || continue
    key="${BASH_REMATCH[1]}"
    value="${BASH_REMATCH[2]}"
    if [[ "$value" =~ ^\"(.*)\"$ || "$value" =~ ^\'(.*)\'$ ]]; then value="${BASH_REMATCH[1]}"; fi
    if [[ -z "${!key:-}" ]]; then export "$key=$value"; fi
  done < "$1"
}

if [[ -n "$ENV_FILE" ]]; then
  [[ -f "$ENV_FILE" ]] || { echo "Env file not found: $ENV_FILE" >&2; exit 2; }
  load_env_file "$ENV_FILE"
fi

STAGE="$(mktemp -d)"
DEPLOY_LOG=""
cleanup() {
  rm -rf "$STAGE" "$DEPLOY_LOG"
  if [[ -z "${WEB_SMOKE_LOG_PATH:-}" && -n "$SMOKE_LOG" ]]; then rm -f "$SMOKE_LOG"; fi
}
trap cleanup EXIT

step "Validate build artifact ($DIST)"
npx --no-install tsx "$SCRIPT_DIR/validate-build.ts" "$DIST"
end_step

step "Render $ENVIRONMENT configuration"
cp -R "$DIST"/. "$STAGE"/
# Hidden source maps belong to error monitoring, never to the public site.
find "$STAGE" -name '*.map' -delete
npx --no-install tsx "$SCRIPT_DIR/render.ts" --out "$STAGE" --expect-environment "$ENVIRONMENT"
npx --no-install tsx "$SCRIPT_DIR/validate-build.ts" "$STAGE" --staged
end_step

if [[ "$DRY_RUN" == "true" ]]; then
  echo
  echo "Dry run: staged content is valid; not deploying. Generated files:"
  echo "--- config.json"; cat "$STAGE/config.json"
  echo "--- staticwebapp.config.json"; cat "$STAGE/staticwebapp.config.json"
  exit 0
fi

step "Resolve deployment target"
TOKEN="${SWA_DEPLOYMENT_TOKEN:-}"
if [[ -z "$TOKEN" ]]; then
  : "${AZURE_STATIC_WEB_APP_NAME:?set AZURE_STATIC_WEB_APP_NAME (or SWA_DEPLOYMENT_TOKEN)}"
  : "${AZURE_RESOURCE_GROUP:?set AZURE_RESOURCE_GROUP (or SWA_DEPLOYMENT_TOKEN)}"
  # The app may live in a different subscription from the signed-in default (e.g. a hub subscription).
  subscription_args=()
  if [[ -n "${AZURE_STATIC_WEB_APP_SUBSCRIPTION_ID:-}" ]]; then
    subscription_args=(--subscription "$AZURE_STATIC_WEB_APP_SUBSCRIPTION_ID")
  fi
  # Short-lived use of the deployment key through the caller's Azure identity: nothing long-lived is stored in CI.
  TOKEN="$(az staticwebapp secrets list --name "$AZURE_STATIC_WEB_APP_NAME" --resource-group "$AZURE_RESOURCE_GROUP" \
    "${subscription_args[@]}" --query properties.apiKey --output tsv)"
  [[ -n "$TOKEN" ]] || {
    echo "Could not read the deployment token (the identity needs Microsoft.Web/staticSites/listSecrets/action)" >&2
    false
  }
  echo "Target: Static Web App $AZURE_STATIC_WEB_APP_NAME (resource group $AZURE_RESOURCE_GROUP)"
fi
if in_ci; then echo "::add-mask::$TOKEN"; fi
end_step

step "Deploy to Azure Static Web Apps ($ENVIRONMENT)"
swa_deploy() {
  # Prebuilt content: upload the staged folder as-is (no build), with its generated staticwebapp.config.json.
  # The token is passed through the environment, never on the command line. stdin is closed so the CLI can never wait
  # for an interactive answer on a CI runner. Output is kept (outside the staged folder) to classify failures; only the
  # most verbose level prints the deployment service's reason for a failure (the token itself is always <hidden>).
  # Runs from the current directory with the staged folder as an absolute path: the upload client refuses to run from
  # inside the folder it uploads ("Current directory cannot be identical to or contained within artifact folders").
  SWA_CLI_DEPLOYMENT_TOKEN="$TOKEN" npx --yes "@azure/static-web-apps-cli@${SWA_CLI_VERSION}" deploy "$STAGE" \
    --swa-config-location "$STAGE" --env production --no-use-keychain --verbose=silly \
    < /dev/null 2>&1 | tee "$DEPLOY_LOG"
  return "${PIPESTATUS[0]}"
}
DEPLOY_LOG="$(mktemp)"
attempt=1
until swa_deploy; do
  # A rejected token never succeeds on retry.
  if grep -qiE "deployment_token provided was invalid|ApiToken is invalid" "$DEPLOY_LOG"; then
    echo "The deployment token was rejected. Check AZURE_STATIC_WEB_APP_NAME / AZURE_RESOURCE_GROUP, or rotate" \
      "SWA_DEPLOYMENT_TOKEN (az staticwebapp secrets reset-api-key)." >&2
    false
  fi
  if (( attempt >= DEPLOY_ATTEMPTS )); then
    echo "Deployment failed after $attempt attempts." >&2
    false
  fi
  echo "Deployment attempt $attempt failed; retrying in $((attempt * 20)) s..." >&2
  sleep $((attempt * 20))
  attempt=$((attempt + 1))
done
end_step

if [[ "$SMOKE_TEST" == "true" ]]; then
  step "Smoke test ${MVS_SITE_URL}"
  smoke_args=(--site-url "$MVS_SITE_URL" --staged "$STAGE")
  [[ "$CORS_CHECK" == "true" ]] || smoke_args+=(--skip-cors)
  # Keep only verification output: deployment credentials never enter this diagnostic artifact.
  SMOKE_LOG="${WEB_SMOKE_LOG_PATH:-$(mktemp)}"
  npx --no-install tsx "$SCRIPT_DIR/smoke-test.ts" "${smoke_args[@]}" 2>&1 | tee "$SMOKE_LOG"
  end_step
fi

echo
echo "Deployed web build to $ENVIRONMENT: ${MVS_SITE_URL}"
if [[ -n "${GITHUB_OUTPUT:-}" ]]; then echo "site-url=${MVS_SITE_URL}" >> "$GITHUB_OUTPUT"; fi
if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  {
    echo "### Web → $ENVIRONMENT"
    echo "- Site: ${MVS_SITE_URL}"
    echo "- Build: ${BUILD_ID:-${GITHUB_SHA:-local}}"
    echo "- Smoke test: $([[ "$SMOKE_TEST" == "true" ]] && echo passed || echo skipped)"
  } >> "$GITHUB_STEP_SUMMARY"
fi
