// Azure resources for one environment of the My Vedic Star web SPA:
//   - Azure Static Web App (static content only; no managed Functions API)
//   - optional custom domain
//   - optional workspace-based Application Insights (+ Log Analytics workspace) for browser telemetry
// Deploy with ../scripts/provision.sh. Nothing environment-specific is hard-coded here: names, regions and domains are
// parameters supplied per environment.

targetScope = 'resourceGroup'

@description('Environment this deployment serves.')
@allowed(['development', 'test', 'uat', 'staging', 'production'])
param environmentName string

@description('Name of the Static Web App resource.')
@minLength(2)
@maxLength(58)
param staticWebAppName string

@description('Region for the Static Web App metadata (content is served from the global edge).')
@allowed(['centralus', 'eastus2', 'westus2', 'westeurope', 'eastasia'])
param location string

@description('Standard adds an SLA, more custom domains, private endpoints and larger content size. Use Standard for production.')
@allowed(['Free', 'Standard'])
param sku string = 'Standard'

@description('Optional custom host name, e.g. www.example.com. Create the DNS CNAME to the default host name first.')
param customDomain string = ''

@description('Create Application Insights for browser telemetry.')
param enableApplicationInsights bool = true

@description('Existing Log Analytics workspace resource ID; empty creates one for this environment.')
param logAnalyticsWorkspaceId string = ''

@description('Region for Application Insights and Log Analytics.')
param monitoringLocation string = resourceGroup().location

@description('Log retention in days.')
@minValue(30)
@maxValue(730)
param retentionInDays int = 30

@description('Additional resource tags.')
param tags object = {}

var resourceTags = union(tags, {
  application: 'myvedicstar-web'
  environment: environmentName
})

resource staticWebApp 'Microsoft.Web/staticSites@2024-04-01' = {
  name: staticWebAppName
  location: location
  tags: resourceTags
  sku: {
    name: sku
    tier: sku
  }
  properties: {
    // Pull-request preview sites get unpredictable host names that no sign-in redirect URI matches; releases are
    // promoted through the separate environments instead.
    stagingEnvironmentPolicy: 'Disabled'
    // staticwebapp.config.json (headers, routes) is generated per environment and deployed with the content.
    allowConfigFileUpdates: true
    // Content is deployed by the pipeline with a deployment token, not by a repository link.
    buildProperties: {
      skipGithubActionWorkflowGeneration: true
    }
  }
}

resource domain 'Microsoft.Web/staticSites/customDomains@2024-04-01' = if (!empty(customDomain)) {
  parent: staticWebApp
  name: empty(customDomain) ? 'unused' : customDomain
  properties: {
    validationMethod: 'cname-delegation'
  }
}

resource workspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = if (enableApplicationInsights && empty(logAnalyticsWorkspaceId)) {
  name: '${staticWebAppName}-logs'
  location: monitoringLocation
  tags: resourceTags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: retentionInDays
  }
}

resource insights 'Microsoft.Insights/components@2020-02-02' = if (enableApplicationInsights) {
  name: '${staticWebAppName}-insights'
  location: monitoringLocation
  tags: resourceTags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: empty(logAnalyticsWorkspaceId) ? workspace.id : logAnalyticsWorkspaceId
    IngestionMode: 'LogAnalytics'
    // Client IP addresses are not stored.
    DisableIpMasking: false
    RetentionInDays: retentionInDays
  }
}

@description('Default host name, e.g. <name>.<id>.azurestaticapps.net.')
output defaultHostName string = staticWebApp.properties.defaultHostname

@description('Public site URL (custom domain when configured). Use as MVS_SITE_URL.')
output siteUrl string = 'https://${empty(customDomain) ? staticWebApp.properties.defaultHostname : customDomain}'

@description('Application Insights connection string (public: browsers send telemetry with it). Use as MVS_APPINSIGHTS_CONNECTION_STRING.')
output appInsightsConnectionString string = enableApplicationInsights ? insights!.properties.ConnectionString : ''

output staticWebAppName string = staticWebApp.name
output staticWebAppId string = staticWebApp.id
