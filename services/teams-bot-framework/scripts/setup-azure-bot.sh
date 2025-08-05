#!/bin/bash

# Vexa Teams Bot Framework - Azure Bot Service Setup Script
# This script helps set up the required Azure resources for Teams Bot Framework

set -e

echo "🤖 Vexa Teams Bot Framework - Azure Setup"
echo "=========================================="

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo "❌ Azure CLI not found. Please install: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
    exit 1
fi

# Check if logged in to Azure
if ! az account show &> /dev/null; then
    echo "🔐 Please log in to Azure CLI first:"
    echo "az login"
    exit 1
fi

# Configuration
RESOURCE_GROUP_NAME="vexa-teams-bot-rg"
BOT_NAME="vexa-transcription-bot"
APP_NAME="vexa-teams-app"
LOCATION="eastus"
SPEECH_SERVICE_NAME="vexa-speech-service"

echo "📋 Configuration:"
echo "  Resource Group: $RESOURCE_GROUP_NAME"
echo "  Bot Name: $BOT_NAME"
echo "  App Name: $APP_NAME"
echo "  Location: $LOCATION"
echo "  Speech Service: $SPEECH_SERVICE_NAME"
echo ""

read -p "Continue with setup? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Setup cancelled."
    exit 0
fi

# Create resource group
echo "🏗️ Creating resource group..."
az group create --name $RESOURCE_GROUP_NAME --location $LOCATION

# Create Azure App Registration
echo "🔐 Creating Azure App Registration..."
APP_REGISTRATION=$(az ad app create \
    --display-name $APP_NAME \
    --sign-in-audience AzureADMyOrg \
    --required-resource-accesses '[
        {
            "resourceAppId": "00000003-0000-0000-c000-000000000000",
            "resourceAccess": [
                {
                    "id": "f3bfad56-966e-4590-a536-82ecf548ac1e",
                    "type": "Role"
                },
                {
                    "id": "a7a681dc-756e-4909-b988-f160edc6655f",
                    "type": "Role"
                }
            ]
        }
    ]')

APP_ID=$(echo $APP_REGISTRATION | jq -r '.appId')
echo "✅ App Registration created with ID: $APP_ID"

# Create App Secret
echo "🔑 Creating App Secret..."
APP_SECRET=$(az ad app credential reset --id $APP_ID --append --display-name "VexaTeamsBot" --query password -o tsv)
echo "✅ App Secret created (save this securely)"

# Create Azure Bot Service
echo "🤖 Creating Azure Bot Service..."
az bot create \
    --resource-group $RESOURCE_GROUP_NAME \
    --name $BOT_NAME \
    --app-type MultiTenant \
    --app-id $APP_ID \
    --password $APP_SECRET \
    --endpoint "https://your-domain.com/api/messages"

# Enable Teams channel
echo "📱 Enabling Teams channel..."
az bot msteams create \
    --resource-group $RESOURCE_GROUP_NAME \
    --name $BOT_NAME \
    --enable-calling true \
    --calling-web-hook "https://your-domain.com/api/calling"

# Create Speech Service
echo "🗣️ Creating Azure Speech Service..."
az cognitiveservices account create \
    --name $SPEECH_SERVICE_NAME \
    --resource-group $RESOURCE_GROUP_NAME \
    --kind SpeechServices \
    --sku S0 \
    --location $LOCATION \
    --yes

# Get Speech Service keys
SPEECH_KEY=$(az cognitiveservices account keys list \
    --name $SPEECH_SERVICE_NAME \
    --resource-group $RESOURCE_GROUP_NAME \
    --query key1 -o tsv)

echo ""
echo "🎉 Azure Bot Framework setup complete!"
echo "====================================="
echo ""
echo "📝 Configuration for .env file:"
echo "MICROSOFT_APP_ID=$APP_ID"
echo "MICROSOFT_APP_PASSWORD=$APP_SECRET"
echo "BOT_ID=$APP_ID"
echo "BOT_SECRET=$APP_SECRET"
echo "SPEECH_KEY=$SPEECH_KEY"
echo "SPEECH_REGION=$LOCATION"
echo ""
echo "⚠️ IMPORTANT NEXT STEPS:"
echo "1. Update your bot endpoint URL in Azure Bot Service"
echo "2. Request admin consent for the application in Azure AD"
echo "3. Configure Teams app manifest and sideload to Teams"
echo "4. Test the bot in a Teams meeting"
echo ""
echo "📚 Documentation:"
echo "- Bot Framework: https://docs.microsoft.com/en-us/azure/bot-service/"
echo "- Teams Integration: https://docs.microsoft.com/en-us/microsoftteams/platform/bots/"
echo "- Real-time Media: https://docs.microsoft.com/en-us/microsoftteams/platform/bots/calls-and-meetings/"
echo ""
echo "💾 Save the APP_SECRET securely - it won't be shown again!"