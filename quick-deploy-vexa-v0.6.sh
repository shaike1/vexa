#!/bin/bash

# Quick VEXA.AI v0.6 deployment using existing container with updated code

set -e

echo "🚀 VEXA.AI v0.6: Quick Teams audio solution deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Use existing container and inject new code
deploy_quick_vexa_bot() {
    local meeting_url="$1"
    local bot_name="${2:-VexaAI-v0.6-Quick}"
    local connection_id="${3:-quick-vexa-$(date +%s)}"
    
    echo -e "${BLUE}🚀 Quick deploying VEXA.AI v0.6 bot...${NC}"
    echo -e "${BLUE}📋 Meeting URL: ${meeting_url}${NC}"
    echo -e "${BLUE}🤖 Bot Name: ${bot_name}${NC}"
    
    # Stop any existing bots
    echo -e "${YELLOW}🛑 Stopping existing bots...${NC}"
    docker ps -q --filter="ancestor=vexa-vexa-bot" | xargs -r docker stop
    docker ps -aq --filter="name=vexa-bot" | xargs -r docker rm
    
    # Create quick Vexa bot with existing container and new approach
    docker run -d \
        --name="vexa-bot-v0.6-quick" \
        --network="vexa_vexa_default" \
        -e BOT_CONFIG="{\"meetingUrl\":\"${meeting_url}\",\"platform\":\"teams\",\"botName\":\"${bot_name}\",\"language\":\"en\",\"task\":\"transcribe\",\"authMode\":\"guest\",\"connectionId\":\"${connection_id}\",\"redisUrl\":\"redis://vexa-redis-1:6379\",\"whisperLiveUrl\":\"ws://vexa-whisperlive-cpu-1:9090\",\"token\":\"vexa-api-key-transcription-2024\",\"nativeMeetingId\":\"meeting-$(date +%s)\",\"automaticLeave\":{\"enabled\":false,\"timeout\":999999,\"waitingRoomTimeout\":300000,\"noOneJoinedTimeout\":300000,\"everyoneLeftTimeout\":300000}}" \
        vexa-vexa-bot
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ VEXA.AI v0.6 bot deployed successfully!${NC}"
        echo -e "${BLUE}📊 Container name: vexa-bot-v0.6-quick${NC}"
        
        # Wait a moment for container to start
        sleep 3
        
        # Inject the Vexa.ai approach directly into the running container
        echo -e "${BLUE}🔧 Injecting VEXA.AI v0.6 media element detection code...${NC}"
        
        # Copy new implementation files to container
        docker cp /root/vexa/services/vexa-bot/core/src/platforms/teams-vexa.ts vexa-bot-v0.6-quick:/app/src/platforms/
        docker cp /root/vexa/services/vexa-bot/core/src/platforms/teams-selectors.ts vexa-bot-v0.6-quick:/app/src/platforms/
        
        echo -e "${GREEN}✅ Code injection complete!${NC}"
        echo -e "${BLUE}🔍 Monitor logs: docker logs vexa-bot-v0.6-quick -f${NC}"
        
        # Show initial logs
        echo -e "${BLUE}📋 Initial logs:${NC}"
        docker logs vexa-bot-v0.6-quick --tail 10
        
        return 0
    else
        echo -e "${RED}❌ Failed to deploy bot${NC}"
        return 1
    fi
}

# Check WhisperLive
echo -e "${BLUE}🔍 Checking WhisperLive service...${NC}"
if docker ps | grep -q "vexa-whisperlive-cpu-1"; then
    echo -e "${GREEN}✅ WhisperLive service is running${NC}"
else
    echo -e "${YELLOW}⚠️ Starting WhisperLive service...${NC}"
    COMPOSE_PROFILES=cpu docker compose up -d vexa-whisperlive-cpu
fi

# Deploy with the meeting URL
if [ -n "$1" ]; then
    deploy_quick_vexa_bot "$1" "VexaAI-LiveTest-v0.6" "live-test-$(date +%s)"
    
    if [ $? -eq 0 ]; then
        echo ""
        echo -e "${GREEN}🎉 VEXA.AI v0.6 Quick Deployment Complete!${NC}"
        echo ""
        echo -e "${BLUE}📋 Next Steps:${NC}"
        echo -e "${BLUE}  1. Monitor logs: docker logs vexa-bot-v0.6-quick -f${NC}"
        echo -e "${BLUE}  2. Look for 'media element' detection in logs${NC}"
        echo -e "${BLUE}  3. Verify Edge browser launch${NC}"
        echo -e "${BLUE}  4. Check for combined audio stream creation${NC}"
        echo ""
        echo -e "${YELLOW}🎯 Expected VEXA.AI v0.6 behavior:${NC}"
        echo -e "${YELLOW}  • Edge browser launches for Teams${NC}"
        echo -e "${YELLOW}  • Media elements detected and combined${NC}"
        echo -e "${YELLOW}  • Real participant audio streams captured${NC}"
        echo -e "${YELLOW}  • WhisperLive receives combined audio${NC}"
        echo -e "${YELLOW}  • Actual transcriptions (not 'you' placeholders)${NC}"
        echo ""
        echo -e "${GREEN}🚀 Ready for live testing!${NC}"
    fi
else
    echo -e "${BLUE}📚 Quick VEXA.AI v0.6 deployment ready!${NC}"
    echo -e "${BLUE}🎯 Usage: ./quick-deploy-vexa-v0.6.sh \"TEAMS_MEETING_URL\"${NC}"
fi