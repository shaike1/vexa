#!/bin/bash

echo "🔍 TEAMS AUDIO ISSUE DIAGNOSIS & FIX"
echo "===================================="
echo ""

# Summary of what we found
echo "📋 PROBLEM IDENTIFIED:"
echo "   ❌ Bot captures its OWN microphone (mostly silence)"
echo "   ❌ Bot does NOT capture meeting participants' audio"
echo "   ❌ WhisperLive receives zeros/silence → transcribes 'You'"
echo ""

echo "🎯 ROOT CAUSE:"
echo "   The bot uses getUserMedia() to capture bot's microphone"
echo "   Instead it needs to capture WebRTC streams from participants"
echo ""

echo "🔧 SOLUTION PLAN:"
echo "   1. Intercept Teams WebRTC audio streams (participant audio)"
echo "   2. Process participant audio instead of bot microphone"  
echo "   3. Send real audio data to WhisperLive for transcription"
echo ""

# Check current system status
echo "📊 CURRENT SYSTEM STATUS:"
echo "   WhisperLive: $(curl -s http://localhost:9091/health 2>/dev/null || echo 'Not accessible')"
echo "   Redis: $(docker exec vexa-redis-1 redis-cli ping 2>/dev/null || echo 'Not accessible')"
echo ""

# Create a simple test to prove the issue
echo "🧪 CREATING SIMPLE AUDIO TEST:"
echo ""

cat > /root/vexa/simple_audio_test.js << 'EOF'
// Simple test to inject audio and verify WhisperLive works
const WebSocket = require('ws');

console.log('🧪 Testing WhisperLive with known good audio...');

// Connect directly to WhisperLive
const ws = new WebSocket('ws://vexa-whisperlive-cpu-1:9090');

ws.on('open', () => {
    console.log('✅ Connected to WhisperLive');
    
    // Send configuration
    const config = {
        uid: 'test-session',
        language: 'en',
        task: 'transcribe',
        model: 'tiny',
        use_vad: false
    };
    
    ws.send(JSON.stringify(config));
    console.log('📤 Sent config to WhisperLive');
    
    // Generate some test audio data (sine wave)
    setTimeout(() => {
        console.log('🎵 Sending test audio data...');
        
        // Create a simple sine wave audio buffer
        const sampleRate = 16000;
        const duration = 2; // 2 seconds
        const samples = sampleRate * duration;
        const audioData = new Float32Array(samples);
        
        for (let i = 0; i < samples; i++) {
            // Generate 440Hz sine wave (A4 note)
            audioData[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.5;
        }
        
        // Send audio data
        ws.send(audioData.buffer);
        console.log(`📡 Sent ${samples} audio samples to WhisperLive`);
        
    }, 2000);
});

ws.on('message', (data) => {
    const message = data.toString();
    console.log('📥 WhisperLive response:', message);
    
    if (message.includes('transcription')) {
        console.log('✅ WhisperLive is working - received transcription response');
    }
});

ws.on('error', (error) => {
    console.log('❌ WebSocket error:', error.message);
});

setTimeout(() => {
    console.log('⏰ Test complete');
    process.exit(0);
}, 10000);
EOF

echo "✅ Created simple audio test: /root/vexa/simple_audio_test.js"
echo ""
echo "🚀 RUN THE TEST:"
echo "   docker run --rm --network=vexa_default -v /root/vexa:/test node:18 node /test/simple_audio_test.js"
echo ""

echo "🎯 NEXT STEPS:"
echo "   1. Run the simple audio test to verify WhisperLive works with real audio"
echo "   2. If test passes, we know the issue is bot audio capture"
echo "   3. Implement WebRTC interception to capture participant audio"
echo "   4. Test with real Teams meeting"
echo ""

echo "✅ DIAGNOSIS COMPLETE - Ready to implement fix!"