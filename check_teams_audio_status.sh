#!/bin/bash

# Test Teams Audio Streaming - Quick Verification Script

echo "🎯 TEAMS AUDIO STREAMING STATUS CHECK"
echo "====================================="

# Check WhisperLive health
echo "1. WhisperLive Health Check:"
if curl -s http://localhost:9091/health | grep -q "OK"; then
    echo "   ✅ WhisperLive: HEALTHY"
else
    echo "   ❌ WhisperLive: UNHEALTHY"
fi

# Check container status
echo ""
echo "2. Container Status:"
WHISPER_STATUS=$(docker inspect vexa-whisperlive-cpu-1 --format='{{.State.Health.Status}}' 2>/dev/null || echo "missing")
echo "   WhisperLive: $WHISPER_STATUS"

PROXY_STATUS=$(docker inspect vexa-websocket-proxy-1 --format='{{.State.Status}}' 2>/dev/null || echo "missing")
echo "   WebSocket Proxy: $PROXY_STATUS"

# Check network connectivity
echo ""
echo "3. Network Connectivity Test:"
if docker run --rm --network=vexa_default alpine ping -c 1 -W 2 vexa-whisperlive-cpu-1 >/dev/null 2>&1; then
    echo "   ✅ Container network: CONNECTED"
else
    echo "   ❌ Container network: FAILED"
fi

# Check WebSocket connectivity
echo ""
echo "4. WebSocket Connection Test:"
if timeout 5 docker run --rm --network=vexa_default alpine/curl -s ws://vexa-whisperlive-cpu-1:9090 2>&1 | grep -q "Connected"; then
    echo "   ✅ WebSocket: CONNECTABLE"
else
    echo "   ❌ WebSocket: CONNECTION FAILED"
fi

# Check Redis
echo ""
echo "5. Redis Connectivity:"
if docker exec vexa-redis-1 redis-cli ping 2>/dev/null | grep -q "PONG"; then
    echo "   ✅ Redis: CONNECTED"
else
    echo "   ❌ Redis: FAILED"
fi

# Summary
echo ""
echo "🎯 SUMMARY:"
if curl -s http://localhost:9091/health | grep -q "OK" && \
   docker exec vexa-redis-1 redis-cli ping 2>/dev/null | grep -q "PONG" && \
   docker run --rm --network=vexa_default alpine ping -c 1 -W 2 vexa-whisperlive-cpu-1 >/dev/null 2>&1; then
    echo "✅ Teams Audio Streaming: READY FOR TESTING"
    echo ""
    echo "Ready to deploy Teams bot with:"
    echo "whisperLiveUrl: 'ws://vexa-whisperlive-cpu-1:9090'"
    echo "redisUrl: 'redis://vexa-redis-1:6379'"
    echo "network: 'vexa_default'"
else
    echo "❌ Teams Audio Streaming: ISSUES DETECTED"
fi

echo ""
echo "====================================="