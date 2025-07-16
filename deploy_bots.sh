#!/bin/bash

# Deploy Speaker Bot and Transcription Bot to Teams meeting

MEETING_URL="https://teams.microsoft.com/l/meetup-join/19%3ameeting_ZTYyNzlkMjgtMGM4MS00OGJkLTllMDktNjQ3ZmE4Zjg5Y2I1%40thread.v2/0?context=%7b%22Tid%22%3a%226a6c7639-7a26-4a3b-b832-507d1afc7b2c%22%2c%22Oid%22%3a%229e657b99-360d-4b53-bd13-2f78cfa4de6b%22%7d"
API_TOKEN="fDWi2bGKXaNPv4rQIiJIvPM1rbYrec0zgiJKfhos"

echo "🚀 Starting Bot Deployment Process..."

# Check if API is accessible
echo "📋 Checking API availability..."
curl -X GET http://localhost:18056/health

# Deploy Speaker Bot
echo "🎤 Deploying Speaker Bot..."
curl -X POST http://localhost:18056/bots/start \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_TOKEN" \
  -d "{
    \"meeting_url\": \"$MEETING_URL\",
    \"bot_name\": \"Speaker Bot 🎤\",
    \"platform\": \"teams\",
    \"task\": \"speak\",
    \"language\": \"en\"
  }"

echo -e "\n"

# Deploy Transcription Bot
echo "📝 Deploying Transcription Bot..."
curl -X POST http://localhost:18056/bots/start \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_TOKEN" \
  -d "{
    \"meeting_url\": \"$MEETING_URL\",
    \"bot_name\": \"Transcription Bot 📝\",
    \"platform\": \"teams\",
    \"task\": \"transcribe\",
    \"language\": \"en\"
  }"

echo -e "\n🤖 Bot deployment commands sent!"
echo "📊 Check bot status with: docker ps | grep vexa-bot"