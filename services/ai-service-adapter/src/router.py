import os
import asyncio
from typing import Dict, Any, Optional, List
from dataclasses import dataclass
from .providers.gemini_provider import GeminiProvider
from .providers.whisper_provider import WhisperProvider
from .providers.base_provider import AIProvider, AIResponse

@dataclass
class RoutingConfig:
    enable_cost_optimization: bool = True
    max_gemini_tokens_per_day: int = 10000
    fallback_to_local: bool = True
    cost_threshold_usd: float = 0.01
    daily_token_usage: int = 0

class AIServiceRouter:
    
    def __init__(self):
        self.config = RoutingConfig(
            enable_cost_optimization=os.getenv("ENABLE_COST_OPTIMIZATION", "true").lower() == "true",
            max_gemini_tokens_per_day=int(os.getenv("MAX_GEMINI_TOKENS_PER_DAY", "10000")),
            fallback_to_local=os.getenv("FALLBACK_TO_LOCAL", "true").lower() == "true"
        )
        
        self.providers: Dict[str, AIProvider] = {}
        self._initialize_providers()
        
        # Simple in-memory usage tracking (in production, use Redis/database)
        self.daily_usage = {"gemini": 0, "whisper": 0}
    
    def _initialize_providers(self):
        """Initialize available AI providers"""
        try:
            self.providers["gemini"] = GeminiProvider()
        except ValueError as e:
            print(f"Gemini provider unavailable: {e}")
        
        try:
            self.providers["whisper"] = WhisperProvider()
        except Exception as e:
            print(f"Whisper provider unavailable: {e}")
    
    def _should_use_gemini(self, task_type: str, input_text: str) -> bool:
        """Determine if Gemini should be used based on cost optimization rules"""
        
        if not self.config.enable_cost_optimization:
            return "gemini" in self.providers
        
        # Check daily token limits
        if self.daily_usage["gemini"] >= self.config.max_gemini_tokens_per_day:
            return False
        
        # Always use Whisper for transcription tasks
        if task_type == "transcribe":
            return False
        
        # Use Gemini for text processing tasks if available and within limits
        if task_type in ["summarize", "analyze_speakers", "generate_text"]:
            if "gemini" not in self.providers:
                return False
            
            # Estimate cost and check threshold
            estimated_cost = self.providers["gemini"].estimate_cost(input_text, task_type)
            return estimated_cost <= self.config.cost_threshold_usd
        
        return False
    
    def _select_provider(self, task_type: str, input_text: str = "") -> AIProvider:
        """Select the best provider for the given task"""
        
        # Special handling for transcription
        if task_type == "transcribe":
            if "whisper" in self.providers:
                return self.providers["whisper"]
            else:
                raise RuntimeError("No transcription provider available")
        
        # For text processing tasks, use cost optimization logic
        if self._should_use_gemini(task_type, input_text):
            return self.providers["gemini"]
        elif "whisper" in self.providers and task_type == "analyze_speakers":
            # Fallback to basic Whisper speaker analysis
            return self.providers["whisper"]
        elif self.config.fallback_to_local and "whisper" in self.providers:
            return self.providers["whisper"]
        else:
            raise RuntimeError(f"No suitable provider available for task: {task_type}")
    
    def _update_usage_tracking(self, provider_name: str, tokens_used: int):
        """Update daily usage tracking"""
        self.daily_usage[provider_name] += tokens_used
    
    async def generate_text(self, 
                          prompt: str, 
                          max_tokens: Optional[int] = None,
                          temperature: float = 0.7,
                          **kwargs) -> AIResponse:
        
        provider = self._select_provider("generate_text", prompt)
        response = await provider.generate_text(prompt, max_tokens, temperature, **kwargs)
        self._update_usage_tracking(provider.get_provider_name(), response.token_usage.total_tokens)
        return response
    
    async def summarize(self, text: str, max_length: Optional[int] = None) -> AIResponse:
        provider = self._select_provider("summarize", text)
        response = await provider.summarize(text, max_length)
        self._update_usage_tracking(provider.get_provider_name(), response.token_usage.total_tokens)
        return response
    
    async def analyze_speakers(self, transcript: str) -> AIResponse:
        provider = self._select_provider("analyze_speakers", transcript)
        response = await provider.analyze_speakers(transcript)
        self._update_usage_tracking(provider.get_provider_name(), response.token_usage.total_tokens)
        return response
    
    async def transcribe_audio(self, audio_data: bytes) -> AIResponse:
        provider = self._select_provider("transcribe")
        if hasattr(provider, 'transcribe_audio'):
            response = await provider.transcribe_audio(audio_data)
            self._update_usage_tracking(provider.get_provider_name(), response.token_usage.total_tokens)
            return response
        else:
            raise RuntimeError("Selected provider doesn't support audio transcription")
    
    def get_usage_stats(self) -> Dict[str, Any]:
        """Get current usage statistics"""
        total_cost_estimate = 0
        for provider_name, usage in self.daily_usage.items():
            if provider_name in self.providers:
                # Rough cost estimate
                if provider_name == "gemini":
                    total_cost_estimate += (usage / 1_000_000) * 0.075  # Rough input token cost
        
        return {
            "daily_usage": self.daily_usage,
            "estimated_daily_cost_usd": total_cost_estimate,
            "available_providers": list(self.providers.keys()),
            "config": {
                "cost_optimization_enabled": self.config.enable_cost_optimization,
                "max_gemini_tokens": self.config.max_gemini_tokens_per_day,
                "fallback_enabled": self.config.fallback_to_local
            }
        }
    
    def reset_daily_usage(self):
        """Reset daily usage counters (call this daily via cron job)"""
        self.daily_usage = {"gemini": 0, "whisper": 0}