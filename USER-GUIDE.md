# 🎯 Vexa AI User Guide - Test Your Transcription Bot

**Complete guide for testing Vexa AI transcription with your meetings**

## 🚀 Quick Start - 3 Steps to Transcription

### Step 1: Get Your Meeting Bot Running (2 minutes)

```bash
# 1. Deploy Vexa stack (one command)
./deploy-vexa.sh

# 2. Wait for "🎉 DEPLOYMENT COMPLETED" message
# 3. All services will be running automatically
```

### Step 2: Join a Teams Meeting & Request Bot (30 seconds)

```bash
# Copy this command and replace YOUR_TEAMS_URL:
curl -X POST http://localhost:18056/bots \
  -H "Content-Type: application/json" \
  -H "X-API-Key: token" \
  -d '{
    "platform": "teams",
    "native_meeting_id": "your-meeting-123",
    "meeting_url": "YOUR_TEAMS_URL_HERE",
    "bot_name": "VO Assist",
    "language": "en",
    "task": "transcribe"
  }'
```

**📋 How to get your Teams URL:**
1. Join your Teams meeting
2. Copy the meeting URL from your browser address bar
3. Paste it in the `meeting_url` field above

### Step 3: See Real-Time Transcription (instantly)

```bash
# Get live transcription as you speak:
curl -H "X-API-Key: token" \
  http://localhost:18056/transcripts/teams/your-meeting-123
```

**🎉 That's it! You'll see your speech transcribed in real-time!**

---

## 🔥 Advanced Features

### 1. Web Dashboard Access

- **API Documentation**: http://localhost:18056/docs
- **Admin Dashboard**: http://localhost:18057/docs  
- **System Health**: http://localhost:19000/status
- **Service Monitor**: http://localhost:18085 (Traefik)

### 2. Multi-Language Transcription

```bash
# Spanish transcription
curl -X POST http://localhost:18056/bots \
  -H "Content-Type: application/json" \
  -H "X-API-Key: token" \
  -d '{
    "platform": "teams",
    "meeting_url": "YOUR_TEAMS_URL",
    "bot_name": "VO Assist ES",
    "language": "es",
    "task": "transcribe"
  }'

# Supports 99 languages: en, es, fr, de, it, pt, ru, ja, ko, zh, ar, hi, etc.
```

### 3. Real-Time Translation

```bash
# Transcribe English meeting, get Spanish translation
curl -X POST http://localhost:18056/bots \
  -H "Content-Type: application/json" \
  -H "X-API-Key: token" \
  -d '{
    "platform": "teams",
    "meeting_url": "YOUR_TEAMS_URL",
    "bot_name": "VO Assist Translator",
    "language": "es",
    "source_language": "en",
    "task": "transcribe_translate"
  }'
```

---

## 🤖 AI Meeting Minutes with n8n (Coming Soon)

### Current Status:
✅ **Real-time transcription** - Working now  
✅ **Multi-language support** - 99 languages  
🚧 **AI summarization** - Coming in next release  
🚧 **n8n workflow integration** - Available separately  

### AI Features Roadmap:
- **Smart Meeting Summary**: Key points, action items, decisions
- **Speaker Recognition**: Who said what 
- **Sentiment Analysis**: Meeting mood and engagement
- **Follow-up Tasks**: Automatic task extraction
- **CRM Integration**: Auto-update customer records

### n8n Integration Preview:

```javascript
// Example n8n workflow (will be available)
{
  "trigger": "meeting_completed",
  "actions": [
    {
      "node": "vexa_transcription",
      "action": "get_transcript",
      "meeting_id": "{{meeting_id}}"
    },
    {
      "node": "openai_gpt4",
      "action": "summarize",
      "prompt": "Create meeting minutes from: {{transcript}}"
    },
    {
      "node": "email",
      "action": "send_summary",
      "to": "{{participants}}"
    }
  ]
}
```

---

## 📱 User-Friendly Testing Scenarios

### Scenario 1: Solo Testing
```bash
# 1. Start a Teams meeting by yourself
# 2. Deploy bot using the commands above
# 3. Talk to yourself - see transcription appear
# 4. Perfect for testing language accuracy
```

### Scenario 2: Team Meeting  
```bash
# 1. Join team meeting
# 2. Tell participants "I'm testing an AI transcription bot"
# 3. Deploy bot - everyone will see "VO Assist" join
# 4. Continue meeting normally - get full transcript
```

### Scenario 3: Multilingual Meeting
```bash
# 1. Have participants speak different languages
# 2. Deploy bot with "language": "auto" 
# 3. Watch it auto-detect and transcribe each language
# 4. Perfect for international teams
```

---

## 🎓 Demo Script for Impressive Results

**Copy this script to demonstrate Vexa AI power:**

```bash
# Demo Script - Show this to colleagues/investors

echo "🤖 VEXA AI TRANSCRIPTION DEMO"
echo "============================="
echo

echo "1. Starting Vexa AI stack..."
./deploy-vexa.sh --quiet --device cpu --bot-name "Demo Bot"

echo
echo "2. Joining Teams meeting with AI bot..."
curl -X POST http://localhost:18056/bots \
  -H "Content-Type: application/json" \
  -H "X-API-Key: token" \
  -d '{
    "platform": "teams",
    "meeting_url": "PASTE_MEETING_URL_HERE",
    "bot_name": "Vexa AI Demo",
    "language": "en",
    "task": "transcribe"
  }'

echo
echo "3. Now speak in the meeting and watch real-time transcription:"
echo "   curl -H 'X-API-Key: token' http://localhost:18056/transcripts/teams/demo-meeting"

echo
echo "🎉 Demo complete! Bot joined meeting and transcribing in real-time!"
```

---

## 🆘 Troubleshooting for Users

### Bot Won't Join Meeting
```bash
# Check if services are running
docker-compose ps

# Check API health
curl http://localhost:18056/health

# Check logs
docker-compose logs bot-manager
```

### No Transcription Appearing  
```bash
# Check WhisperLive logs
docker-compose logs whisperlive-cpu

# Verify bot is connected
curl -H "X-API-Key: token" http://localhost:18056/bots
```

### Bot Gets Removed from Meeting
- **Cause**: Some Teams settings auto-remove bots
- **Solution**: Meeting organizer should manually admit bot
- **Prevention**: Use "Allow anonymous users" in Teams settings

---

## 📞 Support & Community

- **Discord**: [Join Community](https://discord.gg/Ga9duGkVz9)
- **GitHub Issues**: [Report Problems](https://github.com/Vexa-ai/vexa/issues)
- **Documentation**: [Full Docs](https://docs.vexa.ai)
- **API Reference**: http://localhost:18056/docs (after deployment)

---

### 💡 Pro Tips

1. **Test with yourself first** - Start solo meeting, deploy bot, talk to see accuracy
2. **Use descriptive bot names** - "Q4 Meeting Transcriber" instead of generic names  
3. **Check language detection** - Vexa auto-detects 99 languages
4. **Save meeting IDs** - Use consistent IDs to retrieve transcripts later
5. **Monitor health dashboard** - Keep http://localhost:19000/status bookmarked

**🎯 Remember**: Vexa is designed to be "Build on Top. In Hours, Not Months" - exactly what you've experienced!