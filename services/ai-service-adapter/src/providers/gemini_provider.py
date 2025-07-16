import os
import asyncio
from typing import Optional, Dict, Any
import google.generativeai as genai
from .base_provider import AIProvider, AIResponse, TokenUsage

class GeminiProvider(AIProvider):
    
    def __init__(self, api_key: Optional[str] = None, model: str = "gemini-1.5-flash"):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        
        # Try API key first, then fall back to application default credentials
        if self.api_key and self.api_key != "your-gemini-api-key-here":
            genai.configure(api_key=self.api_key)
        else:
            # Try using application default credentials
            try:
                import google.auth
                import google.auth.transport.requests
                
                # Get default credentials
                credentials, project_id = google.auth.default()
                
                # Configure with credentials
                genai.configure(credentials=credentials)
                print(f"Using Google Application Default Credentials for project: {project_id}")
            except Exception as e:
                raise ValueError(f"No valid authentication found. Either set GEMINI_API_KEY or run 'gcloud auth application-default login'. Error: {e}")
        self.model_name = model
        self.model = genai.GenerativeModel(model)
        
        # Pricing per 1M tokens (approximate)
        self.pricing = {
            "gemini-1.5-flash": {"input": 0.075, "output": 0.30},
            "gemini-1.5-pro": {"input": 3.50, "output": 10.50}
        }
    
    def _calculate_cost(self, input_tokens: int, output_tokens: int) -> float:
        pricing = self.pricing.get(self.model_name, self.pricing["gemini-1.5-flash"])
        input_cost = (input_tokens / 1_000_000) * pricing["input"]
        output_cost = (output_tokens / 1_000_000) * pricing["output"]
        return input_cost + output_cost
    
    def _estimate_tokens(self, text: str) -> int:
        # Rough estimation: ~4 characters per token
        return len(text) // 4
    
    async def generate_text(self, 
                          prompt: str, 
                          max_tokens: Optional[int] = None,
                          temperature: float = 0.7,
                          **kwargs) -> AIResponse:
        
        generation_config = genai.types.GenerationConfig(
            temperature=temperature,
            max_output_tokens=max_tokens
        )
        
        try:
            response = await asyncio.to_thread(
                self.model.generate_content, 
                prompt, 
                generation_config=generation_config
            )
            
            input_tokens = self._estimate_tokens(prompt)
            output_tokens = self._estimate_tokens(response.text)
            total_tokens = input_tokens + output_tokens
            cost = self._calculate_cost(input_tokens, output_tokens)
            
            return AIResponse(
                content=response.text,
                token_usage=TokenUsage(
                    input_tokens=input_tokens,
                    output_tokens=output_tokens, 
                    total_tokens=total_tokens,
                    cost_usd=cost
                ),
                model=self.model_name,
                provider="gemini"
            )
        except Exception as e:
            raise RuntimeError(f"Gemini API error: {str(e)}")
    
    async def summarize(self, text: str, max_length: Optional[int] = None) -> AIResponse:
        length_instruction = f" in approximately {max_length} words" if max_length else ""
        prompt = f"""Summarize the following meeting transcript{length_instruction}. Focus on key points, decisions, and action items:

{text}

Summary:"""
        
        return await self.generate_text(prompt, max_tokens=max_length*2 if max_length else 500)
    
    async def analyze_speakers(self, transcript: str) -> AIResponse:
        prompt = f"""Analyze the following meeting transcript and identify distinct speakers. For each speaker, provide:
1. A unique identifier (Speaker A, B, C, etc.)
2. Their apparent role or expertise based on their contributions
3. Key topics they discussed

Transcript:
{transcript}

Analysis:"""
        
        return await self.generate_text(prompt, max_tokens=800)
    
    def estimate_cost(self, input_text: str, task_type: str) -> float:
        input_tokens = self._estimate_tokens(input_text)
        
        # Estimate output tokens based on task type
        output_estimates = {
            "summarize": min(input_tokens // 4, 200),
            "analyze_speakers": min(input_tokens // 3, 300),
            "generate_text": min(input_tokens // 2, 500)
        }
        
        output_tokens = output_estimates.get(task_type, 200)
        return self._calculate_cost(input_tokens, output_tokens)
    
    def get_provider_name(self) -> str:
        return "gemini"