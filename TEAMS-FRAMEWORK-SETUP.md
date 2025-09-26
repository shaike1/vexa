# Microsoft Teams Bot Framework Setup Guide

## 🎯 Official Teams Integration Implementation

This guide walks through setting up the official Microsoft Teams Bot Framework integration for legitimate meeting audio access.

### 📋 Prerequisites

1. **Microsoft Azure Account** with admin privileges
2. **Azure Active Directory** access
3. **Teams Admin Center** access
4. **Domain ownership** for bot hosting

### 🔧 Step-by-Step Setup

#### 1. Azure Bot Service Registration

```bash
# Login to Azure
az login

# Create resource group
az group create --name vexa-teams-bot-rg --location "East US"

# Create Azure Bot Service
az bot create \
  --resource-group vexa-teams-bot-rg \
  --name vexa-teams-transcription-bot \
  --kind webapp \
  --sku F0 \
  --app-type MultiTenant \
  --display-name "VexaAI Transcription Bot"
```

#### 2. App Registration Setup

1. Go to **Azure Portal** → **App Registrations**
2. Click **New Registration**
3. Configure:
   - **Name**: `VexaAI Transcription Bot`
   - **Account types**: `Multitenant`
   - **Redirect URI**: `https://your-domain.com/api/auth`

4. **API Permissions** - Add these permissions:
   ```
   Microsoft Graph:
   - Calls.AccessMedia.All (Application)
   - Calls.JoinGroupCall.All (Application)  
   - Calls.JoinGroupCallAsGuest.All (Application)
   - OnlineMeetings.Read.All (Application)
   ```

5. **Grant Admin Consent** for all permissions

#### 3. Environment Configuration

```bash
cd services/vexa-bot/teams-framework
cp .env.example .env
```

Edit `.env`:
```env
MICROSOFT_APP_ID=your-app-id-from-azure
MICROSOFT_APP_PASSWORD=your-app-secret-from-azure
BOT_NAME=VexaAI-Transcription-Bot
WHISPERLIVE_URL=ws://vexa-whisperlive-cpu-2:9090
REDIS_URL=redis://vexa-redis-1:6379
PORT=3978
HOST=your-public-domain.com
```

#### 4. Teams App Manifest Configuration

Edit `manifest/manifest.json`:
```json
{
  "id": "your-app-id-here",
  "webApplicationInfo": {
    "id": "your-app-id-here"
  },
  "validDomains": ["your-domain.com"]
}
```

#### 5. Deploy Bot Service

```bash
# Install dependencies
npm install

# Start the bot server
npm start
```

Expected output:
```
🚀 Starting VexaAI Teams Bot Framework Server...
✅ VexaAI Teams Bot Server Started!
🌐 Server running at: http://your-domain.com:3978
📞 Bot endpoint: http://your-domain.com:3978/api/messages
🎤 Call webhook: http://your-domain.com:3978/api/calls
```

#### 6. Teams App Installation

1. **Create App Package**:
   ```bash
   cd manifest/
   zip -r vexa-teams-bot.zip manifest.json color.png outline.png
   ```

2. **Upload to Teams**:
   - Teams Admin Center → Apps → Upload Custom App
   - Upload `vexa-teams-bot.zip`
   - Approve for organization

3. **Install in Teams**:
   - Teams App → Search "VexaAI"
   - Click Install
   - Add to meetings

### 🎤 Usage

#### Invite Bot to Meeting

1. **Schedule Teams Meeting**
2. **Add Participants** → Search "VexaAI Transcription Bot"
3. **Start Meeting** - Bot joins automatically
4. **Real-time Transcription** begins

#### Expected Behavior

```
📞 Teams meeting starts
🤖 VexaAI Bot joins meeting
🎤 Bot starts capturing audio
🗣️  TRANSCRIPTION: "Hello everyone, can you hear me?"
🗣️  TRANSCRIPTION: "Yes, the audio is clear"
📝 Transcription continues in real-time
```

### 🔍 Verification

#### Test Bot Registration
```bash
curl http://your-domain.com:3978/health
```
Expected response:
```json
{
  "status": "healthy",
  "service": "VexaAI Teams Bot",
  "version": "1.0.0"
}
```

#### Test Bot Info
```bash
curl http://your-domain.com:3978/api/bot/info
```

### 🎯 Key Advantages

✅ **Official Microsoft API** - No security limitations  
✅ **Production Ready** - Enterprise-grade solution  
✅ **Full Audio Access** - Legal meeting audio capture  
✅ **Real-time Processing** - Instant transcription via WhisperLive  
✅ **Admin Approved** - Compliant with corporate policies  

### 🚨 Important Notes

1. **Admin Consent Required** - Organization admin must approve the bot
2. **Public Endpoint Needed** - Bot must be accessible from Teams
3. **HTTPS Required** - Production deployment needs SSL certificate
4. **Graph Permissions** - Must be approved by Azure admin

### 📊 Expected Architecture

```
Teams Meeting → Teams Bot Framework → Azure Bot Service → VexaAI Bot Server → WhisperLive → Real-time Transcription
```

This completely bypasses browser security by using official Microsoft APIs for legitimate meeting audio access.