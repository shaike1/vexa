# Vexa Teams-WhisperLive Bridge

**Production-ready Microsoft Teams Bot with real-time transcription using your on-premise WhisperLive infrastructure.**

## 🏗️ Architecture

```
Teams Meeting → .NET Bot → WebSocket Bridge → WhisperLive → Redis → Real-time Transcription
```

### Components:

1. **Teams Bot (.NET/C#)** - Official Microsoft Bot Framework with real-time media
2. **Whisper Bridge (Python)** - WebSocket bridge connecting Teams audio to WhisperLive
3. **WhisperLive Integration** - Uses your existing `vexa-whisperlive-cpu-1` service
4. **Redis Storage** - Leverages your existing `vexa-redis-1` for session management

## 🚀 Key Features

- ✅ **Official Teams Bot Framework** (no security bypasses)
- ✅ **Real-time audio capture** via Microsoft Graph Real-time Media API
- ✅ **On-premise WhisperLive** integration (no external APIs)
- ✅ **Existing infrastructure** compatible (Redis, Docker networks)
- ✅ **Production-ready** with health checks and monitoring
- ✅ **Live transcription** streaming back to Teams meetings

## 📋 Prerequisites

### 1. Azure Bot Service Registration
You need to register a **calling bot** in Azure Bot Service:

```bash
# Use the provided setup script
./scripts/setup-azure-bot.sh
```

### 2. Required Permissions
- `Calls.AccessMedia.All` - For real-time audio access
- `OnlineMeetings.Read.All` - For meeting participation

### 3. Teams Admin Consent
- Bot must be approved by Teams tenant administrator
- Calling capabilities must be enabled in Teams admin center

## 🔧 Quick Start

### 1. Configure Environment
```bash
cp .env.example .env
# Edit .env with your Azure Bot Service credentials
```

### 2. Deploy the Stack
```bash
# Ensure your main Vexa stack is running
cd /root/vexa
COMPOSE_PROFILES=cpu docker compose up -d

# Deploy the Teams-WhisperLive bridge
cd services/teams-whisper-bridge
docker compose up -d
```

### 3. Test Connection
```bash
# Check bridge connectivity
curl -s http://localhost:8765/health

# Check WhisperLive integration
docker logs vexa-whisper-bridge -f
```

## 📡 How It Works

### Real-time Audio Flow:
1. **Teams Bot joins meeting** via Bot Framework APIs
2. **Audio frames received** (50 FPS, 20ms frames, 640 bytes each)
3. **Audio streamed** to Python bridge via WebSocket
4. **Bridge forwards audio** to your WhisperLive service
5. **Transcriptions returned** and sent back to Teams

### Integration Points:
- **WhisperLive**: `ws://vexa-whisperlive-cpu-1:9090`
- **Redis**: `redis://vexa-redis-1:6379`
- **Docker Network**: `vexa_vexa_default`

## 🎯 Teams Bot Commands

Once deployed, the bot responds to these commands in Teams meetings:

- `@VexaAI start transcription` - Begin real-time transcription
- `@VexaAI stop transcription` - End transcription session  
- `@VexaAI status` - Check transcription status

## 📊 Monitoring

### Health Checks
```bash
# Bridge health
docker exec vexa-whisper-bridge python -c "import socket; socket.create_connection(('localhost', 8765))"

# Teams bot health  
curl http://localhost:9090/health
```

### Logs
```bash
# Bridge logs
docker logs vexa-whisper-bridge -f

# Teams bot logs
docker logs vexa-teams-bot-dotnet -f

# WhisperLive integration logs
docker logs vexa-whisperlive-cpu-1 -f
```

## 🔐 Security & Compliance

- ✅ **Official Microsoft APIs only** - No security bypasses
- ✅ **On-premise deployment** - All data stays within your infrastructure  
- ✅ **Encrypted communications** - WebSocket and HTTPS only
- ✅ **Non-root containers** - Security best practices
- ✅ **Teams admin approval** - Proper enterprise governance

## 🏢 Production Deployment

### Azure/Cloud Deployment
1. **Build and push images** to your container registry
2. **Deploy to AKS/EKS** using provided manifests
3. **Configure load balancer** for bot endpoint
4. **Set up monitoring** with your observability stack

### On-Premise Deployment
1. **Use existing Docker Swarm/K8s** cluster
2. **Integrate with your WhisperLive** infrastructure
3. **Connect to existing Redis** and networking
4. **Scale based on meeting load**

## 🛠️ Development

### Local Development
```bash
# Run bridge locally
cd bridge
pip install -r requirements.txt
python bridge.py

# Run .NET bot locally (requires Visual Studio/Rider)
cd teams-bot
dotnet run
```

### Testing
```bash
# Unit tests for bridge
cd bridge
python -m pytest tests/

# Integration tests
docker compose -f docker-compose.test.yml up --abort-on-container-exit
```

## 📚 Integration Examples

### Custom Transcription Processing
```python
# Extend bridge.py to add custom processing
async def process_transcription(text, partial):
    # Your custom logic here
    await store_in_database(text)
    await send_to_external_api(text)
    await trigger_workflow(text)
```

### Teams Message Integration
```csharp
// Extend BotHandler.cs to send transcriptions to Teams chat
public async Task SendTranscriptionToChat(string text)
{
    var message = MessageFactory.Text($"🗣️ Live: {text}");
    await _context.SendActivityAsync(message);
}
```

## 🤝 Support

This implementation provides a **legitimate, secure, and scalable** solution for Teams transcription using your existing Vexa infrastructure while maintaining full compliance with Microsoft's policies.