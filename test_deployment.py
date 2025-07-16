#!/usr/bin/env python3
"""
Test the deployment by directly calling the Python subprocess
"""
import subprocess
import sys
import os

def execute_command(cmd, cwd=None):
    """Execute a command and return the result"""
    try:
        print(f"Executing: {cmd}")
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=cwd)
        print(f"Return code: {result.returncode}")
        if result.stdout:
            print(f"STDOUT:\n{result.stdout}")
        if result.stderr:
            print(f"STDERR:\n{result.stderr}")
        return result.returncode == 0
    except Exception as e:
        print(f"Error executing command: {e}")
        return False

def main():
    print("=== Testing Deployment ===")
    
    # Change to project directory
    os.chdir("/root/vexa")
    
    # Test Docker
    print("\n1. Testing Docker...")
    if not execute_command("docker --version"):
        print("❌ Docker is not available")
        return False
    
    # Check Docker Compose
    print("\n2. Testing Docker Compose...")
    if not execute_command("docker-compose --version"):
        print("❌ Docker Compose is not available")
        return False
    
    # Check current services
    print("\n3. Checking current services...")
    execute_command("docker-compose ps")
    
    # Start services
    print("\n4. Starting services...")
    if execute_command("docker-compose --profile cpu up -d"):
        print("✅ Services started successfully")
    else:
        print("❌ Failed to start services")
        return False
    
    # Wait a bit
    print("\n5. Waiting for services to be ready...")
    import time
    time.sleep(10)
    
    # Check services again
    print("\n6. Checking services after startup...")
    execute_command("docker-compose ps")
    
    # Test API endpoint
    print("\n7. Testing API endpoint...")
    if execute_command("curl -s -f http://localhost:18056/ || echo 'API not ready'"):
        print("✅ API endpoint test completed")
    else:
        print("❌ API endpoint test failed")
    
    print("\n=== Test Complete ===")
    return True

if __name__ == "__main__":
    main()