@description('The name of the resource group')
param resourceGroupName string

@description('The location for all resources')
param location string = resourceGroup().location

@description('The name of the App Service')
param appServiceName string

@description('The name of the App Service Plan')
param appServicePlanName string

@description('The SKU of the App Service Plan')
param appServicePlanSku string = 'B1'

@description('The name of the Container Registry')
param acrName string

@description('The name of the Container Image')
param containerImageName string

@description('The tag of the Container Image')
param containerImageTag string

// Create App Service Plan
resource appServicePlan 'Microsoft.Web/serverfarms@2022-09-01' = {
  name: appServicePlanName
  location: location
  sku: {
    name: appServicePlanSku
  }
  kind: 'linux'
  properties: {
    reserved: true
    targetWorkerCount: 1
  }
}

// Create App Service
resource appService 'Microsoft.Web/sites@2022-09-01' = {
  name: appServiceName
  location: location
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      linuxFxVersion: 'DOCKER|${acrName}.azurecr.io/${containerImageName}:${containerImageTag}'
      alwaysOn: true
      http20Enabled: true
    }
  }
  identity: {
    type: 'SystemAssigned'
  }
}

// Create Container Registry
resource acr 'Microsoft.ContainerRegistry/registries@2023-01-01-preview' = {
  name: acrName
  location: location
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: false // Disable admin user since we're using managed identity
  }
}

// Grant App Service access to ACR
resource acrPullRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(appService.id, acr.id, 'acrpull')
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d') // AcrPull role
    principalId: appService.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

output appServiceUrl string = 'https://${appService.properties.defaultHostName}'
output acrLoginServer string = acr.properties.loginServer 