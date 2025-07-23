#!/bin/bash

# Quick Test Script for Vexa AI Transcription
# One-click testing for users

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${PURPLE}"
cat << 'EOF'
╔══════════════════════════════════════════════════════════════════╗
║                    🎯 VEXA AI QUICK TEST                        ║
║              Test transcription in under 2 minutes!             ║
╚══════════════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

# Check if Vexa is running
check_vexa_status() {
    echo -e "${BLUE}🔍 Checking Vexa AI status...${NC}"
    
    if ! curl -f -s http://localhost:18056/health >/dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  Vexa AI is not running. Starting it now...${NC}"
        if [ -f "./deploy-vexa.sh" ]; then
            ./deploy-vexa.sh --quiet --device cpu --bot-name "Quick Test Bot"
        else
            echo -e "${RED}❌ Deployment script not found. Please run from Vexa directory.${NC}"
            exit 1
        fi
    else
        echo -e "${GREEN}✅ Vexa AI is running!${NC}"
    fi
}

# Interactive bot deployment
deploy_test_bot() {
    echo
    echo -e "${CYAN}🤖 Bot Deployment Setup${NC}"
    echo
    
    # Get meeting URL
    echo -e "${YELLOW}📋 Please provide your Teams meeting details:${NC}"
    echo "1. Join your Teams meeting first"
    echo "2. Copy the meeting URL from your browser"
    echo
    
    read -p "📺 Paste your Teams meeting URL: " MEETING_URL
    if [ -z "$MEETING_URL" ]; then
        echo -e "${RED}❌ Meeting URL is required!${NC}"
        exit 1
    fi
    
    # Extract meeting ID from URL (simplified)
    MEETING_ID=$(echo "$MEETING_URL" | sed 's/.*meetup-join\///g' | sed 's/%40.*//g' | head -c 20)
    if [ -z "$MEETING_ID" ]; then
        MEETING_ID="quick-test-$(date +%s)"
    fi
    
    # Get bot preferences
    read -p "🤖 Bot name [VO Assist Quick Test]: " BOT_NAME
    BOT_NAME=${BOT_NAME:-"VO Assist Quick Test"}
    
    echo
    echo -e "${CYAN}🌐 Language Options:${NC}"
    echo "  en - English (default)"
    echo "  es - Spanish"  
    echo "  fr - French"
    echo "  de - German"
    echo "  it - Italian"
    echo "  pt - Portuguese"
    echo "  auto - Auto-detect"
    echo
    read -p "🗣️  Language [en]: " LANGUAGE
    LANGUAGE=${LANGUAGE:-"en"}
    
    # Deploy the bot
    echo
    echo -e "${BLUE}🚀 Deploying bot to your meeting...${NC}"
    
    BOT_RESPONSE=$(curl -s -X POST http://localhost:18056/bots \
        -H "Content-Type: application/json" \
        -H "X-API-Key: token" \
        -d "{
            \"platform\": \"teams\",
            \"native_meeting_id\": \"$MEETING_ID\",
            \"meeting_url\": \"$MEETING_URL\",
            \"bot_name\": \"$BOT_NAME\",
            \"language\": \"$LANGUAGE\",
            \"task\": \"transcribe\"
        }")
    
    if echo "$BOT_RESPONSE" | grep -q "error"; then
        echo -e "${RED}❌ Bot deployment failed:${NC}"
        echo "$BOT_RESPONSE"
        exit 1
    else
        echo -e "${GREEN}✅ Bot deployed successfully!${NC}"
        echo -e "${BLUE}🤖 Look for '$BOT_NAME' joining your Teams meeting${NC}"
    fi
    
    # Save meeting details for transcript retrieval
    echo "$MEETING_ID" > /tmp/vexa_last_meeting_id
    echo "$BOT_NAME" > /tmp/vexa_last_bot_name
}

# Monitor transcription
monitor_transcription() {
    local meeting_id="$1"
    
    echo
    echo -e "${CYAN}📝 Real-Time Transcription Monitor${NC}"
    echo "Meeting ID: $meeting_id"
    echo "Press Ctrl+C to stop monitoring"
    echo
    echo -e "${YELLOW}💬 Start speaking in your Teams meeting now!${NC}"
    echo "=================================="
    
    # Monitor loop
    while true; do
        TRANSCRIPT=$(curl -s -H "X-API-Key: token" \
            "http://localhost:18056/transcripts/teams/$meeting_id" 2>/dev/null)
        
        if echo "$TRANSCRIPT" | grep -q "transcripts"; then
            # Pretty print the transcription
            echo "$TRANSCRIPT" | python3 -m json.tool 2>/dev/null | \
                grep -E "(time|speaker|text)" | \
                sed 's/.*"time": "\([^"]*\)".*/🕐 \1/g' | \
                sed 's/.*"speaker": "\([^"]*\)".*/👤 \1:/g' | \
                sed 's/.*"text": "\([^"]*\)".*/💬 \1/g'
            echo "=================================="
        else
            echo -e "${BLUE}⏳ Waiting for transcription... (speak in the meeting)${NC}"
        fi
        
        sleep 3
    done
}

# Show results and next steps
show_results() {
    local meeting_id="$1"
    local bot_name="$2"
    
    echo
    echo -e "${GREEN}"
    cat << 'EOF'
╔══════════════════════════════════════════════════════════════════╗
║                      🎉 TEST COMPLETED!                         ║
╚══════════════════════════════════════════════════════════════════╝
EOF
    echo -e "${NC}"
    
    echo -e "${CYAN}📊 Test Summary:${NC}"
    echo "  • Bot Name: $bot_name"
    echo "  • Meeting ID: $meeting_id"
    echo "  • Status: ✅ Successfully deployed and transcribing"
    
    echo
    echo -e "${CYAN}🔗 Access Your Transcription:${NC}"
    echo "  curl -H 'X-API-Key: token' http://localhost:18056/transcripts/teams/$meeting_id"
    
    echo
    echo -e "${CYAN}📱 Web Access:${NC}"
    echo "  • API Docs: http://localhost:18056/docs"
    echo "  • Live Status: http://localhost:19000/status"
    echo "  • Try different languages, see USER-GUIDE.md"
    
    echo
    echo -e "${CYAN}🚀 Next Steps:${NC}"
    echo "  1. Speak more in the meeting - watch transcription improve"
    echo "  2. Try different languages: ./quick-test.sh"
    echo "  3. Deploy to production: ./deploy-vexa.sh"
    echo "  4. Build on top: Check README.md for API examples"
    
    echo
    echo -e "${YELLOW}💾 Meeting saved for future reference: $meeting_id${NC}"
}

# Main execution
main() {
    echo -e "${BLUE}🚀 Starting Vexa AI quick test...${NC}"
    
    check_vexa_status
    deploy_test_bot
    
    # Get saved meeting ID
    MEETING_ID=$(cat /tmp/vexa_last_meeting_id 2>/dev/null || echo "unknown")
    BOT_NAME=$(cat /tmp/vexa_last_bot_name 2>/dev/null || echo "Test Bot")
    
    echo
    echo -e "${GREEN}✅ Bot deployment complete!${NC}"
    echo -e "${YELLOW}🔍 Would you like to monitor real-time transcription?${NC}"
    read -p "Monitor transcription? (Y/n): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
        monitor_transcription "$MEETING_ID"
    else
        show_results "$MEETING_ID" "$BOT_NAME"
    fi
}

# Handle Ctrl+C gracefully
trap 'echo -e "\n${GREEN}🎯 Transcription monitoring stopped${NC}"; show_results "$MEETING_ID" "$BOT_NAME"; exit 0' INT

# Help function
show_help() {
    cat << EOF
Vexa AI Quick Test Script

This script provides the fastest way to test Vexa AI transcription:
  1. Checks if Vexa is running (starts it if needed)
  2. Prompts for Teams meeting URL  
  3. Deploys bot to your meeting
  4. Shows real-time transcription

Usage: $0 [OPTIONS]

Options:
    -h, --help          Show this help message
    -m, --monitor-only  Only monitor existing transcription
    --meeting-id ID     Use specific meeting ID for monitoring

Examples:
    $0                              # Full quick test
    $0 --monitor-only               # Just monitor transcription
    $0 --meeting-id abc123          # Monitor specific meeting

Prerequisites:
  • Teams meeting URL (join meeting first, copy URL)
  • Vexa AI deployed (script will auto-deploy if needed)

For detailed documentation, see USER-GUIDE.md
EOF
}

# Command line parsing
case "${1:-}" in
    -h|--help)
        show_help
        exit 0
        ;;
    -m|--monitor-only)
        MEETING_ID=$(cat /tmp/vexa_last_meeting_id 2>/dev/null || echo "")
        if [ -z "$MEETING_ID" ]; then
            echo -e "${RED}❌ No previous meeting ID found. Run full test first.${NC}"
            exit 1
        fi
        monitor_transcription "$MEETING_ID"
        ;;
    --meeting-id)
        monitor_transcription "$2"
        ;;
    "")
        main
        ;;
    *)
        echo -e "${RED}❌ Unknown option: $1${NC}"
        echo "Use --help for usage information"
        exit 1
        ;;
esac

exit 0