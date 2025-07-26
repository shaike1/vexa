#!/usr/bin/env python3
import asyncio
import websockets
import json
import wave
import numpy as np

async def test_whisper_connection():
    """Test direct connection to WhisperLive"""
    
    # Create a simple test audio (1 second of sine wave at 440Hz)
    sample_rate = 16000  # WhisperLive expects 16kHz
    duration = 1.0  # 1 second
    frequency = 440  # A4 note
    
    t = np.linspace(0, duration, int(sample_rate * duration))
    audio_data = (np.sin(2 * np.pi * frequency * t) * 0.3 * 32767).astype(np.int16)
    
    # Convert to bytes
    audio_bytes = audio_data.tobytes()
    
    try:
        # Connect to WhisperLive through websocket-proxy
        uri = "ws://localhost:8090/ws"  # websocket-proxy endpoint
        
        print(f"Connecting to WhisperLive via proxy: {uri}")
        
        async with websockets.connect(uri) as websocket:
            print("✅ Connected to WhisperLive!")
            
            # Send configuration
            config = {
                "uid": "test-transcription-client",
                "language": "en",
                "task": "transcribe",
                "model": "base",
                "use_vad": True
            }
            
            await websocket.send(json.dumps(config))
            print("📤 Sent configuration")
            
            # Send audio data in chunks
            chunk_size = 1600  # 0.1 second chunks
            for i in range(0, len(audio_bytes), chunk_size):
                chunk = audio_bytes[i:i+chunk_size]
                await websocket.send(chunk)
                print(f"📤 Sent audio chunk {i//chunk_size + 1}")
                
                # Wait for response
                try:
                    response = await asyncio.wait_for(websocket.recv(), timeout=2.0)
                    if isinstance(response, str):
                        data = json.loads(response)
                        print(f"📥 Received: {data}")
                    else:
                        print(f"📥 Received binary data: {len(response)} bytes")
                except asyncio.TimeoutError:
                    print("⏳ No immediate response")
                
                await asyncio.sleep(0.1)
            
            # Send end marker
            await websocket.send(json.dumps({"end": True}))
            print("📤 Sent end marker")
            
            # Wait for final response
            try:
                response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                if isinstance(response, str):
                    data = json.loads(response)
                    print(f"📥 Final response: {data}")
            except asyncio.TimeoutError:
                print("⏳ No final response")
            
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_whisper_connection())