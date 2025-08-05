import asyncio
import websockets
import requests
import numpy as np
from faster_whisper import WhisperModel
from collections import deque
import time

VEXA_ENDPOINT = "https://api.vexa.ai/subtitles"
VEXA_API_KEY = "your-vexa-api-key"
WHISPER_MODEL = "tiny.en"

model = WhisperModel(WHISPER_MODEL, compute_type="int8")
AUDIO_BUFFER = deque(maxlen=16000 * 5)

async def handle_connection(websocket):
    print("Client connected")
    async for message in websocket:
        pcm_array = np.frombuffer(message, dtype=np.int16).astype(np.float32) / 32768.0
        AUDIO_BUFFER.extend(pcm_array)
        if len(AUDIO_BUFFER) > 8000:
            transcript = transcribe_live(np.array(AUDIO_BUFFER))
            if transcript.strip():
                print("Live subtitle:", transcript)
                push_to_vexa(transcript, partial=True)

def transcribe_live(audio_chunk):
    segments, _ = model.transcribe(audio_chunk, beam_size=1, condition_on_previous_text=False)
    last_text = ""
    for seg in segments:
        last_text = seg.text
    return last_text

def push_to_vexa(text, partial=False):
    payload = {"type": "subtitle","mode": "partial" if partial else "final","timestamp": time.time(),"text": text}
    headers = {"Authorization": f"Bearer {VEXA_API_KEY}"}
    try:
        r = requests.post(VEXA_ENDPOINT, json=payload, headers=headers, timeout=3)
        if r.status_code != 200:
            print("Vexa API error:", r.status_code, r.text)
    except Exception as e:
        print("Push error:", e)

async def main():
    async with websockets.serve(handle_connection, "0.0.0.0", 8765, max_size=2**24):
        print("WebSocket server running on ws://0.0.0.0:8765")
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())
