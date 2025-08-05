# Azure Bot Service Setup Guide

## Step 1: Login to Azure
First, you need to login to your Azure account:

```bash
az login
```

This will open a browser window for authentication.

## Step 2: Set Subscription (if needed)
If you have multiple subscriptions, set the correct one:

```bash
az account list --output table
az account set --subscription "YOUR_SUBSCRIPTION_ID"
```

## Step 3: Run Automated Setup
Once logged in, run our automated setup script:

```bash
cd /root/vexa/services/teams-bot-framework/scripts
./setup-azure-bot.sh
```

## What the Setup Creates:
- **Resource Group**: `vexa-teams-bot-rg`
- **App Registration**: With required Graph API permissions
- **Bot Service**: Teams-enabled with calling capabilities
- **Speech Service**: For Azure Speech integration

## Required Permissions:
The setup will request these Graph API permissions:
- `Calls.AccessMedia.All` - For real-time media access
- `OnlineMeetings.Read.All` - For meeting participation

## Next Steps After Setup:
1. **Admin Consent**: Teams admin must approve the bot
2. **Update Endpoint**: Configure bot endpoint URL
3. **Deploy & Test**: Use the Bot Framework with legitimate audio access

## Alternative: Manual Setup
If you prefer manual setup, follow these steps:

### 1. Create App Registration
```bash
az ad app create --display-name "VexaAI-Teams-Bot" --sign-in-audience AzureADMyOrg
```

### 2. Create Bot Service
```bash
az bot create --resource-group "vexa-rg" --name "vexa-bot" --app-type MultiTenant --app-id "YOUR_APP_ID"
```

### 3. Enable Teams Channel
```bash
az bot msteams create --resource-group "vexa-rg" --name "vexa-bot" --enable-calling true
```

## Troubleshooting:
- Ensure you have **Contributor** role in Azure subscription
- **Teams admin** must approve calling bots
- Bot endpoint must be **HTTPS** and publicly accessible

Ready to proceed with Azure login?