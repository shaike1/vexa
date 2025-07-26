# Azure Bot Service Setup Guide

## Step 1: Create Azure Bot Service

### Using Azure CLI
```bash
# Login to Azure
az login

# Create resource group
az group create --name VexaBotResourceGroup --location eastus

# Create Azure Bot Service
az bot create \
  --resource-group VexaBotResourceGroup \
  --name VexaSpeakerBot \
  --kind webapp \
  --sku F0 \
  --appid "your-app-id" \
  --password "your-app-password"
```

### Using Azure Portal
1. Go to Azure Portal → Create Resource → Bot Service
2. Fill in basic information:
   - **Bot name**: VexaSpeakerBot
   - **Resource group**: VexaBotResourceGroup
   - **Pricing tier**: F0 (Free)
3. Configure App registration:
   - **Type**: User-Assigned Managed Identity (recommended)
   - Or create new App ID and password

## Step 2: Configure App Registration

### Create App Registration
1. Go to Azure Active Directory → App registrations
2. Click "New registration"
3. Name: VexaSpeakerBot
4. Supported account types: Accounts in any organizational directory
5. Redirect URI: Leave blank for now

### Get Credentials
After creation, note these values:
- **Application (client) ID**: Copy this value
- **Directory (tenant) ID**: Copy this value

### Create Client Secret
1. Go to "Certificates & secrets"
2. Click "New client secret"
3. Description: VexaSpeakerBot Secret
4. Expires: 24 months
5. **Copy the secret value immediately** (you can't see it again)

## Step 3: Configure Bot Service

### Set Messaging Endpoint
1. Go to your Bot Service resource
2. Navigate to "Settings" → "Configuration"
3. Set Messaging endpoint: `https://your-domain.com/api/messages`
4. For local testing with ngrok: `https://abc123.ngrok.io/api/messages`

### Enable Teams Channel
1. Go to "Channels" in your Bot Service
2. Click on Microsoft Teams icon
3. Check "Microsoft Teams Commercial (most common)"
4. Save

## Step 4: Azure Speech Services

### Create Speech Resource
```bash
az cognitiveservices account create \
  --name VexaSpeechService \
  --resource-group VexaBotResourceGroup \
  --kind SpeechServices \
  --sku F0 \
  --location eastus
```

### Get Speech Service Keys
```bash
az cognitiveservices account keys list \
  --name VexaSpeechService \
  --resource-group VexaBotResourceGroup
```

## Step 5: Update Configuration

Update `/root/vexa/native-teams-bot/VexaSpeakerBot/appsettings.json`:

```json
{
  "MicrosoftAppType": "UserAssignedMSI",
  "MicrosoftAppId": "your-application-client-id",
  "MicrosoftAppPassword": "your-client-secret",
  "MicrosoftAppTenantId": "your-tenant-id",
  "AzureSpeech": {
    "Key": "your-speech-service-key",
    "Region": "eastus"
  }
}
```

## Environment Variables (Alternative)

For production, use environment variables instead of appsettings.json:

```bash
export MicrosoftAppId="your-app-id"
export MicrosoftAppPassword="your-app-password"
export MicrosoftAppTenantId="your-tenant-id"
export AzureSpeech__Key="your-speech-key"
export AzureSpeech__Region="eastus"
```

## Quick Setup Script

Here's a script to automate the Azure resource creation:

```bash
#!/bin/bash

# Variables
RESOURCE_GROUP="VexaBotResourceGroup"
BOT_NAME="VexaSpeakerBot"
SPEECH_NAME="VexaSpeechService"
LOCATION="eastus"

# Create resource group
az group create --name $RESOURCE_GROUP --location $LOCATION

# Create Speech Services
az cognitiveservices account create \
  --name $SPEECH_NAME \
  --resource-group $RESOURCE_GROUP \
  --kind SpeechServices \
  --sku F0 \
  --location $LOCATION

# Get Speech Service keys
echo "Speech Service Keys:"
az cognitiveservices account keys list \
  --name $SPEECH_NAME \
  --resource-group $RESOURCE_GROUP

echo "Setup complete! Update your appsettings.json with the credentials above."
```

## Testing the Setup

1. **Test locally with ngrok**:
   ```bash
   # Terminal 1: Start ngrok
   ngrok http 5001
   
   # Terminal 2: Update bot endpoint and run
   dotnet run
   ```

2. **Test Redis communication**:
   ```bash
   node test-native-bot.js
   ```

3. **Test in Teams**:
   - Install bot in Teams
   - Add to a meeting
   - Send Redis commands
   - Verify speech synthesis works