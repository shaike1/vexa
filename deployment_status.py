#!/usr/bin/env python3
"""
Check deployment status and create deployment commands
"""
import os
import subprocess
import json
import time
import threading

# Configuration
API_BASE_URL = "http://localhost:18056"
API_TOKEN = "fDWi2bGKXaNPv4rQIiJIvPM1rbYrec0zgiJKfhos"
MEETING_URL = "https://teams.microsoft.com/l/meetup-join/19%3ameeting_ZTYyNzlkMjgtMGM4MS00OGJkLTllMDktNjQ3ZmE4Zjg5Y2I1%40thread.v2/0?context=%7b%22Tid%22%3a%226a6c7639-7a26-4a3b-b832-507d1afc7b2c%22%2c%22Oid%22%3a%229e657b99-360d-4b53-bd13-2f78cfa4de6b%22%7d"

def check_docker_and_services():
    """Check Docker and service status"""
    try:
        # Check Docker
        result = subprocess.run(["docker", "--version"], capture_output=True, text=True)
        if result.returncode == 0:
            print("✅ Docker is available")
            print(f"Docker version: {result.stdout.strip()}")
        else:
            print("❌ Docker not available")
            return False
        
        # Check Docker Compose
        result = subprocess.run(["docker-compose", "--version"], capture_output=True, text=True)
        if result.returncode == 0:
            print("✅ Docker Compose is available")
            print(f"Docker Compose version: {result.stdout.strip()}")
        else:
            print("❌ Docker Compose not available")
            return False
        
        # Check running containers
        print("\n=== Checking running containers ===")
        result = subprocess.run(["docker", "ps", "--format", "table {{.Names}}\t{{.Status}}\t{{.Ports}}"], 
                              capture_output=True, text=True)
        if result.returncode == 0:
            print("Current containers:")
            print(result.stdout)
        else:
            print("❌ Failed to check containers")
        
        return True
    except Exception as e:
        print(f"❌ Error checking Docker: {e}")
        return False

def start_services():
    """Start Docker Compose services"""
    try:
        print("=== Starting Docker Compose services ===")
        os.chdir("/root/vexa")
        
        # Start services
        result = subprocess.run(["docker-compose", "--profile", "cpu", "up", "-d"], 
                              capture_output=True, text=True)
        if result.returncode == 0:
            print("✅ Services started successfully")
            print(result.stdout)
        else:
            print("❌ Failed to start services")
            print(result.stderr)
            return False
        
        # Wait for services to be ready
        print("Waiting 15 seconds for services to be ready...")
        time.sleep(15)
        
        # Check service status
        result = subprocess.run(["docker-compose", "ps"], capture_output=True, text=True)
        if result.returncode == 0:
            print("Service status after startup:")
            print(result.stdout)
        
        return True
    except Exception as e:
        print(f"❌ Error starting services: {e}")
        return False

def deploy_bot_with_curl(bot_name, native_meeting_id, task):
    """Deploy a bot using curl"""
    try:
        payload = {
            "platform": "teams",
            "native_meeting_id": native_meeting_id,
            "meeting_url": MEETING_URL,
            "bot_name": bot_name,
            "task": task,
            "auth_mode": "guest"
        }
        
        curl_cmd = [
            "curl", "-X", "POST", f"{API_BASE_URL}/bots",
            "-H", "Content-Type: application/json",
            "-H", f"Authorization: Bearer {API_TOKEN}",
            "-d", json.dumps(payload)
        ]
        
        print(f"Deploying {bot_name} with task '{task}'...")
        result = subprocess.run(curl_cmd, capture_output=True, text=True)
        
        if result.returncode == 0:
            print(f"✅ {bot_name} deployment request sent")
            print(f"Response: {result.stdout}")
            return True
        else:
            print(f"❌ Failed to deploy {bot_name}")
            print(f"Error: {result.stderr}")
            return False
    except Exception as e:
        print(f"❌ Error deploying {bot_name}: {e}")
        return False

def check_bot_status():
    """Check bot status"""
    try:
        curl_cmd = [
            "curl", "-X", "GET", f"{API_BASE_URL}/bots/status",
            "-H", f"Authorization: Bearer {API_TOKEN}"
        ]
        
        result = subprocess.run(curl_cmd, capture_output=True, text=True)
        
        if result.returncode == 0:
            print("✅ Bot status retrieved")
            print(f"Status: {result.stdout}")
            return True
        else:
            print("❌ Failed to get bot status")
            print(f"Error: {result.stderr}")
            return False
    except Exception as e:
        print(f"❌ Error checking bot status: {e}")
        return False

def main():
    print("=== Vexa Bot Deployment System ===")
    print(f"Target Meeting URL: {MEETING_URL}")
    print(f"API Base URL: {API_BASE_URL}")
    print()
    
    # Check Docker and services
    if not check_docker_and_services():
        print("Cannot proceed - Docker not available")
        return
    
    # Start services
    if not start_services():
        print("Cannot proceed - Failed to start services")
        return
    
    # Deploy Speaker Bot
    print("\n=== Deploying Speaker Bot ===")
    if deploy_bot_with_curl("VexaSpeakerBot", "teams-speaker-session", "speak"):
        print("Speaker Bot deployment initiated")
        
        # Wait before deploying the second bot
        print("\nWaiting 5 seconds before deploying Transcription Bot...")
        time.sleep(5)
        
        # Deploy Transcription Bot
        print("\n=== Deploying Transcription Bot ===")
        if deploy_bot_with_curl("VexaTranscriptionBot", "teams-transcription-session", "transcribe"):
            print("Transcription Bot deployment initiated")
            
            # Wait and check final status
            print("\nWaiting 10 seconds before checking final status...")
            time.sleep(10)
            
            print("\n=== Final Bot Status ===")
            check_bot_status()
            
            print("\n✅ Both bots deployed successfully!")
            print("Monitor the logs with: docker-compose logs -f")
        else:
            print("❌ Failed to deploy Transcription Bot")
    else:
        print("❌ Failed to deploy Speaker Bot")

if __name__ == "__main__":
    main()