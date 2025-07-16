#!/usr/bin/env python3
"""
Example script demonstrating Gemini integration for token savings in Vexa.

This script shows how to:
1. Use the AI Service Adapter for text processing
2. Compare costs between different providers
3. Generate meeting summaries using Gemini
4. Analyze speakers with cost optimization

Usage:
    python examples/gemini_integration_example.py
"""

import asyncio
import os
import sys
import httpx
from typing import Dict, Any

# Add the ai-service-adapter to Python path for testing
sys.path.append('/root/vexa/services/ai-service-adapter')

from src.router import AIServiceRouter

async def test_ai_service_adapter():
    """Test the AI Service Adapter directly"""
    
    print("🤖 Testing AI Service Adapter")
    print("=" * 50)
    
    # Initialize the router
    router = AIServiceRouter()
    
    # Sample meeting transcript
    sample_transcript = """
    John: Good morning everyone, thanks for joining today's project review meeting.
    Sarah: Hi John, glad to be here. I have the Q3 metrics ready to share.
    Mike: Morning! I've been working on the new API endpoints we discussed last week.
    Sarah: Great! The user engagement is up 23% compared to Q2, which exceeds our target.
    John: That's fantastic news Sarah. Mike, how's the API development progressing?
    Mike: We've completed 7 out of 10 endpoints. The authentication and user management APIs are fully tested.
    John: Excellent progress. Any blockers we should address?
    Mike: Just need final approval on the rate limiting configuration from the security team.
    Sarah: I can help coordinate that. Let's schedule a follow-up next Tuesday.
    John: Perfect. Let's wrap up with action items: Sarah will coordinate security review, Mike continues API work.
    """
    
    print(f"📝 Sample transcript ({len(sample_transcript)} characters)")
    print()
    
    try:
        # Test 1: Generate meeting summary
        print("1️⃣ Testing Meeting Summary Generation")
        print("-" * 30)
        
        summary_response = await router.summarize(sample_transcript, max_length=100)
        
        print(f"✅ Summary generated using {summary_response.provider} ({summary_response.model})")
        print(f"💰 Cost: ${summary_response.token_usage.cost_usd:.6f}")
        print(f"🎯 Tokens: {summary_response.token_usage.input_tokens} in → {summary_response.token_usage.output_tokens} out")
        print(f"📄 Summary:\n{summary_response.content}")
        print()
        
        # Test 2: Analyze speakers
        print("2️⃣ Testing Speaker Analysis")
        print("-" * 30)
        
        speaker_response = await router.analyze_speakers(sample_transcript)
        
        print(f"✅ Analysis completed using {speaker_response.provider} ({speaker_response.model})")
        print(f"💰 Cost: ${speaker_response.token_usage.cost_usd:.6f}")
        print(f"🎯 Tokens: {speaker_response.token_usage.input_tokens} in → {speaker_response.token_usage.output_tokens} out")
        print(f"👥 Analysis:\n{speaker_response.content}")
        print()
        
        # Test 3: Generate custom analysis
        print("3️⃣ Testing Custom Text Generation")
        print("-" * 30)
        
        custom_prompt = f"""Based on this meeting transcript, identify:
1. Key decisions made
2. Action items assigned
3. Next steps mentioned

Transcript:
{sample_transcript}

Analysis:"""
        
        custom_response = await router.generate_text(custom_prompt, max_tokens=300)
        
        print(f"✅ Analysis generated using {custom_response.provider} ({custom_response.model})")
        print(f"💰 Cost: ${custom_response.token_usage.cost_usd:.6f}")
        print(f"🎯 Tokens: {custom_response.token_usage.input_tokens} in → {custom_response.token_usage.output_tokens} out")
        print(f"📊 Analysis:\n{custom_response.content}")
        print()
        
        # Display usage statistics
        print("4️⃣ Usage Statistics")
        print("-" * 30)
        
        stats = router.get_usage_stats()
        total_cost = (
            summary_response.token_usage.cost_usd + 
            speaker_response.token_usage.cost_usd + 
            custom_response.token_usage.cost_usd
        )
        
        print(f"💳 Total session cost: ${total_cost:.6f}")
        print(f"📈 Daily usage: {stats['daily_usage']}")
        print(f"🔧 Available providers: {stats['available_providers']}")
        print(f"⚙️  Cost optimization: {'Enabled' if stats['config']['cost_optimization_enabled'] else 'Disabled'}")
        print()
        
        # Cost comparison insight
        print("5️⃣ Cost Savings Analysis")
        print("-" * 30)
        
        # Estimate what this would cost with a more expensive model
        estimated_openai_cost = total_cost * 10  # Rough estimation
        savings_percentage = ((estimated_openai_cost - total_cost) / estimated_openai_cost) * 100
        
        print(f"🎯 Gemini cost: ${total_cost:.6f}")
        print(f"💸 Estimated OpenAI GPT-4 cost: ${estimated_openai_cost:.6f}")
        print(f"💰 Potential savings: {savings_percentage:.1f}%")
        
    except Exception as e:
        print(f"❌ Error during testing: {e}")
        print("Make sure you have GEMINI_API_KEY set in your environment")

async def test_api_endpoints():
    """Test the AI Service Adapter API endpoints"""
    
    print("\n🌐 Testing API Endpoints")
    print("=" * 50)
    
    base_url = "http://localhost:8000"
    
    # Sample data
    sample_text = "This is a test meeting about project planning and resource allocation."
    
    async with httpx.AsyncClient() as client:
        
        try:
            # Test health endpoint
            print("🏥 Testing health endpoint...")
            health_response = await client.get(f"{base_url}/health")
            if health_response.status_code == 200:
                print(f"✅ Service healthy: {health_response.json()}")
            else:
                print(f"❌ Health check failed: {health_response.status_code}")
            
            # Test summarization endpoint
            print("\n📝 Testing summarization API...")
            summary_data = {"text": sample_text, "max_length": 50}
            summary_response = await client.post(f"{base_url}/summarize", json=summary_data)
            
            if summary_response.status_code == 200:
                result = summary_response.json()
                print(f"✅ Summary: {result['summary']}")
                print(f"💰 Cost: ${result['token_usage']['cost_usd']:.6f}")
            else:
                print(f"❌ Summarization failed: {summary_response.status_code}")
            
            # Test usage endpoint
            print("\n📊 Testing usage statistics...")
            usage_response = await client.get(f"{base_url}/usage")
            if usage_response.status_code == 200:
                usage_stats = usage_response.json()
                print(f"✅ Usage stats: {usage_stats}")
            else:
                print(f"❌ Usage stats failed: {usage_response.status_code}")
                
        except httpx.ConnectError:
            print("❌ Could not connect to AI Service Adapter")
            print("💡 Make sure to start the service first:")
            print("   cd /root/vexa/services/ai-service-adapter")
            print("   python -m src.main")

async def main():
    """Main demo function"""
    
    print("🚀 Vexa Gemini Integration Demo")
    print("=" * 60)
    print()
    
    # Check environment
    gemini_key = os.getenv("GEMINI_API_KEY")
    if not gemini_key or gemini_key == "your-gemini-api-key-here":
        print("⚠️  Warning: GEMINI_API_KEY not properly configured")
        print("💡 Set your Gemini API key in .env file:")
        print("   GEMINI_API_KEY=your-actual-api-key")
        print()
    
    # Test the service adapter directly
    await test_ai_service_adapter()
    
    # Test API endpoints (optional - requires service to be running)
    await test_api_endpoints()
    
    print("\n🎉 Demo completed!")
    print("\n📋 Next Steps:")
    print("1. Set your GEMINI_API_KEY in the .env file")
    print("2. Start the AI Service Adapter: docker-compose up ai-service-adapter")
    print("3. Integrate with your existing services using the API endpoints")
    print("4. Monitor usage and costs through the /usage endpoint")

if __name__ == "__main__":
    asyncio.run(main())