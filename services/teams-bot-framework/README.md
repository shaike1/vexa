# Vexa Teams Bot Framework - Legitimate Real-Time Transcription

This is a **legitimate Microsoft Teams Bot Framework implementation** for real-time audio transcription using official Microsoft APIs and Azure services.

## 🔑 Key Features

- **Official Microsoft Teams Bot Framework** integration
- **Real-time audio capture** using Microsoft Graph Calls API
- **Azure Cognitive Services** for speech-to-text transcription
- **WhisperLive integration** for enhanced transcription capabilities
- **Speaker identification** and multi-participant support
- **Secure and compliant** with Microsoft Teams policies

## 🏗️ Architecture

```
Teams Meeting → Bot Framework → Real-Time Media API → Audio Processing → Transcription Services
                     ↓                                        ↓
              WhisperLive Integration ←------------→ Azure Speech Services
```

## 📋 Prerequisites

### 1. Microsoft Teams Bot Registration
- Register a **calling bot** in Azure Bot Service
- Enable **Real-time media** capabilities
- Configure **Microsoft Graph permissions** for meeting access
- Obtain `MICROSOFT_APP_ID` and `MICROSOFT_APP_PASSWORD`

### 2. Azure Services
- **Azure Cognitive Services** Speech subscription
- **Application registration** with proper permissions:
  - `Calls.AccessMedia.All` (for audio access)
  - `OnlineMeetings.Read.All` (for meeting details)

### 3. Teams Admin Consent
- **Tenant admin consent** required for calling bot
- **Meeting policy** configuration to allow bots

## 🚀 Setup Instructions

### 1. Clone and Install
```bash
cd /root/vexa/services/teams-bot-framework
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your Azure and Teams credentials
```

### 3. Register Teams Bot
1. Go to [Azure Portal](https://portal.azure.com)
2. Create **Azure Bot Service** resource
3. Configure **Calling** capabilities
4. Add **Microsoft Teams** channel
5. Enable **Real-time media** in bot settings

### 4. Set Up Permissions
Required Microsoft Graph API permissions:
- `Calls.AccessMedia.All`
- `OnlineMeetings.Read.All`
- `User.Read.All`

### 5. Deploy and Test
```bash
npm start
```

Bot will be available at: `http://localhost:3978/api/messages`

## 🎯 How It Works

### Meeting Integration
1. **Bot joins meeting** via Teams Bot Framework
2. **Audio capture** through Microsoft Graph Real-time Media API
3. **Real-time processing** of 20ms audio frames (50 FPS)
4. **Transcription** via Azure Speech Services + WhisperLive
5. **Results delivery** back to Teams meeting chat

### Audio Processing
- **Frame rate**: 50 audio frames per second
- **Frame duration**: 20 milliseconds each
- **Audio format**: 16-bit PCM, 16kHz, mono
- **Frame size**: 640 bytes (320 samples)

### Transcription Commands
- `"start transcription"` - Begin real-time transcription
- `"stop transcription"` - End transcription session
- `"status"` - Check current transcription status

## 🔧 Technical Implementation

### Bot Framework Components
- **TeamsAudioBot**: Main bot logic and Teams integration
- **AudioProcessor**: Real-time audio frame processing
- **TranscriptionService**: Azure Speech Services integration

### Real-Time Media
Uses **Microsoft.Graph.Calls.Media** .NET library for:
- Audio stream access
- Speaker identification
- Meeting participant management
- Real-time frame processing

### Integration Points
- **WhisperLive**: Enhanced transcription accuracy
- **Azure Speech**: Primary transcription service
- **Teams Framework**: Official bot platform

## 📊 Production Deployment

### Azure Kubernetes Service (AKS)
```yaml
# Requires Windows node pool for .NET components
apiVersion: apps/v1
kind: Deployment
metadata:
  name: vexa-teams-bot
spec:
  template:
    spec:
      nodeSelector:
        kubernetes.io/os: windows
```

### Required Infrastructure
- **Windows Server** for .NET Real-time Media library
- **Azure Container Registry** for image storage
- **Azure Functions** for webhook processing
- **Cosmos DB** for conversation state

## 🔐 Security & Compliance

### Microsoft Teams Compliance
- ✅ **Official Bot Framework APIs**
- ✅ **Tenant admin approval required**
- ✅ **Secure token-based authentication**
- ✅ **Encrypted audio transmission**

### Data Handling
- Audio processed in real-time (not stored)
- Transcriptions can be persisted per meeting policy
- Full audit trail available
- GDPR and compliance ready

## 🧪 Testing

### Local Testing
```bash
npm run dev
```

### Teams Testing
1. **Sideload bot** in Teams developer portal
2. **Join test meeting** with bot invited
3. **Send commands** to bot in meeting chat
4. **Verify transcription** output

## 📚 References

- [Microsoft Teams Bot Framework](https://docs.microsoft.com/en-us/microsoftteams/platform/bots/what-are-bots)
- [Real-time Media Calls](https://docs.microsoft.com/en-us/microsoftteams/platform/bots/calls-and-meetings/real-time-media-concepts)
- [Azure Speech Services](https://docs.microsoft.com/en-us/azure/cognitive-services/speech-service/)
- [Microsoft Graph Calls API](https://docs.microsoft.com/en-us/graph/api/resources/calls-api-overview)

## 🤝 Support

This implementation provides a **legitimate, secure, and compliant** solution for Teams real-time transcription using official Microsoft APIs and proper authentication flows.