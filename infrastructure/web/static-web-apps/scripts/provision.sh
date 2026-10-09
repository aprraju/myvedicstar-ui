#!/usr/bin/env bash
# Creates or updates the Azure resources for one web environment (idempotent): resource group, Static Web App, optional
# custom domain, Application Insights. Run once per environment, and again whenever bicep/main.bicep changes.
#
# Usage (from the repository root, signed in with `az login`):
#   infrastructure/web/static-web-apps/scripts/provision.sh --environment <development|test|production> \
#     --subscription <id-or-name> --resource-group <rg> --name <static-web-app-name> --location <region> \
#     [--sku Standard|Free] [--custom-domain www.example.com] [--no-app-insights] [--what-if]
#
# Regions supported by Static Web Apps: centralus, eastus2, westus2, westeurope, eastasia.
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE="$SCRIPT_DIR/../bicep/main.bicep"

ENVIRONMENT="" SUBSCRIPTION="" RESOURCE_GROUP="" NAME="" LOCATION="" SKU="Standard" CUSTOM_DOMAIN=""
APP_INSIGHTS=true WHAT_IF=false

usage() { sed -n '2,10p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --environment) ENVIRONMENT="${2:?}"; shift 2 ;;
    --subscription) SUBSCRIPTION="${2:?}"; shift 2 ;;
    --resource-group) RESOURCE_GROUP="${2:?}"; shift 2 ;;
    --name) NAME="${2:?}"; shift 2 ;;
    --location) LOCATION="${2:?}"; shift 2 ;;
    --sku) SKU="${2:?}"; shift 2 ;;
    --custom-domain) CUSTOM_DOMAIN="${2:?}"; shift 2 ;;
    --no-app-insights) APP_INSIGHTS=false; shift ;;
    --what-if) WHAT_IF=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
done

for required in ENVIRONMENT SUBSCRIPTION RESOURCE_GROUP NAME LOCATION; do
  [[ -n "${!required}" ]] || { echo "Missing --$(echo "$required" | tr '[:upper:]_' '[:lower:]-')" >&2; usage >&2; exit 2; }
done
trap 'echo "Provisioning FAILED (exit $?). Review the error above; the deployment is safe to re-run." >&2' ERR

az account set --subscription "$SUBSCRIPTION"

if [[ "$(az group exists --name "$RESOURCE_GROUP")" != "true" ]]; then
  echo "Creating resource group $RESOURCE_GROUP ($LOCATION)"
  az group create --name "$RESOURCE_GROUP" --location "$LOCATION" \
    --tags application=myvedicstar-web environment="$ENVIRONMENT" --output none
fi

params=(
  environmentName="$ENVIRONMENT"
  staticWebAppName="$NAME"
  location="$LOCATION"
  sku="$SKU"
  customDomain="$CUSTOM_DOMAIN"
  enableApplicationInsights="$APP_INSIGHTS"
)

if [[ "$WHAT_IF" == "true" ]]; then
  az deployment group what-if --resource-group "$RESOURCE_GROUP" --template-file "$TEMPLATE" --parameters "${params[@]}"
  exit 0
fi

echo "Deploying $TEMPLATE to $RESOURCE_GROUP"
outputs="$(az deployment group create --resource-group "$RESOURCE_GROUP" --name "myvedicstar-web-$ENVIRONMENT" \
  --template-file "$TEMPLATE" --parameters "${params[@]}" --query properties.outputs --output json)"

value() { node -e 'const o=JSON.parse(process.argv[1]); process.stdout.write(String(o[process.argv[2]]?.value ?? ""))' "$outputs" "$1"; }

cat <<EOF

Provisioned $ENVIRONMENT:
  Static Web App   $(value staticWebAppName)
  Default host     https://$(value defaultHostName)
  Site URL         $(value siteUrl)

Set these on the GitHub Environment "$ENVIRONMENT" (Settings → Environments → Variables):
  AZURE_STATIC_WEB_APP_NAME          $(value staticWebAppName)
  AZURE_RESOURCE_GROUP               $RESOURCE_GROUP
  MVS_SITE_URL                       $(value siteUrl)
  MVS_APPINSIGHTS_CONNECTION_STRING  $(value appInsightsConnectionString)

Then add the site URL to:
  - the Entra External ID web app registration (SPA redirect URIs): $(value siteUrl)/auth/callback and $(value siteUrl)/
  - the backend API CORS allowed origins: $(value siteUrl)
EOF
if [[ -n "$CUSTOM_DOMAIN" ]]; then
  echo "Custom domain: the CNAME $CUSTOM_DOMAIN → $(value defaultHostName) must exist; Azure issues the TLS certificate."
fi
