#!/usr/bin/env python3

import subprocess
import json
import time

def deploy_bots():
    """Deploy both Speaker Bot and Transcription Bot directly using docker commands"""
    
    meeting_url = "https://teams.microsoft.com/l/meetup-join/19%3ameeting_ZTYyNzlkMjgtMGM4MS00OGJkLTllMDktNjQ3ZmE4Zjg5Y2I1%40thread.v2/0?context=%7b%22Tid%22%3a%226a6c7639-7a26-4a3b-b832-507d1afc7b2c%22%2c%22Oid%22%3a%229e657b99-360d-4b53-bd13-2f78cfa4de6b%22%7d"
    
    print("🚀 Deploying Bots via Direct Docker Commands...")
    
    # Speaker Bot Configuration
    speaker_config = {
        "meetingUrl": meeting_url,
        "botName": "Speaker Bot 🎤",
        "platform": "teams",
        "task": "speak",
        "language": "en",
        "connectionId": "speaker-api-001",
        "token": "test-token",
        "nativeMeetingId": "api-meeting-001",
        "redisUrl": "redis://redis:6379/0",
        "automaticLeave": {
            "waitingRoomTimeout": 300,
            "noOneJoinedTimeout": 600,
            "everyoneLeftTimeout": 180
        }
    }
    
    # Transcription Bot Configuration
    transcription_config = {
        "meetingUrl": meeting_url,
        "botName": "Transcription Bot 📝",
        "platform": "teams",
        "task": "transcribe",
        "language": "en",
        "connectionId": "transcription-api-002",
        "token": "test-token",
        "nativeMeetingId": "api-meeting-002",
        "redisUrl": "redis://redis:6379/0",
        "automaticLeave": {
            "waitingRoomTimeout": 300,
            "noOneJoinedTimeout": 600,
            "everyoneLeftTimeout": 180
        }
    }
    
    # Deploy Speaker Bot
    print("🎤 Deploying Speaker Bot...")
    speaker_cmd = [
        "docker", "run", "-d",
        "--name", "speaker-bot-api",
        "--network", "vexa_vexa_default",
        "-e", f"BOT_CONFIG={json.dumps(speaker_config)}",
        "-e", "WHISPER_LIVE_URL=ws://whisperlive-cpu:9090",
        "vexa-bot:node-proxy-fix"
    ]
    
    try:
        result = subprocess.run(speaker_cmd, capture_output=True, text=True)
        if result.returncode == 0:
            print(f"✅ Speaker Bot deployed: {result.stdout.strip()}")
        else:
            print(f"❌ Speaker Bot failed: {result.stderr}")
    except Exception as e:
        print(f"❌ Error deploying Speaker Bot: {e}")
    
    time.sleep(2)
    
    # Deploy Transcription Bot
    print("📝 Deploying Transcription Bot...")
    transcription_cmd = [
        "docker", "run", "-d",
        "--name", "transcription-bot-api",
        "--network", "vexa_vexa_default",
        "-e", f"BOT_CONFIG={json.dumps(transcription_config)}",
        "-e", "WHISPER_LIVE_URL=ws://whisperlive-cpu:9090",
        "vexa-bot:node-proxy-fix"
    ]
    
    try:
        result = subprocess.run(transcription_cmd, capture_output=True, text=True)
        if result.returncode == 0:
            print(f"✅ Transcription Bot deployed: {result.stdout.strip()}")
        else:
            print(f"❌ Transcription Bot failed: {result.stderr}")
    except Exception as e:
        print(f"❌ Error deploying Transcription Bot: {e}")
    
    print("\n🤖 Bot deployment completed!")
    print("📊 Check status with: docker ps | grep -E '(speaker-bot-api|transcription-bot-api)'")
    print("📋 Monitor logs with: docker logs speaker-bot-api --follow")

if __name__ == "__main__":
    deploy_bots()