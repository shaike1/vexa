#!/bin/bash
set -e

echo "=== Starting Vexa Bot Deployment ==="
cd /root/vexa

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

echo "✅ Docker is running"

# Check current services
echo "Checking current services..."
docker-compose ps

# Start services if not running
echo "Starting services..."
docker-compose --profile cpu up -d

# Wait for services to be ready
echo "Waiting for services to be ready..."
sleep 15

# Check if API Gateway is accessible
echo "Testing API Gateway..."
if curl -s -f "http://localhost:18056/" > /dev/null 2>&1; then
    echo "✅ API Gateway is accessible"
else
    echo "❌ API Gateway is not accessible"
    echo "Checking service logs..."
    docker-compose logs api-gateway
fi

# Deploy Speaker Bot
echo "=== Deploying Speaker Bot ==="
curl -X POST "http://localhost:18056/bots" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer fDWi2bGKXaNPv4rQIiJIvPM1rbYrec0zgiJKfhos" \
  -d '{
    "platform": "teams",
    "native_meeting_id": "teams-speaker-session",
    "meeting_url": "https://teams.microsoft.com/l/meetup-join/19%3ameeting_ZTYyNzlkMjgtMGM4MS00OGJkLTllMDktNjQ3ZmE4Zjg5Y2I1%40thread.v2/0?context=%7b%22Tid%22%3a%226a6c7639-7a26-4a3b-b832-507d1afc7b2c%22%2c%22Oid%22%3a%229e657b99-360d-4b53-bd13-2f78cfa4de6b%22%7d",
    "bot_name": "VexaSpeakerBot",
    "task": "speak"
  }'

echo ""
echo "Waiting 5 seconds before deploying Transcription Bot..."
sleep 5

# Deploy Transcription Bot
echo "=== Deploying Transcription Bot ==="
curl -X POST "http://localhost:18056/bots" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer fDWi2bGKXaNPv4rQIiJIvPM1rbYrec0zgiJKfhos" \
  -d '{
    "platform": "teams",
    "native_meeting_id": "teams-transcription-session",
    "meeting_url": "https://teams.microsoft.com/l/meetup-join/19%3ameeting_ZTYyNzlkMjgtMGM4MS00OGJkLTllMDktNjQ3ZmE4Zjg5Y2I1%40thread.v2/0?context=%7b%22Tid%22%3a%226a6c7639-7a26-4a3b-b832-507d1afc7b2c%22%2c%22Oid%22%3a%229e657b99-360d-4b53-bd13-2f78cfa4de6b%22%7d",
    "bot_name": "VexaTranscriptionBot",
    "task": "transcribe"
  }'

echo ""
echo "Checking bot status..."
curl -X GET "http://localhost:18056/bots/status" \
  -H "Authorization: Bearer fDWi2bGKXaNPv4rQIiJIvPM1rbYrec0zgiJKfhos"

echo ""
echo "✅ Deployment complete!"
echo "Monitor the logs with: docker-compose logs -f"