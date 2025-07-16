# VPS Deployment Guide for Vexa Dual Bot System

## Prerequisites
- VPS with Docker and Docker Compose installed
- At least 4GB RAM and 2 CPU cores recommended
- Git installed

## Step 1: Clone the Repository
```bash
cd /opt
git clone https://github.com/shaike1/vexa.git
cd vexa
```

## Step 2: Check System Resources
```bash
free -h
df -h
docker --version
docker compose --version
```

## Step 3: Build and Start Services
```bash
# Start with CPU profile (no GPU required)
docker compose --profile cpu up -d

# Check if services are starting
docker ps
```

## Step 4: Monitor Service Health
```bash
# Check logs
docker logs vexa_whisperlive-cpu_1
docker logs vexa_api-gateway_1
docker logs vexa_bot-manager_1

# Check resource usage
docker stats --no-stream
```

## Step 5: Create User and API Key
```bash
# Create user
curl -X POST http://localhost:18057/admin/users \
  -H "Content-Type: application/json" \
  -H "X-Admin-API-Key: token" \
  -d '{"email": "admin@vexa.ai", "name": "VPS Admin User"}'

# Get user ID from response, then create API token
curl -X POST http://localhost:18057/admin/users/1/tokens \
  -H "Content-Type: application/json" \
  -H "X-Admin-API-Key: token"
```

## Step 6: Test API Access
```bash
# Test API Gateway (use API token from step 5)
curl -X GET http://localhost:18056/bots/status \
  -H "X-API-Key: YOUR_API_TOKEN_HERE"
```

## Step 7: Deploy Test Bot
```bash
# Deploy transcription bot
curl -X POST http://localhost:18056/bots \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_TOKEN_HERE" \
  -d '{
    "platform": "teams",
    "native_meeting_id": "vps-test-meeting",
    "meeting_url": "https://teams.microsoft.com/l/meetup-join/YOUR_MEETING_URL",
    "bot_name": "VexaAI-VPS-Test",
    "task": "transcribe",
    "language": "en",
    "auth_mode": "guest"
  }'
```

## Step 8: Monitor Bot Performance
```bash
# Check running bots
curl -X GET http://localhost:18056/bots/status \
  -H "X-API-Key: YOUR_API_TOKEN_HERE"

# Check bot logs
docker logs $(docker ps -q --filter "name=vexa-bot")
```

## Troubleshooting Commands

### If services fail to start:
```bash
# Check Docker logs
docker logs vexa_whisperlive-cpu_1
docker logs vexa_api-gateway_1

# Restart specific service
docker restart vexa_whisperlive-cpu_1

# Check disk space
df -h

# Check memory
free -h
```

### If API is not responding:
```bash
# Check API Gateway health
curl http://localhost:18056/

# Check Admin API health  
curl http://localhost:18057/

# Restart API services
docker restart vexa_api-gateway_1
docker restart vexa_admin-api_1
```

### Clean shutdown:
```bash
# Stop all services
docker compose down

# Remove containers
docker compose down -v

# Clean system
docker system prune -f
```

## Service URLs (after deployment)
- **API Gateway**: http://localhost:18056
- **Admin API**: http://localhost:18057  
- **Traefik Dashboard**: http://localhost:18085
- **PostgreSQL**: localhost:15438

## Production Notes
- The system is configured for production use
- All Node.js proxy functions are implemented
- WebSocket proxy handles browser security restrictions
- Dual bot architecture is fully functional
- API authentication is required for all operations

## Next Steps
1. Configure firewall to allow necessary ports
2. Set up SSL certificates if needed
3. Configure domain names
4. Set up monitoring and logging
5. Configure backup strategy

The system is production-ready and should perform much better on the VPS with adequate resources.