#!/usr/bin/env python3
"""
Start Docker Compose services and deploy bots
"""
import os
import subprocess
import sys
import requests
import json
import time

# Configuration
API_BASE_URL = "http://localhost:18056"  # API Gateway port from .env
API_TOKEN = "fDWi2bGKXaNPv4rQIiJIvPM1rbYrec0zgiJKfhos"
MEETING_URL = "https://teams.microsoft.com/l/meetup-join/19%3ameeting_ZTYyNzlkMjgtMGM4MS00OGJkLTllMDktNjQ3ZmE4Zjg5Y2I1%40thread.v2/0?context=%7b%22Tid%22%3a%226a6c7639-7a26-4a3b-b832-507d1afc7b2c%22%2c%22Oid%22%3a%229e657b99-360d-4b53-bd13-2f78cfa4de6b%22%7d"

def run_command(cmd, cwd=None):
    """Run a shell command and return the result"""
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=cwd)
        return result.returncode, result.stdout, result.stderr
    except Exception as e:
        return -1, "", str(e)

def check_docker():
    """Check if Docker is running"""
    returncode, stdout, stderr = run_command("docker ps")
    if returncode == 0:
        print("✅ Docker is running")
        return True
    else:
        print(f"❌ Docker is not running: {stderr}")
        return False

def start_services():
    """Start Docker Compose services"""
    print("=== Starting Docker Compose services ===")
    
    # Change to the project directory
    os.chdir("/root/vexa")
    
    # Check if services are already running
    returncode, stdout, stderr = run_command("docker-compose ps")
    if returncode == 0:
        print("Current services status:")
        print(stdout)
    
    # Start the services
    print("Starting services with CPU profile...")
    returncode, stdout, stderr = run_command("docker-compose --profile cpu up -d")
    if returncode == 0:
        print("✅ Services started successfully")
        print(stdout)
    else:
        print(f"❌ Failed to start services: {stderr}")
        return False
    
    # Wait for services to be ready
    print("Waiting for services to be ready...")
    time.sleep(15)
    
    return True

def wait_for_service(url, timeout=60):
    """Wait for a service to be ready"""
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            response = requests.get(url, timeout=5)
            if response.status_code == 200:
                return True
        except:
            pass
        time.sleep(2)
    return False

def deploy_bot(bot_name, native_meeting_id, task):
    """Deploy a bot to the Teams meeting"""
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {API_TOKEN}"
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
            print(f"Meeting ID: {result.get('id')}")
            print(f"Container ID: {result.get('bot_container_id')}")
            print(f"Status: {result.get('status')}")
            return result
        else:
            print(f"❌ Failed to deploy {bot_name}")
            print(f"Error: {response.text}")
            return None
            
    except Exception as e:
        print(f"❌ Error deploying {bot_name}: {e}")
        return None

def main():
    print("=== Vexa Bot Deployment System ===")
    
    # Check Docker
    if not check_docker():
        print("Please start Docker first")
        return
    
    # Start services
    if not start_services():
        print("Failed to start services")
        return
    
    # Wait for bot-manager to be ready
    print("Waiting for bot-manager service to be ready...")
    if not wait_for_service(f"{API_BASE_URL}/", 60):
        print("❌ Bot-manager service is not ready")
        return
    
    print("✅ Bot-manager service is ready")
    
    # Deploy Speaker Bot
    print("\n=== Deploying Speaker Bot ===")
    speaker_result = deploy_bot("VexaSpeakerBot", "teams-speaker-session", "speak")
    
    if speaker_result:
        print(f"Speaker Bot deployed - Meeting ID: {speaker_result.get('id')}")
        
        # Wait before deploying the second bot
        print("\nWaiting 5 seconds before deploying Transcription Bot...")
        time.sleep(5)
        
        # Deploy Transcription Bot
        print("\n=== Deploying Transcription Bot ===")
        transcription_result = deploy_bot("VexaTranscriptionBot", "teams-transcription-session", "transcribe")
        
        if transcription_result:
            print(f"Transcription Bot deployed - Meeting ID: {transcription_result.get('id')}")
            print("\n✅ Both bots deployed successfully!")
            print("Monitor the logs to verify both bots join the Teams meeting.")
        else:
            print("❌ Failed to deploy Transcription Bot")
    else:
        print("❌ Failed to deploy Speaker Bot")

if __name__ == "__main__":
    main()