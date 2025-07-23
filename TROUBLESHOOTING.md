# Vexa Deployment Troubleshooting Guide

This guide documents common deployment issues and their solutions to ensure smooth Vexa stack deployment anywhere.

## 🚨 Critical Issues & Solutions

### 1. WebSocket Proxy & Traefik Port Conflicts

**Issue**: WhisperLive and Traefik competing for port 19090, causing bot-to-transcription communication failures.

**Symptoms**:
- `ERROR:root:Missing required fields: token` in WhisperLive logs
- Bot connects to meetings but transcription fails
- WebSocket connection errors in bot logs
- Port binding conflicts during Docker Compose startup

**Root Cause**:
- Traefik configured to use port 19090 in `.env`
- WhisperLive also expects port 19090 for WebSocket connections
- Docker containers unable to bind to same port

**Solution**:
```bash
# 1. Update .env file - Change Traefik port
TRAEFIK_WEB_HOST_PORT=18080  # Changed from 19090

# 2. Verify WhisperLive uses correct port
WHISPER_LIVE_URL=ws://whisperlive-cpu:9090

# 3. Ensure WebSocket proxy configuration
WEBSOCKET_PROXY_HOST=websocket-proxy
WEBSOCKET_PROXY_PORT=8090
```

**Prevention**:
- Always check port assignments in `.env` before deployment
- Use `docker compose ps` to verify port mappings
- Check `netstat -tulpn | grep :19090` for port conflicts

### 2. Bot Authentication Token Issues

**Issue**: Bots connecting to WhisperLive without proper token authentication.

**Symptoms**:
- `"token":null` in WhisperLive connection logs
- `ERROR:root:Missing required fields: token`
- Transcription service rejects bot connections

**Root Cause**:
- Bot code checking `process.env.WHISPER_LIVE_URL` instead of config parameter
- Missing token field in bot configuration
- Environment variable not properly propagated to bot process

**Solution**:
```javascript
// 1. Ensure bot configuration includes token
const botConfig = {
  whisperLiveUrl: 'ws://localhost:9090',
  token: 'token',  // Required for authentication
  // ... other config
};

// 2. Set environment variable when running bot
WHISPER_LIVE_URL='ws://localhost:9090' node bot.js

// 3. Verify token in bot logs
console.log('Token:', botConfig.token);
```

**Prevention**:
- Always include `token` field in bot configurations
- Set `WHISPER_LIVE_URL` environment variable explicitly
- Test authentication before deploying to production

### 3. Docker Network Configuration

**Issue**: Services unable to communicate due to incorrect network configuration.

**Symptoms**:
- `network vexa_default not found` errors
- Services unable to resolve hostnames
- Connection timeouts between containers

**Solution**:
```yaml
# docker-compose.yml - Ensure consistent network naming
networks:
  vexa_default:
    driver: bridge

services:
  vexa-bot:
    networks:
      - vexa_default
    # Use service names for internal communication
    environment:
      - REDIS_URL=redis://vexa-redis-1:6379
      - WHISPER_LIVE_URL=ws://vexa-whisperlive-cpu-1:9090
```

**Prevention**:
- Use consistent network naming across all services
- Reference services by their container names
- Test inter-service communication after deployment

### 4. Audio System Configuration (Teams Bots)

**Issue**: Teams bots unable to capture or process audio.

**Symptoms**:
- Browser launch failures with X11 errors
- Audio device not found errors
- Silent transcription (no audio captured)

**Solution**:
```bash
# 1. Use virtual display for headless environments
DISPLAY=:99 xvfb-run -a -s "-screen 0 1920x1080x24" node bot.js

# 2. Ensure PulseAudio configuration in Docker
# services/vexa-bot/core/Dockerfile
RUN apt-get update && apt-get install -y \
    pulseaudio \
    alsa-utils \
    xvfb

# 3. Virtual audio devices setup
pactl load-module module-null-sink sink_name=virtual_speaker
pactl load-module module-null-sink sink_name=virtual_microphone
```

**Prevention**:
- Always test audio capture in development environment
- Include all audio dependencies in Dockerfile
- Use virtual display for headless bot deployment

## 🔧 Deployment Checklist

### Pre-Deployment
- [ ] Check port assignments in `.env` file
- [ ] Verify Docker daemon is running
- [ ] Ensure sufficient disk space (>10GB)
- [ ] Check network connectivity for image pulls

### During Deployment
- [ ] Run `make all` from project root
- [ ] Monitor `docker compose ps` for service health
- [ ] Check `docker compose logs` for errors
- [ ] Verify WebSocket connectivity: `curl ws://localhost:8090`

### Post-Deployment
- [ ] Test bot deployment via API
- [ ] Verify transcription functionality
- [ ] Check all service endpoints respond
- [ ] Validate database connections

## 🐞 Common Error Messages & Solutions

### `"token":null` in WhisperLive
**Fix**: Add token to bot config and set `WHISPER_LIVE_URL` environment variable

### `Port already in use`
**Fix**: Check `.env` for port conflicts, update `TRAEFIK_WEB_HOST_PORT`

### `network not found`
**Fix**: Use correct Docker Compose network name in bot deployment

### `Browser launch failed`
**Fix**: Install X11/Xvfb packages, use virtual display

### `WebSocket connection failed`
**Fix**: Verify WebSocket proxy is running, check service networking

## 📊 Service Dependencies

```
API Gateway (18056)
├── Admin API (18057)
├── Bot Manager (8080)
└── Transcription Collector (18123)

Bot Manager
├── Docker Socket (/var/run/docker.sock)
└── Vexa Bot Images

Vexa Bot
├── WebSocket Proxy (8088/8090)
├── Redis (6379)
└── Teams Meeting URL

WebSocket Proxy
└── WhisperLive CPU (9090)

WhisperLive
├── PostgreSQL (15438)
└── Transcription Collector
```

## 🚀 Quick Fix Commands

```bash
# Reset entire stack
docker compose down -v
docker system prune -f
make all

# Check specific service
docker compose logs [service-name] --tail 50

# Test WebSocket connectivity
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Key: test" -H "Sec-WebSocket-Version: 13" \
  http://localhost:8090

# Verify bot authentication
docker logs [bot-container-id] | grep -i token

# Check port usage
netstat -tulpn | grep -E ":19090|:18080|:9090"
```

## 📝 Environment Template

Create `.env` file with these critical settings:
```env
# Core API Configuration
ADMIN_API_TOKEN=token
API_GATEWAY_HOST_PORT=18056
ADMIN_API_HOST_PORT=18057

# Fixed Traefik Configuration (NOT 19090!)
TRAEFIK_WEB_HOST_PORT=18080
TRAEFIK_DASHBOARD_HOST_PORT=18085

# WhisperLive Configuration
WHISPER_LIVE_URL=ws://whisperlive-cpu:9090
DEVICE_TYPE=cpu

# Database Configuration
POSTGRES_HOST_PORT=15438

# Bot Configuration
BOT_IMAGE_NAME=vexa-bot:node-proxy-fix
```

## 🆘 Emergency Recovery

If deployment completely fails:
```bash
# Nuclear option - complete reset
docker compose down -v
docker system prune -af
docker volume prune -f
make clean  # if available
make all
```

This will rebuild everything from scratch, ensuring a clean deployment state.

---

💡 **Pro Tip**: Always test locally with `make all` before deploying to production servers. This guide should be updated whenever new deployment issues are discovered.