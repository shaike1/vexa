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
