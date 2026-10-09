#!/usr/bin/env bash
# Deploys the web SPA build (apps/web/dist) to an Azure Storage static website.
#
# Usage: deploy-azure-storage.sh <storage-account> <path-to-environment-config.json> [dist-dir]
# Requires: Azure CLI, logged in with a identity that has "Storage Blob Data Contributor" (use OIDC federated
# credentials in CI — no storage keys in the pipeline).
#
# Cache strategy:
#   assets/*            hashed file names → public, max-age=31536000, immutable
#   index.html          no-cache (always revalidate) so new deployments are picked up immediately
#   config.json         no-cache (per-environment runtime config)
#   other root files    short cache (favicon, robots.txt)
# Source maps (*.map) are never uploaded publicly.
set -euo pipefail

ACCOUNT="${1:?storage account name required}"
CONFIG="${2:?environment config.json required}"
DIST="${3:-apps/web/dist}"

[[ -f "$DIST/index.html" ]] || { echo "No build at $DIST (run npm run web:build)"; exit 1; }

echo "Validating runtime config $CONFIG"
npm run --silent security:headers -w @myvedicstar/web -- "$(realpath "$CONFIG")" > /dev/null

# Stage a copy: add the environment config and drop source maps (they go to error monitoring, not the public site).
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
cp -R "$DIST"/. "$STAGE"/
find "$STAGE" -name '*.map' -delete
cp "$CONFIG" "$STAGE/config.json"

echo "Enabling static website (index + SPA fallback)"
az storage blob service-properties update --auth-mode login --account-name "$ACCOUNT" \
  --static-website --index-document index.html --404-document index.html > /dev/null

upload() { # <pattern> <cache-control>
  az storage blob upload-batch --auth-mode login --account-name "$ACCOUNT" --destination '$web' \
    --source "$STAGE" --pattern "$1" --overwrite --content-cache-control "$2" --output none
}

# 1. Immutable hashed assets first, so new index.html never references missing files.
upload 'assets/*' 'public, max-age=31536000, immutable'
# 2. Root static files.
upload 'favicon.svg' 'public, max-age=86400'
upload 'robots.txt' 'public, max-age=86400'
# 3. Entry points last.
upload 'config.json' 'no-cache'
upload 'index.html' 'no-cache'

echo "Deployed. Purge the CDN / Front Door cache for /index.html and /config.json if the edge caches them."
