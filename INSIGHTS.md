# 🔍 Vexa AI Deployment Insights & Lessons Learned

## 📝 Critical Discovery: WebSocket Connection Issue Root Cause

### The Problem
**Bot containers consistently showed:** `[BotCore] [Teams] ❌ WebSocket connecting, state: 3`
- State 3 = WebSocket CLOSED
- Occurred despite all services being healthy
- Browser inside container couldn't reach WhisperLive

### The Root Cause Discovery
**Key Insight:** The difference between working local setup vs production deployment:

**Local Working Setup:**
```javascript
whisperLiveUrl: 'ws://localhost:9090'  // Browser could reach this
redisUrl: 'redis://localhost:6379'     // Direct host access
```

**Production Failing Setup:**
```javascript
whisperLiveUrl: 'ws://vexa-whisperlive-cpu-1:9090'  // Browser couldn't resolve Docker service names
redisUrl: 'redis://vexa-redis-1:6379'               // Container networking worked
```

### The Solution Pattern
**Required Configuration for Working Bot:**
1. **Host Networking:** `--net=host` so browser can access `localhost:9090`
2. **Virtual Display:** `xvfb-run -a -s "-screen 0 1920x1080x24"` for headless browser
3. **Localhost URLs:** `ws://localhost:9090` exactly like local development

### Working Deployment Command
```bash
docker run -d --name='bot' --net=host \
  -e BOT_CONFIG='{"whisperLiveUrl":"ws://localhost:9090","redisUrl":"redis://localhost:6379",...}' \
  vexa-vexa-bot \
  sh -c 'xvfb-run -a -s "-screen 0 1920x1080x24" /app/entrypoint.sh'
```

## 🏗️ Architecture Insights

### Service Communication Patterns
1. **Bot → WhisperLive:** Must use `localhost:9090` with host networking
2. **Bot → Redis:** Can use `localhost:6379` with host networking  
3. **Services ↔ Services:** Use Docker service names (e.g., `vexa-redis-1:6379`)
4. **Browser Context:** Cannot resolve Docker service names, needs localhost

### Docker Networking Limitations
- **Browser inside container** cannot establish WebSocket connections to Docker service names
- **Docker bridge networking** doesn't expose services to browser context
- **Host networking** required for browser WebSocket connections to work

## 🔧 Troubleshooting Methodology

### Systematic Issue Resolution
1. **Health Checks First:** Verify all services running (`docker compose ps`)
2. **Network Connectivity:** Test direct connections (`curl`, `telnet`)
3. **WebSocket Protocol:** Test WebSocket handshake manually
4. **Browser Context:** Consider browser's network environment
5. **Local Comparison:** Compare with working local setup

### Key Diagnostic Commands
```bash
# Check service health
docker compose ps

# Test HTTP connectivity
curl -f http://service:port/health

# Test WebSocket manually
node -e "const ws = new WebSocket('ws://localhost:9090'); ws.on('open', () => console.log('✅ Connected'));"

# Check network connectivity
docker exec container curl service:port
```

## 📋 Deployment Checklist (Updated)

### Pre-Deployment
- [ ] All services healthy in `docker compose ps`
- [ ] WhisperLive model downloaded successfully
- [ ] Ports 9090, 6379, 8090 accessible on host
- [ ] X11/xvfb packages installed in bot container

### Bot Deployment 
- [ ] Use `--net=host` networking mode
- [ ] Use `ws://localhost:9090` for WhisperLive URL
- [ ] Use `redis://localhost:6379` for Redis URL
- [ ] Start with `xvfb-run` for virtual display
- [ ] Set `WHISPER_LIVE_URL` environment variable

### Post-Deployment Verification
- [ ] Bot joins Teams meeting successfully
- [ ] No "WebSocket connecting, state: 3" errors
- [ ] WhisperLive receives connections
- [ ] Transcription data flows to Redis streams

## 🎯 Critical Success Factors

### 1. Network Configuration
The **biggest lesson**: Browser context networking is different from container networking.
- Containers can talk via service names
- Browsers need localhost or external IPs

### 2. Documentation Accuracy
Our **TROUBLESHOOTING.md** was correct about using `xvfb-run` but missing the networking aspect:
```bash
# Correct pattern from troubleshooting guide
DISPLAY=:99 xvfb-run -a -s "-screen 0 1920x1080x24" node bot.js
```

### 3. Local vs Production Parity
**Key principle**: Production deployment should mirror local development environment:
- If local uses `localhost:9090`, production should too
- Don't change URLs unless necessary
- Maintain same network accessibility patterns

## 🐳 Docker Hub Strategy Impact

### Current Status
- **Building from source:** 10+ minutes per deployment
- **Dependency issues:** Playwright installs, model downloads
- **Consistency problems:** Different environments, different builds

### With Docker Hub
- **Pull time:** Under 2 minutes
- **Consistency:** Same image everywhere
- **Reliability:** Pre-tested, working images
- **Scalability:** Deploy anywhere instantly

### Recommended Images to Push
1. `vexaai/vexa-bot:latest` - Working bot with all dependencies
2. `vexaai/whisperlive-cpu:latest` - WhisperLive with models
3. `vexaai/api-gateway:latest` - API Gateway service
4. `vexaai/transcription-collector:latest` - Data collector

## 🔄 Workflow Optimization

### Ideal Deployment Process
```bash
# 1. Pull pre-built images (2 minutes)
docker compose pull

# 2. Start infrastructure (30 seconds)
COMPOSE_PROFILES=cpu docker compose up -d

# 3. Deploy bot with correct networking (30 seconds)
docker run -d --net=host \
  -e BOT_CONFIG='...' \
  vexaai/vexa-bot:latest \
  sh -c 'xvfb-run -a -s "-screen 0 1920x1080x24" /app/entrypoint.sh'
```

**Total time:** ~3 minutes (vs current 15+ minutes)

## 🎉 Success Metrics

### When Deployment is Working
- [ ] Bot joins meeting within 60 seconds
- [ ] No WebSocket state: 3 errors
- [ ] WhisperLive shows "New client connected"
- [ ] Transcription data appears in Redis streams
- [ ] Real-time transcription visible via API

### Performance Indicators
- **Bot startup:** <60 seconds
- **WebSocket connection:** <5 seconds after meeting join
- **First transcription:** <10 seconds after speech
- **Audio processing:** Real-time with <2 second delay

## 💡 Future Improvements

### 1. Container Optimization
- Pre-install all Playwright browsers
- Include Whisper models in image
- Optimize X11/audio dependencies

### 2. Network Architecture
- Consider service mesh for better networking
- Implement WebSocket proxy with external routing
- Add network health monitoring

### 3. Monitoring & Observability
- Add WebSocket connection metrics
- Monitor transcription latency
- Track bot success/failure rates

## 🏆 Key Takeaway

**The fundamental insight:** Vexa AI's architecture is solid, but browser networking requirements are unique. The WebSocket connection between browser and WhisperLive requires careful network configuration that mirrors local development patterns.

**Success formula:** Host networking + xvfb + localhost URLs = Working Vexa AI transcription

---

*This document captures the critical insights from our deployment troubleshooting session and should be referenced for all future Vexa AI deployments.*