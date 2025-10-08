#!/bin/bash

# Deploy Fixed Teams Bot
# This script deploys the fixed Teams bot that resolves the "you" transcription issue

set -e

MEETING_URL="$1"

if [ -z "$MEETING_URL" ]; then
    echo "❌ Error: Meeting URL required"
    echo "Usage: $0 'https://teams.microsoft.com/meet/...'"
    exit 1
fi

echo "🚀 Deploying Fixed Teams Bot"
echo "📱 Meeting URL: $MEETING_URL"

# Ensure we're in the right directory
cd /root/vexa

echo "📦 Installing/updating dependencies..."
npm install puppeteer puppeteer-stream ws

echo "🔧 Ensuring WhisperLive is running..."
docker compose up -d vexa-whisperlive-1

echo "⏳ Waiting for services to be ready..."
sleep 10

echo "🤖 Starting Fixed Teams Bot..."
echo "👤 The bot will appear in your meeting shortly"
echo "📋 Please admit the bot when it appears in the lobby"
echo ""

# Run the fixed bot
node fixed-teams-bot.js "$MEETING_URL"