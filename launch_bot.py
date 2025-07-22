#!/usr/bin/env python3
"""
Modern Vexa Bot Deployment Script
Uses the current API Gateway and configuration
"""
import requests
import json
import time
import sys
from datetime import datetime

# Current configuration
API_BASE_URL = "http://localhost:18056"
API_TOKEN = "1dpfxVdhVrQYbyjweVYO06nGHtkaHxuSp23joSkg"
MEETING_URL = "https://teams.microsoft.com/l/meetup-join/19%3ameeting_YmNjMDIyMGUtMjNhOC00ZTA0LWEzMGMtZjkxMzI0NTk0MzEw%40thread.v2/0?context=%7b%22Tid%22%3a%226a6c7639-7a26-4a3b-b832-507d1afc7b2c%22%2c%22Oid%22%3a%22408dd64d-22eb-4693-b56d-1f88675a3170%22%7d"

def check_services():
    """Check if core services are running"""
    services = {
        "API Gateway": f"{API_BASE_URL}/",
        "Admin API": "http://localhost:18057/admin/users",
        "Transcription Collector": "http://localhost:18123/health",
        "WebSocket Proxy": "http://localhost:8088/health"
    }
    
    print("🔍 Checking service health...")
    all_healthy = True
    
    for name, url in services.items():
        try:
            if name == "Admin API":
                headers = {"X-Admin-API-Key": "token"}
                response = requests.get(url, headers=headers, timeout=5)
            else:
                response = requests.get(url, timeout=5)
            
            if response.status_code in [200, 404]:  # 404 is OK for health endpoints that don't exist yet
                print(f"✅ {name}: Running")
            else:
                print(f"⚠️ {name}: Status {response.status_code}")
                all_healthy = False
        except requests.exceptions.RequestException as e:
            print(f"❌ {name}: Not responding ({e})")
            all_healthy = False
    
    return all_healthy

def deploy_bot(meeting_url=None, bot_name=None):
    """Deploy a bot to the Teams meeting"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    meeting_url = meeting_url or MEETING_URL
    bot_name = bot_name or f"VexaAI-Bot-{timestamp}"
    native_meeting_id = f"meeting_launch_{timestamp}"
    
    headers = {
        "Content-Type": "application/json",
        "X-API-Key": API_TOKEN
    }
    
    payload = {
        "platform": "teams",
        "native_meeting_id": native_meeting_id,
        "meeting_url": meeting_url,
        "bot_name": bot_name,
        "language": "en",
        "task": "transcribe",
        "auth_mode": "guest"
    }
    
    print(f"🚀 Deploying {bot_name}...")
    print(f"📱 Meeting URL: {meeting_url}")
    print(f"🆔 Meeting ID: {native_meeting_id}")
    print()
    
    try:
        response = requests.post(
            f"{API_BASE_URL}/bots",
            headers=headers,
            json=payload,
            timeout=30
        )
        
        print(f"Response Status: {response.status_code}")
        
        if response.status_code == 201:
            result = response.json()
            print(f"✅ {bot_name} deployed successfully!")
            print(f"📊 Meeting Database ID: {result.get('id')}")
            print(f"🐳 Container ID: {result.get('bot_container_id', 'N/A')[:12]}...")
            print(f"📈 Status: {result.get('status')}")
            print(f"⏰ Start Time: {result.get('start_time')}")
            print()
            
            # Provide monitoring information
            print("📋 Monitoring Commands:")
            print(f"  Docker logs: docker logs {result.get('bot_container_id', 'CONTAINER_ID')[:12]} -f")
            print(f"  Transcripts:  curl -H 'X-API-Key: {API_TOKEN}' '{API_BASE_URL}/transcripts/teams/{native_meeting_id}'")
            print(f"  Bot Status:   curl -H 'X-API-Key: {API_TOKEN}' '{API_BASE_URL}/bots/status'")
            print()
            
            return result
        else:
            print(f"❌ Failed to deploy {bot_name}")
            print(f"Error Response: {response.text}")
            return None
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Connection error: {e}")
        return None
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return None

def check_transcription(native_meeting_id, max_attempts=5):
    """Check for transcriptions after bot deployment"""
    headers = {"X-API-Key": API_TOKEN}
    
    for attempt in range(max_attempts):
        try:
            response = requests.get(
                f"{API_BASE_URL}/transcripts/teams/{native_meeting_id}",
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 200:
                result = response.json()
                segments = result.get('segments', [])
                if segments:
                    print(f"🎉 Found {len(segments)} transcription segments!")
                    for segment in segments[-3:]:  # Show last 3 segments
                        print(f"  📝 [{segment.get('start', '0')}s-{segment.get('end', '0')}s]: {segment.get('text', '')}")
                    return True
                else:
                    print(f"⏳ Attempt {attempt + 1}/{max_attempts}: No transcriptions yet...")
            else:
                print(f"⚠️ Attempt {attempt + 1}/{max_attempts}: API returned {response.status_code}")
                
        except requests.exceptions.RequestException as e:
            print(f"❌ Attempt {attempt + 1}/{max_attempts}: Connection error: {e}")
        
        if attempt < max_attempts - 1:
            time.sleep(10)  # Wait 10 seconds between attempts
    
    print("ℹ️ No transcriptions found yet. The bot may need more time or may need to be admitted to the meeting.")
    return False

def main():
    print("🤖 === Vexa Bot Deployment Script === 🤖")
    print(f"🌐 API Gateway: {API_BASE_URL}")
    print(f"📅 Timestamp: {datetime.now().isoformat()}")
    print()
    
    # Check services first
    if not check_services():
        print("⚠️ Some services are not responding. Proceeding anyway...")
        print()
    
    # Deploy bot
    meeting_url = sys.argv[1] if len(sys.argv) > 1 else MEETING_URL
    bot_name = sys.argv[2] if len(sys.argv) > 2 else None
    
    result = deploy_bot(meeting_url, bot_name)
    
    if result:
        native_meeting_id = result.get('native_meeting_id') or 'unknown'
        
        print("⏳ Waiting 30 seconds for bot to start and join meeting...")
        time.sleep(30)
        
        print("🔍 Checking for transcriptions...")
        check_transcription(native_meeting_id)
        
        print()
        print("✅ Bot deployment completed!")
        print("👥 Make sure to admit the bot from the Teams meeting waiting room")
        print("🎤 Speak clearly in the meeting to test transcription")
        print()
        print("📊 Monitor the bot with:")
        print(f"   docker ps | grep vexa-bot")
        print(f"   docker logs {result.get('bot_container_id', 'CONTAINER_ID')[:12]} -f")
    else:
        print("❌ Bot deployment failed!")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] in ['-h', '--help']:
        print("Usage: python3 launch_bot.py [MEETING_URL] [BOT_NAME]")
        print("Example: python3 launch_bot.py 'https://teams.microsoft.com/...' 'MyBot'")
        sys.exit(0)
    
    main()