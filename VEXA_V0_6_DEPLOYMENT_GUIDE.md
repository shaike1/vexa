# Vexa v0.6 Deployment Guide for orc-3001

## 🚀 Quick Deployment Instructions

### Step 1: Clone Vexa v0.6
```bash
cd /root
git clone https://github.com/Vexa-ai/vexa.git vexa-v0.6
cd vexa-v0.6
```

### Step 2: Deploy with GPU Support
```bash
# This command does everything: builds images, starts services, runs migrations
make all TARGET=gpu
```

### Step 3: Verify Deployment
```bash
# Check service status
make ps

# View logs
make logs

# Test API connectivity
make test-api
```

### Step 4: Access Interfaces
- **Main API**: http://localhost:18056/docs
- **Admin API**: http://localhost:18057/docs

## 🧪 Testing MS Teams Integration

### Deploy a Bot to Teams Meeting
```bash
# Replace with actual Teams meeting URL
curl -X POST http://localhost:18056/bots \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "platform": "teams",
    "native_meeting_id": "TEAMS_MEETING_ID",
    "passcode": "MEETING_PASSCODE"
  }'
```

### Get Real-Time Transcripts
```bash
# REST API
curl -H "X-API-Key: your-api-key" \
  "http://localhost:18056/transcripts/teams/TEAMS_MEETING_ID"

# WebSocket (for real-time streaming)
# See docs at http://localhost:18056/docs for WebSocket details
```

## 🔧 Configuration

### Environment Variables (.env)
```bash
# GPU Configuration (auto-created by make all TARGET=gpu)
DEVICE_TYPE=cuda
WHISPER_MODEL_SIZE=medium
API_GATEWAY_HOST_PORT=18056
ADMIN_API_HOST_PORT=18057
```

### Port Mapping
- **18056**: Main API Gateway
- **18057**: Admin API  
- **5438**: PostgreSQL
- **8081**: Traefik (internal routing)
- **8082**: Traefik Dashboard

## 📊 Monitoring and Management

### View Container Status
```bash
make ps
```

### View Service Logs
```bash
# All services
make logs

# Specific service
docker compose logs -f vexa-bot
docker compose logs -f whisperlive
```

### Stop Services
```bash
make down
```

### Restart Services
```bash
make down && make up
```

## 🚨 Troubleshooting

### GPU Issues
```bash
# Verify NVIDIA setup
nvidia-smi
docker run --rm --gpus all nvidia/cuda:11.0-base nvidia-smi
```

### Service Not Starting
```bash
# Check individual service logs
docker compose logs <service-name>

# Rebuild specific service
docker compose build <service-name>
```

### API Not Responding
```bash
# Test connectivity
curl http://localhost:18056/health

# Check API Gateway logs
docker compose logs api-gateway
```

## 🔄 Updating

### Pull Latest Changes
```bash
cd /root/vexa-v0.6
git pull origin main
make all TARGET=gpu
```

## 🎯 Integration with Existing Systems

### API Key Management
```bash
# Generate API key (see nbs/0_basic_test.ipynb)
# Or use admin API to create keys
```

### WebSocket Streaming
```bash
# Real-time transcript streaming available via WebSocket
# See API docs for connection details
```

## 📈 Performance Tuning

### GPU Memory
```bash
# Monitor GPU usage
nvidia-smi -l 1
```

### Docker Resources
```bash
# Monitor container resources
docker stats
```

## 🔐 Security Considerations

### API Access
- Use strong API keys
- Consider rate limiting
- Monitor access logs

### Network Security
- Services communicate via internal Docker network
- Only necessary ports exposed to host

## 📝 Next Steps

1. **Test with Real Meeting**: Join a Teams meeting and verify audio capture
2. **Monitor Performance**: Check CPU/GPU usage during transcription
3. **Integrate APIs**: Connect to existing workflows
4. **Scale Testing**: Test with multiple concurrent meetings

## 📞 Support

- **Documentation**: http://localhost:18056/docs
- **GitHub Issues**: https://github.com/Vexa-ai/vexa/issues
- **Discord**: https://discord.gg/Ga9duGkVz9