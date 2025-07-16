import os
import asyncio
import aiohttp
from typing import Optional
from .base_provider import AIProvider, AIResponse, TokenUsage

class WhisperProvider(AIProvider):
    
    def __init__(self, whisper_url: Optional[str] = None):
        self.whisper_url = whisper_url or os.getenv("WHISPER_LIVE_URL", "http://whisperlive:9090")
        
    def _calculate_processing_cost(self, text_length: int) -> float:
        # Estimate computational cost for local Whisper processing
        # This is primarily CPU/GPU time, not token-based
        return 0.0001 * (text_length / 1000)  # Very rough estimate
    
    async def generate_text(self, 
                          prompt: str, 
                          max_tokens: Optional[int] = None,
                          temperature: float = 0.7,
                          **kwargs) -> AIResponse:
        
        # Whisper is primarily for transcription, not text generation
        # This method exists for interface compatibility but should not be used
        raise NotImplementedError("Whisper provider is for transcription only, not text generation")
    
    async def summarize(self, text: str, max_length: Optional[int] = None) -> AIResponse:
        # Whisper doesn't do summarization - this should be routed to another provider
        raise NotImplementedError("Whisper provider doesn't support summarization")
    
    async def analyze_speakers(self, transcript: str) -> AIResponse:
        # Basic speaker analysis based on existing Whisper output format
        # This is more of a text processing task than AI generation
        speakers = set()
        lines = transcript.split('\n')
        
        for line in lines:
            if ':' in line:
                speaker = line.split(':')[0].strip()
                if speaker and not speaker.isdigit():
                    speakers.add(speaker)
        
        analysis = f"Detected {len(speakers)} speakers: {', '.join(sorted(speakers))}"
        
        return AIResponse(
            content=analysis,
            token_usage=TokenUsage(
                input_tokens=len(transcript) // 4,
                output_tokens=len(analysis) // 4,
                total_tokens=(len(transcript) + len(analysis)) // 4,
                cost_usd=self._calculate_processing_cost(len(transcript))
            ),
            model="whisper-local",
            provider="whisper"
        )
    
    async def transcribe_audio(self, audio_data: bytes) -> AIResponse:
        """Whisper-specific method for audio transcription"""
        try:
            async with aiohttp.ClientSession() as session:
                data = aiohttp.FormData()
                data.add_field('audio', audio_data, content_type='audio/wav')
                
                async with session.post(f"{self.whisper_url}/transcribe", data=data) as response:
                    if response.status == 200:
                        result = await response.json()
                        transcript = result.get('text', '')
                        
                        return AIResponse(
                            content=transcript,
                            token_usage=TokenUsage(
                                input_tokens=len(audio_data) // 1000,  # Rough audio size metric
                                output_tokens=len(transcript) // 4,
                                total_tokens=(len(audio_data) // 1000) + (len(transcript) // 4),
                                cost_usd=self._calculate_processing_cost(len(audio_data))
                            ),
                            model="whisper-local",
                            provider="whisper"
                        )
                    else:
                        raise RuntimeError(f"Whisper API error: {response.status}")
        except Exception as e:
            raise RuntimeError(f"Whisper transcription error: {str(e)}")
    
    def estimate_cost(self, input_text: str, task_type: str) -> float:
        return self._calculate_processing_cost(len(input_text))
    
    def get_provider_name(self) -> str:
        return "whisper"