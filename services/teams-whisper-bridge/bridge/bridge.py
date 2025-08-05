import asyncio
import websockets
import json
import numpy as np
from collections import deque
import time
import os

# Integration with on-premise WhisperLive service
WHISPERLIVE_URL = os.getenv('WHISPERLIVE_URL', 'ws://vexa-whisperlive-cpu-1:9090')
REDIS_URL = os.getenv('REDIS_URL', 'redis://vexa-redis-1:6379')
SESSION_TOKEN = os.getenv('SESSION_TOKEN', 'vexa-teams-bridge-session')

# Audio processing configuration
SAMPLE_RATE = 16000
AUDIO_BUFFER = deque(maxlen=SAMPLE_RATE * 10)  # 10 seconds buffer
WHISPER_CLIENTS = {}

class WhisperBridge:
    def __init__(self):
        self.whisperlive_ws = None
        self.session_id = f"teams-bridge-{int(time.time())}"
        
    async def connect_to_whisperlive(self):
        """Connect to existing WhisperLive service"""
        try:
            self.whisperlive_ws = await websockets.connect(WHISPERLIVE_URL)
            print(f"[Whisper Bridge] ✅ Connected to WhisperLive: {WHISPERLIVE_URL}")
            
            # Initialize WhisperLive session with on-premise configuration
            init_message = {
                "uid": self.session_id,
                "language": "en", 
                "task": "transcribe",
                "platform": "teams-bot-framework",
                "token": SESSION_TOKEN,
                "meeting_id": f"teams-meeting-{self.session_id}",
                "redis_url": REDIS_URL
            }
            
            await self.whisperlive_ws.send(json.dumps(init_message))
            print(f"[Whisper Bridge] 🎯 WhisperLive session initialized: {self.session_id}")
            
            # Start listening for transcriptions
            asyncio.create_task(self.listen_for_transcriptions())
            return True
            
        except Exception as e:
            print(f"[Whisper Bridge] ❌ Failed to connect to WhisperLive: {e}")
            return False

    async def listen_for_transcriptions(self):
        """Listen for transcription results from WhisperLive"""
        try:
            async for message in self.whisperlive_ws:
                try:
                    data = json.loads(message)
                    if data.get('text') and data['text'].strip():
                        transcription = data['text'].strip()
                        print(f"[Whisper Bridge] 🗣️ Transcription: {transcription}")
                        
                        # Broadcast to all connected Teams bot clients
                        await self.broadcast_transcription(transcription, data.get('partial', False))
                        
                except json.JSONDecodeError:
                    print(f"[Whisper Bridge] ⚠️ Invalid JSON from WhisperLive: {message}")
                    
        except Exception as e:
            print(f"[Whisper Bridge] ❌ WhisperLive listening error: {e}")

    async def broadcast_transcription(self, text, partial=False):
        """Broadcast transcription to all connected clients"""
        if not hasattr(self, 'connected_clients'):
            return
            
        message = {
            "type": "transcription",
            "text": text,
            "partial": partial,
            "timestamp": time.time(),
            "session_id": self.session_id
        }
        
        # Send to all connected Teams bot clients
        disconnected = []
        for client in self.connected_clients:
            try:
                await client.send(json.dumps(message))
            except:
                disconnected.append(client)
        
        # Clean up disconnected clients
        for client in disconnected:
            self.connected_clients.discard(client)

    async def process_audio_chunk(self, audio_data):
        """Process incoming audio from Teams bot and forward to WhisperLive"""
        try:
            if self.whisperlive_ws and self.whisperlive_ws.open:
                # Convert audio data and send to WhisperLive
                await self.whisperlive_ws.send(audio_data)
                print(f"[Whisper Bridge] 🎤 Audio chunk sent to WhisperLive ({len(audio_data)} bytes)")
            else:
                print("[Whisper Bridge] ⚠️ WhisperLive connection not available")
                
        except Exception as e:
            print(f"[Whisper Bridge] ❌ Audio processing error: {e}")

# Global bridge instance
whisper_bridge = WhisperBridge()

async def handle_teams_bot_connection(websocket, path):
    """Handle connection from Teams bot (.NET client)"""
    print(f"[Whisper Bridge] 🤖 Teams bot connected from {websocket.remote_address}")
    
    # Add to connected clients for transcription broadcast
    if not hasattr(whisper_bridge, 'connected_clients'):
        whisper_bridge.connected_clients = set()
    whisper_bridge.connected_clients.add(websocket)
    
    try:
        async for message in websocket:
            if isinstance(message, bytes):
                # Audio data from Teams bot
                print(f"[Whisper Bridge] 🎵 Received audio data: {len(message)} bytes")
                await whisper_bridge.process_audio_chunk(message)
            else:
                # Control messages
                try:
                    data = json.loads(message)
                    print(f"[Whisper Bridge] 💬 Control message: {data}")
                except json.JSONDecodeError:
                    print(f"[Whisper Bridge] ⚠️ Invalid control message: {message}")
                    
    except websockets.exceptions.ConnectionClosed:
        print("[Whisper Bridge] 🔌 Teams bot disconnected")
    except Exception as e:
        print(f"[Whisper Bridge] ❌ Connection error: {e}")
    finally:
        whisper_bridge.connected_clients.discard(websocket)

async def main():
    print("🌉 Vexa Teams-WhisperLive Bridge Starting...")
    print("=" * 50)
    
    # Connect to WhisperLive service first
    connected = await whisper_bridge.connect_to_whisperlive()
    if not connected:
        print("❌ Failed to connect to WhisperLive. Exiting.")
        return
    
    # Start WebSocket server for Teams bot connections
    print(f"[Whisper Bridge] 🚀 Starting WebSocket server on ws://0.0.0.0:8765")
    
    async with websockets.serve(handle_teams_bot_connection, "0.0.0.0", 8765, max_size=2**24):
        print("[Whisper Bridge] ✅ WebSocket server ready for Teams bot connections")
        print(f"[Whisper Bridge] 🔗 WhisperLive: {WHISPERLIVE_URL}")
        print(f"[Whisper Bridge] 🎯 Session ID: {whisper_bridge.session_id}")
        print("=" * 50)
        
        # Keep the server running
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())