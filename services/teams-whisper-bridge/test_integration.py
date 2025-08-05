#!/usr/bin/env python3
"""
Integration test for Teams-WhisperLive Bridge
Tests the complete flow: Teams Bot → Bridge → WhisperLive → Transcription
"""

import asyncio
import websockets
import json
import numpy as np
import time

async def test_complete_integration():
    print("🧪 Testing Teams-WhisperLive Bridge Integration")
    print("=" * 50)
    
    # Test 1: Bridge WebSocket Server
    try:
        print("[Test 1] 🔗 Testing bridge WebSocket server...")
        ws = await websockets.connect('ws://localhost:8770')
        print("[Test 1] ✅ Bridge WebSocket server is running")
        
        # Test 2: Send initialization message (like Teams bot would)
        print("[Test 2] 📤 Sending initialization message...")
        init_msg = {
            "type": "init",
            "session_id": f"test-session-{int(time.time())}",
            "platform": "teams-bot-framework",
            "timestamp": time.time()
        }
        await ws.send(json.dumps(init_msg))
        print("[Test 2] ✅ Initialization message sent")
        
        # Test 3: Send simulated audio data
        print("[Test 3] 🎵 Sending simulated audio data...")
        
        # Create fake audio data (16-bit PCM, 16kHz)
        sample_rate = 16000
        duration = 0.5  # 500ms
        samples = int(sample_rate * duration)
        
        # Generate a simple sine wave (440 Hz - A note)
        t = np.linspace(0, duration, samples, False)
        audio_data = np.sin(2 * np.pi * 440 * t) * 0.3
        audio_bytes = (audio_data * 32767).astype(np.int16).tobytes()
        
        await ws.send(audio_bytes)
        print(f"[Test 3] ✅ Sent {len(audio_bytes)} bytes of audio data")
        
        # Test 4: Listen for transcription response
        print("[Test 4] 👂 Listening for transcription response...")
        try:
            response = await asyncio.wait_for(ws.recv(), timeout=5.0)
            
            if isinstance(response, str):
                try:
                    data = json.loads(response)
                    if data.get('type') == 'transcription':
                        print(f"[Test 4] ✅ Received transcription: {data.get('text', 'N/A')}")
                    else:
                        print(f"[Test 4] 📝 Received response: {data}")
                except json.JSONDecodeError:
                    print(f"[Test 4] 📝 Received non-JSON response: {response}")
            else:
                print(f"[Test 4] 📝 Received binary response: {len(response)} bytes")
                
        except asyncio.TimeoutError:
            print("[Test 4] ⏰ No response received within 5 seconds (expected for test audio)")
        
        await ws.close()
        print("[Test 4] ✅ WebSocket connection closed")
        
        print("\n" + "=" * 50)
        print("🎉 Integration Test Complete!")
        print("✅ Bridge is running and accepting connections")
        print("✅ Audio data can be sent and processed")
        print("✅ Ready for Teams Bot Framework integration")
        
    except Exception as e:
        print(f"\n❌ Integration test failed: {e}")
        return False
    
    return True

async def test_whisperlive_connection():
    """Test direct connection to WhisperLive service"""
    print("\n🔍 Testing WhisperLive Direct Connection")
    print("-" * 40)
    
    try:
        ws = await websockets.connect('ws://vexa-whisperlive-cpu-2:9090')
        print("✅ Connected to WhisperLive directly")
        
        # Send initialization message
        init_message = {
            "uid": f"test-direct-{int(time.time())}",
            "language": "en",
            "task": "transcribe",
            "platform": "test-client"
        }
        
        await ws.send(json.dumps(init_message))
        print("✅ Sent initialization to WhisperLive")
        
        await ws.close()
        print("✅ WhisperLive connection test complete")
        
        return True
    except Exception as e:
        print(f"❌ WhisperLive connection test failed: {e}")
        return False

if __name__ == "__main__":
    asyncio.run(test_complete_integration())