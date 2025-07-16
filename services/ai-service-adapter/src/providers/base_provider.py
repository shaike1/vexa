from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, List
from dataclasses import dataclass

@dataclass
class TokenUsage:
    input_tokens: int
    output_tokens: int
    total_tokens: int
    cost_usd: float

@dataclass
class AIResponse:
    content: str
    token_usage: TokenUsage
    model: str
    provider: str

class AIProvider(ABC):
    
    @abstractmethod
    async def generate_text(self, 
                          prompt: str, 
                          max_tokens: Optional[int] = None,
                          temperature: float = 0.7,
                          **kwargs) -> AIResponse:
        pass
    
    @abstractmethod
    async def summarize(self, text: str, max_length: Optional[int] = None) -> AIResponse:
        pass
    
    @abstractmethod
    async def analyze_speakers(self, transcript: str) -> AIResponse:
        pass
    
    @abstractmethod
    def estimate_cost(self, input_text: str, task_type: str) -> float:
        pass
    
    @abstractmethod
    def get_provider_name(self) -> str:
        pass