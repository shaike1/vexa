# 🚨 Vexa Deployment Quick Fix Reference

**Emergency troubleshooting for immediate deployment issues**

## ⚡ Most Common Issues (Fix in 2 minutes)

### 1. Port 19090 Conflict
```bash
# SYMPTOM: Port binding errors, WebSocket failures
# FIX: Update .env immediately
sed -i 's/TRAEFIK_WEB_HOST_PORT=19090/TRAEFIK_WEB_HOST_PORT=18080/' .env
docker compose restart traefik
```

### 2. Bot Token Authentication 
```bash
# SYMPTOM: "token":null in WhisperLive logs
# FIX: Set environment variable when running bot
WHISPER_LIVE_URL='ws://localhost:9090' node your_bot.js
```

### 3. Network Not Found
```bash
# SYMPTOM: network vexa_default not found
# FIX: Use correct network name
docker run --network="vexa_vexa_default" [your-container]
```

### 4. WhisperLive Connection Failed
```bash
# SYMPTOM: WebSocket connection errors
# FIX: Check service is running and accessible
docker compose ps | grep whisperlive
curl -f http://localhost:9090 || docker compose restart whisperlive-cpu
```

## 🔥 Nuclear Option (When everything fails)
```bash
# Complete reset - use only when desperate
docker compose down -v
docker system prune -af
make all
```

## ✅ Quick Health Check
```bash
# Verify all critical services
docker compose ps | grep -E "(api-gateway|whisperlive|redis|postgres)" 
curl http://localhost:18056/health
curl http://localhost:18057/health
```

## 📞 Test Bot Deployment
```bash
# Quick API test
curl -X POST http://localhost:18056/bots \
  -H "Content-Type: application/json" \
  -H "X-API-Key: token" \
  -d '{"platform":"teams","native_meeting_id":"test","meeting_url":"https://teams.microsoft.com/l/meetup-join/test"}'
```

**📖 For detailed troubleshooting, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md)**