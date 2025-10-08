#!/bin/bash

# VEXA.AI v0.6 Teams Audio Solution Deployment
# Implements media element detection and stream combination approach

set -e

echo "🚀 VEXA.AI v0.6: Deploying Teams audio solution with media element detection..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Step 1: Build the updated bot container
echo -e "${BLUE}📦 Building updated Vexa bot container with VEXA.AI v0.6 approach...${NC}"
cd /root/vexa

# Build the bot with new implementation
docker build -t vexa-vexa-bot:vexa-v0.6 -f services/vexa-bot/core/Dockerfile services/vexa-bot/core/

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Bot container built successfully${NC}"
else
    echo -e "${RED}❌ Failed to build bot container${NC}"
    exit 1
fi

# Step 2: Check if WhisperLive is running
echo -e "${BLUE}🔍 Checking WhisperLive service...${NC}"
if docker ps | grep -q "vexa-whisperlive-cpu-1"; then
    echo -e "${GREEN}✅ WhisperLive service is running${NC}"
else
    echo -e "${YELLOW}⚠️ WhisperLive service not found, starting...${NC}"
    COMPOSE_PROFILES=cpu docker compose up -d vexa-whisperlive-cpu
    sleep 5
fi

# Step 3: Create deployment function
deploy_vexa_bot() {
    local meeting_url="$1"
    local bot_name="${2:-VexaAI-Enhanced-v0.6}"
    local connection_id="${3:-vexa-enhanced-$(date +%s)}"
    
    echo -e "${BLUE}🚀 Deploying VEXA.AI v0.6 bot to meeting...${NC}"
    echo -e "${BLUE}📋 Meeting URL: ${meeting_url}${NC}"
    echo -e "${BLUE}🤖 Bot Name: ${bot_name}${NC}"
    echo -e "${BLUE}🆔 Connection ID: ${connection_id}${NC}"
    
    # Stop any existing bots
    echo -e "${YELLOW}🛑 Stopping existing bots...${NC}"
    docker ps -q --filter="ancestor=vexa-vexa-bot" | xargs -r docker stop
    docker ps -q --filter="ancestor=vexa-vexa-bot:vexa-v0.6" | xargs -r docker stop
    
    # Deploy new bot with Vexa.ai configuration
    docker run -d \
        --name="vexa-bot-enhanced-v0.6" \
        --network="vexa_vexa_default" \
        -e BOT_CONFIG="{\"meetingUrl\":\"${meeting_url}\",\"platform\":\"teams\",\"botName\":\"${bot_name}\",\"language\":\"en\",\"task\":\"transcribe\",\"authMode\":\"guest\",\"connectionId\":\"${connection_id}\",\"redisUrl\":\"redis://vexa-redis-1:6379\",\"whisperLiveUrl\":\"ws://vexa-whisperlive-cpu-1:9090\",\"token\":\"vexa-api-key-transcription-2024\",\"nativeMeetingId\":\"enhanced-meeting-$(date +%s)\",\"automaticLeave\":{\"enabled\":false,\"timeout\":999999,\"waitingRoomTimeout\":300000,\"noOneJoinedTimeout\":300000,\"everyoneLeftTimeout\":300000}}" \
        vexa-vexa-bot:vexa-v0.6
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ VEXA.AI v0.6 bot deployed successfully!${NC}"
        echo -e "${BLUE}📊 Container name: vexa-bot-enhanced-v0.6${NC}"
        echo -e "${BLUE}🔍 Monitor logs: docker logs vexa-bot-enhanced-v0.6 -f${NC}"
        return 0
    else
        echo -e "${RED}❌ Failed to deploy bot${NC}"
        return 1
    fi
}

# Step 4: Test deployment function
echo -e "${BLUE}🧪 Testing deployment function...${NC}"

# If meeting URL is provided as argument, deploy immediately
if [ -n "$1" ]; then
    echo -e "${GREEN}🎯 Meeting URL provided: $1${NC}"
    deploy_vexa_bot "$1" "VexaAI-Live-Test-v0.6" "live-test-$(date +%s)"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}🎉 VEXA.AI v0.6 bot deployment complete!${NC}"
        echo ""
        echo -e "${BLUE}📋 Monitoring Commands:${NC}"
        echo -e "${BLUE}  🔍 View logs:    docker logs vexa-bot-enhanced-v0.6 -f${NC}"
        echo -e "${BLUE}  📊 Check status: docker ps | grep vexa-bot-enhanced-v0.6${NC}"
        echo -e "${BLUE}  🛑 Stop bot:     docker stop vexa-bot-enhanced-v0.6${NC}"
        echo ""
        echo -e "${YELLOW}🎤 Expected behavior with VEXA.AI v0.6 approach:${NC}"
        echo -e "${YELLOW}  1. Bot joins meeting using Edge browser${NC}"
        echo -e "${YELLOW}  2. Detects existing media elements with participant audio${NC}"
        echo -e "${YELLOW}  3. Combines multiple participant streams into one${NC}"
        echo -e "${YELLOW}  4. Processes combined audio through WhisperLive${NC}"
        echo -e "${YELLOW}  5. Generates real-time transcriptions${NC}"
        echo ""
        echo -e "${GREEN}🚀 VEXA.AI v0.6 implementation is now LIVE!${NC}"
    else
        echo -e "${RED}❌ Deployment failed${NC}"
        exit 1
    fi
else
    echo -e "${BLUE}📚 VEXA.AI v0.6 deployment script ready!${NC}"
    echo ""
    echo -e "${BLUE}🎯 Usage:${NC}"
    echo -e "${BLUE}  ./deploy-vexa-v0.6.sh \"https://teams.microsoft.com/l/meetup-join/...\"${NC}"
    echo ""
    echo -e "${BLUE}🛠️ Manual deployment:${NC}"
    echo -e "${BLUE}  deploy_vexa_bot \"MEETING_URL\" \"BOT_NAME\" \"CONNECTION_ID\"${NC}"
    echo ""
    echo -e "${GREEN}✅ All components ready for VEXA.AI v0.6 deployment!${NC}"
fi

# Step 5: Create monitoring script
cat > /root/vexa/monitor-vexa-v0.6.sh << 'EOF'
#!/bin/bash

# VEXA.AI v0.6 Monitoring Script

CONTAINER_NAME="vexa-bot-enhanced-v0.6"

echo "🔍 VEXA.AI v0.6 Bot Monitoring Dashboard"
echo "========================================"

# Check if container exists and is running
if docker ps | grep -q "$CONTAINER_NAME"; then
    echo "✅ Status: RUNNING"
    echo "📊 Container: $CONTAINER_NAME"
    echo "🕐 Started: $(docker inspect --format='{{.State.StartedAt}}' $CONTAINER_NAME)"
    echo ""
    
    echo "📋 Recent Logs (last 20 lines):"
    echo "--------------------------------"
    docker logs $CONTAINER_NAME --tail 20
    echo ""
    
    echo "🎵 Audio Detection Status:"
    echo "-------------------------"
    docker logs $CONTAINER_NAME 2>&1 | grep -E "(media element|audio|combined stream|WhisperLive)" | tail -5
    echo ""
    
    echo "📝 Recent Transcriptions:"
    echo "------------------------"
    docker logs $CONTAINER_NAME 2>&1 | grep -E "(transcription|message)" | tail -3
    echo ""
    
    echo "🔧 Commands:"
    echo "  📺 Full logs:  docker logs $CONTAINER_NAME -f"
    echo "  🛑 Stop bot:   docker stop $CONTAINER_NAME"
    echo "  🔄 Restart:    docker restart $CONTAINER_NAME"
    
elif docker ps -a | grep -q "$CONTAINER_NAME"; then
    echo "❌ Status: STOPPED"
    echo "🔍 Last exit reason:"
    docker logs $CONTAINER_NAME --tail 10
else
    echo "⚠️ Status: NOT FOUND"
    echo "🚀 Deploy with: ./deploy-vexa-v0.6.sh \"MEETING_URL\""
fi
EOF

chmod +x /root/vexa/monitor-vexa-v0.6.sh

echo -e "${GREEN}📊 Created monitoring script: /root/vexa/monitor-vexa-v0.6.sh${NC}"
echo -e "${BLUE}🔍 Monitor bot status: ./monitor-vexa-v0.6.sh${NC}"

echo ""
echo -e "${GREEN}🎉 VEXA.AI v0.6 deployment system ready!${NC}"
echo -e "${BLUE}🚀 This implementation uses the proven Vexa.ai approach:${NC}"
echo -e "${BLUE}  • Media element detection instead of getUserMedia${NC}"
echo -e "${BLUE}  • Stream combination for multiple participants${NC}"
echo -e "${BLUE}  • Edge browser for better Teams compatibility${NC}"
echo -e "${BLUE}  • Teams-specific selectors and voice level detection${NC}"
echo -e "${BLUE}  • Stubborn WhisperLive reconnection${NC}"
echo ""
echo -e "${YELLOW}📋 Next Steps:${NC}"
echo -e "${YELLOW}  1. Test with a live Teams meeting URL${NC}"
echo -e "${YELLOW}  2. Monitor logs for media element detection${NC}"
echo -e "${YELLOW}  3. Verify audio stream combination${NC}"
echo -e "${YELLOW}  4. Confirm transcription output${NC}"