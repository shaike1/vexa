#!/usr/bin/env python3
"""
Deploy both Speaker Bot and Transcription Bot to a Teams meeting
"""
import requests
import json
import time
import sys

# Configuration
API_BASE_URL = "http://localhost:18056"
API_TOKEN = "fDWi2bGKXaNPv4rQIiJIvPM1rbYrec0zgiJKfhos"
MEETING_URL = "https://teams.microsoft.com/l/meetup-join/19%3ameeting_YjE1NzQ1YjUtNzAwNC00NzNmLWI3NzMtNGUxMjA3NzM4YzNj%40thread.v2/0?context=%7b%22Tid%22%3a%2268d7b20e-4c4e-4e29-a0fb-b0b8b7f7a491%22%2c%22Oid%22%3a%22f9e2a29a-26bb-4d72-bb4c-94b4bd4a5749%22%7d&anon=true"

def deploy_bot(bot_name, native_meeting_id, task):
    """Deploy a bot to the Teams meeting"""
    headers = {
        "Content-Type": "application/json",
        "X-API-Key": API_TOKEN
    }
    
    payload = {
        "platform": "teams",
        "native_meeting_id": native_meeting_id,
        "meeting_url": MEETING_URL,
        "bot_name": bot_name,
        "task": task,
        "auth_mode": "guest"
    }
    
    print(f"Deploying {bot_name} with task '{task}'...")
    print(f"Payload: {json.dumps(payload, indent=2)}")
    
    try:
        response = requests.post(
            f"{API_BASE_URL}/bots",
            headers=headers,
            json=payload,
            timeout=30
        )
        
        print(f"Response Status: {response.status_code}")
        print(f"Response Headers: {dict(response.headers)}")
        
        if response.status_code == 201:
            result = response.json()
            print(f"✅ {bot_name} deployed successfully!")
            print(f"Meeting ID: {result.get('id')}")
            print(f"Container ID: {result.get('bot_container_id')}")
            print(f"Status: {result.get('status')}")
            return result
        else:
            print(f"❌ Failed to deploy {bot_name}")
            print(f"Error: {response.text}")
            return None
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Connection error deploying {bot_name}: {e}")
        return None
    except Exception as e:
        print(f"❌ Unexpected error deploying {bot_name}: {e}")
        return None

def check_service_health():
    """Check if the bot-manager service is available"""
    try:
        response = requests.get(f"{API_BASE_URL}/", timeout=10)
        if response.status_code == 200:
            print("✅ Bot-manager service is running")
            return True
        else:
            print(f"❌ Bot-manager service returned status {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"❌ Cannot reach bot-manager service: {e}")
        return False

def get_bot_status():
    """Get the status of running bots"""
    headers = {
        "Authorization": f"Bearer {API_TOKEN}"
    }
    
    try:
        response = requests.get(f"{API_BASE_URL}/bots/status", headers=headers, timeout=10)
        if response.status_code == 200:
            status = response.json()
            print(f"✅ Current running bots: {len(status.get('running_bots', []))}")
            for bot in status.get('running_bots', []):
                print(f"  - {bot.get('container_name')} ({bot.get('status')})")
            return status
        else:
            print(f"❌ Failed to get bot status: {response.status_code}")
            return None
    except requests.exceptions.RequestException as e:
        print(f"❌ Error getting bot status: {e}")
        return None

def main():
    print("=== Vexa Bot Deployment Script ===")
    print(f"Target Meeting URL: {MEETING_URL}")
    print(f"API Base URL: {API_BASE_URL}")
    print()
    
    # Check service health
    if not check_service_health():
        print("Cannot proceed - bot-manager service is not available")
        sys.exit(1)
    
    # Get current bot status
    print("\n=== Current Bot Status ===")
    get_bot_status()
    
    # Deploy Speaker Bot
    print("\n=== Deploying Speaker Bot ===")
    speaker_result = deploy_bot("VexaSpeakerBot", "teams-speaker-session", "speak")
    
    if speaker_result:
        print(f"Speaker Bot deployed - Meeting ID: {speaker_result.get('id')}")
        
        # Wait a moment before deploying the second bot
        print("\nWaiting 3 seconds before deploying Transcription Bot...")
        time.sleep(3)
        
        # Deploy Transcription Bot
        print("\n=== Deploying Transcription Bot ===")
        transcription_result = deploy_bot("VexaTranscriptionBot", "teams-transcription-session", "transcribe")
        
        if transcription_result:
            print(f"Transcription Bot deployed - Meeting ID: {transcription_result.get('id')}")
            
            # Wait and check final status
            print("\nWaiting 5 seconds before checking final status...")
            time.sleep(5)
            
            print("\n=== Final Bot Status ===")
            get_bot_status()
            
            print("\n✅ Both bots deployed successfully!")
            print("Monitor the logs to verify both bots join the Teams meeting.")
        else:
            print("❌ Failed to deploy Transcription Bot")
    else:
        print("❌ Failed to deploy Speaker Bot")

if __name__ == "__main__":
    main()