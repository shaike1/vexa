from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any
import uvicorn
import os
from .router import AIServiceRouter

app = FastAPI(title="AI Service Adapter", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True, 
    allow_methods=["*"],
    allow_headers=["*"],
)

router = AIServiceRouter()

class TextRequest(BaseModel):
    text: str
    max_tokens: Optional[int] = None
    temperature: float = 0.7

class SummarizeRequest(BaseModel):
    text: str
    max_length: Optional[int] = None

class GenerateRequest(BaseModel):
    prompt: str
    max_tokens: Optional[int] = None
    temperature: float = 0.7

@app.post("/generate")
async def generate_text(request: GenerateRequest):
    """Generate text using the most cost-effective provider"""
    try:
        response = await router.generate_text(
            prompt=request.prompt,
            max_tokens=request.max_tokens,
            temperature=request.temperature
        )
        return {
            "content": response.content,
            "token_usage": {
                "input_tokens": response.token_usage.input_tokens,
                "output_tokens": response.token_usage.output_tokens,
                "total_tokens": response.token_usage.total_tokens,
                "cost_usd": response.token_usage.cost_usd
            },
            "model": response.model,
            "provider": response.provider
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/summarize")
async def summarize_text(request: SummarizeRequest):
    """Summarize text using the most cost-effective provider"""
    try:
        response = await router.summarize(
            text=request.text,
            max_length=request.max_length
        )
        return {
            "summary": response.content,
            "token_usage": {
                "input_tokens": response.token_usage.input_tokens,
                "output_tokens": response.token_usage.output_tokens,
                "total_tokens": response.token_usage.total_tokens,
                "cost_usd": response.token_usage.cost_usd
            },
            "model": response.model,
            "provider": response.provider
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze-speakers")
async def analyze_speakers(request: TextRequest):
    """Analyze speakers in transcript using the most cost-effective provider"""
    try:
        response = await router.analyze_speakers(request.text)
        return {
            "analysis": response.content,
            "token_usage": {
                "input_tokens": response.token_usage.input_tokens,
                "output_tokens": response.token_usage.output_tokens,
                "total_tokens": response.token_usage.total_tokens,
                "cost_usd": response.token_usage.cost_usd
            },
            "model": response.model,
            "provider": response.provider
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/transcribe")
async def transcribe_audio(audio: UploadFile = File(...)):
    """Transcribe audio using Whisper"""
    try:
        audio_data = await audio.read()
        response = await router.transcribe_audio(audio_data)
        return {
            "transcript": response.content,
            "token_usage": {
                "input_tokens": response.token_usage.input_tokens,
                "output_tokens": response.token_usage.output_tokens,
                "total_tokens": response.token_usage.total_tokens,
                "cost_usd": response.token_usage.cost_usd
            },
            "model": response.model,
            "provider": response.provider
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/usage")
async def get_usage_stats():
    """Get current usage statistics and cost information"""
    return router.get_usage_stats()

@app.post("/reset-usage")
async def reset_daily_usage():
    """Reset daily usage counters (admin endpoint)"""
    router.reset_daily_usage()
    return {"message": "Daily usage counters reset"}

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "available_providers": list(router.providers.keys())}

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)